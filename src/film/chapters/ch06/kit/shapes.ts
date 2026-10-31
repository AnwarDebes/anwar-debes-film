import type {FieldFn, PinSample, RGB} from '../../../../engine/pins';
import {STEEL} from '../../../../engine/pins';
import type {PinSpace} from './space';

// Scenes on the wall as lists of shapes in pin space (see space.ts). Each shape is a signed
// distance in pins with a look; shapes are painted in order over a ground, with antialiased
// edges so outlines read as slopes. Every field here is pure and allocation-free per pin.

export interface Look {
  /** height in reliefs */
  h?: number;
  tint?: number | RGB;
  glow?: number;
  paint?: number;
}

interface Base {
  look: Look;
  /** edge softness in pins (default 0.6) */
  soft?: number;
  /** 'over' (default): the look replaces the ground; 'lift': heights add, tint and glow blend */
  mode?: 'over' | 'lift';
}

export type Shape =
  | (Base & {kind: 'rect'; x: number; y: number; w: number; h: number; r?: number})
  | (Base & {kind: 'disc'; x: number; y: number; r: number})
  | (Base & {kind: 'ring'; x: number; y: number; r: number; width: number})
  | (Base & {kind: 'seg'; ax: number; ay: number; bx: number; by: number; width: number; dash?: [number, number]});

export const rect = (x: number, y: number, w: number, h: number, look: Look, o: {r?: number; soft?: number; mode?: 'over' | 'lift'} = {}): Shape => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  look,
  ...o,
});
export const disc = (x: number, y: number, r: number, look: Look, o: {soft?: number; mode?: 'over' | 'lift'} = {}): Shape => ({kind: 'disc', x, y, r, look, ...o});
export const ring = (x: number, y: number, r: number, width: number, look: Look, o: {soft?: number} = {}): Shape => ({
  kind: 'ring',
  x,
  y,
  r,
  width,
  look,
  ...o,
});
export const seg = (ax: number, ay: number, bx: number, by: number, width: number, look: Look, o: {soft?: number; dash?: [number, number]} = {}): Shape => ({
  kind: 'seg',
  ax,
  ay,
  bx,
  by,
  width,
  look,
  ...o,
});

const smooth01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

interface Compiled {
  s: Shape;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  soft: number;
  tr: number;
  tg: number;
  tb: number;
}

const bbox = (s: Shape): [number, number, number, number] => {
  const pad = (s.soft ?? 0.6) + 0.5;
  switch (s.kind) {
    case 'rect':
      return [s.x - s.w / 2 - pad, s.y - s.h / 2 - pad, s.x + s.w / 2 + pad, s.y + s.h / 2 + pad];
    case 'disc':
      return [s.x - s.r - pad, s.y - s.r - pad, s.x + s.r + pad, s.y + s.r + pad];
    case 'ring':
      return [s.x - s.r - s.width - pad, s.y - s.r - s.width - pad, s.x + s.r + s.width + pad, s.y + s.r + s.width + pad];
    case 'seg': {
      const e = s.width / 2 + pad;
      return [Math.min(s.ax, s.bx) - e, Math.min(s.ay, s.by) - e, Math.max(s.ax, s.bx) + e, Math.max(s.ay, s.by) + e];
    }
  }
};

const compile = (s: Shape): Compiled => {
  const [x0, y0, x1, y1] = bbox(s);
  const t = s.look.tint ?? 1;
  const [tr, tg, tb] = typeof t === 'number' ? [t, t, t] : t;
  return {s, x0, y0, x1, y1, soft: s.soft ?? 0.6, tr, tg, tb};
};

/** Signed distance (pins) from a pin-space point to a shape. */
const sdf = (s: Shape, X: number, Y: number): number => {
  switch (s.kind) {
    case 'rect': {
      const rad = Math.min(s.r ?? 0, s.w / 2, s.h / 2);
      const qx = Math.abs(X - s.x) - (s.w / 2 - rad);
      const qy = Math.abs(Y - s.y) - (s.h / 2 - rad);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
    }
    case 'disc':
      return Math.hypot(X - s.x, Y - s.y) - s.r;
    case 'ring':
      return Math.abs(Math.hypot(X - s.x, Y - s.y) - s.r) - s.width / 2;
    case 'seg': {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const L2 = dx * dx + dy * dy || 1e-9;
      let k = ((X - s.ax) * dx + (Y - s.ay) * dy) / L2;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      if (s.dash) {
        // dashes along the segment: drop the gaps
        const L = Math.sqrt(L2);
        const along = k * L;
        const period = s.dash[0] + s.dash[1];
        if (along % period > s.dash[0]) return 1e3;
      }
      return Math.hypot(X - (s.ax + dx * k), Y - (s.ay + dy * k)) - s.width / 2;
    }
  }
};

