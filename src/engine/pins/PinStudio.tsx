import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {color} from '../tokens';
import {useSubframeSampler, type SubframeSampler} from '../camera/subframe';
import {easeFn, type EaseSpec} from '../camera/track';
import {poolUniforms} from './pool';
import {studioEnvironment, type StudioVariant} from './studio';

/**
 * A light cue, eased from the previous state over [at, at + dur].
 * - look: moves the key light like the site's pointer light; (0, 0) is the base upper-left key.
 * - key: overall light level (the reel brings the light up at the portrait reveal).
 * - pool: level at the pool centre; poolAt: pool centre on the wall (world x, y); spread: pool size.
 * - env: environment reflection strength.
 */
export interface LightKey {
  at: number;
  dur?: number;
  look?: [number, number];
  key?: number;
  pool?: number;
  poolAt?: [number, number];
  spread?: number;
  env?: number;
  ease?: EaseSpec;
}

export interface PinStudioProps {
  /** Soft shadows from the key light, for hero shots. */
  shadows?: boolean | {mapSize?: number; radius?: number};
  light?: readonly LightKey[];
  /** 'site' (default) is pins.js's studio; 'dark' is a dimmer room for scenes without the pool. */
  env?: StudioVariant;
  /** Key light at key = 1 (pins.js: 2.1). */
  keyIntensity?: number;
  /** Hemisphere fill (pins.js: 0.35). */
  hemi?: number;
  /** The light pool. sigma in world units (board width = 1); null lights the wall evenly. */
  pool?: {sigma?: number; tail?: number; floor?: number; gain?: number; aspect?: number} | null;
  /** Multiplier on the pool's level (1 = the reel). */
  poolIntensity?: number;
  background?: string;
  timeOffset?: number;
  /** Half-size of the shadow camera, world units (covers the film wall by default). */
  shadowBounds?: number;
}

/** The reel's pool (identity.md 2.1), fitted on the empty wall at 77 s. */
export const REEL_POOL = {sigma: 0.155, tail: 0.15, floor: 0.1, gain: 0.19, aspect: 1.0};

interface LightState {
  lx: number;
  ly: number;
  key: number;
  pool: number;
  env: number;
  px: number;
  py: number;
  spread: number;
}

const lightAt = (keys: readonly LightKey[], eases: Array<(t: number) => number>, t: number, s: LightState): LightState => {
  s.lx = 0;
  s.ly = 0;
  s.key = 1;
  s.pool = 1;
  s.env = 1;
  s.px = 0;
  s.py = 0;
  s.spread = 1;
  for (let k = 0; k < keys.length; k++) {
    const c = keys[k];
    if (t < c.at && k > 0) break;
    const dur = c.dur ?? 0;
    const e = k === 0 || dur <= 0 ? 1 : eases[k](Math.max(0, Math.min(1, (t - c.at) / dur)));
    if (c.look) {
      s.lx += (c.look[0] - s.lx) * e;
      s.ly += (c.look[1] - s.ly) * e;
    }
    if (c.poolAt) {
      s.px += (c.poolAt[0] - s.px) * e;
      s.py += (c.poolAt[1] - s.py) * e;
    }
    if (c.key !== undefined) s.key += (c.key - s.key) * e;
    if (c.pool !== undefined) s.pool += (c.pool - s.pool) * e;
    if (c.env !== undefined) s.env += (c.env - s.env) * e;
    if (c.spread !== undefined) s.spread += (c.spread - s.spread) * e;
  }
  return s;
};

/** Environment, key light, fill, light pool and background for the pin wall (identity.md d.3). */
export const PinStudio: React.FC<PinStudioProps> = ({
  shadows = false,
  light,
  env: variant = 'site',
  keyIntensity = 2.1,
  hemi = 0.35,
  pool: poolProp = REEL_POOL,
  poolIntensity = 1,
  background = color.wall.void,
  timeOffset = 0,
  shadowBounds = 0.7,
}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const env = useMemo(() => studioEnvironment(gl, variant), [gl, variant]);
  const shadowOpts = typeof shadows === 'object' ? shadows : {};
  const castShadows = !!shadows;
  const pool = useMemo(() => poolUniforms(scene), [scene]);
  const off = poolProp === null;
  const ps = poolProp ?? {};
  const poolBase = useMemo(
    () => (off ? {sigma: 1e3, tail: 0, floor: 1, gain: 1, aspect: 1} : {...REEL_POOL, ...ps}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [off, ps.sigma, ps.tail, ps.floor, ps.gain, ps.aspect],
  );

  const lights = useMemo(() => {
    // shadow maps must be configured before the first material compile
    gl.shadowMap.enabled = castShadows;
    gl.shadowMap.type = THREE.PCFShadowMap;
    const key = new THREE.DirectionalLight(0xffffff, keyIntensity);
    key.position.set(-0.55, 0.85, 1.4);
    key.castShadow = castShadows;
    if (castShadows) {
      const size = shadowOpts.mapSize ?? 2048;
      key.shadow.mapSize.set(size, size);
      key.shadow.bias = -0.0002;
      key.shadow.normalBias = 0.002;
      key.shadow.radius = shadowOpts.radius ?? 3;
      const sc = key.shadow.camera;
      sc.left = -shadowBounds;
      sc.right = shadowBounds;
      sc.top = shadowBounds;
      sc.bottom = -shadowBounds;
      sc.near = 0.1;
      sc.far = 4;
      sc.updateProjectionMatrix();
    }
    const fill = new THREE.HemisphereLight(0xf3f6f5, 0x2a302e, hemi);
    return {key, fill};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, castShadows, shadowOpts.mapSize, shadowOpts.radius, shadowBounds]);

  const sampler = useMemo<SubframeSampler>(() => {
    const keys = light ? [...light].sort((a, b) => a.at - b.at) : [];
    const eases = keys.map((k) => easeFn(k.ease ?? 'camera'));
    const st: LightState = {lx: 0, ly: 0, key: 1, pool: 1, env: 1, px: 0, py: 0, spread: 1};
    return {
      order: 1,
      apply(offS) {
        const t = frameRef.current / fps + timeOffset + offS;
        const s = lightAt(keys, eases, t, st);
        lights.key.position.set(-0.55 + 0.95 * s.lx, 0.85 - 0.75 * s.ly, 1.4);
        lights.key.intensity = keyIntensity;
        lights.fill.intensity = hemi;
        scene.environmentIntensity = s.env;
        pool.uPoolCenter.value.set(s.px, s.py);
        pool.uPoolSigma.value = poolBase.sigma * s.spread;
        pool.uPoolTail.value = poolBase.tail;
        pool.uPoolFloor.value = poolBase.floor;
        pool.uPoolGain.value = poolBase.gain * poolIntensity * s.pool * s.key;
        pool.uPoolAspect.value = poolBase.aspect;
      },
    };
  }, [light, lights, keyIntensity, hemi, scene, fps, timeOffset, pool, poolBase, poolIntensity]);
  useSubframeSampler(sampler);

  useLayoutEffect(() => {
    const prevEnv = scene.environment;
    const prevBg = scene.background;
    scene.environment = env;
    scene.background = new THREE.Color(background);
    scene.add(lights.key, lights.key.target, lights.fill);
    return () => {
      scene.remove(lights.key, lights.key.target, lights.fill);
      scene.environment = prevEnv;
      scene.background = prevBg;
    };
  }, [scene, env, lights, background]);

  useLayoutEffect(() => {
    sampler.apply(0);
  }, [frame, sampler]);

  useLayoutEffect(() => () => lights.key.shadow.dispose(), [lights]);
  return null;
};
