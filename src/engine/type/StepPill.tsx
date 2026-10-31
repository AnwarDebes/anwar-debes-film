import React, {useMemo} from 'react';
import {color, font, motion} from '../tokens';
import {blurFilter, easeInCubic, easeOutCubic, easeUI, prog} from './ease';
import {useFontsReady} from './fontsReady';
import {layoutBlock, type Align} from './layout';
import {parseMarkup, typo} from './markup';
import {advance, capHeightOf, fontCSS, runTop, type FontSpec} from './metrics';
import {mintGlow, tagLook} from './styles';
import {REF_H, useTime, useUnits} from './units';

export interface StepPillProps {
  /** step number, 1-7 */
  n: number;
  /** one sentence (about 12 words or fewer), markup allowed */
  text: string;
  at: number;
  exitAt?: number;
  t?: number;
  /** px: anchor x (centre, left or right edge by align). Default: frame centre. */
  x?: number;
  /** px: the pill's vertical centre. Default: 0.885 H (bottom centre, as in the project films). */
  y?: number;
  align?: Align;
  /** text size as a fraction of H (measured on the project films: 0.0356) */
  sizeH?: number;
  weight?: number;
  opacity?: number;
}

const DISC_INK = '#06100D';

/**
 * A numbered step, as in the project films: a dark glass pill, a mint disc
 * with the number, one bold sentence. The pill rises in, the disc pops, the
 * sentence focus-pulls; it leaves with a fade and a soft blur.
 */
export const StepPill: React.FC<StepPillProps> = ({
  n,
  text,
  at,
  exitAt,
  t: tProp,
  x: xProp,
  y: yProp,
  align = 'center',
  sizeH = 0.0356,
  weight = 650,
  opacity = 1,
}) => {
  const t = useTime(tProp);
  const {W, H, hair, h: fh} = useUnits();
  const ready = useFontsReady();
  const fs = sizeH * H;
  const base = useMemo<FontSpec>(() => ({family: font.sans, size: fs, weight, tracking: -0.015}), [fs, weight]);
  const numFont = useMemo<FontSpec>(() => ({family: font.sans, size: fs * 0.74, weight: 750, tracking: 0}), [fs]);

  const lay = useMemo(() => {
    if (!ready) return null;
    const items = parseMarkup(text).map((tk) => {
      const look = tagLook(tk.tag, base, {plainColor: color.text.display});
      return {text: typo(tk.text), tag: tk.tag, font: look.font, color: look.color, glow: look.glow};
    });
    const block = layoutBlock(items, {maxWidth: W * 0.9, maxLines: 1, align: 'left', boxWidth: W * 0.9});
    return {block, items};
  }, [ready, text, base, W]);

  if (!lay || t < at) return null;
  const h = Math.round(fs * 2.0);
  const d = Math.round(fs * 1.3);
  const padL = Math.round((h - d) / 2);
  const gap = Math.round(fs * 0.5);
  const padR = Math.round(fs * 0.85);
  const textW = lay.block.width;
  const w = Math.round(padL + d + gap + textW + padR);
  const xAnchor = xProp ?? W / 2;
  const cy = Math.round(yProp ?? fh(0.885));
  const left = Math.round(align === 'left' ? xAnchor : align === 'right' ? xAnchor - w : xAnchor - w / 2);
  const top = Math.round(cy - h / 2);

  const blurMax = (motion.textFocusPull.blurAt1080 * H) / REF_H;
  let alpha = easeOutCubic(prog(t, at, 0.25)) * opacity;
  const rise = (1 - easeUI(prog(t, at, 0.45))) * 0.3 * fs;
  let blur = 0;
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, 0.3);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
    blur = blurMax * 0.6 * easeInCubic(k);
  }
  const discK = easeOutCubic(prog(t, at + 0.06, 0.35));
  const textK = prog(t, at + 0.1, motion.textFocusPull.inS);
  const textBlur = blurMax * 0.75 * (1 - easeOutCubic(textK));
  const textAlpha = easeOutCubic(prog(t, at + 0.1, 0.25));
  const baseline = Math.round(cy + capHeightOf(base) / 2);
  const num = String(n);
  const numW = advance(num, numFont);
  const numBaseline = Math.round(cy + capHeightOf(numFont) / 2);
  const textLeft = left + padL + d + gap;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: alpha,
        filter: blurFilter(blur),
        transform: rise > 0.01 ? `translateY(${rise.toFixed(2)}px)` : undefined,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width: w,
          height: h,
          borderRadius: h / 2,
          background: color.card.glass,
          border: `${hair}px solid ${color.card.rule}`,
          boxSizing: 'border-box',
          boxShadow: `0 ${Math.round(fs * 0.3)}px ${Math.round(fs * 1.1)}px rgba(0,0,0,0.4)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: left + padL,
          top: Math.round(cy - d / 2),
          width: d,
          height: d,
          borderRadius: d / 2,
          background: color.accent.mint,
          boxShadow: `0 0 ${Math.round(d * 0.35)}px rgba(116,201,174,0.28)`,
          opacity: discK,
          transform: discK < 1 ? `scale(${(0.55 + 0.45 * discK).toFixed(4)})` : undefined,
        }}
      >
        <span
          style={{
            ...fontCSS(numFont),
            position: 'absolute',
            left: (d - numW) / 2,
            top: runTop(numBaseline, numFont) - Math.round(cy - d / 2),
            lineHeight: 1.6,
            color: DISC_INK,
          }}
        >
          {num}
        </span>
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: textAlpha, filter: blurFilter(textBlur)}}>
        {lay.block.runs.map((r) => {
          const it = lay.items[r.i];
          return (
            <span
              key={r.i}
              style={{
                ...fontCSS(r.font),
                position: 'absolute',
                left: textLeft + r.x,
                top: runTop(baseline, r.font),
                lineHeight: 1.6,
                color: it.color,
                textShadow: it.glow ? mintGlow(r.font.size, H) : undefined,
              }}
            >
              {r.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
