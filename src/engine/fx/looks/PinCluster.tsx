import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {color as tokens} from '../../tokens';
import {REEL_GRADE, sceneColor, type Look} from '../color';
import {useFxTime} from '../scene';
import {useOccluder} from './GodRays';

// A small set of steel pins for close-ups inside other fx (the literals inside the glass box): the
// wall's lathe profile (identity.md d.2), its steel (d.3) and its mint glow with the bloom mask in
// alpha. Heights and glow are functions of film time, written into the instance buffers each frame.

export type Vec3 = [number, number, number];

export interface ClusterPin {
  /** Base of the pin (its head sits at z = height), in the cluster's frame. */
  position: Vec3;
  /** Height above the base, world units, or a function of film time. */
  height: number | ((t: number) => number);
  /** Steel tint 0..1. */
  tint?: number;
  /** Mint glow 0..1 (lit literal), or a function of film time. */
  glow?: number | ((t: number) => number);
}

export interface PinClusterProps {
  pins: readonly ClusterPin[];
  /** Pin pitch (head diameter is 0.94 of it). */
  pitch: number;
  /** Shaft length behind the base. */
  reach?: number;
  radialSegments?: number;
  glowColor?: string;
  /** Emissive radiance of a fully lit pin: 1 shows the glow colour as itself through the grade. */
  glowIntensity?: number;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  /** Block the god-ray light. */
  occlude?: boolean;
  timeOffset?: number;
  position?: Vec3;
  rotation?: Vec3;
  look?: Look;
}

/** Lathe pin pointing at +Z, head top at z = 0.30 p (the reel's profile). */
export const pinLathe = (p: number, reach: number, segments = 16): THREE.BufferGeometry => {
  const rh = 0.47 * p;
  const hh = 0.3 * p;
  const rs = 0.15 * p;
  const pts = [
    new THREE.Vector2(0.0001, -reach),
    new THREE.Vector2(rs, -reach),
    new THREE.Vector2(rs, -0.08 * p),
    new THREE.Vector2(rh, 0),
    new THREE.Vector2(0.94 * rh, 0.42 * hh),
    new THREE.Vector2(0.6 * rh, 0.86 * hh),
    new THREE.Vector2(0.0001, hh),
  ];
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
};

/** Pin bases on a hex lattice of `cols` x `rows`, centred on the origin, in the XY plane. */
export const hexLattice = (cols: number, rows: number, pitch: number): Vec3[] => {
  const out: Vec3[] = [];
  const rowH = (pitch * Math.sqrt(3)) / 2;
  for (let r = 0; r < rows; r++) {
    const odd = r % 2 === 1;
    const n = odd ? cols - 1 : cols;
    for (let c = 0; c < n; c++) {
      const x = (c - (cols - 1) / 2 + (odd ? 0.5 : 0)) * pitch;
      const y = (r - (rows - 1) / 2) * rowH;
      out.push([x, y, 0]);
    }
  }
  return out;
};

const resolve = (v: number | ((t: number) => number) | undefined, t: number, d: number) => (v === undefined ? d : typeof v === 'function' ? v(t) : v);

export const PinCluster: React.FC<PinClusterProps> = ({
  pins,
  pitch,
  reach,
  radialSegments = 16,
  glowColor = tokens.accent.mint,
  glowIntensity = 1.6,
  metalness = 0.75,
  roughness = 0.32,
  envMapIntensity = 1.05,
  occlude = true,
  timeOffset = 0,
  position,
  rotation,
  look = REEL_GRADE,
}) => {
  const t = useFxTime(timeOffset);
  const N = pins.length;
  const reachW = reach ?? pitch * 2;
  const built = useMemo(() => {
    const geo = pinLathe(pitch, reachW, radialSegments);
    const aGlow = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, N)), 1);
    aGlow.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aGlow', aGlow);
    const glow = {value: sceneColor(glowColor, glowIntensity, look)};
    const mat = new THREE.MeshStandardMaterial({color: 0xffffff, metalness, roughness, envMapIntensity});
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGlowColor = glow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform vec3 uGlowColor;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow * uGlowColor;')
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = clamp(vGlow, 0.0, 1.0);');
    };
    mat.customProgramCacheKey = () => 'fx-pin-cluster-v1';
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, N));
    mesh.count = N;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, N) * 3), 3);
    mesh.instanceColor = colors;
    return {geo, mat, mesh, aGlow, glow};
  }, [N, pitch, reachW, radialSegments, glowColor, glowIntensity, metalness, roughness, envMapIntensity, look]);

  // write heights, tints and glow for this frame
  const m = built.mesh.instanceMatrix.array as Float32Array;
  const c = built.mesh.instanceColor!.array as Float32Array;
  const g = built.aGlow.array as Float32Array;
  for (let i = 0; i < N; i++) {
    const p = pins[i];
    const o = i * 16;
    m[o] = 1;
    m[o + 1] = 0;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = 1;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = 1;
    m[o + 11] = 0;
    m[o + 12] = p.position[0];
    m[o + 13] = p.position[1];
    m[o + 14] = p.position[2] + resolve(p.height, t, 0);
    m[o + 15] = 1;
    const tint = p.tint ?? 0.9;
    c[i * 3] = tint;
    c[i * 3 + 1] = tint * 1.003;
    c[i * 3 + 2] = tint * 1.006;
    g[i] = resolve(p.glow, t, 0);
  }
  built.mesh.instanceMatrix.needsUpdate = true;
  built.mesh.instanceColor!.needsUpdate = true;
  built.aGlow.needsUpdate = true;

  useOccluder(occlude ? built.mesh : null);
  useLayoutEffect(
    () => () => {
      built.geo.dispose();
      built.mat.dispose();
      built.mesh.dispose();
    },
    [built],
  );
  return (
    <group position={position} rotation={rotation}>
      <primitive object={built.mesh} />
    </group>
  );
};
