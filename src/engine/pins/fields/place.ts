import type {Board} from '../board';
import type {FieldFn, PinSample} from '../types';
import {STEEL} from '../timeline';

/**
 * Where a picture sits on the wall. Centre in board uv; sizes in pin pitches, because a pin
 * picture's resolution is its pin count (a 40-pin box is 40 pins wide on any board).
 */
export interface Place {
  u: number;
  v: number;
  /** Height in pin pitches. */
  height: number;
  /** Width in pin pitches (default: height x the picture's aspect). */
  width?: number;
}

/** Maps board uv to the picture's local (s, t) in 0..1, t up. */
export type Local = (u: number, v: number) => [number, number];

export const placer = (board: Board, place: Place, aspect = 1): {local: Local; wWorld: number; hWorld: number} => {
  const hWorld = place.height * board.p;
  const wWorld = (place.width ?? place.height * aspect) * board.p;
  const cx = place.u - 0.5;
  const cy = place.v * board.extH - board.extH / 2;
  const ext = board.extH;
  const local: Local = (u, v) => [(u - 0.5 - cx) / wWorld + 0.5, (v * ext - ext / 2 - cy) / hWorld + 0.5];
  return {local, wWorld, hWorld};
};

export const inside01 = (s: number, t: number) => s >= 0 && s <= 1 && t >= 0 && t <= 1;

/** Flat steel everywhere (tint 0.9 unless given). */
export const flatField = (tint: number | [number, number, number] = STEEL): FieldFn => {
  const s: PinSample = {h: 0, tint};
  return () => s;
};

const tintOf = (s: PinSample): [number, number, number] => (typeof s.tint === 'number' ? [s.tint, s.tint, s.tint] : s.tint);

/**
 * Layer fields: the first layer whose sample is "present" wins (present = raised, glowing or
 * painted, or differing from the ground). Pins no layer claims take the base field.
 */
export const overField = (base: FieldFn, ...layers: Array<(u: number, v: number, i: number) => PinSample | null>): FieldFn => (u, v, i) => {
  for (const l of layers) {
    const s = l(u, v, i);
    if (s) return s;
  }
  return base(u, v, i);
};

/** Blend two fields: w = 0 gives a, 1 gives b (heights, tints, glow and paint mix). */
export const mixField = (a: FieldFn, b: FieldFn, w: number | ((u: number, v: number, i: number) => number)): FieldFn => (u, v, i) => {
  const k = typeof w === 'number' ? w : w(u, v, i);
  if (k <= 0) return a(u, v, i);
  if (k >= 1) return b(u, v, i);
  const sa = a(u, v, i);
  const sb = b(u, v, i);
  const ta = tintOf(sa);
  const tb = tintOf(sb);
  return {
    h: sa.h + (sb.h - sa.h) * k,
    tint: [ta[0] + (tb[0] - ta[0]) * k, ta[1] + (tb[1] - ta[1]) * k, ta[2] + (tb[2] - ta[2]) * k],
    glow: (sa.glow ?? 0) + ((sb.glow ?? 0) - (sa.glow ?? 0)) * k,
    paint: (sa.paint ?? 0) + ((sb.paint ?? 0) - (sa.paint ?? 0)) * k,
  };
};

export const smooth01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
