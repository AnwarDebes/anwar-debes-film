"""loudness.py - ITU-R BS.1770-4 / EBU R128 measurement in numpy.

integrated(x)         gated programme loudness, LUFS
momentary(x)          400 ms loudness every video frame (60 per second by default), LUFS
short_term(x)         3 s loudness every video frame, LUFS
lra(x)                loudness range (EBU Tech 3342), LU
true_peak(x)          4x oversampled peak, dBTP
peak_envelope(x)      per-sample true-peak envelope (max over channels), linear; drives the limiter

Signals are float (N, C) at 48 kHz. Long signals are filtered in chunks with carried filter state,
so a whole film never needs a float64 copy in memory. ffmpeg's ebur128 filter is the independent
cross-check (audio_io.ff_ebur128); the mix report prints both.
"""
from __future__ import annotations

import numpy as np
from scipy import signal

SR = 48_000
CHUNK = 1 << 20
ABS_GATE = -70.0


def _kweight_sos(fs: int = SR) -> np.ndarray:
    """K-weighting (pre-filter shelf + RLB high-pass) for any rate; at 48 kHz this reproduces the
    coefficients printed in BS.1770-4."""
    # stage 1: high shelf
    G, Q, fc = 3.99984385397, 0.7071752369554193, 1681.974450955533
    K = np.tan(np.pi * fc / fs)
    Vh = 10 ** (G / 20)
    Vb = Vh ** 0.499666774155
    a0 = 1 + K / Q + K * K
    b_1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a_1 = [1.0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    # stage 2: RLB high-pass
    fc2, Q2 = 38.13547087613982, 0.5003270373253953
    K2 = np.tan(np.pi * fc2 / fs)
    d = 1 + K2 / Q2 + K2 * K2
    b_2 = [1.0, -2.0, 1.0]
    a_2 = [1.0, 2 * (K2 * K2 - 1) / d, (1 - K2 / Q2 + K2 * K2) / d]
    return np.array([b_1 + a_1, b_2 + a_2], dtype=np.float64)


_SOS = _kweight_sos()


def _as2d(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x)
    return x[:, None] if x.ndim == 1 else x


def block_power(x: np.ndarray, block: int = 800) -> np.ndarray:
    """Sum over channels of the K-weighted mean square in consecutive blocks of `block` samples
    (800 = one video frame at 60 fps). Returns shape (n_blocks,), incomplete tail dropped."""
    x = _as2d(x)
    n, ch = x.shape
    nb = n // block
    out = np.zeros(nb, dtype=np.float64)
    for c in range(ch):
        zi = np.zeros((_SOS.shape[0], 2))
        acc = np.empty(nb * block, dtype=np.float64)
        for s in range(0, nb * block, CHUNK):
            e = min(nb * block, s + CHUNK)
            y, zi = signal.sosfilt(_SOS, x[s:e, c].astype(np.float64), zi=zi)
            acc[s:e] = y * y
        out += acc.reshape(nb, block).sum(axis=1)
    return out / block


def _windowed(bp: np.ndarray, win: int, hop: int) -> np.ndarray:
    """Mean power over windows of `win` blocks every `hop` blocks (window ends at each hop)."""
    if len(bp) < win:
        return np.zeros(0)
    cs = np.concatenate([[0.0], np.cumsum(bp)])
    ends = np.arange(win, len(bp) + 1, hop)
    return (cs[ends] - cs[ends - win]) / win


def _lufs(p):
    return -0.691 + 10 * np.log10(np.maximum(p, 1e-20))


def integrated(x: np.ndarray, bp: np.ndarray | None = None, block: int = 800) -> float:
    """Gated integrated loudness: 400 ms blocks, 75 % overlap, -70 LUFS absolute and -10 LU
    relative gates. `block` must divide 100 ms (800 at 48 kHz)."""
    if bp is None:
        bp = block_power(x, block)
    per100 = int(round(0.1 * SR / block))
    z = _windowed(bp, 4 * per100, per100)
    if z.size == 0:
        return float("-inf")
    l = _lufs(z)
    z1 = z[l > ABS_GATE]
    if z1.size == 0:
        return float("-inf")
    rel = _lufs(z1.mean()) - 10.0
    z2 = z[(l > ABS_GATE) & (l > rel)]
    return float(_lufs(z2.mean())) if z2.size else float("-inf")


def momentary(x: np.ndarray, bp: np.ndarray | None = None, block: int = 800) -> np.ndarray:
    """Momentary loudness (400 ms) at the end of every block, LUFS. Leading values use a zero-padded window."""
    if bp is None:
        bp = block_power(x, block)
    win = int(round(0.4 * SR / block))
    padded = np.concatenate([np.zeros(win - 1), bp])
    return _lufs(_windowed(padded, win, 1))


def short_term(x: np.ndarray, bp: np.ndarray | None = None, block: int = 800) -> np.ndarray:
    """Short-term loudness (3 s) at the end of every block, LUFS (zero-padded at the start)."""
    if bp is None:
        bp = block_power(x, block)
    win = int(round(3.0 * SR / block))
    padded = np.concatenate([np.zeros(win - 1), bp])
    return _lufs(_windowed(padded, win, 1))


def lra(x: np.ndarray, bp: np.ndarray | None = None, block: int = 800) -> float:
    """Loudness range per EBU Tech 3342: 3 s windows every 100 ms, -70 absolute and -20 LU relative
    gates, 10th to 95th percentile."""
    if bp is None:
        bp = block_power(x, block)
    per100 = int(round(0.1 * SR / block))
    z = _windowed(bp, 30 * per100, per100)
    if z.size == 0:
        return 0.0
    l = _lufs(z)
    z1 = z[l > ABS_GATE]
    if z1.size == 0:
        return 0.0
    rel = _lufs(z1.mean()) - 20.0
    l2 = l[(l > ABS_GATE) & (l > rel)]
    if l2.size < 2:
        return 0.0
    return float(np.percentile(l2, 95) - np.percentile(l2, 10))


# 4x interpolation filter: 65 taps (odd, so the delay is a whole 32 oversampled points = 8 input
# samples), Kaiser-windowed sinc with its cutoff at the input Nyquist.
_OS_TAPS = 65
_OS_DELAY = (_OS_TAPS - 1) // 2
_OS_H = (signal.firwin(_OS_TAPS, 0.25, window=("kaiser", 7.0)) * 4.0).astype(np.float32)


def _oversample(seg: np.ndarray) -> np.ndarray:
    """4x oversampled copy of seg (n, C), aligned so row 4i is input sample i."""
    y = signal.upfirdn(_OS_H, seg, up=4, axis=0)
    return y[_OS_DELAY:_OS_DELAY + 4 * seg.shape[0]]


def peak_envelope(x: np.ndarray) -> np.ndarray:
    """Per-sample true-peak envelope (linear, max over channels): the largest |value| of the 4x
    oversampled signal in the two input intervals around each sample, (n-1, n+1)."""
    x = _as2d(x)
    n = x.shape[0]
    out = np.empty(n, dtype=np.float32)
    pad = 32
    for s in range(0, n, CHUNK):
        e = min(n, s + CHUNK)
        a, b = max(0, s - pad), min(n, e + pad)
        os_ = np.abs(_oversample(x[a:b].astype(np.float32))).max(axis=1)
        per = os_.reshape(-1, 4).max(axis=1)              # interval [i, i+1) for each input sample i
        prev = np.concatenate([[per[0]], per[:-1]])        # interval [i-1, i)
        both = np.maximum(per, prev)
        out[s:e] = both[s - a:e - a]
    return out


def true_peak(x: np.ndarray) -> float:
    """True peak in dBTP (max over channels) via 4x oversampling."""
    x = _as2d(x)
    n = x.shape[0]
    m = 0.0
    pad = 32
    for s in range(0, n, CHUNK):
        e = min(n, s + CHUNK)
        a, b = max(0, s - pad), min(n, e + pad)
        os_ = _oversample(x[a:b].astype(np.float32))
        lo, hi = (s - a) * 4, (e - a) * 4
        m = max(m, float(np.abs(os_[lo:hi]).max()))
    return 20 * np.log10(max(m, 1e-12))


def sample_peak(x: np.ndarray) -> float:
    return 20 * np.log10(max(float(np.abs(x).max()), 1e-12))


def stats(x: np.ndarray, tp: bool = True) -> dict:
    """Integrated, LRA, true peak, sample peak, max momentary and max short-term in one pass.
    tp=False skips the oversampled peak (reported as null) for stems that are never delivered."""
    bp = block_power(x)
    m = momentary(x, bp)
    st = short_term(x, bp)
    return {
        "I": round(integrated(x, bp), 2),
        "LRA": round(lra(x, bp), 2),
        "TP": round(float(true_peak(x)), 2) if tp else None,
        "SP": round(float(sample_peak(x)), 2),
        "Mmax": round(float(m.max()) if m.size else float("-inf"), 2),
        "Smax": round(float(st.max()) if st.size else float("-inf"), 2),
    }


def event_level(x: np.ndarray) -> float:
    """Loudness of a short event: its maximum momentary (400 ms) loudness, LUFS. Short sounds are
    zero-padded so a 30 ms tick is measured over the ear's integration window, not its own length."""
    x = _as2d(x)
    pad = np.zeros((int(0.4 * SR), x.shape[1]), dtype=x.dtype)
    y = np.concatenate([pad, x, pad])
    bp = block_power(y, 400)
    win = int(round(0.4 * SR / 400))
    z = _windowed(bp, win, 1)
    return float(_lufs(z.max())) if z.size else float("-inf")
