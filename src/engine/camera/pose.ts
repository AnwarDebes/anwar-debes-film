import * as THREE from 'three';
import type {Board} from '../pins/board';
import {uvToWorld} from '../pins/board';

// Camera poses for the long lens (identity.md d.4): an orbit around a target on the wall.
// The wall lies in the XY plane facing +Z. Angles are radians.

export type Vec3 = [number, number, number];

export interface CameraPose {
  /** The point the lens looks at (usually on the wall surface). */
  target: Vec3;
  /** Camera distance from the target. */
  distance: number;
  /** Orbit around the wall's vertical axis; + moves the camera to the right of the wall normal. */
  yaw: number;
  /** + puts the camera above the target, looking down. */
  pitch: number;
  roll?: number;
  /** Vertical field of view, degrees (18 = the reel's long lens). */
  fov: number;
}

/** The reel's base pose relative to the wall (site: board rotation x 0.06, y -0.2). */
export const BASE_YAW = 0.2;
export const BASE_PITCH = 0.06;
export const LONG_LENS_FOV = 18;

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Camera position for a pose. */
export const posePosition = (p: CameraPose, out = new THREE.Vector3()): THREE.Vector3 => {
  _dir.set(Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), Math.cos(p.yaw) * Math.cos(p.pitch));
  return out.set(p.target[0], p.target[1], p.target[2]).addScaledVector(_dir, p.distance);
};

const _target = new THREE.Vector3();
const _roll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);

/** Put a perspective camera on a pose (position, orientation, fov, clip planes). */
export const applyPose = (cam: THREE.PerspectiveCamera, p: CameraPose, aspect?: number, clip?: {near: number; far: number}) => {
  posePosition(p, cam.position);
  cam.up.copy(_up);
  cam.lookAt(_target.set(p.target[0], p.target[1], p.target[2]));
  if (p.roll) cam.quaternion.multiply(_roll.setFromAxisAngle(_zAxis, p.roll));
  cam.fov = p.fov;
  if (aspect) cam.aspect = aspect;
  cam.near = clip?.near ?? p.distance * 0.25;
  cam.far = clip?.far ?? p.distance * 4;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A fresh pose object to write into (see the `out` parameters). */
export const emptyPose = (): CameraPose => ({target: [0, 0, 0], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: LONG_LENS_FOV});

/** Copy a pose into `out` (no allocation). */
export const copyPose = (src: CameraPose, out: CameraPose): CameraPose => {
  out.target[0] = src.target[0];
  out.target[1] = src.target[1];
  out.target[2] = src.target[2];
  out.distance = src.distance;
  out.yaw = src.yaw;
  out.pitch = src.pitch;
  out.roll = src.roll ?? 0;
  out.fov = src.fov;
  return out;
};

/**
 * Blend two poses: target linear, distance geometric, angles and fov linear. Pass `out` to write
 * into an existing pose instead of allocating (it may be `a` or `b`).
 */
export const lerpPose = (a: CameraPose, b: CameraPose, t: number, out?: CameraPose): CameraPose => {
  const o = out ?? emptyPose();
  const tx = lerp(a.target[0], b.target[0], t);
  const ty = lerp(a.target[1], b.target[1], t);
  const tz = lerp(a.target[2], b.target[2], t);
  const distance = Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), t));
  const yaw = lerp(a.yaw, b.yaw, t);
  const pitch = lerp(a.pitch, b.pitch, t);
  const roll = lerp(a.roll ?? 0, b.roll ?? 0, t);
  const fov = lerp(a.fov, b.fov, t);
  o.target[0] = tx;
  o.target[1] = ty;
  o.target[2] = tz;
  o.distance = distance;
  o.yaw = yaw;
  o.pitch = pitch;
  o.roll = roll;
  o.fov = fov;
  return o;
};

const tanHalf = (fovDeg: number) => Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);

/** Distance at which `width` world units fill the frame width. */
export const distanceForWidth = (width: number, fovDeg: number, aspect: number) => width / 2 / (tanHalf(fovDeg) * aspect);
/** Distance at which `height` world units fill the frame height. */
export const distanceForHeight = (height: number, fovDeg: number) => height / 2 / tanHalf(fovDeg);
/** World units across the frame height at a distance. */
export const frameHeightAt = (distance: number, fovDeg: number) => 2 * distance * tanHalf(fovDeg);

