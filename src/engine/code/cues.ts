import {random} from 'remotion';
import {clamp01, easeCamera, easeText, easeUi, envelope, lerp, prog} from './anim';
import {findCols, rowOf, rowsOf, type Doc, type LineRange, type LineRef} from './doc';
import {codeMetrics, type CodeMetrics} from './metrics';
import {pairChanges, changedSpans} from './morph';

// Cues describe what a code panel does over time. Every time is in seconds on
// the panel's clock (by default the frame of the enclosing Sequence over fps;
// pass film time to sync with narration). Evaluating a cue list at t is pure.

export type RevealStyle = 'rise' | 'wipe' | 'fade';
export type AnnotationSide = 'end' | 'right' | 'left' | 'above' | 'below';

export interface RevealCue {
  type: 'reveal';
  at: number;
  /** rows to reveal (default: every row of the page) */
  lines?: LineRange;
  /** seconds between non-blank lines (default 0.12) */
  stagger?: number;
  /** per-line duration (default 0.42) */
  dur?: number;
  style?: RevealStyle;
  /** explicit start time per non-blank line (e.g. narration word starts); overrides stagger */
  times?: number[];
}

export interface TypeCue {
  type: 'type';
  at: number;
  line: LineRef;
  /** characters per second (default 34) */
  cps?: number;
  /** 0..1 rhythm irregularity (default 0.5), seeded, deterministic */
  jitter?: number;
  seed?: string;
  caret?: boolean;
  /** seconds the caret keeps blinking after the line is typed (default 0.9) */
  caretHold?: number;
}

export interface HighlightCue {
  type: 'highlight';
  at: number;
  lines: LineRange;
  until?: number;
}

export interface FocusCue {
  type: 'focus';
  at: number;
  lines: LineRange;
  /** scroll / zoom duration (default 1.2) */
  dur?: number;
  /** opacity left on rows outside the focus (default 0.26) */
  dim?: number;
  /** blur on rows outside the focus, fraction of H (default 0.0011) */
  blur?: number;
  /** code zoom while focused (default: unchanged) */
  zoom?: number;
  align?: 'center' | 'top';
  /** set false to dim without scrolling */
  scroll?: boolean;
  until?: number;
}

export interface ScrollCue {
  type: 'scroll';
  at: number;
  to: LineRange;
  dur?: number;
  align?: 'center' | 'top';
}

export interface AnnotateCue {
  type: 'annotate';
  at: number;
  line: LineRef;
  /** text to attach to (first occurrence, or `occurrence`) */
  match?: string;
  occurrence?: number;
  /** explicit column span instead of `match` */
  cols?: [number, number];
  /** label text; *words* in asterisks are set as the mint italic idea word */
  label: string;
  /** optional mono caps line above the label */
  kicker?: string;
  side?: AnnotationSide;
  /** connector end on the token: an arrowhead (default) or a dot */
  marker?: 'arrow' | 'dot';
  /** label offset [dx, dy] as fractions of H */
  offset?: [number, number];
  until?: number;
}

export interface DiffCue {
  type: 'diff';
  /** removed rows turn red */
  mark: number;
  /** added rows open and appear */
  add: number;
  /** the edit is accepted: removed rows close, colours settle, numbers update */
  apply?: number;
  /** instead of `apply`: accept this many seconds after the last added row is in */
  applyAfterTyping?: number;
  /** type added rows at this many characters per second (false: wipe them in) */
  typeCps?: number | false;
  /** seconds between added rows (default 0.16) */
  stagger?: number;
}

export type CodeCue = RevealCue | TypeCue | HighlightCue | FocusCue | ScrollCue | AnnotateCue | DiffCue;

type Opts<T> = Omit<T, 'type' | 'at'>;

