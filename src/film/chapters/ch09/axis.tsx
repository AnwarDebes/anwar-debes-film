import React from 'react';
import {color} from '../../../engine/tokens';
import {blurFilter, clamp01, easeOutCubic, easeUI, prog} from '../../../engine/type';
import {MONO, PinGlyph, fade, mint, pullBlur, useWH} from './kit/ui';

// The chapter's one instrument: a horizontal R8 accuracy axis (93.5 to 95.5 %) that rides along
// the bottom of the frame from 09.1 to 09.4 and carries the best-epoch caveat from its first bar.

export const AXIS = {lo: 93.5, hi: 95.5, x0: 0.405, x1: 0.905, y: 0.712} as const;

export interface AxisMark {
  id: string;
  at: number;
  value: number;
  /** label above the pin, e.g. "94.91 results" */
  label: string;
  /** +- whisker, accuracy points */
  whisker?: number;
  kind?: 'win' | 'steel';
  /** the moment the label is struck through (a README value corrected by its results file) */
  strikeAt?: number;
  /** 0: the row next to the axis, 1: the row above it */
  row?: 0 | 1;
  align?: 'center' | 'left' | 'right';
}

export interface AxisBracket {
  id: string;
  at: number;
  lo: number;
  hi: number;
  label: string;
  exitAt?: number;
  /** where the label goes: above the axis (a free row), under it, or nowhere (a card carries it) */
  place?: 'above' | 'below' | 'none';
}

export interface R8AxisProps {
  t: number;
  at: number;
  exitAt: number;
  marks: readonly AxisMark[];
  brackets: readonly AxisBracket[];
  /** the standing caveat: appears with the axis and is read in full later */
  caveatAt: number;
  caveatFull?: [number, number];
}

export const axisX = (W: number, v: number) => W * (AXIS.x0 + ((v - AXIS.lo) / (AXIS.hi - AXIS.lo)) * (AXIS.x1 - AXIS.x0));

