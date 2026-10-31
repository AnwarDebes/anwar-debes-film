import {cover, flatField, smooth01, type Board, type FieldFn, type Look, type PinSample, type RGB} from '../../../../engine/pins';

// Pin pictures for chapters 03-05, built on the engine's field conventions: centres in board uv,
// sizes in pin pitches, edges antialiased over a fraction of a pin so outlines read as slopes.

const toPins = (b: Board, du: number, dv: number): [number, number] => [du / b.p, (dv * b.extH) / b.p];
const coverage = (sd: number, soft: number) => smooth01(0.5 - sd / Math.max(1e-3, soft));

/** A ground of uniformly tinted steel (a chapter's palette, the red drop). */
export const ground = (tint: number | RGB): FieldFn => flatField(tint);

/** Scale an RGB tint. */
export const scaleTint = (t: RGB, k: number): RGB => [t[0] * k, t[1] * k, t[2] * k];

export interface Pad {
  u: number;
  v: number;
  /** radius in pins */
  r: number;
  look: Look | null;
}

/** Round pads of raised pins (timeline steps, lit literals, ring slots). */
export const padsField = (board: Board, pads: readonly Pad[], base: FieldFn, soft = 0.55): FieldFn => {
  const live = pads.filter((p) => p.look);
  return (u, v, i) => {
    const g = base(u, v, i);
    for (const p of live) {
      const [px, py] = toPins(board, u - p.u, v - p.v);
      const sd = Math.hypot(px, py) - p.r;
      if (sd > soft) continue;
      return cover(g, p.look as Look, coverage(sd, soft));
    }
    return g;
  };
};

/** Rounded boxes (ledger blocks, a bin, a card of pins). Sizes in pins. */
export interface Box {
  u: number;
  v: number;
  w: number;
  h: number;
  radius?: number;
  look: Look | null;
}

export const boxesField = (board: Board, boxes: readonly Box[], base: FieldFn, soft = 0.55): FieldFn => {
  const live = boxes.filter((b) => b.look);
  return (u, v, i) => {
    const g = base(u, v, i);
    for (const b of live) {
      const [px, py] = toPins(board, u - b.u, v - b.v);
      const rad = b.radius ?? 0;
      const qx = Math.abs(px) - (b.w / 2 - rad);
      const qy = Math.abs(py) - (b.h / 2 - rad);
      const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
      if (sd > soft) continue;
      return cover(g, b.look as Look, coverage(sd, soft));
    }
    return g;
  };
};

/**
 * A grid of square tiles, one per item, rows from the top (the 16 x 16 vocabulary field).
 * `cell` is the tile pitch in pins, `size` the tile edge.
 */
export const gridField = (
  board: Board,
  g: {u: number; v: number; cols: number; rows: number; cell: number; size: number},
  look: (index: number, c: number, r: number) => Look | null,
  base: FieldFn,
  soft = 0.5,
): FieldFn => {
  const Wp = g.cols * g.cell;
  const Hp = g.rows * g.cell;
  const half = g.size / 2;
  return (u, v, i) => {
    const b = base(u, v, i);
    const [px, py] = toPins(board, u - g.u, v - g.v);
    const lx = px + Wp / 2;
    const ly = Hp / 2 - py;
    const c = Math.floor(lx / g.cell);
    const r = Math.floor(ly / g.cell);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return b;
    const lk = look(r * g.cols + c, c, r);
    if (!lk) return b;
    const qx = Math.abs(lx - (c + 0.5) * g.cell) - half;
    const qy = Math.abs(ly - (r + 0.5) * g.cell) - half;
    const sd = Math.max(qx, qy);
    if (sd > soft) return b;
    return cover(b, lk, coverage(sd, soft));
  };
};

/** Where the centre of grid item `index` sits, in board uv. */
export const gridItemUv = (board: Board, g: {u: number; v: number; cols: number; rows: number; cell: number}, index: number): [number, number] => {
  const c = index % g.cols;
  const r = Math.floor(index / g.cols);
  const px = (c + 0.5) * g.cell - (g.cols * g.cell) / 2;
  const py = (g.rows * g.cell) / 2 - (r + 0.5) * g.cell;
  return [g.u + px * board.p, g.v + (py * board.p) / board.extH];
};

/** A ring of `n` slots (a ring buffer). Slot 0 at 12 o'clock, clockwise. */
export const ringField = (
  board: Board,
  ring: {u: number; v: number; radius: number; n: number; padR: number},
  look: (k: number) => Look | null,
  base: FieldFn,
  soft = 0.5,
): FieldFn => {
  const step = (Math.PI * 2) / ring.n;
  return (u, v, i) => {
    const b = base(u, v, i);
    const [px, py] = toPins(board, u - ring.u, v - ring.v);
    const rr = Math.hypot(px, py);
    if (Math.abs(rr - ring.radius) > ring.padR + soft) return b;
    // angle clockwise from 12 o'clock
    let a = Math.atan2(px, py);
    if (a < 0) a += Math.PI * 2;
    const k = Math.round(a / step) % ring.n;
    const lk = look(k);
    if (!lk) return b;
    const ca = k * step;
    const cx = Math.sin(ca) * ring.radius;
    const cy = Math.cos(ca) * ring.radius;
    const sd = Math.hypot(px - cx, py - cy) - ring.padR;
    if (sd > soft) return b;
    return cover(b, lk, coverage(sd, soft));
  };
};