/** Small builders so scenes read like a shot list. */
export const cue = {
  reveal: (at: number, o: Opts<RevealCue> = {}): RevealCue => ({type: 'reveal', at, ...o}),
  type: (at: number, line: LineRef, o: Omit<Opts<TypeCue>, 'line'> = {}): TypeCue => ({type: 'type', at, line, ...o}),
  highlight: (at: number, lines: LineRange, o: Omit<Opts<HighlightCue>, 'lines'> = {}): HighlightCue => ({
    type: 'highlight',
    at,
    lines,
    ...o,
  }),
  focus: (at: number, lines: LineRange, o: Omit<Opts<FocusCue>, 'lines'> = {}): FocusCue => ({
    type: 'focus',
    at,
    lines,
    ...o,
  }),
  scroll: (at: number, to: LineRange, o: Omit<Opts<ScrollCue>, 'to'> = {}): ScrollCue => ({type: 'scroll', at, to, ...o}),
  annotate: (
    at: number,
    line: LineRef,
    label: string,
    o: Omit<Opts<AnnotateCue>, 'line' | 'label'> = {},
  ): AnnotateCue => ({type: 'annotate', at, line, label, ...o}),
  diff: (o: Omit<DiffCue, 'type'>): DiffCue => ({type: 'diff', ...o}),
};

// ---------------------------------------------------------------------------

export interface RowView {
  /** reveal / collapse opacity (focus dimming is separate) */
  alpha: number;
  dy: number;
  blur: number;
  /** wipe reveal progress, 1 = fully shown */
  wipe: number;
  /** visible characters (Infinity = all) */
  chars: number;
  /** row height factor 0..1 (diff rows open and close) */
  height: number;
  /** focus factor: 1 in focus, lower when dimmed */
  focus: number;
  focusBlur: number;
  /** highlight amount 0..1 */
  hl: number;
  /** diff: removed mark, added mark, settled after apply */
  del: number;
  add: number;
  settle: number;
  /** word-level emphasis spans (columns) and their opacity */
  emph: Array<[number, number]>;
  emphAlpha: number;
}

export interface NoteView {
  key: string;
  row: number;
  c0: number;
  c1: number;
  cue: AnnotateCue;
  ring: number;
  wire: number;
  label: number;
  alpha: number;
}

export interface ViewState {
  m: CodeMetrics;
  zoom: number;
  scroll: number;
  /** px per second (motion blur) */
  scrollSpeed: number;
  /** 0: viewport edges are exact (rows tile it); 1: soft (moving or zoomed) */
  edgeSoft: number;
  /** top of each row in content px (length rows + 1; last = content height) */
  offsets: number[];
  contentH: number;
  viewportH: number;
  rows: RowView[];
  bars: Array<{i0: number; i1: number; grow: number; alpha: number}>;
  notes: NoteView[];
  /** diff numbering: 0 = old file numbers, 1 = new file numbers */
  numberMix: number;
  caret: {row: number; col: number; alpha: number} | null;
}

export interface PageSpec {
  view?: LineRef;
  rows?: number;
  zoom?: number;
}

/** Time at which each character after the indent appears (seeded rhythm). */
const typeSchedule = (c: TypeCue, text: string, indent: number): number[] => {
  const cps = c.cps ?? 34;
  const jitter = c.jitter ?? 0.5;
  const seed = c.seed ?? `type-${c.at}`;
  const times: number[] = [];
  let time = c.at;
  for (let k = indent; k < text.length; k++) {
    const prev = text[k - 1] ?? '';
    const pause = /[\s,;:(){}[\].]/.test(prev) ? 1.35 : 1;
    time += (pause * (1 - jitter / 2 + jitter * random(`${seed}:${k}`))) / cps;
    times.push(time);
  }
  return times;
};

/** chars = -1 before the cue starts; done = when the last character lands. */
const typedChars = (c: TypeCue, text: string, indent: number, t: number): {chars: number; done: number} => {
  if (t < c.at) return {chars: -1, done: Infinity};
  const times = typeSchedule(c, text, indent);
  let n = 0;
  while (n < times.length && times[n] <= t) n++;
  const end = times.length ? times[times.length - 1] : c.at;
  return {chars: indent + n, done: n === times.length ? end : Infinity};
};

const typeEnd = (c: TypeCue, text: string, indent: number): number => {
  const times = typeSchedule(c, text, indent);
  return times.length ? times[times.length - 1] : c.at;
};

