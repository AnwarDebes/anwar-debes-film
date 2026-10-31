import React, {useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FilmGuide, GuideTimeline} from '../../../guide';
import {PixieCard, presetCell, type PixiePreset} from '../../../../pixie';
import {type as T} from '../../../../engine/tokens';

// Pixie as the guide, placed by the storyboard's lower-third spec: the box at 2% W, bottom edge at
// 88% H, u = 8 at 1440p (integer u at any size), the state card beside it on the right. The card's
// mono lines are set at the film's mono minimum (2.2% H).

export const cornerBox = (W: number, H: number) => {
  const u = presetCell('corner', H);
  return {u, x: Math.round(0.02 * W), y: Math.round(0.88 * H) - 32 * u, w: 34 * u, h: 32 * u};
};

/** Pixie's state card on its own, anywhere (the film-wide timeline). */
export const GuideCard: React.FC<{
  preset: PixiePreset;
  x: number;
  y: number;
  align?: 'left' | 'right';
  enterAt?: number;
  exitAt?: number;
  kicker?: string | null;
  labelSize?: number;
}> = (p) => {
  const timeline = useContext(GuideTimeline);
  const frame = useCurrentFrame();
  const {height: H} = useVideoConfig();
  const mono = Math.round(T.monoKicker.size * H);
  return (
    <PixieCard
      timeline={timeline}
      frame={frame}
      preset={p.preset}
      align={p.align ?? 'left'}
      x={p.x}
      y={p.y}
      enterAt={p.enterAt}
      exitAt={p.exitAt}
      kicker={p.kicker}
      kickerSize={mono}
      detailSize={mono}
      labelSize={p.labelSize}
    />
  );
};

export const CornerGuide: React.FC<{enterAt?: number; exitAt?: number; enterDuration?: number; exitDuration?: number}> = ({enterAt, exitAt, enterDuration = 1.2, exitDuration}) => {
  const {width: W, height: H, fps} = useVideoConfig();
  const b = cornerBox(W, H);
  const gap = Math.max(b.u, Math.round(0.02 * H));
  const cardEnter = enterAt !== undefined ? enterAt + Math.round(enterDuration * fps) + Math.round(0.05 * fps) : undefined;
  return (
    <>
      <FilmGuide
        preset="corner"
        x={b.x}
        y={b.y}
        side="right"
        card={false}
        enterAt={enterAt}
        enterDuration={enterDuration}
        exitAt={exitAt}
        exitDuration={exitDuration}
      />
      <GuideCard preset="corner" x={b.x + Math.ceil(32.2 * b.u) + gap} y={b.y + Math.round(13.5 * b.u)} enterAt={cardEnter} exitAt={exitAt} />
    </>
  );
};

/** Pixie alone (no card) at any preset and position, on the film-wide timeline. */
export const GuideAt: React.FC<{preset: PixiePreset; x: number; y: number; enterAt?: number; exitAt?: number; enterDuration?: number; exitDuration?: number; facing?: 'left' | 'right'}> = (p) => (
  <FilmGuide preset={p.preset} x={p.x} y={p.y} card={false} enterAt={p.enterAt} exitAt={p.exitAt} enterDuration={p.enterDuration} exitDuration={p.exitDuration} facing={p.facing} />
);
