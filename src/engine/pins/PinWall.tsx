import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {useSubframeSampler, type SubframeSampler} from '../camera/subframe';
import type {Board} from './board';
import {compileEffects, liveSpeed} from './effects';
import {WallEvaluator} from './evaluator';
import {pinGeometry, type PinLod} from './geometry';
import {makePinMaterials, makePlateMaterial} from './material';
import {poolUniforms} from './pool';
import {compileWall, DEFAULT_RELIEF_PITCHES, MAX_H, STEEL} from './timeline';
import type {Beat, LiveLayer, Magnet, Press, Ripple} from './types';

export interface PinWallProps {
  board: Board;
  beats: readonly Beat[];
  /** World height of h = 1 (default 22 pitches, about the reel's portrait relief). */
  relief?: number;
  ripples?: readonly Ripple[];
  magnets?: readonly Magnet[];
  presses?: readonly Press[];
  live?: readonly LiveLayer[];
  /** 'wall' = 8 radial segments, 'closeup' = 16, 'macro' = 32; 'auto' picks by on-screen pin size. */
  lod?: PinLod | 'auto';
  /** Cast and receive the key light's shadows (enable them in PinStudio too). */
  shadows?: boolean;
  glowColor?: string;
  glowIntensity?: number;
  /** Cavity occlusion from the six neighbours (pins.js: 1.08 / pitch, floor 0.42). */
  ao?: boolean;
  plate?: boolean;
  plateColor?: string;
  metalness?: number;
  roughness?: number;
  envMapIntensity?: number;
  /** Seconds added to this component's frame time. */
  timeOffset?: number;
  position?: [number, number, number];
  /** Take part in PostFX motion blur (default true). */
  motionBlur?: boolean;
}

const COOL_G = 1.003;
const COOL_B = 1.006;
/** On-screen pitch (px at 1440p) above which 'auto' switches to the finer lathes. */
const AUTO_CLOSEUP_PX = 34;
const AUTO_MACRO_PX = 110;

interface Range {
  start: number;
  count: number;
}

const setRange = (attr: THREE.BufferAttribute, range: Range, start: number, count: number) => {
  attr.updateRanges.length = 0;
  range.start = start;
  range.count = count;
  attr.updateRanges.push(range);
  attr.needsUpdate = true;
};

/**
 * Writes the evaluated wall into the instance buffers: cavity AO, the cool steel bias, and only
 * the span of pins whose values changed (DynamicDrawUsage + one update range per attribute).
 */
class WallWriter {
  private readonly rc: Range = {start: 0, count: 0};
  private readonly rp: Range = {start: 0, count: 0};
  constructor(
    private readonly board: Board,
    private readonly colorAttr: THREE.InstancedBufferAttribute,
    private readonly pinAttr: THREE.InstancedBufferAttribute,
    private readonly ao: boolean,
  ) {}

  write(ev: WallEvaluator) {
    const {N, nb, nbCount, p} = this.board;
    const {h, rgb, glow, paint} = ev;
    const ca = this.colorAttr.array as Float32Array;
    const pa = this.pinAttr.array as Float32Array;
    const occK = 1.08 / p;
    const floor = 0.42;
    const ao = this.ao;
    let cLo = N;
    let cHi = -1;
    let pLo = N;
    let pHi = -1;
    for (let i = 0; i < N; i++) {
      const hi = h[i];
      let occ = 1;
      if (ao) {
        const n = nbCount[i];
        if (n) {
          let s = 0;
          const o = i * 6;
          for (let q = 0; q < n; q++) s += h[nb[o + q]];
          const cav = s / n - hi;
          if (cav > 0) {
            occ = 1 - cav * occK;
            if (occ < floor) occ = floor;
          }
        }
      }
      const j = i * 3;
      const r = Math.fround(rgb[j] * occ);
      const g = Math.fround(rgb[j + 1] * occ * COOL_G);
      const b = Math.fround(rgb[j + 2] * occ * COOL_B);
      if (ca[j] !== r || ca[j + 1] !== g || ca[j + 2] !== b) {
        ca[j] = r;
        ca[j + 1] = g;
        ca[j + 2] = b;
        if (i < cLo) cLo = i;
        cHi = i;
      }
      const hh = Math.fround(hi);
      const gg = Math.fround(glow[i]);
      const pp = Math.fround(paint[i]);
      if (pa[j] !== hh || pa[j + 1] !== gg || pa[j + 2] !== pp) {
        pa[j] = hh;
        pa[j + 1] = gg;
        pa[j + 2] = pp;
        if (i < pLo) pLo = i;
        pHi = i;
      }
    }
    if (cHi >= 0) setRange(this.colorAttr, this.rc, cLo * 3, (cHi - cLo + 1) * 3);
    if (pHi >= 0) setRange(this.pinAttr, this.rp, pLo * 3, (pHi - pLo + 1) * 3);
  }
}

