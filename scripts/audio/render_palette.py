"""render_palette.py - renders a preview of every sound in the film's palette.

  python scripts/audio/render_palette.py

Writes to public/audio/sfx/:
  <name>.wav      each sound at its default level in the mix (LU under a -16 LUFS voice), 16-bit,
                  ready to drop into a scene with <Sfx name=...> (src/engine/audio/Sfx.tsx)
  _tour.m4a       every sound in turn at one loudness (-20 LUFS max momentary), for auditioning
  index.json      name, recipe, params, duration, peak time, level, measured loudness, tour time
and src/engine/audio/palette.ts (the same index as typed data for Remotion).
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import audio_io as aio  # noqa: E402
import loudness  # noqa: E402
import sfx_synth as S  # noqa: E402

VOICE = -16.0
TOUR_LUFS = -20.0

# name (URL-safe: sharps are spelled s), recipe, params, what it is for
PALETTE = [
    ("pin-tick", "pin_tick", {"seed": 1}, "one soft steel pin"),
    ("pin-tick-ring", "pin_tick", {"tau": 0.12, "f1": 2600, "seed": 2}, "a struck pin that rings"),
    ("pin-brush", "pin_brush", {"dur": 1.2, "shape": "bell", "seed": 3}, "a sweep of pins brushing past"),
    ("pin-brush-rise", "pin_brush", {"dur": 0.9, "shape": "rise", "pan": [-0.8, 0.8], "height": [0.1, 0.9], "seed": 4}, "pins rising left to right, low to high"),
    ("pin-brush-sparse", "pin_brush", {"dur": 1.0, "shape": "flat", "density": 90, "seed": 5}, "a few pins: a dissolve"),
    *[(f"note-{n.replace('#', 's')}", "note", {"note": n, "seed": i}, f"event note, palette {n}")
      for i, n in enumerate(["D5", "E5", "F#5", "A5", "B5", "C#6", "D6"])],
    ("chime", "chime", {}, "success: A5 to D6"),
    ("chime-triad", "chime", {"degrees": [3, 5, 8]}, "success, three notes: F#5 A5 D6"),
    ("error", "error_buzz", {}, "polite denied: F3 to E3"),
    ("blip", "blip", {}, "a chip or label appears (A5)"),
    ("blip-high", "blip", {"degree": 9}, "a second chip (E6)"),
    ("stamp", "stamp", {}, "a verdict stamp lands"),
    ("tick", "tick", {"seed": 6}, "counter tick"),
    ("typing", "typing", {"n_keys": 18, "rate": 9.0}, "keystrokes for code"),
    ("whoosh", "whoosh", {}, "camera move or transition (peak at 0.6 of its length)"),
    ("swish", "swish", {}, "a card swings in"),
    ("riser", "riser", {"dur": 1.6}, "into a chapter card (ends on the cut)"),
    ("riser-long", "riser", {"dur": 4.0}, "a long build (ends on the cut)"),
    ("reverse-swell", "reverse_swell", {"dur": 1.4, "tone_degree": 1}, "reversed bloom with a D, ends on the cut"),
    ("sub-hit", "sub_hit", {}, "tuned sub hit (A2 to D1)"),
    ("impact", "impact", {}, "chapter card hit"),
    ("glitch", "glitch", {}, "a failure beat"),
    ("paper", "paper", {}, "a page or document"),
    ("heartbeat", "heartbeat", {}, "a pulse"),
    ("camera-shutter", "camera_shutter", {}, "a screenshot"),
]


def peak_time(x: np.ndarray, kind: str, params: dict) -> float:
    if kind in S.PEAK_DEFAULT or "peak_at" in params:
        return float(params.get("peak_at", S.PEAK_DEFAULT.get(kind, 0.6))) * len(x) / S.SR
    hop = S.SR // 200
    n = len(x) // hop
    env = np.abs(x[: n * hop]).max(axis=1).reshape(n, hop).max(axis=1)
    return float(np.argmax(env) * hop / S.SR)


def main() -> int:
    out = os.path.join(aio.ROOT, "public", "audio", "sfx")
    os.makedirs(out, exist_ok=True)
    index, tour = [], []
    cursor = 0.5
    t_all = time.time()
    for name, kind, params, what in PALETTE:
        t0 = time.time()
        x = S.RECIPES[kind](**params).astype(np.float64)
        ev = loudness.event_level(x)
        level = S.DEFAULTS[kind]["level"]
        mix_gain = VOICE + level - ev
        y = x * S.db(mix_gain)
        aio.write_wav(os.path.join(out, f"{name}.wav"), y, bits=16, seed=5)
        dur = len(x) / S.SR
        tour.append((cursor, x * S.db(TOUR_LUFS - ev)))
        index.append({
            "name": name, "file": f"audio/sfx/{name}.wav", "recipe": kind, "category": S.CATEGORY[kind],
            "params": params, "about": what, "durS": round(dur, 4), "peakS": round(peak_time(x, kind, params), 4),
            "align": "end" if kind in ("riser", "reverse_swell") else ("peak" if kind in S.PEAK_DEFAULT else "start"),
            "level": level, "eventLufs": round(ev + mix_gain, 2), "tourAtS": round(cursor, 3),
        })
        cursor += dur + 0.6
        print(f"{name:18s} {kind:14s} {dur:5.2f}s  level {level:4d} LU  {time.time() - t0:4.2f}s")
    total = np.zeros((int((cursor + 0.5) * S.SR), 2))
    for at, x in tour:
        s = int(at * S.SR)
        total[s:s + len(x)] += x
    tmp = os.path.join(aio.CACHE, "_tour.wav")
    aio.write_wav(tmp, total, bits=24, seed=9)
    import subprocess
    subprocess.run([aio.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-c:a", "aac", "-b:a", "256k",
                    os.path.join(out, "_tour.m4a")], check=True)
    os.remove(tmp)
    meta = {"voiceTargetLufs": VOICE, "tourLufs": TOUR_LUFS, "sampleRate": S.SR,
            "note": "Previews at their default mix level; mix.py renders cues from the recipes, not from these files.",
            "sounds": index}
    aio.save_json(os.path.join(out, "index.json"), meta)
    ts = os.path.join(aio.ROOT, "src", "engine", "audio", "palette.ts")
    with open(ts, "w", encoding="utf-8") as f:
        f.write("// Generated by scripts/audio/render_palette.py from sfx_synth.py. Do not edit by hand.\n")
        f.write("// Every preview in public/audio/sfx/, at its default level in the mix.\n\n")
        f.write("import type {Align, SfxCategory, SfxType} from './types';\n\n")
        f.write("export interface PaletteSound {\n  name: string;\n  /** path under public/ */\n  file: string;\n"
                "  recipe: SfxType;\n  category: SfxCategory;\n  about: string;\n  durS: number;\n"
                "  /** time of the loudest moment (or the recipe's peak_at), seconds from the start */\n  peakS: number;\n"
                "  /** the alignment this sound is designed for */\n  align: Align;\n"
                "  /** default level, LU relative to the voice target */\n  level: number;\n  eventLufs: number;\n"
                "  /** where it plays in audio/sfx/_tour.m4a */\n  tourAtS: number;\n}\n\n")
        f.write("export const PALETTE = ")
        rows = [{k: v for k, v in it.items() if k != "params"} for it in index]
        f.write(json.dumps(rows, indent=2, ensure_ascii=False))
        f.write(" as const satisfies readonly PaletteSound[];\n\n")
        f.write("export type PaletteName = (typeof PALETTE)[number]['name'];\n\n")
        f.write("export const paletteSound = (name: PaletteName): PaletteSound => {\n"
                "  const s = PALETTE.find((p) => p.name === name);\n"
                "  if (!s) throw new Error(`no palette sound ${name}`);\n  return s;\n};\n")
    print(f"{len(index)} sounds, tour {cursor:.1f} s, {time.time() - t_all:.1f}s -> {aio.rel(out)} and {aio.rel(ts)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
