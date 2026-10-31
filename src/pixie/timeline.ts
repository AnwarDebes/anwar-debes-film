// Pixie's film timeline: one cue list for the whole film, resolved by the
// canonical state machine in pixie-core.ts (verified frame for frame against the
// original mascot.js), plus the guide card's text and the walk paths.
//
// Everything here is a pure function of the absolute frame. resolveTimeline is
// memoised, so every component that shares a cue list shares one O(frames) pass.

import {
  MIN_DWELL,
  ONESHOT_MS,
  resolveTimeline as resolveCore,
  type PixieState,
} from './pixie-core';

export type Facing = 'left' | 'right';

/** One event on screen that Pixie reacts to. */
export interface PixieCue {
  /** Absolute film frame (rounded, clamped to >= 0). */
  frame: number;
  /** A PixieState id. Unknown activities become 'thinking', as in the original. */
  activity: PixieState | (string & {});
  /**
   * Card detail line in the tool-title style ("Read README.md").
   * undefined keeps the previous detail, '' clears it (the original setMascot rule).
   */
  detail?: string;
}

/** What Pixie and its card show on one frame. */
export interface PixieMoment {
  /** The drawn pose (follows the label after the 150 ms dwell). */
  state: PixieState;
  target: PixieState;
  /** Card label: leads the pose and survives one-shots ("Done!" stays while Pixie idles). */
  label: string;
  detail: string;
  /** Frame the current label text appeared, and the text before it ('' at the start). */
  labelSince: number;
  prevLabel: string;
  detailSince: number;
  prevDetail: string;
  /** Frame the current pose started. */
  poseSince: number;
}

export interface PixieTimeline {
  readonly fps: number;
  /** Last resolved frame; every later frame holds this moment (nothing can change after it). */
  readonly lastFrame: number;
  at(frame: number): PixieMoment;
}

const sameMoment = (a: PixieMoment, b: PixieMoment) =>
  a.state === b.state &&
  a.target === b.target &&
  a.label === b.label &&
  a.detail === b.detail &&
  a.labelSince === b.labelSince &&
  a.prevLabel === b.prevLabel &&
  a.detailSince === b.detailSince &&
  a.prevDetail === b.prevDetail &&
  a.poseSince === b.poseSince;

function build(cues: readonly PixieCue[], fps: number): PixieTimeline {
  const norm = cues
    .map((c, i) => ({frame: Math.max(0, Math.round(c.frame)), activity: String(c.activity), detail: c.detail, i}))
    .sort((a, b) => a.frame - b.frame || a.i - b.i);
  const maxCue = norm.length ? norm[norm.length - 1].frame : 0;
  // After the last cue the pose settles within one one-shot plus one dwell.
  const lastFrame =
    maxCue + Math.ceil((ONESHOT_MS * fps) / 1000) + Math.ceil((MIN_DWELL * fps) / 1000) + 2;
  const core = resolveCore(
    norm.map((c) => ({frame: c.frame, activity: c.activity})),
    fps,
    lastFrame,
  );

  // Consecutive identical moments share one object, so a long film costs little memory.
  const frames: PixieMoment[] = new Array(lastFrame + 1);
  let ci = 0;
  let detail = '';
  let label = core[0].label;
  let labelSince = 0;
  let prevLabel = '';
  let detailSince = 0;
  let prevDetail = '';
  let pose = core[0].state;
  let poseSince = 0;
  let last: PixieMoment | null = null;
  for (let f = 0; f <= lastFrame; f++) {
    const before = detail;
    while (ci < norm.length && norm[ci].frame === f) {
      const d = norm[ci].detail;
      if (d !== undefined) detail = d;
      ci++;
    }
    if (detail !== before) {
      prevDetail = before;
      detailSince = f;
    }
    const r = core[f];
    if (r.label !== label) {
      prevLabel = label;
      label = r.label;
      labelSince = f;
    }
    if (r.state !== pose) {
      pose = r.state;
      poseSince = f;
    }
    const m: PixieMoment = {
      state: r.state,
      target: r.target,
      label,
      detail,
      labelSince,
      prevLabel,
      detailSince,
      prevDetail,
      poseSince,
    };
    last = last && sameMoment(last, m) ? last : m;
    frames[f] = last;
  }
  return {
    fps,
    lastFrame,
    at(frame: number) {
      const f = Math.round(frame);
      return frames[f <= 0 ? 0 : f >= lastFrame ? lastFrame : f];
    },
  };
}

