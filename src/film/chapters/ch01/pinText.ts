import masks from '../../../data/ch01/textmasks.json';
import type {Board, FieldFn, PinSample} from '../../../engine/pins';
import {placer} from '../../../engine/pins';

// Raised pin text from masks rendered ahead of time with the film's own fonts (the engine's
// textPixels recipe), so a text beat never depends on when the fonts finish loading in a tab.

interface MaskJson {
  text: string;
  w: number;
  h: number;
  aspect: number;
  inkFrac: number;
  data: string;
}

export type MaskKey = keyof typeof masks;

interface Mask {
  w: number;
  h: number;
  aspect: number;
  inkFrac: number;
  a: Uint8Array;
}

const decoded = new Map<string, Mask>();

const decode = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const maskOf = (key: MaskKey): Mask => {
  const hit = decoded.get(key);
  if (hit) return hit;
  const m = (masks as Record<string, MaskJson>)[key];
  const mask = {w: m.w, h: m.h, aspect: m.aspect, inkFrac: m.inkFrac, a: decode(m.data)};
  decoded.set(key, mask);
  return mask;
};

const sample = (m: Mask, s: number, t: number): number => {
  const x = Math.min(Math.max(s * (m.w - 1), 0), m.w - 1);
  const y = Math.min(Math.max((1 - t) * (m.h - 1), 0), m.h - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, m.w - 1);
  const y1 = Math.min(y0 + 1, m.h - 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = m.a[y0 * m.w + x0];
  const b = m.a[y0 * m.w + x1];
  const c = m.a[y1 * m.w + x0];
  const d = m.a[y1 * m.w + x1];
  return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) / 255;
};

/** Width in pins of a mask set at an ink height of `heightPins`. */
export const maskWidthPins = (key: MaskKey, heightPins: number): number => {
  const m = maskOf(key);
  return (heightPins / Math.max(0.2, m.inkFrac)) * m.aspect;
};

export interface PinTextOptions {
  h?: number;
  tint?: number;
  ground?: FieldFn | number;
  glow?: number;
}

/**
 * Text pressed into the wall: `left` is the left edge of the set line (board u), `v` its vertical
 * centre, `heightPins` the ink height in pins.
 */
export const pinTextField = (board: Board, key: MaskKey, at: {left: number; v: number; heightPins: number}, o: PinTextOptions = {}): FieldFn => {
  const m = maskOf(key);
  const hPins = at.heightPins / Math.max(0.2, m.inkFrac);
  const wPins = hPins * m.aspect;
  const u = at.left + (wPins * board.p) / 2;
  const {local} = placer(board, {u, v: at.v, height: hPins, width: wPins}, m.aspect);
  const hk = o.h ?? 0.5;
  const tint = o.tint ?? 1.0;
  const glow = o.glow ?? 0;
  const groundFn: FieldFn =
    typeof o.ground === 'function'
      ? o.ground
      : ((g: PinSample) => () => g)({h: 0, tint: o.ground ?? 0.9});
  return (uu, vv, i) => {
    const g = groundFn(uu, vv, i);
    const [s, t] = local(uu, vv);
    if (s < 0 || s > 1 || t < 0 || t > 1) return g;
    const a = sample(m, s, t);
    if (a <= 0.002) return g;
    const gt = typeof g.tint === 'number' ? g.tint : (g.tint[0] + g.tint[1] + g.tint[2]) / 3;
    return {h: g.h + (hk - g.h) * a, tint: gt + (tint - gt) * a, glow: (g.glow ?? 0) + (glow - (g.glow ?? 0)) * a};
  };
};
