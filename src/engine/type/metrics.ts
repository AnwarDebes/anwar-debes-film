import type React from 'react';
import {measureText} from '@remotion/layout-utils';

/** A resolved face at a size: everything needed to measure and to draw a run. */
export interface FontSpec {
  /** CSS font-family stack */
  family: string;
  /** px */
  size: number;
  weight: number;
  style?: 'normal' | 'italic';
  /** em */
  tracking?: number;
  /** CSS font-feature-settings, e.g. '"tnum" 1' */
  features?: string;
  uppercase?: boolean;
}

/** Line height (in em) used for every absolutely placed run. */
export const RUN_LH = 1.6;

const trackingPx = (f: FontSpec): number => (f.tracking ?? 0) * f.size;

/** CSS for drawing a run in this face. */
export const fontCSS = (f: FontSpec): React.CSSProperties => ({
  fontFamily: f.family,
  fontSize: f.size,
  fontWeight: f.weight,
  fontStyle: f.style ?? 'normal',
  letterSpacing: f.tracking ? `${f.tracking}em` : undefined,
  fontFeatureSettings: f.features ?? 'normal',
  textTransform: f.uppercase ? 'uppercase' : undefined,
  fontKerning: 'normal',
  fontSynthesis: 'none',
  whiteSpace: 'pre',
});

/**
 * Advance width of `text` as the browser lays it out, in px, including the
 * trailing letter-spacing Chrome adds after the last glyph (so consecutive
 * runs can be chained by adding widths).
 *
 * Feature settings go through additionalStyles because layout-utils keys its
 * cache on those but not on fontVariantNumeric.
 */
export const advance = (text: string, f: FontSpec): number => {
  if (text.length === 0) return 0;
  return measureText({
    text,
    fontFamily: f.family,
    fontSize: f.size,
    fontWeight: f.weight,
    letterSpacing: f.tracking ? `${f.tracking}em` : undefined,
    textTransform: f.uppercase ? 'uppercase' : undefined,
    additionalStyles: {
      fontStyle: f.style ?? 'normal',
      fontFeatureSettings: f.features ?? 'normal',
      fontKerning: 'normal',
    },
  }).width;
};

/** Visible width of a run: the advance minus the trailing letter-spacing. */
export const inkWidth = (text: string, f: FontSpec): number =>
  text.length === 0 ? 0 : advance(text, f) - trackingPx(f);

const offsetCache = new Map<string, number>();

/**
 * Distance in px from the top of a run's box (drawn with line-height RUN_LH)
 * to its baseline, probed in the DOM at the exact size. Blink rounds ascent
 * and descent per size, so this is measured rather than scaled from the
 * font tables; runs of different faces then share a baseline to the pixel.
 */
export const baselineOffset = (f: FontSpec): number => {
  const style = f.style ?? 'normal';
  const key = `${f.family}|${style}|${f.size.toFixed(3)}`;
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return (RUN_LH / 2 + 0.36) * f.size;
  const box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.left = '0px';
  box.style.top = '-20000px';
  box.style.whiteSpace = 'pre';
  box.style.fontFamily = f.family;
  box.style.fontStyle = style;
  box.style.fontWeight = String(f.weight);
  box.style.fontSize = `${f.size}px`;
  box.style.lineHeight = String(RUN_LH);
  const mark = document.createElement('span');
  mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
  box.appendChild(document.createTextNode('Hxg'));
  box.appendChild(mark);
  document.body.appendChild(box);
  const offset = mark.getBoundingClientRect().top - box.getBoundingClientRect().top;
  document.body.removeChild(box);
  offsetCache.set(key, offset);
  return offset;
};

/** Top of a run's box (drawn with RUN_LH) so that its baseline lands on `baseline`. */
export const runTop = (baseline: number, f: FontSpec): number => baseline - baselineOffset(f);

const inkCache = new Map<string, {left: number; right: number}>();
let inkCanvas: CanvasRenderingContext2D | null = null;

/**
 * Side bearings of a run's ink, in px: `left` is how far the first glyph's
 * ink starts to the right of the pen origin, `right` how far the last
 * glyph's ink stops short of the advance. Large type is aligned by its ink
 * (optical margins), so a "9" or a "T" lines up with the mono kicker above it.
 */
export const inkBearings = (text: string, f: FontSpec): {left: number; right: number} => {
  const key = `${text}|${f.family}|${f.weight}|${f.style ?? 'normal'}|${f.size.toFixed(3)}|${f.tracking ?? 0}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined' || text.length === 0) return {left: 0, right: 0};
  if (!inkCanvas) inkCanvas = document.createElement('canvas').getContext('2d');
  const g = inkCanvas;
  if (!g) return {left: 0, right: 0};
  g.font = `${f.style ?? 'normal'} ${f.weight} ${f.size}px ${f.family}`;
  (g as CanvasRenderingContext2D & {letterSpacing?: string}).letterSpacing = `${(f.tracking ?? 0) * f.size}px`;
  const m = g.measureText(text);
  const res = {left: -m.actualBoundingBoxLeft, right: inkWidth(text, f) - m.actualBoundingBoxRight};
  inkCache.set(key, res);
  return res;
};

/** Font metrics from the files (em), used for cap-height and clip boxes. */
export const faceMetrics = {
  sans: {cap: 1440 / 2048, x: 1080 / 2048, asc: 2000 / 2048, desc: 528 / 2048},
  serifItalic: {cap: 0.657, x: 0.467, asc: 0.762, desc: 0.238},
  mono: {cap: 0.73, x: 0.55, asc: 1.02, desc: 0.3, advance: 0.6},
} as const;

export const capHeightOf = (f: FontSpec): number => {
  if (f.family.includes('STIX')) return faceMetrics.serifItalic.cap * f.size;
  if (f.family.includes('JetBrains')) return faceMetrics.mono.cap * f.size;
  return faceMetrics.sans.cap * f.size;
};
