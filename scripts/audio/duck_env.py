"""duck_env.py - deterministic music ducking from the narration's word timings.

duck_envelope()  the tested envelope: linear gain, -10 dB under every phrase, raised-cosine ramps
music_curve()    the film's music automation in dB, built on the same phrases:
                   * under narration:            depth_db (-10)
                   * gaps of merge_gap..full_gap: a partial swell that grows with the gap, so a
                     1.6 s breath lifts the bed a little instead of pumping it to full level
                   * holds of swell_min_gap or more: the bed rises swell_db above its open level
                     (the reel's "swells to its maximum in the narration-free holds")
                 It also returns the voice-activity depth (0..1) that drives the music's EQ pocket
                 and the SFX shield.
Same inputs, same curve: there is no detector, so it cannot pump or lag.
src/engine/audio/duck.ts is the same algorithm for Remotion previews (scripts/audio/parity.ts checks
that the two agree on every frame).
"""
from __future__ import annotations

import numpy as np


def duck_envelope(words, total_s, rate=60, duck_db=-10.0, merge_gap=1.5,
                  pre=0.15, attack=0.25, hold=0.35, release=0.6):
    """words: [(start_s, end_s), ...] from the VO word timestamps (same data as captions).
    Returns linear gain sampled at `rate` Hz (rate=60 -> one value per video frame,
    rate=48000 -> per audio sample). Deterministic: no pumping, no detector lag."""
    ph = []
    for s, e in sorted(words):                       # merge words into phrases
        if ph and s - ph[-1][1] < merge_gap:
            ph[-1][1] = max(ph[-1][1], e)
        else:
            ph.append([s, e])
    t = np.arange(int(np.ceil(total_s * rate))) / rate
    depth = np.zeros_like(t)                          # 0 = no duck, 1 = full duck
    for s, e in ph:
        a0, a1 = s - pre - attack, s - pre            # ramp down before the first syllable
        r0, r1 = e + hold, e + hold + release         # hold, then ramp back up
        up = np.clip((t - a0) / attack, 0, 1)
        down = np.clip((r1 - t) / release, 0, 1)
        d = np.minimum(up, down)
        d = 0.5 - 0.5 * np.cos(np.pi * d)             # raised-cosine ramps (smooth)
        depth = np.maximum(depth, d)
    return 10 ** (-abs(duck_db) * depth / 20)


DEFAULTS = dict(depth_db=-10.0, merge_gap=1.5, pre=0.15, attack=0.25, hold=0.35, release=0.6,
                full_gap=3.0, swell_db=3.0, swell_min_gap=3.0, swell_rise=1.2, swell_fall=1.0)


def phrases(words, merge_gap=1.5):
    """Merge word intervals closer than merge_gap into phrases: [[start, end], ...]."""
    ph = []
    for s, e in sorted((float(a), float(b)) for a, b in words):
        if ph and s - ph[-1][1] < merge_gap:
            ph[-1][1] = max(ph[-1][1], e)
        else:
            ph.append([s, e])
    return ph


def _rc(x):
    """Raised cosine on a clipped ramp."""
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(x, 0.0, 1.0))


def music_curve(words, total_s, rate=48_000, t0=0.0, **kw):
    """Music automation from word timings. Returns (gain_db, depth, phrases) sampled at `rate` Hz
    over [t0, t0 + total_s). depth is voice activity 0..1 (1 = fully ducked)."""
    p = {**DEFAULTS, **{k: v for k, v in kw.items() if v is not None}}
    ph = phrases(words, p["merge_gap"])
    n = int(np.ceil(total_s * rate))
    t = t0 + np.arange(n) / rate
    depth = np.zeros(n)
    lead = p["pre"] + p["attack"]
    tail = p["hold"] + p["release"]
    for s, e in ph:
        lo, hi = np.searchsorted(t, [s - lead, e + tail])
        if hi <= lo:
            continue
        tt = t[lo:hi]
        d = np.minimum((tt - (s - lead)) / p["attack"], ((e + tail) - tt) / p["release"])
        depth[lo:hi] = np.maximum(depth[lo:hi], _rc(d))
    # partial swells: a gap only slightly longer than merge_gap lifts the bed partially
    span = max(1e-6, p["full_gap"] - p["merge_gap"])
    for (s0, e0), (s1, e1) in zip(ph, ph[1:]):
        frac = float(np.clip((s1 - e0 - p["merge_gap"]) / span, 0.0, 1.0))
        if frac < 1.0:
            lo, hi = np.searchsorted(t, [e0, s1])
            depth[lo:hi] = 1.0 - frac * (1.0 - depth[lo:hi])
    # lifts above the open level in long holds (lead-in, between phrases, tail)
    bump = np.zeros(n)
    edges = [(-np.inf, ph[0][0])] if ph else [(-np.inf, np.inf)]
    edges += [(e0, s1) for (_, e0), (s1, _) in zip(ph, ph[1:])]
    if ph:
        edges.append((ph[-1][1], np.inf))
    for a, b in edges:
        if b - a < p["swell_min_gap"]:
            continue
        fa = -np.inf if a == -np.inf else a + tail
        fb = np.inf if b == np.inf else b - lead
        if fb - fa <= 0.2:
            continue
        L = fb - fa
        rise = p["swell_rise"] if not np.isfinite(L) else min(p["swell_rise"], L / 2)
        fall = p["swell_fall"] if not np.isfinite(L) else min(p["swell_fall"], L / 2)
        up = np.ones(n) if fa == -np.inf else _rc((t - fa) / rise)
        dn = np.ones(n) if fb == np.inf else _rc((fb - t) / fall)
        bump = np.maximum(bump, np.minimum(up, dn))
    # depth_db is a cut: "duck 19 dB" and "duck -19 dB" both lower the bed by 19 dB under speech.
    # (A positive value used to be added as written, which raised the music over the narrator.)
    cut_db = -abs(float(p["depth_db"]))
    gain_db = cut_db * depth + p["swell_db"] * bump
    return gain_db, depth, ph


if __name__ == "__main__":
    words = [(3.0, 3.3), (3.35, 3.7), (3.8, 4.4), (6.0, 6.5), (6.55, 7.2)]
    g = duck_envelope(words, 10)
    for f in (0, 150, 166, 172, 180, 270, 330, 350, 420, 470, 520):
        print(f"frame {f:4d} t={f/60:5.2f}s gain={20*np.log10(g[f]):6.1f} dB")
    print("music_curve (partial swell in the 1.6 s gap, lift in the lead-in and tail):")
    gd, dep, ph = music_curve(words, 12, rate=60)
    for f in (0, 120, 166, 172, 270, 320, 330, 340, 420, 480, 560, 660, 719):
        print(f"frame {f:4d} t={f/60:5.2f}s music={gd[f]:6.2f} dB  voice={dep[f]:.2f}")
