import React from 'react';
import {color} from '../../../../engine/tokens';
import {easeOutCubic, prog} from '../../../../engine/type';
import {useFrameSize} from './ui';

// The film's rule line: 66 small steel pins along the bottom edge of the frame (97% H, 15-95% W),
// one per repository. A pin lights mint when its repository's name plate first appears; no
// numerals, so it reads as the coverage idea, not a progress bar. Hidden under dense code panels.

export const RULE_PINS = 66;

export interface RuleArrival {
  /** 0-based position of the repository in the walk */
  index: number;
  at: number;
}

export interface RuleLineProps {
  t: number;
  /** pins already lit when this stretch of film starts */
  litBefore: number;
  arrivals?: readonly RuleArrival[];
  /** windows [from, to] in which the line steps aside (dense code panels, the red ground) */
  hidden?: ReadonlyArray<readonly [number, number]>;
  /** overall fade in / out of this node */
  from: number;
  to: number;
}

const visibility = (t: number, hidden: RuleLineProps['hidden']) => {
  let k = 1;
  for (const [a, b] of hidden ?? []) {
    const inK = easeOutCubic(prog(t, a - 0.35, 0.35));
    const outK = easeOutCubic(prog(t, b, 0.45));
    k = Math.min(k, 1 - inK * (1 - outK));
  }
  return k;
};

export const RuleLine: React.FC<RuleLineProps> = ({t, litBefore, arrivals = [], hidden, from, to}) => {
  const {W, H} = useFrameSize();
  // no fade at the chapter's own edges: the line is continuous with the chapters on either side
  const vis = t >= from && t < to ? visibility(t, hidden) : 0;
  if (vis <= 0.002) return null;
  // the same pins as chapters 01-02 draw (diameter 0.98% H, steel heads, a mint glow when lit)
  const D = Math.max(6, Math.round(0.0098 * H));
  const cy = Math.round(0.97 * H);
  const x0 = 0.15 * W;
  const x1 = 0.95 * W;
  const pins = [];
  for (let k = 0; k < RULE_PINS; k++) {
    const cx = x0 + ((x1 - x0) * k) / (RULE_PINS - 1);
    const arr = arrivals.find((a) => a.index === k);
    const at = k < litBefore ? -Infinity : arr ? arr.at : Infinity;
    const lit = t >= at ? (Number.isFinite(at) ? easeOutCubic(prog(t, at, 0.35)) : 1) : 0;
    const flash = t >= at && Number.isFinite(at) ? Math.exp(-(t - at) / 0.25) : 0;
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
  return <div style={{position: 'absolute', inset: 0, opacity: vis, pointerEvents: 'none'}}>{pins}</div>;
};
