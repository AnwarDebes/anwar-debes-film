import {useLayoutEffect} from 'react';
import {useThree} from '@react-three/fiber';
import type * as THREE from 'three';

// Sub-frame time for motion blur. Everything time-dependent in a scene (camera, pins, lights)
// registers a sampler; PostFX asks each one to pose itself at a few times inside the shutter and
// averages the renders. Offsets are seconds relative to the component's own current frame, so
// samplers inside Sequences keep their local time base. All of it stays a pure function of the
// frame: the same frame always produces the same sub-frame states.

export interface MotionContext {
  camera: THREE.Camera;
  /** Output size in pixels. */
  widthPx: number;
  heightPx: number;
}

export interface SubframeSampler {
  /** Pose this component at (its current frame time + offsetS). */
  apply(offsetS: number): void;
  /** Largest on-screen motion, in pixels, between two offsets (for adaptive sample counts). */
  motionPx?(offsetA: number, offsetB: number, ctx: MotionContext): number;
  /** Lower runs first. The camera uses 0 so later samplers can project with it. */
  order: number;
}

const registries = new WeakMap<THREE.Object3D, SubframeSampler[]>();

export const subframeSamplers = (scene: THREE.Object3D): SubframeSampler[] => {
  let list = registries.get(scene);
  if (!list) {
    list = [];
    registries.set(scene, list);
  }
  return list;
};

/** Register a sampler with the scene while mounted. */
export const useSubframeSampler = (sampler: SubframeSampler | null): void => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    if (!sampler) return;
    const list = subframeSamplers(scene);
    list.push(sampler);
    list.sort((a, b) => a.order - b.order);
    return () => {
      const k = list.indexOf(sampler);
      if (k >= 0) list.splice(k, 1);
    };
  }, [scene, sampler]);
};

/** Pose every registered sampler of the scene at a sub-frame offset. */
export const applySubframe = (scene: THREE.Object3D, offsetS: number): void => {
  const list = registries.get(scene);
  if (!list) return;
  for (let k = 0; k < list.length; k++) list[k].apply(offsetS);
};
