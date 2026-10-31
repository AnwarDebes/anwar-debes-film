import * as THREE from 'three';
import {STEEL, step, type Board, type FieldFn, type LiveFieldFn, type LiveLayer, type PinSample, type RGB} from '../../../../engine/pins';
import {applyPose, type CameraPose} from '../../../../engine/camera';

// Pin pictures for the chapter places. Everything is drawn in pin units (one unit = one pin
// pitch, y up) around an origin on the wall, then turned into a pure field over the board.

export type Tint = number | RGB;

export interface Look {
  /** height in reliefs */
  h: number;
  tint?: Tint;
  glow?: number;
  paint?: number;
}

type Blend = 'over' | 'max';

interface Prim {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sd: (x: number, y: number) => number;
  look: Look;
  soft: number;
  blend: Blend;
}

const t3 = (t: Tint | undefined, d: number): RGB => (t === undefined ? [d, d, d] : typeof t === 'number' ? [t, t, t] : t);

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Mixes a look over a sample with coverage a (heights lerp, or take the max). */
const blendInto = (s: MutSample, look: Look, a: number, mode: Blend) => {
  if (a <= 0) return;
  const lt = t3(look.tint, 1);
  if (mode === 'max') {
    const h = look.h * a;
    if (h > s.h) s.h = h;
  } else s.h += (look.h - s.h) * a;
  s.r += (lt[0] - s.r) * a;
  s.g += (lt[1] - s.g) * a;
  s.b += (lt[2] - s.b) * a;
  s.glow += ((look.glow ?? 0) - s.glow) * a;
  s.paint += ((look.paint ?? 0) - s.paint) * a;
};

interface MutSample {
  h: number;
  r: number;
  g: number;
  b: number;
  glow: number;
  paint: number;
}

/** Distance from (x, y) to the segment a-b. */
export const segDist = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let k = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return Math.hypot(x - ax - k * dx, y - ay - k * dy);
};

/** Points along a quadratic arc from a to b whose middle is lifted by `bulge` (pins, to the left of a->b). */
export const arcPoints = (ax: number, ay: number, bx: number, by: number, bulge: number, n = 14): Array<[number, number]> => {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / L) * bulge * 2;
  const cy = my + (dx / L) * bulge * 2;
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const a = (1 - k) * (1 - k);
    const b = 2 * k * (1 - k);
    const c = k * k;
    out.push([a * ax + b * cx + c * bx, a * ay + b * cy + c * by]);
  }
  return out;
};

/** A picture in pin units. Later primitives draw over earlier ones. */
export class Pic {
  readonly prims: Prim[] = [];
  private bx0 = Infinity;
  private by0 = Infinity;
  private bx1 = -Infinity;
  private by1 = -Infinity;

  private add(p: Prim) {
    this.grid = null;
    this.prims.push(p);
    this.bx0 = Math.min(this.bx0, p.x0);
    this.by0 = Math.min(this.by0, p.y0);
    this.bx1 = Math.max(this.bx1, p.x1);
    this.by1 = Math.max(this.by1, p.y1);
    return this;
  }

  disc(x: number, y: number, r: number, look: Look, soft = 0.6, blend: Blend = 'over') {
    const m = r + soft;
    return this.add({x0: x - m, y0: y - m, x1: x + m, y1: y + m, sd: (px, py) => Math.hypot(px - x, py - y) - r, look, soft, blend});
  }

  ring(x: number, y: number, r: number, hw: number, look: Look, soft = 0.6, blend: Blend = 'over') {
    const m = r + hw + soft;
    return this.add({x0: x - m, y0: y - m, x1: x + m, y1: y + m, sd: (px, py) => Math.abs(Math.hypot(px - x, py - y) - r) - hw, look, soft, blend});
  }

  /** A ridge (capsule) from a to b, half width hw. */
  seg(ax: number, ay: number, bx: number, by: number, hw: number, look: Look, soft = 0.6, blend: Blend = 'over') {
    const m = hw + soft;
    return this.add({
      x0: Math.min(ax, bx) - m,
      y0: Math.min(ay, by) - m,
      x1: Math.max(ax, bx) + m,
      y1: Math.max(ay, by) + m,
      sd: (px, py) => segDist(px, py, ax, ay, bx, by) - hw,
      look,
      soft,
      blend,
    });
  }

