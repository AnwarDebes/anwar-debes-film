import React from 'react';
import {clamp01, easeCamera, easeText, easeUi, lerp} from './anim';
import {MONO_TEXT} from './CodeWindow';
import {codeTheme, chrome, mixHex} from './theme';
import type {Doc} from './doc';
import {gutterLayout, type ChromeMetrics} from './metrics';
import type {MorphPlan} from './morph';
import type {ViewState} from './cues';

// Magic-move between two pages: atoms that survive glide from their old
// cell to their new one (and change colour if their role changed), atoms that
// leave fade out early, atoms that arrive fade in late. Line numbers cross.

export interface MorphSide {
  doc: Doc;
  view: ViewState;
  /** first doc row of the atom rows (plan rows are a window of the doc) */
  row0: number;
}

export const CodeMorph: React.FC<{
  plan: MorphPlan;
  a: MorphSide;
  b: MorphSide;
  /** 0..1 linear progress */
  p: number;
  c: ChromeMetrics;
  width: number;
  /** viewport height while morphing */
  viewportH: number;
}> = ({plan, a, b, p, c, width, viewportH}) => {
  const ma = a.view.m;
  const mb = b.view.m;
  const ga = gutterLayout(ma, a.doc.digits, a.doc.isDiff);
  const gb = gutterLayout(mb, b.doc.digits, b.doc.isDiff);
  const rowsB = Math.max(1, ...plan.B.map((x) => x.row + 1));
  // Phases: what leaves clears first, survivors travel together (a slight
  // top-to-bottom cascade), what arrives settles in last, so no two tokens
  // ever share a cell for long.
  const spread = 0.06;
  const moveFrom = 0.06;
  const moveLen = 0.7;
  const leaveEnd = 0.3;
  const arriveFrom = 0.68;

  const posA = (row: number, col: number) => ({
    x: ga.codeX + col * ma.cw,
    y: a.view.offsets[a.row0 + row] - a.view.scroll,
  });
  const posB = (row: number, col: number) => ({
    x: gb.codeX + col * mb.cw,
    y: b.view.offsets[b.row0 + row] - b.view.scroll,
  });
  const rowAlphaA = (row: number) => {
    const r = a.view.rows[a.row0 + row];
    return r ? r.alpha * r.focus : 1;
  };

  const fsAt = (k: number) => lerp(ma.fs, mb.fs, k);
  const lhAt = (k: number) => lerp(ma.lh, mb.lh, k);
  const items: React.ReactNode[] = [];

  plan.A.forEach((atom, ia) => {
    const ib = plan.aToB[ia];
    const sa = codeTheme[atom.cls];
    const pa = posA(atom.row, atom.col);
    if (ib < 0) {
      const alpha = rowAlphaA(atom.row) * (1 - easeUi(clamp01(p / leaveEnd)));
      if (alpha <= 0.003) return;
      items.push(
        <span
          key={`a${ia}`}
          style={{
            ...MONO_TEXT,
            position: 'absolute',
            left: pa.x,
            top: pa.y,
            fontSize: ma.fs,
            lineHeight: `${ma.lh}px`,
            color: sa.color,
            fontWeight: sa.weight,
            opacity: alpha,
          }}
        >
          {atom.text}
        </span>,
      );
      return;
    }
    const bt = plan.B[ib];
    const sb = codeTheme[bt.cls];
    const pb = posB(bt.row, bt.col);
    const delay = moveFrom + (bt.row / rowsB) * spread;
    const k = easeCamera(clamp01((p - delay) / moveLen));
    const alpha = lerp(rowAlphaA(atom.row), 1, easeUi(clamp01(p / 0.6)));
    items.push(
      <span
        key={`m${ia}`}
        style={{
          ...MONO_TEXT,
          position: 'absolute',
          left: lerp(pa.x, pb.x, k),
          top: lerp(pa.y, pb.y, k),
          fontSize: fsAt(k),
          lineHeight: `${lhAt(k)}px`,
          color: sa.color === sb.color ? sa.color : mixHex(sa.color, sb.color, k),
          fontWeight: Math.round(lerp(sa.weight, sb.weight, k)),
          opacity: alpha,
        }}
      >
        {atom.text}
      </span>,
    );
  });

  plan.B.forEach((atom, ib) => {
    if (plan.bToA[ib] >= 0) return;
    const sb = codeTheme[atom.cls];
    const pb = posB(atom.row, atom.col);
    const e = easeText(clamp01((p - arriveFrom) / (1 - arriveFrom)));
    if (e <= 0.003) return;
    const blur = (1 - e) * 0.0022 * c.H;
    items.push(
      <span
        key={`b${ib}`}
        style={{
          ...MONO_TEXT,
          position: 'absolute',
          left: pb.x,
          top: pb.y + (1 - e) * 0.18 * mb.lh,
          fontSize: mb.fs,
          lineHeight: `${mb.lh}px`,
          color: sb.color,
          fontWeight: sb.weight,
          opacity: e,
          filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {atom.text}
      </span>,
    );
  });

  // line numbers cross over
  const numStyle = (fs: number, lh: number): React.CSSProperties => ({
    ...MONO_TEXT,
    position: 'absolute',
    fontSize: fs,
    lineHeight: `${lh}px`,
    color: chrome.gutter,
    fontWeight: 450,
  });
  // every row visible on either side is numbered, exactly as the resting
  // pages number them, so nothing pops when the morph hands over
  const outA = 1 - easeUi(clamp01(p / 0.45));
  const inB = easeUi(clamp01((p - 0.5) / 0.45));
  const numbered = (side: MorphSide, alpha: number, key: string, fs: number, lh: number, right: number) => {
    if (alpha <= 0.003) return;
    const v = side.view;
    side.doc.rows.forEach((row, i) => {
      const y = v.offsets[i] - v.scroll;
      if (y < -0.5 * v.m.lh || y > v.viewportH - 0.5 * v.m.lh) return;
      const rv = v.rows[i];
      if (rv.alpha * rv.height < 0.5 || (side === b && rv.chars < row.text.length)) return;
      items.push(
        <div key={`${key}${i}`} style={{...numStyle(fs, lh), right, top: y, opacity: alpha * (side === a ? rv.focus : 1)}}>
          {row.line ?? row.b ?? row.a}
        </div>,
      );
    });
  };
  numbered(a, outA, 'na', ma.fs, ma.lh, width - ga.numRight);
  numbered(b, inB, 'nb', mb.fs, mb.lh, width - gb.numRight);

  // tokens travelling past the bottom of a shrinking window fade out in the
  // padding instead of being cut
  const pad = 0.8 * c.padBottom;
  const mask = `linear-gradient(180deg, #000 ${viewportH - 0.05 * mb.lh}px, transparent ${viewportH + pad}px)`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: c.padTop,
        width,
        height: viewportH + pad,
        overflow: 'hidden',
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      {items}
    </div>
  );
};
