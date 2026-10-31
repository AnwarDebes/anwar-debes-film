import React, {useLayoutEffect, useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {useFxTime, useQuadGeometry, type LensOptions} from '../scene';
import {buildAtlas, type CurveAtlas, type CurveSpec} from './curves';
import {bindLens, makeLineMaterial, makeSpriteMaterial} from './material';

export interface StreamLine {
  /** In-focus width in px at 1440p (scaled with the frame height). */
  width?: number;
  /** Radiance multiplier of the line colour (1 = the colour as displayed). */
  intensity?: number;
  color?: string;
  /** World-unit dash: [period, duty]. Omit for a solid line. */
  dash?: [number, number];
  bloom?: number;
}

/** One curve with its stream of packets and (optionally) the drawn line it runs along. */
export interface StreamCurve {
  curve: CurveSpec;
  /** Film seconds the stream starts drawing on, and stops (fades out over fadeS). */
  from?: number;
  to?: number;
  /** Seconds for the draw-on front to travel the whole curve. */
  drawOnS?: number;
  fadeS?: number;
  /** Packet speed, world units per second. */
  speed?: number;
  /** A packet every this many seconds. */
  every?: number;
  /** Packet length, world units. */
  packetLength?: number;
  /** Share of particles that trickle evenly between packets (0..1). */
  trickle?: number;
  /** Tube radius of the stream, world units. */
  radius?: number;
  /** Particles on this curve (default: density x length). */
  particles?: number;
  /** Radiance multiplier of the particle colour. */
  intensity?: number;
  color?: string;
  bloom?: number;
  /** Flow from the end to the start. */
  reverse?: boolean;
  /** The line under the stream; false draws particles only. */
  line?: StreamLine | false;
  /** Particles off: draw the line only. */
  lineOnly?: boolean;
}

export interface StreamsProps {
  curves: readonly StreamCurve[];
  /** Particles per world unit of curve when a curve does not say. */
  density?: number;
  /** Size of a particle (world radius) at the head of a packet. */
  size?: number;
  /** Samples per curve in the atlas. */
  samples?: number;
  /** Global opacity of the particles and lines. */
  opacity?: number | ((t: number) => number);
  lineOpacity?: number | ((t: number) => number);
  seed?: number;
  shutter?: number;
  timeOffset?: number;
  lens?: LensOptions['lens'];
  maxBlur?: number;
  look?: Look;
  renderOrder?: number;
}

const META_TEXELS = 6;

const PARTICLE_VERT = /* glsl */ `
attribute float aCurve;
attribute float aSlot;
uniform sampler2D uCurves;
uniform sampler2D uMeta;
uniform int uSamples;
uniform float uTime;
uniform float uShutterS;
uniform float uSize;
uniform float uOpacity;
uniform uint uSeed;

vec4 meta(int c, int k) { return texelFetch(uMeta, ivec2(k, c), 0); }

vec3 curveAt(int c, float s, out vec3 tan, out vec3 nrm) {
  float x = clamp(s, 0.0, 1.0) * float(uSamples - 1);
  int k = int(min(floor(x), float(uSamples - 2)));
  float f = x - float(k);
  vec4 a = texelFetch(uCurves, ivec2(k, 2 * c), 0);
  vec4 b = texelFetch(uCurves, ivec2(k + 1, 2 * c), 0);
  vec3 na = texelFetch(uCurves, ivec2(k, 2 * c + 1), 0).xyz;
  vec3 nb = texelFetch(uCurves, ivec2(k + 1, 2 * c + 1), 0).xyz;
  tan = normalize(b.xyz - a.xyz + 1e-7);
  nrm = normalize(mix(na, nb, f) + 1e-7);
  return mix(a.xyz, b.xyz, f);
}

// arc position (world units from the start) of this particle at time t
float arcAt(float t, vec4 m0, vec4 m2, float phase, float back) {
  float len = m0.z;
  float speed = m0.w;
  float period = len + m2.y + 0.0001;
  return mod(speed * t + phase * period, period) - back;
}

void main() {
  int c = int(aCurve + 0.5);
  uint id = uint(gl_InstanceID);
  vec4 h = fxHash4(id, uSeed, 13u, 29u);
  vec4 m0 = meta(c, 0);
  vec4 m1 = meta(c, 1);
  vec4 m2 = meta(c, 2);
  vec4 m3 = meta(c, 3);
  float len = m0.z;
  float t = uTime;
  bool trickle = h.x < m2.z;
  float q = trickle ? 0.0 : pow(h.y, 1.6);
  float back = q * m2.y;
  float period = len + m2.y;
  float nPackets = max(1.0, floor(period / max(1e-4, m0.w * m2.x) + 0.5));
  float phase;
  if (trickle) {
    phase = h.z;
  } else {
    float j = floor(aSlot * nPackets);
    phase = (j + 0.06 * (fxHash1(uint(c), uint(j)) - 0.5)) / nPackets;
  }
  float aC = arcAt(t, m0, m2, phase, back);
  float aA = aC - m0.w * 0.5 * uShutterS;
  float aB = aC + m0.w * 0.5 * uShutterS;
  float sC = aC / len;
  float vis = step(0.0, sC) * step(sC, 1.0);
  // draw-on front and fade-out
  float front = m1.x > 0.0 ? clamp((t - m0.x) / m1.x, 0.0, 1.0) : step(m0.x, t);
  float drawn = (1.0 - smoothstep(front - 0.02, front + 0.002, sC)) * step(m0.x, t);
  float fadeOut = 1.0 - clamp((t - m0.y) / max(m1.y, 1e-3), 0.0, 1.0);
  float ends = smoothstep(0.0, 0.035, sC) * (1.0 - smoothstep(0.965, 1.0, sC));
  float dirSign = m2.w;
  float sA = clamp(aA / len, 0.0, 1.0);
  float sB = clamp(aB / len, 0.0, 1.0);
  if (dirSign < 0.0) { sA = 1.0 - sA; sB = 1.0 - sB; }
  vec3 tanA, nA, tanB, nB;
  vec3 pA = curveAt(c, sA, tanA, nA);
  vec3 pB = curveAt(c, sB, tanB, nB);
  // cross-section: a stable offset in the curve's frame, wider towards the tail of a packet
  float ang = 6.2831853 * h.w;
  float rad = m1.z * sqrt(fract(h.z * 7.13 + h.w)) * (trickle ? 1.0 : (0.35 + 0.9 * q));
  vec3 bA = cross(tanA, nA);
  vec3 bB = cross(tanB, nB);
  pA += (nA * cos(ang) + bA * sin(ang)) * rad;
  pB += (nB * cos(ang) + bB * sin(ang)) * rad;
  float head = trickle ? 0.22 : mix(1.0, 0.12, q);
  float b = m1.w * head * vis * drawn * fadeOut * ends * uOpacity;
  float size = uSize * (trickle ? 0.55 : mix(1.0, 0.5, q));
  fxSprite(pA, pB, size, vec4(m3.rgb * b, m3.a * b), 0.0, 0.0);
}`;

const LINE_VERT = /* glsl */ `
uniform sampler2D uCurves;
uniform sampler2D uMeta;
uniform int uSamples;
uniform float uTime;
uniform float uOpacity;

vec4 meta(int c, int k) { return texelFetch(uMeta, ivec2(k, c), 0); }

void main() {
  int segs = uSamples - 1;
  int id = gl_InstanceID;
  int c = id / segs;
  int k = id - c * segs;
  vec4 m0 = meta(c, 0);
  vec4 m1 = meta(c, 1);
  vec4 m4 = meta(c, 4);
  vec4 m5 = meta(c, 5);
  vec4 a = texelFetch(uCurves, ivec2(k, 2 * c), 0);
  vec4 b = texelFetch(uCurves, ivec2(k + 1, 2 * c), 0);
  float t = uTime;
  float s0 = float(k) / float(segs);
  float s1 = float(k + 1) / float(segs);
  float front = m1.x > 0.0 ? clamp((t - m0.x) / m1.x, 0.0, 1.0) : step(m0.x, t);
  float cut = clamp((front - s0) / (s1 - s0), 0.0, 1.0) * step(m0.x, t);
  float fadeOut = 1.0 - clamp((t - m0.y) / max(m1.y, 1e-3), 0.0, 1.0);
  float alpha = m4.y * fadeOut * uOpacity;
  fxLine(a.xyz, b.xyz, m4.x * uViewport.y / 1440.0, vec4(m5.rgb * alpha, m5.a * alpha), cut, a.w, b.w, m4.zw);
}`;

interface Built {
  atlas: CurveAtlas;
  meta: THREE.DataTexture;
  metaData: Float32Array;
  curveOf: Float32Array;
  slotOf: Float32Array;
  particles: number;
  lines: boolean;
}

const _c = new THREE.Color();

const build = (curves: readonly StreamCurve[], samples: number, density: number, look: Look): Built => {
  const atlas = buildAtlas(
    curves.map((c) => c.curve),
    samples,
  );
  const n = Math.max(1, curves.length);
  const metaData = new Float32Array(META_TEXELS * n * 4);
  const counts: number[] = [];
  let lines = false;
  curves.forEach((c, i) => {
    const len = atlas.curves[i].length;
    const o = i * META_TEXELS * 4;
    const speed = c.speed ?? 0.35;
    metaData.set([c.from ?? 0, c.to ?? 1e9, Math.max(1e-4, len), speed], o);
    metaData.set([c.drawOnS ?? 0.8, c.fadeS ?? 0.5, c.radius ?? 0.004, c.lineOnly ? 0 : (c.intensity ?? 1)], o + 4);
    metaData.set([c.every ?? 0.9, c.packetLength ?? 0.12, c.trickle ?? 0.25, c.reverse ? -1 : 1], o + 8);
    sceneColor(c.color ?? FX_PALETTE.mint, 1, look, _c);
    metaData.set([_c.r, _c.g, _c.b, c.bloom ?? 0.7], o + 12);
    const line = c.line === false ? null : c.line ?? {};
    if (line) lines = true;
    const lw = line ? line.width ?? 1.2 : 0;
    const dash = line?.dash ?? [0, 0.5];
    metaData.set([lw, line ? line.intensity ?? 0.5 : 0, dash[0], dash[1]], o + 16);
    sceneColor(line?.color ?? FX_PALETTE.steel, 1, look, _c);
    metaData.set([_c.r, _c.g, _c.b, line?.bloom ?? 0], o + 20);
    counts.push(c.lineOnly ? 0 : c.particles ?? Math.round(len * density));
  });
  const particles = counts.reduce((a, b) => a + b, 0);
  const curveOf = new Float32Array(Math.max(1, particles));
  const slotOf = new Float32Array(Math.max(1, particles));
  let p = 0;
  counts.forEach((k, ci) => {
    for (let j = 0; j < k; j++) {
      curveOf[p] = ci;
      // golden-ratio slots spread a curve's particles evenly over its packets
      slotOf[p] = (j * 0.6180339887498949) % 1;
      p++;
    }
  });
  const meta = new THREE.DataTexture(metaData, META_TEXELS, n, THREE.RGBAFormat, THREE.FloatType);
  meta.minFilter = THREE.NearestFilter;
  meta.magFilter = THREE.NearestFilter;
  meta.needsUpdate = true;
  return {atlas, meta, metaData, curveOf, slotOf, particles, lines};
};

/**
 * Data streams: packets of mint particles flowing along curves (pipelines between modules, links
 * between repositories), with the anti-aliased line they run along. One atlas texture holds every
 * curve; particles and lines are one draw call each, and every position is closed-form in time.
 */
export const Streams: React.FC<StreamsProps> = ({
  curves,
  density = 260,
  size = 0.0016,
  samples = 96,
  opacity = 1,
  lineOpacity = 1,
  seed = 11,
  shutter = 0.5,
  timeOffset = 0,
  lens,
  maxBlur,
  look = REEL_GRADE,
  renderOrder = 11,
}) => {
  const t = useFxTime(timeOffset);
  const {fps} = useVideoConfig();
  const built = useMemo(() => build(curves, samples, density, look), [curves, samples, density, look]);

  const pGeo = useQuadGeometry(built.particles);
  // per-particle curve and slot (set during render so the first captured frame has them)
  if (pGeo.getAttribute('aCurve')?.array !== built.curveOf) {
    pGeo.setAttribute('aCurve', new THREE.InstancedBufferAttribute(built.curveOf, 1));
    pGeo.setAttribute('aSlot', new THREE.InstancedBufferAttribute(built.slotOf, 1));
  }
  const lGeo = useQuadGeometry(built.lines ? curves.length * (samples - 1) : 0);

  const pfx = useMemo(
    () =>
      makeSpriteMaterial({
        vertexMain: PARTICLE_VERT,
        uniforms: {
          uCurves: {value: null as THREE.Texture | null},
          uMeta: {value: null as THREE.Texture | null},
          uSamples: {value: 2},
          uTime: {value: 0},
          uShutterS: {value: 0},
          uSize: {value: 0.001},
          uOpacity: {value: 1},
          uSeed: {value: 0},
        },
      }),
    [],
  );
  const lfx = useMemo(
    () =>
      makeLineMaterial({
        vertexMain: LINE_VERT,
        uniforms: {
          uCurves: {value: null as THREE.Texture | null},
          uMeta: {value: null as THREE.Texture | null},
          uSamples: {value: 2},
          uTime: {value: 0},
          uOpacity: {value: 1},
        },
      }),
    [],
  );
  const meshes = useMemo(() => {
    const p = new THREE.Mesh(pGeo, pfx.material);
    const l = new THREE.Mesh(lGeo, lfx.material);
    p.frustumCulled = false;
    l.frustumCulled = false;
    return {p, l};
  }, [pGeo, lGeo, pfx, lfx]);
  meshes.p.renderOrder = renderOrder + 1;
  meshes.l.renderOrder = renderOrder;
  const lensOpts = useMemo(() => ({lens, maxBlur}), [lens, maxBlur]);
  useLayoutEffect(() => {
    bindLens(meshes.p, pfx.uniforms, () => lensOpts);
    bindLens(meshes.l, lfx.uniforms, () => lensOpts);
  }, [meshes, pfx, lfx, lensOpts]);

  const pu = pfx.uniforms;
  pu.uCurves.value = built.atlas.texture;
  pu.uMeta.value = built.meta;
  pu.uSamples.value = built.atlas.samples;
  pu.uTime.value = t;
  pu.uShutterS.value = shutter / fps;
  pu.uSize.value = size;
  pu.uOpacity.value = typeof opacity === 'function' ? opacity(t) : opacity;
  pu.uSeed.value = seed >>> 0;
  const lu = lfx.uniforms;
  lu.uCurves.value = built.atlas.texture;
  lu.uMeta.value = built.meta;
  lu.uSamples.value = built.atlas.samples;
  lu.uTime.value = t;
  lu.uOpacity.value = typeof lineOpacity === 'function' ? lineOpacity(t) : lineOpacity;

  useLayoutEffect(
    () => () => {
      built.atlas.texture.dispose();
      built.meta.dispose();
    },
    [built],
  );
  useLayoutEffect(
    () => () => {
      pfx.material.dispose();
      lfx.material.dispose();
    },
    [pfx, lfx],
  );
  return (
    <>
      {built.lines ? <primitive object={meshes.l} /> : null}
      {built.particles > 0 ? <primitive object={meshes.p} /> : null}
    </>
  );
};