  /** A polyline ridge as one primitive (no seams between its segments). */
  line(pts: ReadonlyArray<readonly [number, number]>, hw: number, look: Look, soft = 0.6, blend: Blend = 'over') {
    if (pts.length < 2) return this;
    const m = hw + soft;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const P = pts.map((p) => [p[0], p[1]] as const);
    return this.add({
      x0: x0 - m,
      y0: y0 - m,
      x1: x1 + m,
      y1: y1 + m,
      sd: (px, py) => {
        let d = Infinity;
        for (let i = 1; i < P.length; i++) {
          const q = segDist(px, py, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]);
          if (q < d) d = q;
        }
        return d - hw;
      },
      look,
      soft,
      blend,
    });
  }

  arc(ax: number, ay: number, bx: number, by: number, bulge: number, hw: number, look: Look, soft = 0.6, blend: Blend = 'over') {
    return this.line(arcPoints(ax, ay, bx, by, bulge), hw, look, soft, blend);
  }

  /** Rounded rectangle centred on (x, y), w x h pins. */
  rect(x: number, y: number, w: number, h: number, look: Look, radius = 0, soft = 0.6, blend: Blend = 'over') {
    const hx = w / 2 - radius;
    const hy = h / 2 - radius;
    const m = soft;
    return this.add({
      x0: x - w / 2 - m,
      y0: y - h / 2 - m,
      x1: x + w / 2 + m,
      y1: y + h / 2 + m,
      sd: (px, py) => {
        const qx = Math.abs(px - x) - hx;
        const qy = Math.abs(py - y) - hy;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      },
      look,
      soft,
      blend,
    });
  }

  /** Append another picture's primitives, shifted by (dx, dy) pins. */
  put(other: Pic, dx = 0, dy = 0) {
    for (const p of other.prims) {
      const sd = p.sd;
      this.add({...p, x0: p.x0 + dx, y0: p.y0 + dy, x1: p.x1 + dx, y1: p.y1 + dy, sd: (x, y) => sd(x - dx, y - dy)});
    }
    return this;
  }

  get empty() {
    return this.prims.length === 0;
  }

  get bounds(): [number, number, number, number] {
    return [this.bx0, this.by0, this.bx1, this.by1];
  }

  // a uniform grid over the bounds, listing the primitives that touch each cell (built on first use)
  private grid: Int32Array[] | null = null;
  private gx = 0;
  private gy = 0;
  private cell = 4;

  private buildGrid() {
    const w = this.bx1 - this.bx0;
    const h = this.by1 - this.by0;
    this.cell = Math.max(2, Math.sqrt((w * h) / Math.max(16, this.prims.length * 2)));
    this.gx = Math.max(1, Math.ceil(w / this.cell));
    this.gy = Math.max(1, Math.ceil(h / this.cell));
    const lists: number[][] = Array.from({length: this.gx * this.gy}, () => []);
    this.prims.forEach((p, k) => {
      const c0 = Math.max(0, Math.floor((p.x0 - this.bx0) / this.cell));
      const c1 = Math.min(this.gx - 1, Math.floor((p.x1 - this.bx0) / this.cell));
      const r0 = Math.max(0, Math.floor((p.y0 - this.by0) / this.cell));
      const r1 = Math.min(this.gy - 1, Math.floor((p.y1 - this.by0) / this.cell));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) lists[r * this.gx + c].push(k);
    });
    this.grid = lists.map((l) => Int32Array.from(l));
  }

  /** Sample at pin coordinates (x, y) over a ground sample; returns false outside every primitive. */
  sampleInto(x: number, y: number, s: MutSample): boolean {
    if (x < this.bx0 || x > this.bx1 || y < this.by0 || y > this.by1) return false;
    if (!this.grid) this.buildGrid();
    const grid = this.grid as Int32Array[];
    const c = Math.min(this.gx - 1, Math.floor((x - this.bx0) / this.cell));
    const r = Math.min(this.gy - 1, Math.floor((y - this.by0) / this.cell));
    const list = grid[r * this.gx + c];
    let hit = false;
    for (let q = 0; q < list.length; q++) {
      const p = this.prims[list[q]];
      if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) continue;
      const d = p.sd(x, y);
      if (d > p.soft) continue;
      const a = smooth(0.5 - d / Math.max(1e-3, p.soft));
      if (a <= 0) continue;
      blendInto(s, p.look, a, p.blend);
      hit = true;
    }
    return hit;
  }
}

