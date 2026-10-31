import React from 'react';
import {color, motion} from '../tokens';
import {blurFilter, easeInCubic, easeOutCubic, prog} from './ease';
import {useFontsReady} from './fontsReady';
import type {Align} from './layout';
import {fontCSS, inkWidth, runTop} from './metrics';
import {fontOf, legibilityShadow} from './styles';
import {REF_H, useTime, useUnits} from './units';

export type Tone = 'mint' | 'grey' | 'white' | 'amber' | 'red' | 'gold';

export const toneColor = (tone: Tone | string): string => {
  switch (tone) {
    case 'mint':
      return color.accent.mintLabel;
    case 'grey':
      return color.text.secondary;
    case 'white':
      return color.text.display;
    case 'amber':
      return color.signal.amber;
    case 'red':
      return color.signal.verdictRed;
    case 'gold':
      return color.signal.gold;
    default:
      return tone;
  }
};

export interface KickerProps {
  text: string;
  /** a chapter or step index shown first in full mint, e.g. 3 → "03 · " */
  index?: number | string;
  tone?: Tone | string;
  kind?: 'monoKicker' | 'monoCardLabel' | 'emblemLabelMono';
  sizeH?: number;
  t?: number;
  /** enter time; omitted = already on screen */
  at?: number;
  exitAt?: number;
  enter?: 'focus' | 'type' | 'none';
  /** characters per second for enter="type" */
  cps?: number;
  /** absolute placement: x (edge given by align) and the baseline, in px */
  x?: number;
  baseline?: number;
  align?: Align;
  opacity?: number;
  style?: React.CSSProperties;
}

export const kickerString = (text: string, index?: number | string): {head: string; body: string} => {
  const head = index === undefined ? '' : `${typeof index === 'number' ? String(index).padStart(2, '0') : index} · `;
  return {head, body: text.toUpperCase()};
};

/**
 * Mono uppercase kicker with wide tracking (+0.2 em): metadata, chapter
 * indices, card labels. Enters with a focus pull or by typing on.
 */
export const Kicker: React.FC<KickerProps> = ({
  text,
  index,
  tone = 'mint',
  kind = 'monoKicker',
  sizeH,
  t: tProp,
  at,
  exitAt,
  enter = 'focus',
  cps = 42,
  x,
  baseline,
  align = 'left',
  opacity = 1,
  style,
}) => {
  const t = useTime(tProp);
  const {H} = useUnits();
  const ready = useFontsReady();
  const f = fontOf(kind, H, sizeH ? {size: sizeH * H} : {});
  const {head, body} = kickerString(text, index);
  const full = head + body;

  let alpha = opacity;
  let blur = 0;
  let shown = full.length;
  const blurMax = (motion.textFocusPull.blurAt1080 * H) / REF_H;
  if (at !== undefined) {
    if (t < at) return null;
    if (enter === 'focus') {
      alpha *= easeOutCubic(prog(t, at, 0.25));
      blur = blurMax * 0.75 * (1 - easeOutCubic(prog(t, at, motion.textFocusPull.inS)));
    } else if (enter === 'type') {
      shown = Math.min(full.length, Math.floor((t - at) * cps) + 1);
    }
  }
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, motion.textFocusPull.outS);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
    blur = Math.max(blur, blurMax * 0.75 * easeInCubic(k));
  }

  const headShown = full.slice(0, Math.min(shown, head.length));
  const bodyShown = shown > head.length ? body.slice(0, shown - head.length) : '';
  const hidden = full.slice(shown);
  const content = (
    <>
      {headShown ? <span style={{color: color.accent.mint}}>{headShown}</span> : null}
      {bodyShown ? <span>{bodyShown}</span> : null}
      {hidden ? <span style={{opacity: 0}}>{hidden}</span> : null}
    </>
  );
  const css: React.CSSProperties = {
    ...fontCSS({...f, uppercase: false}),
    color: toneColor(tone),
    opacity: alpha,
    filter: blurFilter(blur),
    lineHeight: 1.6,
    textShadow: legibilityShadow(f.size, H, 1),
  };
  if (x === undefined || baseline === undefined) {
    return <span style={{display: 'inline-block', ...css, ...style}}>{content}</span>;
  }
  if (!ready) return null;
  const w = inkWidth(full, {...f, uppercase: false});
  const left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  return <span style={{position: 'absolute', left, top: runTop(baseline, f), ...css, ...style}}>{content}</span>;
};