export const R8Axis: React.FC<R8AxisProps> = ({t, at, exitAt, marks, brackets, caveatAt, caveatFull}) => {
  const {W, H} = useWH();
  if (t < at - 0.01) return null;
  const k = fade(t, at, exitAt, 0.5, 0.5);
  if (k <= 0.002) return null;
  const y = Math.round(AXIS.y * H);
  const xa = Math.round(AXIS.x0 * W);
  const xb = Math.round(AXIS.x1 * W);
  const draw = easeUI(prog(t, at, 0.9));
  const hair = Math.max(1, Math.round(H / 1080));
  const fs = Math.round(0.022 * H);
  const pin = Math.round(0.017 * H);
  const caveatK = fade(t, caveatAt, undefined, 0.45);
  let full = 0;
  if (caveatFull) full = Math.min(easeOutCubic(prog(t, caveatFull[0], 0.4)), 1 - easeOutCubic(prog(t, caveatFull[1], 0.5)));
  const els: React.ReactNode[] = [];

  // a soft dark strip so the axis reads over any pins
  els.push(
    <div
      key="strip"
      style={{
        position: 'absolute',
        left: xa - Math.round(0.03 * W),
        top: y - Math.round(0.122 * H),
        width: xb - xa + Math.round(0.06 * W),
        height: Math.round(0.17 * H),
        borderRadius: Math.round(0.02 * H),
        background: 'radial-gradient(ellipse 60% 70% at 50% 60%, rgba(6,9,8,0.74) 0%, rgba(6,9,8,0.6) 55%, rgba(6,9,8,0) 100%)',
      }}
    />,
  );
  // the axis: a row of small steel pins, drawn left to right
  const n = 56;
  const d = Math.round(0.0066 * H);
  for (let j = 0; j < n; j++) {
    const fx = j / (n - 1);
    if (fx > draw) break;
    const x = Math.round(xa + (xb - xa) * fx);
    els.push(<div key={`p${j}`} style={{position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d, background: 'radial-gradient(circle at 38% 34%, #B4BAB8 0%, #5C6260 50%, #232726 100%)'}} />);
  }
  // scale ends
  for (const v of [AXIS.lo, AXIS.hi]) {
    const x = Math.round(axisX(W, v));
    const a = v === AXIS.lo ? clamp01(draw * 8) : clamp01((draw - 0.96) * 25);
    els.push(
      <div key={`e${v}`} style={{position: 'absolute', left: v === AXIS.lo ? x - Math.round(0.008 * W) : x + Math.round(0.008 * W), top: y, transform: `translate(${v === AXIS.lo ? '-100%' : '0'}, -50%)`, fontFamily: MONO, fontSize: fs, color: color.text.tertiary, opacity: a, whiteSpace: 'pre'}}>
        {v.toFixed(1)}
      </div>,
    );
  }
  // the standing caveat, top-left of the strip
  const litR = Math.round(164 + 72 * full);
  els.push(
    <div
      key="cav"
      style={{position: 'absolute', left: xa, top: y - Math.round(0.122 * H), fontFamily: MONO, fontSize: fs, letterSpacing: '0.06em', color: color.text.chipDim, whiteSpace: 'pre', opacity: fade(t, at + 0.2, undefined, 0.45)}}
    >
      {'R8 ACCURACY (%) · '}
      <span
        style={{
          color: `rgb(${litR},${Math.round(166 + 74 * full)},${Math.round(165 + 72 * full)})`,
          opacity: caveatK,
          borderBottom: `${hair * 2}px solid rgba(116,201,174,${(0.85 * full).toFixed(3)})`,
          filter: blurFilter(pullBlur(t, caveatAt, undefined, H)),
        }}
      >
        BEST EPOCH PICKED ON THE TEST SET
      </span>
    </div>,
  );
  // brackets: mint along the axis, label under it
  for (const b of brackets) {
    if (t < b.at) continue;
    const bk = fade(t, b.at, b.exitAt, 0.4, 0.4);
    if (bk <= 0.002) continue;
    const grow = easeUI(prog(t, b.at, 0.6));
    const xl = axisX(W, b.lo);
    const xr = axisX(W, b.hi);
    const mid = (xl + xr) / 2;
    const half = ((xr - xl) / 2) * grow;
    const above = b.place === 'above';
    const yb = above ? y - Math.round(0.019 * H) : y + Math.round(0.016 * H);
    const ylab = above ? y - Math.round(0.088 * H) : yb + Math.round(0.012 * H);
    els.push(
      <div key={`b${b.id}`} style={{position: 'absolute', inset: 0, opacity: bk}}>
        <div style={{position: 'absolute', left: Math.round(mid - half), top: yb, width: Math.round(half * 2), height: hair * 3, background: mint, boxShadow: '0 0 8px rgba(116,201,174,0.55)'}} />
        <div style={{position: 'absolute', left: Math.round(mid - half), top: above ? yb : yb - Math.round(0.011 * H), width: hair * 2, height: Math.round(0.014 * H), background: mint}} />
        <div style={{position: 'absolute', left: Math.round(mid + half) - hair * 2, top: above ? yb : yb - Math.round(0.011 * H), width: hair * 2, height: Math.round(0.014 * H), background: mint}} />
        <div
          style={{
            position: 'absolute',
            left: Math.round(Math.min(Math.max(mid, xa + 0.2 * W), xb - 0.2 * W)),
            top: ylab,
            transform: 'translateX(-50%)',
            fontFamily: MONO,
            fontSize: fs,
            color: '#CFEFE4',
            whiteSpace: 'pre',
            opacity: b.place === 'none' ? 0 : fade(t, b.at + 0.25, undefined, 0.4),
            filter: blurFilter(pullBlur(t, b.at + 0.25, b.exitAt, H)),
          }}
        >
          {b.label}
        </div>
      </div>,
    );
  }
  // marks: a pin drops onto the axis, its label focus-pulls in above
  for (const m of marks) {
    if (t < m.at) continue;
    const e = t - m.at;
    const land = easeOutCubic(clamp01(e / 0.45));
    const x = Math.round(axisX(W, m.value));
    const drop = (1 - land) * 0.05 * H;
    const struck = m.strikeAt !== undefined ? easeUI(prog(t, m.strikeAt, 0.55)) : 0;
    const row = m.row ?? 0;
    const ly = y - Math.round((row === 0 ? 0.026 : 0.058) * H);
    if (m.whisker) {
      const wx = (m.whisker / (AXIS.hi - AXIS.lo)) * (AXIS.x1 - AXIS.x0) * W * land;
      const col = 'rgba(116,201,174,0.6)';
      els.push(<div key={`w${m.id}`} style={{position: 'absolute', left: Math.round(x - wx), top: y - hair, width: Math.round(wx * 2), height: hair * 2, background: col}} />);
      els.push(<div key={`wl${m.id}`} style={{position: 'absolute', left: Math.round(x - wx) - hair, top: y - Math.round(0.007 * H), width: hair * 2, height: Math.round(0.014 * H), background: col}} />);
      els.push(<div key={`wr${m.id}`} style={{position: 'absolute', left: Math.round(x + wx) - hair, top: y - Math.round(0.007 * H), width: hair * 2, height: Math.round(0.014 * H), background: col}} />);
    }
    if (row === 1) els.push(<div key={`ld${m.id}`} style={{position: 'absolute', left: x - hair / 2, top: ly + Math.round(0.004 * H), width: hair, height: y - ly - Math.round(0.012 * H), background: 'rgba(228,234,231,0.28)', opacity: land}} />);
    els.push(
      <div key={`m${m.id}`} style={{position: 'absolute', left: x - pin / 2, top: Math.round(y - pin / 2 - drop), opacity: land}}>
        <PinGlyph size={pin} kind={m.kind ?? 'win'} />
      </div>,
    );
    const lk = fade(t, m.at + 0.12, undefined, 0.35);
    const al = m.align ?? 'center';
    els.push(
      <div
        key={`ml${m.id}`}
        style={{
          position: 'absolute',
          left: x + (al === 'left' ? -Math.round(fs * 0.4) : al === 'right' ? Math.round(fs * 0.4) : 0),
          top: ly,
          transform: `translate(${al === 'center' ? '-50%' : al === 'right' ? '-100%' : '0'}, -100%)`,
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: fs,
          color: color.text.display,
          whiteSpace: 'pre',
          opacity: lk * (1 - 0.4 * struck),
          filter: blurFilter(pullBlur(t, m.at + 0.12, undefined, H)),
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        <span style={{position: 'relative'}}>
          {m.label}
          {struck > 0 ? <span style={{position: 'absolute', left: -3, top: '52%', height: Math.max(2, Math.round(fs * 0.1)), width: `calc(${(struck * 100).toFixed(1)}% + 6px)`, background: color.pixie.bodyHi, borderRadius: 2}} /> : null}
        </span>
      </div>,
    );
  }
  return <div style={{position: 'absolute', inset: 0, opacity: k, pointerEvents: 'none'}}>{els}</div>;
};
