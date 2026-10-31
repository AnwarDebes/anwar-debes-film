"""analyze_music.py - estimates the key of every track in audio/music-manifest.json and records it.

  python analyze_music.py                 analyse every track and write `analysis` into the manifest
  python analyze_music.py --only=machina  one or more ids
  python analyze_music.py --dry           print only
  python analyze_music.py --align         measure every alternative mix against its main mix and
                                          write `alignment` (see align() below)

Method: a constant-Q-like chroma (STFT, 8192-point, magnitudes summed onto the 12 pitch classes
from 55 Hz to 2.1 kHz with log compression), averaged over the whole track and over 30 s windows,
correlated with the Krumhansl-Kessler major and minor profiles in all 24 rotations. The event notes
only need the key signature (which notes are safe), so a relative major/minor confusion costs
nothing; `palette` lists the six palette notes the mix will use for that key.
An estimate is an estimate: set "key" on a track in the manifest to override it after listening.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
import audio_io as aio  # noqa: E402
import sfx_synth as S  # noqa: E402

KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def chroma_frames(x: np.ndarray, sr: int = aio.SR, nfft: int = 8192, hop: int = 4096) -> np.ndarray:
    mono = x.mean(axis=1) if x.ndim == 2 else x
    f, t, Z = signal.stft(mono, fs=sr, nperseg=nfft, noverlap=nfft - hop, boundary=None, padded=False)
    mag = np.log1p(100 * np.abs(Z))
    sel = (f >= 55) & (f <= 2100)
    midi = 69 + 12 * np.log2(f[sel] / 440.0)
    pc = np.mod(np.round(midi), 12).astype(int)
    C = np.zeros((12, mag.shape[1]))
    for k in range(12):
        C[k] = mag[sel][pc == k].sum(axis=0)
    return C, t


def key_of(chroma: np.ndarray) -> list[tuple[str, float]]:
    v = chroma / (np.linalg.norm(chroma) + 1e-12)
    out = []
    for tonic in range(12):
        for mode, prof in (("major", KK_MAJOR), ("minor", KK_MINOR)):
            p = np.roll(prof, tonic)
            out.append((f"{NAMES[tonic]} {mode}", float(np.corrcoef(v, p)[0, 1])))
    return sorted(out, key=lambda kv: -kv[1])


def palette_for(key: str) -> list[str]:
    tonic = S.key_tonic(key)
    return [NAMES[(tonic + S.MAJOR[d - 1]) % 12] for d in S.PALETTE_DEGREES]


def analyse(path: str) -> dict:
    x = aio.decode(path)
    C, t = chroma_frames(x)
    energy = C.sum(axis=0)
    keep = energy > np.percentile(energy, 20)
    ranked = key_of(C[:, keep].sum(axis=1))
    segs = []
    win = 30.0
    total = len(x) / aio.SR
    s = 0.0
    while s < total - 5:
        m = (t >= s) & (t < s + win) & keep
        if m.sum() > 4:
            k, score = key_of(C[:, m].sum(axis=1))[0]
            segs.append({"fromS": round(s, 1), "toS": round(min(total, s + win), 1), "key": k, "score": round(score, 3)})
        s += win
    best, score = ranked[0]
    return {
        "key": best,
        "keyScore": round(score, 3),
        "alternatives": [{"key": k, "score": round(v, 3)} for k, v in ranked[1:4]],
        "palette": palette_for(best),
        "durationS": round(total, 3),
        "segments": segs,
        "method": "chroma (STFT 8192, 55-2100 Hz) x Krumhansl-Kessler profiles; key signature is what the palette uses",
        "analyzedAt": dt.date.today().isoformat(),
    }


def _best_lag(x: np.ndarray, y: np.ndarray, s: int, n: int, span: int) -> tuple[int, float]:
    """Lag (samples) at which y best matches x[s:s+n], with its normalised correlation."""
    xm = x[s:s + n].mean(axis=1).astype(np.float64)
    ym = y[max(0, s - span):s + n + span].mean(axis=1).astype(np.float64)
    c = signal.correlate(ym, xm, mode="valid", method="fft")
    cs = np.concatenate([[0.0], np.cumsum(ym ** 2)])
    e = np.sqrt(cs[n:] - cs[:-n])[: len(c)] * np.sqrt(np.sum(xm ** 2)) + 1e-12
    r = c / e
    k = int(np.argmax(r))
    return k - (s - max(0, s - span)), float(r[k])


def align(alt: dict, main: dict, step_s: float = 15.0, win_s: float = 6.0) -> dict:
    """Where an alternative mix sits against its main mix, and whether it can be swapped in place.

    file time in `alt` = file time in `main` + offsetS. The lag is the median over windows every
    `step_s` seconds (normalised cross-correlation, mono, +-1 s search); `nullLU` is how far the
    difference (main - alt, aligned) sits under the main mix in each window: 15 LU or more means
    the two share the same samples there and an equal-gain crossfade swaps them invisibly; near
    0 LU they are different material and need an equal-power crossfade on a phrase boundary."""
    import loudness  # noqa: PLC0415
    x = aio.decode(os.path.join(aio.ROOT, "public", "audio", "music", main["file"]))
    y = aio.decode(os.path.join(aio.ROOT, "public", "audio", "music", alt["file"]))
    sr = aio.SR
    n, span = int(win_s * sr), sr
    rows = []
    t = 2.0
    while t + win_s + 1 < min(len(x), len(y)) / sr:
        s = int(t * sr)
        lag, r = _best_lag(x, y, s, n, span)
        rows.append((t, lag, r))
        t += step_s
    lag = int(np.median([r[1] for r in rows]))
    windows = []
    for t, lg, r in rows:
        s = int(t * sr)
        a = x[s:s + n]
        b = y[s + lag:s + lag + n]
        if len(b) < n:
            continue
        null = loudness.integrated(a) - loudness.integrated(a - b)
        windows.append({"atS": round(t, 1), "lagSamples": lg, "corr": round(r, 3), "nullLU": round(float(null), 1)})
    clean = [w for w in windows if w["nullLU"] >= 9.0 and abs(w["lagSamples"] - lag) <= 2]
    swap_until = None
    for w in windows:
        if w in clean:
            swap_until = w["atS"] + win_s
        else:
            break
    return {
        "reference": main["id"],
        "offsetS": round(lag / sr, 6),
        "lagSamples48k": lag,
        "lagSpreadSamples": int(max(abs(w["lagSamples"] - lag) for w in windows)) if windows else None,
        "inPlaceSwapUntilS": swap_until,
        "verdict": (f"same samples until {swap_until:.0f} s of the main mix, where an equal-gain ('hsin') crossfade swaps them "
                    "in place; after that the mixes differ: crossfade equal-power ('qsin') on a phrase boundary"
                    if swap_until else "not sample-aligned: crossfade equal-power ('qsin') on a phrase boundary"),
        "windows": windows,
        "method": "normalised cross-correlation (mono, 6 s windows every 15 s, +-1 s); null = main minus aligned alt, BS.1770 loudness",
        "measuredAt": dt.date.today().isoformat(),
    }


def main(argv: list[str]) -> int:
    args = dict(a.lstrip("-").split("=", 1) if "=" in a else (a.lstrip("-"), True) for a in argv)
    mpath = os.path.join(aio.ROOT, "audio", "music-manifest.json")
    manifest = json.load(open(mpath, encoding="utf-8"))
    only = set(str(args["only"]).split(",")) if "only" in args else None
    if "align" in args:
        mains = {t["page"]: t for t in manifest["tracks"] if t.get("mix") == "main"}
        for tr in manifest["tracks"]:
            if tr.get("mix") != "alt" or (only and tr["id"] not in only) or tr.get("page") not in mains:
                continue
            al = align(tr, mains[tr["page"]])
            tr["alignment"] = al
            nulls = " ".join(f"{w['nullLU']:.0f}" for w in al["windows"])
            print(f"{tr['id']:18s} vs {al['reference']:10s} offset {al['offsetS'] * 1000:8.2f} ms (spread {al['lagSpreadSamples']} samples)"
                  f"  null LU by window: {nulls}\n{'':18s} {al['verdict']}")
        if "dry" not in args:
            with open(mpath, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"alignment written to {aio.rel(mpath)}")
        return 0
    for tr in manifest["tracks"]:
        if only and tr["id"] not in only:
            continue
        p = os.path.join(aio.ROOT, "public", "audio", "music", tr["file"])
        if not os.path.exists(p):
            print(f"{tr['id']:20s} missing (run scripts/audio/fetch-music.mjs)")
            continue
        a = analyse(p)
        tr["analysis"] = a
        alts = ", ".join(f"{x['key']} {x['score']:.2f}" for x in a["alternatives"])
        segkeys = sorted({s["key"] for s in a["segments"]})
        print(f"{tr['id']:20s} {a['key']:9s} {a['keyScore']:.2f}  (next: {alts})  {a['durationS']:6.1f}s  sections: {', '.join(segkeys)}")
    if "dry" not in args:
        with open(mpath, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"analysis written to {aio.rel(mpath)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
