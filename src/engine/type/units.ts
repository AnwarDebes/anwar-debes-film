import {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';

/** Reference height that the reel was measured at. */
export const REF_H = 1080;

export interface Units {
  W: number;
  H: number;
  fps: number;
  /** fraction of H to px */
  h: (frac: number) => number;
  /** fraction of W to px */
  w: (frac: number) => number;
  /** a length measured in px on the 1080 reel, at this frame height */
  at1080: (px: number) => number;
  /** a hairline: 1 px at 1080, whole device pixels, never below 1 */
  hair: number;
}

export const makeUnits = (W: number, H: number, fps: number): Units => ({
  W,
  H,
  fps,
  h: (f) => f * H,
  w: (f) => f * W,
  at1080: (px) => (px * H) / REF_H,
  hair: Math.max(1, Math.round(H / REF_H)),
});

export const useUnits = (): Units => {
  const {width, height, fps} = useVideoConfig();
  return useMemo(() => makeUnits(width, height, fps), [width, height, fps]);
};

/** Film time in seconds: the explicit `t` when given, else the current frame. */
export const useTime = (t?: number): number => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return t ?? frame / fps;
};

/** Round to whole pixels (positions of text baselines and hairlines). */
export const px = (v: number): number => Math.round(v);
