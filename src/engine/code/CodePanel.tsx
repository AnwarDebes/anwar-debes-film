import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {easeCamera, easeUi, lerp, prog} from './anim';
import {Annotations} from './Annotations';
import {CodeMorph} from './CodeMorph';
import {CodeRows} from './CodeRows';
import {CodeWindow, type HeaderMix} from './CodeWindow';
import {evalView, type CodeCue, type ViewState} from './cues';
import {buildDoc, colsIn, rowsOf, type Doc, type DocSource, type LineRange, type LineRef} from './doc';
import {chromeMetrics, codeMetrics, panelWidthFor} from './metrics';
import {planMorph, type MorphPlan} from './morph';
import type {CodeHeader} from './types';

/**
 * One state of the panel. Pages follow each other on the panel's clock; the
 * window keeps its chrome and resizes smoothly between them.
 */
export interface CodePage {
  /** seconds: when the transition into this page starts */
  at: number;
  source: DocSource;
  /** strip common indentation (true) or this many columns */
  dedent?: boolean | number;
  /** first visible line when the page starts (default: first line) */
  view?: LineRef;
  /** visible rows; default: every row (the window fits the content) */
  rows?: number;
  zoom?: number;
  /** fixed window width, px; default: fits `fit` (or every row) */
  width?: number;
  fit?: LineRange;
  header?: CodeHeader;
  /** how this page arrives: cross-fade (default), token morph, or instantly */
  transition?: 'fade' | 'morph' | 'cut';
  transitionDur?: number;
  cues?: CodeCue[];
}

export interface CodePanelProps {
  pages: CodePage[];
  /** anchor point, px */
  x: number;
  y: number;
  anchor?: 'center' | 'top' | 'top-left' | 'left';
  /** clock override in seconds (e.g. film time for narration sync) */
  t?: number;
  enter?: {at: number; dur?: number};
  exit?: {at: number; dur?: number};
  minWidth?: number;
  maxWidth?: number;
}

interface Prepared {
  page: CodePage;
  doc: Doc;
  cues: CodeCue[];
  header: CodeHeader;
  width: number;
  /** window height once every cue of the page has played (layout anchor) */
  restH: number;
  morph?: {plan: MorphPlan; viewA: ViewState; viewB: ViewState; a0: number; b0: number};
}

const visibleWindow = (view: ViewState): [number, number] => {
  let i0 = -1;
  let i1 = -1;
  for (let i = 0; i < view.rows.length; i++) {
    const y0 = view.offsets[i] - view.scroll;
    const y1 = view.offsets[i + 1] - view.scroll;
    if (y1 > 0.5 && y0 < view.viewportH - 0.5) {
      if (i0 < 0) i0 = i;
      i1 = i;
    }
  }
  return [Math.max(0, i0), Math.max(0, i1)];
};

export const defaultHeader = (doc: Doc): CodeHeader => ({label: doc.repo.split('/').pop(), path: doc.path});

const prepare = (pages: CodePage[], H: number, minWidth: number, maxWidth: number): Prepared[] => {
  const out: Prepared[] = [];
  pages.forEach((page, i) => {
    const doc = buildDoc(page.source, page.dedent ?? false);
    const cues = page.cues ?? [];
    let width = page.width;
    if (width === undefined) {
      const [i0, i1] = page.fit ? rowsOf(doc, page.fit) : [0, doc.rows.length - 1];
      width = panelWidthFor(H, colsIn(doc, i0, i1), doc.digits, doc.isDiff, page.zoom ?? 1);
    }
    width = Math.min(maxWidth, Math.max(minWidth, width));
    const c = chromeMetrics(H);
    const rest = evalView(doc, cues, page, H, 1e6);
    const restH = c.headerH + c.padTop + rest.viewportH + c.padBottom;
    const p: Prepared = {page, doc, cues, header: page.header ?? defaultHeader(doc), width, restH};
    if (i > 0 && page.transition === 'morph') {
      const prev = out[i - 1];
      const dur = page.transitionDur ?? 1.2;
      // the old page as it stands when the morph starts, the new one as it
      // will stand when it ends (rows still waiting for a later reveal or
      // typewriter cue take no part)
      const viewA = evalView(prev.doc, prev.cues, prev.page, H, page.at);
      const viewB = evalView(doc, cues, page, H, page.at + dur);
      const [a0, a1] = visibleWindow(viewA);
      const [b0, b1] = visibleWindow(viewB);
      const shown = (v: ViewState, d: Doc, i: number) =>
        v.rows[i].alpha * v.rows[i].height > 0.5 && v.rows[i].chars >= d.rows[i].text.length;
      const rowsA = prev.doc.rows
        .slice(a0, a1 + 1)
        .map((r, j) => (shown(viewA, prev.doc, a0 + j) ? r : {...r, tokens: [], text: ''}));
      const rowsB = doc.rows.slice(b0, b1 + 1).map((r, j) => (shown(viewB, doc, b0 + j) ? r : {...r, tokens: [], text: ''}));
      p.morph = {plan: planMorph(rowsA, rowsB), viewA, viewB, a0, b0};
    }
    out.push(p);
  });
  return out;
};

