// World-space geometry for diagrams: routes with rounded corners, arc-length tables,
// and outlines. Everything is built once per layout (useMemo) and read every frame.

import type {Box} from './types';

/** A sampled polyline with cumulative arc length: xy = [x0, y0, x1, y1, ...]. */
export interface ArcTable {
  xy: Float64Array;
  len: Float64Array;
  total: number;
}

export const arcTable = (xy: Float64Array): ArcTable => {
  const n = xy.length / 2;
  const len = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    len[i] = len[i - 1] + Math.hypot(xy[2 * i] - xy[2 * i - 2], xy[2 * i + 1] - xy[2 * i - 1]);
  }
  return {xy, len, total: n ? len[n - 1] : 0};
};

/**
 * Replaces each interior corner of a polyline by a fillet of radius r (clamped so two
 * neighbouring fillets never overlap), sampled with `segs` steps.
 */
export const roundedRoute = (pts: Array<[number, number]>, r: number, segs = 10): Float64Array => {
  if (pts.length < 3) return Float64Array.from(pts.flat());
  const out: number[] = [pts[0][0], pts[0][1]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay);
    const l2 = Math.hypot(cx - bx, cy - by);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 0.5) {
      out.push(bx, by);
      continue;
    }
    const ux = (bx - ax) / l1;
    const uy = (by - ay) / l1;
    const vx = (cx - bx) / l2;
    const vy = (cy - by) / l2;
    const sx = bx - ux * rr;
    const sy = by - uy * rr;
    const ex = bx + vx * rr;
    const ey = by + vy * rr;
    // circular arc tangent to both segments (exact for right angles, close for others)
    const turn = ux * vy - uy * vx;
    const dot = ux * vx + uy * vy;
    const ang = Math.atan2(Math.abs(turn), dot);
    if (ang < 1e-3) {
      out.push(bx, by);
      continue;
    }
    const rad = rr / Math.tan(ang / 2);
    const nx = turn > 0 ? -uy : uy;
    const ny = turn > 0 ? ux : -ux;
    const ox = sx + nx * rad;
    const oy = sy + ny * rad;
    const a0 = Math.atan2(sy - oy, sx - ox);
    let a1 = Math.atan2(ey - oy, ex - ox);
    if (turn > 0 && a1 < a0) a1 += Math.PI * 2;
    if (turn < 0 && a1 > a0) a1 -= Math.PI * 2;
    out.push(sx, sy);
    for (let k = 1; k < segs; k++) {
      const a = a0 + ((a1 - a0) * k) / segs;
      out.push(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad);
    }
    out.push(ex, ey);
  }
  const last = pts[pts.length - 1];
  out.push(last[0], last[1]);
  return Float64Array.from(out);
};

/** Point and unit tangent at arc length s (clamped). */
export const pointAt = (t: ArcTable, s: number, out: Float64Array): Float64Array => {
  const {xy, len} = t;
  const n = len.length;
  if (n === 0) return out;
  const v = Math.max(0, Math.min(t.total, s));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (len[mid] < v) lo = mid;
    else hi = mid;
  }
  const seg = len[hi] - len[lo] || 1;
  const f = (v - len[lo]) / seg;
  const x0 = xy[2 * lo];
  const y0 = xy[2 * lo + 1];
  const x1 = xy[2 * hi];
  const y1 = xy[2 * hi + 1];
  out[0] = x0 + (x1 - x0) * f;
  out[1] = y0 + (y1 - y0) * f;
  const dl = Math.hypot(x1 - x0, y1 - y0) || 1;
  out[2] = (x1 - x0) / dl;
  out[3] = (y1 - y0) / dl;
  return out;
};

/** The part of a route between arc lengths s0 and s1, as a flat xy array. */
export const subRoute = (t: ArcTable, s0: number, s1: number): number[] => {
  const a = Math.max(0, Math.min(s0, s1));
  const b = Math.min(t.total, Math.max(s0, s1));
  if (b - a < 1e-6) return [];
  const p = new Float64Array(4);
  const out: number[] = [];
  pointAt(t, a, p);
  out.push(p[0], p[1]);
  for (let i = 0; i < t.len.length; i++) if (t.len[i] > a && t.len[i] < b) out.push(t.xy[2 * i], t.xy[2 * i + 1]);
  pointAt(t, b, p);
  out.push(p[0], p[1]);
  return out;
};

/**
 * A rounded rectangle as an open outline that starts at x = gapEnd on the top edge, runs
 * clockwise and stops at x = gapStart, leaving room for a legend that sits on the border.
 */
export const outlineWithLegendGap = (b: Box, r: number, gapStart: number, gapEnd: number, segs = 10): Float64Array => {
  const rr = Math.min(r, b.w / 2, b.h / 2);
  const out: number[] = [];
  const arc = (ox: number, oy: number, a0: number) => {
    for (let k = 0; k <= segs; k++) {
      const a = a0 + (Math.PI / 2) * (k / segs);
      out.push(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr);
    }
  };
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const gs = Math.max(x0 + rr, Math.min(gapStart, x1 - rr));
  const ge = Math.max(gs, Math.min(gapEnd, x1 - rr));
  out.push(ge, y0);
  arc(x1 - rr, y0 + rr, -Math.PI / 2);
  arc(x1 - rr, y1 - rr, 0);
  arc(x0 + rr, y1 - rr, Math.PI / 2);
  arc(x0 + rr, y0 + rr, Math.PI);
  out.push(gs, y0);
  return Float64Array.from(out);
};

export const unionBox = (boxes: Box[]): Box => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
};
