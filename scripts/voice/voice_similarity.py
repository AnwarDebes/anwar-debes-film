"""Compare candidate narrator voices with the reel's narrator (speaker-embedding cosine).

Run with the Ming venv (it has onnxruntime, torchaudio and the CAM++ encoder):
    python voice_similarity.py <reel_dir> <candidate_dir> [<candidate_dir> ...]
Each dir holds .wav files; every candidate dir is scored by the mean cosine similarity of its
clips to the reel narrator's mean embedding, plus median f0 and speaking rate for context.
"""
import glob
import os
import sys

import numpy as np
import soundfile as sf
import torch
import torchaudio

sys.path.insert(0, r"C:\Users\anwar\film-tools\tts\Ming-3.0-tts")
from spkemb_extractor import SpkembExtractor  # noqa: E402

ENC = SpkembExtractor(r"C:\Users\anwar\film-tools\tts\Ming-3.0-tts\models\Ming-3.0-tts-0.5b\campplus.onnx")


def load16k(path):
    audio, sr = sf.read(path, dtype="float32", always_2d=True)
    wav = torch.from_numpy(audio.mean(axis=1)).unsqueeze(0)
    if sr != 16000:
        wav = torchaudio.functional.resample(wav, sr, 16000)
    return wav


def embed(path):
    e = ENC(load16k(path)).numpy()[0]
    return e / np.linalg.norm(e)


def median_f0(path):
    wav = load16k(path)[0].numpy()
    frame, hop = 1024, 256
    f0s = []
    for i in range(0, len(wav) - frame, hop):
        x = wav[i:i + frame] * np.hanning(frame)
        if np.sqrt(np.mean(x ** 2)) < 0.01:
            continue
        ac = np.correlate(x, x, "full")[frame - 1:]
        lo, hi = 16000 // 400, 16000 // 70
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.3 * ac[0]:
            f0s.append(16000 / lag)
    return float(np.median(f0s)) if f0s else float("nan")


reel_dir, cand_dirs = sys.argv[1], sys.argv[2:]
reel_files = sorted(glob.glob(os.path.join(reel_dir, "u*.wav")))
reel = np.mean([embed(f) for f in reel_files], axis=0)
reel /= np.linalg.norm(reel)
print(f"reel narrator: {len(reel_files)} clips, median f0 {np.median([median_f0(f) for f in reel_files]):.0f} Hz")
rows = []
for d in cand_dirs:
    files = sorted(glob.glob(os.path.join(d, "*.wav")))
    if not files:
        continue
    sims = [float(np.dot(embed(f), reel)) for f in files]
    f0 = np.median([median_f0(f) for f in files])
    rows.append((np.mean(sims), os.path.basename(d.rstrip("/\\")), np.min(sims), f0, len(files)))
for mean, name, mn, f0, n in sorted(rows, reverse=True):
    print(f"{name:<24} similarity {mean:.3f} (min {mn:.3f})  median f0 {f0:.0f} Hz  clips {n}")
