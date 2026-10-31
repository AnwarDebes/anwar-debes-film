import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import type {Board} from '../board';
import {colsInU, rowsInV} from '../board';
import {STEEL} from '../timeline';
import type {FieldFn, PinSample} from '../types';
import {inside01, placer, smooth01, type Place} from './place';

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const pixelCache = new Map<string, Promise<Pixels>>();
const pixelDone = new Map<string, Pixels>();

/**
 * Decode an image into RGBA pixels (cached per URL). The channels are data (relief, grey, mask),
 * so the decode skips colour management and alpha premultiplication.
 */
export const loadPixels = (url: string): Promise<Pixels> => {
  let p = pixelCache.get(url);
  if (!p) {
    p = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not load ${url}: HTTP ${res.status}`);
      const bmp = await createImageBitmap(await res.blob(), {colorSpaceConversion: 'none', premultiplyAlpha: 'none'});
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const x = c.getContext('2d', {willReadFrequently: true});
      if (!x) throw new Error('2D canvas unavailable');
      x.drawImage(bmp, 0, 0);
      bmp.close();
      const d = x.getImageData(0, 0, c.width, c.height);
      const px = {width: d.width, height: d.height, data: d.data};
      pixelDone.set(url, px);
      return px;
    })();
    pixelCache.set(url, p);
  }
  return p;
};

/**
 * Pixels of a file in public/ (e.g. 'images/face.png'), or null until loaded. Holds the render
 * with delayRender (taken during render) until the image is decoded, so the first captured frame
 * already has it. A failed load cancels the render instead of rendering without the picture.
 */
export const usePixels = (publicPath: string): Pixels | null => {
  const url = staticFile(publicPath);
  const [, rerender] = useState(0);
  const px = pixelDone.get(url) ?? null;
  const hold = useRef<{url: string; handle: number} | null>(null);
  if (!px && hold.current?.url !== url) {
    if (hold.current) continueRender(hold.current.handle);
    hold.current = {url, handle: delayRender(`Loading pin image ${publicPath}`)};
  }
  useLayoutEffect(() => {
    if (px) return;
    let live = true;
    loadPixels(url).then(
      () => {
        if (live) rerender((n) => n + 1);
      },
      (err) => cancelRender(err),
    );
    return () => {
      live = false;
    };
  }, [url, px]);
  useEffect(() => {
    if (px && hold.current) {
      continueRender(hold.current.handle);
      hold.current = null;
    }
  }, [px]);
  useEffect(
    () => () => {
      if (hold.current) continueRender(hold.current.handle);
      hold.current = null;
    },
    [],
  );
  return px;
};

/** Bilinear sample of a channel in 0..1, (s, t) in 0..1 with t up. */
export const samplePixels = (img: Pixels, s: number, t: number, ch: number): number => {
  const {width: W, height: H, data} = img;
  const x = Math.min(Math.max(s * (W - 1), 0), W - 1);
  const y = Math.min(Math.max((1 - t) * (H - 1), 0), H - 1);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, W - 1);
  const y1 = Math.min(y0 + 1, H - 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = data[(y0 * W + x0) * 4 + ch];
  const b = data[(y0 * W + x1) * 4 + ch];
  const c = data[(y1 * W + x0) * 4 + ch];
  const d = data[(y1 * W + x1) * 4 + ch];
  return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) / 255;
};

// ---------------------------------------------------------------- portrait (identity.md d.5)

/** Edge fade so a picture never ends in a cliff at its own border. */
const edgeFade = (s: number, t: number) => smooth01(Math.min(1, t / 0.09, (1 - t) / 0.06, s / 0.05, (1 - s) / 0.05));

export interface PortraitOptions {
  /** Steel tint outside the head mask (default 0.9). */
  ground?: number;
  /** Height multiplier (default 1: the R channel, max 228/255). */
  relief?: number;
}

/** face.png: R = relief, G = grey photo, B = head mask. */
export const portraitField = (board: Board, face: Pixels, place: Place, opts: PortraitOptions = {}): FieldFn => {
  const {local} = placer(board, place, face.width / face.height);
  const ground = opts.ground ?? STEEL;
  const k = opts.relief ?? 1;
  const outside: PinSample = {h: 0, tint: ground};
  return (u, v) => {
    const [s, t] = local(u, v);
    if (!inside01(s, t)) return outside;
    const m = samplePixels(face, s, t, 2);
    const e = edgeFade(s, t);
    const g = samplePixels(face, s, t, 1);
    return {h: samplePixels(face, s, t, 0) * e * k, tint: (0.25 + 0.75 * (0.12 + 0.88 * g)) * m + ground * (1 - m)};
  };
};

export interface BooleanCounts {
  /** Pins on the whole board. */
  board: number;
  /** Pins inside the picture's rectangle. */
  inRect: number;
  /** Pins inside the head mask: the "N pins, each one true or false". */
  mask: number;
  true: number;
  false: number;
}

export interface BooleanPortrait {
  field: FieldFn;
  /** 1 where the pin is true (raised and white), per pin index. */
  bits: Uint8Array;
  /** 1 where the pin is inside the mask. */
  mask: Uint8Array;
  counts: BooleanCounts;
}

/**
 * The portrait as booleans: Floyd-Steinberg on the hex grid over the grey channel (pins.js
 * dither, error 7/16 right, 5/16 and 4/16 to the next row). Inside the mask: true = raised to
 * half relief and white, false = flush and dark. The counts come from the same arrays.
 */
export const booleanPortrait = (board: Board, face: Pixels, place: Place, opts: PortraitOptions = {}): BooleanPortrait => {
  const {local} = placer(board, place, face.width / face.height);
  const ground = opts.ground ?? STEEL;
  const k = opts.relief ?? 1;
  const N = board.N;
  const inRect = new Uint8Array(N);
  const err = new Float32Array(N);
  const mask = new Uint8Array(N);
  const fade = new Float32Array(N);
  const {rowStart} = board;
  // only rows and columns that can hold the picture
  const hU = (place.width ?? place.height * (face.width / face.height)) * board.p;
  const hV = (place.height * board.p) / board.extH;
  const [r0, r1] = rowsInV(board, place.v - hV / 2 - 0.01, place.v + hV / 2 + 0.01);
  for (let r = r0; r <= r1; r++) {
    const [c0, c1] = colsInU(board, r, place.u - hU / 2 - 0.01, place.u + hU / 2 + 0.01);
    for (let c = c0; c <= c1; c++) {
      const i = rowStart[r] + c;
      const [s, t] = local(board.u[i], board.v[i]);
      if (!inside01(s, t)) continue;
      inRect[i] = 1;
      err[i] = samplePixels(face, s, t, 1);
      mask[i] = samplePixels(face, s, t, 2) > 0.5 ? 1 : 0;
      fade[i] = smooth01(Math.min(1, t / 0.09, (1 - t) / 0.06));
    }
  }
  const bits = new Uint8Array(N);
  for (let r = 0; r < board.rows; r++) {
    const odd = r % 2 === 1;
    const start = rowStart[r];
    const n = rowStart[r + 1] - start;
    const nextStart = r + 1 < board.rows ? rowStart[r + 1] : -1;
    const nextN = r + 1 < board.rows ? rowStart[r + 2] - rowStart[r + 1] : 0;
    for (let c = 0; c < n; c++) {
      const i = start + c;
      if (!inRect[i]) continue;
      const nv = err[i] > 0.5 ? 1 : 0;
      bits[i] = nv;
      const e = err[i] - nv;
      if (c + 1 < n && inRect[i + 1]) err[i + 1] += (e * 7) / 16;
      if (nextStart < 0) continue;
      const a = odd ? c : c - 1;
      const b = odd ? c + 1 : c;
      if (a >= 0 && a < nextN && inRect[nextStart + a]) err[nextStart + a] += (e * 5) / 16;
      if (b >= 0 && b < nextN && inRect[nextStart + b]) err[nextStart + b] += (e * 4) / 16;
    }
  }
  let nRect = 0;
  let nMask = 0;
  let nTrue = 0;
  for (let i = 0; i < N; i++) {
    if (!inRect[i]) continue;
    nRect++;
    if (mask[i]) {
      nMask++;
      if (bits[i]) nTrue++;
    } else bits[i] = 0;
  }
  const outside: PinSample = {h: 0, tint: ground};
  const off: PinSample = {h: 0, tint: 0.36};
  const field: FieldFn = (_u, _v, i) => {
    if (!mask[i]) return outside;
    return bits[i] ? {h: 0.5 * fade[i] * k, tint: 1.0} : off;
  };
  return {field, bits, mask, counts: {board: N, inRect: nRect, mask: nMask, true: nTrue, false: nMask - nTrue}};
};

/** A greyscale image as relief: brighter is higher (any picture, not only the portrait). */
export const imageField = (
  board: Board,
  img: Pixels,
  place: Place,
  opts: {channel?: number; height?: number; tint?: (g: number) => number; ground?: number; invert?: boolean} = {},
): FieldFn => {
  const {local} = placer(board, place, img.width / img.height);
  const ch = opts.channel ?? 1;
  const hk = opts.height ?? 1;
  const ground = opts.ground ?? STEEL;
  const outside: PinSample = {h: 0, tint: ground};
  return (u, v) => {
    const [s, t] = local(u, v);
    if (!inside01(s, t)) return outside;
    let g = samplePixels(img, s, t, ch);
    if (opts.invert) g = 1 - g;
    const e = edgeFade(s, t);
    return {h: g * hk * e, tint: opts.tint ? opts.tint(g) : 0.5 + 0.5 * g};
  };
};
