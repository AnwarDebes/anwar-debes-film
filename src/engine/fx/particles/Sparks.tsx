import React, {useLayoutEffect, useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {FX_LAYER, useFxLayers, useFxTime, useQuadGeometry, type LensOptions} from '../scene';
import {bindLens, makeSpriteMaterial} from './material';

export type Vec3 = [number, number, number];

/** A point that sparks rise from (a lit pin head, a flipping cell), with an emission window. */
export interface SparkSource {
  position: Vec3;
  /** Film seconds the source starts emitting (loop) or bursts (burst). Default -Infinity / 0. */
  from?: number;
  /** Film seconds the source stops emitting (loop mode). Default Infinity. */
  to?: number;
  /** Brightness weight 0..1 (default 1). */
  weight?: number;
  /** Launch direction for this source (default: the field's `direction`). */
  direction?: Vec3;
}

export interface SparksProps {
  sources: readonly SparkSource[];
  /** Particle count. In 'loop' mode count / lifetime is the emission rate across all sources. */
  count?: number;
  /** 'loop': sources emit continuously inside their windows. 'burst': each particle leaves once, at its source's `from`. */
  mode?: 'loop' | 'burst';
  /** Seconds a burst spreads its particles over (burst mode). */
  burstSpread?: number;
  /** Lifetime range, seconds. */
  life?: [number, number];
  /** Mean launch direction (pins point at +Z; sparks leave the head). */
  direction?: Vec3;
  /** Launch speed, world units per second, and cone half-angle, radians. */
  speed?: number;
  spread?: number;
  /** Constant acceleration (buoyancy), world units per second squared. */
  rise?: Vec3;
  /** Air drag, 1/s: launch velocity decays as e^(-drag * age). */
  drag?: number;
  /** Lateral flutter, world units per second of age. */
  flutter?: number;
  /** In-focus radius range, world units. */
  size?: [number, number];
  /** Hot (birth) and cool (late) colours: mint and white only. */
  colors?: [string, string];
  /** Peak radiance at intensity 1 shows the colour; above 1 runs hot and blooms. */
  intensity?: number;
  bloom?: number;
  opacity?: number | ((t: number) => number);
  seed?: number;
  shutter?: number;
  timeOffset?: number;
  lens?: LensOptions['lens'];
  maxBlur?: number;
  look?: Look;
  renderOrder?: number;
  /** Extra three.js layers for the mesh (e.g. to be seen only through a glass box). */
  layers?: number[];
  /**
   * false: drawn by the main camera only, never in a glass box's view behind its glass (sparks
   * that fly off the glass would otherwise be seen twice where they cross it).
   */
  refract?: boolean;
}

const VERT = /* glsl */ `
uniform float uTime;
uniform float uShutterS;
uniform sampler2D uSrc;
uniform int uSrcCount;
uniform int uSrcW;
uniform vec2 uLife;
uniform vec3 uDir;
uniform float uSpeed;
uniform float uSpread;
uniform vec3 uRise;
uniform float uDrag;
uniform float uFlutter;
uniform vec2 uSize;
uniform vec3 uColHot;
uniform vec3 uColCool;
uniform float uBloom;
uniform float uMode;
uniform float uBurstSpread;
uniform float uOpacity;
uniform uint uSeed;

vec4 srcTexel(int k) { return texelFetch(uSrc, ivec2(k % uSrcW, k / uSrcW), 0); }

vec3 sparkPos(vec3 o, vec3 v0, float tau, vec4 hv) {
  float e = uDrag > 1e-4 ? (1.0 - exp(-uDrag * tau)) / uDrag : tau;
  vec3 p = o + v0 * e + 0.5 * uRise * tau * tau;
  float a = uFlutter * tau;
  p += a * vec3(
    sin(tau * (3.1 + 2.0 * hv.x) + 6.2831853 * hv.y),
    0.6 * sin(tau * (2.3 + 1.7 * hv.z) + 6.2831853 * hv.w),
    sin(tau * (2.7 + 1.3 * hv.y) + 6.2831853 * hv.x));
  return p;
}

void main() {
  uint id = uint(gl_InstanceID);
  vec4 h = fxHash4(id, uSeed, 5u, 11u);
  float life = mix(uLife.x, uLife.y, h.x);
  float t = uTime;
  float tau;
  uint cyc;
  int src;
  if (uMode < 0.5) {
    float age = t + h.y * life * 7.0 + 1000.0 * life;
    float n = floor(age / life);
    tau = age - n * life;
    cyc = uint(int(n));
    vec4 hc = fxHash4(id, cyc, uSeed, 23u);
    src = min(uSrcCount - 1, int(hc.x * float(uSrcCount)));
  } else {
    src = int(id % uint(uSrcCount));
    vec4 s0 = srcTexel(3 * src);
    tau = t - (s0.w + h.y * uBurstSpread);
    cyc = 0u;
  }
  vec4 s0 = srcTexel(3 * src);
  vec4 s1 = srcTexel(3 * src + 1);
  vec4 s2 = srcTexel(3 * src + 2);
  float tEmit = t - tau;
  float alive = step(0.0, tau) * step(tau, life) * step(s0.w, tEmit) * step(tEmit, s1.x);
  vec4 hv = fxHash4(id, cyc, uSeed, 41u);
  vec3 axis = normalize(s2.w > 0.5 ? s2.xyz : uDir);
  vec3 tA = normalize(abs(axis.y) < 0.9 ? cross(axis, vec3(0.0, 1.0, 0.0)) : cross(axis, vec3(1.0, 0.0, 0.0)));
  vec3 tB = cross(axis, tA);
  float ca = mix(1.0, cos(uSpread), hv.x);
  float sa = sqrt(max(0.0, 1.0 - ca * ca));
  float ph = 6.2831853 * hv.y;
  vec3 dir = axis * ca + (tA * cos(ph) + tB * sin(ph)) * sa;
  vec3 v0 = dir * uSpeed * (0.55 + 0.9 * hv.z);
  float tc = clamp(tau, 0.0, life);
  vec3 pA = sparkPos(s0.xyz, v0, max(0.0, tc - 0.5 * uShutterS), hv);
  vec3 pB = sparkPos(s0.xyz, v0, min(life, tc + 0.5 * uShutterS), hv);
  float x = tc / life;
  float fade = smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.45, 1.0, x));
  float flick = 0.78 + 0.22 * sin(tau * (17.0 + 13.0 * hv.w) + 6.2831853 * h.z);
  float b = s1.y * alive * fade * flick * uOpacity;
  vec3 col = mix(uColHot, uColCool, smoothstep(0.0, 0.7, x)) * b;
  float size = mix(uSize.x, uSize.y, hv.w) * (1.0 - 0.45 * x);
  fxSprite(pA, pB, size, vec4(col, uBloom * b * (1.0 - x)), 0.0, 0.0);
}`;

const buildSources = (sources: readonly SparkSource[]) => {
  const n = Math.max(1, sources.length);
  const texels = 3 * n;
  const w = Math.min(1024, texels);
  const h = Math.ceil(texels / w);
  const data = new Float32Array(w * h * 4);
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    const o = i * 12;
    data[o] = s.position[0];
    data[o + 1] = s.position[1];
    data[o + 2] = s.position[2];
    data[o + 3] = s.from ?? -1e9;
    data[o + 4] = s.to ?? 1e9;
    data[o + 5] = s.weight ?? 1;
    if (s.direction) {
      data[o + 8] = s.direction[0];
      data[o + 9] = s.direction[1];
      data[o + 10] = s.direction[2];
      data[o + 11] = 1;
    }
  }
  if (!sources.length) data[4] = -1e9;
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return {tex, w, count: n};
};

