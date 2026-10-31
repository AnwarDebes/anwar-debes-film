import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {useCurrentFrame, useRemotionEnvironment, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {subframeSamplers, type MotionContext} from './camera/subframe';

// The film's lens and film stock, as one pass chain:
//   scene x K sub-frames (MSAA, half float) -> running average (motion blur)
//   -> depth of field (half-res gather with tile-max radius, rack focus from the CameraRig)
//   -> bloom from the alpha glow mask (only lit pins bloom; other materials bloom by luminance)
//   -> tone mapping (three's exact ACES / AgX) -> vignette -> sRGB -> frame-seeded grain + dither.
// Everything is built during render and every parameter is a pure function of the frame, so each
// Remotion tab captures the same image for the same frame.

export type ToneMap = 'agx' | 'aces' | 'neutral' | 'linear';

export interface MotionBlurOptions {
  /** 'adaptive' (default): one sample when still, more while things move fast. */
  samples?: number | 'adaptive';
  /** Shutter as a fraction of the frame (0.5 = 180 degrees). */
  shutter?: number;
  maxSamples?: number;
  /** Adaptive target: on-screen travel per sample at 1440p (scaled with frame height). */
  pxPerSample?: number;
  /** Cap while previewing in the Studio. */
  previewMaxSamples?: number;
}

export type PostFXProps = {
  width: number;
  height: number;
  /** World-space focus distance from the camera. 0 disables depth of field. Omit to use the CameraRig's lens. */
  focusDistance?: number;
  /** World-space range around the focus distance that stays sharp (used without `aperture`). */
  focusRange?: number;
  bokehScale?: number;
  bloom?: number;
  bloomThreshold?: number;
  vignette?: number;
  grain?: number;
  aberration?: number;
  /** Physical lens: aperture diameter in world units (with focusDistance). */
  aperture?: number;
  /** Largest blur radius as a fraction of frame height. */
  maxBlur?: number;
  exposure?: number;
  toneMapping?: ToneMap;
  /** Bloom spread, 0..1 (mip blend). */
  bloomRadius?: number;
  motionBlur?: boolean | MotionBlurOptions;
  /** MSAA samples for the scene render. */
  msaa?: number;
  /** Centre of the vignette in uv (y up). The reel's light pool sits at x 0.55, y 0.55. */
  vignetteCenter?: [number, number];
  dither?: boolean;
  /** Log the sub-frame count and measured motion of every frame (console.warn). */
  debug?: boolean;
  /**
   * Diagnostics: 1 = blur radius (red behind focus, blue in front), 2 = tile search radius,
   * 3 = DoF blend, 4 = half-res blur radius, 5 = raw gather.
   */
  debugView?: 0 | 1 | 2 | 3 | 4 | 5;
};

/** The reel's look: ACES at 0.92 exposure, a soft pool vignette, fine grain, a tight mint bloom. */
export const REEL_LOOK = {
  toneMapping: 'aces' as ToneMap,
  exposure: 0.92,
  vignette: 0.42,
  vignetteCenter: [0.55, 0.55] as [number, number],
  grain: 0.05,
  bloom: 0.9,
  bloomThreshold: 0.6,
  bloomRadius: 0.62,
};

const KERNEL_N = 48;
const GOLDEN = 2.399963229728653;
const kernel = (() => {
  const k: THREE.Vector2[] = [];
  for (let i = 0; i < KERNEL_N; i++) {
    const r = Math.sqrt((i + 0.5) / KERNEL_N);
    k.push(new THREE.Vector2(Math.cos(i * GOLDEN) * r, Math.sin(i * GOLDEN) * r));
  }
  return k;
})();

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COC_CHUNK = /* glsl */ `
uniform float cameraNear;
uniform float cameraFar;
uniform float focusZ;
uniform float cocK;
uniform float focusRange;
uniform float rangeCoc;
uniform float maxCoc;
uniform int cocMode;
float viewDepth(float d) {
  return (cameraNear * cameraFar) / ((cameraFar - cameraNear) * d - cameraFar) * -1.0;
}
// signed blur radius in full-resolution pixels: + behind the focus plane, - in front
float cocOf(float d) {
  float z = viewDepth(d);
  float c;
  if (cocMode == 0) {
    c = cocK * (1.0 / focusZ - 1.0 / z);
  } else {
    float dz = z - focusZ;
    c = sign(dz) * smoothstep(0.0, focusRange, abs(dz)) * rangeCoc;
  }
  return clamp(c, -maxCoc, maxCoc);
}`;

const FRAG_COPY = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tSrc, vUv); }`;

const FRAG_COC = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 srcTexel;
varying vec2 vUv;
${COC_CHUNK}
void main() {
  vec2 o = srcTexel * 0.5;
  vec2 a = vUv + vec2(-o.x, -o.y);
  vec2 b = vUv + vec2(o.x, -o.y);
  vec2 c = vUv + vec2(-o.x, o.y);
  vec2 d = vUv + vec2(o.x, o.y);
  vec3 col = (texture2D(tColor, a).rgb + texture2D(tColor, b).rgb + texture2D(tColor, c).rgb + texture2D(tColor, d).rgb) * 0.25;
  float dmin = min(min(texture2D(tDepth, a).r, texture2D(tDepth, b).r), min(texture2D(tDepth, c).r, texture2D(tDepth, d).r));
  gl_FragColor = vec4(col, cocOf(dmin));
}`;

