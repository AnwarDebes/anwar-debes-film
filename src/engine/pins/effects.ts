// Ripples, presses and magnets (identity.md d.5), evaluated analytically at time t.
// In pins.js these terms are added to the spring's target, so the pins respond with lag and a
// little overshoot. Here the same filtering is done in closed form (presses), with a precomputed
// response table (ripples) or with a short quadrature of the spring's impulse response (magnets),
// so every term stays a pure function of t.

import type {Board} from './board';
import {colsInU, colsInUInto, rowsInV, rowsInVInto} from './board';
import {decayResponse, springKernel} from './spring';
import type {LiveLayer, Magnet, Press, Ripple} from './types';

/** The site's constants were tuned on a 104-column board; distances scale with density. */
const REF_COLS = 104;
const densityScale = (b: Board) => REF_COLS / b.cols;

// ---------------------------------------------------------------- ripples

/** The site's ring (pins.js): amplitude decay per second and lifetime. */
export const RIPPLE_DECAY = 1.8;
export const RIPPLE_LIFE = 2.2;
const RIPPLE_K = 1.4;
const KERNEL_SPAN = 0.7;

/**
 * A ripple that reads on film: slower and wider than the site's click ripple, so the pin spring
 * follows the ring instead of filtering it away, and it decays slowly enough to cross the frame.
 * Distances are board widths; spread it into a Ripple: {...FILM_RIPPLE, at, origin}.
 */
export const FILM_RIPPLE = {amp: 0.7, speed: 0.24, width: 0.034, decayPerS: 0.95, lifeS: 3.4} as const;

interface RippleTable {
  speed: number;
  width: number;
  decay: number;
  life: number;
  dStep: number;
  aStep: number;
  nd: number;
  na: number;
  data: Float32Array;
  /** front offset reach: the response is zero for d > speed * age + reach */
  reach: number;
}

const tables = new Map<string, RippleTable>();

// Spring-filtered response of one unit ripple at distance d and age a, tabulated once per style.
const rippleTable = (speed: number, width: number, decay: number, life: number): RippleTable => {
  const key = `${speed.toFixed(5)}|${width.toFixed(5)}|${decay.toFixed(4)}|${life.toFixed(3)}`;
  const hit = tables.get(key);
  if (hit) return hit;
  const {tau, w} = springKernel(20, KERNEL_SPAN);
  const reach = 4 * width;
  const ageMax = life + KERNEL_SPAN;
  const dMax = speed * life + reach + width;
  const dStep = width / 6;
  const aStep = 1 / 120;
  const nd = Math.ceil(dMax / dStep) + 2;
  const na = Math.ceil(ageMax / aStep) + 2;
  const data = new Float32Array(nd * na);
  for (let ia = 0; ia < na; ia++) {
    const age = ia * aStep;
    for (let id = 0; id < nd; id++) {
      const d = id * dStep;
      let acc = 0;
      for (let j = 0; j < tau.length; j++) {
        const a = age - tau[j];
        if (a < 0 || a > life) continue;
        const x = (d - speed * a) / width;
        if (x <= -4 || x >= 4) continue;
        // the ring fades out over its last 15% instead of stopping dead at the end of its life
        const fade = a > life * 0.85 ? (life - a) / (life * 0.15) : 1;
        acc += w[j] * Math.exp(-x * x) * Math.exp(-decay * a) * Math.cos(RIPPLE_K * x) * fade;
      }
      data[ia * nd + id] = acc;
    }
  }
  const tb = {speed, width, decay, life, dStep, aStep, nd, na, data, reach};
  tables.set(key, tb);
  return tb;
};

const sampleTable = (tb: RippleTable, d: number, age: number): number => {
  const fd = d / tb.dStep;
  const fa = age / tb.aStep;
  const id = fd | 0;
  const ia = fa | 0;
  if (id >= tb.nd - 1 || ia >= tb.na - 1 || id < 0 || ia < 0) return 0;
  const xd = fd - id;
  const xa = fa - ia;
  const row0 = ia * tb.nd + id;
  const row1 = row0 + tb.nd;
  const a = tb.data[row0] + (tb.data[row0 + 1] - tb.data[row0]) * xd;
  const b = tb.data[row1] + (tb.data[row1 + 1] - tb.data[row1]) * xd;
  return a + (b - a) * xa;
};

