import data from '../../../data/ch02/glassbox.json';
import {rectField, tileGridField, type Board, type FieldFn, type Look, type PinSample} from '../../../engine/pins';

// The 91 registered hypotheses of glassbox-lm's first study as a 13 x 7 board of pin tiles, in the
// order of the families (H1 to H6 registered on 22 Sep, H8 to H17 added on 24-25 Sep, after the
// anchor run). Within a family the tiles follow the overview's columns: met, not met, not judged,
// not run (the per-family counts of docs/results-overview.md:15-30).

export const GB = data;

export type Verdict = 'met' | 'notMet' | 'notJudged' | 'notRun';

export interface Tile {
  k: number;
  family: string;
  verdict: Verdict;
  /** registered on 22 Sep (the first 24) or added on 24-25 Sep */
  early: boolean;
}

export const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (const r of data.families.rows) {
    const early = r.date === '2026-09-22';
    const push = (n: number, verdict: Verdict) => {
      for (let j = 0; j < n; j++) out.push({k: out.length, family: r.f, verdict, early});
    };
    push(r.met, 'met');
    push(r.notMet, 'notMet');
    push(r.notJudged, 'notJudged');
    push(r.notRun, 'notRun');
  }
  return out;
})();

export const EARLY_N = TILES.filter((t) => t.early).length;

export interface BoardLayout {
  u: number;
  v: number;
  cell: number;
}

export const COLS = 13;
export const ROWS = 7;

/** Tile k's centre in board uv. */
export const tileUV = (b: Board, L: BoardLayout, k: number): [number, number] => {
  const c = k % COLS;
  const r = Math.floor(k / COLS);
  const W = COLS * L.cell;
  const H = ROWS * L.cell;
  const x = -W / 2 + (c + 0.5) * L.cell;
  const y = H / 2 - (r + 0.5) * L.cell;
  return [L.u + x * b.p, L.v + (y * b.p) / b.extH];
};

/**
 * The board at one stage of the chapter: 'early' (the 24 of 22 Sep raised, steel), 'all' (all 91
 * raised, steel, the 67 with an outline), 'verdict' (tint first, then height: met raised mint,
 * not met sunk, not judged at half height, not run flat with an outline).
 */
export const hypothesisField = (b: Board, L: BoardLayout, stage: 'empty' | 'early' | 'all' | 'verdict', ground: FieldFn): FieldFn => {
  const steel: Look = {h: 0.3, tint: 1.0, glow: 0.12};
  const empty: Look = {h: 0.0, tint: 0.3};
  const looks: Record<Verdict, Look> = {
    met: {h: 0.42, tint: 1.0, glow: 0.75},
    notMet: {h: 0.05, tint: 0.62},
    notJudged: {h: 0.2, tint: 0.8},
    notRun: {h: 0.0, tint: 0.4},
  };
  const tile = (c: number, r: number): Look | null => {
    const k = r * COLS + c;
    const t = TILES[k];
    if (!t) return null;
    if (stage === 'empty') return empty;
    if (stage === 'early') return t.early ? steel : empty;
    if (stage === 'all') return t.early ? steel : {h: 0.26, tint: 0.7};
    return looks[t.verdict];
  };
  const grid = tileGridField(b, {u: L.u, v: L.v, cols: COLS, rows: ROWS, cell: L.cell, gap: 1.4, radius: 1.2}, tile, {ground});
  if (stage !== 'verdict') return grid;
  // not run: a flat tile with a raised outline (the calm "never ran" glyph)
  const W = COLS * L.cell;
  const H = ROWS * L.cell;
  const half = (L.cell - 1.4) / 2;
  return (u, v, i): PinSample => {
    const s = grid(u, v, i);
    const lx = (u - L.u) / b.p + W / 2;
    const ly = H / 2 - ((v - L.v) * b.extH) / b.p;
    const c = Math.floor(lx / L.cell);
    const r = Math.floor(ly / L.cell);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return s;
    const tl = TILES[r * COLS + c];
    if (!tl || tl.verdict !== 'notRun') return s;
    const dx = Math.abs(lx - (c + 0.5) * L.cell);
    const dy = Math.abs(ly - (r + 0.5) * L.cell);
    if (dx > half || dy > half) return s;
    // the ring: the outermost pin of the tile stands a step up, the middle stays flat
    return Math.max(dx, dy) > half - 1.0 ? {h: 0.14, tint: 0.62} : s;
  };
};

/** A document page in pins: a plate with raised text lines (the pre-registration). */
export const pageField = (b: Board, P: {u: number; v: number; w: number; h: number; lines: number; seed?: number}, ground: FieldFn): FieldFn => {
  const plate = rectField(b, {u: P.u, v: P.v, w: P.w, h: P.h, radius: 1.5}, {h: 0.05, tint: 0.62, soft: 0.6, ground});
  const lineH = 1.4;
  const top = P.h / 2 - 4;
  const step = (P.h - 8) / Math.max(1, P.lines - 1);
  return (u, v, i) => {
    const base = plate(u, v, i);
    const x = (u - P.u) / b.p;
    const y = ((v - P.v) * b.extH) / b.p;
    if (Math.abs(x) > P.w / 2 - 3 || Math.abs(y) > P.h / 2 - 2.5) return base;
    const k = Math.round((top - y) / step);
    if (k < 0 || k >= P.lines) return base;
    const yk = top - k * step;
    if (Math.abs(y - yk) > lineH / 2) return base;
    // ragged right edge, seeded per line
    const len = (0.55 + 0.4 * Math.abs(Math.sin((k + 1) * 12.9898 + (P.seed ?? 0)))) * (P.w - 6);
    if (x + P.w / 2 - 3 > len) return base;
    return {h: k === 0 ? 0.22 : 0.14, tint: k === 0 ? 1.0 : 0.9};
  };
};
