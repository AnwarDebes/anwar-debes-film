import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {FX_PALETTE, REEL_GRADE, sceneColor, type Look} from '../color';
import {bindLens, makeSpriteMaterial} from '../particles/material';
import {Streams, type StreamCurve} from '../particles/Streams';
import {useFxTime, useQuadGeometry, type LensOptions} from '../scene';
import {constellationLayout, type ConstellationLayout, type LayoutNode} from './layout';
import type {LinkKind} from './links';

export interface ConstellationReveal {
  /** Film seconds the earliest repo ignites, and the latest. Nodes ignite in creation order. */
  from: number;
  to: number;
  /** Seconds a link takes to draw once both ends are lit. */
  linkDrawS?: number;
}

export interface ConstellationProps {
  layout?: ConstellationLayout;
  reveal?: ConstellationReveal;
  /** Mint highlight per repo, 0..1, as a function of film time. */
  highlight?: (id: string, t: number) => number;
  /** Overall brightness, or a function of film time. */
  opacity?: number | ((t: number) => number);
  /** Brightness of the lane strands, the links and the time axis. */
  lanes?: number;
  links?: number;
  spine?: number;
  /** Packets along the links that share code or data. */
  streams?: boolean;
  /** More curves drawn with the constellation's streams (e.g. into the glass box). */
  extraStreams?: readonly StreamCurve[];
  /** Node brightness at intensity 1 (display colour). */
  nodeIntensity?: number;
  /** Smallest drawn node radius in px at 1440p: far nodes stay visible stars in wide shots. */
  minNodeRadius?: number;
  timeOffset?: number;
  lens?: LensOptions['lens'];
  maxBlur?: number;
  look?: Look;
}

const NODE_VERT = /* glsl */ `
uniform sampler2D uNodes;
uniform vec3 uSteel;
uniform vec3 uWhite;
uniform vec3 uMint;
uniform float uBloom;
uniform float uOpacity;
void main() {
  int i = gl_InstanceID;
  vec4 a = texelFetch(uNodes, ivec2(0, i), 0);
  vec4 b = texelFetch(uNodes, ivec2(1, i), 0);
  vec3 base = mix(uSteel, uWhite, 0.55 + 0.45 * b.w);
  vec3 col = mix(base, uMint, b.y) * b.x * uOpacity;
  fxSprite(a.xyz, a.xyz, a.w, vec4(col, uBloom * b.x * uOpacity * (0.35 + 0.65 * b.y)), 0.9, b.z);
}`;

