"""Verify the voice-to-background balance of every Short from the Shorts mix's stems, over exactly
the stretches each Short is cut from, plus the delivered file's loudness and true peak.

Per Short (thresholds from the research brief: target 20 LU for phone listening):
  3 s short-term voice - (music + sfx), blocks whose whole window is narration: median >= 18.5,
  10th percentile >= 15, worst >= 10, no block with the background as loud as the voice;
  400 ms momentary on spoken blocks: 5th percentile >= 10;
  file: integrated -14 +-1 LUFS (or lower only when held down by the true-peak limit),
  true peak <= -1.0 dBTP after AAC, maximum short-term <= integrated + 5 LU.
  python scripts/shorts/verify_shorts.py out/shorts/shorts.json public/audio/film-shorts scripts/audio
"""
import json
import os
import sys

import numpy as np
from scipy.ndimage import minimum_filter1d

manifest_path, mix_dir, audio_dir = sys.argv[1:4]
sys.path.insert(0, audio_dir)
import audio_io as aio  # noqa: E402
import loudness  # noqa: E402

HOP, SR = 800, 48_000
shorts = json.load(open(manifest_path, encoding="utf-8"))
meters = json.load(open(f"{mix_dir}/meters.json", encoding="utf-8"))
depth = np.asarray(meters["voiceActivity"], dtype=np.float64)


def centred(v, shift):
    return np.concatenate([v[shift:], np.full(min(shift, len(v)), v[-1])])


def meters_of(x):
    bp = loudness.block_power(x, HOP)
    return centred(loudness.short_term(x, bp, HOP), 90), centred(loudness.momentary(x, bp, HOP), 12)


voice = aio.decode(f"{mix_dir}/voice.flac")
bg = aio.decode(f"{mix_dir}/music.flac").astype(np.float32) + aio.decode(f"{mix_dir}/sfx.flac").astype(np.float32)
vS, vM = meters_of(voice)
bS, bM = meters_of(bg)
n = min(len(vS), len(bS), len(depth))
vS, vM, bS, bM, d = vS[:n], vM[:n], bS[:n], bM[:n], depth[:n]
speaking = (d >= 0.999) & (vS > -50)
interior = minimum_filter1d((d >= 0.999).astype(np.uint8), size=181, mode="nearest").astype(bool) & speaking

rows, all_ok = [], True
for s in shorts:
    idx = np.zeros(n, dtype=bool)
    for a, b in s["segments"]:
        idx[int(a * 60):min(n, int(b * 60))] = True
    row = {"file": s["file"], "speechS": round(float((idx & speaking).sum()) / 60, 1)}
    ok = True
    m = idx & interior & (bS > -60)
    if m.sum() >= 30:
        sep = vS[m] - bS[m]
        row.update(median=round(float(np.median(sep)), 1), p10=round(float(np.percentile(sep, 10)), 1),
                   worst=round(float(sep.min()), 1), criticalPct=round(100 * float(np.mean(sep < 0)), 2))
        ok &= row["median"] >= 18.5 and row["p10"] >= 15 and row["worst"] >= 10 and row["criticalPct"] == 0
    sp = idx & speaking & (bS > -60)
    if sp.sum() >= 30:
        e = sp & (vM > np.median(vM[sp]) - 8)
        sm = vM[e] - bM[e]
        row["momentaryP5"] = round(float(np.percentile(sm, 5)), 1)
        ok &= row["momentaryP5"] >= 10
    x = aio.decode(os.path.join(os.path.dirname(os.path.abspath(manifest_path)), s["file"]))
    st = loudness.stats(x)
    row.update(lufs=st["I"], truePeak=st["TP"], smaxOverI=round(st["Smax"] - st["I"], 1))
    ok &= st["I"] <= -13.0 and (st["I"] >= -15.0 or s["audio"]["gainDb"] < (-14.0 - s["audio"]["preLufs"]) - 0.05)
    ok &= st["TP"] <= -1.0 and row["smaxOverI"] <= 5.0
    row["pass"] = bool(ok)
    all_ok &= ok
    rows.append(row)
    print(f"{row['file']:42} sep median {row.get('median', '-'):>5} p10 {row.get('p10', '-'):>5} worst {row.get('worst', '-'):>5}"
          f" mom.p5 {row.get('momentaryP5', '-'):>5} | {row['lufs']:6.2f} LUFS TP {row['truePeak']:6.2f} S-I {row['smaxOverI']:4.1f}"
          f"  {'PASS' if ok else 'FAIL'}", flush=True)

json.dump({"thresholds": {"median": 18.5, "p10": 15, "worst": 10, "momentaryP5": 10, "lufs": [-15, -13],
                          "truePeakMax": -1.0, "smaxOverIMax": 5}, "shorts": rows, "allPass": bool(all_ok)},
          open(os.path.join(os.path.dirname(os.path.abspath(manifest_path)), "shorts-verify.json"), "w", encoding="utf-8"), indent=1)
print("VERIFY", "ALL PASS" if all_ok else "SOME FAIL", sum(r["pass"] for r in rows), "/", len(rows), flush=True)