const shareGeometry = (base: THREE.BufferGeometry, aPin: THREE.InstancedBufferAttribute) => {
  const g = new THREE.BufferGeometry();
  g.setIndex(base.getIndex());
  for (const name of Object.keys(base.attributes)) g.setAttribute(name, base.getAttribute(name));
  g.setAttribute('aPin', aPin);
  g.boundingSphere = base.boundingSphere;
  return g;
};

/**
 * The pin wall. Every frame is a pure function of time: beats spring in closed form, effects are
 * analytic, and only changed instance data is uploaded. Registers with PostFX's sub-frame motion
 * blur.
 */
export const PinWall: React.FC<PinWallProps> = ({
  board,
  beats,
  relief: reliefProp,
  ripples,
  magnets,
  presses,
  live,
  lod = 'wall',
  shadows = false,
  glowColor,
  glowIntensity,
  ao = true,
  plate = true,
  plateColor,
  metalness,
  roughness,
  envMapIntensity,
  timeOffset = 0,
  position,
  motionBlur = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const relief = reliefProp ?? DEFAULT_RELIEF_PITCHES * board.p;

  const timeline = useMemo(() => compileWall(board, beats, relief), [board, beats, relief]);
  const fx = useMemo(() => compileEffects(board, {ripples, presses, magnets, live}), [board, ripples, presses, magnets, live]);
  const evaluator = useMemo(() => new WallEvaluator(timeline, fx), [timeline, fx]);
  const reach = MAX_H * relief + 4 * board.p;
  const scene = useThree((s) => s.scene);
  const pool = useMemo(() => poolUniforms(scene), [scene]);
  const mats = useMemo(
    () => makePinMaterials({glowColor, glowIntensity, metalness, roughness, envMapIntensity, pitch: board.p, reach, pool}),
    [glowColor, glowIntensity, metalness, roughness, envMapIntensity, board.p, reach, pool],
  );

  const built = useMemo(() => {
    const N = board.N;
    const aPin = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    aPin.setUsage(THREE.DynamicDrawUsage);
    const geoWall = shareGeometry(pinGeometry(board.p, reach, 'wall'), aPin);
    const geoClose = shareGeometry(pinGeometry(board.p, reach, 'closeup'), aPin);
    const geoMacro = shareGeometry(pinGeometry(board.p, reach, 'macro'), aPin);
    const mesh = new THREE.InstancedMesh(lod === 'closeup' ? geoClose : lod === 'macro' ? geoMacro : geoWall, mats.material, N);
    mesh.frustumCulled = false;
    // positions never change: the matrices are uploaded once
    const m = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < N; i++) {
      const o = i * 16;
      m[o] = 1;
      m[o + 5] = 1;
      m[o + 10] = 1;
      m[o + 15] = 1;
      m[o + 12] = board.x[i];
      m[o + 13] = board.y[i];
    }
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(N * 3).fill(STEEL), 3);
    colorAttr.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = colorAttr;
    mesh.customDepthMaterial = mats.depth;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.renderOrder = 0;
    const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(1 + 6 * board.p, board.extH + 6 * board.p), makePlateMaterial(pool, plateColor));
    plateMesh.position.z = -0.012 * board.p;
    plateMesh.receiveShadow = shadows;
    // pins draw first so the plate's hidden fragments fail the depth test early
    plateMesh.renderOrder = 1;
    const writer = new WallWriter(board, colorAttr, aPin, ao);
    return {mesh, plateMesh, writer, geoWall, geoClose, geoMacro};
  }, [board, reach, mats, lod, shadows, plateColor, ao, pool]);

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const sampler = useMemo<SubframeSampler>(() => {
    let lastT = NaN;
    let written = false;
    const scratchA = new Float32Array(board.N);
    const scratchB = new Float32Array(board.N);
    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const view = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const local = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    const timeOf = (off: number) => frameRef.current / fps + timeOffset + off;
    const pickLod = () => {
      if (lod !== 'auto') return;
      // on-screen pitch where the view ray meets the wall decides the lathe resolution
      built.mesh.updateWorldMatrix(true, false);
      local.copy(camera.position);
      built.mesh.worldToLocal(local);
      camera.getWorldDirection(fwd);
      fwd.transformDirection(inv.copy(built.mesh.matrixWorld).invert());
      const along = fwd.z < -1e-6 ? -local.z / fwd.z : local.length();
      const dist = Math.max(1e-4, along);
      const px = (board.p / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))) * 1440;
      built.mesh.geometry = px > AUTO_MACRO_PX ? built.geoMacro : px > AUTO_CLOSEUP_PX ? built.geoClose : built.geoWall;
    };
    return {
      order: 2,
      apply(off) {
        const t = timeOf(off);
        pickLod();
        if (t === lastT) return;
        lastT = t;
        // a still wall evaluates to the arrays it already holds; fresh buffers still need them once
        if (evaluator.evaluate(t) || !written) {
          built.writer.write(evaluator);
          written = true;
        }
      },
      motionPx(a, b, ctx) {
        const t0 = timeOf(a);
        const t1 = timeOf(b);
        let px = 0;
        const ls = liveSpeed(fx, timeOf(0));
        if (!evaluator.isStill(t0, t1)) {
          evaluator.evaluateHeights(t0, scratchA);
          evaluator.evaluateHeights(t1, scratchB);
          let best = -1;
          let dmax = 0;
          for (let i = 0; i < scratchA.length; i++) {
            const d = Math.abs(scratchA[i] - scratchB[i]);
            if (d > dmax) {
              dmax = d;
              best = i;
            }
          }
          if (best >= 0) {
            const w = built.mesh.matrixWorld;
            va.set(board.x[best], board.y[best], scratchA[best]).applyMatrix4(w);
            vb.set(board.x[best], board.y[best], scratchB[best]).applyMatrix4(w);
            // depth of the pin, for the size and shading change that parallax does not show
            view.copy(va).applyMatrix4(ctx.camera.matrixWorldInverse);
            const depth = Math.max(1e-4, -view.z);
            const fov = (ctx.camera as THREE.PerspectiveCamera).fov ?? 18;
            const pxPerWorld = ctx.heightPx / (2 * depth * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
            va.project(ctx.camera);
            vb.project(ctx.camera);
            const parallax = Math.hypot(((va.x - vb.x) / 2) * ctx.widthPx, ((va.y - vb.y) / 2) * ctx.heightPx);
            px = Math.max(parallax, dmax * pxPerWorld * 0.15);
          }
        }
        if (ls > 0) {
          const dist = camera.position.length();
          const pxPerWorld = ctx.heightPx / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
          px = Math.max(px, ls * relief * Math.abs(b - a) * pxPerWorld * 0.3);
        }
        return px;
      },
    };
  }, [board, evaluator, fx, built, fps, timeOffset, lod, camera, relief]);

  useSubframeSampler(motionBlur ? sampler : null);
  useLayoutEffect(() => {
    sampler.apply(0);
  }, [frame, sampler]);

  useLayoutEffect(
    () => () => {
      built.geoWall.dispose();
      built.geoClose.dispose();
      built.geoMacro.dispose();
      built.plateMesh.geometry.dispose();
      (built.plateMesh.material as THREE.Material).dispose();
      built.mesh.dispose();
    },
    [built],
  );
  useLayoutEffect(
    () => () => {
      mats.material.dispose();
      mats.depth.dispose();
    },
    [mats],
  );

  return (
    <group position={position}>
      <primitive object={built.mesh} />
      <primitive object={built.plateMesh} />
    </group>
  );
};