interface CompiledRipple {
  at: number;
  u: number;
  v: number;
  amp: number;
  tb: RippleTable;
  end: number;
}

// ---------------------------------------------------------------- presses

const PRESS_HEAL_S = 0.55;
const PRESS_GAIN = 0.6;
const PRESS_LIFE = 8 * PRESS_HEAL_S;

interface CompiledPress {
  at: number;
  idx: Int32Array;
  w: Float32Array;
}

// ---------------------------------------------------------------- magnets

const MAGNET_AMP_TAU = 0.2;
const MAGNET_TAPS = 16;

interface CompiledMagnet {
  m: Magnet;
  amp: number;
  sigma: number;
  end: number;
}

// ---------------------------------------------------------------- live layers

interface CompiledLive {
  layer: LiveLayer;
  idx: Int32Array | null;
}

export interface CompiledEffects {
  ripples: CompiledRipple[];
  presses: CompiledPress[];
  magnets: CompiledMagnet[];
  live: CompiledLive[];
}

export interface EffectInputs {
  ripples?: readonly Ripple[];
  presses?: readonly Press[];
  magnets?: readonly Magnet[];
  live?: readonly LiveLayer[];
}

export const compileEffects = (board: Board, input: EffectInputs): CompiledEffects => {
  const s = densityScale(board);
  const ripples = (input.ripples ?? []).map((r) => {
    const life = Math.max(0.1, r.lifeS ?? RIPPLE_LIFE);
    const tb = rippleTable(r.speed ?? 0.75 * s, r.width ?? 0.045 * s, Math.max(0, r.decayPerS ?? RIPPLE_DECAY), life);
    return {at: r.at, u: r.origin[0], v: r.origin[1], amp: r.amp ?? 0.08, tb, end: r.at + life + KERNEL_SPAN};
  });
  const presses = (input.presses ?? []).map((p) => {
    const idx: number[] = [];
    const ws: number[] = [];
    const r2 = p.radius * p.radius;
    const dv = p.radius / board.extH;
    const [r0, r1] = rowsInV(board, p.origin[1] - dv, p.origin[1] + dv);
    for (let r = r0; r <= r1; r++) {
      const [c0, c1] = colsInU(board, r, p.origin[0] - p.radius, p.origin[0] + p.radius);
      for (let c = c0; c <= c1; c++) {
        const i = board.rowStart[r] + c;
        const du = board.u[i] - p.origin[0];
        const dvv = (board.v[i] - p.origin[1]) * board.extH;
        const d2 = du * du + dvv * dvv;
        if (d2 >= r2) continue;
        const f = 1 - d2 / r2;
        idx.push(i);
        ws.push(f * f * p.depth);
      }
    }
    return {at: p.at, idx: Int32Array.from(idx), w: Float32Array.from(ws)};
  });
  const magnets = (input.magnets ?? []).map((m) => ({
    m,
    amp: m.amp ?? 0.95,
    sigma: m.sigma ?? 0.065 * s,
    end: m.to + 8 * MAGNET_AMP_TAU + KERNEL_SPAN,
  }));
  const live = (input.live ?? []).map((layer) => {
    if (!layer.region) return {layer, idx: null};
    const [u0, v0, u1, v1] = layer.region;
    const list: number[] = [];
    const [r0, r1] = rowsInV(board, v0, v1);
    for (let r = r0; r <= r1; r++) {
      const [c0, c1] = colsInU(board, r, u0, u1);
      for (let c = c0; c <= c1; c++) {
        const i = board.rowStart[r] + c;
        if (board.u[i] >= Math.min(u0, u1) && board.u[i] <= Math.max(u0, u1) && board.v[i] >= Math.min(v0, v1) && board.v[i] <= Math.max(v0, v1)) list.push(i);
      }
    }
    return {layer, idx: Int32Array.from(list)};
  });
  return {ripples, presses, magnets, live};
};

