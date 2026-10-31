"""Kokoro-82M: every line plus native word timings.

python narrate_kokoro.py lines.json out_dir [voice] [speed]
lines.json: [{"id": "...", "text": "..."}]  (pronunciation overrides inline: [Tsetlin](/tsˈɛtlɪn/))
Writes <id>.wav (24 kHz) and <id>.words.json ([{text, start, end}] in seconds).
"""
import json
import os
import sys
import time

import numpy as np
import soundfile as sf
import torch
from kokoro import KPipeline

torch.set_num_threads(4)
lines_path, out_dir = sys.argv[1], sys.argv[2]
VOICE = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 0.94
SR = 24000
os.makedirs(out_dir, exist_ok=True)
pipe = KPipeline(lang_code="b" if VOICE.startswith("b") else "a", repo_id="hexgrad/Kokoro-82M")
for ln in json.load(open(lines_path, encoding="utf-8-sig")):
    t0 = time.perf_counter()
    chunks, words, offset = [], [], 0.0
    for r in pipe(ln["text"], voice=VOICE, speed=SPEED, split_pattern=r"\n+"):
        audio = r.audio.cpu().numpy()
        for tok in r.tokens or []:
            if tok.start_ts is None or tok.end_ts is None:
                continue
            if any(ch.isalnum() for ch in tok.text):
                words.append({"text": tok.text, "start": round(offset + tok.start_ts, 3), "end": round(offset + tok.end_ts, 3)})
            elif words:
                words[-1]["text"] += tok.text
        chunks.append(audio)
        offset += len(audio) / SR
    audio = np.concatenate(chunks)
    sf.write(os.path.join(out_dir, f"{ln['id']}.wav"), audio, SR)
    with open(os.path.join(out_dir, f"{ln['id']}.words.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, indent=1, ensure_ascii=False)
    secs = len(audio) / SR
    print(f"{ln['id']}: {secs:.2f} s audio, RTF {(time.perf_counter() - t0) / secs:.2f}")
