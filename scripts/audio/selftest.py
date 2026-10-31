"""selftest.py - checks the audio engine's claims with measurements.

  python scripts/audio/selftest.py          (about a minute; writes only to a temporary folder)

Each line is a claim, the measured value and ok/FAIL. Exit code 1 if any check fails.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import time

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
import audio_io as aio  # noqa: E402
import duck_env  # noqa: E402
import limiter  # noqa: E402
import loudness  # noqa: E402
import mix  # noqa: E402
import sfx_synth as S  # noqa: E402

SR = S.SR
results: list[tuple[bool, str, str]] = []


def check(ok: bool, claim: str, measured: str) -> None:
    results.append((bool(ok), claim, measured))
    print(f"{'ok  ' if ok else 'FAIL'} {claim:62s} {measured}")


def stem(folder: str, name: str) -> np.ndarray:
    """A stem mix.py wrote, in whichever format the sheet chose (FLAC by default)."""
    for ext in (".flac", ".wav"):
        p = os.path.join(folder, name + ext)
        if os.path.exists(p):
            return aio.decode(p)
    raise FileNotFoundError(os.path.join(folder, name))


def short_term_at(x: np.ndarray, t: float) -> float:
    """3 s loudness of x centred on t (for level continuity across crossfades)."""
    a, b = int((t - 1.5) * SR), int((t + 1.5) * SR)
    return loudness.integrated(x[max(0, a):b]) if b > a else float("-inf")


def main() -> int:
    t_all = time.time()
    # 1. determinism
    h = []
    for _ in range(2):
        x = np.concatenate([S.note(degree=5, seed="a"), S.pin_brush(dur=0.5, seed=3), S.impact(seed=3)])
        h.append(hashlib.sha256(x.tobytes()).hexdigest()[:16])
    check(h[0] == h[1], "same recipe and seed -> bit-identical audio", f"{h[0]} == {h[1]}")
    check(S.seed_int("tick@720") == S.seed_int("tick@720") and S.seed_int("a") != S.seed_int("b"),
          "string seeds are stable (SHA-1, not Python's salted hash)", f"seed('tick@720') = {S.seed_int('tick@720')}")

    # 2. the event note: -10 dB at `decay` seconds (the reel's 1.1 s), on the palette pitch
    nt = S.note(degree=3, key="D", decay=1.1, bright=0.0, velocity=1.0, seed=1)[:, 0].astype(np.float64)
    f0 = S.degree_hz(3, "D", 5)
    sos = signal.butter(4, [f0 * 0.9, f0 * 1.1], "bandpass", fs=SR, output="sos")
    env = np.abs(signal.hilbert(signal.sosfiltfilt(sos, nt)))
    a0 = env[int(0.05 * SR)] * np.exp(0.05 / (1.1 / (10 / 8.686)))  # back-extrapolate to t = 0
    d = 20 * np.log10(env[int(1.1 * SR)] / a0)
    check(abs(d + 10) <= 0.5, "event note falls 10 dB in 1.1 s", f"{d:.2f} dB at 1.10 s, F#5 = {f0:.2f} Hz")
    check(abs(S.degree_hz(1, "D", 5) - 587.33) < 0.01 and abs(S.degree_hz(7, "D", 5) - 1108.73) < 0.01,
          "palette degrees 1..7 of D major land on D5..C#6", f"{S.degree_hz(1, 'D', 5):.2f} .. {S.degree_hz(7, 'D', 5):.2f} Hz")

    # 3. the duck envelope reproduces audio.md's measured numbers
    g = duck_env.duck_envelope([(3.0, 3.3), (3.35, 3.7), (3.8, 4.4), (6.0, 6.5), (6.55, 7.2)], 10)
    check(abs(20 * np.log10(g[172]) + 10) < 0.05, "duck: -10 dB at 2.87 s for a word at 3.00 s", f"{20 * np.log10(g[172]):.2f} dB")
    gd, dep, _ = duck_env.music_curve([(3.0, 4.4), (6.0, 7.2)], 12, rate=60)
    check(gd[330] < -9.0, "music_curve: no pump in a 1.6 s gap (partial swell only)", f"{gd[330]:.2f} dB at 5.50 s")

    # 4. limiter and meter
    r = np.random.default_rng(0)
    hot = signal.sosfilt(signal.butter(2, 3000, fs=SR, output="sos"), r.standard_normal((SR * 8, 2)), axis=0) * 0.9
    y, info = limiter.limit(hot.astype(np.float32), ceiling_db=-2.0)
    check(loudness.true_peak(y) <= -1.995, "limiter: true peak at or under its ceiling", f"{loudness.true_peak(y):.3f} dBTP (ceiling -2.0)")
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "m.wav")
        aio.write_wav(p, y, bits=24)
        ff = aio.ff_ebur128(p)
        mine = loudness.integrated(aio.decode(p))
    check(abs(mine - ff["I"]) <= 0.1, "loudness meter matches ffmpeg ebur128", f"{mine:.2f} vs {ff['I']:.2f} LUFS")

    # 5. music only: an in-place swap to the alternative mix, then an equal-power crossfade
    with tempfile.TemporaryDirectory() as td:
        sheet = {"version": 1, "name": "selftest-music", "fps": 60, "durationS": 30.0, "music": {"level": -5, "cues": [
            {"id": "A", "track": "resonance", "in": 0, "out": 12, "offset": 20.0, "fadeIn": 0.5},
            {"id": "B", "track": "resonance-alt", "in": 10, "out": 20, "crossfade": 2.0, "crossfadeCurve": "hsin", "continues": "A"},
            {"id": "C", "track": "machina", "in": 20, "out": 30, "offset": 40.0, "crossfade": 3.0, "fadeOut": 1.0},
        ]}}
        sp = os.path.join(td, "sheet.json")
        json.dump(sheet, open(sp, "w"))
        rep = mix.mix(sp, os.path.join(td, "out"), False)
        mus = stem(os.path.join(td, "out"), "music")
        m = {c["id"]: c for c in rep["music"]}
        check(abs(m["B"]["offset"] - (20.0 + 10.0 + 0.219833)) < 1e-4, "continues: in-place offset from the measured alignment",
              f"B.offset {m['B']['offset']:.6f} s (A at 20 + 10 + 0.219833)")
        check(m["B"]["gainDb"] == m["A"]["gainDb"], "continues: the swap keeps the earlier cue's gain", f"{m['A']['gainDb']} dB == {m['B']['gainDb']} dB")
        # the swap happens over 10-12 s: compare the mixed bed with the main mix alone, sample by sample
        main = aio.decode(os.path.join(aio.ROOT, "public/audio/music/resonance.mp3"))[int(30.0 * SR):int(32.0 * SR)] * S.db(m["A"]["gainDb"])
        resid = loudness.integrated(mus[int(10 * SR):int(12 * SR)] - main) - loudness.integrated(main)
        check(resid <= -15, "in-place swap (hsin): the crossfade is inaudible", f"bed minus main mix: {resid:.1f} LU under the music")
        lv = [short_term_at(mus, t) for t in (18.5, 21.5, 24.5)]
        check(lv[1] >= min(lv[0], lv[2]) - 1.5, "equal-power crossfade (qsin): no dip in the middle", "  ".join(f"{v:.1f}" for v in lv) + " LUFS at 18.5/21.5/24.5 s")

    # 6. a full mix: alignment of effects, ducking, balance, master
    with tempfile.TemporaryDirectory() as td:
        sheet = {
            "version": 1, "name": "selftest", "fps": 60, "durationS": 30.0,
            "voice": {"src": os.path.join(aio.ROOT, "public/audio/demo/standin.wav"),
                      "wordsFrom": os.path.join(aio.ROOT, "public/audio/demo/words.json"), "at": 2.0, "wordsOffsetS": 2.0},
            "music": {"level": -5, "cues": [{"id": "A", "track": "machina", "in": 0, "out": 30, "offset": 1.13, "fadeOut": 1.0}]},
            "sfx": {"cues": [
                {"id": "riser", "type": "riser", "frame": 840, "align": "end", "send": 0, "params": {"dur": 1.6}},
                {"id": "whoosh", "type": "whoosh", "frame": 1500, "align": "peak"},
                {"id": "tick", "type": "tick", "frame": 1620},
            ]},
            "master": {"lufs": -15, "ceilingDb": -2.0, "truePeakMaxDb": -1.5},
        }
        sp = os.path.join(td, "sheet.json")
        json.dump(sheet, open(sp, "w"))
        rep = mix.mix(sp, os.path.join(td, "out"), True)
        sfx = stem(os.path.join(td, "out"), "sfx")
        sx = {c["id"]: c for c in rep["sfx"]}
        nz = np.nonzero(np.abs(sfx[: int(14.5 * SR)]).max(axis=1) > 1e-4)[0]
        riser_end = (nz[nz < int(14.2 * SR)].max() + 1) / SR
        check(abs(sx["riser"]["endS"] - 14.0) <= 1 / SR and abs(riser_end - 14.0) <= 1 / SR, "align end: the (dry) riser stops on its frame",
              f"report end {sx['riser']['endS']:.4f} s, audio stops {riser_end:.4f} s (frame 840 = 14.000 s)")
        w0, w1 = int(24.5 * SR), int(25.5 * SR)
        pk = (np.argmax(np.abs(signal.hilbert(sfx[w0:w1, 0] + sfx[w0:w1, 1]))) + w0) / SR
        check(abs(sx["whoosh"]["anchorS"] - 25.0) < 1e-6 and abs(pk - 25.0) < 0.06, "align peak: the whoosh peaks on its frame",
              f"envelope peak at {pk:.3f} s (frame 1500 = 25.000 s)")
        b = rep["balance"]["musicUnderVoiceLU"]
        check(12 <= b["median"] <= 16, "music sits 12-15 LU under the voice while it speaks", f"median {b['median']:.1f} LU (p10 {b['p10']:.1f}, p90 {b['p90']:.1f})")
        check(abs(rep["stems"]["voice"]["I"] + 16) <= 0.1, "voice stem normalised to -16 LUFS", f"{rep['stems']['voice']['I']:.2f} LUFS")
        ms = rep["master"]
        check(abs(ms["ffmpeg"]["I"] + 15) <= 0.5, "master -15 LUFS integrated (ffmpeg)", f"{ms['ffmpeg']['I']:.1f} LUFS")
        check(ms["aac"]["TP"] <= -1.5, "master <= -1.5 dBTP after AAC 320k", f"{ms['aac']['TP']:.2f} dBTP")
    bad = [r for r in results if not r[0]]
    print(f"{len(results) - len(bad)}/{len(results)} checks passed in {time.time() - t_all:.0f} s")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