/** Mutable sample used while painting one pin (never escapes: a fresh object is returned). */
interface Acc {
  h: number;
  r: number;
  g: number;
  b: number;
  glow: number;
  paint: number;
}

const paintInto = (acc: Acc, c: Compiled, a: number) => {
  const L = c.s.look;
  if (c.s.mode === 'lift') {
    acc.h += (L.h ?? 0) * a;
  } else {
    acc.h += ((L.h ?? 0.25) - acc.h) * a;
  }
  acc.r += (c.tr - acc.r) * a;
  acc.g += (c.tg - acc.g) * a;
  acc.b += (c.tb - acc.b) * a;
  if (L.glow !== undefined || c.s.mode !== 'lift') acc.glow += ((L.glow ?? 0) - acc.glow) * a;
  if (L.paint !== undefined || c.s.mode !== 'lift') acc.paint += ((L.paint ?? 0) - acc.paint) * a;
};

/** Shapes binned into square cells of pin space (indices kept in paint order). */
interface Buckets {
  size: number;
  nx: number;
  ny: number;
  cells: Int32Array[];
}

const EMPTY = new Int32Array(0);

const bucketsOf = (list: readonly Compiled[], cols: number, rows: number, size = 6): Buckets => {
  const nx = Math.ceil(cols / size) + 1;
  const ny = Math.ceil(rows / size) + 1;
  const tmp: number[][] = Array.from({length: nx * ny}, () => []);
  list.forEach((c, k) => {
    const x0 = Math.max(0, Math.floor(c.x0 / size));
    const x1 = Math.min(nx - 1, Math.floor(c.x1 / size));
    const y0 = Math.max(0, Math.floor(c.y0 / size));
    const y1 = Math.min(ny - 1, Math.floor(c.y1 / size));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tmp[y * nx + x].push(k);
  });
  return {size, nx, ny, cells: tmp.map((a) => (a.length ? Int32Array.from(a) : EMPTY))};
};

const cellList = (b: Buckets, X: number, Y: number): Int32Array => {
  const x = Math.floor(X / b.size);
  const y = Math.floor(Y / b.size);
  if (x < 0 || y < 0 || x >= b.nx || y >= b.ny) return EMPTY;
  return b.cells[y * b.nx + x];
};

export interface GroundSpec {
  h?: number;
  tint?: number | RGB;
}

/**
 * A field from shapes over a ground (flat steel by default, or another field). Shapes paint in
 * order, so later shapes sit on top.
 */
export const shapesField = (S: PinSpace, shapes: readonly Shape[], ground: GroundSpec | FieldFn = {}): FieldFn => {
  const list = shapes.map(compile);
  const {p, extH} = S.board;
  const buckets = bucketsOf(list, S.board.cols + 2, S.ext + 2);
  const gField = typeof ground === 'function' ? ground : null;
  const gs = typeof ground === 'function' ? null : ground;
  const gT = gs?.tint ?? STEEL;
  const g3: RGB = typeof gT === 'number' ? [gT, gT, gT] : gT;
  const gh = gs?.h ?? 0;
  const acc: Acc = {h: 0, r: 0, g: 0, b: 0, glow: 0, paint: 0};
  return (u, v, i) => {
    const X = u / p;
    const Y = (v * extH) / p;
    let any = false;
    const ids = cellList(buckets, X, Y);
    for (let q = 0; q < ids.length; q++) {
      const c = list[ids[q]];
      if (X < c.x0 || X > c.x1 || Y < c.y0 || Y > c.y1) continue;
      const d = sdf(c.s, X, Y);
      if (d > c.soft) continue;
      const a = smooth01(0.5 - d / c.soft);
      if (a <= 0) continue;
      if (!any) {
        any = true;
        if (gField) {
          const g = gField(u, v, i);
          const t = g.tint;
          acc.h = g.h;
          if (typeof t === 'number') acc.r = acc.g = acc.b = t;
          else {
            acc.r = t[0];
            acc.g = t[1];
            acc.b = t[2];
          }
          acc.glow = g.glow ?? 0;
          acc.paint = g.paint ?? 0;
        } else {
          acc.h = gh;
          acc.r = g3[0];
          acc.g = g3[1];
          acc.b = g3[2];
          acc.glow = 0;
          acc.paint = 0;
        }
      }
      paintInto(acc, c, a);
    }
    if (!any) return gField ? gField(u, v, i) : groundSample(gh, gT);
    return {h: acc.h, tint: [acc.r, acc.g, acc.b], glow: acc.glow, paint: acc.paint};
  };
};

