import React from 'react';
import {useVideoConfig} from 'remotion';
import {FilmGuide} from '../../../guide';
import {presetCell, SCENE_H} from '../../../../pixie';

// Pixie in the lower third (storyboard 2, "The lower third"): the corner preset (u = 8 at 1440p),
// box at x 2% W with its bottom edge at 88% H, the state card beside it. It reads the film-wide
// state machine, so poses and one-shots carry across scenes and chapters. Its card steps aside while
// a chapter card is up (two nodes: the card leaves, then enters again; Pixie itself never moves).

/** Two guide nodes for a chapter whose gate shows a chapter card from `cardFrom` to `cardTo` (s). */
export const guideNodes = (prefix: string, from: number, to: number, cardFrom: number, cardTo: number, f: (s: number) => number) => [
  {id: `${prefix}guide-a`, from, to: cardTo, render: () => <LowerThirdGuide cardExitAt={f(cardFrom)} />},
  {id: `${prefix}guide-b`, from: cardTo, to, render: () => <LowerThirdGuide cardEnterAt={f(cardTo)} />},
];

export const LowerThirdGuide: React.FC<{enterAt?: number; exitAt?: number; cardEnterAt?: number; cardExitAt?: number}> = ({enterAt, exitAt, cardEnterAt, cardExitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const u = presetCell('corner', H);
  const x = Math.round(0.02 * W);
  const y = Math.round(0.88 * H) - SCENE_H * u;
  return <FilmGuide preset="corner" x={x} y={y} side="right" enterAt={enterAt} exitAt={exitAt} cardEnterAt={cardEnterAt} cardExitAt={cardExitAt} />;
};