/** Magnet strength envelope (pins.js eases amplitude with tau 0.2 s). */
const magnetEnvelope = (m: Magnet, t: number): number => {
  if (t <= m.from) return 0;
  const rise = (x: number) => 1 - Math.exp(-x / MAGNET_AMP_TAU);
  if (t <= m.to) return rise(t - m.from);
  return rise(m.to - m.from) * Math.exp(-(t - m.to) / MAGNET_AMP_TAU);
};

const liveWeight = (l: LiveLayer, t: number): number => {
  const from = l.from ?? -Infinity;
  const to = l.to ?? Infinity;
  if (t < from || t > to) return 0;
  const fade = Math.max(1e-6, l.fadeS ?? 0.25);
  const a = Number.isFinite(from) ? Math.min(1, (t - from) / fade) : 1;
  const b = Number.isFinite(to) ? Math.min(1, (to - t) / fade) : 1;
  const w = Math.min(a, b);
  return w * w * (3 - 2 * w);
};

const kernel = springKernel(MAGNET_TAPS, KERNEL_SPAN);
// per-call scratch (no allocation per frame)
const magX = new Float64Array(MAGNET_TAPS);
const magY = new Float64Array(MAGNET_TAPS);
const magW = new Float64Array(MAGNET_TAPS);
const rowR = new Int32Array(2);
const colR = new Int32Array(2);

/** True when no effect or live layer can change the wall anywhere in [t0, t1]. */
export const effectsIdle = (fx: CompiledEffects, t0: number, t1: number): boolean => {
  for (const r of fx.ripples) if (r.at <= t1 && r.end >= t0) return false;
  for (const p of fx.presses) if (p.at <= t1 && p.at + PRESS_LIFE >= t0) return false;
  for (const m of fx.magnets) if (m.m.from <= t1 && m.end >= t0) return false;
  for (const l of fx.live) if (liveWeight(l.layer, t0) > 0 || liveWeight(l.layer, t1) > 0) return false;
  return true;
};

/** Largest height speed of the live layers at t (reliefs per second), from their hints. */
export const liveSpeed = (fx: CompiledEffects, t: number): number => {
  let s = 0;
  for (const l of fx.live) if (l.layer.speedHint && liveWeight(l.layer, t) > 0) s = Math.max(s, l.layer.speedHint(t));
  return s;
};

