import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {fxBus, type FxLight} from '../bus';
import {InputKey} from '../cache';
import {HASH_GLSL} from '../glsl';
import {makeSpriteMaterial, bindLens} from '../particles/material';
import {FX_LAYER, halfFloatTarget, restoreState, saveState, ScreenPass, screenMaterial, targetSize, useFxLayers, useFxTime, useQuadGeometry, usePrePass, type PrePass} from '../scene';

// Volumetric light shafts as a post-process (Mitchell, GPU Gems 3 ch. 13), made deterministic and
// cheap: a half-resolution occlusion image (the light's glow, multiplied by every occluder's
// transmittance), two chained radial blurs towards the light (the second fills the first's gaps,
// 24 x 8 effective taps), then one additive full-screen composite. All of it runs in a pre-pass
// for the exact camera of each render, so motion-blur sub-frames and every tab agree.

export type Vec3 = [number, number, number];

export interface GodRaysLight {
  /** World position of the source (behind the occluders). */
  position: Vec3;
  /** Radius of the glowing source, world units, or a function of film time. */
  radius?: number | ((t: number) => number);
  /** Display colour (white or mint). */
  color?: string;
  /** Source brightness: a number or a function of film time (0 = off). */
  intensity?: number | ((t: number) => number);
}

export interface GodRaysProps {
  light: GodRaysLight;
  /** How far the shafts reach towards the light, 0..1 of the way. */
  length?: number;
  /** Per-tap falloff of the first blur (0.9..0.99): lower = shorter, softer shafts. */
  decay?: number;
  /** Brightness of the shafts in the composite. */
  strength?: number | ((t: number) => number);
  /** Occlusion buffer scale (0.5 = half resolution). */
  resolution?: number;
  /** Draw the source itself as an HDR glow in the scene (it is occluded and refracted like any object). */
  glow?: boolean;
  /** Glow size relative to the radius, and its bloom weight. */
  glowScale?: number;
  glowBloom?: number;
  /** Share of the shafts that feeds the bloom mask. */
  bloom?: number;
  timeOffset?: number;
  look?: Look;
}

// ---------------------------------------------------------------- occluder registry

interface OccluderEntry {
  object: THREE.Mesh;
  material: THREE.Material | null;
}

const occluders = new WeakMap<THREE.Scene, OccluderEntry[]>();
const occludersOf = (scene: THREE.Scene) => {
  let l = occluders.get(scene);
  if (!l) {
    l = [];
    occluders.set(scene, l);
  }
  return l;
};

/** Multiplies the occlusion image by its colour: black blocks, white passes. */
export const occlusionBlending: Partial<THREE.MaterialParameters> = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.ZeroFactor,
  blendDst: THREE.SrcColorFactor,
  blendEquationAlpha: THREE.AddEquation,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
  depthTest: false,
  depthWrite: false,
  transparent: true,
};

const OPAQUE = new THREE.MeshBasicMaterial({color: 0x000000, ...occlusionBlending});

/**
 * Make a mesh block the god-ray light. `material` (optional) draws its transmittance into the
 * occlusion image with `occlusionBlending` (the glass box passes light cell by cell).
 */
export const useOccluder = (object: THREE.Mesh | null, material: THREE.Material | null = null): void => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    if (!object) return;
    const list = occludersOf(scene);
    const e: OccluderEntry = {object, material};
    list.push(e);
    object.layers.enable(FX_LAYER.occluder);
    return () => {
      const k = list.indexOf(e);
      if (k >= 0) list.splice(k, 1);
      object.layers.disable(FX_LAYER.occluder);
    };
  }, [scene, object, material]);
};

// ---------------------------------------------------------------- shaders

const SOURCE_FRAG = /* glsl */ `
uniform vec2 uLight;
uniform float uR;
uniform float uAspect;
uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - uLight) * vec2(uAspect, 1.0);
  float r = length(d) / max(uR, 1e-5);
  // a bright disc with a soft corona: the shafts take their shape from this
  float core = 1.0 - smoothstep(0.65, 1.0, r);
  float corona = exp(-1.6 * r * r);
  gl_FragColor = vec4(uCol * (0.65 * core + 0.35 * corona), 1.0);
}`;

const blurFrag = (taps: number) => /* glsl */ `
${HASH_GLSL}
uniform sampler2D tSrc;
uniform vec2 uLight;
uniform float uDensity;
uniform float uDecay;
uniform float uJitter;
varying vec2 vUv;
#define TAPS ${taps}
void main() {
  vec2 delta = (uLight - vUv) * uDensity / float(TAPS);
  float j = uJitter * fxIGN(gl_FragCoord.xy);
  vec2 p = vUv + delta * j;
  vec3 acc = vec3(0.0);
  float w = 1.0;
  float ws = 0.0;
  for (int i = 0; i < TAPS; i++) {
    acc += texture2D(tSrc, p).rgb * w;
    ws += w;
    w *= uDecay;
    p += delta;
  }
  gl_FragColor = vec4(acc / ws, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tRays;
uniform float uStrength;
uniform float uBloom;
varying vec2 vUv;
void main() {
  vec3 r = texture2D(tRays, vUv).rgb * uStrength;
  gl_FragColor = vec4(r, uBloom * dot(r, vec3(0.2126, 0.7152, 0.0722)));
}`;

