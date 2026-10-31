// Beats -> per-pin arrays, computed once (identity.md d.6). Evaluating the wall at time t is then
// a sum of closed-form spring steps over these arrays (see evaluator.ts).

import type {Board} from './board';
import {hash01, seedOf} from './hash';
import {SETTLE_S, easeSettle} from './spring';
import type {Beat, FieldFn, PinSample, Sweep} from './types';

/** Resting steel tint (pins.js). */
export const STEEL = 0.9;
/** Default relief for h = 1, in pin pitches (about the reel's portrait relief). */
export const DEFAULT_RELIEF_PITCHES = 22;
/** Tallest allowed height, as a fraction of the relief. */
export const MAX_H = 1.35;
export const TINT_TAU_S = 0.22;
export const GLOW_TAU_S = 0.15;

export interface PinState {
  /** Heights, world units. */
  T: Float32Array;
  /** Tint, rgb interleaved (3N). */
  C: Float32Array;
  G: Float32Array;
  P: Float32Array;
}

export interface CompiledBeat extends PinState {
  id: string;
  at: number;
  index: number;
  /** Height release time per pin, seconds. */
  R: Float32Array;
  rMin: number;
  rMax: number;
  /** Tint/glow release per pin when the tint follows the wave; null when it switches at `at`. */
  PR: Float32Array | null;
  paintMax: number;
  tintTau: number;
  glowTau: number;
  /** From this time on the beat has fully arrived. */
  settledAt: number;
  /** Which channels differ from the previous state (skips idle loops). */
  changes: {h: boolean; c: boolean; g: boolean; p: boolean};
  sweep: Sweep | undefined;
}

export interface WallTimeline {
  board: Board;
  relief: number;
  init: PinState;
  beats: CompiledBeat[];
  /** prefixSettled[e] = latest settledAt among beats 0..e */
  prefixSettled: Float64Array;
}

const flatState = (N: number): PinState => ({
  T: new Float32Array(N),
  C: new Float32Array(N * 3).fill(STEEL),
  G: new Float32Array(N),
  P: new Float32Array(N),
});

const writeSample = (s: PinSample, i: number, relief: number, st: PinState) => {
  const h = s.h > MAX_H ? MAX_H : s.h < 0 ? 0 : s.h;
  st.T[i] = h * relief;
  const t = s.tint;
  if (typeof t === 'number') {
    st.C[i * 3] = t;
    st.C[i * 3 + 1] = t;
    st.C[i * 3 + 2] = t;
  } else {
    st.C[i * 3] = t[0];
    st.C[i * 3 + 1] = t[1];
    st.C[i * 3 + 2] = t[2];
  }
  st.G[i] = s.glow ?? 0;
  st.P[i] = s.paint ?? 0;
};

/** Sample a field over every pin of the board. */
export const sampleField = (board: Board, field: FieldFn, relief: number): PinState => {
  const st = flatState(board.N);
  const {u, v} = board;
  for (let i = 0; i < board.N; i++) writeSample(field(u[i], v[i], i), i, relief, st);
  return st;
};

const differs = (a: Float32Array, b: Float32Array): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
};

const releaseTimes = (board: Board, beat: Beat, seed: number): Float32Array => {
  const {N, u, v, extH} = board;
  const R = new Float32Array(N);
  const sw = beat.sweep;
  if (!sw) {
    R.fill(beat.at);
    return R;
  }
  const delay = Math.max(0, sw.delayS ?? 0);
  const jitter = Math.max(0, sw.jitterS ?? 0.06);
  const speed = Math.max(1e-4, sw.speed);
  const [ou, ov] = sw.origin;
  const t0 = beat.at + delay;
  const kind = sw.kind ?? 'radial';
  if (kind === 'linear') {
    const [dx0, dy0] = sw.direction ?? [1, 0];
    // direction is given in uv; distances are measured in board widths
    const wx = dx0;
    const wy = dy0 * extH;
    const len = Math.hypot(wx, wy) || 1;
    const nx = wx / len;
    const ny = wy / len;
    for (let i = 0; i < N; i++) {
      const d = Math.max(0, (u[i] - ou) * nx + (v[i] - ov) * extH * ny);
      R[i] = t0 + d / speed + hash01(seed, i) * jitter;
    }
  } else if (kind === 'random') {
    const spread = Math.max(0, sw.spreadS ?? 0.9);
    const seed2 = (seed ^ 0x5bd1e995) >>> 0;
    for (let i = 0; i < N; i++) R[i] = t0 + hash01(seed2, i) * spread + hash01(seed, i) * jitter;
  } else {
    for (let i = 0; i < N; i++) {
      const d = Math.hypot(u[i] - ou, (v[i] - ov) * extH);
      R[i] = t0 + d / speed + hash01(seed, i) * jitter;
    }
  }
  return R;
};