/** Add ripple, press and magnet heights at time t. */
export const applyHeightEffects = (board: Board, fx: CompiledEffects, relief: number, t: number, h: Float32Array) => {
  const {u, v, extH, rowStart} = board;

  for (const p of fx.presses) {
    const tau = t - p.at;
    if (tau <= 0 || tau > PRESS_LIFE) continue;
    const y = decayResponse(tau, 1 / PRESS_HEAL_S) * relief * PRESS_GAIN;
    const {idx, w} = p;
    for (let k = 0; k < idx.length; k++) h[idx[k]] += w[k] * y;
  }

  for (const r of fx.ripples) {
    const age = t - r.at;
    if (age <= 0 || t >= r.end) continue;
    const tb = r.tb;
    const outer = tb.speed * Math.min(age, tb.life) + tb.reach + tb.width;
    // the spring remembers the ring for KERNEL_SPAN seconds, so the band trails the front
    const inner = Math.max(0, tb.speed * (age - KERNEL_SPAN) - tb.reach - tb.width);
    const k = r.amp * relief;
    const dv = outer / extH;
    rowsInVInto(board, r.v - dv, r.v + dv, rowR);
    const r1 = rowR[1];
    const inner2 = inner * inner;
    const outer2 = outer * outer;
    for (let row = rowR[0]; row <= r1; row++) {
      colsInUInto(board, row, r.u - outer, r.u + outer, colR);
      const base = rowStart[row];
      const c1 = colR[1];
      for (let c = colR[0]; c <= c1; c++) {
        const i = base + c;
        const du = u[i] - r.u;
        const dvv = (v[i] - r.v) * extH;
        const d2 = du * du + dvv * dvv;
        if (d2 > outer2 || d2 < inner2) continue;
        h[i] += k * sampleTable(tb, Math.sqrt(d2), age);
      }
    }
  }

  for (const cm of fx.magnets) {
    const {m, sigma} = cm;
    if (t <= m.from || t >= cm.end) continue;
    let uMin = Infinity;
    let uMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    let live = 0;
    for (let j = 0; j < MAGNET_TAPS; j++) {
      const tj = t - kernel.tau[j];
      const env = magnetEnvelope(m, tj);
      const wj = kernel.w[j] * env * cm.amp;
      magW[j] = wj;
      if (wj === 0) continue;
      const [pu, pv] = m.path(Math.min(Math.max(tj, m.from), m.to));
      magX[j] = pu;
      magY[j] = pv;
      live++;
      if (pu < uMin) uMin = pu;
      if (pu > uMax) uMax = pu;
      if (pv < vMin) vMin = pv;
      if (pv > vMax) vMax = pv;
    }
    if (!live) continue;
    const reach = 3 * sigma;
    const reach2 = reach * reach;
    const inv2s2 = 1 / (2 * sigma * sigma);
    const k = relief;
    rowsInVInto(board, vMin - reach / extH, vMax + reach / extH, rowR);
    const r1 = rowR[1];
    for (let row = rowR[0]; row <= r1; row++) {
      colsInUInto(board, row, uMin - reach, uMax + reach, colR);
      const base = rowStart[row];
      const c1 = colR[1];
      for (let c = colR[0]; c <= c1; c++) {
        const i = base + c;
        const pu = u[i];
        const pv = v[i];
        let acc = 0;
        for (let j = 0; j < MAGNET_TAPS; j++) {
          const wj = magW[j];
          if (wj === 0) continue;
          const du = pu - magX[j];
          const dvv = (pv - magY[j]) * extH;
          const d2 = du * du + dvv * dvv;
          if (d2 < reach2) acc += wj * Math.exp(-d2 * inv2s2);
        }
        if (acc !== 0) h[i] += acc * k;
      }
    }
  }
};

/** Paint the live layers over the wall state at time t. */
export const applyLiveLayers = (
  board: Board,
  fx: CompiledEffects,
  relief: number,
  t: number,
  h: Float32Array,
  rgb: Float32Array | null,
  glow: Float32Array | null,
  paint: Float32Array | null,
) => {
  const {u, v, N} = board;
  for (const cl of fx.live) {
    const w = liveWeight(cl.layer, t);
    if (w <= 0) continue;
    const fn = cl.layer.fn;
    const add = cl.layer.mode === 'add';
    const idx = cl.idx;
    const n = idx ? idx.length : N;
    for (let k = 0; k < n; k++) {
      const i = idx ? idx[k] : k;
      const s = fn(u[i], v[i], i, t);
      if (!s) continue;
      const tint = s.tint;
      const tr = typeof tint === 'number' ? tint : tint[0];
      const tg = typeof tint === 'number' ? tint : tint[1];
      const tb = typeof tint === 'number' ? tint : tint[2];
      if (add) {
        h[i] += s.h * relief * w;
        if (rgb) {
          rgb[i * 3] *= 1 + (tr - 1) * w;
          rgb[i * 3 + 1] *= 1 + (tg - 1) * w;
          rgb[i * 3 + 2] *= 1 + (tb - 1) * w;
        }
        if (glow) glow[i] += (s.glow ?? 0) * w;
        if (paint && s.paint !== undefined) paint[i] += (s.paint - paint[i]) * w;
      } else {
        h[i] += (s.h * relief - h[i]) * w;
        if (rgb) {
          rgb[i * 3] += (tr - rgb[i * 3]) * w;
          rgb[i * 3 + 1] += (tg - rgb[i * 3 + 1]) * w;
          rgb[i * 3 + 2] += (tb - rgb[i * 3 + 2]) * w;
        }
        if (glow) glow[i] += ((s.glow ?? 0) - glow[i]) * w;
        if (paint) paint[i] += ((s.paint ?? 0) - paint[i]) * w;
      }
    }
  }
};
