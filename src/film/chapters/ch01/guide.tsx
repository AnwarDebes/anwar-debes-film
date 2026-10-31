import React, {useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Pixie, PixieCard, presetCell, type Facing} from '../../../pixie';
import {GuideTimeline} from '../../guide';
import {MONO_MIN} from './kit';

// Pixie as the guide in the lower third (storyboard layout spec): the corner-size Pixie (u = 8 at
// 1440p) in its box at x 2 % W with the box's bottom edge at 88 % H, and the state card beside it.
// Both read the film-wide guide timeline (as FilmGuide does) and draw Pixie with the canonical
// renderer; the card is set at the film's legible sizes (mono 0.022 H, label 0.046 H).

export const lowerThirdBox = (W: number, H: number) => {
  const u = presetCell('corner', H);
  const x = Math.round(0.02 * W);
  const y = Math.round(0.88 * H - 32 * u);
  return {u, x, y, w: 34 * u, h: 32 * u};
};

export interface LowerThirdProps {
  /** absolute frames */
  enterAt?: number;
  exitAt?: number;
  cardEnterAt?: number;
  cardExitAt?: number;
  facing?: Facing;
  /** frames during which Pixie scurries in place (the treadmill: the wall scrolls behind it) */
  scurry?: ReadonlyArray<readonly [number, number]>;
  card?: boolean;
  x?: number;
  y?: number;
  /** cell size override (u = 4 in the 14.3 pull-back) */
  cell?: number;
  /** frames during which the card steps aside (title cards, busy beats); it fades over 0.3 s */
  cardHidden?: ReadonlyArray<readonly [number, number]>;
}

export const LowerThird: React.FC<LowerThirdProps> = ({enterAt, exitAt, cardEnterAt, cardExitAt, facing = 'right', scurry, card = true, x, y, cell, cardHidden}) => {
  const {width: W, height: H, fps} = useVideoConfig();
  const timeline = useContext(GuideTimeline);
  const frame = useCurrentFrame();
  const b = lowerThirdBox(W, H);
  const u = cell ?? b.u;
  const bx = x ?? b.x;
  const by = y ?? b.y;
  const landed = enterAt !== undefined ? enterAt + Math.round(1.2 * fps) : undefined;
  const scurrying = !!scurry?.some(([a, z]) => frame >= a && frame < z);
  const fade = Math.round(0.3 * fps);
  let cardK = 1;
  for (const [a, z] of cardHidden ?? []) {
    if (frame < a - fade || frame > z + fade) continue;
    const kin = Math.min(1, Math.max(0, (a - frame) / fade));
    const kout = Math.min(1, Math.max(0, (frame - z) / fade));
    cardK = Math.min(cardK, Math.max(kin, kout));
  }
  return (
    <>
      <div style={{position: 'absolute', left: bx, top: by, width: 34 * u, height: 32 * u}}>
        <Pixie
          cell={u}
          frame={frame}
          timeline={timeline}
          facing={facing}
          gait={scurrying ? 'scurry' : 'state'}
          enterAt={enterAt}
          exitAt={exitAt !== undefined ? exitAt + Math.round(0.12 * fps) : undefined}
        />
      </div>
      {card && cardK > 0.001 ? (
        <div style={{position: 'absolute', inset: 0, opacity: cardK}}>
        <PixieCard
          timeline={timeline}
          frame={frame}
          preset="corner"
          kickerSize={Math.round(MONO_MIN * H)}
          labelSize={Math.round(0.046 * H)}
          detailSize={Math.round(MONO_MIN * H)}
          align="left"
          x={bx + Math.ceil(32.2 * u) + Math.max(u, Math.round(0.016 * H))}
          y={by + Math.round(13.5 * u)}
          enterAt={cardEnterAt ?? (landed !== undefined ? landed + 3 : undefined)}
          exitAt={cardExitAt ?? exitAt}
        />
        </div>
      ) : null}
    </>
  );
};
