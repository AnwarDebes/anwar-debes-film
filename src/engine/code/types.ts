// Data contracts for code panels. Produced by scripts/code/highlight.mjs,
// consumed by <CodePanel>. Line numbers are always the real file line numbers.

/** Semantic token class; the palette is in theme.ts. '' is plain text or whitespace. */
export type CodeClass =
  | ''
  | 'kw'
  | 'fn'
  | 'type'
  | 'const'
  | 'str'
  | 'num'
  | 'com'
  | 'prop'
  | 'var'
  | 'param'
  | 'self'
  | 'op'
  | 'punc'
  | 'dec'
  | 'esc';

export type CodeToken = [text: string, cls: CodeClass];
export type CodeLine = CodeToken[];

export interface CodeSnippet {
  kind: 'snippet';
  id: string;
  /** owner/name on GitHub */
  repo: string;
  /** full commit SHA the file was taken from */
  ref: string;
  path: string;
  lang: string;
  /** file line number of lines[0] */
  startLine: number;
  lines: CodeLine[];
}

export type DiffKind = ' ' | '-' | '+';

export interface DiffRow {
  k: DiffKind;
  /** line number in the old file (context and removed rows) */
  a?: number;
  /** line number in the new file (context and added rows) */
  b?: number;
  t: CodeLine;
}

export interface CodeDiff {
  kind: 'diff';
  id: string;
  repo: string;
  path: string;
  lang: string;
  from: string;
  to: string;
  message: string;
  hunks: Array<{rows: DiffRow[]}>;
}

/** Window header. `label` is set in mono caps (defaults to the repo name). */
export interface CodeHeader {
  label?: string;
  path: string;
  /** right-aligned detail, e.g. a function name or a short commit SHA */
  meta?: string;
}
