import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import {clamp01, easeOut, legible, ramp} from './kit';
import {WALK_N} from './walk';

// The rule line: 66 small steel pins along the bottom edge of the frame (97 % H, 15-95 % W), one
// per repository in the order of the walk. A pin lights mint when its place's name plate first
// appears. The numerals are shown only twice in the film (0 / 66 in 01.2, 66 / 66 in 14.2).

export interface RuleLineProps {
  t: number;
  /** film time each pin lights, walk order */
  litAt: readonly number[];
  /** overall visibility 0..1 (hidden under dense code panels) */
  opacity?: number;
  /** the numerals, shown for a window */
  numerals?: {from: number; to: number; text: string};
  /** the line drawn left to right once more (14.6): start time and duration */
  sweep?: {at: number; dur: number};
  /** a single glow pulse over every lit pin (01.10) */
  pulseAt?: number;
  /** override geometry (fractions of W / H) */
  y?: number;
  x0?: number;
  x1?: number;
  /** pin diameter as a fraction of H */
  d?: number;
}

const ruleX = (k: number, W: number, x0: number, x1: number) => W * (x0 + ((x1 - x0) * k) / (WALK_N - 1));

export const RuleLine: React.FC<RuleLineProps> = ({t, litAt, opacity = 1, numerals, sweep, pulseAt, y = 0.97, x0 = 0.15, x1 = 0.95, d = 0.0098}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (opacity <= 0.001) return null;
  const D = Math.max(6, Math.round(d * H));
  const cy = Math.round(y * H);
  const pins: React.ReactNode[] = [];
  for (let k = 0; k < WALK_N; k++) {
    const cx = ruleX(k, W, x0, x1);
    const at = litAt[k];
    const lit = t >= at ? easeOut(ramp(t, at, 0.35)) : 0;
    let flash = t >= at ? Math.exp(-(t - at) / 0.25) : 0;
    if (sweep && t >= sweep.at) {
      const sk = clamp01((t - sweep.at) / sweep.dur);
      const front = sk * (WALK_N - 1);
      const fade = 1 - clamp01((t - sweep.at - sweep.dur) / 0.4);
      flash = Math.max(flash, Math.exp(-Math.abs(front - k) / 1.6) * fade);
    }
    if (pulseAt !== undefined && lit > 0) flash = Math.max(flash, 0.8 * Math.exp(-Math.abs(t - pulseAt - k * 0.006) / 0.18));
    const head = lit > 0
      ? `radial-gradient(circle at 38% 34%, #F2FFFB 0%, ${color.accent.mint} 42%, #2E6B58 100%)`
      : 'radial-gradient(circle at 36% 32%, #D3D9D7 0%, #7E8684 30%, #3A403E 70%, #1A1D1C 100%)';
    pins.push(
      <div
        key={k}
        style={{
          position: 'absolute',
          left: Math.round(cx - D / 2),
          top: cy - D / 2,
          width: D,
          height: D,
          borderRadius: D / 2,
          background: head,
          opacity: lit > 0 ? 0.6 + 0.4 * lit : 0.92,
          boxShadow: lit > 0 ? `0 0 ${Math.round(D * (0.9 + 1.6 * flash))}px rgba(116,201,174,${(0.35 + 0.5 * flash).toFixed(3)})` : '0 1px 2px rgba(0,0,0,0.6)',
        }}
      />,
    );
  }
  const nk = numerals ? Math.min(easeOut(ramp(t, numerals.from, 0.4)), 1 - easeOut(ramp(t, numerals.to - 0.35, 0.35))) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      {pins}
      {numerals && nk > 0.001 && ready ? (
        <div
          style={{
            position: 'absolute',
            right: Math.round(W * (1 - x0) + D * 1.4),
            top: Math.round(cy - H * 0.0145),
            fontFamily: font.mono,
            fontSize: Math.round(H * 0.022),
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '0.04em',
            color: color.accent.mintLabel,
            whiteSpace: 'pre',
            opacity: nk,
            textShadow: legible(H),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {numerals.text}
        </div>
      ) : null}
    </div>
  );
};
