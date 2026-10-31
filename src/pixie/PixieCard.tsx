// The guide's label card, as in the promo and the reel: a mono grey kicker
// "Right now, Pixie is", the canonical state label in Schibsted Grotesk 700
// ("Done!" in mint), and a coral mono detail line in the tool-title style.
// The card follows the timeline's label, which leads the pose by up to 150 ms
// and persists after one-shots.
//
// Lines are laid out on exact cap-top / baseline boxes (text-box trim), at whole
// px. Blur is used only during focus pulls; at rest no filter touches the text.

import React, {useMemo} from 'react';
import {Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import {easing, motion} from '../engine/tokens';
import {STATE_LABELS, type PixieState} from './pixie-core';
import {CARD_COLORS, CARD_FONTS, DEFAULT_KICKER, PIXIE_PRESETS, type PixiePreset} from './presets';
import {resolveTimeline, type PixieCue, type PixieTimeline} from './timeline';

// Cap heights (em) of the two faces, used to size the block before it renders.
const CAP_SANS = 0.703; // Schibsted Grotesk
const CAP_MONO = 0.73; // JetBrains Mono

export interface CardGeometry {
  kicker: number;
  label: number;
  detail: number;
  /** Kicker baseline to label cap top. */
  gapKicker: number;
  /** Label baseline to detail cap top (clears the label's descenders). */
  gapDetail: number;
  /** Kicker cap top to detail baseline. */
  height: number;
  /** Offsets of each line's cap top from the block top. */
  kickerTop: number;
  labelTop: number;
  detailTop: number;
}

export function cardGeometry(
  H: number,
  preset: PixiePreset = 'featured',
  sizes: {kicker?: number; label?: number; detail?: number} = {},
  withKicker = true,
): CardGeometry {
  const spec = PIXIE_PRESETS[preset];
  const K = Math.round(sizes.kicker ?? spec.kicker * H);
  const L = Math.round(sizes.label ?? spec.label * H);
  const D = Math.round(sizes.detail ?? spec.detail * H);
  const gapKicker = Math.round(Math.max(0.23 * L, 0.85 * K));
  const gapDetail = Math.round(Math.max(0.28 * L, 0.9 * D));
  const kickerTop = 0;
  const labelTop = withKicker ? Math.round(CAP_MONO * K) + gapKicker : 0;
  const detailTop = labelTop + Math.round(CAP_SANS * L) + gapDetail;
  const height = detailTop + Math.round(CAP_MONO * D);
  return {kicker: K, label: L, detail: D, gapKicker, gapDetail, height, kickerTop, labelTop, detailTop};
}

export interface PixieCardProps {
  /** Shared timeline (or cues) driving label and detail. */
  timeline?: PixieTimeline | null;
  cues?: readonly PixieCue[];
  /** Static content when there is no timeline: a canonical state, or its label and a detail. */
  state?: PixieState;
  label?: string;
  detail?: string;
  /** Absolute frame. Default useCurrentFrame(). */
  frame?: number;
  /** Type scale. Default 'featured'. */
  preset?: PixiePreset;
  kickerSize?: number;
  labelSize?: number;
  detailSize?: number;
  /** Anchor: x is the left edge for align 'left', the right edge for align 'right'. */
  align?: 'left' | 'right';
  x: number;
  /** Vertical centre of the block (kicker cap top to detail baseline), px. */
  y: number;
  /** Kicker text; null hides it. Default "Right now, Pixie is". */
  kicker?: string | null;
  /** Absolute frames: focus-pull in / out. Without enterAt the card is simply present. */
  enterAt?: number;
  exitAt?: number;
  /** Detail type-on speed in characters per second. Default 48. */
  typeRate?: number;
  /** Draw cap-top and baseline guides (layout checks). */
  debug?: boolean;
}

const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
const easeText = Easing.bezier(easing.text[0], easing.text[1], easing.text[2], easing.text[3]);
const easeIn = Easing.bezier(0.55, 0, 1, 0.45);

interface LineLook {
  opacity: number;
  blur: number;
}
const REST: LineLook = {opacity: 1, blur: 0};

const lookStyle = (l: LineLook): React.CSSProperties => ({
  opacity: l.opacity >= 0.999 ? undefined : l.opacity,
  filter: l.blur > 0.05 ? `blur(${l.blur.toFixed(2)}px)` : undefined,
});

const combine = (a: LineLook, b: LineLook): LineLook => ({opacity: a.opacity * b.opacity, blur: a.blur + b.blur});

// text-box trim: each line box runs exactly from the cap top to the alphabetic baseline.
const trimmed = {textBoxTrim: 'trim-both', textBoxEdge: 'cap alphabetic'} as unknown as React.CSSProperties;

const monoFeatures: React.CSSProperties = {
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"calt" 0, "liga" 0',
};

export const PixieCard: React.FC<PixieCardProps> = (p) => {
  const {fps, width: W, height: H} = useVideoConfig();
  const current = useCurrentFrame();
  const frame = p.frame ?? current;
  const timeline = useMemo(
    () => p.timeline ?? (p.cues ? resolveTimeline(p.cues, fps) : null),
    [p.timeline, p.cues, fps],
  );
  const kickerText = p.kicker === undefined ? DEFAULT_KICKER : p.kicker;
  const g = cardGeometry(
    H,
    p.preset ?? 'featured',
    {kicker: p.kickerSize, label: p.labelSize, detail: p.detailSize},
    kickerText !== null,
  );
  const align = p.align ?? 'left';
  const top = Math.round(p.y - g.height / 2);
  const blurMax = (motion.textFocusPull.blurAt1080 * H) / 1080;
  const sec = (s: number) => Math.round(s * fps);

  // Content is frozen once the exit starts.
  const at = p.exitAt !== undefined && frame > p.exitAt ? p.exitAt : frame;
  const m = timeline ? timeline.at(at) : null;
  const label = m ? m.label : (p.label ?? STATE_LABELS[p.state ?? 'idle']);
  const detail = m ? m.detail : (p.detail ?? '');

  // Whole-card focus pull in and out.
  let card: LineLook = REST;
  const enter = p.enterAt;
  if (enter !== undefined && frame < enter) return null;
  if (p.exitAt !== undefined && frame >= p.exitAt) {
    const e = easeText(clamp01((frame - p.exitAt) / sec(motion.textFocusPull.outS)));
    if (e >= 1) return null;
    card = {opacity: 1 - e, blur: e * blurMax};
  }
  const pullIn = (delay: number): LineLook => {
    if (enter === undefined) return REST;
    const e = easeText(clamp01((frame - enter - delay) / sec(motion.textFocusPull.inS)));
    return {opacity: e, blur: (1 - e) * blurMax};
  };
  const shown = enter ?? -Infinity; // first frame the card is on screen

  // Label swap: the old word blurs out fast, then the new one focus-pulls in.
  // They never overlap: two words superimposed read as noise.
  // A change while the card is still arriving is part of the arrival: the new
  // word simply pulls in from its own start, so the card never flashes the old one.
  const swapOut = sec(0.12);
  const swapIn = sec(0.3);
  const arriving = sec(motion.textFocusPull.inS);
  let labelIn = pullIn(sec(0.05));
  let labelNow: LineLook = REST;
  let labelPrev: LineLook | null = null;
  if (m && m.labelSince > shown && m.prevLabel) {
    const d = at - m.labelSince;
    if (enter !== undefined && m.labelSince - enter <= arriving) {
      const e = easeText(clamp01(d / swapIn));
      labelIn = {opacity: e, blur: (1 - e) * blurMax};
    } else {
      if (d < swapOut) {
        const e = easeIn(clamp01(d / swapOut));
        labelPrev = {opacity: 1 - e, blur: e * blurMax * 0.6};
      }
      const e = easeText(clamp01((d - swapOut) / swapIn));
      labelNow = {opacity: e, blur: (1 - e) * blurMax * 0.6};
    }
  }

  // Detail: the old line fades, the new one types on in place (layout fixed).
  const rate = p.typeRate ?? 48;
  const typeFrom = Math.max(m ? m.detailSince + sec(0.14) : -Infinity, enter !== undefined ? enter + sec(0.14) : -Infinity);
  const typed = Number.isFinite(typeFrom)
    ? Math.max(0, Math.min(detail.length, Math.floor(((at - typeFrom) / fps) * rate)))
    : detail.length;
  let detailPrev: LineLook | null = null;
  if (m && m.detailSince > shown && m.prevDetail && !(enter !== undefined && m.detailSince - enter <= arriving)) {
    const d = at - m.detailSince;
    const fadeF = sec(0.12);
    if (d < fadeF) detailPrev = {opacity: 1 - clamp01(d / fadeF), blur: 0};
  }

  const isDone = (l: string) => l === STATE_LABELS.success;
  const pos = (lineTop: number): React.CSSProperties => ({
    position: 'absolute',
    top: top + lineTop,
    ...(align === 'left' ? {left: Math.round(p.x)} : {right: W - Math.round(p.x)}),
    whiteSpace: 'pre',
    margin: 0,
    ...trimmed,
  });
  const labelStyle = (l: string): React.CSSProperties => ({
    ...pos(g.labelTop),
    fontFamily: CARD_FONTS.label,
    fontWeight: 700,
    fontSize: g.label,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    color: isDone(l) ? CARD_COLORS.done : CARD_COLORS.label,
    textShadow: isDone(l) ? `0 0 ${Math.round(g.label * 0.14)}px ${CARD_COLORS.doneGlow}` : undefined,
  });
  const detailStyle: React.CSSProperties = {
    ...pos(g.detailTop),
    fontFamily: CARD_FONTS.detail,
    fontWeight: 500,
    fontSize: g.detail,
    lineHeight: 1,
    color: CARD_COLORS.detail,
    ...monoFeatures,
  };

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {kickerText !== null ? (
        <div
          style={{
            ...pos(g.kickerTop),
            fontFamily: CARD_FONTS.kicker,
            fontWeight: 500,
            fontSize: g.kicker,
            lineHeight: 1,
            color: CARD_COLORS.kicker,
            ...monoFeatures,
            ...lookStyle(combine(card, pullIn(0))),
          }}
        >
          {kickerText}
        </div>
      ) : null}
      {labelPrev && m ? (
        <div style={{...labelStyle(m.prevLabel), ...lookStyle(combine(card, labelPrev))}}>{m.prevLabel}</div>
      ) : null}
      <div style={{...labelStyle(label), ...lookStyle(combine(card, combine(labelIn, labelNow)))}}>
        {label}
      </div>
      {detailPrev && m ? (
        <div style={{...detailStyle, ...lookStyle(combine(card, detailPrev))}}>{m.prevDetail}</div>
      ) : null}
      {detail ? (
        <div style={{...detailStyle, ...lookStyle(card)}}>
          {detail.slice(0, typed)}
          <span style={{opacity: 0}}>{detail.slice(typed)}</span>
        </div>
      ) : null}
      {p.debug ? (
        <>
          {[g.kickerTop, g.kickerTop + Math.round(CAP_MONO * g.kicker), g.labelTop, g.labelTop + Math.round(CAP_SANS * g.label), g.detailTop, g.height].map((yy, i) => (
            <div key={i} style={{position: 'absolute', left: 0, right: 0, top: top + yy, height: 1, background: 'rgba(116,201,174,0.5)'}} />
          ))}
        </>
      ) : null}
    </div>
  );
};
