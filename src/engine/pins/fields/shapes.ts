import {noise3D} from '@remotion/noise';
import type {Board} from '../board';
import {STEEL} from '../timeline';
import type {FieldFn, PinSample, RGB} from '../types';
import {smooth01} from './place';

// Shapes in pins. Centres are board uv; sizes are pin pitches. Edges are antialiased over
// `soft` pins so outlines read as slopes, like the emblems. All of it is pure.

export interface Look {
  /** Height in reliefs. */
  h?: number;
  tint?: number | RGB;
  glow?: number;
  paint?: number;
}

export interface ShapeOptions extends Look {
  /** Ground outside the shape (default: flat steel). Pass a field to draw over a picture. */
  ground?: FieldFn | number;
  /** Edge softness in pins (default 0.6). */
  soft?: number;
}

const groundOf = (g: FieldFn | number | undefined): FieldFn => {
  if (typeof g === 'function') return g;
  const s: PinSample = {h: 0, tint: g ?? STEEL};
  return () => s;
};

const tint3 = (t: number | RGB): RGB => (typeof t === 'number' ? [t, t, t] : t);

/** Blend a look over a ground sample with coverage a (0..1). */
export const cover = (base: PinSample, look: Look, a: number): PinSample => {
  if (a <= 0) return base;
  const tb = tint3(base.tint);
  const tl = tint3(look.tint ?? 1);
  return {
    h: base.h + ((look.h ?? 0.5) - base.h) * a,
    tint: [tb[0] + (tl[0] - tb[0]) * a, tb[1] + (tl[1] - tb[1]) * a, tb[2] + (tl[2] - tb[2]) * a],
    glow: (base.glow ?? 0) + ((look.glow ?? 0) - (base.glow ?? 0)) * a,
    paint: (base.paint ?? 0) + ((look.paint ?? 0) - (base.paint ?? 0)) * a,
  };
};

/** Signed distance in pins from a uv point to a shape -> coverage. */
const coverage = (sd: number, soft: number) => smooth01(0.5 - sd / Math.max(1e-3, soft));

/** Pins from uv offsets. */
const toPins = (b: Board, du: number, dv: number): [number, number] => [du / b.p, (dv * b.extH) / b.p];

export const rectField = (
  board: Board,
  r: {u: number; v: number; w: number; h: number; radius?: number},
  opts: ShapeOptions = {},
): FieldFn => {
  const ground = groundOf(opts.ground);
  const soft = opts.soft ?? 0.6;
  const rad = r.radius ?? 0;
  const hx = r.w / 2 - rad;
  const hy = r.h / 2 - rad;
  return (u, v, i) => {
    const [px, py] = toPins(board, u - r.u, v - r.v);
    const qx = Math.abs(px) - hx;
    const qy = Math.abs(py) - hy;
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
    const g = ground(u, v, i);
    return sd > soft ? g : cover(g, opts, coverage(sd, soft));
  };
};

export const circleField = (board: Board, c: {u: number; v: number; r: number}, opts: ShapeOptions = {}): FieldFn => {
  const ground = groundOf(opts.ground);
  const soft = opts.soft ?? 0.6;
  return (u, v, i) => {
    const [px, py] = toPins(board, u - c.u, v - c.v);
    const sd = Math.hypot(px, py) - c.r;
    const g = ground(u, v, i);
    return sd > soft ? g : cover(g, opts, coverage(sd, soft));
  };
};

/**
 * A horizontal rule of lit pins (the reel's "one rule"): `rows` hex rows centred on v, from u0
 * to u1. Defaults to a glowing, slightly raised line across the whole wall.
 */
export const ruleLineField = (
  board: Board,
  line: {v: number; u0?: number; u1?: number; rows?: number},
  opts: ShapeOptions = {},
): FieldFn => {
  const ground = groundOf(opts.ground);
  const look: Look = {h: opts.h ?? 0.08, tint: opts.tint ?? 1.0, glow: opts.glow ?? 1, paint: opts.paint};
  const u0 = line.u0 ?? -1;
  const u1 = line.u1 ?? 2;
  const half = ((line.rows ?? 1) * board.rowH) / 2;
  const cy = line.v * board.extH;
  return (u, v, i) => {
    const g = ground(u, v, i);
    if (u < u0 || u > u1) return g;
    const dy = Math.abs(v * board.extH - cy);
    // whole rows only: a pin is on the line when its row centre is within the band
    return dy <= half + 1e-9 ? cover(g, look, 1) : g;
  };
};

