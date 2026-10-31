// PixieGuide: Pixie plus its label card, placed by a layout preset, entering by
// assembling from pixel squares and leaving by dispersing.
//
// Render it in one top-level layer with absolute frames (or pass `frame`), so
// the bob, blink and one-shot phases run continuously through the film.

import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {layout} from '../engine/tokens';
import {SCENE_H, SCENE_W, type PixieState} from './pixie-core';
import {Pixie} from './Pixie';
import {PixieCard, cardGeometry} from './PixieCard';
import {PROP_REACH, presetCell, type PixiePreset} from './presets';
import {resolveTimeline, type Facing, type PixieCue, type PixieTimeline, type PixieWalk} from './timeline';

export interface PixieGuideProps {
  /** Size and type scale: corner (u 8 at 1440p), guide (12), featured (20), hero (28). */
  preset?: PixiePreset;
  cues?: readonly PixieCue[];
  timeline?: PixieTimeline | null;
  /** Static pose and detail when there are no cues. */
  state?: PixieState;
  detail?: string;
  /** Absolute frame. Default useCurrentFrame(). */
  frame?: number;
  timeOffset?: number;
  seed?: string;
  facing?: Facing;
  walk?: PixieWalk | readonly PixieWalk[];
  reducedMotion?: boolean;
  shadow?: boolean;
  /** Top-left of Pixie's 34 x 32 box in px. Default per preset. */
  x?: number;
  y?: number;
  /** Side of Pixie the card sits on. Default 'left' for corner and hero, else 'right'. */
  side?: 'left' | 'right';
  /** Show the label card. Default true. */
  card?: boolean;
  kicker?: string | null;
  /** Absolute frame the pixel squares appear; Pixie lands enterDuration later, then the card. */
  enterAt?: number;
  enterDuration?: number;
  /** Absolute frame the card leaves; Pixie disperses right after it. */
  exitAt?: number;
  exitDuration?: number;
  /** Override the card's own in/out frames. */
  cardEnterAt?: number;
  cardExitAt?: number;
  debug?: boolean;
}

export interface GuideLayout {
  u: number;
  box: {x: number; y: number; w: number; h: number};
  card: {x: number; y: number; align: 'left' | 'right'};
}

/**
 * Where a preset puts Pixie's box and the card on a W x H frame. The card never
 * overlaps a prop: it starts past x = 32.2 cells (the bubble's reach) on the right
 * side, or ends before the mirrored reach on the left side. In 'hero' the card
 * sits on the frame's left text margin, as in the reel.
 */
export function guideLayout(
  W: number,
  H: number,
  preset: PixiePreset,
  side?: 'left' | 'right',
  x?: number,
  y?: number,
): GuideLayout {
  const u = presetCell(preset, H);
  const w = SCENE_W * u;
  const h = SCENE_H * u;
  const margin = Math.round(layout.marginLeftW * W);
  const s = side ?? (preset === 'corner' || preset === 'hero' ? 'left' : 'right');
  let bx: number;
  let by: number;
  if (preset === 'corner') {
    // Top-right: the creature's right edge (cell 24) on the right margin, antenna tips near 7.5 % H.
    bx = W - margin - 24 * u;
    by = Math.round(0.075 * H) - Math.round(4.4 * u);
  } else if (preset === 'hero') {
    bx = Math.round(0.7 * W) - 17 * u;
    by = Math.round(0.49 * H - 15.6 * u);
  } else {
    // Creature's left edge (cell 10) on the text margin, creature and shadow centred on H / 2.
    bx = margin - 10 * u;
    by = Math.round(0.5 * H - 15.6 * u);
  }
  if (x !== undefined) bx = Math.round(x);
  if (y !== undefined) by = Math.round(y);
  const gap = Math.max(u, Math.round(0.02 * H));
  const cardY = by + Math.round(13.5 * u); // the head's centre
  let card: GuideLayout['card'];
  if (preset === 'hero' && s === 'left') card = {x: margin, y: cardY, align: 'left'};
  else if (s === 'right') card = {x: bx + Math.ceil(PROP_REACH * u) + gap, y: cardY, align: 'left'};
  else card = {x: bx + Math.floor((SCENE_W - PROP_REACH) * u) - gap, y: cardY, align: 'right'};
  return {u, box: {x: bx, y: by, w, h}, card};
}

export const PixieGuide: React.FC<PixieGuideProps> = (p) => {
  const {fps, width: W, height: H} = useVideoConfig();
  const current = useCurrentFrame();
  const frame = p.frame ?? current;
  const preset = p.preset ?? 'guide';
  const timeline = useMemo(
    () => p.timeline ?? (p.cues ? resolveTimeline(p.cues, fps) : null),
    [p.timeline, p.cues, fps],
  );
  const L = guideLayout(W, H, preset, p.side, p.x, p.y);
  const enterDuration = p.enterDuration ?? 1.2;
  const landed = p.enterAt !== undefined ? p.enterAt + Math.round(enterDuration * fps) : undefined;
  const cardEnterAt = p.cardEnterAt ?? (landed !== undefined ? landed + Math.round(0.05 * fps) : undefined);
  const cardExitAt = p.cardExitAt ?? p.exitAt;
  const pixieExitAt = p.exitAt !== undefined ? p.exitAt + Math.round(0.12 * fps) : undefined;
  const g = cardGeometry(H, preset, {}, p.kicker !== null);

  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: L.box.x, top: L.box.y, width: L.box.w, height: L.box.h}}>
        <Pixie
          cell={L.u}
          frame={frame}
          state={p.state}
          timeline={timeline}
          timeOffset={p.timeOffset}
          seed={p.seed}
          facing={p.facing}
          walk={p.walk}
          reducedMotion={p.reducedMotion}
          shadow={p.shadow}
          enterAt={p.enterAt}
          enterDuration={enterDuration}
          exitAt={pixieExitAt}
          exitDuration={p.exitDuration}
        />
      </div>
      {p.card === false ? null : (
        <PixieCard
          timeline={timeline}
          state={p.state}
          detail={p.detail}
          frame={frame}
          preset={preset}
          align={L.card.align}
          x={L.card.x}
          y={L.card.y}
          kicker={p.kicker}
          enterAt={cardEnterAt}
          exitAt={cardExitAt}
          debug={p.debug}
        />
      )}
      {p.debug ? (
        <div
          style={{
            position: 'absolute',
            left: L.box.x,
            top: L.box.y,
            width: L.box.w,
            height: L.box.h,
            outline: '1px dashed rgba(116,201,174,0.45)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: Math.round(13.5 * L.u), height: 1, background: 'rgba(116,201,174,0.35)'}} />
          <div style={{position: 'absolute', top: 0, bottom: 0, left: Math.ceil(PROP_REACH * L.u), width: 1, background: 'rgba(240,138,112,0.45)'}} />
          <div style={{position: 'absolute', left: 0, top: L.box.h + 4, fontSize: g.detail * 0.6, color: '#74C9AE', fontFamily: 'monospace'}}>
            {`${preset} u=${L.u} box ${L.box.w}x${L.box.h}`}
          </div>
        </div>
      ) : null}
    </div>
  );
};
