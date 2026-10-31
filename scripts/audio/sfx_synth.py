"""sfx_synth.py - deterministic procedural sound design for the film (numpy + scipy only).

Every recipe returns float32 stereo (N, 2) at 48 kHz with its peak at or below 0 dBFS.
The same arguments and seed give bit-identical output, so a re-render never drifts from the edit.
Seeds may be integers or strings (strings are hashed with SHA-1, never with Python's salted hash()).

The palette (tuned to the film):
  pin_tick       one soft steel pin: free-free bar modes, contact click, plate knock
  pin_brush      a sweep of pins: grains placed from the pin wall's own release data, plus friction wash
  note           tonal event note on a visual beat (D-major palette by default, ~1.1 s to -10 dB)
  chime          success: two or three palette notes, brighter and shorter than an event note
  error_buzz     polite "denied": two soft low pulses a semitone apart
  blip           UI chip: a short tonal pluck on a palette note
  stamp          a verdict stamp landing: felt thump, rubber contact, a small room
  tick           counter / clock tick (seed per tick)
  typing         keystrokes for code on screen, from explicit key times or a rate
  whoosh, swish  air moves for transitions and cards (peak-aligned)
  riser          into chapter cards; the tone climbs to the key's fifth and ends on the cut's sample
  reverse_swell  reversed bloom (optionally a reversed palette note) that stops on the cut
  sub_hit        sub drop tuned to the key (D1), saturated so laptops can hear it
  impact         chapter card hit: sub + thump + tuned steel + a slam of pins + hall
Kept from the original recipe set: sub_drop, glitch, paper, heartbeat, camera_shutter, pin_tink,
pin_cascade, wavefront_events, render_stem.

Run `python sfx_synth.py out_dir` to render every recipe once.
"""
from __future__ import annotations

import functools
import hashlib
import json
import re

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
STFT = dict(fs=SR, nperseg=1024, noverlap=768)


# ---------- helpers ----------
def seed_int(seed) -> int:
    """Stable 64-bit seed from an int or a string."""
    if isinstance(seed, (int, np.integer)):
        return int(seed) & 0xFFFFFFFFFFFFFFFF
    return int(hashlib.sha1(str(seed).encode("utf-8")).hexdigest()[:16], 16)


def rng(seed):
    return np.random.default_rng(seed_int(seed))


def tvec(dur):
    return np.arange(int(round(dur * SR))) / SR


def db(x):
    return 10 ** (x / 20)


def stereo(mono, pan=0.0):
    """Equal-power pan. pan is a scalar or per-sample array in [-1, 1]."""
    th = (np.asarray(pan) + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], axis=1).astype(np.float32)


def balance(st, pan):
    """Equal-power balance of a stereo signal; unity at pan 0."""
    if not pan:
        return st
    th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return (st * np.array([np.cos(th), np.sin(th)]) * np.sqrt(2)).astype(np.float32)


def normalize(x, peak_db=-1.0):
    p = np.max(np.abs(x)) + 1e-12
    return (x * db(peak_db) / p).astype(np.float32)


@functools.lru_cache(maxsize=256)
def _sos(kind, fc, order):
    return signal.butter(order, fc, kind, fs=SR, output="sos")


def hp(x, fc, order=2):
    return signal.sosfilt(_sos("highpass", float(fc), order), x, axis=0)