export const ringSlotUv = (board: Board, ring: {u: number; v: number; radius: number; n: number}, k: number): [number, number] => {
  const a = (k * Math.PI * 2) / ring.n;
  return [ring.u + Math.sin(a) * ring.radius * board.p, ring.v + (Math.cos(a) * ring.radius * board.p) / board.extH];
};

/** Vertical bars from a baseline. Values 0..1 of `height` pins; x positions in pins from the chart's left. */
export const barsAt = (
  board: Board,
  chart: {u: number; v: number; height: number; bars: ReadonlyArray<{x: number; w: number; value: number; look: Look}>},
  base: FieldFn,
  soft = 0.5,
): FieldFn => {
  return (u, v, i) => {
    const b = base(u, v, i);
    const [px, py] = toPins(board, u - chart.u, v - chart.v);
    if (py < -soft) return b;
    for (const bar of chart.bars) {
      const top = Math.max(0, Math.min(1, bar.value)) * chart.height;
      const qx = Math.abs(px - (bar.x + bar.w / 2)) - bar.w / 2;
      const qy = Math.abs(py - top / 2) - top / 2;
      const sd = Math.max(qx, qy);
      if (sd > soft) continue;
      return cover(b, bar.look, coverage(sd, soft));
    }
    return b;
  };
};

/** Layer fields over a base: the first that returns a sample (not null) wins. */
export const layers = (base: FieldFn, ...ls: Array<(u: number, v: number, i: number) => PinSample | null>): FieldFn => (u, v, i) => {
  for (const l of ls) {
    const s = l(u, v, i);
    if (s) return s;
  }
  return base(u, v, i);
};

/** uv of a point given in pins from a centre. */
export const uvAt = (board: Board, u: number, v: number, dxPins: number, dyPins: number): [number, number] => [u + dxPins * board.p, v + (dyPins * board.p) / board.extH];

/** World position (board-local, wall plane) of a uv point at height h (world units). */
export const uvWorld = (board: Board, u: number, v: number, h = 0): [number, number, number] => [u - 0.5, v * board.extH - board.extH / 2, h];

/** Exact pins (by board index) with their own looks: one pin per literal, crisp, no resampling. */
export const pinsField = (looks: ReadonlyMap<number, Look>, base: FieldFn): FieldFn => (u, v, i) => {
  const lk = looks.get(i);
  const g = base(u, v, i);
  return lk ? cover(g, lk, 1) : g;
};

/**
 * A rows x cols lattice of single pins at a pitch of `step` pins, taken from even board rows only
 * (even rows share columns, so the lattice is square-ish and unstaggered). Returns pin indices,
 * row-major from the top-left, or -1 off the board.
 */
export const pinLattice = (board: Board, topLeft: [number, number], cols: number, rows: number, step = 2): Int32Array => {
  // nearest even row to the top-left corner, and its column
  const span = (board.rows - 1) * board.rowH;
  const yy = topLeft[1] * board.extH - board.extH / 2;
  let R0 = Math.round((yy + span / 2) / board.rowH);
  if (R0 % 2 === 1) R0 -= 1;
  const C0 = Math.round((topLeft[0] - board.p / 2) / board.p);
  const out = new Int32Array(cols * rows).fill(-1);
  for (let r = 0; r < rows; r++) {
    const R = R0 - r * step;
    if (R < 0 || R >= board.rows) continue;
    const n = board.rowStart[R + 1] - board.rowStart[R];
    for (let c = 0; c < cols; c++) {
      const C = C0 + c * step;
      if (C < 0 || C >= n) continue;
      out[r * cols + c] = board.rowStart[R] + C;
    }
  }
  return out;
};

/** Strokes in pins: capsules between points given in pins from a centre (glyphs drawn as lines, no font). */
export const strokesField = (
  board: Board,
  at: {u: number; v: number},
  segs: ReadonlyArray<readonly [number, number, number, number]>,
  width: number,
  look: Look,
  base: FieldFn,
  soft = 0.55,
): FieldFn => {
  const half = width / 2;
  return (u, v, i) => {
    const b = base(u, v, i);
    const [px, py] = toPins(board, u - at.u, v - at.v);
    let sd = Infinity;
    for (const [x0, y0, x1, y1] of segs) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L2 = dx * dx + dy * dy || 1;
      const k = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2));
      const d = Math.hypot(px - (x0 + dx * k), py - (y0 + dy * k)) - half;
      if (d < sd) sd = d;
    }
    if (sd > soft) return b;
    return cover(b, look, coverage(sd, soft));
  };
};
