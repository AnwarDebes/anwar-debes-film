import type {Sweep} from './types';

// The film's transition vocabulary (identity.md b5) as sweeps, with the reel's measured constants
// (identity.md c, motion.sweep). Speeds are board widths per second. On the film wall a board
// width is about 1.2 frame widths at the base framing, so 1.15 fills the frame in about 0.75 s,
// the reel's morph time. Spread a preset and override what a scene needs:
//   {id, at, field, sweep: {...SWEEPS.booleanFlip(), speed: 1.4}}

type UV = [number, number];

export const SWEEPS = {
  /** The portrait rising from below the frame (reel 6.6 s). */
  portraitRise: (): Sweep => ({origin: [0.5, -0.15], speed: 1.15, delayS: 0.15, jitterS: 0.08}),

  /** A circular front from a point: emblem to emblem, picture to picture (reel emblem swap). */
  from: (origin: UV, speed = 1.6, jitterS = 0.05): Sweep => ({origin, speed, jitterS}),

  /** Booleans: the tint flips first, then the heights follow, from the top-left (reel 15.2 s). */
  booleanFlip: (origin: UV = [0, 1]): Sweep => ({origin, speed: 2.2, jitterS: 0.04, tintFollowsWave: true, tintLeadS: 0.2}),

  /**
   * A straight front that paints as it goes: a ruled line drawn left to right, a raster scan.
   * Without an origin the front enters at the board edge it travels away from.
   */
  raster: (direction: UV = [1, 0], speed = 1.15, origin?: UV): Sweep => ({
    kind: 'linear',
    origin: origin ?? [direction[0] >= 0 ? 0 : 1, direction[1] >= 0 ? 0 : 1],
    direction,
    speed,
    jitterS: 0.02,
    tintFollowsWave: true,
  }),

  /** A page turn: a row-wise wave from the top edge (the thesis page rising, reel 59 s). */
  pageTurn: (speed = 0.9): Sweep => ({kind: 'linear', origin: [0.5, 1], direction: [0, -1], speed, jitterS: 0.03, tintFollowsWave: true}),

  /** Dissolve: every pin leaves at a seeded random time inside `spreadS` (reel 75.5 s). */
  dissolve: (spreadS = 0.9): Sweep => ({kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS, jitterS: 0.04, tintFollowsWave: true}),
};