def lp(x, fc, order=2):
    return signal.sosfilt(_sos("lowpass", float(fc), order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", (float(lo), float(hi)), order), x, axis=0)


def pink(n, seed=0):
    """Pink (1/f) noise: whooshes and air sound natural with pink, hissy with white."""
    X = np.fft.rfft(rng(seed).standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    X[1:] /= np.sqrt(f[1:] / 20.0)
    X[0] = 0
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def sweep_bandpass(x, fc_of_t, width_oct=0.8):
    """Time-varying band-pass via STFT masking. fc_of_t(t_frames) -> Hz.
    Gaussian in log-frequency plus a 4th-order low-pass skirt that tracks fc."""
    f, tt, Z = signal.stft(x, **STFT)
    fc = np.clip(fc_of_t(tt), 20, SR / 2.2)[None, :]
    lf = np.log2(np.maximum(f, 20.0))[:, None]
    mask = np.exp(-0.5 * ((lf - np.log2(fc)) / width_oct) ** 2) / (1 + (f[:, None] / (2.5 * fc)) ** 4)
    _, y = signal.istft(Z * mask, **STFT)
    y = y[: len(x)]
    if len(y) < len(x):
        y = np.pad(y, (0, len(x) - len(y)))
    return y


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def fade_tail(x, ms=4.0):
    k = min(len(x), int(ms * 1e-3 * SR))
    if k > 1:
        x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def fit(x, n):
    """Pad or cut the first axis to n samples."""
    if len(x) >= n:
        return x[:n]
    pad = [(0, n - len(x))] + [(0, 0)] * (x.ndim - 1)
    return np.pad(x, pad)


# ---------- pitch: notes, keys and the palette ----------
NOTE_RE = re.compile(r"^([A-Ga-g])([#b]?)(-?\d+)$")
PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
MAJOR = [0, 2, 4, 5, 7, 9, 11]
# The film's palette: the major scale without its 4th (in D: D E F# A B C#), the reel's event notes.
PALETTE_DEGREES = (1, 2, 3, 5, 6, 7)


def midi(note: str) -> int:
    m = NOTE_RE.match(note.strip())
    if not m:
        raise ValueError(f"not a note name: {note!r} (use e.g. 'F#5', 'Bb4')")
    n, acc, octv = m.groups()
    return 12 * (int(octv) + 1) + PC[n.upper()] + {"#": 1, "b": -1, "": 0}[acc]


def hz(note) -> float:
    """'A4' -> 440.0; a number passes through."""
    if isinstance(note, (int, float, np.floating, np.integer)):
        return float(note)
    return 440.0 * 2 ** ((midi(note) - 69) / 12)


def key_tonic(key: str) -> int:
    """Pitch class of a key's major tonic. 'D', 'D major', 'B minor' (-> D, its relative major)."""
    k = key.strip().replace("major", "").replace("maj", "").strip()
    minor = False
    if k.endswith("minor") or k.endswith("min") or (k.endswith("m") and len(k) <= 3):
        minor = True
        k = re.sub(r"\s*(minor|min|m)$", "", k).strip()
    m = re.match(r"^([A-Ga-g])([#b]?)$", k)
    if not m:
        raise ValueError(f"not a key: {key!r}")
    pc = (PC[m.group(1).upper()] + {"#": 1, "b": -1, "": 0}[m.group(2)]) % 12
    return (pc + 3) % 12 if minor else pc


def key_root(key: str) -> int:
    """Pitch class of the key's own tonic ('E minor' -> E): what subs, bodies and risers tune to."""
    minor = bool(re.search(r"(minor|min|m)$", key.strip()))
    return (key_tonic(key) - 3) % 12 if minor else key_tonic(key)


def degree_hz(degree: int, key: str = "D", octave: int = 5) -> float:
    """Scale degree of the key's major scale (the relative major for a minor key); 8 is the tonic an
    octave up. The register stays put across keys: the tonic is the one nearest D of `octave`
    (from 6 semitones below to 5 above), so D major gives D5 and A-flat major gives Ab4."""
    d = int(degree)
    if d < 1:
        raise ValueError("degree must be 1 or more")
    d_ref = 12 * (octave + 1) + 2
    tonic = d_ref + (key_tonic(key) - 2 + 6) % 12 - 6 + 12 * ((d - 1) // 7)
    return 440.0 * 2 ** ((tonic + MAJOR[(d - 1) % 7] - 69) / 12)


def root_hz(key: str = "D", octave: int = 2, semis: int = 0) -> float:
    """The key's root (plus `semis`) in `octave`: root_hz('D', 1) = D1, root_hz('D', 2, 7) = A2."""
    return 440.0 * 2 ** ((12 * (octave + 1) + key_root(key) + semis - 69) / 12)


def pitch(note=None, degree=None, key="D", octave=5) -> float:
    if note is not None:
        return hz(note)
    return degree_hz(degree or 1, key, octave)


# ---------- spaces ----------
@functools.lru_cache(maxsize=16)
def hall_ir(dur=2.8, rt60=2.3, predelay=0.018, seed=0):
    """Stereo hall impulse response: band-split noise with frequency-dependent decay (lows ring
    longest, air dies first), a soft diffusion build-up, sparse early reflections, pre-delay.
    Normalised to unit energy per channel."""
    r = rng(("hall", seed))
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for lo, hi, m in [(20, 250, 1.2), (250, 1200, 1.0), (1200, 4500, 0.72), (4500, 16000, 0.42)]:
        env = np.exp(-t / (rt60 * m / 6.91))
        for c in range(2):
            ir[:, c] += bp(r.standard_normal(n), lo, hi, order=2) * env
    ir *= np.minimum(1.0, t / 0.03)[:, None]
    for _ in range(12):
        d = r.uniform(0.006, 0.075)
        g = r.uniform(0.25, 0.6) * np.exp(-d / 0.045)
        for c in range(2):
            j = int((d + r.uniform(0, 0.004)) * SR)
            ir[j, c] += g * r.choice([-1.0, 1.0]) * 8
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((pd, 2)), ir])[:n]
    ir = fade_tail(ir, 80)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    return ir.astype(np.float32)


def convolve_ir(x, ir):
    """x mono (N,) or stereo (N, 2) through a stereo IR -> stereo (N + len(ir) - 1, 2)."""
    if x.ndim == 1:
        return np.stack([signal.oaconvolve(x, ir[:, c]) for c in (0, 1)], 1)
    return np.stack([signal.oaconvolve(x[:, c], ir[:, c]) for c in (0, 1)], 1)


def synth_ir(dur=1.8, tau=0.45, seed=0, lp_hz=7000):
    """Cheap stereo reverb impulse response (decaying filtered noise)."""
    r = rng(seed)
    n = int(dur * SR)
    e = exp_decay(n, tau)
    return np.stack([lp(r.standard_normal(n), lp_hz) * e, lp(r.standard_normal(n), lp_hz) * e], 1) * 0.08


def reverb(st, wet=0.25, **kw):
    ir = synth_ir(**kw)
    y = np.stack([signal.oaconvolve(st[:, c], ir[:, c]) for c in (0, 1)], 1)
    out = np.zeros_like(y)
    out[: len(st)] += st
    return out * (1 - wet) + y * wet


def hall(st, wet=0.25, keep_len=False, **kw):
    """Dry/wet through the hall IR; the tail is kept unless keep_len."""
    ir = hall_ir(**kw)
    y = convolve_ir(st, ir) * 0.5
    out = np.zeros((len(y), 2))
    out[: len(st)] += st if st.ndim == 2 else st[:, None]
    out = out * (1 - wet) + y * wet
    return out[: len(st)] if keep_len else out


# ---------- the steel pins ----------
# Free-free bar mode ratios: a pin knocked while it slides rings like a tiny glockenspiel bar.
FREE_FREE = np.array([1.0, 2.756, 5.404, 8.933])
FREE_AMPS = np.array([1.0, 0.42, 0.2, 0.08])


def _pin_grain(f1, tau, r, soft=0.6, knock=0.12):
    n = int((tau * 6.5 + 0.004) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, ratio in enumerate(FREE_FREE):
        fk = f1 * ratio * (1 + r.uniform(-0.006, 0.006))
        if fk > 17_500:
            break
        x += FREE_AMPS[k] * np.sin(2 * np.pi * fk * t + r.uniform(0, 2 * np.pi)) * np.exp(-t / (tau / (1 + 0.9 * k)))
    a = max(2, int(0.00025 * SR))
    x[:a] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    nz = r.standard_normal(n)
    x += bp(nz, 2500, 9000) * np.exp(-t / 0.0004) * 0.55 * soft
    x += bp(nz[::-1], 500, 1500) * np.exp(-t / 0.003) * knock
    return x


def pin_tick(f1=3200, tau=0.035, soft=0.6, pan=0.0, seed=20):
    """One soft steel pin tick: free-free modes (2-5 kHz fundamental), 0.4 ms contact, plate knock.
    tau 0.02-0.05 s is a dry tick; 0.08-0.2 s rings like a struck pin."""
    x = _pin_grain(f1, tau, rng(("pin_tick", seed)), soft)
    x = lp(x, 11_000)
    return normalize(stereo(x, pan), -6)


@functools.lru_cache(maxsize=8)
def _pin_bank(f_lo, f_hi, tau_lo, tau_hi, steps=32, variants=4, seed=0):
    """Pre-rendered grains across the pitch range (each variant detuned up to 2.5 %, so neighbours
    never lock into one whistle): a dense cloud is a few thousand of these."""
    r = rng(("pin_bank", seed))
    fs = np.geomspace(f_lo, f_hi, steps)
    bank = []
    for i, f in enumerate(fs):
        row = []
        for v in range(variants):
            tau = tau_lo * (tau_hi / tau_lo) ** r.random()
            row.append(lp(_pin_grain(f * (1 + r.uniform(-0.025, 0.025)), tau, r), 11_000).astype(np.float32))
        bank.append(row)
    return fs, bank


def _bins_from(events=None, hist=None, bin_s=0.005):
    """Normalise pin data to bins: (bin_s, count, energy, u, v, u_spread, v_spread)."""
    if hist is not None:
        b = float(hist.get("binS", bin_s))
        c = np.asarray(hist["n"], float)
        e = np.asarray(hist.get("e", c), float)
        u = np.asarray(hist.get("u", np.full_like(c, 0.5)), float)
        v = np.asarray(hist.get("v", np.full_like(c, 0.5)), float)
        us = np.asarray(hist.get("us", np.full_like(c, 0.08)), float)
        vs = np.asarray(hist.get("vs", np.full_like(c, 0.12)), float)
        return b, c, e, u, v, us, vs
    ev = np.asarray(events, float)
    t = ev[:, 0] - ev[:, 0].min()
    nb = int(t.max() / bin_s) + 1
    idx = np.minimum((t / bin_s).astype(int), nb - 1)
    w = ev[:, 3] if ev.shape[1] > 3 else np.ones(len(ev))
    c = np.bincount(idx, minlength=nb).astype(float)
    e = np.bincount(idx, weights=w * w, minlength=nb)
    su = np.bincount(idx, weights=ev[:, 1], minlength=nb)
    sv = np.bincount(idx, weights=ev[:, 2], minlength=nb)
    suu = np.bincount(idx, weights=ev[:, 1] ** 2, minlength=nb)
    svv = np.bincount(idx, weights=ev[:, 2] ** 2, minlength=nb)
    with np.errstate(invalid="ignore", divide="ignore"):
        u = np.where(c > 0, su / c, 0.5)
        v = np.where(c > 0, sv / c, 0.5)
        us = np.sqrt(np.maximum(np.where(c > 0, suu / c, 0) - u ** 2, 0)) + 0.02
        vs = np.sqrt(np.maximum(np.where(c > 0, svv / c, 0) - v ** 2, 0)) + 0.02
    return bin_s, c, e, u, v, us, vs


def pin_brush(events=None, hist=None, dur=None, density=900.0, shape="bell", pan=(-0.6, 0.6), height=(0.2, 0.8),
              f_range=(2200.0, 5400.0), tau=(0.018, 0.06), max_rate=1600.0, wash=0.35, seed=21):
    """A sweep of pins brushing past: the film's signature texture, kept very quiet in the mix.

    Drive it from the wall itself (src/engine/audio/pins.ts writes `hist`):
      hist   = {"binS": 0.005, "n": [...pins per bin], "e": [...sum of squared weights],
                "u": [...mean column 0..1], "v": [...mean row 0..1], "us": [...column spread]}
      events = [[t, u, v, weight], ...] for individual pins
    or, with neither, a parametric sweep of `dur` seconds, `density` pins/s at its peak, `shape`
    rise|fall|bell|flat, pan from pan[0] to pan[1], rows from height[0] to height[1].
    Pitch follows the row (top = higher), pan follows the column, loudness follows how many pins
    move: the sound is the wall's data."""
    r = rng(("pin_brush", seed))
    if events is None and hist is None:
        dur = float(dur or 1.2)
        nb = max(1, int(dur / 0.005))
        x = (np.arange(nb) + 0.5) / nb
        prof = {"rise": x ** 1.6, "fall": (1 - x) ** 1.6, "flat": np.ones(nb),
                "bell": np.sin(np.pi * x) ** 1.4}[shape]
        c = prof * density * 0.005
        hist = {"binS": 0.005, "n": c.tolist(), "e": c.tolist(),
                "u": ((np.interp(x, [0, 1], pan) + 1) / 2).tolist(),
                "v": np.interp(x, [0, 1], height).tolist()}
    b, c, e, u, v, us, vs = _bins_from(events, hist)
    nb = len(c)
    fs, bank = _pin_bank(float(f_range[0]), float(f_range[1]), float(tau[0]), float(tau[1]))
    glen = max(len(g) for row in bank for g in row)
    out = np.zeros((int(nb * b * SR) + glen + SR // 10, 2))
    cap = max_rate * b
    for i in range(nb):
        if c[i] <= 0:
            continue
        want = min(c[i], cap)
        g = int(want) + (1 if r.random() < want - int(want) else 0)
        if g == 0:
            continue
        amp = np.sqrt(e[i] / g) if e[i] > 0 else 1.0
        for _ in range(g):
            t0 = (i + r.random()) * b
            pu = np.clip(u[i] + r.normal(0, us[i]), 0, 1)
            pv = np.clip(v[i] + r.normal(0, vs[i]), 0, 1)
            fi = int(round(pv * (len(fs) - 1)))
            grain = bank[fi][int(r.integers(len(bank[fi])))]
            th = pu * np.pi / 2
            s = int(t0 * SR)
            a = amp * r.lognormal(0, 0.3)
            out[s:s + len(grain), 0] += grain * (a * np.cos(th))
            out[s:s + len(grain), 1] += grain * (a * np.sin(th))
    if wash > 0:
        # friction wash: the pins' shafts sliding, following the moving energy
        pad = 8
        tb = (np.arange(-pad, nb + pad) + 0.5) * b
        ep = np.concatenate([np.zeros(pad), e, np.zeros(pad)])
        han = np.hanning(11)
        n = len(out)
        tt = np.arange(n) / SR
        env = np.sqrt(np.maximum(np.interp(tt, tb, np.convolve(ep, han / han.sum(), "same"), left=0, right=0), 0))
        pu = np.interp(tt, (np.arange(nb) + 0.5) * b, u, left=u[0], right=u[-1])
        nz = bp(r.standard_normal((n, 2)), 3000, 11_000)
        flutter = 0.6 + 0.4 * lp(np.abs(r.standard_normal(n)), 60)
        mono = nz[:, 0] * env * flutter
        side = nz[:, 1] * env * flutter * 0.35
        th = pu * np.pi / 2
        w = np.stack([mono * np.cos(th) + side, mono * np.sin(th) - side], 1)
        ref = np.sqrt(np.mean(out ** 2)) + 1e-9
        out += w * (wash * ref / (np.sqrt(np.mean(w ** 2)) + 1e-9))
    out = np.tanh(out / (np.max(np.abs(out)) + 1e-9) * 1.6) / np.tanh(1.6)
    out = hp(out, 900)
    last = np.max(np.nonzero(np.abs(out).max(axis=1) > 1e-5)[0], initial=0)
    out = fade_tail(out[: last + int(0.01 * SR)], 6)
    return normalize(out, -3)


def pin_tink(f1=2600, tau=0.12, n=None, seed=9):
    """One steel pin (the original clamped-free model, mono, unnormalised): modal synthesis + contact click."""
    r = rng(seed)
    n = n or int((tau * 6 + 0.01) * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k, ratio in enumerate([1.0, 6.267, 17.547, 34.386]):
        fk = f1 * ratio * (1 + r.uniform(-0.004, 0.004))
        if fk > 18_000:
            break
        x += np.sin(2 * np.pi * fk * t + r.uniform(0, 6.28)) * np.exp(-t / (tau / (k + 1) ** 1.5)) / (k + 1)
    x += hp(r.standard_normal(n), 5000) * np.exp(-t / 0.0006) * 0.6
    return x


def pin_cascade(events, dur=None, tau=(0.05, 0.22), seed=10):
    """events: list of (time_s, pan[-1..1], f1_hz, gain). The original cascade, now on the grain
    bank (about 20x faster). tau=(0.02, 0.08) -> dry clatter; (0.08, 0.30) -> ringing pins."""
    ev = np.asarray(events, float)
    f_lo, f_hi = float(ev[:, 2].min()), float(ev[:, 2].max()) * 1.0001
    dur = dur or float(ev[:, 0].max()) + 1.0
    out = np.zeros((int(dur * SR), 2))
    fs, bank = _pin_bank(f_lo, f_hi, float(tau[0]), float(tau[1]), seed=seed)
    r = rng(("cascade", seed))
    for t0, pan, f1, g in ev:
        fi = int(np.argmin(np.abs(fs - f1)))
        x = bank[fi][int(r.integers(len(bank[fi])))] * g
        s = int(t0 * SR)
        e = min(len(out), s + len(x))
        th = (pan + 1) * np.pi / 4
        out[s:e, 0] += x[: e - s] * np.cos(th)
        out[s:e, 1] += x[: e - s] * np.sin(th)
    out /= np.sqrt(max(1, len(ev)) / 8)
    out = np.tanh(out * 1.5) / 1.5
    return normalize(reverb(out, wet=0.18, dur=1.2, tau=0.25, seed=seed)[: len(out)], -1)


def wavefront_events(cols=64, rows=36, origin=(0.0, 0.5), speed=1.6, jitter=0.012,
                     f_lo=1800, f_hi=4200, max_voices=400, seed=11):
    """Pins flip as a wave crosses a cols x rows grid (normalized 0..1 coords).
    Pitch follows row (top = higher), pan follows column."""
    r = rng(seed)
    ev = []
    for c in range(cols):
        for rr in range(rows):
            x, y = c / (cols - 1), rr / (rows - 1)
            d = np.hypot(x - origin[0], y - origin[1])
            ev.append((d / speed + r.normal(0, jitter), 2 * x - 1, f_lo + (f_hi - f_lo) * (1 - y), r.lognormal(0, 0.35)))
    ev.sort()
    if len(ev) > max_voices:
        idx = np.sort(r.choice(len(ev), max_voices, replace=False))
        ev = [ev[i] for i in idx]
    t0 = ev[0][0]
    return [(e[0] - t0 + 0.01, e[1], e[2], e[3]) for e in ev]


# ---------- tonal ----------
def _bell(f0, n, partials, r, detune_cents=1.2, attack=0.003, phase_l=None):
    """Stereo additive tone. partials: (ratio, amp, tau_s). L/R detuned by +-detune_cents."""
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ratio, amp, tau in partials:
        f = f0 * ratio
        if f > 16_000 or amp <= 0:
            continue
        env = np.exp(-t / tau)
        for c, sgn in ((0, -1), (1, 1)):
            fc = f * 2 ** (sgn * detune_cents / 1200)
            out[:, c] += amp * np.sin(2 * np.pi * fc * t + r.uniform(0, 2 * np.pi)) * env
    a = max(2, int(attack * SR))
    out[:a] *= (0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a))[:, None]
    return out


def note(note=None, degree=None, key="D", octave=5, velocity=0.8, decay=1.1, bright=0.5, width=1.2,
         space=0.0, dur=None, seed=30):
    """Event note on a visual beat: a soft glass-mallet tone whose partials sit on the key's notes,
    falling 10 dB in `decay` seconds (the reel's notes: ~1.1 s). Give an absolute `note` ('F#5')
    or a scale `degree` (1-7; the palette is 1 2 3 5 6 7) of `key` in `octave`.
    `space` adds the hall inside the recipe (the mix normally sends notes to the shared hall)."""
    r = rng(("note", seed))
    f0 = pitch(note, degree, key, octave)
    tau = decay / (10 / 8.686)
    b = float(np.clip(bright, 0, 1)) * (0.6 + 0.4 * velocity)
    dur = dur or decay * 3.4
    n = int(dur * SR)
    partials = [(1.0, 1.0, tau), (2.0, 0.34 * b, tau * 0.6), (3.0, 0.13 * b, tau * 0.38), (4.0, 0.055 * b, tau * 0.27),
                (2.76, 0.03 * b, 0.12), (5.4, 0.012 * b, 0.07), (0.5, 0.06, tau * 0.7)]
    x = _bell(f0, n, partials, r, detune_cents=width, attack=0.004)
    t = np.arange(n) / SR
    mallet = lp(r.standard_normal(n), min(9000, f0 * 6)) * np.exp(-t / 0.0012) * 0.05 * velocity
    x += mallet[:, None]
    x = fade_tail(x, 60)
    if space > 0:
        x = hall(x, wet=space)
    return normalize(x * (0.4 + 0.6 * velocity), -3)


def chime(notes=None, degrees=(5, 8), key="D", octave=5, gap=0.085, decay=0.75, bright=0.8, seed=13):
    """Success chime: palette notes rising (default degrees 5 -> 8: A5 -> D6 in D, a fourth onto the
    tonic), brighter and shorter than an event note, panned slightly apart. Three notes:
    degrees=(3, 5, 8), or absolute notes=('F#5', 'A5', 'D6')."""
    r = rng(("chime", seed))
    if notes is None:
        notes = [degree_hz(d, key, octave) for d in degrees]
    notes = [notes] if isinstance(notes, (str, int, float)) else list(notes)
    tau = decay / (10 / 8.686)
    n = int((gap * len(notes) + decay * 3.0) * SR)
    out = np.zeros((n, 2))
    for i, nm in enumerate(notes):
        f0 = hz(nm)
        s = int(i * gap * SR)
        partials = [(1.0, 1.0, tau), (2.0, 0.4 * bright, tau * 0.55), (3.0, 0.16 * bright, tau * 0.35),
                    (4.07, 0.07 * bright, tau * 0.22), (5.4, 0.035 * bright, tau * 0.12)]
        x = _bell(f0, n - s, partials, r, detune_cents=1.5, attack=0.003)
        p = -0.22 + 0.44 * i / max(1, len(notes) - 1)
        out[s:] += balance(x.astype(np.float32), p) * (0.85 ** i)
    out = fade_tail(out, 60)
    return normalize(hall(out, wet=0.16)[:n], -3)


def error_buzz(f=174.61, pulses=2, pulse=0.12, gap=0.06, step=-1, rough=0.18):
    """Polite 'denied': soft band-limited square pulses with a little 30 Hz roughness, each pulse a
    semitone lower (F3 -> E3). Never alarming; meaning comes from the picture's verdict colour."""
    out = []
    for p in range(pulses):
        t = tvec(pulse)
        fp = f * 2 ** (step * p / 12)
        x = sum(np.sin(2 * np.pi * fp * k * t) / k ** 1.6 for k in range(1, 40, 2) if fp * k < 3000)
        env = np.minimum(t / 0.005, 1) * np.minimum((pulse - t) / 0.018, 1)
        x = x * (1 - rough + rough * np.sin(2 * np.pi * 30 * t)) * env
        out += [x, np.zeros(int(gap * SR))]
    x = lp(np.concatenate(out), 2200)
    x = np.tanh(1.4 * x / np.max(np.abs(x)))
    return normalize(hall(stereo(x), wet=0.08)[: len(x) + int(0.25 * SR)], -6)


# ---------- UI ----------
def blip(note=None, degree=5, key="D", octave=5, glide=0.08, dur=0.14, tap=0.35, seed=7, f0=None, f1=None):
    """UI blip for chips and labels: a short pluck that glides up onto a palette note (degree 5 in
    octave 5 by default: A5 in D), with a fingertip tap. f0/f1 (Hz) reproduce the original glide."""
    r = rng(("blip", seed))
    t = tvec(dur)
    top = float(f1) if f1 else pitch(note, degree, key, octave)
    start = float(f0) if f0 else top * (1 - glide)
    f = top + (start - top) * np.exp(-t / 0.010)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(t / 0.0015, 1) * np.exp(-t / 0.045)
    x = (np.sin(ph) + 0.15 * np.sin(2 * ph) + 0.04 * np.sin(3 * ph)) * env
    x += bp(r.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.0012) * tap
    x = fade_tail(x, 5)
    return normalize(stereo(x), -6)


def stamp(weight=1.0, key="D", seed=40):
    """A verdict stamp landing (motion.stamp, 0.35 s): felt thump settling on the key's root in
    octave 3 (D3), rubber contact and its settle 9 ms later, a breath of paper, a small room."""
    r = rng(("stamp", seed))
    dur = 0.5
    t = tvec(dur)
    n = len(t)
    fr = root_hz(key, 3)
    f = fr * (1 + 0.57 * np.exp(-t / 0.015))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(t / 0.001, 1) * np.exp(-t / 0.045)
    body = np.tanh(1.8 * body) / np.tanh(1.8)
    nz = r.standard_normal(n)
    contact = bp(nz, 700, 4500) * np.exp(-t / 0.005) * 0.55
    settle = np.zeros(n)
    k = int(0.009 * SR)
    settle[k:] = bp(nz[::-1], 900, 3500)[: n - k] * np.exp(-t[: n - k] / 0.004) * 0.25
    paper = bp(r.standard_normal(n), 2000, 8000) * np.exp(-t / 0.025) * 0.06
    x = body * 0.9 * weight + contact + settle + paper
    x = fade_tail(x, 20)
    st = stereo(x)
    return normalize(hall(st, wet=0.06, rt60=0.35, dur=0.4, seed=4)[:n], -2)


def tick(freq=3200, dur=0.03, tau=0.0025, detune=0.03, seed=6):
    """UI/clock tick: damped sinusoid + 1 ms noise click. Vary seed per tick."""
    r = rng(seed)
    t = tvec(dur)
    f = freq * (1 + r.uniform(-detune, detune))
    x = np.sin(2 * np.pi * f * t) * exp_decay(len(t), tau)
    x += hp(r.standard_normal(len(t)), 4000) * exp_decay(len(t), 0.0007) * 0.5
    return normalize(stereo(x), -6)


def typing(keys=None, n_keys=24, rate=9.0, soft=0.7, seed=12):
    """Keystrokes for code: keycap contact + plate thock + bottom-out + release, varied per key.
    `keys`: explicit key times in seconds (sync to the code engine's typing), else `n_keys` at
    `rate` keys/s with human (gamma) spacing."""
    r = rng(("typing", seed))
    if keys is None:
        keys = np.cumsum(r.gamma(4, 1 / (4 * rate), n_keys))
    keys = np.asarray(keys, float)
    keys = keys - keys.min() + 0.002
    out = np.zeros((int((keys.max() + 0.3) * SR), 2))
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    for t0 in keys:
        nz = r.standard_normal(n)
        cap = bp(nz, 1500, 6000) * np.exp(-tt / r.uniform(0.003, 0.005))
        fth = r.uniform(180, 280)
        thock = np.sin(2 * np.pi * np.cumsum(fth * (1 + 0.25 * np.exp(-tt / 0.006))) / SR) * np.exp(-tt / r.uniform(0.012, 0.022)) * 0.55
        x = (cap * (1 - 0.4 * soft) + thock) * r.uniform(0.6, 1.0)
        d = int(r.uniform(0.010, 0.022) * SR)
        x[d:] += cap[: n - d] * 0.3
        rel = int(r.uniform(0.045, 0.09) * SR)
        x[rel:] += bp(nz[::-1], 2500, 7000)[: n - rel] * np.exp(-tt[: n - rel] / 0.002) * 0.18
        s = int(t0 * SR)
        e = min(len(out), s + n)
        out[s:e] += stereo(x[: e - s], r.uniform(-0.15, 0.15))
    out = lp(out, 7500)
    return normalize(out, -6)


# ---------- transitions ----------
def whoosh(dur=0.9, f_lo=250, f_hi=3800, peak_at=0.6, pan=(-0.7, 0.7), body=0.15, body_hz=None, key="D", seed=1):
    """Air whoosh: noise through a band-pass that sweeps up into the cut and back down, asymmetric
    envelope (slow in, fast out), stereo pass-by, a low body on the key's root (D2)."""
    t = tvec(dur)
    body_hz = body_hz or root_hz(key, 2)
    tp = peak_at * dur
    noise = pink(len(t), seed_int(seed))
    fc = lambda tt: f_lo + (f_hi - f_lo) * np.exp(-0.5 * ((tt - tp) / (0.28 * dur)) ** 2)
    x = sweep_bandpass(noise, fc, width_oct=0.9)
    env = np.where(t < tp, (t / tp) ** 2.2, np.exp(-(t - tp) / (0.12 * dur)))
    lowb = np.sin(2 * np.pi * np.cumsum(body_hz * (1 + 0.25 * np.exp(-t / dur))) / SR) * env * body
    p = np.interp(t, [0, dur], pan)
    st = stereo(x * env + lowb, p)
    return normalize(fade_tail(st, 8), -3)


def swish(dur=0.42, seed=2, pan=(-0.4, 0.5), **kw):
    """Short bright swish for cards swinging in (motion.cardSwingS 0.5 s)."""
    kw = {"f_lo": 700, "f_hi": 6500, "peak_at": 0.55, "body": 0.0, **kw}
    return whoosh(dur=dur, pan=pan, seed=seed, **kw)


def _saw_stack(f_of_t, n, harm_max_hz=4500.0, detunes=(0.995, 1.0, 1.006)):
    """Band-limited saw stack following a pitch curve (additive, no aliasing)."""
    out = np.zeros(n)
    fmax = float(np.max(f_of_t))
    K = max(1, int(harm_max_hz / max(fmax * 0.5, 1)))
    for d in detunes:
        ph = 2 * np.pi * np.cumsum(f_of_t * d) / SR
        for k in range(1, K + 1):
            fk = f_of_t * d * k
            w = np.clip((harm_max_hz - fk) / (0.15 * harm_max_hz), 0, 1)
            if not w.any():
                break
            out += w * np.sin(k * ph) / k
    return out / len(detunes)


def riser(dur=4.0, f_start=200, f_end=7000, tone_end=None, key="D", octaves=2, tone=0.35, seed=4, tone_f0=None):
    """Noise sweep + band-limited detuned saw stack climbing `octaves` to `tone_end` (default the
    key's fifth in octave 4, A4 in D, so the impact's root answers it) + accelerating tremolo.
    Ends at full level exactly at `dur`: align the cue's end to the cut."""
    tone_end = tone_end or root_hz(key, 4, 7)
    t = tvec(dur)
    u = t / dur
    r = rng(("riser", seed))
    noise = sweep_bandpass(r.standard_normal(len(t)), lambda tt: f_start * (f_end / f_start) ** (tt / dur), 1.2)
    f_top = hz(tone_end) if tone_f0 is None else tone_f0 * 2 ** octaves
    f = f_top * 2 ** (octaves * (u ** 1.5 - 1))
    saw = lp(_saw_stack(f, len(t)), 3200)
    trem_rate = 2 + 14 * u ** 2
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(trem_rate) / SR)
    env = u ** 2.5
    x = (noise * 0.8 + saw * tone) * env * trem
    k = int(0.004 * SR)
    x[-k:] *= np.linspace(1, 0, k)
    w = 0.3 * u
    st = np.stack([x * (1 - w), x * (1 - w)], 1)
    st[:, 0] += w * np.roll(x, 37)
    st[:, 1] += w * np.roll(x, -41)
    return normalize(st.astype(np.float32), -1)


def reverse_swell(dur=1.6, tone=None, tone_degree=None, key="D", tone_mix=0.4, seed=5):
    """Reversed bloom: a hall tail run backwards so it swells steadily into the cut and stops dead.
    `tone` ('D5') or `tone_degree` (1 = the key's tonic in octave 5) adds a reversed note inside it."""
    if tone is None and tone_degree is not None:
        tone = degree_hz(tone_degree, key, 5)
    n = int(dur * SR)
    r = rng(("swell", seed))
    tail = hp(r.standard_normal(n), 2500) * exp_decay(n, dur / 4)
    st = hall(stereo(tail), wet=0.65, rt60=dur * 0.9, dur=dur, seed=seed_int(seed) % 7)[:n]
    st = st / (np.max(np.abs(st)) + 1e-9)
    if tone:
        nt = note(tone, decay=dur * 0.6, dur=dur, bright=0.3, seed=seed)
        st = st + fit(nt, n) * tone_mix
    st = st[::-1] * (np.arange(n) / n)[:, None] ** 1.5
    st[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))[:, None]
    return normalize(st, -2)


def sub_drop(dur=1.8, f0=95, f1=32, tau_pitch=0.25, tau_amp=0.7, drive=2.5, seed=2):
    """808-style sub drop + saturation harmonics (audible on laptop speakers) + click."""
    t = tvec(dur)
    f = f1 + (f0 - f1) * np.exp(-t / tau_pitch)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(t / 0.004, 1) * np.exp(-t / tau_amp)
    x = np.tanh(drive * s * env) / np.tanh(drive)
    click = hp(rng(seed).standard_normal(len(t)), 1500) * exp_decay(len(t), 0.0025) * 0.25
    x = hp(x + click, 25)
    return normalize(stereo(x), -1)


def sub_hit(dur=1.8, f0=None, f1=None, key="D", tau_pitch=0.22, tau_amp=0.65, drive=2.6, seed=2):
    """Sub hit tuned to the key: glides from the fifth (A2 in D) down to the root (D1); saturation
    puts its harmonics on D2, A2, D3, so laptops hear it in key. High-passed at 28 Hz."""
    t = tvec(dur)
    a = hz(f0) if f0 is not None else root_hz(key, 2, 7)
    b = hz(f1) if f1 is not None else root_hz(key, 1)
    f = b + (a - b) * np.exp(-t / tau_pitch)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = np.minimum(t / 0.004, 1) * np.exp(-t / tau_amp)
    x = np.tanh(drive * s * env) / np.tanh(drive)
    click = hp(rng(("sub", seed)).standard_normal(len(t)), 1500) * exp_decay(len(t), 0.0025) * 0.2
    x = hp(x + click, 28, order=4)
    return normalize(fade_tail(stereo(x), 30), -1)


def impact(dur=3.0, key="D", pins=0.35, seed=3):
    """Chapter-card hit: sub tuned to the key's root + low thump + steel partials on the root, fifth
    and third (minor or major, as the key is) + a slam of pins + hall tail."""
    t = tvec(dur)
    n = len(t)
    r = rng(("impact", seed))
    sub = sub_hit(dur, key=key, seed=seed)[:, 0] * 0.9
    thump = bp(r.standard_normal(n), 60, 500) * exp_decay(n, 0.08) * 0.9
    tonic = 12 * 7 + key_root(key)
    third = 15 if key_root(key) != key_tonic(key) else 16
    metal = np.zeros(n)
    for semis, d, a in [(0, 0.45, 0.16), (7, 0.30, 0.10), (third, 0.18, 0.06), (24, 0.1, 0.03)]:
        f = 440 * 2 ** ((tonic + semis - 69) / 12)
        for det in (-0.0015, 0.0015):
            metal += np.sin(2 * np.pi * f * (1 + det) * t + r.uniform(0, 6.28)) * exp_decay(n, d) * a * 0.5
    metal *= np.minimum(t / 0.002, 1)
    st = stereo(sub + thump + metal)
    if pins > 0:
        slam = pin_brush(dur=0.16, density=6000, shape="fall", pan=(-0.8, 0.8), tau=(0.03, 0.12), seed=seed)
        st[: len(slam)] += slam[: n] * pins
    out = hall(st, wet=0.3, seed=seed_int(seed) % 5)[:n]
    return normalize(fade_tail(out, 40), -1)


def _pc_name(pc: int) -> str:
    return ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pc % 12]


# ---------- kept from the original set ----------
def glitch(dur=0.35, seed=8):
    """Digital glitch: stutter-repeated slices, bit-crush, sample-and-hold, gating."""
    r = rng(seed)
    n = int(dur * SR)
    t = tvec(dur)
    src = signal.square(2 * np.pi * r.uniform(180, 900) * t) * 0.4 + r.standard_normal(n) * 0.3
    out = np.zeros(n)
    i = 0
    while i < n:
        sl = int(r.uniform(0.012, 0.045) * SR)
        reps = r.integers(1, 4)
        start = r.integers(0, max(1, n - sl))
        piece = src[start:start + sl]
        hold = r.integers(4, 24)
        piece = np.repeat(piece[::hold], hold)[:sl]
        bits = r.integers(3, 7)
        piece = np.round(piece * 2 ** bits) / 2 ** bits
        for _ in range(reps):
            j = min(n, i + len(piece))
            out[i:j] = piece[: j - i] * (r.random() > 0.15)
            i = j
    out = lp(hp(out, 120), 9000)
    return normalize(stereo(out, r.uniform(-0.4, 0.4)), -4)


def paper(dur=0.5, seed=14):
    """Paper/document: Poisson crackle (band-passed micro-bursts) + soft slide noise."""
    r = rng(seed)
    n = int(dur * SR)
    t = tvec(dur)
    rate = 200 + 900 * np.sin(np.pi * t / dur) ** 2
    imp = (r.random(n) < rate / SR) * r.uniform(-1, 1, n)
    crackle = bp(signal.lfilter([1], [1, -0.6], imp), 1500, 7000)
    slide = sweep_bandpass(r.standard_normal(n), lambda tt: 1200 + 2500 * np.sin(np.pi * tt / dur), 1.0) * 0.25
    env = np.sin(np.pi * t / dur) ** 0.7
    return normalize(stereo((crackle * 2.5 + slide) * env, r.uniform(-0.3, 0.3)), -6)


def heartbeat(bpm=64, beats=4, seed=15):
    """Lub-dub sub pulse with saturation so it reads on small speakers."""
    r = rng(seed)
    period = 60 / bpm
    out = np.zeros(int((beats * period + 0.5) * SR))

    def thump(f_hi, f_lo, d):
        tt = tvec(d * 4)
        f = f_lo + (f_hi - f_lo) * np.exp(-tt / 0.03)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(tt / 0.006, 1) * np.exp(-tt / d)
        x += lp(r.standard_normal(len(tt)), 180) * np.exp(-tt / (d / 2)) * 0.3
        return np.tanh(2.2 * x)

    for b in range(beats):
        s = int(b * period * SR)
        lub, dub = thump(62, 45, 0.07), thump(80, 58, 0.05) * 0.7
        out[s:s + len(lub)] += lub[: len(out) - s]
        s2 = s + int(0.28 * period * SR)
        out[s2:s2 + len(dub)] += dub[: max(0, len(out) - s2)]
    return normalize(stereo(hp(out, 28)), -2)


def camera_shutter(seed=16, winder=True):
    """Mirror-up click, shutter-close click 55 ms later (each = noise burst + metal ring)."""
    r = rng(seed)
    n = int(0.6 * SR)
    out = np.zeros(n)

    def click(ring_hz, g):
        m = int(0.05 * SR)
        tt = np.arange(m) / SR
        return (bp(r.standard_normal(m), 2000, 9000) * np.exp(-tt / 0.003)
                + np.sin(2 * np.pi * ring_hz * tt) * np.exp(-tt / 0.015) * 0.4) * g

    for t0, ring, g in [(0.0, 3100, 0.8), (0.055, 2400, 1.0)]:
        c = click(ring, g)
        s = int(t0 * SR)
        out[s:s + len(c)] += c
    if winder:
        m = int(0.25 * SR)
        tt = np.arange(m) / SR
        w = bp(r.standard_normal(m), 600, 3000) * (0.5 + 0.5 * signal.square(2 * np.pi * 26 * tt)) * 0.15
        s = int(0.12 * SR)
        out[s:s + m] += w * np.hanning(m)
    return normalize(stereo(out), -3)


# ---------- registry ----------
RECIPES = dict(
    pin_tick=pin_tick, pin_brush=pin_brush, note=note, chime=chime, error_buzz=error_buzz, blip=blip, stamp=stamp,
    tick=tick, typing=typing, whoosh=whoosh, swish=swish, riser=riser, reverse_swell=reverse_swell, sub_hit=sub_hit,
    impact=impact, sub_drop=sub_drop, glitch=glitch, paper=paper, heartbeat=heartbeat, camera_shutter=camera_shutter,
)

# category -> how the mix treats it by default (see mix.py): level is LU relative to the voice,
# measured as the event's maximum momentary loudness; send is the shared hall; shield ducks and
# band-limits a transition while the narrator speaks.
CATEGORY = dict(
    pin_tick="pin", pin_brush="pin", note="tonal", chime="tonal", error_buzz="tonal", blip="ui", stamp="ui", tick="ui",
    typing="ui", paper="ui", camera_shutter="ui", whoosh="transition", swish="transition", riser="transition",
    reverse_swell="transition", glitch="transition", sub_hit="hit", impact="hit", sub_drop="hit", heartbeat="hit",
)
DEFAULTS = dict(
    pin_tick=dict(level=-26, send=0.22), pin_brush=dict(level=-24, send=0.25),
    note=dict(level=-15, send=0.32), chime=dict(level=-13, send=0.18), error_buzz=dict(level=-14, send=0.08),
    blip=dict(level=-19, send=0.12), stamp=dict(level=-14, send=0.06), tick=dict(level=-21, send=0.06),
    typing=dict(level=-24, send=0.04), paper=dict(level=-17, send=0.08), camera_shutter=dict(level=-14, send=0.06),
    whoosh=dict(level=-13, send=0.15, shield=True), swish=dict(level=-16, send=0.12, shield=True),
    riser=dict(level=-11, send=0.18, shield=True), reverse_swell=dict(level=-11, send=0.0, shield=True),
    glitch=dict(level=-15, send=0.05, shield=True), sub_hit=dict(level=-9, send=0.0), impact=dict(level=-5, send=0.12),
    sub_drop=dict(level=-9, send=0.0), heartbeat=dict(level=-14, send=0.0),
)
# Recipes whose `peak_at` argument marks the moment that lands on the frame with align="peak".
PEAK_DEFAULT = dict(whoosh=0.6, swish=0.55)


def render_stem(cues, total_s, fps=60):
    """The original cue renderer (kept for quick experiments; mix.py is the film's renderer).
    cues: [{"frame": 1234, "type": "whoosh", "gain_db": -8, "align": "end", "args": {...}}]
    align='start' -> sound starts on the frame; 'end' -> sound ENDS on the frame
    (risers / reverse swells), 'peak' -> uses args.peak_at (whooshes)."""
    out = np.zeros((int(total_s * SR), 2), np.float32)
    for c in cues:
        x = RECIPES[c["type"]](**c.get("args", {})) * db(c.get("gain_db", -6))
        t = c["frame"] / fps
        if c.get("align") == "end":
            t -= len(x) / SR
        elif c.get("align") == "peak":
            t -= c.get("args", {}).get("peak_at", PEAK_DEFAULT.get(c["type"], 0.6)) * len(x) / SR
        s = max(0, int(round(t * SR)))
        e = min(len(out), s + len(x))
        out[s:e] += x[: e - s]
    return out


def write_wav(path, st):
    """16-bit PCM with TPDF dither (plays everywhere: Chrome, Remotion, ffmpeg)."""
    d = (np.random.default_rng(0).random(st.shape) - np.random.default_rng(1).random(st.shape)) / 32768
    wavfile.write(path, SR, (np.clip(st + d, -1, 1) * 32767).astype(np.int16))


if __name__ == "__main__":
    import os
    import sys
    import time
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "sfx_out"
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in RECIPES.items():
        t0 = time.time()
        write_wav(os.path.join(out_dir, f"{name}.wav"), fn())
        print(f"{name:15s} {time.time() - t0:5.2f}s")
    t0 = time.time()
    write_wav(os.path.join(out_dir, "pin_cascade.wav"), pin_cascade(wavefront_events()))
    print(f"{'pin_cascade':15s} {time.time() - t0:5.2f}s")
    demo = [{"frame": 120, "type": "riser", "align": "end", "gain_db": -10},
            {"frame": 120, "type": "impact", "gain_db": -6},
            {"frame": 300, "type": "whoosh", "align": "peak", "gain_db": -12},
            {"frame": 420, "type": "tick", "gain_db": -18, "args": {"seed": 3}}]
    write_wav(os.path.join(out_dir, "demo_stem.wav"), render_stem(demo, total_s=10))
    print("demo_stem written; cue JSON example:", json.dumps(demo[:1]))