export interface FrameSpec {
  /** The subject on the wall, in board uv. */
  uv: [number, number];
  /** Height of the subject point above the wall, world units (default 0). */
  z?: number;
  /** Pins across the full frame width (the reel shows about 145). */
  pinsAcross?: number;
  /** Alternatively: this many world units fill the frame height. */
  frameHeight?: number;
  /** Where the subject sits on screen, 0..1 from the top-left (default centre). */
  screen?: [number, number];
  yaw?: number;
  pitch?: number;
  roll?: number;
  fov?: number;
  /** Frame width / height (default 16:9). */
  aspect?: number;
}

const _cam = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();

/**
 * A pose that frames a wall point at a given screen position and scale. The look-at target stays
 * on the wall plane and is refined by projection, so it is exact for any yaw and pitch.
 */
export const frameOn = (board: Board, spec: FrameSpec): CameraPose => {
  const fov = spec.fov ?? LONG_LENS_FOV;
  const aspect = spec.aspect ?? 16 / 9;
  const distance =
    spec.frameHeight !== undefined
      ? distanceForHeight(spec.frameHeight, fov)
      : distanceForWidth((spec.pinsAcross ?? 145) * board.p, fov, aspect);
  const [sx, sy] = spec.screen ?? [0.5, 0.5];
  const [wx, wy] = uvToWorld(board, spec.uv[0], spec.uv[1]);
  const wz = spec.z ?? 0;
  // the camera orbits the subject at its own height, so `distance` is measured to the subject
  // (a pin head standing proud of the wall stays in front of the lens at macro distances)
  const pose: CameraPose = {target: [wx, wy, wz], distance, yaw: spec.yaw ?? BASE_YAW, pitch: spec.pitch ?? BASE_PITCH, roll: spec.roll ?? 0, fov};
  const fh = frameHeightAt(distance, fov);
  // first guess: shift along the wall by the screen offset, then correct by projection
  pose.target[0] = wx - (sx - 0.5) * fh * aspect;
  pose.target[1] = wy + (sy - 0.5) * fh;
  for (let it = 0; it < 6; it++) {
    applyPose(_cam, pose, aspect);
    _v.set(wx, wy, wz).project(_cam);
    const ex = (_v.x + 1) / 2 - sx;
    const ey = (1 - _v.y) / 2 - sy;
    if (Math.abs(ex) < 1e-6 && Math.abs(ey) < 1e-6) break;
    pose.target[0] += ex * fh * aspect;
    pose.target[1] -= ey * fh;
  }
  return pose;
};

const _pc = new THREE.PerspectiveCamera();
const _pp = new THREE.Vector3();

/**
 * Where a world point lands on screen for a pose: [x px, y px from the top, ndc depth]. Pure, so
 * HTML layers can pin chips and connector lines to real pins without reading the 3D scene.
 */
export const projectToScreen = (pose: CameraPose, point: Vec3, width: number, height: number): [number, number, number] => {
  applyPose(_pc, pose, width / height);
  _pp.set(point[0], point[1], point[2]).project(_pc);
  return [((_pp.x + 1) / 2) * width, ((1 - _pp.y) / 2) * height, _pp.z];
};

/** Move closer by a fraction (0.06 = the reel's push-in per beat). */
export const pushIn = (p: CameraPose, amount: number): CameraPose => ({...p, distance: p.distance * (1 - amount)});

/** Slide the camera and its target along the wall (world units). */
export const dolly = (p: CameraPose, dx: number, dy = 0): CameraPose => ({
  ...p,
  target: [p.target[0] + dx, p.target[1] + dy, p.target[2]],
});

/** Drop under the subject and pull back, so raised relief shows its shafts. */
export const lowAnglePull = (p: CameraPose, opts: {pitch?: number; pull?: number; yaw?: number} = {}): CameraPose => ({
  ...p,
  pitch: opts.pitch ?? -0.32,
  yaw: opts.yaw ?? p.yaw,
  distance: p.distance * (1 + (opts.pull ?? 0.12)),
});

/** A macro pose on a single pin head. `h` is the pin's height in world units. */
export const macroOn = (
  board: Board,
  pin: number,
  opts: {pinsAcross?: number; h?: number; yaw?: number; pitch?: number; fov?: number; aspect?: number; screen?: [number, number]} = {},
): CameraPose => {
  const head = (opts.h ?? 0) + 0.3 * board.p;
  return frameOn(board, {
    uv: [board.u[pin], board.v[pin]],
    z: head,
    pinsAcross: opts.pinsAcross ?? 9,
    yaw: opts.yaw ?? 0.32,
    pitch: opts.pitch ?? 0.18,
    fov: opts.fov ?? LONG_LENS_FOV,
    aspect: opts.aspect,
    screen: opts.screen,
  });
};
