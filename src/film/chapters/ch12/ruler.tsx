import React from 'react';
import {color} from '../../../engine/tokens';
import {blurFilter, clamp01, easeOutCubic, easeUI, prog} from '../../../engine/type';
import {MONO, PinGlyph, fade, mint, pullBlur, useWH} from '../ch09/kit/ui';

// The chapter's one instrument: the published-band ruler. Every check lands as a pin against its
// own published band, drawn normalised: the band always spans the ruler's middle half, so a pin
// inside it passed. Where a repository has no published band the ruler says 'no band'.

export const RULER = {x0: 0.43, x1: 0.905, y: 0.705} as const;

export interface RulerEntry {
  id: string;
  /** when the pin lands */
  at: number;
  value: number;
  lo: number;
  hi: number;
  /** label while it is the current scene's pin, e.g. "400 mg at bedtime → 35.0 min · band 25–50" */
  label: string;
  /** until when the label shows (the pin stays, dimmed) */
  labelTo: number;
  /** which house it belongs to (0..7), for the closing light-up */
  house: number;
  /** label row above the ruler (0 or 1) */
  row?: 0 | 1;
}

export interface NoBand {
  from: number;
  to: number;
  label?: string;
}

export interface BandRulerProps {
  t: number;
  at: number;
  exitAt: number;
  entries: readonly RulerEntry[];
  noBand: readonly NoBand[];
  /** the closing beat: every pin lights once */
  lightAll?: number;
}

export const normX = (v: number, lo: number, hi: number) => 0.25 + 0.5 * ((v - lo) / Math.max(1e-9, hi - lo));

export const BandRuler: React.FC<BandRulerProps> = ({t, at, exitAt, entries, noBand, lightAll}) => {
  const {W, H} = useWH();
  if (t < at - 0.01) return null;
  const k = fade(t, at, exitAt, 0.5, 0.5);
  if (k <= 0.002) return null;
  const y = Math.round(RULER.y * H);
  const xa = RULER.x0 * W;
  const xb = RULER.x1 * W;
  const X = (f: number) => Math.round(xa + (xb - xa) * f);
  const draw = easeUI(prog(t, at, 0.9));
  const hair = Math.max(1, Math.round(H / 1080));
  const fs = Math.round(0.022 * H);
  const els: React.ReactNode[] = [];
  els.push(
    <div
      key="strip"
      style={{
        position: 'absolute',
        left: X(0) - Math.round(0.03 * W),
        top: y - Math.round(0.12 * H),
        width: X(1) - X(0) + Math.round(0.06 * W),
        height: Math.round(0.165 * H),
        borderRadius: Math.round(0.02 * H),
        background: 'radial-gradient(ellipse 60% 70% at 50% 60%, rgba(6,9,8,0.74) 0%, rgba(6,9,8,0.58) 55%, rgba(6,9,8,0) 100%)',
      }}
    />,
  );
  // the band: the middle half, a soft mint slab with end posts
  const bandK = clamp01((draw - 0.25) * 3);
  els.push(<div key="band" style={{position: 'absolute', left: X(0.25), top: y - Math.round(0.011 * H), width: Math.round((X(0.75) - X(0.25)) * bandK), height: Math.round(0.022 * H), borderRadius: Math.round(0.006 * H), background: 'rgba(116,201,174,0.13)', border: `${hair}px solid rgba(116,201,174,0.4)`}} />);
  // the ruler's pins
  const n = 48;
  const d = Math.round(0.0062 * H);
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    if (f > draw) break;
    els.push(<div key={`p${j}`} style={{position: 'absolute', left: X(f) - d / 2, top: y - d / 2, width: d, height: d, borderRadius: d, background: 'radial-gradient(circle at 38% 34%, #B4BAB8 0%, #5C6260 50%, #232726 100%)'}} />);
  }
  els.push(
    <div key="title" style={{position: 'absolute', left: X(0), top: y - Math.round(0.118 * H), fontFamily: MONO, fontSize: fs, letterSpacing: '0.06em', color: color.text.chipDim, whiteSpace: 'pre', opacity: fade(t, at + 0.2, undefined, 0.45)}}>
      {'PUBLISHED-BAND RULER · '}
      <span style={{color: '#9FD9C6'}}>{'IN BAND = CHECK PASSED'}</span>
    </div>,
  );
  // no band
  for (const nb of noBand) {
    const q = fade(t, nb.from, nb.to, 0.4, 0.4);
    if (q <= 0.002) continue;
    els.push(
      <div key={`nb${nb.from}`} style={{position: 'absolute', left: X(0.5), top: y - Math.round(0.03 * H), transform: 'translate(-50%, -100%)', opacity: q, filter: blurFilter(pullBlur(t, nb.from, nb.to, H, 0.4, 0.4))}}>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: Math.round(fs * 0.5), padding: `${Math.round(fs * 0.35)}px ${Math.round(fs * 0.7)}px`, borderRadius: 999, border: `${hair}px dashed rgba(228,234,231,0.4)`, fontFamily: MONO, fontSize: fs, color: color.text.chipDim, whiteSpace: 'pre'}}>
          <PinGlyph size={Math.round(fs * 0.7)} kind="miss" />
          {nb.label ?? 'no band'}
        </span>
      </div>,
    );
  }
  // entries
  const glowAll = lightAll !== undefined ? Math.exp(-Math.max(0, t - lightAll) / 0.8) * clamp01((t - lightAll) / 0.15) : 0;
  for (const e of entries) {
    if (t < e.at) continue;
    const land = easeOutCubic(clamp01((t - e.at) / 0.45));
    const fx = Math.min(0.97, Math.max(0.03, normX(e.value, e.lo, e.hi)));
    const x = X(fx);
    const fresh = t < e.labelTo;
    const pin = Math.round(0.016 * H);
    const lit = lightAll !== undefined && t >= lightAll - 0.05;
    els.push(
      <div key={`m${e.id}`} style={{position: 'absolute', left: x - pin / 2, top: Math.round(y - pin / 2 - (1 - land) * 0.05 * H), opacity: land * (fresh || lit ? 1 : 0.55), filter: glowAll > 0.01 ? `drop-shadow(0 0 ${Math.round(10 * glowAll)}px rgba(116,201,174,0.9))` : undefined}}>
        <PinGlyph size={pin} kind={fresh || lit ? 'win' : 'steel'} />
      </div>,
    );
    const lk = fade(t, e.at + 0.12, e.labelTo, 0.35, 0.4);
    if (lk > 0.002) {
      const ly = y - Math.round(((e.row ?? 0) === 0 ? 0.026 : 0.06) * H);
      if ((e.row ?? 0) === 1) els.push(<div key={`ld${e.id}`} style={{position: 'absolute', left: x - hair / 2, top: ly + Math.round(0.004 * H), width: hair, height: y - ly - Math.round(0.012 * H), background: 'rgba(228,234,231,0.28)', opacity: lk}} />);
      const left = Math.min(Math.max(x, X(0.0) + 0.12 * W), X(1) - 0.12 * W);
      els.push(
        <div
          key={`ml${e.id}`}
          style={{position: 'absolute', left, top: ly, transform: 'translate(-50%, -100%)', fontFamily: MONO, fontSize: fs, color: color.text.display, whiteSpace: 'pre', opacity: lk, filter: blurFilter(pullBlur(t, e.at + 0.12, e.labelTo, H)), textShadow: '0 1px 3px rgba(0,0,0,0.8)'}}
        >
          {e.label}
        </div>,
      );
    }
  }
  void mint;
  return <div style={{position: 'absolute', inset: 0, opacity: k, pointerEvents: 'none'}}>{els}</div>;
};
