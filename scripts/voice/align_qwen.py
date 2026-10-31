"""Word timings for narration lines with Qwen3-ForcedAligner-0.6B (aligned to the known script).

python align_qwen.py jobs.json out_dir
jobs.json: [{"id": "...", "wav": "path.wav", "text": "spoken text"}]
Writes <out_dir>/<id>.words.json: [{"text", "start", "end"}] in seconds, relative to the clip.
"""
import json
import os
import sys
import time

import torch
from qwen_asr import Qwen3ForcedAligner

torch.set_num_threads(4)
jobs_path, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
aligner = Qwen3ForcedAligner.from_pretrained("Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.float32, device_map="cpu")
for job in json.load(open(jobs_path, encoding="utf-8-sig")):
    out = os.path.join(out_dir, f"{job['id']}.words.json")
    if os.path.exists(out):
        continue
    t0 = time.perf_counter()
    items = aligner.align(audio=job["wav"], text=job["text"], language="English")[0]
    words = [{"text": w.text, "start": round(w.start_time, 3), "end": round(w.end_time, 3)} for w in items]
    with open(out, "w", encoding="utf-8") as f:
        json.dump(words, f, indent=1, ensure_ascii=False)
    print(f"{job['id']}: {len(words)} words in {time.perf_counter() - t0:.1f} s", flush=True)