// ---------------------------------------------------------------- memo
const byIdentity = new WeakMap<readonly PixieCue[], Map<number, PixieTimeline>>();
const byContent = new Map<string, PixieTimeline>();
const CONTENT_CACHE = 32;

const contentKey = (cues: readonly PixieCue[], fps: number) =>
  `${fps}|${cues.map((c) => `${c.frame}:${c.activity}:${c.detail === undefined ? '\u0000' : c.detail}`).join('\u0001')}`;

/**
 * Resolve a cue list with the canonical state machine (150 ms dwell, 1.5 s
 * one-shots, label leads the pose and persists after one-shots). Memoised by
 * array identity and by content, so inline cue arrays are also computed once.
 */
export function resolveTimeline(cues: readonly PixieCue[], fps: number): PixieTimeline {
  let perFps = byIdentity.get(cues);
  const hit = perFps?.get(fps);
  if (hit) return hit;
  const key = contentKey(cues, fps);
  let tl = byContent.get(key);
  if (!tl) {
    tl = build(cues, fps);
    if (byContent.size >= CONTENT_CACHE) byContent.delete(byContent.keys().next().value as string);
    byContent.set(key, tl);
  }
  if (!perFps) {
    perFps = new Map();
    byIdentity.set(cues, perFps);
  }
  perFps.set(fps, tl);
  return tl;
}

// ---------------------------------------------------------------- walking
/**
 * A walk with only the existing legs and bob (pixie.md 8.9). Positions are the
 * horizontal offset of Pixie's 34 x 32 scene box, in scene cells.
 */
export interface PixieWalk {
  fromX: number;
  toX: number;
  /** Absolute frame the walk starts. */
  startFrame: number;
  /** Cells per second: default 4 for 'scurry' (the bug's speed), 3 for 'stroll'. Kept below 8. */
  speed?: number;
  /** 'scurry' (default): the running/searching leg wave. 'stroll': the pose's own default wave. */
  gait?: 'scurry' | 'stroll';
  /** Facing after arrival. Default: the travel direction, which then stays. */
  arriveFacing?: Facing;
}

export interface WalkPose {
  /** Box offset in scene cells. */
  dx: number;
  walking: boolean;
  /** null before the first walk starts (the caller's facing applies). */
  facing: Facing | null;
  gait: 'scurry' | 'stroll';
}

const IDLE_WALK: WalkPose = {dx: 0, walking: false, facing: null, gait: 'scurry'};

/** Where a walk (or a list of walks) puts Pixie on a frame. Linear path, clamped at toX. */
export function walkAt(
  walk: PixieWalk | readonly PixieWalk[] | undefined,
  frame: number,
  fps: number,
): WalkPose {
  if (!walk) return IDLE_WALK;
  const list: readonly PixieWalk[] = Array.isArray(walk) ? walk : [walk as PixieWalk];
  if (list.length === 0) return IDLE_WALK;
  let current: PixieWalk | null = null;
  let first: PixieWalk = list[0];
  for (const w of list) {
    if (w.startFrame < first.startFrame) first = w;
    if (w.startFrame <= frame && (!current || w.startFrame >= current.startFrame)) current = w;
  }
  if (!current) return {dx: first.fromX, walking: false, facing: null, gait: first.gait ?? 'scurry'};
  const gait = current.gait ?? 'scurry';
  const speed = Math.min(7.99, Math.max(0.01, current.speed ?? (gait === 'stroll' ? 3 : 4)));
  const dist = current.toX - current.fromX;
  const dir: Facing = dist < 0 ? 'left' : 'right';
  const travelled = (speed * (frame - current.startFrame)) / fps;
  if (dist === 0 || travelled >= Math.abs(dist)) {
    return {dx: current.toX, walking: false, facing: current.arriveFacing ?? dir, gait};
  }
  return {dx: current.fromX + Math.sign(dist) * travelled, walking: true, facing: dir, gait};
}

/** Frame on which a walk arrives (the first frame that is no longer walking). */
export function walkArrivalFrame(walk: PixieWalk, fps: number): number {
  const gait = walk.gait ?? 'scurry';
  const speed = Math.min(7.99, Math.max(0.01, walk.speed ?? (gait === 'stroll' ? 3 : 4)));
  return walk.startFrame + Math.ceil((Math.abs(walk.toX - walk.fromX) / speed) * fps);
}
