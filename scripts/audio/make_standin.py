"""make_standin.py - a narration stand-in for audio tests, cut from the reel, with its word timings.

  python make_standin.py --reel <reel-720p.mp4> --words <reel.json> [--from 0] [--to 24]
                         [--out public/audio/demo]

Takes the reel's audio over [from, to], lifts the voice out of the reel's music bed with Demucs
(separate.py, in FILM_SEP_PYTHON) when that interpreter exists, gates everything outside the
spoken phrases (the reel's own word timings, 120 ms of air either side), and writes:
  <out>/standin.wav   48 kHz mono, 16-bit
  <out>/words.json    the words in NarrationTimeline form (src/engine/narration/types.ts),
                      shifted so the excerpt starts at 0
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_io as aio  # noqa: E402

SEP_PY = os.environ.get("FILM_SEP_PYTHON", os.path.join(os.environ.get("FILM_TOOLS", os.path.expanduser("~/film-tools")), "venv-sep", "bin", "python"))


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--reel", required=True)
    ap.add_argument("--words", required=True, help="reel.json with utts[].words[[text, start, end, tag]]")
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float, default=24.0)
    ap.add_argument("--out", default="public/audio/demo")
    ap.add_argument("--no-separation", action="store_true")
    a = ap.parse_args(argv)
    out_dir = aio.resolve(a.out)
    os.makedirs(out_dir, exist_ok=True)
    reel = json.load(open(a.words, encoding="utf-8"))
    dur = a.t1 - a.t0

    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, "raw.wav")
        subprocess.run([aio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-ss", str(a.t0), "-t", str(dur + 0.5),
                        "-i", a.reel, "-vn", "-ac", "2", "-af", "aresample=44100:resampler=soxr:precision=28",
                        "-c:a", "pcm_f32le", raw], check=True)
        src = raw
        method = "reel audio, gated"
        if not a.no_separation and os.path.exists(SEP_PY):
            voc = os.path.join(td, "vocals.wav")
            subprocess.run([SEP_PY, os.path.join(os.path.dirname(__file__), "separate.py"), raw, voc], check=True)
            src = voc
            method = "reel audio, voice separated with Demucs htdemucs, gated"
        x = aio.decode(src)  # -> 48 kHz stereo
    x = x[: int(round(dur * aio.SR))]
    mono = x.mean(axis=1)

    words, utts = [], []
    for u in reel["utts"]:
        ws = [w for w in u["words"] if w[1] >= a.t0 and w[2] <= a.t1]
        if not ws:
            continue
        chap = None
        for c in reel.get("chapters", []):
            if c["t"] <= ws[0][1] + 0.6:
                chap = c["title"]
        utts.append({"id": u["id"], "chapter": chap or "", "words": [
            {"text": w[0], "start": round(w[1] - a.t0, 3), "end": round(w[2] - a.t0, 3), "tag": w[3]} for w in ws]})
        words += [(w[1] - a.t0, w[2] - a.t0) for w in ws]

    # gate: keep the phrases with 120 ms of air either side, 30 ms raised-cosine edges
    keep = np.zeros(len(mono))
    t = np.arange(len(mono)) / aio.SR
    for s, e in words:
        lo, hi = s - 0.12, e + 0.12
        f = 0.03
        up = np.clip((t - (lo - f)) / f, 0, 1)
        dn = np.clip(((hi + f) - t) / f, 0, 1)
        keep = np.maximum(keep, 0.5 - 0.5 * np.cos(np.pi * np.minimum(up, dn)))
    y = (mono * keep).astype(np.float32)
    aio.write_wav(os.path.join(out_dir, "standin.wav"), y[:, None], bits=16, seed=11)

    chapters = []
    for c in reel.get("chapters", []):
        if a.t0 - 30 <= c["t"] < a.t1:
            chapters.append({"id": c["title"].lower().replace(" ", "-"), "title": c["title"], "start": round(max(0.0, c["t"] - a.t0), 3)})
    for i, c in enumerate(chapters):
        c["end"] = chapters[i + 1]["start"] if i + 1 < len(chapters) else round(dur, 3)
    timeline = {"fps": 60, "durationS": round(dur, 3), "chapters": chapters, "utterances": utts,
                "source": {"reel": os.path.basename(a.reel), "from": a.t0, "to": a.t1, "method": method}}
    aio.save_json(os.path.join(out_dir, "words.json"), timeline)
    print(f"stand-in: {dur:.2f} s, {len(words)} words in {len(utts)} utterances ({method}) -> {aio.rel(out_dir)}")


if __name__ == "__main__":
    main(sys.argv[1:])
