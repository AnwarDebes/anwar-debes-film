"""separate.py - isolate the voice of a mixed recording with Demucs (htdemucs, MIT licence).

  <python with torch + demucs> separate.py in.wav vocals.wav

Used once, by make_standin.py, to lift the narration out of the reel's own music bed. It runs in
its own interpreter (FILM_SEP_PYTHON, default $FILM_TOOLS/venv-sep), so the mix
tools never depend on torch. Seeded: the same input gives the same output on the same machine.
"""
import sys

import numpy as np
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model


def main(src: str, dst: str) -> None:
    model = get_model("htdemucs")
    model.eval()
    x, sr = sf.read(src, dtype="float32", always_2d=True)
    if sr != model.samplerate:
        raise SystemExit(f"{src}: {sr} Hz, the model wants {model.samplerate} Hz")
    wav = torch.from_numpy(np.ascontiguousarray(x.T))[None]
    ref = wav.mean(1, keepdim=True)
    mean, std = ref.mean(), ref.std()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    torch.manual_seed(0)
    with torch.no_grad():
        out = apply_model(model, (wav - mean) / std, device=dev, shifts=2, split=True, overlap=0.25,
                          progress=False, segment=7.8)[0]
    out = out * std + mean
    voc = out[model.sources.index("vocals")].cpu().numpy().T
    sf.write(dst, voc, sr, subtype="FLOAT")
    print(f"vocals -> {dst} ({dev})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
