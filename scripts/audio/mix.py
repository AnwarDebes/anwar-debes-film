"""mix.py - renders the film's audio from a cue sheet: stems, deterministic ducking, master.

  python scripts/audio/mix.py audio/cues/demo.json                 stems + master + report
  python scripts/audio/mix.py audio/cues/film.json --out public/audio/film
  python scripts/audio/mix.py audio/cues/demo.json --no-master     stems and report only (fast)

Pipeline (every stage is a pure function of the cue sheet and the source files):
  voice   decode, mono, high-pass, normalise to the voice target (-16 LUFS integrated)
  words   -> phrases -> music automation (duck_env.music_curve): -10 dB under speech, partial
          swells in short gaps, lifts in long holds; the voice-activity depth drives an EQ pocket
          on the music (-2.5 dB at 2.5 kHz, only while the narrator speaks) and the SFX shield
  music   each cue: slice of a track, level-matched (LU relative to the voice target), fades or
          equal-power crossfades, automation points; summed, pocketed, ducked
  sfx     each cue: a sfx_synth recipe (key-aware: degree notes follow the music under them),
          level-matched by its maximum momentary loudness, aligned start|end|peak to its frame,
          transitions shielded (-4 dB, 150 Hz-8 kHz) while the narrator speaks; one shared hall
  master  premix -> 25 Hz high-pass -> static gain to the target -> true-peak limiter; repeated
          until integrated loudness is within 0.1 LU, then checked by ffmpeg's ebur128 and again
          after an AAC 320k encode (the delivery format)
Writes <out>/voice, music, sfx (premix level) and master (24-bit) as FLAC (default: lossless, a
third of the WAV's bytes; the sheet's files.format = "wav" writes WAV, files.stemBits sets the
stems' word length, 16 by default for FLAC, 24 for WAV),
mix.json (the report: every cue as placed and measured, stem and master loudness, warnings) and
meters.json (per video frame: momentary loudness of every stem, music gain, voice activity).
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import inspect
import json
import os
import platform
import sys
import time

import numpy as np
import scipy
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
import audio_io as aio  # noqa: E402
import duck_env  # noqa: E402
import limiter  # noqa: E402
import loudness  # noqa: E402
import sfx_synth as S  # noqa: E402

SR = aio.SR
VERSION = 1


class Ctx:
    def __init__(self):
        self.warnings: list[str] = []
        self.timing: dict[str, float] = {}

    def warn(self, msg: str):
        self.warnings.append(msg)
        print(f"  warning: {msg}")


# ---------- time and helpers ----------
def cue_time(c: dict, fps: float, key="at", frame_key="frame") -> float | None:
    if c.get(frame_key) is not None:
        return float(c[frame_key]) / fps
    if c.get(key) is not None:
        return float(c[key])
    return None


def r3(x):
    return None if x is None else round(float(x), 3)


def biquad_peak(f0: float, q: float, gain_db: float):
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f0 / SR
    alpha = np.sin(w) / (2 * q)
    b = [1 + alpha * A, -2 * np.cos(w), 1 - alpha * A]
    a = [1 + alpha / A, -2 * np.cos(w), 1 - alpha / A]
    return signal.tf2sos(np.array(b) / a[0], np.array(a) / a[0])


def ramp(u: np.ndarray, curve: str) -> np.ndarray:
    """Fade-in shape on u in 0..1 (fade-out uses ramp(1 - u))."""
    u = np.clip(u, 0, 1)
    if curve == "lin":
        return u
    if curve == "hsin":
        return 0.5 - 0.5 * np.cos(np.pi * u)
    if curve == "log":
        return np.where(u > 0, 10 ** (-60 * (1 - u) / 20), 0.0) * (u > 0)
    return np.sin(0.5 * np.pi * u)  # qsin: equal power


def smooth_points(t: np.ndarray, pts) -> np.ndarray:
    """dB automation through points [[t, db], ...] with raised-cosine segments; flat outside."""
    pts = sorted((float(a), float(b)) for a, b in pts)
    out = np.full(len(t), pts[0][1])
    for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
        m = (t >= t0) & (t < t1)
        if t1 > t0:
            u = (t[m] - t0) / (t1 - t0)
            out[m] = v0 + (v1 - v0) * (0.5 - 0.5 * np.cos(np.pi * u))
    out[t >= pts[-1][0]] = pts[-1][1]
    return out


# ---------- words ----------
def words_from(obj) -> list[tuple[float, float]]:
    """[[s, e]] or [{start, end}] or a NarrationTimeline / timeline.json / reel.json object."""
    if isinstance(obj, dict):
        if "utterances" in obj:
            return [(w["start"], w["end"]) for u in obj["utterances"] for w in u["words"]]
        if "utts" in obj:
            return [(w[1], w[2]) for u in obj["utts"] for w in u["words"]]
        if "words" in obj:
            return words_from(obj["words"])
        raise ValueError("unrecognised word-timing object")
    out = []
    for w in obj:
        if isinstance(w, dict):
            out.append((float(w["start"]), float(w["end"])))
        elif len(w) >= 3 and isinstance(w[0], str):
            out.append((float(w[1]), float(w[2])))
        else:
            out.append((float(w[0]), float(w[1])))
    return out


def words_from_audio(v: np.ndarray, ctx: Ctx) -> list[tuple[float, float]]:
    """Fallback when no timings are given: speech activity from the voice stem itself (10 ms RMS
    gated 35 dB under the loud speech level), merged across 250 ms."""
    mono = v.mean(axis=1)
    hop = SR // 100
    n = len(mono) // hop
    rms = np.sqrt(np.mean(mono[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    dbv = 20 * np.log10(rms)
    thr = max(np.percentile(dbv, 95) - 35, -60)
    on = dbv > thr
    segs, start = [], None
    for i, o in enumerate(on):
        if o and start is None:
            start = i
        if not o and start is not None:
            if i - start >= 6:
                segs.append([start / 100, i / 100])
            start = None
    if start is not None:
        segs.append([start / 100, n / 100])
    merged = []
    for s, e in segs:
        if merged and s - merged[-1][1] < 0.25:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    ctx.warn(f"no word timings given: {len(merged)} speech segments detected from the voice stem")
    return [(s, e) for s, e in merged]


# ---------- voice ----------
def build_voice(sheet, base, N, ctx):
    vs = sheet.get("voice") or {}
    out = np.zeros((N, 2), np.float32)
    srcs = []
    placements = []
    if vs.get("src"):
        placements.append({"src": vs["src"], "at": vs.get("at", 0.0), "trimStartS": vs.get("trimStartS", 0.0),
                           "durS": vs.get("durS"), "gainDb": 0.0})
    placements += vs.get("clips", [])
    for c in placements:
        p = aio.resolve(c["src"], base)
        x = aio.decode(p)
        a = int(round(float(c.get("trimStartS", 0.0)) * SR))
        x = x[a:]
        if c.get("durS"):
            x = x[: int(round(float(c["durS"]) * SR))]
        if not vs.get("stereo"):
            m = x.mean(axis=1)
            x = np.stack([m, m], 1)
        at = cue_time(c, sheet["fps"]) or 0.0
        s = int(round(at * SR))
        e = min(N, s + len(x))
        if s < N:
            out[s:e] += x[: e - s] * S.db(float(c.get("gainDb", 0.0)))
        srcs.append({"src": aio.rel(p), "at": r3(at), "sha256": aio.sha256_file(p)})
    info = {"sources": srcs}
    if not placements:
        return out, info
    hpf = vs.get("highpassHz", 80)
    if hpf:
        out = signal.sosfilt(S._sos("highpass", float(hpf), 2), out, axis=0).astype(np.float32)
    target = vs.get("targetLufs", sheet.get("voiceTargetLufs", -16.0))
    I = loudness.integrated(out)
    g = 0.0
    if target is not None and np.isfinite(I):
        g = float(target) - I
        out *= S.db(g)
    g += float(vs.get("gainDb", 0.0))
    if vs.get("gainDb"):
        out *= S.db(float(vs["gainDb"]))
    info.update({"measuredLufs": r3(I), "normaliseGainDb": r3(g), "targetLufs": target, "highpassHz": hpf})
    return out, info


# ---------- music ----------
def load_manifest():
    p = os.path.join(aio.ROOT, "audio", "music-manifest.json")
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {"tracks": []}


def _alignment_offset(track_id, manifest):
    """(reference id, seconds): file time in this track = file time in the reference + seconds."""
    for t in manifest["tracks"]:
        if t["id"] == track_id:
            al = t.get("alignment")
            return (al["reference"], float(al["offsetS"])) if al else (track_id, 0.0)
    return (track_id, 0.0)


def resolve_music(sheet, ctx, manifest):
    """Normalise music cues: times, defaults, crossfades (sets both sides' fades) and in-place
    continuations (`continues`: the offset that keeps the music where the earlier cue would be)."""
    fps = sheet["fps"]
    mus = sheet.get("music") or {}
    cues = []
    for i, c in enumerate(mus.get("cues", [])):
        c = copy.deepcopy(c)
        c.setdefault("id", f"m{i + 1}")
        c["_in"] = cue_time(c, fps, "in", "inFrame") or 0.0
        out = cue_time(c, fps, "out", "outFrame")
        if out is None and c.get("dur") is not None:
            out = c["_in"] + float(c["dur"])
        c["_out"] = out if out is not None else sheet["durationS"]
        c["_fadeIn"] = float(c.get("fadeIn", 0.0))
        c["_fadeOut"] = float(c.get("fadeOut", 0.0))
        c["_fadeInCurve"] = c.get("fadeInCurve", "qsin")
        c["_fadeOutCurve"] = c.get("fadeOutCurve", "qsin")
        cues.append(c)
    cues.sort(key=lambda c: c["_in"])
    by_id = {c["id"]: c for c in cues}
    for c in cues:
        ref = c.get("continues")
        if not ref:
            continue
        p = by_id.get(ref)
        if p is None or p["_in"] > c["_in"]:
            raise SystemExit(f"music cue {c['id']}: continues '{ref}', which is not an earlier cue")
        rp, op = _alignment_offset(p["track"], manifest)
        rc_, oc = _alignment_offset(c["track"], manifest)
        if rp != rc_ and p["track"] != c["track"]:
            ctx.warn(f"music cue {c['id']}: {c['track']} and {p['track']} have no measured alignment (analyze_music.py --align); "
                     "continuing at the same file time")
            op = oc = 0.0
        c["offset"] = round(float(p.get("offset", 0.0)) + (c["_in"] - p["_in"]) - op + oc, 6)
        c["_gainFrom"] = ref
    for prev, c in zip(cues, cues[1:]):
        d = c.get("crossfade")
        if d:
            d = float(d)
            curve = c.get("crossfadeCurve", "qsin")
            prev["_out"] = c["_in"] + d
            prev["_fadeOut"], prev["_fadeOutCurve"] = d, curve
            c["_fadeIn"], c["_fadeInCurve"] = d, curve
    return cues


def track_info(c, manifest):
    if c.get("src"):
        return {"id": c.get("track", os.path.basename(c["src"])), "file": c["src"], "title": c.get("title", c["src"])}
    for t in manifest["tracks"]:
        if t["id"] == c["track"]:
            return t
    raise SystemExit(f"music cue {c['id']}: track '{c.get('track')}' is not in audio/music-manifest.json")


def track_key(c, tinfo, sheet):
    if c.get("key"):
        return c["key"]
    if tinfo.get("key"):
        return tinfo["key"]
    an = tinfo.get("analysis")
    if an:
        off = float(c.get("offset", 0.0))
        for seg in an.get("segments", []):
            if seg["fromS"] <= off < seg["toS"]:
                return seg["key"]
        return an.get("key")
    return sheet.get("key", "D major")


def build_music(sheet, base, N, cues, ctx, manifest):
    bed = np.zeros((N, 2), np.float32)
    vt = float(sheet.get("voiceTargetLufs", -16.0))
    default_level = (sheet.get("music") or {}).get("level", -5.0)
    out = []
    gains: dict[str, float] = {}
    for c in cues:
        ti = track_info(c, manifest)
        path = aio.resolve(c["src"], base) if c.get("src") else os.path.join(aio.ROOT, "public", "audio", "music", ti["file"])
        if not os.path.exists(path):
            raise SystemExit(f"music cue {c['id']}: {aio.rel(path)} is missing (node scripts/audio/fetch-music.mjs)")
        x = aio.decode(path)
        off = int(round(float(c.get("offset", 0.0)) * SR))
        s, e = int(round(c["_in"] * SR)), int(round(c["_out"] * SR))
        n = e - s
        seg = x[off:off + n]
        if len(seg) < n:
            ctx.warn(f"music cue {c['id']}: the track ends {(n - len(seg)) / SR:.2f} s before the cue's out point")
            seg = S.fit(seg, n)
        seg = seg.astype(np.float32)
        I = loudness.integrated(seg)
        inherit = c.get("_gainFrom") in gains and "level" not in c and c.get("gainDb") is None
        if inherit:
            # an in-place continuation keeps the earlier cue's gain, so shared samples do not step
            level = None
            g = gains[c["_gainFrom"]]
        else:
            level = c.get("level", default_level if c.get("gainDb") is None else None)
            g = 0.0
            if level is not None and np.isfinite(I):
                g = vt + float(level) - I
            g += float(c.get("gainDb", 0.0) or 0.0)
        gains[c["id"]] = g
        tt = np.arange(n) / SR
        env = np.ones(n)
        if c["_fadeIn"] > 0:
            env *= ramp(tt / c["_fadeIn"], c["_fadeInCurve"])
        if c["_fadeOut"] > 0:
            env *= ramp((n / SR - tt) / c["_fadeOut"], c["_fadeOutCurve"])
        if c.get("automation"):
            env *= S.db(smooth_points(c["_in"] + tt, c["automation"]))
        seg *= (env * S.db(g))[:, None].astype(np.float32)
        a, b = max(0, s), min(N, e)
        if b > a:
            bed[a:b] += seg[a - s:b - s]
        key = track_key(c, ti, sheet)
        out.append({"id": c["id"], "track": ti["id"], "title": ti.get("title"), "attribution": ti.get("attribution"),
                    "in": r3(c["_in"]), "out": r3(c["_out"]), "offset": round(float(c.get("offset", 0.0)), 6),
                    "fadeIn": r3(c["_fadeIn"]), "fadeOut": r3(c["_fadeOut"]),
                    "fadeInCurve": c["_fadeInCurve"], "fadeOutCurve": c["_fadeOutCurve"],
                    "sliceLufs": r3(I), "level": level, "gainDb": r3(g), "key": key,
                    **({"continues": c["continues"], "gainFrom": c["_gainFrom"] if inherit else None} if c.get("continues") else {}),
                    "sha256": ti.get("sha256")})
    return bed, out


def key_at(t, music_info, sheet):
    """Key of the music under film time t: the most recent cue whose span contains t."""
    k = None
    for c in music_info:
        if c["in"] <= t < c["out"]:
            k = c["key"]
    return k or sheet.get("key", "D major")


# ---------- sfx ----------
def _accepts(fn):
    sig = inspect.signature(fn)
    names = set(sig.parameters)
    var_kw = any(p.kind == p.VAR_KEYWORD for p in sig.parameters.values())
    return names, var_kw


def render_recipe(kind, params, ctx):
    """Render (cached on disk by recipe, arguments and the synth source; entries made by an older
    synth are pruned on the first write of a run, so the cache never outgrows one edit)."""
    global _PRUNED
    fn = S.RECIPES[kind]
    names, var_kw = _accepts(fn)
    unknown = [k for k in params if k not in names]
    if unknown and not var_kw:
        ctx.warn(f"{kind}: ignoring unknown params {unknown}")
    args = {k: v for k, v in params.items() if k in names or var_kw}
    src_hash = _synth_hash()
    key = hashlib.sha1(json.dumps([kind, args, src_hash], sort_keys=True, default=str).encode()).hexdigest()[:24]
    cdir = os.path.join(aio.CACHE, "sfx")
    cp = os.path.join(cdir, f"{src_hash}.{kind}.{key}.npy")
    if os.path.exists(cp):
        return np.load(cp), args
    x = fn(**args).astype(np.float32)
    os.makedirs(cdir, exist_ok=True)
    if not _PRUNED:
        _PRUNED = True
        for f in os.listdir(cdir):
            if f.endswith(".npy") and not f.startswith(f"{src_hash}."):
                os.remove(os.path.join(cdir, f))
    np.save(cp, x)
    return x, args


_SYN_HASH = None
_PRUNED = False


def _synth_hash():
    global _SYN_HASH
    if _SYN_HASH is None:
        _SYN_HASH = aio.sha256_file(S.__file__)[:16]
    return _SYN_HASH


def _peak_index(x, kind, args):
    if "peak_at" in args or kind in S.PEAK_DEFAULT:
        return int(float(args.get("peak_at", S.PEAK_DEFAULT.get(kind, 0.6))) * len(x))
    hop = SR // 200
    m = np.abs(x).max(axis=1)
    n = len(m) // hop
    if n == 0:
        return 0
    env = m[: n * hop].reshape(n, hop).max(axis=1)
    return int(np.argmax(env) * hop)


def _loudest(x):
    """Sample index of the event's loudest 10 ms."""
    hop = SR // 100
    n = len(x) // hop
    if n == 0:
        return 0
    rms = np.mean(x[: n * hop].reshape(n, hop, -1) ** 2, axis=(1, 2))
    return int(np.argmax(rms) * hop + hop // 2)


def build_sfx(sheet, N, depth, voice_s, music_info, ctx):
    fps = sheet["fps"]
    sx = sheet.get("sfx") or {}
    vt = float(sheet.get("voiceTargetLufs", -16.0))
    dry = np.zeros((N, 2), np.float32)
    send = np.zeros((N, 2), np.float32)
    shield_db = float(sx.get("shieldDb", -4.0))
    shield_sos = signal.butter(2, [150, 8000], "bandpass", fs=SR, output="sos")
    placed = []
    for i, c in enumerate(sx.get("cues", [])):
        kind = c["type"]
        if kind not in S.RECIPES:
            raise SystemExit(f"sfx cue {c.get('id', i)}: unknown type '{kind}' (one of {', '.join(S.RECIPES)})")
        anchor = cue_time(c, fps)
        if anchor is None:
            raise SystemExit(f"sfx cue {c.get('id', i)}: needs 'frame' or 'at'")
        dflt = S.DEFAULTS.get(kind, {})
        params = dict(c.get("params") or {})
        names, var_kw = _accepts(S.RECIPES[kind])
        key = None
        if "key" in names and "key" not in params:
            key = key_at(anchor, music_info, sheet)
            params["key"] = key
        elif "key" in params:
            key = params["key"]
        if "seed" in names and "seed" not in params:
            params["seed"] = c.get("seed", f"{kind}@{round(anchor * fps)}")
        x, args = render_recipe(kind, params, ctx)
        x = x.copy()
        ev = loudness.event_level(x)
        level = c.get("level", dflt.get("level") if c.get("gainDb") is None else None)
        g = (vt + float(level) - ev) if level is not None and np.isfinite(ev) else 0.0
        g += float(c.get("gainDb", 0.0) or 0.0)
        x *= S.db(g)
        if c.get("pan"):
            x = S.balance(x, float(c["pan"]))
        align = c.get("align", "start")
        start = anchor
        if align == "end":
            start = anchor - len(x) / SR
        elif align == "peak":
            start = anchor - _peak_index(x, kind, args) / SR
        s = int(round(start * SR))
        if s < 0:
            ctx.warn(f"sfx {c.get('id', kind)} starts {-s / SR:.2f} s before the film: its head is cut")
            x = x[-s:]
            s = 0
        e = min(N, s + len(x))
        x = x[: e - s]
        shield = c.get("shield", dflt.get("shield", False))
        d = depth[s:e]
        # is the narrator speaking under the event's loud body (within 10 dB of its peak)?
        pk = _loudest(x)
        lo, hi = max(0, pk - SR // 10), min(len(x), pk + int(0.3 * SR))
        speaking = float(d[lo:hi].max()) if hi > lo else 0.0
        if shield and speaking > 0:
            bl = signal.sosfilt(shield_sos, x, axis=0)
            w = d[:, None]
            x = (x * (1 - w) + bl * w * S.db(shield_db)).astype(np.float32)
        dry[s:e] += x
        sv = float(c.get("send", dflt.get("send", 0.0)))
        if sv > 0:
            send[s:e] += x * sv
        # measured placement: the event against the voice's short-term (3 s) loudness at its peak
        lev = loudness.event_level(x) if len(x) else float("-inf")
        fpk = min(len(voice_s) - 1, (s + pk) // 800)
        vmax = float(voice_s[fpk]) if len(voice_s) else float("-inf")
        rel = lev - vmax if speaking > 0.5 and np.isfinite(vmax) and vmax > -60 else None
        cat = S.CATEGORY.get(kind, "other")
        item = {"id": c.get("id", f"{kind}{i + 1}"), "type": kind, "category": cat, "align": align,
                "anchorS": r3(anchor), "frame": round(anchor * fps), "startS": r3(s / SR), "endS": r3(e / SR),
                "level": level, "gainDb": r3(g), "eventLufs": r3(lev), "key": key,
                "speaking": round(speaking, 2), "voiceLufs": r3(vmax) if rel is not None else None,
                "relToVoiceLU": r3(rel), "send": sv, "shield": bool(shield),
                "params": {k: v for k, v in args.items() if k not in ("hist", "events")}}
        if "hist" in args:
            item["params"]["hist"] = f"{len(args['hist'].get('n', []))} bins of {args['hist'].get('binS', 0.005)} s"
            item["pins"] = int(round(sum(args["hist"].get("n", []))))
        if "events" in args:
            item["params"]["events"] = f"{len(args['events'])} pins"
            item["pins"] = len(args["events"])
        if speaking > 0.5 and rel is not None:
            if cat == "transition" and rel > -8:
                ctx.warn(f"{item['id']} ({kind}) at {anchor:.2f} s is only {-rel:.1f} LU under the voice (keep >= 8)")
            if cat == "hit":
                ctx.warn(f"{item['id']} ({kind}) at {anchor:.2f} s lands on narration (hits belong in holds)")
            if rel > 0:
                ctx.warn(f"{item['id']} ({kind}) at {anchor:.2f} s is louder than the voice")
        placed.append(item)
    # grammar: never two transition sounds on one cut
    trans = sorted((p for p in placed if p["category"] == "transition"), key=lambda p: p["anchorS"])
    for a, b in zip(trans, trans[1:]):
        if b["anchorS"] - a["anchorS"] < 0.25:
            ctx.warn(f"{a['id']} and {b['id']} stack two transition sounds on one cut ({a['anchorS']:.2f} s)")
    hits = [p for p in placed if p["category"] == "hit"]
    for k in range(len(hits)):
        win = [h for h in hits if 0 <= h["anchorS"] - hits[k]["anchorS"] < 60]
        if len(win) > 3:
            ctx.warn(f"{len(win)} hits within a minute from {hits[k]['anchorS']:.1f} s (at most 3 per chapter)")
            break
    rv = sx.get("reverb") or {}
    if np.abs(send).max() > 0:
        ir = S.hall_ir(dur=float(rv.get("durS", 2.8)), rt60=float(rv.get("rt60", 2.3)),
                       predelay=float(rv.get("predelayS", 0.018)), seed=int(rv.get("seed", 0)))
        wet = S.convolve_ir(send, ir)[:N] * 0.5 * S.db(float(rv.get("returnDb", 0.0)))
        dry += wet.astype(np.float32)
    dry = signal.sosfilt(S._sos("highpass", 30.0, 2), dry, axis=0).astype(np.float32)
    return dry, placed


# ---------- balance ----------
def measure_balance(voice_s, music, depth, gain_db, sheet, kw):
    """How the music actually sits against the narration (audio.md 5.1 compares centred 3 s
    short-term loudness): under speech, and in the long holds where the bed swells."""
    bp = loudness.block_power(music)
    st = loudness.short_term(music, bp)
    mus_s = np.concatenate([st[90:], np.full(min(90, len(st)), st[-1] if len(st) else -90.0)])
    n = min(len(mus_s), len(voice_s))
    centre = (np.arange(n) * 800 + 400).clip(0, len(depth) - 1)
    d = depth[centre]
    g = gain_db[centre]
    swell = float(kw.get("swell_db") if kw.get("swell_db") is not None else duck_env.DEFAULTS["swell_db"])
    vt = float(sheet.get("voiceTargetLufs", -16.0))
    speaking = (d >= 0.999) & (voice_s[:n] > -50) & (mus_s[:n] > -60)
    holds = (d <= 0.001) & (g >= swell - 0.05) & (mus_s[:n] > -60)
    out = {"method": "centred 3 s short-term loudness per 800-sample block"}
    if speaking.any():
        rel = voice_s[:n][speaking] - mus_s[:n][speaking]
        out["musicUnderVoiceLU"] = {"median": r3(np.median(rel)), "p10": r3(np.percentile(rel, 10)),
                                    "p90": r3(np.percentile(rel, 90)), "seconds": r3(speaking.sum() * 800 / SR),
                                    "target": [12, 15]}
    if holds.any():
        rel = mus_s[:n][holds] - vt
        out["musicInHoldsLU"] = {"median": r3(np.median(rel)), "p90": r3(np.percentile(rel, 90)),
                                 "seconds": r3(holds.sum() * 800 / SR), "target": [-2, 0]}
    return out


# ---------- master ----------
def file_spec(sheet):
    fs = sheet.get("files") or {}
    fmt = fs.get("format", "flac")
    if fmt not in ("flac", "wav"):
        raise SystemExit(f"files.format must be 'flac' or 'wav', not {fmt!r}")
    return "." + fmt, int(fs.get("stemBits", 16 if fmt == "flac" else 24))


def master(premix, sheet, out_dir, ctx):
    ms = sheet.get("master") or {}
    target = float(ms.get("lufs", -15.0))
    tp_max = float(ms.get("truePeakMaxDb", -1.5))
    ceiling = float(ms.get("ceilingDb", -2.0))
    hpf = ms.get("highpassHz", 25)
    x = premix
    if hpf:
        x = signal.sosfilt(S._sos("highpass", float(hpf), 2), x, axis=0).astype(np.float32)
    I0 = loudness.integrated(x)
    gain = target - I0
    lim_info = None
    y = x
    for attempt in range(3):
        for _ in range(4):
            y, lim_info = limiter.limit(x * S.db(gain), ceiling_db=ceiling)
            I = loudness.integrated(y)
            if abs(I - target) <= 0.1:
                break
            gain += target - I
        path = os.path.join(out_dir, "master" + file_spec(sheet)[0])
        aio.write_audio(path, y, bits=24, seed=7)
        ff = aio.ff_ebur128(path)
        aac = aio.encode_aac_check(path) if ms.get("aacCheck", True) else None
        worst = max([v for v in [ff.get("TP"), aac and aac.get("TP")] if v is not None], default=-99)
        if worst <= tp_max:
            break
        ceiling -= (worst - tp_max) + 0.1
        ctx.warn(f"true peak {worst:.2f} dBTP after encode; lowering the limiter ceiling to {ceiling:.2f} dBTP")
    st = loudness.stats(y)
    ok = abs(st["I"] - target) <= 0.5 and (ff.get("TP") is None or ff["TP"] <= tp_max) and (
        aac is None or aac.get("TP") is None or aac["TP"] <= tp_max)
    return y, {"target": {"lufs": target, "truePeakMaxDb": tp_max}, "premixLufs": r3(I0), "gainDb": r3(gain),
               "limiter": lim_info, "stats": st, "ffmpeg": ff, "aac": aac, "pass": bool(ok)}


# ---------- main ----------
def mix(sheet_path: str, out_dir: str | None = None, do_master: bool = True) -> dict:
    ctx = Ctx()
    t_all = time.time()
    sheet_path = os.path.abspath(sheet_path)
    base = os.path.dirname(sheet_path)
    sheet = json.load(open(sheet_path, encoding="utf-8"))
    if sheet.get("version", 1) != VERSION:
        raise SystemExit(f"cue sheet version {sheet.get('version')} is not supported (expected {VERSION})")
    fps = float(sheet.setdefault("fps", 60))
    if sheet.get("durationS") is None:
        sheet["durationS"] = float(sheet["durationInFrames"]) / fps
    dur = float(sheet["durationS"])
    N = int(round(dur * SR))
    out_dir = os.path.abspath(out_dir or aio.resolve(sheet.get("out", f"public/audio/{sheet.get('name', 'mix')}"), aio.ROOT))
    os.makedirs(out_dir, exist_ok=True)
    print(f"mix {sheet.get('name', os.path.basename(sheet_path))}: {dur:.2f} s at {fps:g} fps -> {aio.rel(out_dir)}")

    t = time.time()
    voice, vinfo = build_voice(sheet, base, N, ctx)
    vs = sheet.get("voice") or {}
    if vs.get("words") is not None:
        words = words_from(vs["words"])
    elif vs.get("wordsFrom"):
        words = words_from(json.load(open(aio.resolve(vs["wordsFrom"], base), encoding="utf-8")))
    elif vinfo["sources"]:
        words = words_from_audio(voice, ctx)
    else:
        words = []
    off = float(vs.get("wordsOffsetS", 0.0))
    words = [(s + off, e + off) for s, e in words]
    ctx.timing["voice"] = round(time.time() - t, 2)

    t = time.time()
    dk = sheet.get("duck") or {}
    kw = {"depth_db": dk.get("depthDb"), "merge_gap": dk.get("mergeGapS"), "pre": dk.get("preS"),
          "attack": dk.get("attackS"), "hold": dk.get("holdS"), "release": dk.get("releaseS"),
          "full_gap": dk.get("fullSwellGapS"), "swell_db": dk.get("swellDb"), "swell_min_gap": dk.get("swellMinGapS"),
          "swell_rise": dk.get("swellRiseS"), "swell_fall": dk.get("swellFallS")}
    if words:
        gain_db, depth, ph = duck_env.music_curve(words, dur, rate=SR, **kw)
    else:
        gain_db, depth, ph = np.zeros(N), np.zeros(N), []
    gain_db, depth = S.fit(gain_db, N), S.fit(depth, N)
    manifest = load_manifest()
    mcues = resolve_music(sheet, ctx, manifest)
    bed, minfo = build_music(sheet, base, N, mcues, ctx, manifest)
    pk = dk.get("pocket", {"freqHz": 2500, "q": 1.0, "gainDb": -2.5})
    if pk and pk.get("gainDb"):
        eq = signal.sosfilt(biquad_peak(float(pk["freqHz"]), float(pk.get("q", 1.0)), float(pk["gainDb"])), bed, axis=0)
        bed = (bed + depth[:, None] * (eq - bed)).astype(np.float32)
    music = (bed * S.db(gain_db)[:, None]).astype(np.float32)
    ctx.timing["music"] = round(time.time() - t, 2)

    t = time.time()
    vbp = loudness.block_power(voice)
    # centred 3 s short-term loudness of the voice, one value per 800-sample block
    st = loudness.short_term(voice, vbp)
    voice_s = np.concatenate([st[90:], np.full(min(90, len(st)), st[-1] if len(st) else -90.0)])
    sfx, sinfo = build_sfx(sheet, N, depth, voice_s, minfo, ctx)
    ctx.timing["sfx"] = round(time.time() - t, 2)

    balance = measure_balance(voice_s, music, depth, gain_db, sheet, kw)

    premix = voice + music + sfx
    if np.abs(premix).max() >= 1.0:
        ctx.warn(f"premix peaks at {loudness.sample_peak(premix):.2f} dBFS: stems are written as floats would clip; check levels")

    t = time.time()
    files = {}
    ext, stem_bits = file_spec(sheet)
    for name in ("voice", "music", "sfx", "master"):
        for other in (".wav", ".flac"):
            stale = os.path.join(out_dir, name + other)
            if other != ext and os.path.exists(stale):
                os.remove(stale)
    for name, x in (("voice", voice), ("music", music), ("sfx", sfx)):
        p = os.path.join(out_dir, name + ext)
        aio.write_audio(p, x, bits=stem_bits, seed={"voice": 1, "music": 2, "sfx": 3}[name])
        files[name] = p
    stems = {"voice": loudness.stats(voice, tp=False), "music": loudness.stats(music, tp=False),
             "sfx": loudness.stats(sfx, tp=False), "premix": loudness.stats(premix)}
    ctx.timing["stems"] = round(time.time() - t, 2)

    minfo_master = None
    t = time.time()
    if do_master:
        y, minfo_master = master(premix, sheet, out_dir, ctx)
        files["master"] = os.path.join(out_dir, "master" + ext)
    else:
        y = premix
    ctx.timing["master"] = round(time.time() - t, 2)

    # meters, one value per video frame (800 samples at 60 fps)
    t = time.time()
    hop = int(round(SR / fps))
    mm = {}
    for name, x in (("voice", voice), ("music", music), ("sfx", sfx), ("master", y)):
        mm[name] = np.round(np.maximum(loudness.momentary(x, loudness.block_power(x, hop), hop), -90), 1).tolist()
    nfr = int(round(dur * fps))
    fr = (np.arange(nfr) * hop + hop // 2).clip(0, N - 1)
    meters = {"fps": fps, "frames": nfr, "momentaryLufs": mm,
              "musicGainDb": np.round(gain_db[fr], 2).tolist(), "voiceActivity": np.round(depth[fr], 3).tolist()}
    pub = os.path.join(aio.ROOT, "public")
    rel_pub = lambda p: os.path.relpath(p, pub).replace("\\", "/")  # noqa: E731
    report = {
        "version": VERSION, "name": sheet.get("name"), "cueSheet": aio.rel(sheet_path),
        "cueSheetSha256": aio.sha256_file(sheet_path), "fps": fps, "durationS": dur, "sampleRate": SR,
        "renderedWith": {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__,
                         "synth": _synth_hash()},
        "files": {k: rel_pub(v) for k, v in files.items()},
        "voice": {**vinfo, "words": len(words), "phrases": [[r3(a), r3(b)] for a, b in ph]},
        "duck": {"params": {**duck_env.DEFAULTS, **{k: v for k, v in kw.items() if v is not None}}, "pocket": pk},
        "music": minfo,
        "sfx": sinfo,
        "balance": balance,
        "stems": stems,
        "master": minfo_master,
        "warnings": ctx.warnings,
    }
    aio.save_json(os.path.join(out_dir, "meters.json"), meters)
    ctx.timing["meters"] = round(time.time() - t, 2)
    ctx.timing["total"] = round(time.time() - t_all, 2)
    report["timing"] = ctx.timing
    aio.save_json(os.path.join(out_dir, "mix.json"), report)
    # summary
    print(f"  voice  {stems['voice']['I']:7.2f} LUFS   music {stems['music']['I']:7.2f}   sfx {stems['sfx']['I']:7.2f}   premix {stems['premix']['I']:7.2f}")
    if minfo_master:
        m = minfo_master
        aac = m["aac"] or {}
        print(f"  master {m['stats']['I']:7.2f} LUFS  LRA {m['stats']['LRA']:.1f}  TP {m['stats']['TP']:.2f} dBTP"
              f"  | ffmpeg I {m['ffmpeg']['I']} TP {m['ffmpeg']['TP']}  | AAC 320k TP {aac.get('TP')}"
              f"  | limiter max GR {m['limiter']['maxGainReductionDb']} dB  {'PASS' if m['pass'] else 'FAIL'}")
    uv, ih = balance.get("musicUnderVoiceLU"), balance.get("musicInHoldsLU")
    if uv or ih:
        print("  music " + (f"{uv['median']:.1f} LU under the voice while it speaks (target 12-15)" if uv else "")
              + ("; " if uv and ih else "") + (f"{ih['median']:+.1f} LU against the voice target in holds (target -2..0)" if ih else ""))
    print(f"  {len(sinfo)} sfx cues, {len(minfo)} music cues, {len(ph)} phrases, {len(ctx.warnings)} warnings, {ctx.timing['total']:.1f} s")
    return report


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("cuesheet")
    ap.add_argument("--out", default=None, help="output folder (default: the sheet's 'out')")
    ap.add_argument("--no-master", action="store_true", help="skip mastering (stems and report only)")
    a = ap.parse_args(argv)
    rep = mix(a.cuesheet, a.out, not a.no_master)
    return 0 if (rep["master"] is None or rep["master"]["pass"]) else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
