import type React from 'react';
import type {Beat, FieldFn, LightKey, LiveLayer, Press, Ripple} from '../../../../engine/pins';
import {FILM_RIPPLE} from '../../../../engine/pins';
import type {CameraKey, CameraPose, FocusKey} from '../../../../engine/camera';
import type {PixieCue} from '../../../../pixie/timeline';
import type {ChapterSpec, FilmCtx, TimedNode} from '../../../types';
import {handoffPose, makeLens, pinAtScreen, pinSpace, type Lens, type PinSpace} from './space';
import {shapesField, type GroundSpec, type Shape} from './shapes';

// Collects one chapter's contribution while its scenes are built, and checks the basics the
// film relies on (prefixed ids, times inside the chapter, first camera key a cut on the handoff
// pose) before handing the spec over.

export interface Builder {
  ctx: FilmCtx;
  id: string;
  S: PinSpace;
  W: number;
  H: number;
  aspect: number;
  lens: Lens;
  /** the pose the film hands over between chapters */
  home: CameraPose;
  beats: Beat[];
  camera: CameraKey[];
  focus: FocusKey[];
  light: LightKey[];
  live: LiveLayer[];
  ripples: Ripple[];
  presses: Press[];
  overlays: TimedNode[];
  world: TimedNode[];
  pixie: PixieCue[];
  captionSkip: string[];
  /** a beat: the whole wall re-targets to `field` */
  beat: (name: string, at: number, field: FieldFn, extra?: Omit<Beat, 'id' | 'at' | 'field'>) => void;
  /** a field from shapes over a ground */
  field: (shapes: readonly Shape[], ground?: GroundSpec | FieldFn) => FieldFn;
  move: (at: number, dur: number, pose: CameraPose, ease?: CameraKey['ease']) => void;
  cut: (at: number, pose: CameraPose) => void;
  /** pin-space point a pose shows at a frame fraction */
  at: (pose: CameraPose, fx: number, fy: number) => [number, number];
  overlay: (name: string, from: number, to: number, render: (t: number) => React.ReactNode) => void;
  cue: (at: number, activity: PixieCue['activity'], detail?: string) => void;
  ripple: (at: number, X: number, Y: number, o?: Partial<Ripple>) => void;
  f: (s: number) => number;
  spec: () => ChapterSpec;
}

export const makeBuilder = (ctx: FilmCtx, id: string): Builder => {
  const S = pinSpace(ctx.board);
  const W = ctx.width;
  const H = ctx.height;
  const aspect = W / H;
  const camera: CameraKey[] = [];
  const lens = makeLens(S, camera, W, H);
  const b: Builder = {
    ctx,
    id,
    S,
    W,
    H,
    aspect,
    lens,
    home: handoffPose(ctx.board, aspect),
    beats: [],
    camera,
    focus: [],
    light: [],
    live: [],
    ripples: [],
    presses: [],
    overlays: [],
    world: [],
    pixie: [],
    captionSkip: [],
    beat: (name, at, field, extra = {}) => b.beats.push({id: `c${id}-${name}`, at, field, ...extra}),
    field: (shapes, ground) => shapesField(S, shapes, ground),
    move: (at, dur, pose, ease = 'camera') => camera.push({at, dur, pose, ease}),
    cut: (at, pose) => camera.push({at, pose}),
    at: (pose, fx, fy) => pinAtScreen(S, pose, aspect, fx, fy),
    overlay: (name, from, to, render) => b.overlays.push({id: `c${id}-${name}`, from, to, render}),
    cue: (at, activity, detail) => b.pixie.push({frame: Math.round(at * ctx.fps), activity, detail}),
    ripple: (at, X, Y, o = {}) => b.ripples.push({...FILM_RIPPLE, at, origin: S.uv(X, Y), ...o}),
    f: (s) => Math.round(s * ctx.fps),
    spec: () => {
      const ch = ctx.tl.chapter(id);
      const out: ChapterSpec = {
        beats: b.beats,
        camera: b.camera,
        focus: b.focus,
        light: b.light,
        live: b.live,
        ripples: b.ripples,
        presses: b.presses,
        overlays: b.overlays,
        world: b.world,
        pixie: b.pixie,
        captionSkip: b.captionSkip,
      };
      // the basics the film relies on
      for (const x of b.beats) if (x.at < ch.start - 1e-6 || x.at > ch.end + 1e-6) throw new Error(`chapter ${id}: beat ${x.id} at ${x.at} is outside the chapter`);
      const first = [...camera].sort((p, q) => p.at - q.at)[0];
      if (!first || Math.abs(first.at - ch.start) > 1e-6) throw new Error(`chapter ${id}: the first camera key must be a cut at the chapter start`);
      return out;
    },
  };
  return b;
};
