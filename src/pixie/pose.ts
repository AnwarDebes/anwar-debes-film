// One frame of Pixie as canonical scene rects: the shared step behind the SVG
// renderer, the pixel-square entrance and the pin-wall field.

import {random} from 'remotion';
import {
  blinkSchedule,
  isBlinking,
  mirrorRects,
  pixieRects,
  type PixieState,
  type Rect,
} from './pixie-core';
import {walkAt, type Facing, type PixieTimeline, type PixieWalk} from './timeline';

// ---------------------------------------------------------------- blinking
// pixie.md 8.4: interval k is 2.2 + 2.6 * random(`${seed}-blink-${k}`) seconds and
// the eyes close for the last 140 ms of each interval. The schedule only grows,
// and its prefix never depends on how far it was computed, so any frame order
// gives the same answer.
const schedules = new Map<string, Float64Array>();

export function blinkScheduleFor(seed: string, untilSeconds: number): Float64Array {
  let s = schedules.get(seed);
  if (!s || s[s.length - 1] < untilSeconds + 5) {
    const horizon = Math.max(untilSeconds, s ? s[s.length - 1] * 2 : 600);
    s = blinkSchedule((k) => random(`${seed}-blink-${k}`), horizon);
    schedules.set(seed, s);
  }
  return s;
}

export const isBlinkingAt = (seed: string, t: number): boolean =>
  isBlinking(blinkScheduleFor(seed, t), t);

// ---------------------------------------------------------------- pose
export interface PixiePoseInput {
  /** Absolute film frame. */
  frame: number;
  fps: number;
  /** Fixed pose; ignored when a timeline is given. */
  state?: PixieState;
  timeline?: PixieTimeline | null;
  /** Seconds added to t (phase continuity across cuts). t is clamped to >= 0. */
  timeOffset?: number;
  seed?: string;
  facing?: Facing;
  walk?: PixieWalk | readonly PixieWalk[];
  reducedMotion?: boolean;
  shadow?: boolean;
  /** Force a leg formula. By default walking uses the walk's gait, otherwise the pose's own. */
  gait?: 'state' | 'scurry';
}

export interface PixiePose {
  t: number;
  state: PixieState;
  facing: Facing;
  /** Box offset in scene cells (walking). */
  dx: number;
  walking: boolean;
  blinking: boolean;
  /** Canonical rects in scene cells, painter's order, already mirrored for facing = 'left'. */
  rects: Rect[];
}

export function pixiePose(p: PixiePoseInput): PixiePose {
  const t = Math.max(0, p.frame / p.fps + (p.timeOffset ?? 0));
  const state = p.timeline ? p.timeline.at(p.frame).state : (p.state ?? 'idle');
  const w = walkAt(p.walk, p.frame, p.fps);
  const facing: Facing = w.facing ?? p.facing ?? 'right';
  const gait = p.gait ?? (w.walking && w.gait === 'scurry' ? 'scurry' : 'state');
  const reduced = !!p.reducedMotion;
  const blinking = !reduced && isBlinkingAt(p.seed ?? 'pixie', t);
  let rects = pixieRects(state, t, {blinking, reduced, gait});
  if (facing === 'left') rects = mirrorRects(rects);
  if (p.shadow === false) rects = rects.filter((r) => r[5] !== 'shadow');
  return {t, state, facing, dx: w.dx, walking: w.walking, blinking, rects};
}
