// Pixie in the pin world (pixie.md 8.10): a LiveFieldFn that samples the
// canonical rects at each pin centre. The pattern travels across fixed pins, the
// way a pin screen moves a picture.
//
// Per frame the pose is computed once (on the first pin of a new t) and compiled
// into typed arrays; per pin the work is a bounding-box test plus ~40 rect tests.
// Samples come from a per-pin pool, so steady-state frames allocate nothing:
// read a sample before the next frame is evaluated, do not keep it.
//
// On the wall: <PinWall live={[{fn: field, region: field.bounds}]} />. Samples set
// paint = 1 where Pixie's colours cover a pin (a non-metallic head, so coral reads
// as coral, not copper) and 0 under the floor shadow, which only darkens steel.

import type {LiveFieldFn, PinSample, RGB} from '../engine/pins/types';
import {SCENE_H, SCENE_W, translateRects, type Part, type PixieState} from './pixie-core';
import {pixiePose} from './pose';
import {CompiledPixie, emptySample} from './sampler';
import {resolveTimeline, type Facing, type PixieCue, type PixieTimeline, type PixieWalk} from './timeline';

export interface PixieFieldOptions {
  /** Frames per second of the film; t (seconds) maps to frame = round(t * fps) for cues and walks. */
  fps: number;
  state?: PixieState;
  cues?: readonly PixieCue[];
  timeline?: PixieTimeline;
  timeOffset?: number;
  seed?: string;
  facing?: Facing;
  walk?: PixieWalk | readonly PixieWalk[];
  reducedMotion?: boolean;
  /** The canonical floor shadow darkens pins by 18 %, never raises them. Default true. */
  shadow?: boolean;

  /** Board uv (v up) of the scene centre, cell (17, 16). Default [0.5, 0.5]. */
  center?: readonly [number, number];
  /**
   * Scene cell size in board widths (u units). With k pins per cell on a board of
   * `cols` columns this is k / cols. Keep k >= 3 on the hex board.
   */
  cell: number;
  /** Board height / board width in world units (the v span over the u span), so cells stay square. */
  boardAspect: number;

  /**
   * Height for canonical h = 1, as a fraction of the wall relief. Default 0.2:
   * 4.4 pitches on the default 22-pitch wall (pixie.md 8.10 asks for 3 to 5).
   */
  relief?: number;
  /** Tint of the bare pins that translucent rects composite over, in `colorSpace`. Default 0.9. */
  steel?: number | RGB;
  /** Multiplier on Pixie's colours before compositing (material compensation). Default 1. */
  gain?: number;
  /** Space of the returned tint: 'linear' (three.js instanceColor, default) or 'srgb'. */
  colorSpace?: 'linear' | 'srgb';
  /**
   * 0..1: pins sink back to the board and lose their tint. A number, or a
   * function of film time and the pin's board uv (for sweeps and reveals).
   */
  presence?: number | ((t: number, u: number, v: number) => number);
}

/** The sample pixieField returns: a PinSample plus what a dedicated Pixie material needs. */
export interface PixiePinSample extends PinSample {
  tint: RGB;
  /** Coverage of Pixie at this pin (0..1): blend over the board's own field with it. */
  alpha: number;
  /** Straight canonical colour of the covering rects (same space as tint), for a painted material. */
  albedo: RGB;
  /** Canonical height 0..1 before relief and presence. */
  canonicalH: number;
  /** 1 where Pixie's own colours cover the pin, 0 under the shadow alone; times presence. */
  paint: number;
  part: Part | null;
}

export type PixieFieldFn = LiveFieldFn & {
  /** The rects and pose used for time t (computes them if needed). */
  poseAt(t: number): ReturnType<typeof pixiePose>;
  /** Pixie's scene box in board uv, [uMin, vMin, uMax, vMax]: pass it as the live layer's region. */
  readonly bounds: [number, number, number, number];
};

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// Pins repeat a handful of exact colours, so the conversion is memoised in a
// direct-mapped table: the same pow, computed once per distinct value.
const LIN_SLOTS = 4096;
const linKeys = new Float64Array(LIN_SLOTS).fill(NaN);
const linVals = new Float64Array(LIN_SLOTS);
const toLinearCached = (c: number) => {
  const slot = ((c * 1048573) | 0) & (LIN_SLOTS - 1);
  if (linKeys[slot] === c) return linVals[slot];
  const v = srgbToLinear(c);
  linKeys[slot] = c;
  linVals[slot] = v;
  return v;
};

