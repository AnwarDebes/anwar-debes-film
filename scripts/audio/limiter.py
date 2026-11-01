"""limiter.py - offline true-peak limiter with look-ahead, vectorised in numpy.

How the gain is built (all deterministic, no per-sample Python loop):
  1. need[n]   = ceiling / true-peak envelope (4x oversampled), capped at 1
  2. hold[n]   = min of need over +-L samples (L = look-ahead)
  3. rel[n]    = constant-rate release in dB (min-plus recursion solved with a running minimum)
  4. gain[n]   = rel smoothed by a Hann kernel of the same +-L support
Every sample of the smoothing window around n is <= need[n], so gain[n] * peak[n] <= ceiling by
construction; a final true-peak measurement confirms it and tightens the ceiling if the gain
modulation itself created a new inter-sample peak.
"""
from __future__ import annotations

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d

import loudness

SR = 48_000


def gain_curve(env: np.ndarray, ceiling: float, lookahead: int, release_db_s: float) -> np.ndarray:
    need = np.minimum(1.0, ceiling / np.maximum(env.astype(np.float64), 1e-12))
    hold = minimum_filter1d(need, size=2 * lookahead + 1, mode="nearest")
    g_db = 20 * np.log10(hold)
    rate = release_db_s / SR
    idx = np.arange(len(g_db), dtype=np.float64) * rate
    rel_db = np.minimum.accumulate(g_db - idx) + idx
    rel_db = np.minimum(rel_db, 0.0)
    rel = 10 ** (rel_db / 20)
    k = signal.windows.hann(2 * lookahead + 3)[1:-1]
    k /= k.sum()
    pad = np.pad(rel, lookahead, mode="edge")
    return signal.oaconvolve(pad, k, mode="valid")


def limit(x: np.ndarray, ceiling_db: float = -2.0, lookahead_ms: float = 4.0, release_db_s: float = 14.0,
          max_iter: int = 4, return_gain: bool = False):
    """Limit x (N, C) so its 4x-oversampled true peak stays at or below ceiling_db.
    Returns (y, info) with the gain-reduction statistics the mix report prints, plus the per-sample
    gain when return_gain is set (a bus limiter applies it to every stem on the bus)."""
    x = np.asarray(x, dtype=np.float32)
    L = max(1, int(round(lookahead_ms * 1e-3 * SR)))
    env = loudness.peak_envelope(x)
    target = 10 ** (ceiling_db / 20)
    c = target
    y = x
    g = np.ones(len(x))
    for it in range(max_iter):
        g = gain_curve(env, c, L, release_db_s)
        y = (x * g[:, None]).astype(np.float32)
        tp = loudness.true_peak(y)
        if tp <= ceiling_db + 0.005:
            break
        c *= 10 ** ((ceiling_db - tp - 0.01) / 20)
    gr = -20 * np.log10(np.maximum(g, 1e-12))
    info = {
        "ceilingDb": ceiling_db,
        "lookaheadMs": lookahead_ms,
        "releaseDbPerS": release_db_s,
        "iterations": it + 1,
        "maxGainReductionDb": round(float(gr.max()), 2),
        "pctTimeLimiting": round(100.0 * float(np.mean(gr > 0.1)), 2),
        "pctTimeOver1Db": round(100.0 * float(np.mean(gr > 1.0)), 3),
        "truePeakDb": round(loudness.true_peak(y), 2),
    }
    return (y, info, g) if return_gain else (y, info)