const groundCache = new Map<string, PinSample>();
const groundSample = (h: number, t: number | RGB): PinSample => {
  const key = `${h}|${typeof t === 'number' ? t : t.join(',')}`;
  let s = groundCache.get(key);
  if (!s) {
    s = {h, tint: t};
    groundCache.set(key, s);
  }
  return s;
};

/** Shapes that only exist inside a time window, for live layers: null outside every shape. */
export const shapesLive = (S: PinSpace, shapes: readonly Shape[]): ((u: number, v: number) => PinSample | null) => {
  const list = shapes.map(compile);
  const {p, extH} = S.board;
  const buckets = bucketsOf(list, S.board.cols + 2, S.ext + 2);
  const acc: Acc = {h: 0, r: 0, g: 0, b: 0, glow: 0, paint: 0};
  return (u, v) => {
    const X = u / p;
    const Y = (v * extH) / p;
    let any = false;
    const ids = cellList(buckets, X, Y);
    for (let q = 0; q < ids.length; q++) {
      const c = list[ids[q]];
      if (X < c.x0 || X > c.x1 || Y < c.y0 || Y > c.y1) continue;
      const d = sdf(c.s, X, Y);
      if (d > c.soft) continue;
      const a = smooth01(0.5 - d / c.soft);
      if (a <= 0) continue;
      if (!any) {
        any = true;
        acc.h = 0;
        acc.r = acc.g = acc.b = STEEL;
        acc.glow = 0;
        acc.paint = 0;
      }
      paintInto(acc, c, a);
    }
    return any ? {h: acc.h, tint: [acc.r, acc.g, acc.b], glow: acc.glow, paint: acc.paint} : null;
  };
};

/** Bounding uv region [u0, v0, u1, v1] of shapes (for a live layer's region), padded by pins. */
export const shapesRegion = (S: PinSpace, shapes: readonly Shape[], padPins = 1.5): [number, number, number, number] => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of shapes) {
    const b = bbox(s);
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  const [u0, v0] = S.uv(x0 - padPins, y0 - padPins);
  const [u1, v1] = S.uv(x1 + padPins, y1 + padPins);
  return [u0, v0, u1, v1];
};

// ---------------------------------------------------------------- looks

/** Film palette for pins (tints multiply white steel; paint makes a tint read as its colour). */
export const PIN = {
  steel: STEEL,
  bright: 1.0,
  dim: 0.55,
  dark: 0.3,
  mint: [0.62, 1.0, 0.86] as RGB,
  mintPaint: [0.455, 0.788, 0.682] as RGB,
  red: [1.0, 0.42, 0.42] as RGB,
  redPaint: [0.96, 0.45, 0.455] as RGB,
  amber: [1.0, 0.78, 0.3] as RGB,
  coral: [0.85, 0.47, 0.34] as RGB,
} as const;

export const LOOK = {
  plate: {h: 0.05, tint: 0.62} as Look,
  tile: {h: 0.16, tint: 0.98} as Look,
  tileDim: {h: 0.1, tint: 0.6} as Look,
  lit: {h: 0.2, tint: PIN.mint, glow: 0.85} as Look,
  litSoft: {h: 0.14, tint: PIN.mint, glow: 0.4} as Look,
  hole: {h: 0, tint: 0.22} as Look,
  red: {h: 0.22, tint: PIN.redPaint, paint: 0.85} as Look,
  amber: {h: 0.18, tint: PIN.amber, paint: 0.6} as Look,
} as const;