export function pixieField(o: PixieFieldOptions): PixieFieldFn {
  const fps = o.fps;
  const timeline = o.timeline ?? (o.cues ? resolveTimeline(o.cues, fps) : null);
  const cell = o.cell;
  const aspect = o.boardAspect;
  const [cu, cv] = o.center ?? [0.5, 0.5];
  const cellV = cell / aspect; // one scene cell in v units
  const u0 = cu - (SCENE_W / 2) * cell; // u of scene x = 0
  const v0 = cv + (SCENE_H / 2) * cellV; // v of scene y = 0 (scene y grows downwards)
  const invCell = 1 / cell;
  const invCellV = 1 / cellV;
  const relief = o.relief ?? 0.2;
  const gain = o.gain ?? 1;
  const linear = (o.colorSpace ?? 'linear') === 'linear';
  const steelIn: RGB = typeof o.steel === 'number' || o.steel === undefined
    ? [o.steel ?? 0.9, o.steel ?? 0.9, o.steel ?? 0.9]
    : o.steel;
  // Compositing happens in sRGB, like the canvas; convert at the end.
  const steelS: RGB = linear
    ? [linearToSrgb(steelIn[0]), linearToSrgb(steelIn[1]), linearToSrgb(steelIn[2])]
    : [steelIn[0], steelIn[1], steelIn[2]];
  const [sR, sG, sB] = steelS;

  const compiled = new CompiledPixie();
  const s = emptySample();
  // One sample object per pin index, reused every frame (kept in fast elements).
  const pool: Array<PixiePinSample | undefined> = [];
  let lastT = NaN;
  const presenceFn = typeof o.presence === 'function' ? o.presence : null;
  const presenceConst = typeof o.presence === 'number' ? Math.min(1, Math.max(0, o.presence)) : 1;
  let pose: ReturnType<typeof pixiePose> | null = null;

  const prepare = (t: number) => {
    if (t === lastT && pose) return;
    lastT = t;
    const frame = Math.round(t * fps);
    pose = pixiePose({
      frame,
      fps,
      state: o.state,
      timeline,
      timeOffset: o.timeOffset,
      seed: o.seed,
      facing: o.facing,
      walk: o.walk,
      reducedMotion: o.reducedMotion,
      shadow: o.shadow,
    });
    compiled.compile(pose.dx ? translateRects(pose.rects, pose.dx, 0) : pose.rects);
  };

  const fn = ((u: number, v: number, i: number, t: number): PinSample | null => {
    if (t !== lastT || !pose) prepare(t);
    if (presenceConst === 0) return null;
    if (!compiled.sample((u - u0) * invCell, (v0 - v) * invCellV, s)) return null;
    const a = s.a;
    if (a <= 0) return null;
    let presence = presenceConst;
    if (presenceFn) {
      const pr = presenceFn(t, u, v);
      presence = pr <= 0 ? 0 : pr >= 1 ? 1 : pr;
      if (presence === 0) return null;
    }
    if (i >= pool.length) while (pool.length <= i) pool.push(undefined);
    let out = pool[i];
    if (!out) {
      out = {h: 0, tint: [0, 0, 0], alpha: 0, albedo: [0, 0, 0], canonicalH: 0, paint: 0, part: null};
      pool[i] = out;
    }
    // Source-over onto the bare pin in sRGB (s.r, s.g, s.b are premultiplied 0-255), like the canvas.
    const k = 1 - a;
    let r = (gain * s.r) / 255 + sR * k;
    let g = (gain * s.g) / 255 + sG * k;
    let b = (gain * s.b) / 255 + sB * k;
    if (presence !== 1) {
      r = sR + (r - sR) * presence;
      g = sG + (g - sG) * presence;
      b = sB + (b - sB) * presence;
    }
    const tint = out.tint;
    tint[0] = linear ? toLinearCached(r < 0 ? 0 : r) : r < 0 ? 0 : r;
    tint[1] = linear ? toLinearCached(g < 0 ? 0 : g) : g < 0 ? 0 : g;
    tint[2] = linear ? toLinearCached(b < 0 ? 0 : b) : b < 0 ? 0 : b;
    const alb = out.albedo;
    if (a === 1 && presence === 1 && gain <= 1) {
      // Opaque and fully present: the albedo is the tint itself.
      alb[0] = tint[0];
      alb[1] = tint[1];
      alb[2] = tint[2];
    } else {
      const inv = gain / (255 * a);
      const ar = Math.min(1, s.r * inv);
      const ag = Math.min(1, s.g * inv);
      const ab = Math.min(1, s.b * inv);
      alb[0] = linear ? toLinearCached(ar) : ar;
      alb[1] = linear ? toLinearCached(ag) : ag;
      alb[2] = linear ? toLinearCached(ab) : ab;
    }
    out.alpha = a * presence;
    out.canonicalH = s.h;
    out.h = relief * s.h * presence;
    out.paint = (s.part === 'shadow' ? 0 : a) * presence;
    out.part = s.part;
    return out;
  }) as PixieFieldFn;

  fn.poseAt = (t: number) => {
    prepare(t);
    return pose!;
  };
  Object.defineProperty(fn, 'bounds', {
    get: () => [u0, v0 - SCENE_H * cellV, u0 + SCENE_W * cell, v0] as [number, number, number, number],
  });
  return fn;
}
