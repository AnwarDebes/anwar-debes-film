import type {Row} from './doc';
import type {CodeClass} from './types';

// Token-level matching between two versions of code ("magic move").
// Code is split into atoms (identifiers, numbers, single symbols); a weighted
// longest common subsequence pairs atoms that survive, so identifiers carry
// more weight than punctuation and a stray comma never outbids a name. A
// second pass pairs identical names that moved out of order.

export interface Atom {
  text: string;
  cls: CodeClass;
  row: number;
  col: number;
  word: boolean;
}

const ATOM = /[A-Za-z0-9_$]+|\S/g;

export const atomize = (rows: Row[]): Atom[] => {
  const out: Atom[] = [];
  rows.forEach((row, r) => {
    let col = 0;
    for (const [text, cls] of row.tokens) {
      ATOM.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = ATOM.exec(text))) {
        const s = m[0];
        out.push({text: s, cls, row: r, col: col + m.index, word: /^[A-Za-z0-9_$]/.test(s)});
      }
      col += text.length;
    }
  });
  return out;
};

// Relative row of an atom in its block (0 top, 1 bottom): a match that would
// carry a token far up or down the block is worth less, so names stay on the
// line they belong to instead of flying across the panel.
const relRow = (atoms: Atom[]) => {
  const last = Math.max(1, ...atoms.map((x) => x.row));
  return (a: Atom) => a.row / last;
};

/** Weighted LCS; returns index pairs [ia, ib] in order. */
export const matchAtoms = (A: Atom[], B: Atom[]): Array<[number, number]> => {
  const n = A.length;
  const m = B.length;
  const ra = relRow(A);
  const rb = relRow(B);
  const weight = (a: Atom, b: Atom): number => {
    if (a.text !== b.text) return 0;
    const base = a.word ? 1 + Math.min(a.text.length, 12) / 3 : 0.55;
    const d = ra(a) - rb(b);
    return (a.cls === b.cls ? base + 0.15 : base) / (1 + 3 * d * d);
  };
  const W = m + 1;
  const dp = new Float32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const w = weight(A[i], B[j]);
      const diag = w > 0 ? dp[(i + 1) * W + j + 1] + w : 0;
      const down = dp[(i + 1) * W + j];
      const right = dp[i * W + j + 1];
      dp[i * W + j] = Math.max(diag, down, right);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const w = weight(A[i], B[j]);
    const here = dp[i * W + j];
    if (w > 0 && Math.abs(here - (dp[(i + 1) * W + j + 1] + w)) < 1e-4) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }
  // moved names: identical identifiers (4+ chars) left unpaired that sit at a
  // similar height in both blocks (reordered arguments, swapped lines)
  const usedA = new Set(pairs.map((p) => p[0]));
  const usedB = new Set(pairs.map((p) => p[1]));
  for (let ia = 0; ia < n; ia++) {
    if (usedA.has(ia) || !A[ia].word || A[ia].text.length < 4) continue;
    let best = -1;
    let bestD = Infinity;
    for (let ib = 0; ib < m; ib++) {
      if (usedB.has(ib) || B[ib].text !== A[ia].text) continue;
      if (Math.abs(ra(A[ia]) - rb(B[ib])) > 0.34) continue;
      const d = Math.abs(B[ib].row - A[ia].row) * 4 + Math.abs(B[ib].col - A[ia].col);
      if (d < bestD) (bestD = d), (best = ib);
    }
    if (best >= 0) {
      pairs.push([ia, best]);
      usedA.add(ia);
      usedB.add(best);
    }
  }
  return pairs;
};

export interface MorphPlan {
  A: Atom[];
  B: Atom[];
  /** for each atom of A: index in B, or -1 if it leaves */
  aToB: Int32Array;
  /** for each atom of B: index in A, or -1 if it arrives */
  bToA: Int32Array;
}

export const planMorph = (rowsA: Row[], rowsB: Row[]): MorphPlan => {
  const A = atomize(rowsA);
  const B = atomize(rowsB);
  const aToB = new Int32Array(A.length).fill(-1);
  const bToA = new Int32Array(B.length).fill(-1);
  for (const [ia, ib] of matchAtoms(A, B)) {
    aToB[ia] = ib;
    bToA[ib] = ia;
  }
  return {A, B, aToB, bToA};
};

/**
 * Changed column spans between an old and a new line (for word-level diff
 * emphasis). Spans separated only by spaces are merged.
 */
export const changedSpans = (oldRow: Row, newRow: Row): {old: Array<[number, number]>; new: Array<[number, number]>} => {
  const A = atomize([oldRow]);
  const B = atomize([newRow]);
  const pairs = matchAtoms(A, B);
  const keepA = new Set(pairs.map((p) => p[0]));
  const keepB = new Set(pairs.map((p) => p[1]));
  const spans = (atoms: Atom[], keep: Set<number>, text: string) => {
    const out: Array<[number, number]> = [];
    atoms.forEach((a, i) => {
      if (keep.has(i)) return;
      const s: [number, number] = [a.col, a.col + a.text.length];
      const last = out[out.length - 1];
      if (last && text.slice(last[1], s[0]).trim() === '') last[1] = s[1];
      else out.push(s);
    });
    return out;
  };
  return {old: spans(A, keepA, oldRow.text), new: spans(B, keepB, newRow.text)};
};

/** Similarity of two lines in 0..1 (shared atom weight over the larger side). */
export const similarity = (a: Row, b: Row): number => {
  const A = atomize([a]);
  const B = atomize([b]);
  if (!A.length || !B.length) return 0;
  const pairs = matchAtoms(A, B);
  const shared = pairs.reduce((s, [i]) => s + A[i].text.length, 0);
  const total = Math.max(
    A.reduce((s, x) => s + x.text.length, 0),
    B.reduce((s, x) => s + x.text.length, 0),
  );
  return shared / total;
};

/**
 * Pairs removed rows with the added rows that replace them, inside each
 * change block of a diff (consecutive '-' rows followed by '+' rows).
 */
export const pairChanges = (rows: Row[]): Map<number, number> => {
  const pairs = new Map<number, number>();
  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind === ' ') {
      i++;
      continue;
    }
    const dels: number[] = [];
    const adds: number[] = [];
    while (i < rows.length && rows[i].kind !== ' ') {
      (rows[i].kind === '-' ? dels : adds).push(i);
      i++;
    }
    const free = new Set(adds);
    for (const d of dels) {
      let best = -1;
      let bestS = 0.45;
      for (const a of free) {
        const s = similarity(rows[d], rows[a]);
        if (s > bestS) (bestS = s), (best = a);
      }
      if (best >= 0) {
        pairs.set(d, best);
        pairs.set(best, d);
        free.delete(best);
      }
    }
  }
  return pairs;
};
