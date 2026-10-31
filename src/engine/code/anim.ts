import {Easing} from 'remotion';
import {easing} from '../tokens';

// Easing curves from the tokens, built once at module scope.
export const easeUi = Easing.bezier(...easing.ui);
export const easeCamera = Easing.bezier(...easing.camera);
export const easeText = Easing.bezier(...easing.text);

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Linear 0..1 progress of t through [start, start + dur]. */
export const prog = (t: number, start: number, dur: number): number =>
  dur <= 0 ? (t >= start ? 1 : 0) : clamp01((t - start) / dur);

/**
 * In/out envelope: eases up over `inDur` from `at`, holds, and eases down over
 * `outDur` from `until` (if given).
 */
export const envelope = (
  t: number,
  at: number,
  inDur: number,
  until?: number,
  outDur = 0.35,
  ease: (x: number) => number = easeUi,
): number => {
  const a = ease(prog(t, at, inDur));
  if (until === undefined) return a;
  return a * (1 - ease(prog(t, until, outDur)));
};