const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const GLOW_VERT = /* glsl */ `
uniform vec3 uPos;
uniform float uSize;
uniform vec3 uCol;
uniform float uBloom;
void main() {
  fxSprite(uPos, uPos, uSize, vec4(uCol, uBloom), 1.0, 0.0);
}`;

const blurMaterial = (taps: number) =>
  screenMaterial(blurFrag(taps), {
    tSrc: {value: null},
    uLight: {value: new THREE.Vector2()},
    uDensity: {value: 1},
    uDecay: {value: 0.96},
    uJitter: {value: 1},
  });

const _v = new THREE.Vector3();
const _size = new THREE.Vector2();
const radiusAt = (l: GodRaysLight, t: number) => (typeof l.radius === 'function' ? l.radius(t) : l.radius ?? 0.05);

/**
 * Screen-space god rays from a light behind the scene. Anything registered with useOccluder blocks
 * (or, with its own material, partly transmits) the light; the source can also draw itself as a
 * glow in the scene so the glass box refracts it and the bloom catches it.
 */
export const GodRays: React.FC<GodRaysProps> = ({
  light,
  length = 0.92,
  decay = 0.965,
  strength = 1,
  resolution = 0.5,
  glow = true,
  glowScale = 1,
  glowBloom = 1,
  bloom = 0.15,
  timeOffset = 0,
  look = REEL_GRADE,
}) => {
  const t = useFxTime(timeOffset);
  const tRef = useRef(t);
  tRef.current = t;
  useFxLayers();

  const res = useMemo(() => {
    const screen = new ScreenPass();
    const sourceMat = screenMaterial(SOURCE_FRAG, {
      uLight: {value: new THREE.Vector2()},
      uR: {value: 0.05},
      uAspect: {value: 16 / 9},
      uCol: {value: new THREE.Color()},
    });
    const blurA = blurMaterial(24);
    const blurB = blurMaterial(8);
    const compUniforms = {tRays: {value: null as THREE.Texture | null}, uStrength: {value: 1}, uBloom: {value: 0}};
    const compMat = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: compUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const comp = new THREE.Mesh(g, compMat);
    comp.frustumCulled = false;
    comp.renderOrder = 1e6;
    comp.layers.set(FX_LAYER.overlay);
    return {
      screen,
      sourceMat,
      blurA,
      blurB,
      compUniforms,
      compMat,
      comp,
      occ: null as THREE.WebGLRenderTarget | null,
      raysA: null as THREE.WebGLRenderTarget | null,
      raysB: null as THREE.WebGLRenderTarget | null,
      key: new InputKey(160),
      lightUV: new THREE.Vector2(),
      lightColor: new THREE.Color(),
      visible: 0,
      radiusH: 0.05,
      busLight: null as FxLight | null,
    };
  }, []);

  // the glow sprite of the source
  const glowGeo = useQuadGeometry(1);
  const glowFx = useMemo(
    () =>
      makeSpriteMaterial({
        vertexMain: GLOW_VERT,
        uniforms: {uPos: {value: new THREE.Vector3()}, uSize: {value: 0.01}, uCol: {value: new THREE.Color()}, uBloom: {value: 1}},
        extent: 7,
        haloScale: 3.4,
      }),
    [],
  );
  const glowMesh = useMemo(() => {
    const m = new THREE.Mesh(glowGeo, glowFx.material);
    m.frustumCulled = false;
    m.renderOrder = 5;
    return m;
  }, [glowGeo, glowFx]);
  useLayoutEffect(() => bindLens(glowMesh, glowFx.uniforms, () => ({})), [glowMesh, glowFx]);

  const params = useRef({light, length, decay, strength, resolution, glowScale, glowBloom, bloom, look});
  params.current = {light, length, decay, strength, resolution, glowScale, glowBloom, bloom, look};

  // order 5: publish the light's screen position before the mist (10) reads it
  const lightPass = useMemo<PrePass>(
    () => ({
      order: 5,
      run(renderer, scene, camera, target) {
        const p = params.current;
        const tt = tRef.current;
        const I = typeof p.light.intensity === 'function' ? p.light.intensity(tt) : p.light.intensity ?? 1;
        targetSize(renderer, target, _size);
        const pc = camera as THREE.PerspectiveCamera;
        _v.set(p.light.position[0], p.light.position[1], p.light.position[2]).applyMatrix4(camera.matrixWorldInverse);
        const depth = -_v.z;
        _v.set(p.light.position[0], p.light.position[1], p.light.position[2]).project(camera);
        res.lightUV.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5);
        res.visible = depth > 0 && I > 0 ? 1 : 0;
        const fov = pc.fov ?? 24;
        const r = radiusAt(p.light, tt);
        res.radiusH = depth > 0 ? r / (2 * depth * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) : 0.05;
        sceneColor(p.light.color ?? FX_PALETTE.white, Math.max(0, I), p.look, res.lightColor);
        if (!res.busLight) res.busLight = {uv: res.lightUV, visible: 0, color: res.lightColor, radius: 0.05};
        res.busLight.visible = res.visible;
        res.busLight.radius = res.radiusH;
        fxBus(scene).light = res.busLight;
      },
    }),
    [res],
  );
  usePrePass(lightPass);

  const raysPass = useMemo<PrePass>(
    () => ({
      order: 20,
      run(renderer, scene, camera, target) {
        const p = params.current;
        const tt = tRef.current;
        targetSize(renderer, target, _size);
        const w = Math.max(1, Math.round(_size.x * p.resolution));
        const h = Math.max(1, Math.round(_size.y * p.resolution));
        if (!res.occ || res.occ.width !== w || res.occ.height !== h) {
          for (const r of [res.occ, res.raysA, res.raysB]) r?.dispose();
          res.occ = halfFloatTarget(w, h);
          res.raysA = halfFloatTarget(w, h);
          res.raysB = halfFloatTarget(w, h);
          res.key.invalidate();
        }
        const S = typeof p.strength === 'function' ? p.strength(tt) : p.strength;
        res.compUniforms.uStrength.value = S;
        res.compUniforms.uBloom.value = p.bloom;
        res.compUniforms.tRays.value = res.raysB!.texture;
        const bus = fxBus(scene);
        bus.shafts = res.visible > 0 && S > 0 ? res.raysB!.texture : null;
        res.comp.visible = res.visible > 0 && S > 0;
        if (!res.comp.visible) return;

        const list = occludersOf(scene);
        const k = res.key.begin().mat(camera.matrixWorld).mat((camera as THREE.PerspectiveCamera).projectionMatrix);
        k.num(res.lightUV.x).num(res.lightUV.y).num(res.radiusH).num(res.lightColor.r).num(res.lightColor.g).num(res.lightColor.b);
        // occluders animate through uniforms and instance buffers (cells clearing, pins rising)
        // that no transform shows, so the key includes film time: only identical work within one
        // frame is skipped, never a different frame's result
        k.num(p.length).num(p.decay).num(list.length).num(tt);
        for (const e of list) k.mat(e.object.matrixWorld);
        if (!k.changed()) return;

        const saved = saveState(renderer, scene, camera);
        renderer.shadowMap.autoUpdate = false;
        renderer.clippingPlanes = [];
        // 1. the source
        const su = res.sourceMat.uniforms;
        su.uLight.value.copy(res.lightUV);
        su.uR.value = res.radiusH * 1.0;
        su.uAspect.value = _size.x / _size.y;
        su.uCol.value.copy(res.lightColor);
        renderer.setClearColor(0x000000, 1);
        renderer.setRenderTarget(res.occ);
        renderer.clear(true, false, false);
        res.screen.render(renderer, res.sourceMat, res.occ);
        // 2. occluders multiply their transmittance in
        if (list.length) {
          const swapped: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = [];
          for (const e of list) {
            swapped.push([e.object, e.object.material]);
            e.object.material = e.material ?? OPAQUE;
          }
          scene.background = null;
          renderer.autoClear = false;
          camera.layers.set(FX_LAYER.occluder);
          renderer.setRenderTarget(res.occ);
          renderer.render(scene, camera);
          for (const [o, m] of swapped) o.material = m;
        }
        // 3. two chained radial blurs towards the light
        const a = res.blurA.uniforms;
        a.tSrc.value = res.occ.texture;
        a.uLight.value.copy(res.lightUV);
        a.uDensity.value = p.length;
        a.uDecay.value = p.decay;
        a.uJitter.value = 1;
        res.screen.render(renderer, res.blurA, res.raysA);
        const b = res.blurB.uniforms;
        b.tSrc.value = res.raysA!.texture;
        b.uLight.value.copy(res.lightUV);
        b.uDensity.value = p.length / 24;
        b.uDecay.value = 1;
        b.uJitter.value = 1;
        res.screen.render(renderer, res.blurB, res.raysB);
        restoreState(renderer, scene, camera, saved);
      },
    }),
    [res],
  );
  usePrePass(raysPass);

  // source glow in the scene
  const I = typeof light.intensity === 'function' ? light.intensity(t) : light.intensity ?? 1;
  const gu = glowFx.uniforms;
  gu.uPos.value.set(light.position[0], light.position[1], light.position[2]);
  gu.uSize.value = radiusAt(light, t) * 0.55 * glowScale;
  sceneColor(light.color ?? FX_PALETTE.white, Math.max(0, I), look, gu.uCol.value);
  gu.uBloom.value = glowBloom * Math.min(1, Math.max(0, I));

  useLayoutEffect(
    () => () => {
      for (const r of [res.occ, res.raysA, res.raysB]) r?.dispose();
      res.screen.dispose();
      res.sourceMat.dispose();
      res.blurA.dispose();
      res.blurB.dispose();
      res.compMat.dispose();
      res.comp.geometry.dispose();
      glowFx.material.dispose();
    },
    [res, glowFx],
  );
  return (
    <>
      {glow ? <primitive object={glowMesh} /> : null}
      <primitive object={res.comp} />
    </>
  );
};