const toSample = (s: MutSample): PinSample => ({
  h: s.h,
  tint: s.r === s.g && s.g === s.b ? s.r : [s.r, s.g, s.b],
  glow: s.glow,
  paint: s.paint,
});

const groundSampleInto = (g: PinSample, s: MutSample) => {
  const t = t3(g.tint, STEEL);
  s.h = g.h;
  s.r = t[0];
  s.g = t[1];
  s.b = t[2];
  s.glow = g.glow ?? 0;
  s.paint = g.paint ?? 0;
};

export type Ground = FieldFn | number;
const flatGround = (tint: number): FieldFn => {
  const s: PinSample = {h: 0, tint};
  return () => s;
};
export const groundField = (g: Ground | undefined): FieldFn => (typeof g === 'function' ? g : flatGround(g ?? STEEL));

/** Pin coordinates of a uv point relative to an origin (pins, y up). */
export const pinXY = (b: Board, ou: number, ov: number, u: number, v: number): [number, number] => [(u - ou) / b.p, ((v - ov) * b.extH) / b.p];

/** uv of a point given in pins relative to an origin. */
export const uvOf = (b: Board, ou: number, ov: number, x: number, y: number): [number, number] => [ou + x * b.p, ov + (y * b.p) / b.extH];

/** A picture placed on the wall at uv origin (ou, ov), over a ground. */
export const picField = (b: Board, pic: Pic | readonly Pic[], ou: number, ov: number, ground?: Ground): FieldFn => {
  const pics = Array.isArray(pic) ? (pic as readonly Pic[]) : [pic as Pic];
  const g = groundField(ground);
  const s: MutSample = {h: 0, r: 0, g: 0, b: 0, glow: 0, paint: 0};
  return (u, v, i) => {
    const base = g(u, v, i);
    const x = (u - ou) / b.p;
    const y = ((v - ov) * b.extH) / b.p;
    groundSampleInto(base, s);
    let hit = false;
    for (const p of pics) if (p.sampleInto(x, y, s)) hit = true;
    return hit ? toSample(s) : base;
  };
};

/** Several fields layered: the first whose sample differs from flat steel wins (pictures never overlap). */
export const layered = (...fields: FieldFn[]): FieldFn => (u, v, i) => {
  let last: PinSample | null = null;
  for (const f of fields) {
    const s = f(u, v, i);
    last = s;
    if (s.h > 1e-4 || (s.glow ?? 0) > 1e-4 || (s.paint ?? 0) > 1e-4 || (typeof s.tint === 'number' ? Math.abs(s.tint - STEEL) > 1e-4 : true)) return s;
  }
  return last ?? {h: 0, tint: STEEL};
};

// ---------------------------------------------------------------- baked fields

/**
 * A field sampled once on a grid that lands exactly on the pins (x every half pitch, one row per
 * pin row), then read back with linear interpolation along x. Lets a live layer slide a whole
 * place across the wall for the price of a lookup.
 */
export interface Baked {
  sample: (x: number, row: number, out: MutLike) => void;
}
export interface MutLike {
  h: number;
  r: number;
  g: number;
  b: number;
  glow: number;
  paint: number;
}

