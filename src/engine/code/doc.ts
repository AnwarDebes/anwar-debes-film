import type {CodeDiff, CodeLine, CodeSnippet, DiffKind} from './types';

/**
 * A reference to one line of a document.
 * - snippet: a number is the file line number.
 * - diff: a number is the line number in the NEW file; `{a: n}` picks a row by
 *   its OLD line number (the only way to name a removed row).
 */
export type LineRef = number | {a: number} | {b: number};
export type LineRange = LineRef | [LineRef, LineRef];

export interface Row {
  key: string;
  kind: DiffKind;
  /** snippet: file line number; diff: undefined (see a / b) */
  line?: number;
  a?: number;
  b?: number;
  tokens: CodeLine;
  text: string;
  /** leading spaces after dedent */
  indent: number;
  blank: boolean;
}

export interface Doc {
  id: string;
  repo: string;
  path: string;
  lang: string;
  isDiff: boolean;
  rows: Row[];
  /** digits needed for the largest line number shown */
  digits: number;
  /** widest row, in columns */
  maxCols: number;
  dedent: number;
}

export type DocSource =
  | {snippet: CodeSnippet; lines?: [number, number]}
  | {diff: CodeDiff; hunk?: number; lines?: [number, number]};

const lineText = (l: CodeLine) => l.map((t) => t[0]).join('');

const stripIndent = (line: CodeLine, n: number): CodeLine => {
  if (n <= 0) return line;
  const out: CodeLine = [];
  let left = n;
  for (const [text, cls] of line) {
    if (left > 0) {
      const lead = text.length - text.trimStart().length;
      const cut = Math.min(left, lead);
      left -= cut;
      const rest = text.slice(cut);
      if (rest) out.push([rest, cls]);
      if (cut < lead || rest.trim()) left = 0;
    } else out.push([text, cls]);
  }
  return out;
};

const leading = (text: string) => text.length - text.trimStart().length;

export const buildDoc = (src: DocSource, dedent: boolean | number = false): Doc => {
  type Raw = {kind: DiffKind; line?: number; a?: number; b?: number; tokens: CodeLine};
  let raws: Raw[];
  let meta: {id: string; repo: string; path: string; lang: string; isDiff: boolean};

  if ('snippet' in src) {
    const s = src.snippet;
    const first = src.lines?.[0] ?? s.startLine;
    const last = src.lines?.[1] ?? s.startLine + s.lines.length - 1;
    raws = [];
    for (let n = first; n <= last; n++) {
      const tokens = s.lines[n - s.startLine];
      if (tokens) raws.push({kind: ' ', line: n, tokens});
    }
    meta = {id: s.id, repo: s.repo, path: s.path, lang: s.lang, isDiff: false};
  } else {
    const d = src.diff;
    const rows = d.hunks[src.hunk ?? 0]?.rows ?? [];
    let i0 = 0;
    let i1 = rows.length - 1;
    if (src.lines) {
      const [from, to] = src.lines;
      const iFrom = rows.findIndex((r) => r.b !== undefined && r.b >= from);
      let iTo = -1;
      rows.forEach((r, i) => {
        if (r.b !== undefined && r.b <= to) iTo = i;
      });
      if (iFrom >= 0) i0 = iFrom;
      if (iTo >= 0) i1 = iTo;
    }
    raws = rows.slice(i0, i1 + 1).map((r) => ({kind: r.k, a: r.a, b: r.b, tokens: r.t}));
    meta = {id: d.id, repo: d.repo, path: d.path, lang: d.lang, isDiff: true};
  }

  const indents = raws.map((r) => lineText(r.tokens)).filter((t) => t.trim()).map(leading);
  const common = indents.length ? Math.min(...indents) : 0;
  const cut = dedent === true ? common : dedent === false ? 0 : Math.min(dedent, common);

  const rows: Row[] = raws.map((r, i) => {
    const tokens = stripIndent(r.tokens, cut);
    const text = lineText(tokens);
    return {
      key: meta.isDiff ? `${r.kind}${r.a ?? ''}:${r.b ?? ''}:${i}` : `L${r.line}`,
      kind: r.kind,
      line: r.line,
      a: r.a,
      b: r.b,
      tokens,
      text,
      indent: leading(text),
      blank: text.trim() === '',
    };
  });

  const maxNum = Math.max(1, ...rows.map((r) => Math.max(r.line ?? 0, r.a ?? 0, r.b ?? 0)));
  return {
    ...meta,
    rows,
    digits: String(maxNum).length,
    maxCols: Math.max(0, ...rows.map((r) => r.text.length)),
    dedent: cut,
  };
};

/** Row index for a line reference, or -1. */
export const rowOf = (doc: Doc, ref: LineRef): number => {
  if (typeof ref === 'number') {
    return doc.isDiff ? doc.rows.findIndex((r) => r.b === ref) : doc.rows.findIndex((r) => r.line === ref);
  }
  if ('a' in ref) return doc.rows.findIndex((r) => r.a === ref.a);
  return doc.rows.findIndex((r) => r.b === ref.b);
};

/** Inclusive row index range for a line range (single refs give one row). */
export const rowsOf = (doc: Doc, range: LineRange): [number, number] => {
  const [from, to] = Array.isArray(range) ? range : [range, range];
  const a = rowOf(doc, from);
  const b = rowOf(doc, to);
  if (a < 0 || b < 0) return [-1, -1];
  return a <= b ? [a, b] : [b, a];
};

/** Widest row among an inclusive row range. */
export const colsIn = (doc: Doc, i0: number, i1: number): number => {
  let w = 0;
  for (let i = Math.max(0, i0); i <= Math.min(doc.rows.length - 1, i1); i++) w = Math.max(w, doc.rows[i].text.length);
  return w;
};

/** Column span of the n-th occurrence of `match` in a row, or null. */
export const findCols = (row: Row, match: string, occurrence = 0): [number, number] | null => {
  let from = 0;
  for (let k = 0; k <= occurrence; k++) {
    const i = row.text.indexOf(match, from);
    if (i < 0) return null;
    if (k === occurrence) return [i, i + match.length];
    from = i + 1;
  }
  return null;
};

/** Slice a row's tokens to its first `chars` characters. */
export const sliceTokens = (tokens: CodeLine, chars: number): CodeLine => {
  if (chars === Infinity) return tokens;
  const out: CodeLine = [];
  let left = Math.max(0, Math.floor(chars));
  for (const [text, cls] of tokens) {
    if (left <= 0) break;
    if (text.length <= left) {
      out.push([text, cls]);
      left -= text.length;
    } else {
      out.push([text.slice(0, left), cls]);
      left = 0;
    }
  }
  return out;
};
