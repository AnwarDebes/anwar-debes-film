import * as THREE from 'three';
import {applyPose, frameOn, type CameraPose} from '../../../../engine/camera';
import type {Board} from '../../../../engine/pins';

// Poses on the wall's long lens. The chapters start and end on the placeholder's default pose
// (the hand-off between chapters), and every move is an ease-in-out on the film's camera curve.

export const handoffPose = (board: Board, aspect: number): CameraPose =>
  frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});

const _cam = new THREE.PerspectiveCamera();
const _p = new THREE.Vector3();
const _f = new THREE.Vector3();

/** World units across the frame width at the depth of a world point. */
export const frameWidthAt = (pose: CameraPose, point: [number, number, number], aspect: number): number => {
  applyPose(_cam, pose, aspect);
  _cam.getWorldDirection(_f);
  const d = _p.set(point[0], point[1], point[2]).sub(_cam.position).dot(_f);
  return 2 * d * Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2) * aspect;
};