const caretBlink = (t: number, done: number, hold: number): number => {
  if (t < done) return 1;
  const since = t - done;
  if (since > hold + 0.25) return 0;
  const on = Math.floor(since / 0.53) % 2 === 0 ? 1 : 0;
  return on * (1 - clamp01((since - hold) / 0.25));
};

const byAt = <T extends {at: number}>(a: T, b: T) => a.at - b.at;

// Row pairing and word-level spans depend only on the document, so they are
// computed once per document (a cache, not frame state).
const diffCache = new WeakMap<Doc, {pairs: Map<number, number>; spans: Map<number, Array<[number, number]>>}>();
const diffInfo = (doc: Doc) => {
  let info = diffCache.get(doc);
  if (!info) {
    const pairs = pairChanges(doc.rows);
    const spans = new Map<number, Array<[number, number]>>();
    for (const [i, j] of pairs) {
      if (doc.rows[i].kind !== '-') continue;
      const s = changedSpans(doc.rows[i], doc.rows[j]);
      spans.set(i, s.old);
      spans.set(j, s.new);
    }
    info = {pairs, spans};
    diffCache.set(doc, info);
  }
  return info;
};

/**
 * Evaluates a page's cues at time t (seconds). H is the frame height; zoom
 * and viewport rows come from the page. Pure: same inputs, same state.
 */
