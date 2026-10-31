import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import type {Board} from '../pins/board';
import {applyPose, emptyPose, type CameraPose} from './pose';
import {useSubframeSampler, type SubframeSampler} from './subframe';
import {compileFocus, compileTrack, lensAt, poseAt, type CameraKey, type FocusKey, type LensState} from './track';

export interface CameraRigProps {
  /** Camera moves; the first key's pose holds before it. */
  keys: readonly CameraKey[];
  /** Rack focus and aperture keys. Without them the lens is a pinhole (no depth of field). */
  focus?: readonly FocusKey[];
  /** Needed when focus keys point at wall uv. */
  board?: Board;
  /** Distance multiplier over time (see beatCreep). */
  creep?: (t: number) => number;
  /** Seconds added to this component's frame time. */
  timeOffset?: number;
  clip?: {near: number; far: number};
}

/** The lens state the rig publishes for PostFX (camera.userData.lens). */
export const readLens = (camera: THREE.Camera): LensState | undefined => camera.userData.lens as LensState | undefined;

const SAMPLE_NDC: Array<[number, number]> = [
  [0, 0],
  [-0.9, -0.9],
  [0.9, -0.9],
  [-0.9, 0.9],
  [0.9, 0.9],
];

/**
 * Drives the R3F camera from a pure camera track, publishes focus for PostFX and registers with
 * the sub-frame registry so motion blur sees camera moves.
 */
export const CameraRig: React.FC<CameraRigProps> = ({keys, focus, board, creep, timeOffset = 0, clip}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const sampler = useMemo<SubframeSampler>(() => {
    const track = compileTrack(keys);
    const lensTrack = focus ? compileFocus(focus) : null;
    const aspect = width / height;
    const scratchA = new THREE.PerspectiveCamera();
    const scratchB = new THREE.PerspectiveCamera();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    const ndc = new THREE.Vector2();
    const points = SAMPLE_NDC.map(() => new THREE.Vector3());
    // scratch: posing the camera allocates nothing per sub-frame
    const livePose = emptyPose();
    const probePose = emptyPose();
    const lens: LensState = {focusDistance: 1, aperture: 0};

    const poseFor = (t: number, out: CameraPose): CameraPose => {
      poseAt(track, t, out);
      if (creep) out.distance *= creep(t);
      return out;
    };
    const timeOf = (off: number) => frameRef.current / fps + timeOffset + off;

    return {
      order: 0,
      apply(off) {
        const t = timeOf(off);
        const pose = poseFor(t, livePose);
        applyPose(camera, pose, aspect, clip);
        if (lensTrack) lensAt(lensTrack, t, camera, pose, board, lens);
        else {
          lens.focusDistance = pose.distance;
          lens.aperture = 0;
        }
        camera.userData.lens = lens;
      },
      motionPx(a, b, ctx) {
        // where the frame corners land on the wall now, and how far they travel on screen
        let n = 0;
        for (const [x, y] of SAMPLE_NDC) {
          ray.setFromCamera(ndc.set(x, y), ctx.camera);
          if (ray.ray.intersectPlane(plane, hit)) points[n++].copy(hit);
        }
        if (!n) return 0;
        applyPose(scratchA, poseFor(timeOf(a), probePose), aspect, clip);
        applyPose(scratchB, poseFor(timeOf(b), probePose), aspect, clip);
        let m = 0;
        for (let k = 0; k < n; k++) {
          pa.copy(points[k]).project(scratchA);
          pb.copy(points[k]).project(scratchB);
          const dx = ((pa.x - pb.x) / 2) * ctx.widthPx;
          const dy = ((pa.y - pb.y) / 2) * ctx.heightPx;
          m = Math.max(m, Math.hypot(dx, dy));
        }
        return m;
      },
    };
  }, [keys, focus, board, creep, timeOffset, clip, camera, fps, width, height]);

  useSubframeSampler(sampler);
  useLayoutEffect(() => {
    sampler.apply(0);
  }, [frame, sampler]);
  return null;
};
