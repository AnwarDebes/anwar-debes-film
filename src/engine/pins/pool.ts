import * as THREE from 'three';

// The reel's light pool (identity.md 2.1: centroid 55% x / 45% y, about 2 stops from centre to
// edge). The wall is lit like pins.js (studio environment plus key light), and the light reaching
// each surface falls off with its distance from the pool centre on the wall, the way a flagged
// studio light pools on a set. Emissive glow is not pooled: lit pins glow anywhere.
//
// The uniforms are shared per scene: PinStudio animates them, every pooled material reads them.

export interface PoolUniforms {
  uPoolCenter: {value: THREE.Vector2};
  /** one sigma, world units */
  uPoolSigma: {value: number};
  /** share of a 2.4x wider Gaussian (the long tail of the falloff) */
  uPoolTail: {value: number};
  /** light level far from the pool, as a share of the centre */
  uPoolFloor: {value: number};
  /** overall level at the centre */
  uPoolGain: {value: number};
  /** horizontal stretch of the pool (1 = round) */
  uPoolAspect: {value: number};
}

const byScene = new WeakMap<THREE.Object3D, PoolUniforms>();

/** The pool uniforms of a scene (created on first use: no pool, i.e. uniform light at gain 1). */
export const poolUniforms = (scene: THREE.Object3D): PoolUniforms => {
  let u = byScene.get(scene);
  if (!u) {
    u = {
      uPoolCenter: {value: new THREE.Vector2(0, 0)},
      uPoolSigma: {value: 1e3},
      uPoolTail: {value: 0},
      uPoolFloor: {value: 1},
      uPoolGain: {value: 1},
      uPoolAspect: {value: 1},
    };
    byScene.set(scene, u);
  }
  return u;
};

const VERT_DECL = /* glsl */ `varying vec3 vPoolPos;`;

const VERT_POS = /* glsl */ `{
  vec4 poolP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  poolP = instanceMatrix * poolP;
  #endif
  vPoolPos = (modelMatrix * poolP).xyz;
}`;

const FRAG_DECL = /* glsl */ `varying vec3 vPoolPos;
uniform vec2 uPoolCenter;
uniform float uPoolSigma;
uniform float uPoolTail;
uniform float uPoolFloor;
uniform float uPoolGain;
uniform float uPoolAspect;
float pinPool(vec3 p) {
  vec2 d = p.xy - uPoolCenter;
  d.x /= uPoolAspect;
  float r2 = dot(d, d);
  float s2 = 2.0 * uPoolSigma * uPoolSigma;
  float g = (1.0 - uPoolTail) * exp(-r2 / s2) + uPoolTail * exp(-r2 / (s2 * 5.76));
  return uPoolGain * (uPoolFloor + (1.0 - uPoolFloor) * g);
}`;

const FRAG_APPLY = /* glsl */ `#include <aomap_fragment>
{
  float poolK = pinPool(vPoolPos);
  reflectedLight.directDiffuse *= poolK;
  reflectedLight.directSpecular *= poolK;
  reflectedLight.indirectDiffuse *= poolK;
  reflectedLight.indirectSpecular *= poolK;
}`;

/** Shader edits that pool a MeshStandardMaterial's lighting; call inside onBeforeCompile. */
export const injectPool = (shader: THREE.WebGLProgramParametersWithUniforms, u: PoolUniforms) => {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_POS}`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
    .replace('#include <aomap_fragment>', FRAG_APPLY);
};

/**
 * Let any MeshStandardMaterial/MeshPhysicalMaterial in the scene take the wall's light pool
 * (e.g. an object resting on the wall). Chains an existing onBeforeCompile.
 */
export const usePoolOn = (material: THREE.MeshStandardMaterial, scene: THREE.Object3D) => {
  const u = poolUniforms(scene);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    injectPool(shader, u);
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${prevKey()}|pool`;
  material.needsUpdate = true;
};