/**
 * A grid of tiles (the reel's 13 x 7 hypothesis grid). `cell` is the tile pitch in pins, `gap`
 * the gutter. `tile(c, r)` returns the look of each tile (null leaves it as ground).
 */
export const tileGridField = (
  board: Board,
  grid: {u: number; v: number; cols: number; rows: number; cell: number; gap?: number; radius?: number},
  tile: (c: number, r: number) => Look | null,
  opts: ShapeOptions = {},
): FieldFn => {
  const ground = groundOf(opts.ground);
  const soft = opts.soft ?? 0.6;
  const gap = grid.gap ?? 1;
  const size = grid.cell - gap;
  const rad = grid.radius ?? size * 0.18;
  const W = grid.cols * grid.cell;
  const H = grid.rows * grid.cell;
  return (u, v, i) => {
    const g = ground(u, v, i);
    const [px, py] = toPins(board, u - grid.u, v - grid.v);
    const lx = px + W / 2;
    const ly = H / 2 - py; // rows count from the top
    const c = Math.floor(lx / grid.cell);
    const r = Math.floor(ly / grid.cell);
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return g;
    const look = tile(c, r);
    if (!look) return g;
    const qx = Math.abs(lx - (c + 0.5) * grid.cell) - (size / 2 - rad);
    const qy = Math.abs(ly - (r + 0.5) * grid.cell) - (size / 2 - rad);
    const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
    return sd > soft ? g : cover(g, look, coverage(sd, soft));
  };
};

/**
 * Bars rising from a baseline (values 0..1 -> bar heights in pins). `x` spans the chart width in
 * pins, centred on (u, v) as the chart's centre.
 */
export const barsField = (
  board: Board,
  chart: {u: number; v: number; width: number; height: number; values: readonly number[]; gap?: number},
  opts: ShapeOptions & {looks?: (k: number, value: number) => Look} = {},
): FieldFn => {
  const ground = groundOf(opts.ground);
  const soft = opts.soft ?? 0.6;
  const n = chart.values.length;
  const pitch = chart.width / n;
  const gap = chart.gap ?? Math.max(1, pitch * 0.25);
  return (u, v, i) => {
    const g = ground(u, v, i);
    const [px, py] = toPins(board, u - chart.u, v - chart.v);
    const lx = px + chart.width / 2;
    const ly = py + chart.height / 2;
    const k = Math.floor(lx / pitch);
    if (k < 0 || k >= n || ly < -soft) return g;
    const val = Math.max(0, Math.min(1, chart.values[k]));
    const top = val * chart.height;
    const qx = Math.abs(lx - (k + 0.5) * pitch) - (pitch - gap) / 2;
    const qy = Math.abs(ly - top / 2) - top / 2;
    const sd = Math.max(qx, qy);
    if (sd > soft) return g;
    const look = opts.looks ? opts.looks(k, val) : {h: opts.h ?? 0.35 + 0.5 * val, tint: opts.tint ?? 1.0, glow: opts.glow};
    return cover(g, look, coverage(sd, soft));
  };
};

/**
 * Seeded simplex noise over the wall (dissolves, sea, texture). `scale` is the feature size in
 * pins; `z` scrolls through the noise (use different z per beat for a new pattern).
 */
export const noiseField = (
  board: Board,
  opts: {seed?: string; scale?: number; z?: number; h?: number; base?: number; tint?: [number, number]; octaves?: number} = {},
): FieldFn => {
  const seed = opts.seed ?? 'wall';
  const scale = opts.scale ?? 9;
  const z = opts.z ?? 0;
  const hk = opts.h ?? 0.3;
  const base = opts.base ?? 0;
  const [t0, t1] = opts.tint ?? [0.6, 0.95];
  const oct = Math.max(1, opts.octaves ?? 2);
  return (u, v) => {
    const x = u / board.p / scale;
    const y = (v * board.extH) / board.p / scale;
    let n = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      n += amp * noise3D(seed, x * f, y * f, z + o * 17.3);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    const k = 0.5 + 0.5 * (n / norm);
    return {h: base + hk * k, tint: t0 + (t1 - t0) * k};
  };
};

/** The black box: a raised square of dark pins (its edge shafts form the sides). */
export const blackBoxField = (
  board: Board,
  box: {u: number; v: number; size: number; h?: number; tint?: number},
  opts: {ground?: FieldFn | number} = {},
): FieldFn => rectField(board, {u: box.u, v: box.v, w: box.size, h: box.size}, {h: box.h ?? 0.42, tint: box.tint ?? 0.3, soft: 0.35, ground: opts.ground});
