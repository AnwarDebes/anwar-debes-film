import type {WordTag} from '../narration/types';
import {advance, inkWidth, type FontSpec} from './metrics';

// Word layout: every run is measured once, lines are broken once, and the
// result is drawn at fixed positions, so nothing shifts as words appear.

export interface LayoutInput {
  /** display text (already typographic) */
  text: string;
  tag: WordTag;
  font: FontSpec;
}

export interface PlacedRun extends LayoutInput {
  /** index in the input sequence */
  i: number;
  line: number;
  /** left edge in px, relative to the block box */
  x: number;
  /** visible width (no trailing letter-spacing) */
  w: number;
  /** underline width: the word without trailing punctuation */
  ulW: number;
}

export interface LineBox {
  first: number;
  last: number;
  /** px, relative to the block box */
  x: number;
  width: number;
}

export interface BlockLayout {
  runs: PlacedRun[];
  lines: LineBox[];
  /** widest line */
  width: number;
  /** width of the box the lines are aligned in */
  boxWidth: number;
}

export type Align = 'left' | 'center' | 'right';

interface Measured {
  w: number;
  ulW: number;
  /** pen advance from this run's left edge to the next run's left edge */
  step: number;
}

const TRAILING_PUNCT = /[.,:;!?…”’")\]]+$/u;
const SENTENCE_END = /[.!?…][”’")]*$/u;
const CLAUSE_END = /[,;:—–][”’")]*$/u;
const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'or', 'but', 'nor', 'with',
  'his', 'her', 'its', 'your', 'our', 'their', 'my', 'is', 'are', 'was', 'as', 'from', 'into', 'than', 'every', 'each',
]);

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Gap added after an italic run that is followed by an upright one (em of the italic run). */
const ITALIC_CORRECTION_EM = 0.045;

const measureAll = (items: LayoutInput[]): Measured[] =>
  items.map((it, i) => {
    const next = items[i + 1];
    const w = inkWidth(it.text, it.font);
    const stripped = it.text.replace(TRAILING_PUNCT, '');
    const ulW = stripped.length > 0 && stripped !== it.text ? inkWidth(stripped, it.font) : w;
    let step = advance(it.text, it.font) + advance(' ', it.font);
    if (next && it.font.style === 'italic' && next.font.style !== 'italic') step += ITALIC_CORRECTION_EM * it.font.size;
    return {w, ulW, step};
  });

const lineWidth = (m: Measured[], a: number, b: number): number => {
  // items a..b inclusive
  let x = 0;
  for (let i = a; i < b; i++) x += m[i].step;
  return x + m[b].w;
};

const CONJUNCTIONS = new Set(['and', 'or', 'but', 'nor', 'so', 'yet']);
const SUBORDINATORS = new Set([
  'that', 'which', 'who', 'whose', 'whom', 'where', 'when', 'while', 'because', 'if', 'whether', 'though', 'although', 'unless', 'until', 'since',
]);

/**
 * Cost of breaking a line after item `k` (before k + 1). Negative is good.
 * Subtitle practice: break after punctuation even at some imbalance, before
 * a conjunction or a relative clause; never after an article or a
 * preposition, never inside "X of Y", an idea phrase or a name.
 */
const breakPenalty = (items: LayoutInput[], k: number): number => {
  const prev = items[k];
  const next = items[k + 1];
  let p = 0;
  if (SENTENCE_END.test(prev.text)) p -= 0.1;
  else if (CLAUSE_END.test(prev.text)) p -= 0.08;
  if (next) {
    const nx = norm(next.text);
    // the idea phrase is one visual unit: split it only when nothing else fits
    if (prev.tag === 'em' && next.tag === 'em') p += 0.12;
    if ((prev.tag === 'key' || prev.tag === 'name') && next.tag === prev.tag && !CLAUSE_END.test(prev.text)) p += 0.06;
    if (nx === 'of') p += 0.05;
    if (CONJUNCTIONS.has(nx) || SUBORDINATORS.has(nx)) p -= 0.02;
  }
  if (FUNCTION_WORDS.has(norm(prev.text)) && !CLAUSE_END.test(prev.text)) p += 0.05;
  return p;
};

/** Fewest lines that hold items a..b (inclusive) at maxWidth, greedy. Infinity if a single item overflows. */
const minLines = (m: Measured[], a: number, b: number, maxWidth: number): number => {
  let lines = 1;
  let start = a;
  for (let i = a; i <= b; i++) {
    if (m[i].w > maxWidth + 0.5) return Infinity;
    if (i > start && lineWidth(m, start, i) > maxWidth + 0.5) {
      lines++;
      start = i;
    }
  }
  return lines;
};

interface Breaks {
  cost: number;
  /** index of the first item of each line after the first */
  starts: number[];
}

/**
 * Best way to set items a..b on exactly `L` lines: balanced widths, breaks
 * after punctuation, no dangling function words, no split idea phrases,
 * no single-word last line.
 */
const bestBreaks = (items: LayoutInput[], m: Measured[], a: number, b: number, L: number, maxWidth: number, balance: number): Breaks | null => {
  if (L === 1) return lineWidth(m, a, b) <= maxWidth + 0.5 ? {cost: 0, starts: []} : null;
  const n = b - a + 1;
  const total = lineWidth(m, a, b);
  const target = total / L;
  const lineCost = (s: number, e: number): number => {
    const wd = lineWidth(m, s, e);
    if (wd > maxWidth + 0.5) return Infinity;
    const d = (wd - target) / maxWidth;
    return balance * d * d + (s === e ? 0.06 : 0);
  };
  // dp[l][i]: best cost to set items a..a+i-1 on l lines
  const dp: number[][] = Array.from({length: L + 1}, () => new Array<number>(n + 1).fill(Infinity));
  const from: number[][] = Array.from({length: L + 1}, () => new Array<number>(n + 1).fill(-1));
  dp[0][0] = 0;
  for (let l = 1; l <= L; l++) {
    for (let i = l; i <= n; i++) {
      for (let s = l - 1; s < i; s++) {
        if (dp[l - 1][s] === Infinity) continue;
        const c = lineCost(a + s, a + i - 1);
        if (c === Infinity) continue;
        const pen = i < n ? breakPenalty(items, a + i - 1) : 0;
        const v = dp[l - 1][s] + c + pen;
        if (v < dp[l][i]) {
          dp[l][i] = v;
          from[l][i] = s;
        }
      }
    }
  }
  if (dp[L][n] === Infinity) return null;
  const starts: number[] = [];
  let i = n;
  for (let l = L; l > 1; l--) {
    const s = from[l][i];
    starts.unshift(a + s);
    i = s;
  }
  return {cost: dp[L][n], starts};
};

const place = (items: LayoutInput[], m: Measured[], a: number, b: number, starts: number[], boxWidth: number, align: Align): BlockLayout => {
  const lineStarts = [a, ...starts];
  const lines: LineBox[] = [];
  const runs: PlacedRun[] = [];
  lineStarts.forEach((s, li) => {
    const e = li + 1 < lineStarts.length ? lineStarts[li + 1] - 1 : b;
    const width = lineWidth(m, s, e);
    const x0 = align === 'left' ? 0 : align === 'right' ? boxWidth - width : (boxWidth - width) / 2;
    lines.push({first: s - a, last: e - a, x: x0, width});
    let x = x0;
    for (let i = s; i <= e; i++) {
      runs.push({...items[i], i: i - a, line: li, x, w: m[i].w, ulW: m[i].ulW});
      x += m[i].step;
    }
  });
  return {runs, lines, width: Math.max(...lines.map((l) => l.width)), boxWidth};
};

export interface BlockOptions {
  maxWidth: number;
  maxLines?: number;
  align?: Align;
  /** weight of line balance against break quality (1 = captions) */
  balance?: number;
  /** box width the lines are aligned in (defaults to maxWidth) */
  boxWidth?: number;
}

/**
 * Lay out a block of runs: the fewest lines that fit, broken for balance
 * and sense. When the text cannot fit in maxLines (or one word is wider than
 * the box) it is set greedily on as many lines as it needs, overflowing if it
 * must: text is never dropped.
 */
export const layoutBlock = (items: LayoutInput[], opts: BlockOptions): BlockLayout => {
  if (items.length === 0) return {runs: [], lines: [], width: 0, boxWidth: opts.boxWidth ?? opts.maxWidth};
  const m = measureAll(items);
  return layoutMeasured(items, m, 0, items.length - 1, opts) ?? greedy(items, m, opts);
};

const greedy = (items: LayoutInput[], m: Measured[], opts: BlockOptions): BlockLayout => {
  const starts: number[] = [];
  let s = 0;
  for (let i = 1; i < items.length; i++) {
    if (lineWidth(m, s, i) > opts.maxWidth + 0.5) {
      starts.push(i);
      s = i;
    }
  }
  return place(items, m, 0, items.length - 1, starts, opts.boxWidth ?? opts.maxWidth, opts.align ?? 'center');
};

const layoutMeasured = (items: LayoutInput[], m: Measured[], a: number, b: number, opts: BlockOptions): BlockLayout | null => {
  const maxLines = opts.maxLines ?? 2;
  const L = minLines(m, a, b, opts.maxWidth);
  if (L > maxLines) return null;
  const br = bestBreaks(items, m, a, b, L, opts.maxWidth, opts.balance ?? 1);
  if (!br) return null;
  return place(items, m, a, b, br.starts, opts.boxWidth ?? opts.maxWidth, opts.align ?? 'center');
};

export interface TimedInput extends LayoutInput {
  start: number;
  end: number;
}

export interface Page {
  /** first and last input index (inclusive) */
  from: number;
  to: number;
  layout: BlockLayout;
}

/**
 * Split a spoken sentence into caption pages of at most maxLines lines.
 * Prefers few pages, page ends at sentence or clause punctuation and at
 * pauses in the voice, and pages that stay up long enough to read.
 */
export const paginate = (items: TimedInput[], opts: BlockOptions): Page[] => {
  const n = items.length;
  if (n === 0) return [];
  const m = measureAll(items);
  const maxLines = opts.maxLines ?? 2;
  const endPenalty = (k: number): number => {
    if (k === n - 1) return 0;
    const it = items[k];
    let p = SENTENCE_END.test(it.text) ? 0.05 : CLAUSE_END.test(it.text) ? 0.2 : 1.0;
    const gap = items[k + 1].start - it.end;
    if (gap >= 0.3) p -= 0.15;
    else if (gap >= 0.12) p -= 0.1;
    const next = items[k + 1];
    if ((it.tag === 'key' || it.tag === 'name') && next.tag === it.tag && !CLAUSE_END.test(it.text)) p += 0.5;
    if (it.tag === 'em' && next.tag === 'em') p += 0.3;
    return p;
  };
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      const L = minLines(m, i, j - 1, opts.maxWidth);
      if (L > maxLines) break; // longer pages only get worse
      if (best[i] === Infinity) continue;
      const br = bestBreaks(items, m, i, j - 1, L, opts.maxWidth, opts.balance ?? 1);
      if (!br) continue;
      const dur = items[j - 1].end - items[i].start;
      let c = 1 + endPenalty(j - 1) + 0.6 * br.cost;
      if (dur < 1.0) c += 0.4;
      // a block that stays up for a long sentence is hard to follow: past
      // about 6 s, a page turn at a clause boundary is cheaper
      if (dur > 6.0) c += (dur - 6.0) * 0.35;
      if (j - i < 3 && n > 3) c += 0.3;
      const v = best[i] + c;
      if (v < best[j]) {
        best[j] = v;
        from[j] = i;
      }
    }
  }
  if (best[n] === Infinity) {
    // a word wider than the box: one word per page, never drop text
    return items.map((_, k) => ({from: k, to: k, layout: place(items, m, k, k, [], opts.boxWidth ?? opts.maxWidth, opts.align ?? 'center')}));
  }
  const cuts: Array<[number, number]> = [];
  let j = n;
  while (j > 0) {
    const i = from[j];
    cuts.unshift([i, j - 1]);
    j = i;
  }
  return cuts.map(([a, b]) => {
    const lay = layoutMeasured(items, m, a, b, opts);
    return {from: a, to: b, layout: lay ?? place(items, m, a, b, [], opts.boxWidth ?? opts.maxWidth, opts.align ?? 'center')};
  });
};
