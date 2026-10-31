import * as THREE from 'three';

// Per-scene hand-offs between fx (written by pre-passes, read later in the same render):
// the god-ray image for motes that catch the light, and the light itself for the mist's in-scatter.

export interface FxLight {
  /** Screen position of the light, uv (y up), and whether it is in front of the camera. */
  uv: THREE.Vector2;
  visible: number;
  /** Display-referred radiance of the light (already multiplied by its intensity). */
  color: THREE.Color;
  /** Radius of the light's glow on screen, as a fraction of frame height. */
  radius: number;
}

export interface FxBus {
  shafts: THREE.Texture | null;
  light: FxLight | null;
}

const buses = new WeakMap<THREE.Object3D, FxBus>();

export const fxBus = (scene: THREE.Object3D): FxBus => {
  let b = buses.get(scene);
  if (!b) {
    b = {shafts: null, light: null};
    buses.set(scene, b);
  }
  return b;
};
