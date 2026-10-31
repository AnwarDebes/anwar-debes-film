"""Render script lines with Ming-3.0-tts-0.5B on the CPU (fp32), N takes per line.

Run with the Ming venv's python, from the Ming-3.0-tts folder:
    python narrate_ming.py lines.json out_dir [voice] [takes]
lines.json: [{"id": "...", "text": "..."}]  (numbers already written out as words)
Writes <id>_t<k>.wav and render_log.json (seed, seconds, RTF per take).
"""
import json
import os
import random
import sys
import time

import numpy as np
import torch
from ming_tts import MingTTS

lines_path, out_dir = sys.argv[1], sys.argv[2]
VOICE = sys.argv[3] if len(sys.argv) > 3 else "US_Emma"
TAKES = int(sys.argv[4]) if len(sys.argv) > 4 else 1
torch.set_num_threads(4)

os.makedirs(out_dir, exist_ok=True)
DEV = "cuda" if os.environ.get("MING_GPU") == "full" and torch.cuda.is_available() else "cpu"
tts = MingTTS(os.path.join("models", "Ming-3.0-tts-0.5b"), device=DEV, text_normalization=False)
print("device", DEV, flush=True)

MODE = os.environ.get("MING_GPU", "flow")

# MING_GPU=lm: the language model (and its embeddings) also runs on the GPU in fp16; inputs are
# still built on the CPU and the audio VAE decodes on the CPU, so it fits a 2 GB card.
if MODE == "lm" and torch.cuda.is_available():
    m = tts.model
    cuda = torch.device("cuda")
    type(m).device = property(lambda self: torch.device("cpu"))  # build inputs on the CPU
    lm = m.model
    lm.to(cuda, dtype=torch.float16)
    emb = lm.get_input_embeddings()
    _emb = emb.forward
    emb.forward = lambda ids: _emb(ids.to(cuda)).to("cpu", torch.float32)
    _lm = lm.forward

    def _lm_gpu(*a, **kw):
        for k in ("attention_mask", "position_ids"):
            if torch.is_tensor(kw.get(k)):
                kw[k] = kw[k].to(cuda)
        if torch.is_tensor(kw.get("inputs_embeds")):
            kw["inputs_embeds"] = kw["inputs_embeds"].to(cuda, torch.float16)
        return _lm(*a, **kw)

    lm.forward = _lm_gpu
    for name in ("flowloss", "linear_proj_audio", "stop_head"):
        getattr(m, name).to(cuda, dtype=torch.float32)
    _sample = m.flowloss.sample

    def _sample_lm(z, latent_history, cfg=1.0, patch_size=1, sigma=0.25, temperature=0, steps=10):
        out = _sample(z.to(cuda, torch.float32), latent_history.to(cuda, torch.float32), cfg, patch_size,
                      sigma=sigma, temperature=temperature, steps=steps)
        return out.to(latent_history.dtype)  # history is kept in the LM's dtype

    m.flowloss.sample = _sample_lm
    _proj = m.linear_proj_audio.forward
    m.linear_proj_audio.forward = lambda x: _proj(x.to(cuda, torch.float32))
    _stop = m.stop_head.forward
    m.stop_head.forward = lambda x: _stop(x.to(cuda, torch.float32))
    _dec = m.audio.decode

    def _decode_cpu(*a, **kw):
        a = [x.to("cpu", torch.float32) if torch.is_tensor(x) and x.is_floating_point() else (x.to("cpu") if torch.is_tensor(x) else x) for x in a]
        kw = {k: (v.to("cpu", torch.float32) if torch.is_tensor(v) and v.is_floating_point() else (v.to("cpu") if torch.is_tensor(v) else v)) for k, v in kw.items()}
        return _dec(*a, **kw)

    m.audio.decode = _decode_cpu
    print("language model + flow head on", torch.cuda.get_device_name(0), flush=True)

# MING_GPU=flow: run the flow-matching head (20 passes per 80 ms of audio) and the latent
# projection on the GPU in fp32; the language model and the audio VAE stay on the CPU.
elif MODE == "flow" and torch.cuda.is_available():
    m = tts.model
    m.flowloss.to("cuda")
    m.linear_proj_audio.to("cuda")
    _sample = m.flowloss.sample

    def _sample_gpu(z, latent_history, cfg=1.0, patch_size=1, sigma=0.25, temperature=0, steps=10):
        out = _sample(z.to("cuda"), latent_history.to("cuda"), cfg, patch_size,
                      sigma=sigma, temperature=temperature, steps=steps)
        return out.to("cpu")

    m.flowloss.sample = _sample_gpu
    _proj = m.linear_proj_audio.forward
    m.linear_proj_audio.forward = lambda x: _proj(x.to("cuda")).to("cpu")
    print("flow head on", torch.cuda.get_device_name(0), flush=True)
log = []
for ln in json.load(open(lines_path, encoding="utf-8-sig")):
    for take in range(1, TAKES + 1):
        seed = (1895 + 1000 * take + int("".join(c for c in ln["id"] if c.isdigit()) or 0)) % (2**32 - 1)
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        name = f"{ln['id']}.wav" if TAKES == 1 else f"{ln['id']}_t{take}.wav"
        path = os.path.join(out_dir, name)
        if os.path.exists(path):
            continue  # resumable: takes already on disk are kept
        t0 = time.perf_counter()
        wav = tts.synthesize(task="IP", text=ln["text"], language_id="English",
                             controls={"ip": VOICE}, use_zero_spk_emb=True, output_path=path)
        secs = wav.shape[-1] / tts.sample_rate
        rtf = (time.perf_counter() - t0) / secs
        log.append({"id": ln["id"], "take": take, "seed": seed, "voice": VOICE, "path": path,
                    "seconds": round(secs, 2), "rtf": round(rtf, 2)})
        print(f"{ln['id']} take {take}: {secs:.1f} s of audio, RTF {rtf:.2f}", flush=True)
        with open(os.path.join(out_dir, "render_log.jsonl"), "a", encoding="utf-8") as f:
            f.write(json.dumps(log[-1]) + chr(10))
