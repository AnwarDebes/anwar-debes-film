import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';
import {ensureFonts} from '../../fonts';
import {font as fontTokens} from '../../tokens';
import type {Board} from '../board';
import type {FieldFn, PinSample} from '../types';
import {samplePixels, type Pixels} from './image';
import {inside01, placer, type Place} from './place';

// A word or number set in the film's own type, rendered into a canvas and pressed into pins.

export interface TextSpec {
  text: string;
  /** CSS font family (default the film sans). */
  family?: string;
  weight?: number;
  italic?: boolean;
  /** Tracking in em (the display styles use -0.03). */
  tracking?: number;
}

const cssFont = (s: TextSpec, px: number) => `${s.italic ? 'italic ' : ''}${s.weight ?? 700} ${px}px ${s.family ?? fontTokens.sans}`;

const fontReady = new Set<string>();
const fontLoads = new Map<string, Promise<void>>();

/**
 * Resolves once this face can be drawn into a canvas. The film fonts are added to document.fonts
 * only after they load, so `document.fonts.check` alone would pass early and draw a fallback face.
 */
export const loadCanvasFont = (spec: Omit<TextSpec, 'text'>): Promise<void> => {
  const css = cssFont({...spec, text: ''}, 100);
  let p = fontLoads.get(css);
  if (!p) {
    // (a system family matches no FontFace; it is drawable as soon as the film fonts settle)
    p = ensureFonts()
      .then(() => document.fonts.load(css))
      .then(() => {
        fontReady.add(css);
      });
    fontLoads.set(css, p);
  }
  return p;
};

/**
 * True once the font face is ready for canvas drawing. Holds the render meanwhile (the hold is
 * taken during render, so no frame can be captured before it), so a text field is never drawn in a
 * fallback face. Gate textField / textPixels on it.
 */
export const useCanvasFont = (spec: Omit<TextSpec, 'text'>): boolean => {
  const css = cssFont({...spec, text: ''}, 100);
  const [, rerender] = useState(0);
  const ready = fontReady.has(css);
  const hold = useRef<{css: string; handle: number} | null>(null);
  if (!ready && hold.current?.css !== css) {
    if (hold.current) continueRender(hold.current.handle);
    hold.current = {css, handle: delayRender(`Loading canvas font ${css}`)};
  }
  useLayoutEffect(() => {
    if (ready) return;
    let live = true;
    loadCanvasFont(spec).then(
      () => {
        if (live) rerender((n) => n + 1);
      },
      (err) => cancelRender(err),
    );
    return () => {
      live = false;
    };
    // the spec is fully described by css
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [css, ready]);
  useEffect(() => {
    if (ready && hold.current) {
      continueRender(hold.current.handle);
      hold.current = null;
    }
  }, [ready]);
  useEffect(
    () => () => {
      if (hold.current) continueRender(hold.current.handle);
      hold.current = null;
    },
    [],
  );
  return ready;
};

interface TextRaster {
  px: Pixels;
  /** raster width / height */
  aspect: number;
  /** ink height / raster height (the raster keeps a small margin) */
  inkFrac: number;
}

const textCache = new Map<string, TextRaster>();

/**
 * Render text to a canvas mask (R = coverage), tightly cropped to the ink with a small margin.
 * `pixelsPerPin` sets the raster density relative to the pins it will cover.
 */
export const textPixels = (spec: TextSpec, heightPins: number, pixelsPerPin = 6): TextRaster => {
  const key = `${cssFont(spec, 1)}|${spec.tracking ?? 0}|${heightPins}|${pixelsPerPin}|${spec.text}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const fontPx = Math.max(16, Math.round(heightPins * pixelsPerPin));
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('2D canvas unavailable');
  probe.font = cssFont(spec, fontPx);
  const track = (spec.tracking ?? 0) * fontPx;
  probe.letterSpacing = `${track}px`;
  const m = probe.measureText(spec.text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  const left = m.actualBoundingBoxLeft;
  const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const pad = Math.ceil(fontPx * 0.06);
  const W = Math.ceil(inkW + pad * 2);
  const H = Math.ceil(asc + desc + pad * 2);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', {willReadFrequently: true});
  if (!x) throw new Error('2D canvas unavailable');
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.font = cssFont(spec, fontPx);
  x.letterSpacing = `${track}px`;
  x.fillStyle = '#fff';
  x.textBaseline = 'alphabetic';
  // a quarter-pin blur turns the raster edge into a pin-scale slope
  x.filter = `blur(${(pixelsPerPin * 0.25).toFixed(2)}px)`;
  x.fillText(spec.text, pad + left, pad + asc);
  const d = x.getImageData(0, 0, W, H);
  const out: TextRaster = {px: {width: W, height: H, data: d.data}, aspect: W / H, inkFrac: (asc + desc) / H};
  textCache.set(key, out);
  return out;
};

export interface TextFieldOptions {
  /** Height of raised strokes in reliefs (default 0.5). */
  h?: number;
  tint?: number;
  /** Tint of the ground around the text (default 0.9 steel; null keeps the base). */
  ground?: number;
  glow?: number;
}

/**
 * Text pressed into the wall. `place.height` is the ink height in pins (cap or figure height for
 * digits); the width follows the set text.
 */
export const textField = (board: Board, spec: TextSpec, place: Omit<Place, 'width'>, opts: TextFieldOptions = {}): FieldFn => {
  const {px, aspect, inkFrac} = textPixels(spec, place.height);
  // the raster keeps a margin around the ink; scale the placement so the ink has the asked height
  const {local} = placer(board, {...place, height: place.height / Math.max(0.2, inkFrac)}, aspect);
  const hk = opts.h ?? 0.5;
  const tint = opts.tint ?? 1.0;
  const ground = opts.ground ?? 0.9;
  const glow = opts.glow ?? 0;
  const outside: PinSample = {h: 0, tint: ground};
  return (u, v) => {
    const [s, t] = local(u, v);
    if (!inside01(s, t)) return outside;
    const a = samplePixels(px, s, t, 0);
    if (a <= 0.002) return outside;
    return {h: a * hk, tint: ground + (tint - ground) * a, glow: glow * a};
  };
};
