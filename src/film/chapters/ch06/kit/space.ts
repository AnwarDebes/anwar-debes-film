import * as THREE from 'three';
import type {Board} from '../../../../engine/pins';
import {DEFAULT_RELIEF_PITCHES, pinAt} from '../../../../engine/pins';
import {applyPose, frameOn, rigPoseAt, type CameraKey, type CameraPose, type Vec3} from '../../../../engine/camera';

// Pin space: a scene is laid out in pins. X runs 0..cols left to right, Y runs 0..board height
// (in pin pitches) bottom to top, so a 12 x 5 tile is twelve pins wide and five pitches tall on
// any board. Heights are in reliefs (h = 1 is the wall's full relief, 22 pitches).

export interface PinSpace {
  board: Board;
  /** board height in pin pitches */
  ext: number;
  /** world height of h = 1 */
  relief: number;
  uv: (X: number, Y: number) => [number, number];
  /** world point of a pin-space point at relief height h */
  world: (X: number, Y: number, h?: number) => Vec3;
  /** pin-space point of a board uv */
  pin: (u: number, v: number) => [number, number];
  /** the centre of the pin nearest a pin-space point (for single-pin dots) */
  snap: (X: number, Y: number) => [number, number];
}

export const pinSpace = (board: Board): PinSpace => {
  const ext = board.extH / board.p;
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  return {
    board,
    ext,
    relief,
    uv: (X, Y) => [X * board.p, (Y * board.p) / board.extH],
    world: (X, Y, h = 0) => [X * board.p - 0.5, Y * board.p - board.extH / 2, h * relief + 0.3 * board.p],
    pin: (u, v) => [u / board.p, (v * board.extH) / board.p],
    snap: (X, Y) => {
      const i = pinAt(board, X * board.p, (Y * board.p) / board.extH);
      return [board.u[i] / board.p, (board.v[i] * board.extH) / board.p];
    },
  };
};

/** The pose every chapter starts and ends on (the placeholder's framing of the bare wall). */
export const handoffPose = (board: Board, aspect: number): CameraPose =>
  frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});

const _cam = new THREE.PerspectiveCamera();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _hit = new THREE.Vector3();

/**
 * The pin-space point a pose shows at a screen position (fx, fy in 0..1 from the top-left):
 * lay a scene out in frame fractions for the pose that will look at it.
 */
export const pinAtScreen = (S: PinSpace, pose: CameraPose, aspect: number, fx: number, fy: number): [number, number] => {
  applyPose(_cam, pose, aspect);
  _ndc.set(fx * 2 - 1, 1 - fy * 2);
  _ray.setFromCamera(_ndc, _cam);
  if (!_ray.ray.intersectPlane(_plane, _hit)) return [S.board.cols / 2, S.ext / 2];
  return [(_hit.x + 0.5) / S.board.p, (_hit.y + S.board.extH / 2) / S.board.p];
};

/**
 * Where pins land on screen while a chapter's camera keys play, for HTML labels pinned to the wall.
 * Within a chapter the film's merged camera track equals the chapter's own keys (its first key is
 * a cut at the chapter start), so this is the exact pose the CameraRig shows.
 */
export interface Lens {
  keys: CameraKey[];
  W: number;
  H: number;
  /** [x px, y px] of a pin-space point at height h (reliefs) at film time t */
  at: (t: number, X: number, Y: number, h?: number) => [number, number];
  /** px per pin at a point (for sizing text to tiles) */
  pxPerPin: (t: number, X: number, Y: number) => number;
}

const _proj = new THREE.PerspectiveCamera();
const _pt = new THREE.Vector3();
const _pose: CameraPose = {target: [0, 0, 0], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};

export const makeLens = (S: PinSpace, keys: CameraKey[], W: number, H: number): Lens => {
  let lastT = NaN;
  const pose = (t: number) => {
    if (t !== lastT) {
      rigPoseAt(keys, t, undefined, _pose);
      applyPose(_proj, _pose, W / H);
      lastT = t;
    }
    return _proj;
  };
  const at = (t: number, X: number, Y: number, h = 0): [number, number] => {
    const cam = pose(t);
    const [x, y, z] = S.world(X, Y, h);
    _pt.set(x, y, z).project(cam);
    return [((_pt.x + 1) / 2) * W, ((1 - _pt.y) / 2) * H];
  };
  return {
    keys,
    W,
    H,
    at,
    pxPerPin: (t, X, Y) => {
      const a = at(t, X - 0.5, Y);
      const b = at(t, X + 0.5, Y);
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    },
  };
};