const FRAG_TILE = /* glsl */ `
uniform sampler2D tCoc;
uniform ivec2 cocSize;
uniform int tileSize;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * tileSize;
  float m = 0.0;
  for (int y = 0; y < 64; y++) {
    if (y >= tileSize) break;
    for (int x = 0; x < 64; x++) {
      if (x >= tileSize) break;
      ivec2 p = min(base + ivec2(x, y), cocSize - 1);
      m = max(m, abs(texelFetch(tCoc, p, 0).a));
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const FRAG_DILATE = /* glsl */ `
uniform sampler2D tTile;
uniform ivec2 tileCount;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float m = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++)
      m = max(m, texelFetch(tTile, clamp(p + ivec2(x, y), ivec2(0), tileCount - 1), 0).r);
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const FRAG_GATHER = /* glsl */ `
uniform sampler2D tCoc;
uniform sampler2D tTile;
uniform vec2 halfTexel;
uniform vec2 kernel[${KERNEL_N}];
varying vec2 vUv;
void main() {
  vec4 c0 = texture2D(tCoc, vUv);
  float coc0 = c0.a * 0.5;
  float R = texture2D(tTile, vUv).r * 0.5;
  if (R < 0.5) { gl_FragColor = vec4(c0.rgb, 0.0); return; }
  float ang = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float cs = cos(ang);
  float sn = sin(ang);
  mat2 rot = mat2(cs, sn, -sn, cs);
  float size0 = abs(coc0);
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  float nearSum = 0.0;
  for (int i = 0; i < ${KERNEL_N}; i++) {
    vec2 o = rot * kernel[i] * R;
    float r = length(o);
    // taps beyond the frame mirror back inside (clamping would repeat the border texel and leave
    // the frame edges sharper than the rest)
    vec2 suv = 1.0 - abs(1.0 - abs(vUv + o * halfTexel));
    vec4 s = textureLod(tCoc, suv, 0.0);
    float cS = s.a * 0.5;
    float size = abs(cS);
    // a sample behind this pixel may not spread over it further than this pixel's own blur
    if (cS > coc0) size = min(size, size0 * 2.0);
    float m = smoothstep(r - 0.5, r + 0.5, size);
    acc += s.rgb * m;
    wsum += m;
    if (cS < coc0 - 1.0) nearSum += m;
  }
  float nearCov = clamp(nearSum * (3.0 / float(${KERNEL_N})), 0.0, 1.0);
  gl_FragColor = vec4(acc / wsum, max(smoothstep(0.5, 1.25, size0), nearCov));
}`;