const compileBeat = (board: Board, beat: Beat, index: number, relief: number, prev: PinState): CompiledBeat => {
  const st = sampleField(board, beat.field, relief);
  const seed = seedOf(`${beat.id}#${index}`);
  const R = releaseTimes(board, beat, seed);
  let rMin = Infinity;
  let rMax = -Infinity;
  for (let i = 0; i < R.length; i++) {
    const r = R[i];
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
  }
  const follows = !!beat.sweep?.tintFollowsWave;
  const lead = follows ? Math.max(0, beat.sweep?.tintLeadS ?? 0) : 0;
  let PR: Float32Array | null = null;
  let paintMax = beat.at;
  if (follows && lead > 0) {
    // tint first, then height: the paint wave runs `lead` ahead, never before the beat starts
    PR = new Float32Array(R.length);
    for (let i = 0; i < R.length; i++) {
      const r = R[i] - lead;
      PR[i] = r > beat.at ? r : beat.at;
      if (PR[i] > paintMax) paintMax = PR[i];
    }
  } else if (follows) {
    PR = R;
    paintMax = rMax;
  }
  const tintTau = beat.tintTauS ?? TINT_TAU_S;
  const glowTau = Math.min(tintTau, GLOW_TAU_S);
  const changes = {h: differs(st.T, prev.T), c: differs(st.C, prev.C), g: differs(st.G, prev.G), p: differs(st.P, prev.P)};
  const settledAt = Math.max(
    changes.h ? rMax + SETTLE_S : beat.at,
    changes.c || changes.p ? paintMax + easeSettle(tintTau) : beat.at,
    changes.g ? paintMax + easeSettle(glowTau) : beat.at,
  );
  return {...st, id: beat.id, at: beat.at, index, R, rMin, rMax, PR, paintMax, tintTau, glowTau, settledAt, changes, sweep: beat.sweep};
};

const cache = new WeakMap<readonly Beat[], Map<string, WallTimeline>>();

/**
 * Compile a beat list for a board. The wall starts as flat steel; every beat transitions from the
 * state before it. To start on a settled picture, give the first beat a negative `at` (or use
 * `settledBeat`). Cached by the identity of the beats array, so HTML layers and the PinWall can
 * share one compiled timeline.
 */
export const compileWall = (board: Board, beats: readonly Beat[], relief?: number): WallTimeline => {
  const rel = relief ?? DEFAULT_RELIEF_PITCHES * board.p;
  const key = `${board.key}|${rel}`;
  let byKey = cache.get(beats);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const sorted = [...beats].sort((a, b) => a.at - b.at);
  const init = flatState(board.N);
  const compiled: CompiledBeat[] = [];
  let prev: PinState = init;
  for (let e = 0; e < sorted.length; e++) {
    const cb = compileBeat(board, sorted[e], e, rel, prev);
    compiled.push(cb);
    prev = cb;
  }
  const prefixSettled = new Float64Array(compiled.length);
  let m = -Infinity;
  for (let e = 0; e < compiled.length; e++) {
    m = Math.max(m, compiled[e].settledAt);
    prefixSettled[e] = m;
  }
  const tl: WallTimeline = {board, relief: rel, init, beats: compiled, prefixSettled};
  if (!byKey) {
    byKey = new Map();
    cache.set(beats, byKey);
  }
  byKey.set(key, tl);
  return tl;
};

/** A beat that has always been there: the wall starts on this field, settled. */
export const settledBeat = (id: string, field: FieldFn): Beat => ({id, at: -1000, field});

/** The compiled beat with this id. */
export const beatById = (tl: WallTimeline, id: string): CompiledBeat | undefined => tl.beats.find((b) => b.id === id);

/** Which release a count follows: the height, the paint (tint/glow), or whichever comes first. */
export type ReleaseKind = 'height' | 'paint' | 'first';

/**
 * How many pins matching `pick` have been released by beat `id` at time t: a live count for
 * captions that tick up as a sweep passes ("show its work"). `pick` is a per-pin 0/1 array or a
 * predicate; pass the same object every frame (it keys a cache). `which` picks the wave that is
 * counted: 'height' (default, the pins moving), 'paint' (the tint wave), or 'first' (whichever
 * reaches a pin first).
 */
export const releasedCount = (
  tl: WallTimeline,
  id: string,
  t: number,
  pick?: ArrayLike<number> | ((i: number) => boolean),
  which: ReleaseKind = 'height',
): number => {
  const b = beatById(tl, id);
  if (!b) return 0;
  const key = pick ?? null;
  let byPick = releaseIndex.get(b);
  if (!byPick) {
    byPick = new Map();
    releaseIndex.set(b, byPick);
  }
  let byKind = byPick.get(key);
  if (!byKind) {
    byKind = new Map();
    byPick.set(key, byKind);
  }
  let sorted = byKind.get(which);
  if (!sorted) {
    const test = typeof pick === 'function' ? pick : pick ? (i: number) => pick[i] !== 0 : () => true;
    // without a paint wave every pin's tint switches at the beat time
    const PR = b.PR;
    const at =
      which === 'paint'
        ? (i: number) => (PR ? PR[i] : b.at)
        : which === 'first' && PR
          ? (i: number) => Math.min(b.R[i], PR[i])
          : (i: number) => b.R[i];
    const list: number[] = [];
    for (let i = 0; i < b.R.length; i++) if (test(i)) list.push(at(i));
    sorted = Float32Array.from(list).sort();
    byKind.set(which, sorted);
  }
  // binary search: count of release times <= t
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const releaseIndex = new WeakMap<CompiledBeat, Map<ArrayLike<number> | ((i: number) => boolean) | null, Map<ReleaseKind, Float32Array>>>();