export const CodePanel: React.FC<CodePanelProps> = ({
  pages,
  x,
  y,
  anchor = 'center',
  t: tOverride,
  enter,
  exit,
  minWidth,
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = tOverride ?? frame / fps;
  const c = chromeMetrics(H);
  const minW = minWidth ?? 0.4 * H;
  const maxW = maxWidth ?? 0.9 * W;
  const prepared = useMemo(() => prepare(pages, H, minW, maxW), [pages, H, minW, maxW]);
  if (!prepared.length) return null;

  let i = 0;
  for (let k = 0; k < prepared.length; k++) if (prepared[k].page.at <= t) i = k;
  const cur = prepared[i];
  const prev = i > 0 ? prepared[i - 1] : null;
  const kind = cur.page.transition ?? 'fade';
  const dur = cur.page.transitionDur ?? (kind === 'morph' ? 1.2 : 0.7);
  const k = prev && kind !== 'cut' ? prog(t, cur.page.at, dur) : 1;
  const kk = easeCamera(k);

  const bodyH = (v: ViewState) => c.padTop + v.viewportH + c.padBottom;
  let body: React.ReactNode;
  let overlay: React.ReactNode;
  let width: number;
  let height: number;

  if (prev && kind === 'morph' && cur.morph && k < 1) {
    const {plan, viewA, viewB, a0, b0} = cur.morph;
    width = lerp(prev.width, cur.width, kk);
    const vh = lerp(viewA.viewportH, viewB.viewportH, kk);
    height = c.headerH + c.padTop + vh + c.padBottom;
    body = (
      <CodeMorph
        plan={plan}
        a={{doc: prev.doc, view: viewA, row0: a0}}
        b={{doc: cur.doc, view: viewB, row0: b0}}
        p={k}
        c={c}
        width={width}
        viewportH={vh}
      />
    );
  } else {
    const view = evalView(cur.doc, cur.cues, cur.page, H, t);
    if (prev && k < 1 && kind === 'fade') {
      // the old page lifts away as the frame resizes; the new one is already
      // arriving, so the window is never empty
      const pv = evalView(prev.doc, prev.cues, prev.page, H, t);
      const outK = easeUi(prog(t, cur.page.at, dur * 0.5));
      const out = 1 - outK;
      const inn = easeUi(prog(t, cur.page.at + dur * 0.12, dur * 0.6));
      width = lerp(prev.width, cur.width, kk);
      height = c.headerH + lerp(bodyH(pv), bodyH(view), kk);
      body = (
        <>
          <CodeRows doc={prev.doc} view={pv} c={c} width={width} fps={fps} opacity={out} drift={-outK * 0.45 * pv.m.lh} />
          <CodeRows doc={cur.doc} view={view} c={c} width={width} fps={fps} opacity={inn} />
        </>
      );
      overlay = (
        <>
          <Annotations doc={prev.doc} view={pv} c={c} width={width} opacity={out} />
          <Annotations doc={cur.doc} view={view} c={c} width={width} opacity={inn} />
        </>
      );
    } else {
      width = cur.width;
      height = c.headerH + bodyH(view);
      body = <CodeRows doc={cur.doc} view={view} c={c} width={width} fps={fps} />;
      overlay = <Annotations doc={cur.doc} view={view} c={c} width={width} />;
    }
  }

  const header: HeaderMix = prev
    ? {from: prev.header, to: cur.header, k: kind === 'cut' ? 1 : easeUi(prog(t, cur.page.at, 0.6))}
    : {from: cur.header, to: cur.header, k: 1};

  // enter and exit: a calm focus pull, like the film's type
  const e = enter ? easeUi(prog(t, enter.at, enter.dur ?? 0.7)) : 1;
  const xo = exit ? easeUi(prog(t, exit.at, exit.dur ?? 0.45)) : 0;
  const opacity = e * (1 - xo);
  if (opacity <= 0.001) return null;
  const blurPx = ((1 - e) * (1 - e) * 8 + xo * 6) * (H / 1080);
  const dy = (1 - e) * 0.022 * H - xo * 0.01 * H;

  // vertical anchoring uses each page's resting height, so rows that open or
  // close inside a page grow the window downward instead of moving its header
  const restH = prev && k < 1 ? lerp(prev.restH, cur.restH, kk) : cur.restH;
  const left = anchor === 'top-left' || anchor === 'left' ? x : x - width / 2;
  const top = anchor === 'top' || anchor === 'top-left' ? y : y - restH / 2;

  return (
    <CodeWindow
      c={c}
      width={width}
      height={height}
      header={header}
      overlay={overlay}
      style={{
        left: Math.round(left),
        top: Math.round(top + dy),
        opacity,
        filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
      }}
    >
      {body}
    </CodeWindow>
  );
};

/** Window size a page will have at rest (for layout planning). */
export const measurePage = (page: CodePage, H: number): {width: number; height: number} => {
  const c = chromeMetrics(H);
  const doc = buildDoc(page.source, page.dedent ?? false);
  const m = codeMetrics(H, page.zoom ?? 1);
  const [i0, i1] = page.fit ? rowsOf(doc, page.fit) : [0, doc.rows.length - 1];
  const width = page.width ?? panelWidthFor(H, colsIn(doc, i0, i1), doc.digits, doc.isDiff, page.zoom ?? 1);
  const rows = page.rows ?? doc.rows.length;
  return {width, height: c.headerH + c.padTop + rows * m.lh + c.padBottom};
};
