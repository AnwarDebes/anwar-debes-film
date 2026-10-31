import React from 'react';
import {useVideoConfig} from 'remotion';
import {FilmGuide} from '../../../guide';
import {presetCell} from '../../../../pixie/presets';
import type {PixieWalk} from '../../../../pixie/timeline';

/**
 * Pixie in the lower third (storyboard layout spec): the corner-size box at x 2% W with its
 * bottom edge at 88% H, the state card beside it.
 */
export const LowerThirdGuide: React.FC<{walk?: readonly PixieWalk[]}> = ({walk}) => {
  const {width: W, height: H} = useVideoConfig();
  const u = presetCell('corner', H);
  const x = Math.round(0.02 * W);
  const y = Math.round(0.88 * H) - 32 * u;
  return <FilmGuide preset="corner" x={x} y={y} side="right" walk={walk} />;
};
