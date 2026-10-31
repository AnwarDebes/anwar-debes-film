import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {REEL_GRADE, sceneColor, type Look} from '../color';
import {color as tokens} from '../../tokens';
import {HASH_GLSL, NOISE_GLSL} from '../glsl';
import {fxBus} from '../bus';
import {InputKey} from '../cache';
import {halfFloatTarget, restoreState, saveState, ScreenPass, screenMaterial, targetSize, usePrePass, type PrePass} from '../scene';

export interface MistProps {
  /** Display colours: the void, the charcoal body and the lightest wisps. */
  colors?: [string, string, string];
  /** Overall brightness multiplier of the mist. */
  intensity?: number | ((t: number) => number);
  /** Noise frequency on the sky sphere (higher = smaller wisps). */
  scale?: number;
  /** Evolution speed. */
  speed?: number;
  /** How much camera translation moves the mist (a near layer); 0 = at infinity. */
  parallax?: number;
  /** The reel's light pool: centre in uv (y up), strength (stops above the edge) and radius (fraction of H). */
  pool?: {center?: [number, number]; strength?: number; radius?: number};
  /** In-scatter of the god-ray light into the mist (needs <GodRays/>). */
  scatter?: number;
  /** Render scale of the mist buffer (it is smooth; 0.25 is indistinguishable from full). */
  resolution?: number;
  seed?: number;
  timeOffset?: number;
  look?: Look;
}

const MIST_FRAG = /* glsl */ `
${HASH_GLSL}
${NOISE_GLSL}
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uScale;
uniform float uParallax;
uniform vec3 uVoid;
uniform vec3 uBody;
uniform vec3 uWisp;
uniform float uIntensity;
uniform vec2 uPool;
uniform float uPoolAmt;
uniform float uPoolR;
uniform float uAspect;
uniform vec2 uLightUV;
uniform vec3 uLightCol;
uniform float uLightR;
uniform float uScatter;
uniform vec3 uSeedOff;
varying vec2 vUv;

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 vv = uInvProj * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize((uCamWorld * vec4(normalize(vv.xyz / vv.w), 0.0)).xyz);
  float t = uTime;
  vec3 p = dir * uScale + uCamPos * uParallax + uSeedOff;
  // one gentle warp, then the body: smoke that turns over slowly instead of scrolling
  vec3 q = vec3(
    fxFbm(p * 0.8 + vec3(0.0, 0.0, 0.05 * t), 3),
    fxFbm(p * 0.8 + vec3(5.2, 1.3, -0.04 * t), 3),
    fxFbm(p * 0.8 + vec3(-3.1, 7.7, 0.035 * t), 3));
  float n = fxFbm(p + 0.55 * q + vec3(0.018 * t, -0.012 * t, 0.0), 4);
  float body = smoothstep(-0.65, 0.65, n);
  float wisp = smoothstep(0.15, 0.85, n);
  vec3 col = mix(uVoid, uBody, body);
  col = mix(col, uWisp, wisp * wisp * 0.85);
  // the reel's pool of light, about two stops from centre to corner
  vec2 dp = (vUv - uPool) * vec2(uAspect, 1.0);
  col *= 1.0 + uPoolAmt * exp(-dot(dp, dp) / (uPoolR * uPoolR));
  col *= uIntensity;
  // light scattered by the mist around the god-ray source: denser mist glows more
  if (uScatter > 0.0) {
    vec2 dl = (vUv - uLightUV) * vec2(uAspect, 1.0);
    float g = exp(-dot(dl, dl) / (uLightR * uLightR));
    float g2 = exp(-dot(dl, dl) / (9.0 * uLightR * uLightR));
    col += uLightCol * uScatter * (0.35 + 0.65 * body) * (0.7 * g + 0.3 * g2);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Upsample with a cubic B-spline from four bilinear taps (GPU Gems 2, ch. 20): no blocks, no ringing.
const COMPOSITE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tMist;
uniform vec2 uTexSize;
varying vec2 vUv;
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}
vec3 bicubic(sampler2D tex, vec2 uv, vec2 size) {
  vec2 inv = 1.0 / size;
  uv = uv * size - 0.5;
  vec2 fxy = fract(uv);
  uv -= fxy;
  vec4 xc = cubic(fxy.x);
  vec4 yc = cubic(fxy.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = c + vec4(xc.yw, yc.yw) / s;
  off *= inv.xxyy;
  vec3 s0 = texture2D(tex, off.xz).rgb;
  vec3 s1 = texture2D(tex, off.yz).rgb;
  vec3 s2 = texture2D(tex, off.xw).rgb;
  vec3 s3 = texture2D(tex, off.yw).rgb;
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
void main() {
  // alpha 0: the mist never enters the bloom mask
  gl_FragColor = vec4(bicubic(tMist, vUv, uTexSize), 0.0);
}`;

/**
 * The charcoal mist behind everything: slow domain-warped noise on the sky sphere (it turns with
 * the camera like a far backdrop, with an optional near-layer parallax), the reel's light pool,
 * and in-scatter around the god-ray light. Rendered at a quarter of the resolution in a pre-pass
 * and upsampled with a B-spline, so it costs almost nothing.
 */
