// Camera helpers for device shots: orbit poses, the film's camera easing, and focus distances in
// the form PostFX's depth of field expects (Euclidean distance from the camera).
import * as THREE from 'three';
import {easing} from '../tokens';

export interface OrbitPose {
  /** what the camera looks at */
  target: [number, number, number];
  /** degrees around y; 0 = in front (+z), negative = from the left */
  yaw: number;
  /** degrees above the target */
  pitch: number;
  distance: number;
  /** vertical field of view in degrees */
  fov?: number;
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 10; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-7) break;
      t = Math.min(1, Math.max(0, t - (sx(t) - x) / d));
    }
    return sy(t);
  };
};

/** The film's camera curve (tokens.easing.camera), cubic-bezier(0.65, 0, 0.35, 1). */
export const easeCamera = bezier(...(easing.camera as unknown as [number, number, number, number]));
/** The film's UI curve (tokens.easing.ui). */
export const easeUi = bezier(...(easing.ui as unknown as [number, number, number, number]));

export const orbitPosition = (p: OrbitPose, target = new THREE.Vector3()): THREE.Vector3 => {
  const yaw = THREE.MathUtils.degToRad(p.yaw);
  const pitch = THREE.MathUtils.degToRad(p.pitch);
  return target.set(
    p.target[0] + p.distance * Math.sin(yaw) * Math.cos(pitch),
    p.target[1] + p.distance * Math.sin(pitch),
    p.target[2] + p.distance * Math.cos(yaw) * Math.cos(pitch),
  );
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Blend two poses; distance blends geometrically so a push-in keeps a constant felt speed. */
export const blendPose = (a: OrbitPose, b: OrbitPose, t: number): OrbitPose => ({
  target: [mix(a.target[0], b.target[0], t), mix(a.target[1], b.target[1], t), mix(a.target[2], b.target[2], t)],
  yaw: mix(a.yaw, b.yaw, t),
  pitch: mix(a.pitch, b.pitch, t),
  distance: a.distance * Math.pow(b.distance / a.distance, t),
  fov: a.fov !== undefined && b.fov !== undefined ? mix(a.fov, b.fov, t) : a.fov ?? b.fov,
});

/** Apply a pose to a perspective camera (call in useLayoutEffect, every frame). */
export const applyPose = (camera: THREE.PerspectiveCamera, p: OrbitPose) => {
  orbitPosition(p, camera.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(p.target[0], p.target[1], p.target[2]);
  if (p.fov !== undefined && camera.fov !== p.fov) camera.fov = p.fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

/** Distance PostFX's depth of field focuses at for a world point (it uses Euclidean distance). */
export const focusDistance = (camera: THREE.Camera, point: THREE.Vector3) => camera.position.distanceTo(point);
