// Entrance and exit by pixel squares (the promo's precedent: scattered coral
// squares converge into idle Pixie). A frozen frame of device rects is cut along
// the scene-cell grid into u x u blocks. In flight a block is one whole square
// of its dominant colour. The squares land as a coarse mosaic of Pixie, which
// then resolves in a single frame into the exact clipped rects (painter's order
// kept): the blocks at rest re-compose the frame pixel for pixel, so the
// hand-off to the live renderer is invisible. Exit is the reverse: the frame
// turns into its mosaic at once, then the squares fly. Mostly empty blocks
// (slivers of an edge) never fly; they exist only in the exact frame.

import {random} from 'remotion';
import type {Part} from './pixie-core';

/** Device rect: integer px inside Pixie's box. */
export type DeviceRect = [number, number, number, number, string, Part];

export interface PixelBlock {
  /** Top-left of the block's grid cell, in box px. */
  x: number;
  y: number;
  /** Clipped rects in painter's order, in box px. */
  rects: Array<[number, number, number, number, string]>;
  /** Colour covering most of the cell (the square drawn in flight). */
  fill: string;
  /** Covered fraction of the u x u cell. */
  coverage: number;
}

/** Blocks covering less than this fraction of their cell resolve in place instead of flying. */
export const MIN_FLIGHT_COVERAGE = 0.4;

export interface Decomposition {
  blocks: PixelBlock[];
  /** The floor shadow is not a solid pixel: it fades in place instead of flying. */
  shadow: DeviceRect[];
  /** Point the blocks gather around (the creature's centre), in box px. */
  cx: number;
  cy: number;
}

export function decompose(dev: readonly DeviceRect[], u: number): Decomposition {
  const cells = new Map<number, PixelBlock>();
  const shadow: DeviceRect[] = [];
  const KEY = 4096;
  for (const r of dev) {
    const [x, y, w, h, c, p] = r;
    if (p === 'shadow') {
      shadow.push(r);
      continue;
    }
    if (w <= 0 || h <= 0) continue;
    const i0 = Math.floor(x / u);
    const i1 = Math.floor((x + w - 1) / u);
    const j0 = Math.floor(y / u);
    const j1 = Math.floor((y + h - 1) / u);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const bx = i * u;
        const by = j * u;
        const x0 = Math.max(x, bx);
        const y0 = Math.max(y, by);
        const x1 = Math.min(x + w, bx + u);
        const y1 = Math.min(y + h, by + u);
        if (x1 <= x0 || y1 <= y0) continue;
        const key = (j + KEY / 2) * KEY + (i + KEY / 2);
        let b = cells.get(key);
        if (!b) {
          b = {x: bx, y: by, rects: [], fill: c, coverage: 0};
          cells.set(key, b);
        }
        b.rects.push([x0, y0, x1 - x0, y1 - y0, c]);
      }
    }
  }
  // Stable order: rows top to bottom, then left to right.
  const blocks = [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  // Dominant colour and coverage: the top-most rect per px, counted over the cell.
  const top = new Int16Array(u * u);
  for (const b of blocks) {
    top.fill(-1);
    b.rects.forEach(([x, y, w, h], k) => {
      for (let yy = y - b.y; yy < y - b.y + h; yy++) top.fill(k, yy * u + (x - b.x), yy * u + (x - b.x) + w);
    });
    const count = new Map<string, number>();
    let covered = 0;
    for (let q = 0; q < top.length; q++) {
      if (top[q] < 0) continue;
      covered++;
      const c = b.rects[top[q]][4];
      count.set(c, (count.get(c) ?? 0) + 1);
    }
    let best = b.rects[0][4];
    let most = -1;
    for (const [c, n] of count) {
      if (n > most) {
        best = c;
        most = n;
      }
    }
    b.fill = best;
    b.coverage = covered / (u * u);
  }
  return {blocks, shadow, cx: 17 * u, cy: 14 * u};
}

// ---------------------------------------------------------------- motion
/** Per-block timings (seconds) and far offsets (px), drawn once from the seed. */
export interface ScatterPlan {
  mode: 'assemble' | 'disperse';
  duration: number;
  n: number;
  a: Float64Array; // assemble: fade-in start; disperse: departure
  b: Float64Array; // assemble: pull start;    disperse: arrival at the far point
  c: Float64Array; // assemble: landing
  fx: Float64Array;
  fy: Float64Array;
}

