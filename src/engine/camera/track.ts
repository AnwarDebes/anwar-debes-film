import * as THREE from 'three';
import {easing as easingTokens} from '../tokens';
import type {Board} from '../pins/board';
import {uvToWorld} from '../pins/board';
import {applyPose, copyPose, emptyPose, lerpPose, type CameraPose, type Vec3} from './pose';

// Camera and focus tracks: pure functions of time.

export type EaseSpec = 'camera' | 'ui' | 'text' | 'linear' | 'inOutSine' | readonly [number, number, number, number];

const bezierCache = new Map<string, (t: number) => number>();

/** CSS-style cubic-bezier easing, solved with Newton steps (pure). */
export const cubicBezier = (x1: number, y1: number, x2: number, y2: number): ((t: number) => number) => {
  const key = `${x1},${y1},${x2},${y2}`;
  const hit = bezierCache.get(key);
  if (hit) return hit;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const fn = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-7) break;
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    // bisection fallback keeps it monotone near flat ends
    if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-5) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        if (sx(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sy(t);
  };
  bezierCache.set(key, fn);
  return fn;
};

export const easeFn = (e: EaseSpec | undefined): ((t: number) => number) => {
  const spec = e ?? 'camera';
  if (spec === 'linear') return (t) => Math.min(1, Math.max(0, t));
  if (spec === 'inOutSine') return (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
  const pts = typeof spec === 'string' ? easingTokens[spec] : spec;
  return cubicBezier(pts[0], pts[1], pts[2], pts[3]);
};

// ---------------------------------------------------------------- camera keys

/** Move to `pose` over [at, at + dur]; the camera holds between moves. */
export interface CameraKey {
  at: number;
  dur?: number;
  pose: CameraPose;
  ease?: EaseSpec;
}

export interface CompiledTrack {
  keys: CameraKey[];
  starts: CameraPose[];
  eases: Array<(t: number) => number>;
}

const trackCache = new WeakMap<readonly CameraKey[], CompiledTrack>();

export const compileTrack = (keys: readonly CameraKey[]): CompiledTrack => {
  const hit = trackCache.get(keys);
  if (hit) return hit;
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const eases = sorted.map((k) => easeFn(k.ease));
  const starts: CameraPose[] = [];
  const tr: CompiledTrack = {keys: sorted, starts, eases};
  for (let k = 0; k < sorted.length; k++) starts.push(k === 0 ? sorted[0].pose : segmentAt(tr, k - 1, sorted[k].at));
  trackCache.set(keys, tr);
  return tr;
};

const segmentAt = (tr: CompiledTrack, k: number, t: number, out?: CameraPose): CameraPose => {
  const key = tr.keys[k];
  const dur = key.dur ?? 0;
  if (dur <= 0 || t >= key.at + dur) return out ? copyPose(key.pose, out) : key.pose;
  const x = Math.max(0, (t - key.at) / dur);
  return lerpPose(tr.starts[k], key.pose, tr.eases[k](x), out);
};

/**
 * The camera pose at time t. Pass `out` to write into an existing pose (no allocation); without
 * it, a held pose is returned by reference and must not be mutated.
 */
export const poseAt = (tr: CompiledTrack, t: number, out?: CameraPose): CameraPose => {
  const {keys} = tr;
  if (!keys.length) throw new Error('camera track has no keys');
  let k = 0;
  for (let j = 0; j < keys.length; j++) if (keys[j].at <= t) k = j;
  if (t < keys[0].at) return out ? copyPose(keys[0].pose, out) : keys[0].pose;
  return segmentAt(tr, k, t, out);
};

/** The pose a CameraRig with these keys and creep shows at time t (for HTML layers). */
export const rigPoseAt = (keys: readonly CameraKey[], t: number, creep?: (t: number) => number, out?: CameraPose): CameraPose => {
  const p = poseAt(compileTrack(keys), t, out ?? (creep ? emptyPose() : undefined));
  if (creep) p.distance *= creep(t);
  return p;
};

/**
 * The reel's creep (identity.md 1.2): about +6% push-in across each beat that eases back 5-9%
 * during the morph at the next beat. Returns a distance multiplier for time t.
 */
export const beatCreep = (beatTimes: readonly number[], opts: {perBeat?: number; easeBack?: number; morphS?: number; end?: number} = {}) => {
  const per = opts.perBeat ?? 0.06;
  const back = opts.easeBack ?? 0.07;
  const morph = opts.morphS ?? 0.9;
  const times = [...beatTimes].sort((a, b) => a - b);
  const inOut = easeFn('inOutSine');
  return (t: number): number => {
    let scale = 1;
    for (let k = 0; k < times.length; k++) {
      const t0 = times[k];
      const t1 = k + 1 < times.length ? times[k + 1] : (opts.end ?? t0 + 5);
      if (t <= t0) break;
      // push in across the beat
      scale *= 1 - per * inOut((Math.min(t, t1) - t0) / Math.max(0.001, t1 - t0));
      // ease back during the next morph
      if (k + 1 < times.length && t > t1) scale *= 1 + back * inOut((t - t1) / morph);
    }
    return scale;
  };
};

// ---------------------------------------------------------------- focus

export type FocusTarget =
  | number
  | 'target'
  | {point: Vec3}
  /** A point on the wall at height h (world units) above the plate. */
  | {uv: [number, number]; h?: number};

export interface FocusKey {
  at: number;
  dur?: number;
  to: FocusTarget;
  /** Lens aperture diameter, world units (0 = pinhole, everything sharp). */
  aperture?: number;
  ease?: EaseSpec;
}

export interface LensState {
  /** View-space depth of the focus plane. */
  focusDistance: number;
  aperture: number;
}

const _p = new THREE.Vector3();
const _fwd = new THREE.Vector3();

const depthOf = (to: FocusTarget, cam: THREE.PerspectiveCamera, pose: CameraPose, board?: Board): number => {
  if (typeof to === 'number') return to;
  if (to === 'target') _p.set(pose.target[0], pose.target[1], pose.target[2]);
  else if ('point' in to) _p.set(to.point[0], to.point[1], to.point[2]);
  else {
    if (!board) throw new Error('focus on uv needs the board');
    const [x, y] = uvToWorld(board, to.uv[0], to.uv[1]);
    _p.set(x, y, to.h ?? 0);
  }
  cam.getWorldDirection(_fwd);
  return Math.max(1e-4, _p.sub(cam.position).dot(_fwd));
};

export interface CompiledFocus {
  keys: FocusKey[];
  eases: Array<(t: number) => number>;
  /** aperture in effect once key k has arrived (inherits when a key leaves it out) */
  apertures: number[];
}

const focusCache = new WeakMap<readonly FocusKey[], CompiledFocus>();

export const compileFocus = (keys: readonly FocusKey[]): CompiledFocus => {
  const hit = focusCache.get(keys);
  if (hit) return hit;
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  const apertures: number[] = [];
  for (let k = 0; k < sorted.length; k++) apertures.push(sorted[k].aperture ?? (k > 0 ? apertures[k - 1] : 0));
  const cf = {keys: sorted, eases: sorted.map((k) => easeFn(k.ease)), apertures};
  focusCache.set(keys, cf);
  return cf;
};

/**
 * Lens state at time t for a camera already posed at time t. Focus pulls blend in diopters
 * (1 / distance), the way a focus ring travels; the target depth is re-measured at t, so a pull
 * stays on its subject while the camera moves.
 */
export const lensAt = (
  cf: CompiledFocus,
  t: number,
  cam: THREE.PerspectiveCamera,
  pose: CameraPose,
  board?: Board,
  out?: LensState,
): LensState => {
  const o = out ?? {focusDistance: 0, aperture: 0};
  const {keys} = cf;
  if (!keys.length) {
    o.focusDistance = pose.distance;
    o.aperture = 0;
    return o;
  }
  let k = 0;
  for (let j = 0; j < keys.length; j++) if (keys[j].at <= t) k = j;
  if (t < keys[0].at) k = 0;
  // back to the latest key that has fully arrived (the first key always has), then blend forward
  // through every pull still in progress
  let base = k;
  while (base > 0) {
    const key = keys[base];
    const dur = key.dur ?? 0;
    if (dur <= 0 || t >= key.at + dur) break;
    base--;
  }
  let fd = depthOf(keys[base].to, cam, pose, board);
  let ap = cf.apertures[base];
  for (let j = base + 1; j <= k; j++) {
    const key = keys[j];
    const z = depthOf(key.to, cam, pose, board);
    const e = cf.eases[j](Math.max(0, (t - key.at) / (key.dur ?? 1)));
    fd = 1 / Math.max(1e-6, 1 / fd + (1 / z - 1 / fd) * e);
    ap += (cf.apertures[j] - ap) * e;
  }
  o.focusDistance = fd;
  o.aperture = ap;
  return o;
};

/**
 * Aperture that blurs a point `depthDelta` behind (or, negative, in front of) the focus plane by
 * `radiusPx` pixels at a reference frame height.
 */
export const apertureForBlur = (radiusPx: number, focus: number, depthDelta: number, fovDeg = 18, heightPx = 1440): number => {
  const k = Math.abs(1 / focus - 1 / (focus + depthDelta));
  return (radiusPx * 4 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / (heightPx * Math.max(1e-9, k));
};

/** Blur radius in pixels for a point at depth z, given the lens (the formula PostFX uses). */
export const cocRadiusPx = (lens: LensState, z: number, fovDeg: number, heightPx: number): number =>
  (lens.aperture * heightPx * (1 / lens.focusDistance - 1 / z)) / (4 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));

export {applyPose};
