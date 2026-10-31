import type React from 'react';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {useSubframeSampler, type SubframeSampler} from '../../camera/subframe';
import type {ShutterVP} from '../scene';
import {applyFlight, compileFlight, flightLensAt, flightStateAt, stateToPose, type FlightKey, type FlightState} from './flight';
import {applyPose} from '../../camera/pose';

export interface FlightRigProps {
  keys: readonly FlightKey[];
  clip?: {near: number; far: number};
  /** Seconds added to this component's frame time. */
  timeOffset?: number;
  /** Shutter as a fraction of the frame (0.5 = 180 degrees); sprites streak over it. */
  shutter?: number;
  /**
   * Weight of the camera's measured motion in PostFX's adaptive sub-frame count, as a function of
   * time. Sprites already streak with the camera, so sprite-only stretches can use 0 (one render).
   */
  motionScale?: (t: number) => number;
}

const PROBES: Array<[number, number]> = [
  [0, 0],
  [-0.85, -0.85],
  [0.85, -0.85],
  [-0.85, 0.85],
  [0.85, 0.85],
];

/**
 * Drives the R3F camera along a flight track. Publishes camera.userData.lens (the PostFX focus
 * contract, also read by every fx sprite) and camera.userData.shutterVP (the view at shutter open
 * and close, so particles streak with the camera's own motion), and registers with the sub-frame
 * registry like CameraRig.
 */
export const FlightRig: React.FC<FlightRigProps> = ({keys, clip, timeOffset = 0, shutter = 0.5, motionScale}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const sampler = useMemo<SubframeSampler>(() => {
    const tr = compileFlight(keys);
    const aspect = width / height;
    const clipPlanes = clip ?? {near: 0.02, far: 80};
    const scratch = new THREE.PerspectiveCamera();
    const vpA = new THREE.Matrix4();
    const vpB = new THREE.Matrix4();
    const shutterVP: ShutterVP = {view0: new THREE.Matrix4(), view1: new THREE.Matrix4()};
    const st: FlightState = {position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 24, aperture: 0, roll: 0, focus: 'target', k: 0, u: 0};
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    const probe = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const timeOf = (off: number) => frameRef.current / fps + timeOffset + off;
    const vpAt = (t: number, out: THREE.Matrix4) => {
      applyPose(scratch, stateToPose(flightStateAt(tr, t, st)), aspect, clipPlanes);
      return out.multiplyMatrices(scratch.projectionMatrix, scratch.matrixWorldInverse);
    };
    const viewAt = (t: number, out: THREE.Matrix4) => {
      applyPose(scratch, stateToPose(flightStateAt(tr, t, st)), aspect, clipPlanes);
      return out.copy(scratch.matrixWorldInverse);
    };
    const publishShutter = () => {
      const t = timeOf(0);
      const s = shutter / fps;
      viewAt(t - s / 2, shutterVP.view0);
      viewAt(t + s / 2, shutterVP.view1);
      camera.userData.shutterVP = shutterVP;
    };
    return {
      order: 0,
      apply(off) {
        const t = timeOf(off);
        const {lens} = applyFlight(camera, keys, t, aspect, clipPlanes);
        camera.userData.lens = lens;
        if (off === 0) publishShutter();
      },
      motionPx(a, b, ctx) {
        const w = motionScale ? motionScale(timeOf(0)) : 1;
        if (w <= 0) return 0;
        // probe points at the focus distance, in world space, seen from both shutter ends
        const s = flightStateAt(tr, timeOf(0), st);
        const lens = flightLensAt(tr, timeOf(0), s);
        vpAt(timeOf(a), vpA);
        vpAt(timeOf(b), vpB);
        applyPose(scratch, stateToPose(flightStateAt(tr, timeOf(0), st)), aspect, clipPlanes);
        scratch.getWorldDirection(fwd);
        let m = 0;
        for (const [x, y] of PROBES) {
          probe.set(x, y, 0.5).unproject(scratch).sub(scratch.position).normalize();
          const d = lens.focusDistance / Math.max(1e-3, probe.dot(fwd));
          probe.multiplyScalar(d).add(scratch.position);
          pa.copy(probe).applyMatrix4(vpA);
          pb.copy(probe).applyMatrix4(vpB);
          m = Math.max(m, Math.hypot(((pa.x - pb.x) / 2) * ctx.widthPx, ((pa.y - pb.y) / 2) * ctx.heightPx));
        }
        return m * w;
      },
    };
  }, [keys, clip, timeOffset, shutter, motionScale, camera, fps, width, height]);

  useSubframeSampler(sampler);
  useLayoutEffect(() => {
    sampler.apply(0);
  }, [frame, sampler]);
  // nothing stale is left on the camera when the rig goes
  useLayoutEffect(
    () => () => {
      delete camera.userData.shutterVP;
      delete camera.userData.lens;
    },
    [camera],
  );
  return null;
};
