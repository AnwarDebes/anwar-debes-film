import * as THREE from 'three';
import {color as tokens} from '../tokens';

// Palette discipline for light: the fx draw linear HDR radiance that PostFX tone-maps. To make a
// token colour land on screen as itself (mint #74C9AE stays #74C9AE, not a washed ACES pastel),
// the tone curve is inverted once per colour. Above intensity 1 a colour runs hot towards white,
// the way lit pins bloom.

export type ToneMapName = 'agx' | 'aces' | 'neutral' | 'linear';

export interface Look {
  toneMapping: ToneMapName;
  exposure: number;
}

/** PostFX's REEL_LOOK grade (ACES at 0.92). */
export const REEL_GRADE: Look = {toneMapping: 'aces', exposure: 0.92};

type V3 = [number, number, number];

const mul = (m: number[], v: V3): V3 => [
  // column-major, as GLSL mat3(c0, c1, c2)
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];
const sat = (x: number) => Math.min(1, Math.max(0, x));

const ACES_IN = [0.59719, 0.076, 0.0284, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777];
const ACES_OUT = [1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602];
const rrt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);

const REC2020_TO_SRGB = [1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187];
const SRGB_TO_REC2020 = [0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.088, 0.0433, 0.0113, 0.8956];
const AGX_INSET = [0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859];
const AGX_OUTSET = [1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405];
const AGX_MIN = -12.47393;
const AGX_MAX = 4.026069;
const agxCurve = (x: number) => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
};

/** JS ports of three's tone mapping functions (tonemapping_pars_fragment, r186). */
export const toneMap = (look: Look, c: V3): V3 => {
  const e = look.exposure;
  switch (look.toneMapping) {
    case 'linear':
      return [sat(c[0] * e), sat(c[1] * e), sat(c[2] * e)];
    case 'aces': {
      const k = e / 0.6;
      const v = mul(ACES_IN, [c[0] * k, c[1] * k, c[2] * k]);
      const o = mul(ACES_OUT, [rrt(v[0]), rrt(v[1]), rrt(v[2])]);
      return [sat(o[0]), sat(o[1]), sat(o[2])];
    }
    case 'agx': {
      let v = mul(AGX_INSET, mul(SRGB_TO_REC2020, [c[0] * e, c[1] * e, c[2] * e]));
      v = v.map((x) => agxCurve(sat((Math.log2(Math.max(x, 1e-10)) - AGX_MIN) / (AGX_MAX - AGX_MIN)))) as V3;
      v = mul(AGX_OUTSET, v);
      v = v.map((x) => Math.pow(Math.max(0, x), 2.2)) as V3;
      const o = mul(REC2020_TO_SRGB, v);
      return [sat(o[0]), sat(o[1]), sat(o[2])];
    }
    case 'neutral': {
      let r = c[0] * e;
      let g = c[1] * e;
      let b = c[2] * e;
      const x = Math.min(r, g, b);
      const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
      r -= off;
      g -= off;
      b -= off;
      const peak = Math.max(r, g, b);
      const start = 0.76;
      if (peak < start) return [r, g, b];
      const d = 1 - start;
      const np = 1 - (d * d) / (peak + d - start);
      const s = np / peak;
      r *= s;
      g *= s;
      b *= s;
      const k = 1 - 1 / (0.15 * (peak - np) + 1);
      return [r + (np - r) * k, g + (np - g) * k, b + (np - b) * k];
    }
  }
};

const cache = new Map<string, V3>();

/**
 * Linear scene radiance that the grade shows as `target` (display-linear sRGB, 0..1). Newton
 * steps on the full 3-channel curve, so the matrix cross-talk of ACES and AgX is accounted for.
 */
export const invertToneMap = (look: Look, target: V3): V3 => {
  const key = `${look.toneMapping}|${look.exposure}|${target.join(',')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const goal = target.map((x) => Math.min(0.985, Math.max(1e-5, x))) as V3;
  let x: V3 = [goal[0], goal[1], goal[2]];
  for (let it = 0; it < 40; it++) {
    const y = toneMap(look, x);
    const err: V3 = [y[0] - goal[0], y[1] - goal[1], y[2] - goal[2]];
    if (Math.abs(err[0]) + Math.abs(err[1]) + Math.abs(err[2]) < 1e-7) break;
    // Jacobian by forward differences
    const J: number[][] = [[], [], []];
    for (let j = 0; j < 3; j++) {
      const h = Math.max(1e-6, x[j] * 1e-4);
      const xp: V3 = [x[0], x[1], x[2]];
      xp[j] += h;
      const yp = toneMap(look, xp);
      for (let i = 0; i < 3; i++) J[i][j] = (yp[i] - y[i]) / h;
    }
    const dx = solve3(J, err);
    if (!dx) break;
    for (let j = 0; j < 3; j++) x[j] = Math.max(1e-7, x[j] - dx[j]);
  }
  cache.set(key, x);
  return x;
};

const solve3 = (A: number[][], b: V3): V3 | null => {
  const [a, bb, c] = A[0];
  const [d, e, f] = A[1];
  const [g, h, i] = A[2];
  const det = a * (e * i - f * h) - bb * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-14) return null;
  const inv = [
    (e * i - f * h) / det,
    (c * h - bb * i) / det,
    (bb * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (bb * g - a * h) / det,
    (a * e - bb * d) / det,
  ];
  return [inv[0] * b[0] + inv[1] * b[1] + inv[2] * b[2], inv[3] * b[0] + inv[4] * b[1] + inv[5] * b[2], inv[6] * b[0] + inv[7] * b[1] + inv[8] * b[2]];
};

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** A hex colour as display-linear sRGB. */
export const hexToLinear = (hex: string): V3 => {
  const c = new THREE.Color(hex);
  // THREE.Color stores linear values when ColorManagement is enabled (the default)
  return THREE.ColorManagement.enabled ? [c.r, c.g, c.b] : [srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)];
};

/**
 * Scene radiance for a token colour: at intensity 1 it displays as `hex` through `look`; higher
 * intensities scale the radiance (hotter, whiter, blooming).
 */
export const sceneColor = (hex: string, intensity = 1, look: Look = REEL_GRADE, out = new THREE.Color()): THREE.Color => {
  const x = invertToneMap(look, hexToLinear(hex));
  return out.setRGB(x[0] * intensity, x[1] * intensity, x[2] * intensity, THREE.LinearSRGBColorSpace);
};

/** The three colours the fx may use: steel, white and the one accent. */
export const FX_PALETTE = {
  steel: tokens.text.secondary,
  steelLight: tokens.wall.pinHighlight,
  white: tokens.text.display,
  mint: tokens.accent.mint,
  mintDeep: tokens.accent.mintDeep,
  void: tokens.wall.void,
  deep: tokens.wall.deep,
} as const;
