"""audio_io.py - decoding, caching and writing audio for the film mix.

Everything is 48 kHz float32 stereo, shape (N, 2). Sources in any format or rate are decoded
through ffmpeg (soxr resampler, gapless MP3 headers honoured) straight into memory, once per
process. A 10-minute track decodes in about 5 s on this laptop, so nothing is cached on disk by
default (a decoded score is about 1 GB of float WAV). Set FILM_AUDIO_DECODE_CACHE=1 to keep
decoded files under audio/.cache/decoded/ when a session runs many mixes and the disk has room;
the cached and the piped decode are bit-identical.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import tempfile

import numpy as np
import soundfile as sf

SR = 48_000
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "audio", ".cache")


def rel(path: str) -> str:
    """Project-relative path with forward slashes (for reports)."""
    try:
        return os.path.relpath(path, ROOT).replace("\\", "/")
    except ValueError:
        return path.replace("\\", "/")


def resolve(path: str, base: str | None = None) -> str:
    """Absolute path: as given, else relative to `base` (a cue sheet's folder), else to the project."""
    if os.path.isabs(path):
        return path
    for b in ([base] if base else []) + [ROOT]:
        p = os.path.normpath(os.path.join(b, path))
        if os.path.exists(p):
            return p
    return os.path.normpath(os.path.join(ROOT, path))


def ffmpeg_bin() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("ffmpeg not found on PATH (it decodes MP3 and measures loudness)")
    return exe


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _cache_key(path: str) -> str:
    st = os.stat(path)
    return hashlib.sha1(f"{os.path.abspath(path)}|{st.st_size}|{int(st.st_mtime)}|v1".encode()).hexdigest()[:20]


_DECODED: dict[str, np.ndarray] = {}
_DECODED_MAX = 12


def _ffmpeg_decode_cmd(path: str, out: str, fmt: list[str]) -> list[str]:
    return [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-vn",
            "-af", f"aresample={SR}:resampler=soxr:precision=28", "-ac", "2", *fmt, "-c:a", "pcm_f32le", out]


def decode(path: str) -> np.ndarray:
    """Any audio (or video) file -> float32 (N, 2) at 48 kHz, decoded once per process.
    The returned array is shared: copy it before writing into it."""
    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    key = f"{path}|{_cache_key(path)}"
    hit = _DECODED.get(key)
    if hit is not None:
        return hit
    info = None
    try:
        info = sf.info(path)
    except Exception:
        pass
    if info is not None and info.samplerate == SR and info.channels in (1, 2):
        x, _ = sf.read(path, dtype="float32", always_2d=True)
        x = np.repeat(x, 2, axis=1) if x.shape[1] == 1 else x
    elif os.environ.get("FILM_AUDIO_DECODE_CACHE") == "1":
        os.makedirs(os.path.join(CACHE, "decoded"), exist_ok=True)
        cached = os.path.join(CACHE, "decoded", f"{os.path.splitext(os.path.basename(path))[0]}.{_cache_key(path)}.wav")
        if not os.path.exists(cached):
            tmp = cached + ".part.wav"
            subprocess.run(_ffmpeg_decode_cmd(path, tmp, []), check=True)
            os.replace(tmp, cached)
        x, _ = sf.read(cached, dtype="float32", always_2d=True)
    else:
        p = subprocess.run(_ffmpeg_decode_cmd(path, "-", ["-f", "f32le"]), capture_output=True, check=True)
        x = np.frombuffer(p.stdout, dtype="<f4").reshape(-1, 2)
    x.setflags(write=False)
    if len(_DECODED) >= _DECODED_MAX:
        _DECODED.pop(next(iter(_DECODED)))
    _DECODED[key] = x
    return x


def write_audio(path: str, x: np.ndarray, bits: int = 24, seed: int = 0) -> str:
    """PCM WAV or FLAC (by the extension) with TPDF dither at the target word length
    (deterministic). FLAC is lossless: the same samples as the WAV in about 25-55 % of the bytes,
    which matters because every Remotion render copies public/ into its bundle. Returns the path."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    flac = path.lower().endswith(".flac")
    x = np.asarray(x, dtype=np.float64)
    if bits == 32:
        if flac:
            raise ValueError("FLAC holds integer samples: use bits=24")
        sf.write(path, x.astype(np.float32), SR, subtype="FLOAT")
        return path
    q = 2.0 ** (bits - 1)
    r = np.random.default_rng(seed)
    d = (r.random(x.shape) - r.random(x.shape)) / q
    y = np.clip(x + d, -1.0, 1.0 - 1.0 / q)
    subtype = {16: "PCM_16", 24: "PCM_24"}[bits]
    sf.write(path, y, SR, subtype=subtype, format="FLAC" if flac else "WAV")
    return path


write_wav = write_audio


def ff_ebur128(path: str) -> dict:
    """Independent check with ffmpeg's EBU R128 meter: integrated, LRA and true peak."""
    p = subprocess.run([ffmpeg_bin(), "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    err = p.stderr
    tail = err[err.rfind("Summary:"):]

    def grab(label: str) -> float | None:
        import re
        m = re.search(label + r":\s*(-?[\d.]+|-inf)", tail)
        if not m:
            return None
        return float("-inf") if m.group(1) == "-inf" else float(m.group(1))

    return {"I": grab("I"), "LRA": grab("LRA"), "TP": grab("Peak")}


def encode_aac_check(path: str, bitrate: str = "320k") -> dict:
    """Encode to AAC (as the delivery will) and measure the result: true peak must survive the codec."""
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "check.m4a")
        subprocess.run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-c:a", "aac", "-b:a", bitrate,
                        "-ar", str(SR), out], check=True)
        m = ff_ebur128(out)
    m["bitrate"] = bitrate
    return m


def save_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write("\n")
