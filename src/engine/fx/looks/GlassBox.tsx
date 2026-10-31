import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {HASH_GLSL} from '../glsl';
import {FX_LAYER, restoreState, saveState, targetSize, useFxLayers, useFxTime, usePrePass, type PrePass} from '../scene';
import {occlusionBlending, useOccluder} from './GodRays';
import {CELLS_GLSL, cellSizeFor, type ClaritySweep, type Vec3} from './glassCells';

// Black box to glass box. A cube whose surface is a lattice of hex cells; each cell flips from
// obsidian to clear glass on its own beat (a sweep with jitter, the pin wall's grammar), with a mint
// flash on its outline.
//
// The default glass is a vitrine: thin walls around air, so whatever sits inside reads undistorted.
// Each wall shifts the view ray sideways by the exact parallel-plate offset for its angle (more at
// grazing angles), absorbs over the true path length, and reflects the studio by Fresnel; where a
// wall is seen edge-on along the box's edges it shows as a denser band with two lines, the way real
// glass edges do. The far walls are drawn into the view behind the glass, so their edges and their
// not-yet-cleared cells are seen through the front. `solid` gives a solid block instead: refraction
// through the block with one total-internal-reflection bounce and a short screen-space search for
// what is inside.

export interface GlassBoxProps {
  /** Edge lengths, world units (a number for a cube). */
  size?: number | Vec3;
  position?: Vec3 | ((t: number) => Vec3);
  /** Euler XYZ, radians. */
  rotation?: Vec3 | ((t: number) => Vec3);
  /** A sweep that clears the box cell by cell, or a fixed clarity 0..1. */
  clarity?: ClaritySweep | number;
  /** Hex cells across the largest face. */
  cells?: number;
  /** Wall thickness as a fraction of the largest edge (vitrine). */
  wall?: number;
  /** A solid glass block instead of a vitrine. */
  solid?: boolean;
  ior?: number;
  /** Spread of the per-channel refraction (0 = none). */
  dispersion?: number;
  /**
   * Absorption of the glass. Vitrine: per wall crossed at normal incidence. Solid: per world unit.
   * A faint cool body; edges seen along a wall absorb more.
   */
  absorption?: Vec3;
  /** Edge line width in px at 1440p, and its brightness in the black and glass states. */
  edgeWidth?: number;
  edge?: [number, number];
  edgeBloom?: number;
  /** Brightness of the mint flash on a flipping cell's outline. */
  flash?: number;
  /** Obsidian base colour of the black state (display colour). */
  obsidian?: string;
  /** Studio reflection strength on the glass (1 = physical Fresnel). */
  reflection?: number;
  /** Distance behind the box at which the view through the glass is assumed when it hits nothing. */
  farDistance?: number;
  /** Block the god-ray light (with the cells' transmittance). */
  occlude?: boolean;
  /** MSAA samples of the view behind the glass. */
  behindSamples?: number;
  /** Show the view behind the glass (1), its depth (2), or the view without the near clip (3). */
  debugView?: number;
  timeOffset?: number;
  look?: Look;
  children?: React.ReactNode;
}

const VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNObj;
varying vec3 vWorld;
void main() {
  vObj = position;
  vNObj = normal;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const COMMON = /* glsl */ `
varying vec3 vObj;
varying vec3 vNObj;
varying vec3 vWorld;
uniform float uTime;
uniform vec3 uEdgeCol;
uniform vec3 uFlashCol;
uniform vec2 uEdge;
uniform float uEdgeW;
uniform float uFlash;
uniform float uWall;

// distance to the nearest edge of the face this fragment lies on, object units
float faceEdgeDist(vec3 p, vec3 n) {
  vec3 d = (uHalf - abs(p)) + abs(n) * 1e3;
  return min(d.x, min(d.y, d.z));
}
`;

const FRAG = /* glsl */ `
${HASH_GLSL}
${CELLS_GLSL}
${COMMON}
uniform mat4 uObjToWorld;
uniform mat4 uWorldToObj;
uniform sampler2D uBehind;
uniform sampler2D uBehindDepth;
uniform float uHasBehind;
uniform vec4 uScissorUV;
uniform vec2 uViewport;
uniform float uNear;
uniform float uFar;
uniform float uIor;
uniform float uDispersion;
uniform vec3 uAbsorb;
uniform vec3 uObsidian;
uniform vec3 uEnvLo;
uniform vec3 uEnvHi;
uniform vec3 uKey;
uniform float uEdgeBloom;
uniform float uFarDist;
uniform float uReflect;
uniform mat4 uViewProj;
uniform vec3 uCamFwd;
uniform float uSolid;
uniform float uDebug;

float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}

vec3 studio(vec3 d) {
  vec3 c = mix(uEnvLo, uEnvHi, smoothstep(-0.25, 0.95, d.y));
  float k = dot(d, normalize(vec3(-0.55, 0.68, 0.48)));
  c += uKey * smoothstep(0.88, 0.975, k);
  float s = dot(d, normalize(vec3(0.92, 0.12, 0.36)));
  c += uKey * 0.45 * smoothstep(0.975, 0.995, s);
  return c;
}

vec3 exitNormal(vec3 tFar, vec3 dir) {
  if (tFar.x <= tFar.y && tFar.x <= tFar.z) return vec3(sign(dir.x), 0.0, 0.0);
  if (tFar.y <= tFar.z) return vec3(0.0, sign(dir.y), 0.0);
  return vec3(0.0, 0.0, sign(dir.z));
}

float slabExit(vec3 p, vec3 dir, out vec3 nOut) {
  vec3 d = dir + step(abs(dir), vec3(1e-6)) * 1e-6;
  vec3 tA = (uHalf - p) / d;
  vec3 tB = (-uHalf - p) / d;
  vec3 tF = max(tA, tB);
  nOut = exitNormal(tF, d);
  return max(0.0, min(tF.x, min(tF.y, tF.z)));
}

vec2 projectUV(vec3 w, out float viewZ) {
  vec4 c = uViewProj * vec4(w, 1.0);
  viewZ = c.w;
  return c.xy / c.w * 0.5 + 0.5;
}

vec2 clampUV(vec2 uv) { return clamp(uv, uScissorUV.xy, uScissorUV.zw); }

// sideways offset of a ray crossing a flat wall of thickness w (nIn faces the incoming ray)
vec3 wallShift(vec3 rd, vec3 nIn, float w, float eta, out float pathL) {
  vec3 t = refract(rd, nIn, eta);
  float ci = max(-dot(rd, nIn), 0.12);
  float ct = max(-dot(t, nIn), 0.12);
  pathL = w / ct;
  return t * pathL - rd * (w / ci);
}

// rgb through the glass; alpha carries the bloom mask of what is seen (lit pins inside bloom)
vec4 sampleBehind(vec2 uv, vec2 dv) {
  vec4 c = texture2D(uBehind, clampUV(uv));
  return vec4(texture2D(uBehind, clampUV(uv - dv)).r, c.g, texture2D(uBehind, clampUV(uv + dv)).b, c.a);
}

// vitrine: front wall, air, far wall; returns transmitted light and the glass path length
vec4 throughVitrine(vec3 n, vec3 rdObj, vec3 rdW, float extraShift, out float L) {
  vec3 nb;
  float sb = slabExit(vObj, rdObj, nb);
  vec3 farW = (uObjToWorld * vec4(vObj + rdObj * sb, 1.0)).xyz;
  float farZ = dot(farW - cameraPosition, uCamFwd);
  float vz;
  vec2 uv0 = projectUV(vWorld, vz);
  float zc = linearDepth(texture2D(uBehindDepth, clampUV(uv0)).r);
  // content beyond the far wall is shifted by both walls; content inside only by the front one
  float beyond = smoothstep(farZ - 0.004, farZ + 0.004, zc);
  float cosv = max(dot(rdW, uCamFwd), 1e-3);
  vec3 C = cameraPosition + rdW * (min(zc, farZ + uFarDist) / cosv);
  float L1;
  float L2;
  vec3 D1 = wallShift(rdObj, n, uWall, 1.0 / uIor, L1);
  vec3 D2 = wallShift(rdObj, -nb, uWall, 1.0 / uIor, L2);
  vec3 Dw = mat3(uObjToWorld) * ((D1 + beyond * D2) * extraShift);
  float tz;
  vec2 uv = projectUV(C + Dw, tz);
  L = L1 + beyond * L2;
  return sampleBehind(uv, (uv - uv0) * uDispersion);
}

// solid block: refraction in, one TIR bounce, a short search for what is inside
vec4 throughBlock(vec3 n, vec3 rdObj, out float L, out float tir) {
  vec3 t1 = refract(rdObj, n, 1.0 / uIor);
  vec3 n2;
  float s1 = slabExit(vObj, t1, n2);
  vec3 q = vObj + t1 * s1;
  L = s1;
  vec3 t2 = refract(t1, -n2, uIor);
  tir = 0.0;
  if (dot(t2, t2) < 1e-6) {
    vec3 r1 = reflect(t1, -n2);
    vec3 n3;
    float s2 = slabExit(q, r1, n3);
    q += r1 * s2;
    L += s2;
    t2 = refract(r1, -n3, uIor);
    if (dot(t2, t2) < 1e-6) { t2 = reflect(r1, -n3); tir = 1.0; }
  }
  vec3 eW = vWorld;
  vec3 xW = (uObjToWorld * vec4(vObj + t1 * s1, 1.0)).xyz;
  float vz;
  vec2 uvS = projectUV(vWorld, vz);
  vec2 uvHit = vec2(-1.0);
  for (int i = 1; i <= 14; i++) {
    vec3 P = mix(eW, xW, float(i) / 14.0);
    float rz;
    vec2 uvP = projectUV(P, rz);
    float sz = linearDepth(texture2D(uBehindDepth, clampUV(uvP)).r);
    if (sz < rz && sz > rz - 0.25 * distance(eW, xW) - 0.02) { uvHit = uvP; break; }
  }
  vec3 t2W = normalize(mat3(uObjToWorld) * t2);
  vec3 qW = (uObjToWorld * vec4(q, 1.0)).xyz;
  float fz;
  vec2 uvFar = projectUV(qW + t2W * uFarDist, fz);
  vec2 uv = uvHit.x >= 0.0 ? uvHit : uvFar;
  return sampleBehind(uv, (uv - uvS) * uDispersion);
}

void main() {
  vec3 n = normalize(vNObj);
  vec2 local;
  float prog;
  float cellRnd;
  float k = fxCellClarity(vObj, n, uTime, local, prog, cellRnd);

  vec3 rdW = normalize(vWorld - cameraPosition);
  vec3 nW = normalize(mat3(uObjToWorld) * n);
  float cosi = clamp(dot(-rdW, nW), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - cosi, 5.0);
  vec3 refl = studio(reflect(rdW, nW)) * uReflect;

  // cell seam and the flash on a flipping cell's outline
  float e = 0.5 - fxHexDist(local);
  float aa = max(fwidth(e), 1e-4);
  float seam = 1.0 - smoothstep(0.0, 1.4 * aa, e);
  float halo = exp(-e / (3.5 * aa));
  float flip = sin(3.14159265 * prog);
  flip *= flip;

  // the box's edges on this face (px), and the walls seen edge-on along them
  float eObj = faceEdgeDist(vObj, n);
  float aaE = max(fwidth(eObj), 1e-6);
  float ePx = eObj / aaE;
  float edgeLine = 1.0 - smoothstep(0.5 * uEdgeW, 0.5 * uEdgeW + 1.0, ePx);
  float edgeGlow = exp(-ePx / (4.0 * uEdgeW));
  float wallW = uSolid > 0.5 ? 0.0 : uWall;
  float band = wallW > 0.0 ? 1.0 - smoothstep(wallW - aaE, wallW + aaE, eObj) : 0.0;
  float innerLine = wallW > 0.0 ? exp(-abs(eObj - wallW) / (0.9 * aaE)) : 0.0;

  // the black state: obsidian, faint per-cell variation (dark pins), glossy reflections
  vec3 black = uObsidian * (0.7 + 0.45 * smoothstep(-0.6, 1.0, n.y) + 0.12 * (cellRnd - 0.5));
  black *= 1.0 - 0.55 * seam;
  black += refl * (0.18 * F + 0.012);

  // the glass state
  vec3 glass = refl * F;
  float seenBloom = 0.0;
  if (uHasBehind > 0.5 && k > 0.0) {
    vec3 ro = (uWorldToObj * vec4(cameraPosition, 1.0)).xyz;
    vec3 rdObj = normalize(vObj - ro);
    vec4 trans;
    if (uSolid > 0.5) {
      float L;
      float tir;
      trans = throughBlock(n, rdObj, L, tir);
      float T = 1.0 - F;
      glass += trans.rgb * exp(-uAbsorb * L) * mix(1.0, 0.55, tir) * T;
      seenBloom = trans.a * T;
    } else {
      float L;
      // inside the edge band the ray runs along a wall: a longer, more displaced path
      trans = throughVitrine(n, rdObj, rdW, 1.0 + 5.0 * band, L);
      float walls = L / max(uWall, 1e-6) + band * 6.0;
      // two surfaces per wall, each reflecting F
      float T = (1.0 - F) * (1.0 - F);
      glass += trans.rgb * exp(-uAbsorb * walls) * T + refl * F * 0.6 * band;
      seenBloom = trans.a * T * (1.0 - band);
    }
  }

  vec3 col = mix(black, glass, k);
  if (uDebug > 0.5) {
    vec2 su = gl_FragCoord.xy / uViewport;
    col = uDebug < 1.5 ? texture2D(uBehind, su).rgb * 2.0 : vec3(fract(linearDepth(texture2D(uBehindDepth, su).r) * 2.0));
  }
  float edgeAmt = mix(uEdge.x, uEdge.y, k);
  col += uEdgeCol * edgeAmt * (edgeLine + 0.3 * edgeGlow + 0.45 * k * innerLine);
  // the flip: the cell's outline flashes mint, its face brightens for an instant
  col += uFlashCol * uFlash * flip * (0.85 * max(seam, 0.5 * halo) + 0.12);
  float bloom = uEdgeBloom * edgeAmt * edgeLine + uFlash * flip * (0.8 * seam + 0.1);
  bloom = max(bloom, k * seenBloom);
  gl_FragColor = vec4(col, clamp(bloom, 0.0, 1.0));
}`;

// The far walls from the inside, drawn only into the view behind the glass: obsidian where a cell
// is still black (it hides what lies behind it), and the far edges and wall lines once it is clear.
const BACK_FRAG = /* glsl */ `
${HASH_GLSL}
${CELLS_GLSL}
${COMMON}
uniform vec3 uInside;
void main() {
  vec3 n = normalize(vNObj);
  vec2 local;
  float prog;
  float rnd;
  float k = fxCellClarity(vObj, n, uTime, local, prog, rnd);
  float e = 0.5 - fxHexDist(local);
  float aa = max(fwidth(e), 1e-4);
  float seam = 1.0 - smoothstep(0.0, 1.4 * aa, e);
  float flip = sin(3.14159265 * prog);
  flip *= flip;
  float eObj = faceEdgeDist(vObj, n);
  float aaE = max(fwidth(eObj), 1e-6);
  float edgeLine = 1.0 - smoothstep(0.5 * uEdgeW, 0.5 * uEdgeW + 1.0, eObj / aaE);
  float innerLine = uWall > 0.0 ? exp(-abs(eObj - uWall) / (0.9 * aaE)) : 0.0;
  float a = 1.0 - k;
  vec3 lines = uEdgeCol * uEdge.y * k * (0.75 * edgeLine + 0.3 * innerLine);
  vec3 col = uInside * (1.0 - 0.5 * seam) * a + lines + uFlashCol * uFlash * 0.5 * flip * seam;
  if (a < 0.002 && dot(col, vec3(1.0)) < 1e-4) discard;
  gl_FragColor = vec4(col, a);
}`;

const OCC_FRAG = /* glsl */ `
${HASH_GLSL}
${CELLS_GLSL}
varying vec3 vObj;
varying vec3 vNObj;
varying vec3 vWorld;
uniform float uTime;
uniform float uTransmit;
void main() {
  vec2 local;
  float prog;
  float rnd;
  float k = fxCellClarity(vObj, normalize(vNObj), uTime, local, prog, rnd);
  float seam = 1.0 - smoothstep(0.0, 0.06, 0.5 - fxHexDist(local));
  float T = k * uTransmit * (1.0 - 0.6 * seam);
  gl_FragColor = vec4(vec3(T), 1.0);
}`;

const resolve = <T,>(v: T | ((t: number) => T) | undefined, t: number, fallback: T): T =>
  v === undefined ? fallback : typeof v === 'function' ? (v as (t: number) => T)(t) : v;

const clipLists = new WeakMap<THREE.Plane, THREE.Plane[]>();
const clipList = (p: THREE.Plane) => {
  let l = clipLists.get(p);
  if (!l) {
    l = [p];
    clipLists.set(p, l);
  }
  return l;
};

const _corner = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _size = new THREE.Vector2();

/**
 * The film's central metaphor as a shader: a black box that turns into a glass box, literal by
 * literal. Children are rendered inside the box (in its local frame) and are seen through the glass.
 */
export const GlassBox: React.FC<GlassBoxProps> = ({
  size = 0.4,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  clarity = 0,
  cells = 9,
  wall = 0.022,
  solid = false,
  ior = 1.5,
  dispersion,
  absorption,
  edgeWidth = 1.3,
  edge = [0.18, 0.6],
  edgeBloom = 0.45,
  flash = 2.4,
  obsidian = '#101312',
  reflection = 1,
  farDistance = 1.2,
  occlude = true,
  behindSamples = 2,
  debugView = 0,
  timeOffset = 0,
  look = REEL_GRADE,
  children,
}) => {
  const t = useFxTime(timeOffset);
  const tRef = useRef(t);
  tRef.current = t;
  useFxLayers();
  const dims: Vec3 = typeof size === 'number' ? [size, size, size] : size;
  const half: Vec3 = [dims[0] / 2, dims[1] / 2, dims[2] / 2];
  const wallObj = wall * Math.max(dims[0], dims[1], dims[2]);

  const res = useMemo(() => {
    const shared = {
      uHalf: {value: new THREE.Vector3()},
      uCellSize: {value: 0.05},
      uSweep: {value: new THREE.Vector4()},
      uSweep2: {value: new THREE.Vector4()},
      uTime: {value: 0},
      uEdgeCol: {value: new THREE.Color()},
      uFlashCol: {value: new THREE.Color()},
      uEdge: {value: new THREE.Vector2()},
      uEdgeW: {value: 1.4},
      uFlash: {value: 1},
      uWall: {value: 0},
    };
    const uniforms = {
      ...shared,
      uObjToWorld: {value: new THREE.Matrix4()},
      uWorldToObj: {value: new THREE.Matrix4()},
      uBehind: {value: null as THREE.Texture | null},
      uBehindDepth: {value: null as THREE.Texture | null},
      uHasBehind: {value: 0},
      uScissorUV: {value: new THREE.Vector4(0, 0, 1, 1)},
      uViewport: {value: new THREE.Vector2(1, 1)},
      uNear: {value: 0.02},
      uFar: {value: 80},
      uIor: {value: 1.5},
      uDispersion: {value: 0.03},
      uAbsorb: {value: new THREE.Vector3()},
      uObsidian: {value: new THREE.Color()},
      uEnvLo: {value: new THREE.Color()},
      uEnvHi: {value: new THREE.Color()},
      uKey: {value: new THREE.Color()},
      uEdgeBloom: {value: 0.6},
      uFarDist: {value: 1},
      uReflect: {value: 1},
      uViewProj: {value: new THREE.Matrix4()},
      uCamFwd: {value: new THREE.Vector3(0, 0, -1)},
      uSolid: {value: 0},
      uDebug: {value: 0},
    };
    const material = new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: FRAG, uniforms, toneMapped: false});
    const backUniforms = {...shared, uInside: {value: new THREE.Color()}};
    const backMaterial = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BACK_FRAG,
      uniforms: backUniforms,
      side: THREE.BackSide,
      toneMapped: false,
      transparent: false,
      depthWrite: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const occUniforms = {
      uHalf: shared.uHalf,
      uCellSize: shared.uCellSize,
      uSweep: shared.uSweep,
      uSweep2: shared.uSweep2,
      uTime: shared.uTime,
      uTransmit: {value: 0.92},
    };
    // both walls filter the light: front and back faces multiply in
    const occMaterial = new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: OCC_FRAG, uniforms: occUniforms, toneMapped: false, side: THREE.DoubleSide, ...occlusionBlending});
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(undefined, material);
    mesh.layers.set(FX_LAYER.glass);
    mesh.renderOrder = 2;
    const back = new THREE.Mesh(undefined, backMaterial);
    back.layers.set(FX_LAYER.inside);
    back.renderOrder = 1;
    group.add(mesh, back);
    return {uniforms, material, backUniforms, backMaterial, occMaterial, group, mesh, back, rt: null as THREE.WebGLRenderTarget | null, samples: -1, plane: new THREE.Plane(), tmp: new THREE.Vector3()};
  }, []);

  // geometry follows the size
  const geoKey = dims.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => new THREE.BoxGeometry(dims[0], dims[1], dims[2]), [geoKey]);
  res.mesh.geometry = geo;
  res.back.geometry = geo;
  useLayoutEffect(() => () => geo.dispose(), [geo]);

  useOccluder(occlude ? res.mesh : null, res.occMaterial);

  // pose and uniforms for this frame
  const pos = resolve(position, t, [0, 0, 0] as Vec3);
  const rot = resolve(rotation, t, [0, 0, 0] as Vec3);
  res.group.position.set(pos[0], pos[1], pos[2]);
  res.group.rotation.set(rot[0], rot[1], rot[2]);
  const u = res.uniforms;
  u.uHalf.value.set(half[0], half[1], half[2]);
  u.uCellSize.value = cellSizeFor(half, cells);
  if (typeof clarity === 'number') {
    u.uSweep2.value.set(1, 0, 1, Math.min(1, Math.max(0, clarity)));
  } else {
    const o = clarity.origin ?? [0, 0, half[2]];
    u.uSweep.value.set(o[0], o[1], o[2], clarity.at);
    u.uSweep2.value.set(clarity.speed ?? 0.5, clarity.jitter ?? 0.35, clarity.cellDur ?? 0.32, -1);
  }
  u.uWall.value = solid ? 0 : wallObj;
  u.uSolid.value = solid ? 1 : 0;
  u.uIor.value = ior;
  u.uDispersion.value = dispersion ?? (solid ? 0.035 : 0.25);
  const ab = absorption ?? (solid ? [0.5, 0.18, 0.28] : [0.05, 0.016, 0.03]);
  u.uAbsorb.value.set(ab[0], ab[1], ab[2]);
  u.uTime.value = t;
  sceneColor(obsidian, 1, look, u.uObsidian.value);
  sceneColor(obsidian, 0.6, look, res.backUniforms.uInside.value);
  sceneColor('#07090A', 1, look, u.uEnvLo.value);
  sceneColor('#262B29', 1, look, u.uEnvHi.value);
  sceneColor(FX_PALETTE.white, 0.9, look, u.uKey.value);
  sceneColor(FX_PALETTE.white, 1, look, u.uEdgeCol.value);
  sceneColor(FX_PALETTE.mint, 1, look, u.uFlashCol.value);
  u.uEdge.value.set(edge[0], edge[1]);
  u.uEdgeBloom.value = edgeBloom;
  u.uFlash.value = flash;
  u.uFarDist.value = farDistance;
  u.uReflect.value = reflection;
  u.uDebug.value = debugView === 3 ? 1 : debugView;
  // the far walls only matter for a vitrine (a solid block is refracted as a whole)
  res.back.visible = !solid;

  // is any cell clear yet? (no view behind the glass is needed while it is all black)
  const anyClear = typeof clarity === 'number' ? clarity > 0 : t >= clarity.at - 0.05;
  const params = useRef({anyClear, behindSamples, edgeWidth, debugView});
  params.current = {anyClear, behindSamples, edgeWidth, debugView};

  const pass = useMemo<PrePass>(
    () => ({
      order: 30,
      run(renderer, scene, camera, target) {
        const p = params.current;
        const uu = res.uniforms;
        targetSize(renderer, target, _size);
        uu.uViewport.value.copy(_size);
        uu.uEdgeW.value = (p.edgeWidth * _size.y) / 1440;
        const pc = camera as THREE.PerspectiveCamera;
        uu.uNear.value = pc.near;
        uu.uFar.value = pc.far;
        uu.uViewProj.value.multiplyMatrices(pc.projectionMatrix, pc.matrixWorldInverse);
        camera.getWorldDirection(uu.uCamFwd.value);
        res.mesh.updateWorldMatrix(true, false);
        uu.uObjToWorld.value.copy(res.mesh.matrixWorld);
        uu.uWorldToObj.value.copy(res.mesh.matrixWorld).invert();
        if (!p.anyClear) {
          uu.uHasBehind.value = 0;
          return;
        }
        const w = Math.max(1, Math.floor(_size.x));
        const h = Math.max(1, Math.floor(_size.y));
        const samples = Math.min(p.behindSamples, renderer.capabilities.maxSamples);
        if (!res.rt || res.rt.width !== w || res.rt.height !== h || res.samples !== samples) {
          res.rt?.depthTexture?.dispose();
          res.rt?.dispose();
          const depthTexture = new THREE.DepthTexture(w, h);
          depthTexture.type = THREE.UnsignedIntType;
          depthTexture.format = THREE.DepthFormat;
          res.rt = new THREE.WebGLRenderTarget(w, h, {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: true,
            depthTexture,
            samples,
            generateMipmaps: false,
          });
          res.samples = samples;
        }
        // screen rectangle of the box, widened for refraction, and the plane at its nearest corner
        _fwd.copy(uu.uCamFwd.value);
        _cam.setFromMatrixPosition(camera.matrixWorld);
        let x0 = 1;
        let y0 = 1;
        let x1 = 0;
        let y1 = 0;
        let zMin = Infinity;
        for (let c = 0; c < 8; c++) {
          _corner.set(c & 1 ? half[0] : -half[0], c & 2 ? half[1] : -half[1], c & 4 ? half[2] : -half[2]).applyMatrix4(res.mesh.matrixWorld);
          zMin = Math.min(zMin, res.tmp.copy(_corner).sub(_cam).dot(_fwd));
          _corner.project(camera);
          x0 = Math.min(x0, _corner.x * 0.5 + 0.5);
          x1 = Math.max(x1, _corner.x * 0.5 + 0.5);
          y0 = Math.min(y0, _corner.y * 0.5 + 0.5);
          y1 = Math.max(y1, _corner.y * 0.5 + 0.5);
        }
        const margin = 0.12;
        const mx = (x1 - x0) * margin + 0.01;
        const my = (y1 - y0) * margin + 0.01;
        x0 = Math.max(0, x0 - mx);
        y0 = Math.max(0, y0 - my);
        x1 = Math.min(1, x1 + mx);
        y1 = Math.min(1, y1 + my);
        if (x1 <= x0 || y1 <= y0) {
          uu.uHasBehind.value = 0;
          return;
        }
        const halfPx = [0.5 / w, 0.5 / h];
        uu.uScissorUV.value.set(x0 + halfPx[0], y0 + halfPx[1], x1 - halfPx[0], y1 - halfPx[1]);
        const sx = Math.floor(x0 * w);
        const sy = Math.floor(y0 * h);
        const sw = Math.ceil(x1 * w) - sx;
        const sh = Math.ceil(y1 * h) - sy;
        res.rt.scissor.set(sx, sy, sw, sh);
        res.rt.scissorTest = true;

        const saved = saveState(renderer, scene, camera);
        renderer.shadowMap.autoUpdate = false;
        res.plane.normal.copy(_fwd);
        res.plane.constant = -(_fwd.dot(_cam) + Math.max(pc.near, zMin - 1e-3));
        renderer.clippingPlanes = p.debugView === 3 ? [] : clipList(res.plane);
        // the glass mesh also sits on the occluder layer (it filters the god-ray light), so that
        // bit goes too (an occluder that is a regular object keeps layer 0 and still draws); the
        // far walls live on the inside layer, seen only from here
        camera.layers.mask = (saved.layers & ~(1 << FX_LAYER.glass) & ~(1 << FX_LAYER.overlay) & ~(1 << FX_LAYER.occluder)) | (1 << FX_LAYER.inside);
        renderer.autoClear = true;
        renderer.setRenderTarget(res.rt);
        renderer.render(scene, camera);
        restoreState(renderer, scene, camera, saved);
        uu.uBehind.value = res.rt.texture;
        uu.uBehindDepth.value = res.rt.depthTexture;
        uu.uHasBehind.value = 1;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [res, half[0], half[1], half[2]],
  );
  usePrePass(pass);

  useLayoutEffect(
    () => () => {
      res.rt?.depthTexture?.dispose();
      res.rt?.dispose();
      res.material.dispose();
      res.backMaterial.dispose();
      res.occMaterial.dispose();
    },
    [res],
  );
  return (
    <primitive object={res.group}>
      <group>{children}</group>
    </primitive>
  );
};
