import type {Beat, Board, LightKey, LiveLayer, Magnet, Press, Ripple} from '../../../engine/pins';
import {frameOn, type CameraKey, type CameraPose, type FocusKey} from '../../../engine/camera';
import type {PixieCue} from '../../../pixie/timeline';
import type {FilmCtx, TimedNode} from '../../types';
import {uvAtScreen} from './kit/pic';
import {timeKit, type TimeKit} from './kit/time';

/** Everything a scene builder adds to; one per chapter build. */
export interface Env {
  ctx: FilmCtx;
  board: Board;
  tk: TimeKit;
  W: number;
  H: number;
  aspect: number;
  /** the handoff pose (the placeholder's default) */
  base: CameraPose;
  beats: Beat[];
  camera: CameraKey[];
  focus: FocusKey[];
  light: LightKey[];
  ripples: Ripple[];
  presses: Press[];
  magnets: Magnet[];
  live: LiveLayer[];
  world: TimedNode[];
  overlays: TimedNode[];
  /** overlays drawn above all others (chips, then Pixie) */
  top: TimedNode[];
  captionSkip: string[];
  pixie: PixieCue[];
  /** rule-line arrivals (film time each new repository's pin lights) */
  arrivals: number[];
  ruleHidden: Array<[number, number]>;
  /** uv on the wall under a screen point, at the base pose */
  at: (sx: number, sy: number) => [number, number];
  /** a Pixie cue at film time t */
  cue: (t: number, activity: string, detail?: string) => void;
}

export const makeEnv = (ctx: FilmCtx): Env => {
  const aspect = ctx.width / ctx.height;
  const base = frameOn(ctx.board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});
  const pixie: PixieCue[] = [];
  const env: Env = {
    ctx,
    board: ctx.board,
    tk: timeKit(ctx.tl),
    W: ctx.width,
    H: ctx.height,
    aspect,
    base,
    beats: [],
    camera: [],
    focus: [],
    light: [],
    ripples: [],
    presses: [],
    magnets: [],
    live: [],
    world: [],
    overlays: [],
    top: [],
    captionSkip: [],
    pixie,
    arrivals: [],
    ruleHidden: [],
    at: (sx, sy) => uvAtScreen(ctx.board, base, sx, sy, aspect),
    cue: (t, activity, detail) => {
      pixie.push({frame: ctx.tl.f(t), activity, detail});
    },
  };
  return env;
};

/** The studio light at rest (PinStudio's defaults). */
const LIGHT_REST = {look: [0, 0] as [number, number], key: 1, pool: 1, env: 1, poolAt: [0, 0] as [number, number], spread: 1};

/**
 * The chapter's handoff of the shared lens and light: at both ends the light eases back to rest and
 * the lens to a pinhole, so whatever a neighbouring chapter leaves (or expects) never leaks across.
 */
export const restWorld = (env: Env, start: number, end: number) => {
  env.light.push({at: start, dur: 0.6, ...LIGHT_REST, ease: 'inOutSine'});
  env.light.push({at: end - 1.0, dur: 0.8, ...LIGHT_REST, ease: 'inOutSine'});
  env.focus.push({at: start, to: 'target', aperture: 0});
  env.focus.push({at: end - 1.0, to: 'target', aperture: 0});
};
