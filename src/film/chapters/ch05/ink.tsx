import React from 'react';
import {font} from '../../../engine/tokens';
import {pullStyle, useFrameSize} from '../ch03/kit/ui';
import {INK_TEXT} from './common';

// Typography for chapter 05's light palette: CANDOR's own light cards (paper, a teal hairline),
// so dark ink reads crisply over the pale pin field.

export const PAPER_CSS = 'rgba(246,252,250,0.95)';
export const TEAL_LINE = 'rgba(11,135,123,0.38)';

export const InkCard: React.FC<{k: number; x: number; y: number; w?: number; pad?: number; children: React.ReactNode; align?: 'left' | 'right'}> = ({k, x, y, w, pad, children, align = 'left'}) => {
  const {W, H} = useFrameSize();
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  const p = pad ?? Math.round(0.024 * H);
  return (
    <div
      style={{
        position: 'absolute',
        ...(align === 'right' ? {right: W - x} : {left: x}),
        top: y,
        width: w,
        boxSizing: 'border-box',
        padding: `${Math.round(p * 0.85)}px ${p}px`,
        borderRadius: Math.round(0.017 * H),
        background: PAPER_CSS,
        border: `${hair}px solid ${TEAL_LINE}`,
        boxShadow: `0 ${Math.round(0.008 * H)}px ${Math.round(0.03 * H)}px rgba(14,42,38,0.16)`,
        color: INK_TEXT,
        ...pullStyle(k, H),
      }}
    >
      {children}
    </div>
  );
};

/** A soft dark corner under the guide, so Pixie's white card reads on the pale wall. */
export const GuideShade: React.FC<{k: number}> = ({k}) => {
  const {W, H} = useFrameSize();
  if (k <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: Math.round(0.55 * H),
        width: Math.round(0.5 * W),
        height: Math.round(0.45 * H),
        opacity: k,
        background: 'radial-gradient(ellipse 70% 62% at 18% 62%, rgba(5,8,7,0.62) 0%, rgba(5,8,7,0.4) 45%, rgba(5,8,7,0) 100%)',
        pointerEvents: 'none',
      }}
    />
  );
};

export const inkMono = (H: number, size = 0.024): React.CSSProperties => ({fontFamily: font.mono, fontSize: Math.round(size * H), color: INK_TEXT, whiteSpace: 'nowrap', lineHeight: 1.45});
