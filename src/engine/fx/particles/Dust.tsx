import React, {useLayoutEffect, useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {fxBus} from '../bus';
import {useFxTime, useQuadGeometry, type LensOptions} from '../scene';
import {bindLens, makeSpriteMaterial} from './material';

export interface DustProps {
  /** Number of motes (1,000-3,000 reads as air; each is one instanced quad). */
  count?: number;
  /** Size of the wrapping volume, world units. */
  box?: [number, number, number];
  /** 'camera' keeps the volume ahead of the lens (fly-throughs); otherwise a fixed centre. */
  center?: [number, number, number] | 'camera';
  /** Distance of the volume's centre ahead of the camera, world units (center = 'camera'). */
  ahead?: number;
  /** Drift, world units per second. */
  drift?: [number, number, number];
  /** Slow wander amplitude, world units. */
  wander?: number;
  /** In-focus radius range, world units (most motes sit at the small end). */
  size?: [number, number];
  /** Peak radiance of an in-focus mote at intensity 1 (display colour through the grade). */
  brightness?: number;
  colors?: [string, string];
  twinkle?: number;
  /** Bloom mask weight (0 = never blooms). */
  bloom?: number;
  /** Global opacity, or a function of film time. */
  opacity?: number | ((t: number) => number);
  /** Motes brighten inside god-ray shafts (needs <GodRays/> in the scene). */
  shaftGain?: number;
  /** How much light a defocused mote keeps: 1 = physical, lower = visible bokeh discs. */
  bokeh?: number;
  seed?: number;
  /** Shutter as a fraction of the frame (0.5 = 180 degrees, PostFX's default). */
  shutter?: number;
  timeOffset?: number;
  lens?: LensOptions['lens'];
  maxBlur?: number;
  look?: Look;
  renderOrder?: number;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uShutterS;
uniform vec3 uBox;
uniform vec3 uCenter;
uniform float uFollow;
uniform float uAhead;
uniform vec3 uDrift;
uniform float uWander;
uniform vec2 uSize;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uTwinkle;
uniform float uBloom;
uniform float uOpacity;
uniform uint uSeed;
uniform sampler2D uShafts;
uniform float uShaftGain;

vec3 dustAt(float t, vec4 h, vec4 g) {
  vec3 p = h.xyz * uBox + uDrift * t;
  p += uWander * vec3(
    sin(t * (0.21 + 0.17 * g.x) + 6.2831853 * g.y),
    sin(t * (0.17 + 0.13 * g.z) + 6.2831853 * g.w),
    sin(t * (0.19 + 0.11 * h.w) + 6.2831853 * g.x));
  return p;
}

void main() {
  uint id = uint(gl_InstanceID);
  vec4 h = fxHash4(id, uSeed, 17u, 3u);
  vec4 g = fxHash4(id, uSeed, 91u, 7u);
  float t = uTime;
  vec3 pc = dustAt(t, h, g);
  vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 c = uFollow > 0.5 ? cameraPosition + fwd * uAhead : uCenter;
  vec3 local = mod(pc - c + 0.5 * uBox, uBox) - 0.5 * uBox;
  vec3 base = c + local;
  // shutter ends relative to the wrapped centre, so a wrap never stretches a streak across the box
  vec3 pA = base + (dustAt(t - 0.5 * uShutterS, h, g) - pc);
  vec3 pB = base + (dustAt(t + 0.5 * uShutterS, h, g) - pc);
  vec3 e = abs(local) / (0.5 * uBox);
  float edge = 1.0 - smoothstep(0.62, 1.0, max(e.x, max(e.y, e.z)));
  float size = mix(uSize.x, uSize.y, g.y * g.y * g.y);
  float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(t * (0.7 + 1.6 * h.w) + 6.2831853 * g.z));
  vec3 col = mix(uColA, uColB, g.w) * (0.35 + 0.65 * h.w) * tw * edge * uOpacity;
  if (uShaftGain > 0.0) {
    vec4 clip = projectionMatrix * (viewMatrix * vec4(base, 1.0));
    if (clip.w > 0.0) {
      vec2 suv = clamp(clip.xy / clip.w * 0.5 + 0.5, 0.0, 1.0);
      vec3 s = textureLod(uShafts, suv, 0.0).rgb;
      col *= 1.0 + uShaftGain * min(4.0, dot(s, vec3(0.3333)));
    }
  }
  fxSprite(pA, pB, size, vec4(col, uBloom * dot(col, vec3(0.3333))), 0.0, 0.0);
}`;

const BLACK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLACK.needsUpdate = true;

/**
 * Atmosphere: motes that drift in depth. Positions are closed-form in time and wrap inside a box
 * (optionally kept ahead of the camera), defocus follows the lens, and motion streaks use the
 * shutter, so the field is identical in every render tab.
 */
export const Dust: React.FC<DustProps> = ({
  count = 1800,
  box = [3, 2, 4],
  center = 'camera',
  ahead = 1.6,
  drift = [0.006, 0.012, 0.004],
  wander = 0.012,
  size = [0.0007, 0.0024],
  brightness = 0.42,
  colors = [FX_PALETTE.steel, FX_PALETTE.white],
  twinkle = 0.35,
  bloom = 0,
  opacity = 1,
  shaftGain = 0,
  bokeh = 0.55,
  seed = 7,
  shutter = 0.5,
  timeOffset = 0,
  lens,
  maxBlur,
  look = REEL_GRADE,
  renderOrder = 10,
}) => {
  const t = useFxTime(timeOffset);
  const {fps} = useVideoConfig();
  const geo = useQuadGeometry(count);
  const fx = useMemo(
    () =>
      makeSpriteMaterial({
        vertexMain: VERT,
        uniforms: {
          uTime: {value: 0},
          uShutterS: {value: 0.5 / 60},
          uBox: {value: new THREE.Vector3()},
          uCenter: {value: new THREE.Vector3()},
          uFollow: {value: 1},
          uAhead: {value: 1},
          uDrift: {value: new THREE.Vector3()},
          uWander: {value: 0},
          uSize: {value: new THREE.Vector2()},
          uColA: {value: new THREE.Color()},
          uColB: {value: new THREE.Color()},
          uTwinkle: {value: 0},
          uBloom: {value: 0},
          uOpacity: {value: 1},
          uSeed: {value: 0},
          uShafts: {value: BLACK as THREE.Texture},
          uShaftGain: {value: 0},
        },
      }),
    [],
  );
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, fx.material);
    m.frustumCulled = false;
    return m;
  }, [geo, fx]);
  mesh.renderOrder = renderOrder;
  const lensOpts = useMemo(() => ({lens, maxBlur}), [lens, maxBlur]);
  useLayoutEffect(() => {
    bindLens(mesh, fx.uniforms, () => lensOpts);
    const prev = mesh.onBeforeRender;
    mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      prev(renderer, scene, camera, geometry, material, group);
      const shafts = fxBus(scene).shafts;
      fx.uniforms.uShafts.value = shafts ?? BLACK;
      fx.uniforms.uShaftGain.value = shafts ? shaftGain : 0;
    };
  }, [mesh, fx, lensOpts, shaftGain]);

  const u = fx.uniforms;
  u.uTime.value = t;
  u.uShutterS.value = shutter / fps;
  u.uBox.value.set(box[0], box[1], box[2]);
  if (center === 'camera') {
    u.uFollow.value = 1;
  } else {
    u.uFollow.value = 0;
    u.uCenter.value.set(center[0], center[1], center[2]);
  }
  u.uAhead.value = ahead;
  u.uDrift.value.set(drift[0], drift[1], drift[2]);
  u.uWander.value = wander;
  u.uSize.value.set(size[0], size[1]);
  sceneColor(colors[0], brightness, look, u.uColA.value);
  sceneColor(colors[1], brightness, look, u.uColB.value);
  u.uTwinkle.value = twinkle;
  u.uBloom.value = bloom;
  u.uOpacity.value = typeof opacity === 'function' ? opacity(t) : opacity;
  u.uSeed.value = seed >>> 0;
  fx.uniforms.uEnergyExp.value = bokeh;

  useLayoutEffect(() => () => fx.material.dispose(), [fx]);
  return <primitive object={mesh} />;
};
