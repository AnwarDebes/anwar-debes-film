import React, {useLayoutEffect, useRef} from 'react';
import {random, useCurrentFrame} from 'remotion';
import {layout} from '../tokens';
import {useUnits} from './units';

export interface ScrimProps {
  /** start of the scrim, as a fraction of the frame along `edge`'s axis (0 = top/left) */
  from?: number;
  /** end of the scrim (the dark edge) */
  to?: number;
  maxAlpha?: number;
  edge?: 'bottom' | 'top' | 'left' | 'right';
  /** RGB of the darkening (the wall's void colour by default) */
  rgb?: readonly [number, number, number];
  /** overall opacity, for fading the scrim with its content */
  opacity?: number;
  /** dithered alpha, re-seeded every frame, so the ramp never bands (default true) */
  dither?: boolean;
  style?: React.CSSProperties;
}

const smooth = (p: number): number => p * p * (3 - 2 * p);

/** Extra width (px) of the noise canvas across the ramp; the per-frame shift picks a window of it. */
const SHIFT = 256;
/** Triangular alpha dither amplitude, in 8-bit alpha levels: about ±0.8 LSB on the composite over the wall. */
const DITHER = 2.5;

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * A soft darkening band under captions and edge text: a smoothstep ramp
 * computed per pixel row in float and dithered, because an 8-bit CSS
 * gradient bands on a dark ramp. The ramp is drawn once; each frame only
 * shifts which part of the wider noise canvas is visible (compositor work),
 * so the dither is temporal without redrawing.
 * Default: the caption scrim, 0.75 H to 1.0 H, max alpha 0.65.
 */
export const Scrim: React.FC<ScrimProps> = ({
  from = layout.captionScrim.fromH,
  to = layout.captionScrim.toH,
  maxAlpha = layout.captionScrim.maxAlpha,
  edge = 'bottom',
  rgb = [5, 8, 7],
  opacity = 1,
  dither = true,
  style,
}) => {
  const {W, H} = useUnits();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const vertical = edge === 'bottom' || edge === 'top';
  const span = vertical ? H : W;
  const a = Math.round(Math.min(from, to) * span);
  const b = Math.round(Math.max(from, to) * span);
  const len = Math.max(1, b - a);
  const cross = (vertical ? W : H) + (dither ? SHIFT : 0);
  const [r, g, bl] = rgb;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const cw = vertical ? cross : len;
    const ch = vertical ? len : cross;
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    const rnd = mulberry32(0x5c41);
    // darkest at the frame edge named by `edge`
    const darkAtEnd = edge === 'bottom' || edge === 'right';
    for (let i = 0; i < len; i++) {
      const p = (i + 0.5) / len;
      const alpha = maxAlpha * smooth(darkAtEnd ? p : 1 - p) * 255;
      for (let j = 0; j < cross; j++) {
        const n = dither ? (rnd() + rnd() - 1) * DITHER : 0;
        const v = Math.max(0, Math.min(255, Math.round(alpha + n)));
        const o = vertical ? (i * cw + j) * 4 : (j * cw + i) * 4;
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = bl;
        d[o + 3] = v;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [vertical, cross, len, maxAlpha, r, g, bl, edge, dither]);

  // stays mounted when hidden: the ramp is drawn once per mount
  const shift = dither ? Math.floor(random(`engine-scrim-${frame}`) * SHIFT) : 0;
  const box: React.CSSProperties = vertical
    ? {left: 0, width: W, top: a, height: len}
    : {top: 0, height: H, left: a, width: len};
  return (
    <div style={{position: 'absolute', ...box, overflow: 'hidden', opacity, visibility: opacity <= 0 ? 'hidden' : undefined, pointerEvents: 'none', ...style}}>
      <canvas
        ref={ref}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: vertical ? cross : len,
          height: vertical ? len : cross,
          transform: vertical ? `translateX(${-shift}px)` : `translateY(${-shift}px)`,
          willChange: 'transform',
        }}
      />
    </div>
  );
};
