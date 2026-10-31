import * as THREE from 'three';
import {applyPose, frameOn, projectToScreen, type CameraPose, type FrameSpec} from '../../../../engine/camera';
import {uvToWorld, worldToUv, type Board} from '../../../../engine/pins';
import type {FilmCtx} from '../../../types';

// Where things land on screen. Pin content is placed in wall uv; overlays are placed in pixels.
// These helpers convert between the two for a camera pose, so a chip can sit on the pin it names
// and a pin picture can be laid out by screen fraction.

/** The pose every chapter starts and ends on (the bare wall, as the placeholder frames it). */
export const handoffPose = (ctx: FilmCtx): CameraPose =>
  frameOn(ctx.board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect: ctx.width / ctx.height});

export const poseOn = (ctx: FilmCtx, spec: Omit<FrameSpec, 'aspect'>): CameraPose => frameOn(ctx.board, {...spec, aspect: ctx.width / ctx.height});

const cam = new THREE.PerspectiveCamera();
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();

/** The wall uv under a screen point (fractions of W and H from the top-left), at height z. */
export const uvAtScreen = (board: Board, pose: CameraPose, sx: number, sy: number, aspect: number, z = 0): [number, number] => {
  applyPose(cam, pose, aspect);
  ndc.set(sx * 2 - 1, 1 - sy * 2);
  ray.setFromCamera(ndc, cam);
  plane.constant = -z;
  if (!ray.ray.intersectPlane(plane, hit)) return [0.5, 0.5];
  return worldToUv(board, hit.x, hit.y);
};

/** Screen point (px) of a wall uv at height z (world units). */
export const screenAtUv = (board: Board, pose: CameraPose, u: number, v: number, W: number, H: number, z = 0): [number, number] => {
  const [x, y] = uvToWorld(board, u, v);
  const [px, py] = projectToScreen(pose, [x, y, z], W, H);
  return [px, py];
};

/** Pins per screen pixel at a point of the wall (for sizing pin pictures against type). */
export const pinPx = (board: Board, pose: CameraPose, u: number, v: number, W: number, H: number): number => {
  const [x0] = screenAtUv(board, pose, u, v, W, H);
  const [x1] = screenAtUv(board, pose, u + board.p, v, W, H);
  return Math.abs(x1 - x0);
};
