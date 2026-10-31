import * as THREE from 'three';
import {color} from '../tokens';
import {injectPool, type PoolUniforms} from './pool';

// Steel pins (identity.md d.3): MeshStandardMaterial, white base so the per-instance tint
// (instanceColor) sets the steel's brightness. One extra instanced attribute, aPin = (height,
// glow, paint), is read in the vertex and fragment shaders:
//  - height lifts the pin along +Z (so only 4 bytes per pin move, not a 64-byte matrix),
//  - glow adds mint emissive radiance and writes the bloom mask into alpha,
//  - paint blends the head towards a non-metallic finish so RGB tints read as true colour.
// Each shaft is cut to end just behind the plate, so the hidden 30-odd pitches of every shaft are
// never rasterised (they would otherwise be shaded several times over at MSAA 4x).

export interface PinMaterialOptions {
  glowColor?: string;
  /** Emissive intensity of a fully lit pin (1.5-3 in the reel). */
  glowIntensity?: number;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  /** Pin pitch and full shaft length of the lathe geometry (world units). */
  pitch: number;
  reach: number;
  /** The scene's light pool (see pool.ts). */
  pool: PoolUniforms;
}

export interface PinMaterials {
  material: THREE.MeshStandardMaterial;
  depth: THREE.MeshDepthMaterial;
  uniforms: {
    uGlowColor: {value: THREE.Color};
    uPaintMetal: {value: number};
    uPaintRough: {value: number};
    uPitch: {value: number};
    uReach: {value: number};
  };
}

const VERT_HEAD = /* glsl */ `#include <common>
attribute vec3 aPin;
uniform float uPitch;
uniform float uReach;
varying vec2 vPinGP;`;

// the shaft's bottom ring moves up to just behind the plate for this pin's height
const SHAFT_CUT = /* glsl */ `if (transformed.z < -0.5 * uReach) transformed.z = -min(uReach, max(aPin.x + 0.06 * uPitch, 0.09 * uPitch));
transformed.z += aPin.x;`;

// a lit pin glows from its head; its shaft carries a third of the glow (and of the bloom mask)
const VERT_LIFT = /* glsl */ `#include <begin_vertex>
float pinLocalZ = transformed.z;
${SHAFT_CUT}
vPinGP = vec2(aPin.y * (pinLocalZ >= -0.001 * uPitch ? 1.0 : 0.32), aPin.z);`;

const FRAG_HEAD = /* glsl */ `#include <common>
varying vec2 vPinGP;
uniform vec3 uGlowColor;
uniform float uPaintMetal;
uniform float uPaintRough;`;

export const makePinMaterials = (opts: PinMaterialOptions): PinMaterials => {
  const uniforms = {
    uGlowColor: {value: new THREE.Color(opts.glowColor ?? color.accent.mint).multiplyScalar(opts.glowIntensity ?? 2.4)},
    uPaintMetal: {value: 0.08},
    uPaintRough: {value: 0.5},
    uPitch: {value: opts.pitch},
    uReach: {value: opts.reach},
  };
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: opts.metalness ?? 0.75,
    roughness: opts.roughness ?? 0.32,
    envMapIntensity: opts.envMapIntensity ?? 1.05,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERT_HEAD).replace('#include <begin_vertex>', VERT_LIFT);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAG_HEAD)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uPaintRough, vPinGP.y);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uPaintMetal, vPinGP.y);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vPinGP.x * uGlowColor;')
      // alpha carries the bloom mask: only lit pins bloom, steel highlights never do
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = clamp(vPinGP.x, 0.0, 1.0);');
    injectPool(shader, opts.pool);
  };
  material.customProgramCacheKey = () => 'film-pin-standard-v4';

  const depth = new THREE.MeshDepthMaterial();
  depth.onBeforeCompile = (shader) => {
    shader.uniforms.uPitch = uniforms.uPitch;
    shader.uniforms.uReach = uniforms.uReach;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aPin;\nuniform float uPitch;\nuniform float uReach;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SHAFT_CUT}`);
  };
  depth.customProgramCacheKey = () => 'film-pin-depth-v2';
  return {material, depth, uniforms};
};

/** Plate behind the pins (dark theme), in the same light pool. */
export const makePlateMaterial = (pool: PoolUniforms, hex: string = color.wall.plate) => {
  const m = new THREE.MeshStandardMaterial({color: new THREE.Color(hex), metalness: 0.2, roughness: 0.85});
  m.onBeforeCompile = (shader) => {
    injectPool(shader, pool);
    // the plate writes no bloom mask
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = 0.0;');
  };
  m.customProgramCacheKey = () => 'film-plate-v1';
  return m;
};
