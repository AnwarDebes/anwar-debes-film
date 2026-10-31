import guardData from '../../../data/ch01/guard.json';
import {pinAt, type Board, type FieldFn, type LiveFieldFn, type PinSample} from '../../../engine/pins';

// The site's content guard in pins: the 256 word features of a prompt as a 16 x 16 field of literal
// pins (raised = word present), and the clause votes as two tally columns. The data is the shipped
// model's own verdicts (data/ch01/guard.json, re-derived with the logic of assets/js/trace.js).

export interface GuardPrompt {
  label: string;
  text: string;
  unsafe: boolean;
  margin: number;
  forUnsafe: number;
  forSafe: number;
  present: string[];
  presentIdx: number[];
  fired: Array<{c: number; unsafe: boolean; present: string[]; absentCount: number}>;
}

export const GUARD = guardData as unknown as {
  sha256: string;
  n_clauses: number;
  n_features: number;
  nonEmptyClauses: number;
  prompts: GuardPrompt[];
  andExample: {c: number; literals: Array<{word: string; idx: number; negated: boolean}>};
};

export interface GuardLayout {
  cu: number;
  cv: number;
  /** pins between literal centres */
  s: number;
}

export interface Cell {
  k: number;
  u: number;
  v: number;
  pin: number;
}

const cellCache = new Map<string, Cell[]>();

export const literalCells = (board: Board, L: GuardLayout): Cell[] => {
  const key = `${board.key}|${L.cu}|${L.cv}|${L.s}`;
  const hit = cellCache.get(key);
  if (hit) return hit;
  const out: Cell[] = [];
  for (let k = 0; k < 256; k++) {
    const col = k % 16;
    const row = Math.floor(k / 16);
    const u = L.cu + (col - 7.5) * L.s * board.p;
    const v = L.cv + ((7.5 - row) * L.s * board.p) / board.extH;
    out.push({k, u, v, pin: pinAt(board, u, v)});
  }
  cellCache.set(key, out);
  return out;
};

/** Words of a prompt that cast unsafe votes, with how many clauses fired on each. */
export const unsafeWords = (p: GuardPrompt): Map<string, number> => {
  const m = new Map<string, number>();
  for (const f of p.fired) if (f.unsafe) for (const w of f.present) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
};

export const gridBox = (board: Board, L: GuardLayout) => {
  const hw = (8 * L.s + 1.2) * board.p;
  const hh = ((8 * L.s + 1.2) * board.p) / board.extH;
  return {u0: L.cu - hw, u1: L.cu + hw, v0: L.cv - hh, v1: L.cv + hh};
};

/**
 * The literal field of one prompt (null: every literal false). Present words stand raised and white;
 * words that fired an unsafe clause glow; absent words sit low and dark on a darker plate.
 */
export const guardField = (board: Board, L: GuardLayout, p: GuardPrompt | null, ground: FieldFn, o: {glowFired?: boolean; plate?: boolean} = {}): FieldFn => {
  const cells = literalCells(board, L);
  const byPin = new Map<number, number>();
  for (const c of cells) byPin.set(c.pin, c.k);
  const present = new Set(p?.presentIdx ?? []);
  const hot = new Set<number>();
  if (p && o.glowFired !== false) {
    const uw = unsafeWords(p);
    p.present.forEach((w, j) => {
      if (uw.has(w)) hot.add(p.presentIdx[j]);
    });
  }
  const box = gridBox(board, L);
  const plate = o.plate !== false;
  const on: PinSample = {h: 0.26, tint: 1.0, glow: 0.22};
  const onHot: PinSample = {h: 0.3, tint: 1.0, glow: 0.85};
  const off: PinSample = {h: 0, tint: 0.2};
  const plateS: PinSample = {h: 0.04, tint: 0.72};
  return (u, v, i) => {
    const k = byPin.get(i);
    if (k !== undefined) return present.has(k) ? (hot.has(k) ? onHot : on) : off;
    if (plate && u > box.u0 && u < box.u1 && v > box.v0 && v < box.v1) return plateS;
    return ground(u, v, i);
  };
};

export interface TallyLayout {
  /** u of the unsafe column centre; the safe column sits `gap` pins to its right */
  u: number;
  /** v of the base */
  v: number;
  gap: number;
  /** pins per column */
  width: number;
}

/** One step of the tally: from `at`, the columns count up to the prompt's votes. */
export interface TallyStep {
  at: number;
  unsafe: number;
  safe: number;
}

/** The vote columns as a live layer: each fired clause stacks one row, counting up in 0.06 s steps. */
export const tallyLayer = (board: Board, T: TallyLayout, steps: readonly TallyStep[], until: number, rowsPerVote = 2): {fn: LiveFieldFn; region: [number, number, number, number]} => {
  const rows = 13 * rowsPerVote;
  const colHalf = (T.width / 2) * board.p;
  const uU = T.u;
  const uS = T.u + T.gap * board.p;
  const rowV = board.rowH / board.extH;
  const region: [number, number, number, number] = [uU - colHalf - board.p, T.v - rowV, uS + colHalf + board.p, T.v + (rows + 1) * rowV];
  const shown = (n: number, at: number, t: number) => Math.min(n, Math.floor(Math.max(0, t - at) / 0.06));
  const base: PinSample = {h: 0.02, tint: 0.55};
  const sU: PinSample = {h: 0.24, tint: 1.0, glow: 0};
  const sS: PinSample = {h: 0.24, tint: 1.0, glow: 0};
  const fn: LiveFieldFn = (u, v, _i, t) => {
    if (t > until) return null;
    let step: TallyStep | null = null;
    for (const s of steps) if (s.at <= t) step = s;
    const inU = Math.abs(u - uU) <= colHalf + 1e-6;
    const inS = Math.abs(u - uS) <= colHalf + 1e-6;
    if (!inU && !inS) return null;
    const r = Math.round((v - T.v) / rowV);
    if (r < 0 || r > rows) return null;
    if (!step) return base;
    const n = (inU ? shown(step.unsafe, step.at, t) : shown(step.safe, step.at, t)) * rowsPerVote;
    // a hairline gap between votes, so the count can be read
    if (r < n) return r % rowsPerVote === rowsPerVote - 1 && rowsPerVote > 1 ? {h: 0.12, tint: 0.85} : inU ? sU : sS;
    return base;
  };
  return {fn, region};
};
