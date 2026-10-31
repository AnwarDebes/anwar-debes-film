"""Trim, align and index every narration take: writes voice/manifest.json for the timeline.

Run with the aligner venv ($FILM_TOOLS/tts/align, FILM_TOOLS defaults to ~/film-tools):
    python scripts/voice/assemble.py
Reads voice/lines.json (from prepare_lines.mjs) and voice/takes/<key>.wav. For each line:
  - finds the speech inside the take (trimStartS, durationS), keeping a short natural lead and tail;
  - aligns the spoken text to the trimmed audio with Qwen3-ForcedAligner-0.6B (cached per key);
  - maps the aligner's tokens back to the caption words by character position, so respellings
    ("Tset-lin" for "Tsetlin", "G P T two" for "GPT-2") time the words the viewer reads.
Also writes voice/qa.json: lines whose pace or alignment looks wrong (candidates for a re-roll).
"""
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VOICE = os.path.join(ROOT, "voice")
TAKES = os.path.join(VOICE, "takes")
CACHE = os.path.join(VOICE, "build", "words")
TMP = os.path.join(VOICE, "build", "tmp")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(TMP, exist_ok=True)

LEAD_S, TAIL_S = 0.06, 0.14


def speech_bounds(audio, sr):
    """First and last 10 ms frame within 40 dB of the take's loud frames (and above -55 dBFS)."""
    hop = int(sr * 0.01)
    n = len(audio) // hop
    if n == 0:
        return 0.0, len(audio) / sr
    frames = audio[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    ref = np.percentile(db, 95)
    on = np.where(db > max(ref - 40.0, -55.0))[0]
    if len(on) == 0:
        return 0.0, len(audio) / sr
    start = max(0.0, on[0] * 0.01 - LEAD_S)
    end = min(len(audio) / sr, (on[-1] + 1) * 0.01 + TAIL_S)
    return start, end


def letters(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def map_tokens(spoken_tokens, aligned):
    """Times for each spoken token from aligner items, matched by character offsets."""
    # character ranges of the spoken tokens
    ranges, pos = [], 0
    for tok in spoken_tokens:
        k = len(letters(tok))
        ranges.append((pos, pos + k))
        pos += k
    # character ranges of the aligner items, matched greedily against the same letter stream
    stream = "".join(letters(t) for t in spoken_tokens)
    items, cur = [], 0
    for it in aligned:
        k = letters(it["text"])
        if not k:
            continue
        j = stream.find(k, cur)
        if j < 0 or j - cur > 12:
            j = cur  # unmatched spelling: assume it continues where we are
        items.append((j, j + len(k), it["start"], it["end"]))
        cur = j + len(k)
    out = []
    for a, b in ranges:
        hits = [(s, e) for (x, y, s, e) in items if x < b and y > a]
        out.append((min(h[0] for h in hits), max(h[1] for h in hits)) if hits else None)
    # fill gaps from neighbours so every token has a time
    for i, v in enumerate(out):
        if v is None:
            prev = next((out[k] for k in range(i - 1, -1, -1) if out[k]), None)
            nxt = next((out[k] for k in range(i + 1, len(out)) if out[k]), None)
            t0 = prev[1] if prev else (nxt[0] if nxt else 0.0)
            t1 = nxt[0] if nxt else t0 + 0.2
            out[i] = (t0, max(t0, t1))
    return out


def main():
    lines = json.load(open(os.path.join(VOICE, "lines.json"), encoding="utf-8"))
    todo = []
    for ln in lines:
        take = os.path.join(TAKES, f"{ln['key']}.wav")
        if os.path.exists(take) and not os.path.exists(os.path.join(CACHE, f"{ln['key']}.json")):
            todo.append(ln)
    if todo:
        import torch
        from qwen_asr import Qwen3ForcedAligner

        torch.set_num_threads(2)
        aligner = Qwen3ForcedAligner.from_pretrained("Qwen/Qwen3-ForcedAligner-0.6B", dtype=torch.float32, device_map="cpu")
        for ln in todo:
            take = os.path.join(TAKES, f"{ln['key']}.wav")
            audio, sr = sf.read(take, dtype="float32", always_2d=True)
            audio = audio.mean(axis=1)
            s0, s1 = speech_bounds(audio, sr)
            seg = audio[int(s0 * sr): int(s1 * sr)]
            tmp = os.path.join(TMP, f"{ln['key']}.wav")
            sf.write(tmp, seg, sr)
            items = aligner.align(audio=tmp, text=ln["spoken"], language="English")[0]
            os.remove(tmp)
            aligned = [{"text": w.text, "start": float(w.start_time), "end": float(w.end_time)} for w in items]
            json.dump({"trimStartS": round(s0, 4), "durationS": round(s1 - s0, 4), "sr": sr, "aligned": aligned},
                      open(os.path.join(CACHE, f"{ln['key']}.json"), "w", encoding="utf-8"))
            print(f"aligned {ln['id']} ({len(aligned)} tokens, {s1 - s0:.2f} s)", flush=True)

    clips, qa = {}, []
    for ln in lines:
        cache = os.path.join(CACHE, f"{ln['key']}.json")
        if not os.path.exists(cache):
            continue
        c = json.load(open(cache, encoding="utf-8"))
        tokens = ln["spoken"].split()
        times = map_tokens(tokens, c["aligned"])
        words = []
        for text, (a, b) in zip(ln["caption"], ln["spans"]):
            seg = times[a:b]
            if not seg:
                seg = [(words[-1]["end"], words[-1]["end"])] if words else [(0.0, 0.05)]
            words.append({"text": text, "start": round(seg[0][0], 3), "end": round(max(seg[-1][1], seg[0][0] + 0.04), 3)})
        dur = c["durationS"]
        clips[ln["id"]] = {
            "file": f"voice/takes/{ln['key']}.wav",
            "trimStartS": c["trimStartS"],
            "durationS": dur,
            "words": words,
        }
        rate = len(ln["caption"]) / max(dur, 0.1)
        matched = sum(1 for it in c["aligned"] if letters(it["text"]))
        if rate < 1.4 or rate > 3.9 or matched < 0.6 * len(tokens):
            qa.append({"id": ln["id"], "key": ln["key"], "wordsPerS": round(rate, 2), "aligned": matched, "tokens": len(tokens)})
    json.dump({"sampleRate": 44100, "clips": clips}, open(os.path.join(VOICE, "manifest.json"), "w", encoding="utf-8"), indent=1)
    json.dump(qa, open(os.path.join(VOICE, "qa.json"), "w", encoding="utf-8"), indent=1)
    print(f"manifest: {len(clips)}/{len(lines)} lines; {len(qa)} flagged for review")


if __name__ == "__main__":
    sys.exit(main())