const FRAG_TENT = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec4 s = texture2D(tSrc, vUv) * 4.0;
  s += (texture2D(tSrc, vUv + vec2(texel.x, 0.0)) + texture2D(tSrc, vUv - vec2(texel.x, 0.0))
      + texture2D(tSrc, vUv + vec2(0.0, texel.y)) + texture2D(tSrc, vUv - vec2(0.0, texel.y))) * 2.0;
  s += texture2D(tSrc, vUv + texel) + texture2D(tSrc, vUv - texel)
     + texture2D(tSrc, vUv + vec2(texel.x, -texel.y)) + texture2D(tSrc, vUv + vec2(-texel.x, texel.y));
  gl_FragColor = s / 16.0;
}`;

// 13-tap downsample (Jimenez 2014); the first level applies the glow mask, threshold and a Karis
// average so single bright pixels cannot flicker.
const FRAG_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
uniform int prefilter;
varying vec2 vUv;
vec3 pre(vec2 uv) {
  vec4 c = texture2D(tSrc, uv);
  if (prefilter == 0) return c.rgb;
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float w = max(soft, l - threshold) / max(l, 1e-5);
  return c.rgb * max(w, 0.0) * clamp(c.a, 0.0, 1.0);
}
float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec3 a = pre(vUv + texel * vec2(-2.0, 2.0));
  vec3 b = pre(vUv + texel * vec2(0.0, 2.0));
  vec3 c = pre(vUv + texel * vec2(2.0, 2.0));
  vec3 d = pre(vUv + texel * vec2(-2.0, 0.0));
  vec3 e = pre(vUv);
  vec3 f = pre(vUv + texel * vec2(2.0, 0.0));
  vec3 g = pre(vUv + texel * vec2(-2.0, -2.0));
  vec3 h = pre(vUv + texel * vec2(0.0, -2.0));
  vec3 i = pre(vUv + texel * vec2(2.0, -2.0));
  vec3 j = pre(vUv + texel * vec2(-1.0, 1.0));
  vec3 k = pre(vUv + texel * vec2(1.0, 1.0));
  vec3 l = pre(vUv + texel * vec2(-1.0, -1.0));
  vec3 m = pre(vUv + texel * vec2(1.0, -1.0));
  vec3 outc;
  if (prefilter == 1) {
    vec3 g0 = (a + b + d + e) * 0.25;
    vec3 g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25;
    vec3 g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    float w0 = karis(g0) * 0.125;
    float w1 = karis(g1) * 0.125;
    float w2 = karis(g2) * 0.125;
    float w3 = karis(g3) * 0.125;
    float w4 = karis(g4) * 0.5;
    outc = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  } else {
    outc = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

const FRAG_UP = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tCur;
uniform vec2 lowTexel;
uniform float radius;
varying vec2 vUv;
void main() {
  vec2 t = lowTexel;
  vec3 s = texture2D(tLow, vUv).rgb * 4.0;
  s += (texture2D(tLow, vUv + vec2(t.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(t.x, 0.0)).rgb
      + texture2D(tLow, vUv + vec2(0.0, t.y)).rgb + texture2D(tLow, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  s += texture2D(tLow, vUv + t).rgb + texture2D(tLow, vUv - t).rgb
     + texture2D(tLow, vUv + vec2(t.x, -t.y)).rgb + texture2D(tLow, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(mix(texture2D(tCur, vUv).rgb, s / 16.0, radius), 1.0);
}`;