export const evalView = (doc: Doc, cues: CodeCue[], page: PageSpec, H: number, t: number): ViewState => {
  const n = doc.rows.length;
  const baseZoom = page.zoom ?? 1;
  const rows: RowView[] = doc.rows.map(() => ({
    alpha: 1,
    dy: 0,
    blur: 0,
    wipe: 1,
    chars: Infinity,
    height: 1,
    focus: 1,
    focusBlur: 0,
    hl: 0,
    del: 0,
    add: 0,
    settle: 0,
    emph: [],
    emphAlpha: 0,
  }));

  const focusCues = cues.filter((c): c is FocusCue => c.type === 'focus').sort(byAt);
  const scrollish = cues.filter((c): c is FocusCue | ScrollCue => c.type === 'scroll' || (c.type === 'focus' && c.scroll !== false)).sort(byAt);

  // zoom
  let zoom = baseZoom;
  for (const f of focusCues) {
    if (f.zoom === undefined) continue;
    zoom = lerp(zoom, f.zoom, easeCamera(prog(t, f.at, f.dur ?? 1.2)));
    if (f.until !== undefined) zoom = lerp(zoom, baseZoom, easeCamera(prog(t, f.until, 0.8)));
  }
  const m = codeMetrics(H, zoom);
  let caret = null as ViewState['caret'];

  // diff rows open and close
  const diffCue = cues.find((c): c is DiffCue => c.type === 'diff');
  let numberMix = 0;
  if (doc.isDiff) {
    const mark = diffCue?.mark ?? -Infinity;
    const add = diffCue?.add ?? -Infinity;
    const stagger = diffCue?.stagger ?? 0.16;
    const typing = diffCue?.typeCps ? diffCue.typeCps : 0;
    const {pairs, spans} = diffInfo(doc);

    // schedule added rows: typed rows follow each other, wiped rows stagger
    const plan = new Map<number, {start: number; tc?: TypeCue; end: number}>();
    let clock = add;
    let k = 0;
    doc.rows.forEach((row, i) => {
      if (row.kind !== '+') return;
      if (typing) {
        const tc: TypeCue = {type: 'type', at: clock + 0.24, line: 0, cps: typing, seed: `diff-${row.key}`};
        const end = typeEnd(tc, row.text, row.indent);
        plan.set(i, {start: clock, tc, end});
        clock = end + 0.1;
      } else {
        const start = add + k++ * stagger;
        plan.set(i, {start, end: start + 0.6});
        clock = start + 0.6;
      }
    });
    const lastAdded = Math.max(-1, ...plan.keys());
    const apply =
      diffCue?.apply ?? (diffCue?.applyAfterTyping !== undefined && plan.size ? clock + diffCue.applyAfterTyping : undefined);
    const settle = apply === undefined ? 0 : easeUi(prog(t, apply + 0.1, 0.6));
    numberMix = settle;

    doc.rows.forEach((row, i) => {
      const r = rows[i];
      r.settle = settle;
      if (row.kind === '-') {
        r.del = easeUi(prog(t, mark, 0.4));
        if (apply !== undefined) {
          r.height = 1 - easeCamera(prog(t, apply, 0.6));
          r.alpha = 1 - easeUi(prog(t, apply, 0.32));
        }
        if (pairs.has(i)) {
          r.emph = spans.get(i) ?? [];
          r.emphAlpha = r.del;
        }
      } else if (row.kind === '+') {
        const s = plan.get(i)!;
        r.height = easeCamera(prog(t, s.start, 0.42));
        r.add = easeUi(prog(t, s.start + 0.1, 0.38));
        if (s.tc) {
          const {chars, done} = typedChars(s.tc, row.text, row.indent, t);
          r.chars = chars < 0 ? row.indent : chars;
          r.alpha = chars < 0 ? 0 : 1;
          const last = i === lastAdded;
          if (chars >= 0 && t < s.end + 0.1 + (last ? 0.7 : 0)) {
            const a = last ? caretBlink(t, done, 0.45) : 1;
            if (a > 0) caret = {row: i, col: r.chars, alpha: a};
          }
        } else {
          r.alpha = easeText(prog(t, s.start + 0.15, 0.45));
          r.wipe = easeText(prog(t, s.start + 0.1, 0.5));
        }
        if (pairs.has(i)) {
          // emphasis follows the caret: only what is already typed is marked
          r.emph = (spans.get(i) ?? [])
            .filter(([c0]) => c0 < r.chars)
            .map(([c0, c1]): [number, number] => [c0, Math.min(c1, r.chars)]);
          r.emphAlpha = r.add;
        }
      }
      r.emphAlpha *= 1 - settle;
    });
  }

  // offsets (row heights may be animating)
  const offsets = new Array<number>(n + 1);
  offsets[0] = 0;
  for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + rows[i].height * m.lh;
  const contentH = offsets[n];
  const viewportH = page.rows !== undefined ? page.rows * codeMetrics(H, baseZoom).lh : contentH;

  // scroll: targets snap to whole rows so a resting view never shows half a line
  const maxScroll = Math.max(0, contentH - viewportH);
  const snap = (y: number) => {
    let best = 0;
    for (let i = 0; i <= n; i++) if (Math.abs(offsets[i] - y) < Math.abs(offsets[best] - y)) best = i;
    return Math.max(0, Math.min(offsets[best], maxScroll));
  };
  // while zoomed, rows no longer tile the viewport: blend from whole-row
  // targets to exact ones so the zoom stays continuous
  const zoomDev = Math.min(1, Math.abs(zoom - baseZoom) / 0.02);
  const clampS = (y: number) => Math.max(0, Math.min(y, maxScroll));
  const place = (y: number) => lerp(snap(y), clampS(y), zoomDev);
  const target = (range: LineRange, align: 'center' | 'top'): number => {
    const [i0, i1] = rowsOf(doc, range);
    if (i0 < 0) return 0;
    if (align === 'top') return place(offsets[i0]);
    return place((offsets[i0] + offsets[i1 + 1]) / 2 - viewportH / 2);
  };
  let initial = 0;
  if (page.view !== undefined) {
    const i = rowOf(doc, page.view);
    if (i >= 0) initial = offsets[i];
  }
  const scrollAt = (tt: number) => {
    let s = initial;
    for (const c of scrollish) {
      const range = c.type === 'scroll' ? c.to : c.lines;
      const align = c.align ?? (c.type === 'scroll' ? 'top' : 'center');
      s = lerp(s, target(range, align), easeCamera(prog(tt, c.at, c.dur ?? 1.2)));
    }
    return Math.max(0, Math.min(s, maxScroll));
  };
  const scroll = scrollAt(t);
  const scrollSpeed = Math.abs(scroll - scrollAt(t - 1 / 60)) * 60;
  const edgeSoft = Math.max(zoomDev, Math.min(1, scrollSpeed / (2.5 * m.lh)));

  // reveal
  const blur0 = (5 * H) / 1080;
  for (const c of cues) {
    if (c.type !== 'reveal') continue;
    const [i0, i1] = c.lines ? rowsOf(doc, c.lines) : [0, n - 1];
    if (i0 < 0) continue;
    const stagger = c.stagger ?? 0.12;
    const dur = c.dur ?? 0.42;
    let k = 0;
    const starts: number[] = [];
    for (let i = i0; i <= i1; i++) {
      if (doc.rows[i].blank) continue;
      starts[i] = c.times?.[k] ?? c.at + k * stagger;
      k++;
    }
    for (let i = i1; i >= i0; i--) if (starts[i] === undefined) starts[i] = starts[i + 1] ?? c.at;
    for (let i = i0; i <= i1; i++) {
      const p = prog(t, starts[i], dur);
      const e = easeText(p);
      const r = rows[i];
      const style = c.style ?? 'rise';
      if (style === 'wipe') {
        r.wipe = e;
        r.alpha *= clamp01(p * 2.5);
      } else {
        r.alpha *= e;
        if (style === 'rise') {
          r.dy = (1 - e) * 0.32 * m.lh;
          r.blur = (1 - p) * (1 - p) * blur0;
        }
      }
    }
  }

  // typewriter
  for (const c of cues) {
    if (c.type !== 'type') continue;
    const i = rowOf(doc, c.line);
    if (i < 0) continue;
    const row = doc.rows[i];
    const {chars, done} = typedChars(c, row.text, row.indent, t);
    const r = rows[i];
    if (chars < 0) {
      r.alpha = 0;
      continue;
    }
    r.chars = chars;
    if (c.caret !== false) {
      const a = caretBlink(t, done, c.caretHold ?? 0.9);
      if (a > 0) caret = {row: i, col: chars, alpha: a};
    }
  }

  // focus dimming
  for (const f of focusCues) {
    const d = envelope(t, f.at, 0.5, f.until, 0.45);
    if (d <= 0) continue;
    const [i0, i1] = rowsOf(doc, f.lines);
    const level = f.dim ?? 0.26;
    const blurPx = (f.blur ?? 0.0011) * H;
    for (let i = 0; i < n; i++) {
      if (i >= i0 && i <= i1) continue;
      rows[i].focus = Math.min(rows[i].focus, 1 - d * (1 - level));
      rows[i].focusBlur = Math.max(rows[i].focusBlur, d * blurPx);
    }
  }

  // highlights
  const bars: ViewState['bars'] = [];
  for (const c of cues) {
    if (c.type !== 'highlight') continue;
    const [i0, i1] = rowsOf(doc, c.lines);
    if (i0 < 0) continue;
    const alpha = envelope(t, c.at, 0.35, c.until, 0.35);
    if (alpha <= 0) continue;
    bars.push({i0, i1, grow: easeUi(prog(t, c.at, 0.5)), alpha});
    for (let i = i0; i <= i1; i++) rows[i].hl = Math.max(rows[i].hl, alpha);
  }

  // annotations
  const notes: NoteView[] = [];
  cues.forEach((c, idx) => {
    if (c.type !== 'annotate') return;
    const i = rowOf(doc, c.line);
    if (i < 0) return;
    const row = doc.rows[i];
    const cols = c.cols ?? (c.match ? findCols(row, c.match, c.occurrence ?? 0) : null) ?? [row.indent, row.text.length];
    const alpha = 1 - easeUi(prog(t, c.until ?? Infinity, 0.35));
    const ring = easeUi(prog(t, c.at, 0.4));
    if (ring <= 0 || alpha <= 0) return;
    notes.push({
      key: `n${idx}`,
      row: i,
      c0: cols[0],
      c1: cols[1],
      cue: c,
      ring,
      wire: easeUi(prog(t, c.at + 0.12, 0.5)),
      label: easeText(prog(t, c.at + 0.32, 0.45)),
      alpha,
    });
  });

  return {m, zoom, scroll, scrollSpeed, edgeSoft, offsets, contentH, viewportH, rows, bars, notes, numberMix, caret};
};
