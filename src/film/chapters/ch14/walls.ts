import {pinAt, blackBoxField, flatField, hash01, portraitField, rectField, ruleLineField, type Board, type FieldFn, type Pixels, type PinSample, type RGB} from '../../../engine/pins';
import {mapField, mapPlaces} from '../ch01/map';
import {BOX_SIZE, BOX_UV} from '../ch01/open';
import {MINT} from '../ch10/kit/fields';

// Chapter 14's pin pictures. Every field is pure (no clocks, no random): positions come from the
// board and the data, and the only noise is the wall's own seeded hash.

const RED: RGB = [1.0, 0.42, 0.36];
const DARK = 0.32;
const toPins = (b: Board, du: number, dv: number): [number, number] => [du / b.p, (dv * b.extH) / b.p];

// ---------------------------------------------------------------- 14.0 / 14.7 the black box
export {BOX_UV, BOX_SIZE};
/** The original black box of 01.1, at its place and size. `tint` lifts during the stalled clear. */
export const boxField = (board: Board, tint = 0.3, h = 0.42): FieldFn => blackBoxField(board, {u: BOX_UV[0], v: BOX_UV[1], size: BOX_SIZE, h, tint});

/** The box turned to glass: its edges lit, the portrait risen inside, the light pool full. */
export const glassBoxField = (board: Board, face: Pixels, opts: {portrait: boolean}): FieldFn => {
  const half = BOX_SIZE / 2 + 2;
  const inner = opts.portrait ? portraitField(board, face, {u: BOX_UV[0], v: BOX_UV[1] - 0.004, height: BOX_SIZE + 2}, {ground: 0.78}) : flatField(0.78);
  const edge: PinSample = {h: 0.5, tint: MINT, glow: 0.85};
  return (u, v, i) => {
    const [px, py] = toPins(board, u - BOX_UV[0], v - BOX_UV[1]);
    const m = Math.max(Math.abs(px), Math.abs(py));
    if (m > half + 0.6) return {h: 0, tint: 0.95};
    if (m > half - 0.9) return edge;
    return inner(u, v, i);
  };
};

// ---------------------------------------------------------------- 14.1 video-editing-skill
/** The vertical 1080 x 1920 frame of 14.1 (uv centre, height in pins). */
export const FRAME = {u: 0.66, v: 0.5, hPins: 62};
const frameW = (FRAME.hPins * 1080) / 1920;

/**
 * The playbook in pins (lines of raised text, left) and the vertical frame (right): the text safe
 * zone x 65-900, y 270-1248 raised mint, the platform-button regions (top 14 %, bottom 35 %,
 * left 6 %, right 17 %) sunk and red. `zones` 0 shows only the frame outline.
 */
export const videoField = (board: Board, zones: number): FieldFn => {
  const docU0 = 0.16;
  const docU1 = 0.44;
  const docV0 = 0.25;
  const docV1 = 0.76;
  return (u, v, i) => {
    // the frame
    const [px, py] = toPins(board, u - FRAME.u, v - FRAME.v);
    const s = px / frameW + 0.5;
    const t = 0.5 - py / FRAME.hPins; // from the top
    if (s >= -0.02 && s <= 1.02 && t >= -0.012 && t <= 1.012) {
      const border = s < 0 || s > 1 || t < 0 || t > 1;
      if (border) return {h: 0.45, tint: 1.0, glow: 0.15};
      if (zones <= 0) return {h: 0.06, tint: 0.55};
      const x = s * 1080;
      const y = t * 1920;
      const safe = x >= 65 && x <= 900 && y >= 270 && y <= 1248;
      if (safe) return {h: 0.32, tint: MINT, glow: 0.35};
      const platform = t < 0.14 || t > 0.65 || s < 0.06 || s > 0.83;
      if (platform) return {h: 0, tint: RED, paint: 0.7};
      return {h: 0.08, tint: 0.6};
    }
    // the playbook: one raised line of text per pin row, ragged right
    if (u >= docU0 && u <= docU1 && v >= docV0 && v <= docV1) {
      const row = board.row[i];
      if (row % 2 === 1) return {h: 0, tint: DARK + 0.2};
      const len = 0.45 + 0.55 * hash01(1407, row);
      const para = hash01(1413, row) < 0.12;
      const x = (u - docU0) / (docU1 - docU0);
      return x < (para ? 0.3 : len) ? {h: 0.16, tint: 0.95} : {h: 0, tint: DARK + 0.2};
    }
    return {h: 0, tint: STEEL_DIM};
  };
};
const STEEL_DIM = 0.62;

// ---------------------------------------------------------------- 14.2 the empty board and the fork
/** A blank board with only its border: the empty repository. */
export const emptyField = (board: Board): FieldFn =>
  rectField(board, {u: 0.6, v: 0.5, w: 70, h: 46, radius: 2}, {h: 0.04, tint: 0.5, soft: 0.5, ground: rectField(board, {u: 0.6, v: 0.5, w: 72, h: 48, radius: 2.5}, {h: 0.3, tint: 0.95, ground: STEEL_DIM})});