export const bakeField = (b: Board, field: FieldFn): Baked => {
  let grid: Float32Array | null = null;
  const NX = 2 * b.cols + 1;
  const NR = b.rows;
  const half = b.p / 2;
  const build = () => {
    const g = new Float32Array(NX * NR * 6);
    for (let r = 0; r < NR; r++) {
      const i0 = b.rowStart[r];
      const v = b.v[i0];
      for (let k = 0; k < NX; k++) {
        const u = k * half;
        const s = field(u, v, i0);
        const t = t3(s.tint, STEEL);
        const o = (r * NX + k) * 6;
        g[o] = s.h;
        g[o + 1] = t[0];
        g[o + 2] = t[1];
        g[o + 3] = t[2];
        g[o + 4] = s.glow ?? 0;
        g[o + 5] = s.paint ?? 0;
      }
    }
    return g;
  };
  return {
    sample: (x, row, out) => {
      if (!grid) grid = build();
      const fk = x / half;
      if (fk <= 0 || fk >= NX - 1) {
        out.h = 0;
        out.r = out.g = out.b = STEEL;
        out.glow = 0;
        out.paint = 0;
        return;
      }
      const k = Math.floor(fk);
      const w = fk - k;
      const o = (row * NX + k) * 6;
      const q = o + 6;
      out.h = grid[o] + (grid[q] - grid[o]) * w;
      out.r = grid[o + 1] + (grid[q + 1] - grid[o + 1]) * w;
      out.g = grid[o + 2] + (grid[q + 2] - grid[o + 2]) * w;
      out.b = grid[o + 3] + (grid[q + 3] - grid[o + 3]) * w;
      out.glow = grid[o + 4] + (grid[q + 4] - grid[o + 4]) * w;
      out.paint = grid[o + 5] + (grid[q + 5] - grid[o + 5]) * w;
    },
  };
};

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const present = (s: MutLike) => s.h > 1e-3 || s.glow > 1e-3 || s.paint > 1e-3 || Math.abs(s.r - STEEL) > 2e-3 || Math.abs(s.g - STEEL) > 2e-3 || Math.abs(s.b - STEEL) > 2e-3;

/**
 * The treadmill: the wall slides left by `dist` board widths over [at, at + dur], carrying the
 * current place out of frame and the next one in from the right, as if the camera walked along
 * an endless wall. The next place must already be the wall's beat underneath by the end.
 */
export const treadmill = (b: Board, from: FieldFn, to: FieldFn, at: number, dur: number, dist = 0.86): LiveLayer => {
  const A = bakeField(b, from);
  const B = bakeField(b, to);
  const sa: MutLike = {h: 0, r: 0, g: 0, b: 0, glow: 0, paint: 0};
  const sb: MutLike = {h: 0, r: 0, g: 0, b: 0, glow: 0, paint: 0};
  const out: PinSample = {h: 0, tint: [STEEL, STEEL, STEEL], glow: 0, paint: 0};
  const tint = out.tint as RGB;
  const fn: LiveFieldFn = (u, _v, i, t) => {
    const k = easeInOutCubic(Math.min(1, Math.max(0, (t - at) / dur)));
    const x = u + k * dist;
    const row = b.row[i];
    A.sample(x, row, sa);
    B.sample(x - dist, row, sb);
    const s = present(sb) || !present(sa) ? sb : sa;
    out.h = s.h;
    tint[0] = s.r;
    tint[1] = s.g;
    tint[2] = s.b;
    out.glow = s.glow;
    out.paint = s.paint;
    return out;
  };
  // peak speed of the ease is 1.5 x mean; heights change about 0.4 relief per pin crossed
  const peakPinsPerS = (1.5 * dist) / b.p / dur;
  return {
    fn,
    from: at,
    to: at + dur,
    fadeS: 0.04,
    mode: 'replace',
    speedHint: (t) => {
      const k = Math.min(1, Math.max(0, (t - at) / dur));
      return 0.35 * peakPinsPerS * Math.sin(Math.PI * k);
    },
  };
};

/** A spring step (k 140, zeta 0.72) from h0 to h1 released at `at`, for live layers. */
export const springTo = (h0: number, h1: number, at: number, t: number) => h0 + (h1 - h0) * step(t - at);

// ---------------------------------------------------------------- screen <-> wall

const _cam = new THREE.PerspectiveCamera();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** The wall uv under a screen point (0..1 from the top-left) for a camera pose. */
export const uvAtScreen = (b: Board, pose: CameraPose, sx: number, sy: number, aspect = 16 / 9): [number, number] => {
  applyPose(_cam, pose, aspect);
  _a.set(sx * 2 - 1, 1 - sy * 2, -1).unproject(_cam);
  _b.set(sx * 2 - 1, 1 - sy * 2, 1).unproject(_cam);
  const k = _a.z / (_a.z - _b.z);
  const x = _a.x + (_b.x - _a.x) * k;
  const y = _a.y + (_b.y - _a.y) * k;
  return [x + 0.5, (y + b.extH / 2) / b.extH];
};

/** World position of a wall uv point raised by h reliefs (relief = 22 pitches). */
export const wallPoint = (b: Board, u: number, v: number, h = 0): [number, number, number] => [u - 0.5, v * b.extH - b.extH / 2, h * 22 * b.p];
