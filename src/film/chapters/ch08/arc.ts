import type {Board, FieldFn, PinSample, RGB} from '../../../engine/pins';

// A schematic ARC-AGI-3 frame: 64 x 64 cells in 16 colours, one pin per cell. LUCID commits
// figures and logs, not game frames, so the film draws its own frame and says so on screen.
// Colour index -> pin tint and height; the HUD border band (2 cells) carries a marching counter.

export const N = 64;

/** 16 colours, muted for steel: [tint, paint, height]. */
export const ARC_COLORS: Array<{tint: RGB; paint: number; h: number}> = [
  {tint: [0.3, 0.31, 0.31], paint: 0, h: 0.02}, // 0 background
  {tint: [0.42, 0.6, 0.98], paint: 0.55, h: 0.22}, // 1 blue
  {tint: [0.96, 0.45, 0.42], paint: 0.6, h: 0.24}, // 2 red (hazard)
  {tint: [0.5, 0.86, 0.55], paint: 0.55, h: 0.26}, // 3 green (goal)
  {tint: [0.98, 0.86, 0.45], paint: 0.55, h: 0.1}, // 4 yellow (counter)
  {tint: [0.74, 0.75, 0.75], paint: 0, h: 0.15}, // 5 grey (walls)
  {tint: [0.9, 0.5, 0.86], paint: 0.5, h: 0.2}, // 6 magenta
  {tint: [0.98, 0.66, 0.38], paint: 0.5, h: 0.2}, // 7 orange
  {tint: [0.58, 0.86, 0.98], paint: 0.5, h: 0.2}, // 8 sky
  {tint: [0.62, 0.32, 0.36], paint: 0.5, h: 0.18}, // 9 maroon
  {tint: [0.55, 0.55, 0.6], paint: 0, h: 0.06}, // 10 slate (HUD band)
  {tint: [0.8, 0.95, 0.62], paint: 0.45, h: 0.2}, // 11 lime
  {tint: [0.45, 0.72, 1.0], paint: 0.6, h: 0.32}, // 12 avatar
  {tint: [0.95, 0.95, 0.92], paint: 0, h: 0.18}, // 13 white
  {tint: [0.68, 0.55, 0.42], paint: 0.4, h: 0.16}, // 14 brown
  {tint: [0.5, 0.42, 0.75], paint: 0.45, h: 0.2}, // 15 purple
];

export interface ArcObj {
  name: string;
  color: number;
  r0: number;
  c0: number;
  h: number;
  w: number;
}

/** The schematic frame's objects (row, col from the top-left; sizes in cells). */
export const OBJECTS: ArcObj[] = [
  {name: 'avatar', color: 12, r0: 42, c0: 10, h: 4, w: 4},
  {name: 'goal', color: 3, r0: 12, c0: 47, h: 6, w: 6},
  {name: 'hazard', color: 2, r0: 26, c0: 18, h: 3, w: 3},
  {name: 'hazard', color: 2, r0: 34, c0: 38, h: 3, w: 3},
  {name: 'key', color: 6, r0: 52, c0: 30, h: 3, w: 3},
  {name: 'tile', color: 8, r0: 9, c0: 40, h: 2, w: 8},
  {name: 'block', color: 7, r0: 22, c0: 52, h: 4, w: 4},
];

/** Walls (grey) as [r0, c0, h, w]. */
export const WALLS: Array<[number, number, number, number]> = [
  [20, 28, 22, 2],
  [46, 24, 2, 26],
  [6, 34, 10, 2],
];

/** The frame as colour indices (row-major, top row first). */
export const arcFrame = (): Uint8Array => {
  const g = new Uint8Array(N * N);
  for (const [r0, c0, h, w] of WALLS) for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) g[r * N + c] = 5;
  for (const o of OBJECTS) for (let r = o.r0; r < o.r0 + o.h; r++) for (let c = o.c0; c < o.c0 + o.w; c++) g[r * N + c] = o.color;
  // the HUD: a 2-cell border band, with an action counter marching along the top
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (r < 2 || r >= N - 2 || c < 2 || c >= N - 2) g[r * N + c] = r < 2 && c >= 4 && c < 22 ? 4 : 10;
    }
  return g;
};

/** FNV-1a 32-bit over the masked frame (HUD band set to 255), printed as hex. */
export const maskedSignature = (g: Uint8Array): string => {
  let h = 0x811c9dc5;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const hud = r < 2 || r >= N - 2 || c < 2 || c >= N - 2;
      h ^= hud ? 255 : g[r * N + c];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  return h.toString(16).padStart(8, '0');
};

/** Where the grid sits on the board: its top-left pin (board row and column). */
export interface ArcPlace {
  row0: number;
  col0: number;
}

/** The grid cell a pin shows, or -1 outside the grid. Board rows count from the bottom. */
export const cellOf = (board: Board, P: ArcPlace, i: number): number => {
  const r = P.row0 + N - 1 - board.row[i];
  const c = board.col[i] - P.col0;
  if (r < 0 || r >= N || c < 0 || c >= N) return -1;
  return r * N + c;
};

/** The pin-space centre of a cell (for labels and effects). */
export const cellCentre = (board: Board, P: ArcPlace, r: number, c: number): [number, number] => {
  const row = P.row0 + N - 1 - r;
  const odd = row % 2 === 1;
  const X = c + P.col0 + 0.5 + (odd ? 0.5 : 0);
  const Y = (row * board.rowH + board.p / 2) / board.p;
  return [X, Y];
};

export interface ArcLook {
  /** lift for object cells (the perception beat) */
  lift?: (r: number, c: number, color: number) => number;
  /** recolour the HUD band (the mask) */
  hudMasked?: boolean;
  /** extra heights per cell (sparkle, level-up) */
  extra?: (r: number, c: number) => number;
  /** override colour per cell */
  recolour?: (r: number, c: number, color: number) => number;
  /** dim everything (for overlays on top) */
  dim?: number;
}

/** The grid as a field over a ground, with per-beat looks. */
export const arcField = (board: Board, P: ArcPlace, g: Uint8Array, ground: FieldFn, look: ArcLook = {}): FieldFn => {
  const out: PinSample = {h: 0, tint: [0, 0, 0], glow: 0, paint: 0};
  return (u, v, i) => {
    const cell = cellOf(board, P, i);
    if (cell < 0) return ground(u, v, i);
    const r = Math.floor(cell / N);
    const c = cell % N;
    let color = g[cell];
    if (look.recolour) color = look.recolour(r, c, color);
    const hud = r < 2 || r >= N - 2 || c < 2 || c >= N - 2;
    const spec = ARC_COLORS[color];
    let h = spec.h;
    let tint: RGB = spec.tint;
    let paint = spec.paint;
    if (hud && look.hudMasked) {
      h = 0.01;
      tint = [0.5, 0.5, 0.5];
      paint = 0;
    }
    if (look.lift && color !== 0 && !hud) h += look.lift(r, c, color);
    if (look.extra) h += look.extra(r, c);
    const k = look.dim ?? 1;
    const t = out.tint as RGB;
    t[0] = tint[0] * k;
    t[1] = tint[1] * k;
    t[2] = tint[2] * k;
    return {h, tint: [t[0], t[1], t[2]], glow: 0, paint};
  };
};
