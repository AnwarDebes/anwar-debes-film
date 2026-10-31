import {flatField, overField, rectField, tileGridField, type Board, type FieldFn, type Look, type RGB} from '../../../engine/pins';
import type {CameraPose} from '../../../engine/camera';
import {screenAtUv} from '../ch07/kit/frame';

// The chapter's one instrument: a small Tsetlin plate pressed into the wall, a grid of tiles that
// every promise reconfigures in place (clauses and literals, a generator's bit rows, a label set,
// 277 answers, two applicants, five sites, five tasks). All of it stays centred on one place.

export const PLATE: [number, number] = [0.6, 0.52];
export const CELL = 6.4;
export const GAP = 1.3;

export const STEEL_FLAT: FieldFn = flatField();

export const MINT: RGB = [0.62, 1.0, 0.86];
export const BRIGHT: RGB = [1.0, 1.0, 0.98];
export const DIM: RGB = [0.42, 0.43, 0.43];
export const DARK: RGB = [0.24, 0.25, 0.25];

export const on = (glow = 0.55): Look => ({h: 0.14, tint: MINT, glow});
export const raised = (h = 0.2): Look => ({h, tint: BRIGHT});
export const low = (): Look => ({h: 0.05, tint: [0.5, 0.51, 0.51]});
export const hole = (): Look => ({h: 0.0, tint: DARK});

export interface GridSpec {
  cols: number;
  rows: number;
  cell?: number;
  gap?: number;
  /** offset of the grid centre from the plate centre, in pins */
  dx?: number;
  dy?: number;
}

export const gridCentre = (board: Board, g: GridSpec): [number, number] => [PLATE[0] + (g.dx ?? 0) * board.p, PLATE[1] + ((g.dy ?? 0) * board.p) / board.extH];

/** A grid of tiles at the plate (rows count from the top). */
export const grid = (board: Board, g: GridSpec, look: (c: number, r: number) => Look | null, ground: FieldFn = STEEL_FLAT): FieldFn => {
  const [u, v] = gridCentre(board, g);
  return tileGridField(board, {u, v, cols: g.cols, rows: g.rows, cell: g.cell ?? CELL, gap: g.gap ?? GAP}, look, {ground});
};

/** Centre of tile (c, r) in uv. */
export const tileUv = (board: Board, g: GridSpec, c: number, r: number): [number, number] => {
  const [u, v] = gridCentre(board, g);
  const cell = g.cell ?? CELL;
  const W = g.cols * cell;
  const Hh = g.rows * cell;
  return [u + (-W / 2 + (c + 0.5) * cell) * board.p, v + ((Hh / 2 - (r + 0.5) * cell) * board.p) / board.extH];
};

/** Screen position (px) of tile (c, r) for a camera pose. */
export const tilePx = (board: Board, pose: CameraPose, g: GridSpec, c: number, r: number, W: number, H: number): [number, number] => {
  const [u, v] = tileUv(board, g, c, r);
  return screenAtUv(board, pose, u, v, W, H);
};

/** Several fields at once: the first that claims a pin wins (each limited to its own box). */
export const stack = (base: FieldFn, ...layers: Array<{field: FieldFn; box: [number, number, number, number]}>): FieldFn =>
  overField(base, ...layers.map((l) => (u: number, v: number, i: number) => (u >= l.box[0] && u <= l.box[2] && v >= l.box[1] && v <= l.box[3] ? l.field(u, v, i) : null)));

/** The uv box of a grid (with a margin in pins). */
export const gridBox = (board: Board, g: GridSpec, margin = 2): [number, number, number, number] => {
  const [u, v] = gridCentre(board, g);
  const cell = g.cell ?? CELL;
  const hw = ((g.cols * cell) / 2 + margin) * board.p;
  const hh = (((g.rows * cell) / 2 + margin) * board.p) / board.extH;
  return [u - hw, v - hh, u + hw, v + hh];
};

/** A rounded plate under a grid: the Tsetlin plate's bed. */
export const bed = (board: Board, g: GridSpec, ground: FieldFn = STEEL_FLAT): FieldFn => {
  const [u, v] = gridCentre(board, g);
  const cell = g.cell ?? CELL;
  return rectField(board, {u, v, w: g.cols * cell + 4, h: g.rows * cell + 4, radius: 2.5}, {h: 0.03, tint: [0.3, 0.31, 0.31], ground});
};

/** A seeded include pattern for the generic plate (deterministic, no Math.random). */
export const includes = (c: number, r: number): boolean => ((c * 7 + r * 11 + ((c * r) % 3)) % 5) < 2;