const FRAG_COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tDof;
uniform sampler2D tBloom;
uniform float bloomIntensity;
uniform float aberration;
uniform vec2 vigCenter;
uniform float vigOffset;
uniform float vigDarkness;
uniform float grainAmount;
uniform vec2 grainSeed;
uniform float ditherAmount;
uniform float dofOn;
uniform int debugView;
uniform sampler2D tTileDbg;
uniform sampler2D tCocDbg;
uniform sampler2D tGatherDbg;
uniform vec2 uvScale;
uniform vec2 uvOffset;
varying vec2 vUv;
${COC_CHUNK}
${THREE.ShaderChunk.tonemapping_pars_fragment}
vec3 sceneAt(vec2 uv) {
  vec3 sharp = texture2D(tColor, uv).rgb;
  if (dofOn > 0.5) {
    float coc = cocOf(texture2D(tDepth, uv).r);
    vec4 g = texture2D(tDof, uv);
    float a = max(smoothstep(1.0, 2.5, abs(coc)), g.a);
    sharp = mix(sharp, g.rgb, a);
  }
  return sharp;
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// screen uv -> uv in the guard-banded buffers
vec2 bufUv(vec2 uv) { return uvOffset + uv * uvScale; }
void main() {
  vec2 suv = bufUv(vUv);
  if (debugView > 0) {
    float coc = cocOf(texture2D(tDepth, suv).r) / maxCoc;
    vec4 g = texture2D(tDof, suv);
    float tile = texture2D(tTileDbg, suv).r / maxCoc;
    float hcoc = texture2D(tCocDbg, suv).a / maxCoc;
    vec3 v = debugView == 1 ? vec3(max(coc, 0.0), 0.0, max(-coc, 0.0))
      : debugView == 2 ? vec3(tile)
      : debugView == 3 ? vec3(g.a)
      : debugView == 4 ? vec3(max(hcoc, 0.0), 0.0, max(-hcoc, 0.0))
      : texture2D(tGatherDbg, suv).rgb;
    gl_FragColor = vec4(debugView == 5 ? toSRGB(ACESFilmicToneMapping(v)) : sqrt(clamp(v, 0.0, 1.0)), 1.0);
    return;
  }
  vec3 c;
#ifdef USE_CA
  vec2 d = vUv - 0.5;
  vec2 off = d * aberration * smoothstep(0.1, 0.75, length(d));
  c = vec3(sceneAt(bufUv(vUv + off)).r, sceneAt(suv).g, sceneAt(bufUv(vUv - off)).b);
#else
  c = sceneAt(suv);
#endif
#ifdef USE_BLOOM
  c += texture2D(tBloom, suv).rgb * bloomIntensity;
#endif
  c = TONE_MAP(c);
#ifdef USE_VIGNETTE
  float dv = distance(vUv, vigCenter);
  c *= smoothstep(0.8, vigOffset * 0.799, dv * (vigDarkness + vigOffset));
#endif
  c = toSRGB(c);
  vec2 sp = gl_FragCoord.xy + grainSeed;
  float n = hash12(sp) + hash12(sp + 19.19) - 1.0;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += n * grainAmount * (0.45 + 0.55 * sqrt(lum));
  c += (hash12(sp + 71.7) + hash12(sp + 3.3) - 1.0) * ditherAmount;
  gl_FragColor = vec4(c, 1.0);
}`;

const TONE_FN: Record<ToneMap, string> = {
  agx: 'AgXToneMapping',
  aces: 'ACESFilmicToneMapping',
  neutral: 'NeutralToneMapping',
  linear: 'LinearToneMapping',
};

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const shader = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string> = {}) =>
  new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false});

interface Params {
  dof: {mode: 0 | 1; focusZ: number; cocK: number; focusRange: number; rangeCoc: number} | null;
  bloom: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignette: number;
  vignetteCenter: [number, number];
  grain: number;
  aberration: number;
  exposure: number;
  toneMapping: ToneMap;
  maxBlur: number;
  dither: boolean;
  motion: Required<MotionBlurOptions> | null;
  debugView: number;
}

const BLOOM_LEVELS = 6;

type ViewCamera = THREE.Camera & {
  view?: {enabled: boolean} | null;
  setViewOffset?: (fw: number, fh: number, x: number, y: number, w: number, h: number) => void;
  clearViewOffset?: () => void;
};

/** Render with the frustum widened by G pixels on every side (same pixel size, larger frame). */
const withGuard = (camera: THREE.Camera, W: number, H: number, G: number, draw: () => void) => {
  const c = camera as ViewCamera;
  // a camera that already renders a sub-view keeps it (the guard would undo it)
  if (!c.setViewOffset || !c.clearViewOffset || (c.view && c.view.enabled)) {
    draw();
    return;
  }
  c.setViewOffset(W, H, -G, -G, W + 2 * G, H + 2 * G);
  draw();
  c.clearViewOffset();
};

class FilmPost {
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private accumRT!: THREE.WebGLRenderTarget;
  private cocRT!: THREE.WebGLRenderTarget;
  private tileRT!: THREE.WebGLRenderTarget;
  private tileDilRT!: THREE.WebGLRenderTarget;
  private gatherRT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private tile = 16;
  private readonly fsScene = new THREE.Scene();
  private readonly fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsMesh: THREE.Mesh;
  private readonly copyMat = shader(FRAG_COPY, {tSrc: {value: null}});
  private readonly cocMat: THREE.ShaderMaterial;
  private readonly tileMat = shader(FRAG_TILE, {tCoc: {value: null}, cocSize: {value: new THREE.Vector2()}, tileSize: {value: 16}});
  private readonly dilateMat = shader(FRAG_DILATE, {tTile: {value: null}, tileCount: {value: new THREE.Vector2()}});
  private readonly gatherMat = shader(FRAG_GATHER, {tCoc: {value: null}, tTile: {value: null}, halfTexel: {value: new THREE.Vector2()}, kernel: {value: kernel}});
  private readonly tentMat = shader(FRAG_TENT, {tSrc: {value: null}, texel: {value: new THREE.Vector2()}});
  private readonly downMat = shader(FRAG_DOWN, {tSrc: {value: null}, texel: {value: new THREE.Vector2()}, threshold: {value: 0.8}, knee: {value: 0.2}, prefilter: {value: 0}});
  private readonly upMat = shader(FRAG_UP, {tLow: {value: null}, tCur: {value: null}, lowTexel: {value: new THREE.Vector2()}, radius: {value: 0.85}});
  private composite: THREE.ShaderMaterial | null = null;
  private compositeKey = '';
  private readonly cocUniforms: Record<string, THREE.IUniform>;
  private readonly size = new THREE.Vector2();
  private readonly offsets: number[] = [];
  private readonly mctx: MotionContext;
  /** Sub-frames and measured on-screen motion (px) of the last rendered frame. */
  lastSamples = 1;
  lastMotionPx = 0;
  /** Debug only: stage times of the last frame in ms (pose, motion, scene, post, gpu). */
  timings: number[] | null = null;
  private readonly syncPixel = new Uint8Array(4);

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly msaa: number,
  ) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.fsMesh = new THREE.Mesh(tri, this.copyMat);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);
    this.cocUniforms = {
      cameraNear: {value: 0.1},
      cameraFar: {value: 100},
      focusZ: {value: 1},
      cocK: {value: 0},
      focusRange: {value: 1},
      rangeCoc: {value: 0},
      maxCoc: {value: 32},
      cocMode: {value: 0},
    };
    this.cocMat = shader(FRAG_COC, {tColor: {value: null}, tDepth: {value: null}, srcTexel: {value: new THREE.Vector2()}, ...this.cocUniforms});
    this.copyMat.blending = THREE.CustomBlending;
    this.copyMat.blendEquation = THREE.AddEquation;
    this.copyMat.blendSrc = THREE.ConstantAlphaFactor;
    this.copyMat.blendDst = THREE.OneMinusConstantAlphaFactor;
    this.copyMat.blendEquationAlpha = THREE.AddEquation;
    this.copyMat.blendSrcAlpha = THREE.ConstantAlphaFactor;
    this.copyMat.blendDstAlpha = THREE.OneMinusConstantAlphaFactor;
    this.mctx = {camera: new THREE.PerspectiveCamera(), widthPx: 1, heightPx: 1};
  }

  private ensureSize(w: number, h: number, maxBlurPx: number) {
    const tile = Math.max(8, Math.min(32, Math.ceil(maxBlurPx / 2)));
    if (w === this.w && h === this.h && tile === this.tile && this.sceneRT) return;
    this.disposeTargets();
    this.w = w;
    this.h = h;
    this.tile = tile;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.format = THREE.DepthFormat;
    const samples = Math.min(this.msaa, this.gl.capabilities.maxSamples);
    this.sceneRT = rt(w, h, {depthBuffer: true, depthTexture, samples});
    this.accumRT = rt(w, h);
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.cocRT = rt(hw, hh);
    this.gatherRT = rt(hw, hh);
    this.dofRT = rt(hw, hh);
    const tw = Math.ceil(hw / tile);
    const th = Math.ceil(hh / tile);
    this.tileRT = rt(tw, th, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
    this.tileDilRT = rt(tw, th, {minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
    this.down = [];
    this.up = [];
    let lw = hw;
    let lh = hh;
    for (let k = 0; k < BLOOM_LEVELS; k++) {
      this.down.push(rt(Math.max(1, lw), Math.max(1, lh)));
      if (k < BLOOM_LEVELS - 1) this.up.push(rt(Math.max(1, lw), Math.max(1, lh)));
      lw = Math.ceil(lw / 2);
      lh = Math.ceil(lh / 2);
    }
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.fsMesh.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.fsScene, this.fsCam);
  }

  private compositeFor(p: Params): THREE.ShaderMaterial {
    const key = `${p.toneMapping}|${p.bloom > 0}|${p.vignette > 0}|${p.aberration > 0}`;
    if (this.composite && key === this.compositeKey) return this.composite;
    this.composite?.dispose();
    const defines: Record<string, string> = {TONE_MAP: TONE_FN[p.toneMapping]};
    if (p.bloom > 0) defines.USE_BLOOM = '';
    if (p.vignette > 0) defines.USE_VIGNETTE = '';
    if (p.aberration > 0) defines.USE_CA = '';
    this.composite = shader(
      FRAG_COMPOSITE,
      {
        tColor: {value: null},
        tDepth: {value: null},
        tDof: {value: null},
        tBloom: {value: null},
        bloomIntensity: {value: 0},
        aberration: {value: 0},
        vigCenter: {value: new THREE.Vector2(0.5, 0.5)},
        vigOffset: {value: 0.25},
        vigDarkness: {value: 0.7},
        grainAmount: {value: 0},
        grainSeed: {value: new THREE.Vector2()},
        ditherAmount: {value: 1 / 255},
        dofOn: {value: 0},
        debugView: {value: 0},
        tTileDbg: {value: null},
        tCocDbg: {value: null},
        tGatherDbg: {value: null},
        uvScale: {value: new THREE.Vector2(1, 1)},
        uvOffset: {value: new THREE.Vector2(0, 0)},
        toneMappingExposure: {value: 1},
        ...this.cocUniforms,
      },
      defines,
    );
    this.compositeKey = key;
    return this.composite;
  }

  /** How many sub-frames this frame needs, and at which shutter offsets (centre-most last). */
  private planSamples(scene: THREE.Object3D, camera: THREE.Camera, p: Params, fps: number, isRendering: boolean, W: number, H: number): number {
    this.offsets.length = 0;
    const m = p.motion;
    const list = subframeSamplers(scene);
    if (!m || !list.length) {
      this.offsets.push(0);
      return 1;
    }
    const shutterS = m.shutter / fps;
    let K: number;
    this.lastMotionPx = 0;
    if (m.samples === 'adaptive') {
      this.mctx.camera = camera;
      this.mctx.widthPx = W;
      this.mctx.heightPx = H;
      let px = 0;
      for (const s of list) if (s.motionPx) px = Math.max(px, s.motionPx(-shutterS / 2, shutterS / 2, this.mctx));
      this.lastMotionPx = px;
      const per = m.pxPerSample * Math.max(1, H / 1440);
      K = Math.max(1, Math.min(m.maxSamples, Math.ceil(px / per - 0.25)));
    } else {
      K = Math.max(1, Math.round(m.samples));
    }
    if (!isRendering) K = Math.min(K, m.previewMaxSamples);
    for (let k = 0; k < K; k++) this.offsets.push(K === 1 ? 0 : shutterS * ((k + 0.5) / K - 0.5));
    this.offsets.sort((a, b) => Math.abs(b) - Math.abs(a));
    this.lastSamples = K;
    return K;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, p: Params, frame: number, fps: number, isRendering: boolean) {
    const gl = this.gl;
    gl.getDrawingBufferSize(this.size);
    const W = Math.max(1, Math.floor(this.size.x));
    const H = Math.max(1, Math.floor(this.size.y));
    const maxBlurPx = p.maxBlur * H;
    // a guard band around the frame gives blur, bloom and the shutter real pixels past every edge
    const G = Math.ceil(maxBlurPx) + 8;
    const BW = W + 2 * G;
    const BH = H + 2 * G;
    this.ensureSize(BW, BH, maxBlurPx);
    const clock = this.timings ? () => performance.now() : null;
    const tA = clock?.() ?? 0;
    const list = subframeSamplers(scene);
    for (const s of list) s.apply(0);
    const tB = clock?.() ?? 0;
    const K = this.planSamples(scene, camera, p, fps, isRendering, W, H);
    const tC = clock?.() ?? 0;

    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;

    // 1. scene, K sub-frames averaged (running mean: weight 1/(j+1))
    for (let j = 0; j < K; j++) {
      if (K > 1) for (const s of list) s.apply(this.offsets[j]);
      gl.autoClear = true;
      gl.setRenderTarget(this.sceneRT);
      withGuard(camera, W, H, G, () => gl.render(scene, camera));
      if (K > 1) {
        gl.autoClear = false;
        this.copyMat.uniforms.tSrc.value = this.sceneRT.texture;
        this.copyMat.blendAlpha = 1 / (j + 1);
        this.pass(this.copyMat, this.accumRT);
      }
    }
    if (K > 1) for (const s of list) s.apply(0);
    gl.autoClear = false;
    const color = K > 1 ? this.accumRT.texture : this.sceneRT.texture;
    const depth = this.sceneRT.depthTexture;
    const tD = clock?.() ?? 0;

    // shared lens uniforms
    const cu = this.cocUniforms;
    const pc = camera as THREE.PerspectiveCamera;
    cu.cameraNear.value = pc.near ?? 0.1;
    cu.cameraFar.value = pc.far ?? 100;
    cu.maxCoc.value = maxBlurPx;
    if (p.dof) {
      cu.cocMode.value = p.dof.mode;
      cu.focusZ.value = p.dof.focusZ;
      cu.cocK.value = p.dof.cocK * H;
      cu.focusRange.value = p.dof.focusRange;
      cu.rangeCoc.value = p.dof.rangeCoc * H;
    }

    // 2. depth of field
    if (p.dof) {
      const hw = this.cocRT.width;
      const hh = this.cocRT.height;
      this.cocMat.uniforms.tColor.value = color;
      this.cocMat.uniforms.tDepth.value = depth;
      (this.cocMat.uniforms.srcTexel.value as THREE.Vector2).set(1 / BW, 1 / BH);
      this.pass(this.cocMat, this.cocRT);
      this.tileMat.uniforms.tCoc.value = this.cocRT.texture;
      (this.tileMat.uniforms.cocSize.value as THREE.Vector2).set(hw, hh);
      this.tileMat.uniforms.tileSize.value = this.tile;
      this.pass(this.tileMat, this.tileRT);
      this.dilateMat.uniforms.tTile.value = this.tileRT.texture;
      (this.dilateMat.uniforms.tileCount.value as THREE.Vector2).set(this.tileRT.width, this.tileRT.height);
      this.pass(this.dilateMat, this.tileDilRT);
      this.gatherMat.uniforms.tCoc.value = this.cocRT.texture;
      this.gatherMat.uniforms.tTile.value = this.tileDilRT.texture;
      (this.gatherMat.uniforms.halfTexel.value as THREE.Vector2).set(1 / hw, 1 / hh);
      this.pass(this.gatherMat, this.gatherRT);
      this.tentMat.uniforms.tSrc.value = this.gatherRT.texture;
      (this.tentMat.uniforms.texel.value as THREE.Vector2).set(1 / hw, 1 / hh);
      this.pass(this.tentMat, this.dofRT);
    }

    // 3. bloom
    if (p.bloom > 0) {
      const dm = this.downMat.uniforms;
      dm.threshold.value = p.bloomThreshold;
      dm.knee.value = Math.max(0.05, p.bloomThreshold * 0.5);
      for (let k = 0; k < BLOOM_LEVELS; k++) {
        const src = k === 0 ? color : this.down[k - 1].texture;
        const sw = k === 0 ? BW : this.down[k - 1].width;
        const sh = k === 0 ? BH : this.down[k - 1].height;
        dm.tSrc.value = src;
        (dm.texel.value as THREE.Vector2).set(1 / sw, 1 / sh);
        dm.prefilter.value = k === 0 ? 1 : 0;
        this.pass(this.downMat, this.down[k]);
      }
      const um = this.upMat.uniforms;
      um.radius.value = p.bloomRadius;
      for (let k = BLOOM_LEVELS - 2; k >= 0; k--) {
        const low = k === BLOOM_LEVELS - 2 ? this.down[k + 1] : this.up[k + 1];
        um.tLow.value = low.texture;
        um.tCur.value = this.down[k].texture;
        (um.lowTexel.value as THREE.Vector2).set(1 / low.width, 1 / low.height);
        this.pass(this.upMat, this.up[k]);
      }
    }

    // 4. composite to the canvas
    const comp = this.compositeFor(p);
    const u = comp.uniforms;
    u.tColor.value = color;
    u.tDepth.value = depth;
    u.tDof.value = this.dofRT.texture;
    u.tBloom.value = this.up[0]?.texture ?? null;
    u.bloomIntensity.value = p.bloom;
    u.aberration.value = p.aberration;
    (u.vigCenter.value as THREE.Vector2).set(p.vignetteCenter[0], p.vignetteCenter[1]);
    u.vigOffset.value = 0.25;
    u.vigDarkness.value = p.vignette;
    u.grainAmount.value = (p.grain * 30) / 255;
    // R2 low-discrepancy offset per frame keeps the hash in float precision
    (u.grainSeed.value as THREE.Vector2).set(((frame * 0.7548776662) % 1) * 997, ((frame * 0.569840291) % 1) * 991);
    u.ditherAmount.value = p.dither ? 1 / 255 : 0;
    u.dofOn.value = p.dof ? 1 : 0;
    (u.uvScale.value as THREE.Vector2).set(W / BW, H / BH);
    (u.uvOffset.value as THREE.Vector2).set(G / BW, G / BH);
    u.debugView.value = p.debugView;
    u.tTileDbg.value = this.tileDilRT.texture;
    u.tCocDbg.value = this.cocRT.texture;
    u.tGatherDbg.value = this.gatherRT.texture;
    u.toneMappingExposure.value = p.exposure;
    this.pass(comp, null);

    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
    if (clock && this.timings) {
      const tE = clock();
      // a one-pixel read waits for the GPU (ANGLE returns from finish() at once)
      const ctx = gl.getContext();
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, this.syncPixel);
      const tF = clock();
      this.timings = [tB - tA, tC - tB, tD - tC, tE - tD, tF - tE];
    }
  }

  private disposeTargets() {
    for (const t of [this.sceneRT, this.accumRT, this.cocRT, this.tileRT, this.tileDilRT, this.gatherRT, this.dofRT, ...this.down, ...this.up]) {
      if (!t) continue;
      t.depthTexture?.dispose();
      t.dispose();
    }
  }

  dispose() {
    this.disposeTargets();
    for (const m of [this.copyMat, this.cocMat, this.tileMat, this.dilateMat, this.gatherMat, this.tentMat, this.downMat, this.upMat, this.composite]) m?.dispose();
    this.fsMesh.geometry.dispose();
  }
}

// Built synchronously during render so the very first advance() of every render tab already
// goes through the pipeline (the R3F postprocessing wrapper sizes its targets in a passive
// effect, which is too late for Remotion).
export const PostFX: React.FC<PostFXProps> = ({
  focusDistance,
  focusRange = 2,
  bokehScale = 3,
  bloom = 0.35,
  bloomThreshold = 0.8,
  vignette = 0.7,
  grain = 0.06,
  aberration = 0,
  aperture,
  maxBlur = 0.022,
  exposure = 1,
  toneMapping = 'agx',
  bloomRadius = 0.85,
  motionBlur = true,
  msaa = 4,
  vignetteCenter = [0.5, 0.5],
  dither = true,
  debug = false,
  debugView = 0,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {isRendering} = useRemotionEnvironment();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const post = useMemo(() => new FilmPost(gl, msaa), [gl, msaa]);
  post.timings = debug ? post.timings ?? [] : null;
  useLayoutEffect(() => () => post.dispose(), [post]);

  const motion = useMemo<Required<MotionBlurOptions> | null>(() => {
    if (motionBlur === false) return null;
    const o = motionBlur === true ? {} : motionBlur;
    return {
      samples: o.samples ?? 'adaptive',
      shutter: o.shutter ?? 0.5,
      maxSamples: o.maxSamples ?? 8,
      pxPerSample: o.pxPerSample ?? 1.25,
      previewMaxSamples: o.previewMaxSamples ?? 2,
    };
  }, [motionBlur]);

  const params = useRef<Params | null>(null);
  params.current = {
    dof: null,
    bloom,
    bloomThreshold,
    bloomRadius,
    vignette,
    vignetteCenter,
    grain,
    aberration,
    exposure,
    toneMapping,
    maxBlur,
    dither,
    motion,
    debugView,
  };

  const lastKey = useRef('');
  const ticks = useRef(0);
  const loggedGpu = useRef(false);
  const renders = useRef(0);

  // one depth-of-field state, rewritten every frame (nothing is allocated per frame)
  const dofState = useRef<NonNullable<Params['dof']>>({mode: 0, focusZ: 1, cocK: 0, focusRange: 1, rangeCoc: 0});

  useFrame(() => {
    const p = params.current;
    if (!p) return;
    p.dof = null;
    const pc = camera as THREE.PerspectiveCamera;
    const fov = pc.fov ?? 18;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
    // depth of field: explicit props first, then the CameraRig's lens
    const lens = camera.userData.lens as {focusDistance: number; aperture: number} | undefined;
    const d = dofState.current;
    d.focusRange = focusRange;
    if (focusDistance !== undefined) {
      if (focusDistance > 0) {
        const physical = aperture !== undefined && aperture > 0;
        d.mode = physical ? 0 : 1;
        d.focusZ = focusDistance;
        d.cocK = physical ? aperture / (4 * tanHalf) : 0;
        d.rangeCoc = physical ? 0 : (bokehScale * 4) / 1440;
        p.dof = d;
      }
    } else if (lens && lens.aperture > 0) {
      d.mode = 0;
      d.focusZ = lens.focusDistance;
      d.cocK = lens.aperture / (4 * tanHalf);
      d.rangeCoc = 0;
      p.dof = d;
    }
    if (!isRendering) {
      // the Studio redraws on every animation frame; skip identical frames
      const key = `${frameRef.current}|${JSON.stringify(p)}`;
      ticks.current = (ticks.current + 1) % 15;
      if (key === lastKey.current && ticks.current !== 0) return;
      lastKey.current = key;
    }
    post.render(scene, camera, p, frameRef.current, fps, isRendering);
    if (debug) {
      if (!loggedGpu.current) {
        loggedGpu.current = true;
        const ctx = gl.getContext();
        const ext = ctx.getExtension('WEBGL_debug_renderer_info');
        console.warn(`[PostFX] GPU ${ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'}, buffer ${gl.domElement.width}x${gl.domElement.height}`);
      }
      const lens = p.dof ? ` focus ${p.dof.focusZ.toFixed(4)}` : '';
      const ms = (post.timings ?? []).map((x) => x.toFixed(1)).join('/');
      renders.current++;
      console.warn(`[PostFX] render #${renders.current} frame ${frameRef.current}: ${post.lastSamples} sub-frames, motion ${post.lastMotionPx.toFixed(2)} px${lens}, ms pose/motion/scene/post/gpu ${ms}`);
    }
  }, 1);

  return null;
};