export const Mist: React.FC<MistProps> = ({
  colors = [tokens.wall.void, tokens.wall.edge, '#191E1C'],
  intensity = 1,
  scale = 0.95,
  speed = 1,
  parallax = 0.035,
  pool,
  scatter = 0.35,
  resolution = 0.25,
  seed = 1,
  timeOffset = 0,
  look = REEL_GRADE,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps + timeOffset;
  const tRef = useRef(t);
  tRef.current = t;

  const res = useMemo(() => {
    const screen = new ScreenPass();
    const uniforms = {
      uInvProj: {value: new THREE.Matrix4()},
      uCamWorld: {value: new THREE.Matrix4()},
      uCamPos: {value: new THREE.Vector3()},
      uTime: {value: 0},
      uScale: {value: 1},
      uParallax: {value: 0},
      uVoid: {value: new THREE.Color()},
      uBody: {value: new THREE.Color()},
      uWisp: {value: new THREE.Color()},
      uIntensity: {value: 1},
      uPool: {value: new THREE.Vector2(0.55, 0.55)},
      uPoolAmt: {value: 1},
      uPoolR: {value: 0.6},
      uAspect: {value: 16 / 9},
      uLightUV: {value: new THREE.Vector2()},
      uLightCol: {value: new THREE.Color()},
      uLightR: {value: 0.1},
      uScatter: {value: 0},
      uSeedOff: {value: new THREE.Vector3()},
    };
    const mistMat = screenMaterial(MIST_FRAG, uniforms);
    const compUniforms = {tMist: {value: null as THREE.Texture | null}, uTexSize: {value: new THREE.Vector2(1, 1)}};
    const compMat = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: compUniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(g, compMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1e6;
    return {screen, uniforms, mistMat, compUniforms, compMat, mesh, rt: null as THREE.WebGLRenderTarget | null, key: new InputKey()};
  }, []);

  const params = useRef({colors, intensity, scale, speed, parallax, pool, scatter, resolution, seed, look});
  params.current = {colors, intensity, scale, speed, parallax, pool, scatter, resolution, seed, look};

  const pass = useMemo<PrePass>(() => {
    const size = new THREE.Vector2();
    const camWorld = new THREE.Matrix4();
    return {
      order: 10,
      run(renderer, scene, camera, target) {
        const p = params.current;
        targetSize(renderer, target, size);
        const w = Math.max(1, Math.round(size.x * p.resolution));
        const h = Math.max(1, Math.round(size.y * p.resolution));
        if (!res.rt || res.rt.width !== w || res.rt.height !== h) {
          res.rt?.dispose();
          res.rt = halfFloatTarget(w, h);
          res.key.invalidate();
        }
        const u = res.uniforms;
        const tt = tRef.current;
        const pc = camera as THREE.PerspectiveCamera;
        u.uInvProj.value.copy(pc.projectionMatrixInverse);
        camWorld.extractRotation(camera.matrixWorld);
        u.uCamWorld.value.copy(camWorld);
        u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
        u.uTime.value = tt * p.speed;
        u.uScale.value = p.scale;
        u.uParallax.value = p.parallax;
        const k = typeof p.intensity === 'function' ? p.intensity(tt) : p.intensity;
        sceneColor(p.colors[0], 1, p.look, u.uVoid.value);
        sceneColor(p.colors[1], 1, p.look, u.uBody.value);
        sceneColor(p.colors[2], 1, p.look, u.uWisp.value);
        u.uIntensity.value = k;
        const pl = p.pool ?? {};
        u.uPool.value.set(pl.center?.[0] ?? 0.55, pl.center?.[1] ?? 0.55);
        u.uPoolAmt.value = Math.pow(2, pl.strength ?? 1.4) - 1;
        u.uPoolR.value = pl.radius ?? 0.62;
        u.uAspect.value = size.x / size.y;
        const light = fxBus(scene).light;
        if (light && light.visible > 0 && p.scatter > 0) {
          u.uLightUV.value.copy(light.uv);
          u.uLightCol.value.copy(light.color).multiplyScalar(light.visible);
          u.uLightR.value = light.radius;
          u.uScatter.value = p.scatter;
        } else {
          u.uScatter.value = 0;
        }
        u.uSeedOff.value.set((p.seed * 17.13) % 97, (p.seed * 7.71) % 89, (p.seed * 3.37) % 83);
        const changed = res.key
          .begin()
          .num(u.uTime.value)
          .mat(camera.matrixWorld)
          .mat(pc.projectionMatrix)
          .num(k)
          .num(u.uScatter.value)
          .num(u.uLightUV.value.x)
          .num(u.uLightUV.value.y)
          .num(u.uLightCol.value.r)
          .num(u.uLightCol.value.g)
          .num(u.uLightR.value)
          .num(u.uPoolAmt.value)
          .num(u.uPoolR.value)
          .num(u.uPool.value.x)
          .num(u.uPool.value.y)
          .num(u.uParallax.value)
          .num(u.uAspect.value)
          .num(u.uVoid.value.r + u.uVoid.value.g * 3 + u.uVoid.value.b * 7)
          .num(u.uBody.value.r + u.uBody.value.g * 3 + u.uBody.value.b * 7)
          .num(u.uWisp.value.r + u.uWisp.value.g * 3 + u.uWisp.value.b * 7)
          .num(u.uSeedOff.value.x)
          .num(p.scale)
          .changed();
        if (changed) {
          const saved = saveState(renderer, scene, camera);
          res.screen.render(renderer, res.mistMat, res.rt);
          restoreState(renderer, scene, camera, saved);
        }
        res.compUniforms.tMist.value = res.rt.texture;
        res.compUniforms.uTexSize.value.set(w, h);
      },
    };
  }, [res]);
  usePrePass(pass);

  useLayoutEffect(
    () => () => {
      res.rt?.dispose();
      res.screen.dispose();
      res.mistMat.dispose();
      res.compMat.dispose();
      res.mesh.geometry.dispose();
    },
    [res],
  );
  return <primitive object={res.mesh} />;
};