/** Ignition time of a node for a reveal. */
export const nodeRevealAt = (layout: ConstellationLayout, node: LayoutNode, r: ConstellationReveal | undefined): number => {
  if (!r) return -Infinity;
  const xs = layout.nodes.map((n) => n.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  return r.from + ((node.x - x0) / Math.max(1e-6, x1 - x0)) * (r.to - r.from);
};

/** 0..1 brightness of a node at time t with the ignition flash (1 = settled). */
export const ignition = (t: number, at: number): number => {
  if (t < at) return 0;
  const k = Math.min(1, (t - at) / 0.22);
  const flash = 1.6 * Math.exp(-(t - at) / 0.18);
  return k * k * (3 - 2 * k) + flash * k;
};

const LINK_LOOK: Record<LinkKind, {dash?: [number, number]; width: number; intensity: number; stream: boolean}> = {
  data: {width: 1.5, intensity: 0.55, stream: true},
  code: {width: 1.5, intensity: 0.55, stream: true},
  lineage: {width: 1.2, intensity: 0.38, stream: false},
  project: {dash: [0.012, 0.32], width: 1.4, intensity: 0.5, stream: false},
  unused: {dash: [0.03, 0.55], width: 1.2, intensity: 0.4, stream: false},
  claim: {dash: [0.03, 0.55], width: 1.2, intensity: 0.4, stream: false},
};

/**
 * All 66 repositories as glowing nodes: lanes per chapter, time along X, links only where code or
 * data is shared, and packets running along those links. Steel, white and mint only.
 */
export const Constellation: React.FC<ConstellationProps> = ({
  layout: layoutProp,
  reveal,
  highlight,
  opacity = 1,
  lanes = 0.3,
  links = 0.75,
  spine = 0.35,
  streams = true,
  extraStreams,
  nodeIntensity = 1.35,
  minNodeRadius = 2.4,
  timeOffset = 0,
  lens,
  maxBlur,
  look = REEL_GRADE,
}) => {
  const t = useFxTime(timeOffset);
  const layout = useMemo(() => layoutProp ?? constellationLayout(), [layoutProp]);
  const N = layout.nodes.length;
  const revealAt = useMemo(() => layout.nodes.map((n) => nodeRevealAt(layout, n, reveal)), [layout, reveal]);

  // node data: (position, radius), (brightness, mint, ring, white)
  const nodeTex = useMemo(() => {
    const data = new Float32Array(2 * N * 4);
    const tex = new THREE.DataTexture(data, 2, N, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return {tex, data};
  }, [N]);
  const op = typeof opacity === 'function' ? opacity(t) : opacity;
  {
    const d = nodeTex.data;
    for (let i = 0; i < N; i++) {
      const n = layout.nodes[i];
      const o = i * 8;
      d[o] = n.position[0];
      d[o + 1] = n.position[1];
      d[o + 2] = n.position[2];
      d[o + 3] = n.radius;
      const ig = ignition(t, revealAt[i]);
      const tw = 0.92 + 0.08 * Math.sin(t * (1.3 + (i % 7) * 0.21) + i * 2.4);
      const empty = n.repo.empty ? 0.55 : 1;
      d[o + 4] = ig * (0.45 + 0.55 * n.weight) * tw * empty;
      d[o + 5] = highlight ? Math.min(1, Math.max(0, highlight(n.repo.id, t))) : 0;
      d[o + 6] = n.repo.tier === 'deep' ? 0.32 * Math.min(1, ig) : 0;
      d[o + 7] = n.weight;
    }
    nodeTex.tex.needsUpdate = true;
  }

  const geo = useQuadGeometry(N);
  const fx = useMemo(
    () =>
      makeSpriteMaterial({
        vertexMain: NODE_VERT,
        uniforms: {
          uNodes: {value: null as THREE.Texture | null},
          uSteel: {value: new THREE.Color()},
          uWhite: {value: new THREE.Color()},
          uMint: {value: new THREE.Color()},
          uBloom: {value: 0.9},
          uOpacity: {value: 1},
        },
        extent: 7,
        haloScale: 4.2,
        ringRadius: 2.8,
        ringWidthPx: 1.1,
        // nodes are stars: far ones stay visible points instead of fading with their size
        energyExp: 0.4,
      }),
    [],
  );
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(geo, fx.material);
    m.frustumCulled = false;
    m.renderOrder = 14;
    return m;
  }, [geo, fx]);
  const lensOpts = useMemo(() => ({lens, maxBlur, minRadius: minNodeRadius}), [lens, maxBlur, minNodeRadius]);
  useLayoutEffect(() => bindLens(mesh, fx.uniforms, () => lensOpts), [mesh, fx, lensOpts]);
  const u = fx.uniforms;
  u.uNodes.value = nodeTex.tex;
  sceneColor(FX_PALETTE.steelLight, nodeIntensity, look, u.uSteel.value);
  sceneColor(FX_PALETTE.white, nodeIntensity * 1.25, look, u.uWhite.value);
  sceneColor(FX_PALETTE.mint, nodeIntensity * 1.6, look, u.uMint.value);
  u.uOpacity.value = op;

  // lanes, the time axis and the links, with their streams, in one Streams instance
  const curves = useMemo<StreamCurve[]>(() => {
    const out: StreamCurve[] = [];
    const span = reveal ? reveal.to - reveal.from : 0;
    layout.lanes.forEach((lane, li) => {
      const first = layout.nodes.filter((n) => n.lane === li).map((n) => revealAt[n.index]);
      const from = reveal ? Math.min(...first) : 0;
      out.push({
        curve: {kind: 'catmull', points: lane.points},
        from,
        drawOnS: reveal ? Math.max(0.4, span * 0.9) : 0,
        lineOnly: true,
        line: {width: 1.1, intensity: lanes, color: FX_PALETTE.steel},
      });
      if (lane.pre.length > 1) {
        out.push({
          curve: {kind: 'catmull', points: lane.pre},
          from: reveal ? reveal.from : 0,
          drawOnS: reveal ? Math.max(0.2, from - reveal.from) : 0,
          lineOnly: true,
          line: {width: 1.0, intensity: lanes * 0.4, color: FX_PALETTE.steel, dash: [0.018, 0.4]},
        });
      }
    });
    out.push({
      curve: {kind: 'line', from: layout.spine.from, to: layout.spine.to},
      from: reveal ? reveal.from : 0,
      drawOnS: span || 0,
      lineOnly: true,
      line: {width: 1.1, intensity: spine, color: FX_PALETTE.steel},
    });
    for (const l of layout.links) {
      const look2 = LINK_LOOK[l.link.kind];
      const from = reveal ? Math.max(revealAt[l.from.index], revealAt[l.to.index]) + 0.15 : 0;
      out.push({
        curve: l.curve,
        from,
        drawOnS: reveal?.linkDrawS ?? 0.7,
        speed: 0.42,
        every: 0.55,
        packetLength: 0.09,
        trickle: 0.2,
        radius: 0.0035,
        intensity: 2.2,
        bloom: 0.8,
        lineOnly: !(streams && look2.stream),
        line: {width: look2.width, intensity: look2.intensity * links, dash: look2.dash, color: FX_PALETTE.steelLight},
      });
    }
    if (extraStreams) out.push(...extraStreams);
    return out;
  }, [layout, reveal, revealAt, lanes, links, spine, streams, extraStreams]);

  useLayoutEffect(() => () => nodeTex.tex.dispose(), [nodeTex]);
  useLayoutEffect(() => () => fx.material.dispose(), [fx]);
  return (
    <>
      <Streams curves={curves} density={420} size={0.0011} opacity={op} lineOpacity={op} timeOffset={timeOffset} lens={lens} maxBlur={maxBlur} look={look} />
      <primitive object={mesh} />
    </>
  );
};