/**
 * Literal sparks: small mint-white embers that leave a source (a lit pin, a flipping cell) and rise
 * with drag, buoyancy and flutter. Every spark's path is closed-form in its age; loop mode
 * re-seeds each life cycle from the cycle index, so the field never visibly repeats.
 */
export const Sparks: React.FC<SparksProps> = ({
  sources,
  count = 600,
  mode = 'loop',
  burstSpread = 0.25,
  life = [0.9, 2.2],
  direction = [0, 0, 1],
  speed = 0.06,
  spread = 0.7,
  rise = [0, 0.05, 0],
  drag = 2.2,
  flutter = 0.006,
  size = [0.0012, 0.0028],
  colors = [FX_PALETTE.mint, FX_PALETTE.white],
  intensity = 2.2,
  bloom = 0.8,
  opacity = 1,
  seed = 3,
  shutter = 0.5,
  timeOffset = 0,
  lens,
  maxBlur,
  look = REEL_GRADE,
  renderOrder = 12,
  layers,
  refract = true,
}) => {
  const t = useFxTime(timeOffset);
  useFxLayers();
  const {fps} = useVideoConfig();
  const geo = useQuadGeometry(sources.length ? count : 0);
  const src = useMemo(() => buildSources(sources), [sources]);
  const fx = useMemo(
    () =>
      makeSpriteMaterial({
        vertexMain: VERT,
        uniforms: {
          uTime: {value: 0},
          uShutterS: {value: 0},
          uSrc: {value: null as THREE.Texture | null},
          uSrcCount: {value: 1},
          uSrcW: {value: 1},
          uLife: {value: new THREE.Vector2()},
          uDir: {value: new THREE.Vector3()},
          uSpeed: {value: 0},
          uSpread: {value: 0},
          uRise: {value: new THREE.Vector3()},
          uDrag: {value: 0},
          uFlutter: {value: 0},
          uSize: {value: new THREE.Vector2()},
          uColHot: {value: new THREE.Color()},
          uColCool: {value: new THREE.Color()},
          uBloom: {value: 0},
          uMode: {value: 0},
          uBurstSpread: {value: 0},
          uOpacity: {value: 1},
          uSeed: {value: 0},
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
  // set on every render (the mesh is this component's own), so the first captured frame has them
  mesh.layers.set(refract ? 0 : FX_LAYER.overlay);
  for (const l of layers ?? []) mesh.layers.enable(l);
  const lensOpts = useMemo(() => ({lens, maxBlur}), [lens, maxBlur]);
  useLayoutEffect(() => bindLens(mesh, fx.uniforms, () => lensOpts), [mesh, fx, lensOpts]);

  const u = fx.uniforms;
  u.uTime.value = t;
  u.uShutterS.value = shutter / fps;
  u.uSrc.value = src.tex;
  u.uSrcCount.value = src.count;
  u.uSrcW.value = src.w;
  u.uLife.value.set(life[0], life[1]);
  u.uDir.value.set(direction[0], direction[1], direction[2]);
  u.uSpeed.value = speed;
  u.uSpread.value = spread;
  u.uRise.value.set(rise[0], rise[1], rise[2]);
  u.uDrag.value = drag;
  u.uFlutter.value = flutter;
  u.uSize.value.set(size[0], size[1]);
  sceneColor(colors[0], intensity, look, u.uColHot.value);
  sceneColor(colors[1], intensity * 0.7, look, u.uColCool.value);
  u.uBloom.value = bloom;
  u.uMode.value = mode === 'burst' ? 1 : 0;
  u.uBurstSpread.value = burstSpread;
  u.uOpacity.value = typeof opacity === 'function' ? opacity(t) : opacity;
  u.uSeed.value = seed >>> 0;

  useLayoutEffect(() => () => src.tex.dispose(), [src]);
  useLayoutEffect(() => () => fx.material.dispose(), [fx]);
  return <primitive object={mesh} />;
};