export interface BlockState {
  dx: number;
  dy: number;
  opacity: number;
  /** true: draw the exact clipped rects (at rest); false: one square of the dominant colour. */
  exact: boolean;
}

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;

/**
 * The far point of block k: its own position pushed out from the creature's
 * centre (1.75-3.1x across, 1.6-2.7x down) plus jitter, so the cloud reads as a
 * loose, wider-than-tall version of Pixie rather than random noise.
 */
function plan(d: Decomposition, u: number, seed: string, mode: ScatterPlan['mode'], duration: number): ScatterPlan {
  const n = d.blocks.length;
  const p: ScatterPlan = {
    mode,
    duration,
    n,
    a: new Float64Array(n),
    b: new Float64Array(n),
    c: new Float64Array(n),
    fx: new Float64Array(n),
    fy: new Float64Array(n),
  };
  const D = duration;
  for (let k = 0; k < n; k++) {
    const r = (name: string) => random(`${seed}-${mode}-${k}-${name}`);
    const blk = d.blocks[k];
    const px = blk.x + u / 2 - d.cx;
    const py = blk.y + u / 2 - d.cy;
    const m = 0.6 + 1.1 * r('m');
    const ang = r('ang') * Math.PI * 2;
    const jit = (0.15 + 0.85 * Math.sqrt(r('jit'))) * 7 * u;
    p.fx[k] = px * m * 1.25 + Math.cos(ang) * jit * 1.3;
    p.fy[k] = py * m + Math.sin(ang) * jit * 0.85;
    if (mode === 'assemble') {
      p.a[k] = r('in') * 0.26 * D;
      p.b[k] = 0.2 * D + r('go') * 0.2 * D;
      p.c[k] = D * (0.74 + 0.18 * r('land'));
    } else {
      // A short hold on the mosaic, then staggered departures.
      p.a[k] = 0.07 * D + r('go') * 0.25 * D;
      p.b[k] = D * (0.8 + 0.2 * r('end'));
    }
  }
  return p;
}

export const planAssemble = (d: Decomposition, u: number, seed: string, duration = 1.2) =>
  plan(d, u, seed, 'assemble', duration);

export const planDisperse = (d: Decomposition, u: number, seed: string, duration = 0.8) =>
  plan(d, u, seed, 'disperse', duration);

const HIDDEN: BlockState = {dx: 0, dy: 0, opacity: 0, exact: false};
const AT_REST: BlockState = {dx: 0, dy: 0, opacity: 1, exact: true};

/**
 * Block k at `s` seconds into its plan. Offsets are whole px, so squares stay
 * crisp. `flies` is false for sliver blocks, which only exist in the exact frame.
 */
export function blockAt(p: ScatterPlan, k: number, s: number, flies = true): BlockState {
  if (p.mode === 'assemble') {
    if (s >= p.duration) return AT_REST;
    if (!flies) return HIDDEN;
    const land = p.c[k];
    if (s >= land) return {dx: 0, dy: 0, opacity: 1, exact: false};
    const start = p.b[k];
    const opacity = easeOutCubic(clamp01((s - p.a[k]) / (0.14 * p.duration)));
    const e = easeInOutCubic(clamp01((s - start) / (land - start)));
    // A slow outward drift while the cloud gathers, easing to rest as the pull begins.
    const drift = 1 + 0.06 * easeOutCubic(clamp01(s / start));
    const k1 = drift * (1 - e);
    return {dx: Math.round(p.fx[k] * k1), dy: Math.round(p.fy[k] * k1), opacity, exact: false};
  }
  if (s < 0) return AT_REST;
  if (!flies) return HIDDEN;
  const start = p.a[k];
  const end = p.b[k];
  const e = easeInCubic(clamp01((s - start) / (end - start)));
  const fade = clamp01((s - start - 0.2 * p.duration) / (end - start - 0.2 * p.duration));
  return {dx: Math.round(p.fx[k] * e), dy: Math.round(p.fy[k] * e), opacity: 1 - easeInCubic(fade), exact: false};
}

/** Shadow opacity during assembly (fades in under the landing creature). */
export const assembleShadow = (s: number, duration = 1.2) =>
  easeInOutCubic(clamp01((s - 0.55 * duration) / (0.45 * duration)));

/** Shadow opacity during dispersal. */
export const disperseShadow = (s: number, duration = 0.8) => 1 - easeOutCubic(clamp01(s / (0.35 * duration)));