/** How many dim pins the fork field shows: the fork's commit count on GitHub (storyboard 14.2). */
export const FORK_PINS = 15299;

/** The first FORK_PINS pins from the top row down, dim; `lit` of his two commits raised mint. */
export const forkField = (board: Board, lit: number): FieldFn => {
  const start = Math.max(0, Math.floor((board.N - FORK_PINS) / 2));
  const end = start + FORK_PINS;
  // his two commits: two neighbouring pins right of centre (where the camera looks)
  const own = ownPins(board);
  return (_u, _v, i) => {
    if (i < start || i >= end) return {h: 0, tint: 0.4};
    const k = own.indexOf(i);
    if (k >= 0 && k < lit) return {h: 0.9, tint: MINT, glow: 1};
    return {h: 0.05, tint: 0.46 + 0.1 * hash01(1466, i)};
  };
};
const ownPins = (board: Board): [number, number] => {
  const i = pinAt(board, 0.64, 0.52);
  return [i, i + 1];
};
/** uv of the fork's lit pins (for labels). */
export const forkPinUv = (board: Board, k: number): [number, number] => {
  const i = ownPins(board)[k];
  return [board.u[i], board.v[i]];
};

// ---------------------------------------------------------------- 14.3 the map
export const mapLit = (board: Board, glow = 0.9): FieldFn => mapField(board, () => ({h: 0.55, tint: 1.0, glow, patch: 0.18}), flatField(0.5));
export {mapPlaces};

// ---------------------------------------------------------------- 14.5 the chain
export const CHAIN = {cols: 50, rows: 12, cell: 3, u: 0.5, v: 0.36};
/** The ledger as pin blocks, one per entry; the first `n` lit (mint), the rest dim. */
export const chainField = (board: Board, total: number): FieldFn => {
  const W = CHAIN.cols * CHAIN.cell;
  const H = CHAIN.rows * CHAIN.cell;
  return (u, v) => {
    const [px, py] = toPins(board, u - CHAIN.u, v - CHAIN.v);
    const lx = px + W / 2;
    const ly = H / 2 - py;
    const c = Math.floor(lx / CHAIN.cell);
    const r = Math.floor(ly / CHAIN.cell);
    if (c < 0 || r < 0 || c >= CHAIN.cols || r >= CHAIN.rows) return {h: 0, tint: 0.45};
    const k = r * CHAIN.cols + (r % 2 ? CHAIN.cols - 1 - c : c); // serpentine, one chain
    if (k >= total) return {h: 0, tint: 0.45};
    const inBlock = lx - c * CHAIN.cell < CHAIN.cell - 0.9 && ly - r * CHAIN.cell < CHAIN.cell - 0.9;
    return inBlock ? {h: 0.22, tint: 0.85} : {h: 0.04, tint: 0.55};
  };
};
/** Board uv of block k's centre. */
export const chainBlockUv = (board: Board, k: number): [number, number] => {
  const r = Math.floor(k / CHAIN.cols);
  const c0 = k % CHAIN.cols;
  const c = r % 2 ? CHAIN.cols - 1 - c0 : c0;
  const W = CHAIN.cols * CHAIN.cell;
  const H = CHAIN.rows * CHAIN.cell;
  const px = (c + 0.35) * CHAIN.cell - W / 2;
  const py = H / 2 - (r + 0.35) * CHAIN.cell;
  return [CHAIN.u + px * board.p, CHAIN.v + (py * board.p) / board.extH];
};

// ---------------------------------------------------------------- 14.6 the rule, raised
export const RULE_V = 0.4;
export const ruleField = (board: Board): FieldFn => ruleLineField(board, {v: RULE_V, u0: 0.1, u1: 0.9, rows: 1}, {h: 0.35, tint: MINT, glow: 1, ground: flatField(0.6)});

// ---------------------------------------------------------------- 14.8 the QR code
/** The QR as pins: a white plate of raised pins with the dark modules sunk. Module size in pins. */
export const qrField = (board: Board, rows: readonly string[], at: {u: number; v: number; module: number}, ground: FieldFn): FieldFn => {
  const n = rows.length;
  const quiet = 2;
  const total = n + 2 * quiet;
  const half = (total * at.module) / 2;
  return (u, v, i) => {
    const [px, py] = toPins(board, u - at.u, v - at.v);
    const lx = px + half;
    const ly = half - py;
    if (lx < 0 || ly < 0 || lx >= 2 * half || ly >= 2 * half) return ground(u, v, i);
    const c = Math.floor(lx / at.module) - quiet;
    const r = Math.floor(ly / at.module) - quiet;
    const dark = r >= 0 && c >= 0 && r < n && c < n && rows[r][c] === '1';
    return dark ? {h: 0, tint: 0.08, paint: 1} : {h: 0.4, tint: [1.15, 1.15, 1.15], paint: 1};
  };
};
