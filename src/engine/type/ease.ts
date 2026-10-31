import {Easing} from 'remotion';
import {easing} from '../tokens';

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** 0..1 progress of t through [start, start + dur]. */
export const prog = (t: number, start: number, dur: number): number =>
  dur <= 0 ? (t >= start ? 1 : 0) : clamp01((t - start) / dur);

export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeInCubic = (x: number): number => x * x * x;
export const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);
export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Token curves (cubic-bezier control points from tokens.ts). */
export const easeUI = Easing.bezier(easing.ui[0], easing.ui[1], easing.ui[2], easing.ui[3]);
export const easeText = Easing.bezier(easing.text[0], easing.text[1], easing.text[2], easing.text[3]);
export const easeCamera = Easing.bezier(easing.camera[0], easing.camera[1], easing.camera[2], easing.camera[3]);

/**
 * Envelope for something that enters at `inAt` over `inS` and leaves at
 * `outAt` over `outS`: 0 before, rises to 1, falls to 0. `outAt` undefined
 * means it stays.
 */
export const envelope = (t: number, inAt: number, inS: number, outAt?: number, outS = 0.3): number => {
  const a = prog(t, inAt, inS);
  if (outAt === undefined) return a;
  return Math.min(a, 1 - prog(t, outAt, outS));
};

/** Blur radius below this is dropped entirely, so text at rest has no filter. */
export const BLUR_EPS = 0.05;

export const blurFilter = (radiusPx: number): string | undefined =>
  radiusPx > BLUR_EPS ? `blur(${radiusPx.toFixed(2)}px)` : undefined;
