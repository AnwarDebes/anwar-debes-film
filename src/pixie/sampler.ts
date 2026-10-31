// Fast point sampling of a Pixie frame for pins and voxels.
//
// samplePixie (pixie-core.ts) parses colour strings for every rect on every
// call. A pin wall samples thousands of pins per frame, so this compiles a frame
// once into typed arrays and then runs the same arithmetic, in the same operand
// order, per pin. Rects are also indexed by one-cell row bands, so a pin only
// tests the rects that cross its row (skipping rects that cannot contain the
// point changes nothing). scripts/pixie/checks.ts compares it with samplePixie
// exactly (colour, alpha, height and part) on the k = 3 lattice and random points.

import {PIN_HEIGHT, type Part, type Rect} from './pixie-core';

// Height of the laptop's code lines, rgba(43,42,39,0.45): the site emblem's value,
// the same constant samplePixie uses.
const CODE_LINE_HEIGHT = 0.3;

const PARTS: readonly Part[] = [
  'shadow', 'laptop', 'leg', 'antenna', 'body', 'eye', 'mouth', 'thought', 'document',
  'paper', 'magnifier', 'bug', 'bang', 'sparkle', 'check', 'bubble', 'question', 'sweat',
];
const PART_INDEX = new Map<Part, number>(PARTS.map((p, i) => [p, i]));

/** [r, g, b, a, heightOrNaN] where NaN means "keeps the height under it" (the shadow). */
type Parsed = readonly [number, number, number, number, number];
const parsedCache = new Map<string, Parsed>();

function parse(c: string): Parsed {
  const hit = parsedCache.get(c);
  if (hit) return hit;
  let r: number, g: number, b: number, a: number;
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
    a = 1;
  } else {
    const p = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number);
    r = p[0];
    g = p[1];
    b = p[2];
    a = p.length > 3 ? p[3] : 1;
  }
  let h: number;
  if (c[0] === '#') h = PIN_HEIGHT[c] ?? 0.5;
  else if (c.startsWith('rgba(43,42,39')) h = CODE_LINE_HEIGHT;
  else if (c.startsWith('rgba(0,0,0')) h = NaN;
  else if (c.startsWith('rgba(217,119,87')) h = PIN_HEIGHT['#d97757'];
  else h = PIN_HEIGHT['#7db36a'];
  const out: Parsed = [r, g, b, a, h];
  // Thought dots carry a new alpha every frame; keep the cache bounded.
  if (parsedCache.size > 512) parsedCache.clear();
  parsedCache.set(c, out);
  return out;
}

/** Result of one sample. r, g, b are premultiplied 0-255 sums, as samplePixie returns them. */
export interface SampleOut {
  r: number;
  g: number;
  b: number;
  a: number;
  h: number;
  part: Part | null;
}

export const emptySample = (): SampleOut => ({r: 0, g: 0, b: 0, a: 0, h: 0, part: null});

/** A frame compiled for sampling. Buffers grow once and are reused across frames. */
export class CompiledPixie {
  n = 0;
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  private cap = 0;
  private x0 = new Float64Array(0);
  private y0 = new Float64Array(0);
  private x1 = new Float64Array(0);
  private y1 = new Float64Array(0);
  private cr = new Float64Array(0);
  private cg = new Float64Array(0);
  private cb = new Float64Array(0);
  private ca = new Float64Array(0);
  private ch = new Float64Array(0);
  private pt = new Uint8Array(0);
  // Row bands: rects crossing [bandBase + b, bandBase + b + 1), painter's order (CSR).
  private bandBase = 0;
  private bands = 0;
  private bandStart = new Int32Array(1);
  private bandRects = new Int32Array(0);

  compile(rects: readonly Rect[]): this {
    const n = rects.length;
    if (n > this.cap) {
      const cap = Math.max(64, n * 2);
      this.x0 = new Float64Array(cap);
      this.y0 = new Float64Array(cap);
      this.x1 = new Float64Array(cap);
      this.y1 = new Float64Array(cap);
      this.cr = new Float64Array(cap);
      this.cg = new Float64Array(cap);
      this.cb = new Float64Array(cap);
      this.ca = new Float64Array(cap);
      this.ch = new Float64Array(cap);
      this.pt = new Uint8Array(cap);
      this.cap = cap;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const [x, y, w, h, c, p] = rects[i];
      const q = parse(c);
      this.x0[i] = x;
      this.y0[i] = y;
      this.x1[i] = x + w;
      this.y1[i] = y + h;
      this.cr[i] = q[0];
      this.cg[i] = q[1];
      this.cb[i] = q[2];
      this.ca[i] = q[3];
      this.ch[i] = q[4];
      this.pt[i] = PART_INDEX.get(p) ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }
    this.n = n;
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    this.buildBands();
    return this;
  }

  private buildBands() {
    const n = this.n;
    if (n === 0) {
      this.bands = 0;
      return;
    }
    const base = Math.floor(this.minY);
    const bands = Math.max(1, Math.ceil(this.maxY) - base);
    if (this.bandStart.length < bands + 1) this.bandStart = new Int32Array(bands * 2 + 1);
    const start = this.bandStart;
    start.fill(0, 0, bands + 1);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const b0 = Math.floor(this.y0[i]) - base;
      const b1 = Math.min(bands - 1, Math.ceil(this.y1[i]) - 1 - base);
      for (let b = b0; b <= b1; b++) {
        start[b + 1]++;
        total++;
      }
    }
    for (let b = 0; b < bands; b++) start[b + 1] += start[b];
    if (this.bandRects.length < total) this.bandRects = new Int32Array(total * 2);
    const fill = new Int32Array(bands);
    for (let i = 0; i < n; i++) {
      const b0 = Math.floor(this.y0[i]) - base;
      const b1 = Math.min(bands - 1, Math.ceil(this.y1[i]) - 1 - base);
      for (let b = b0; b <= b1; b++) this.bandRects[start[b] + fill[b]++] = i;
    }
    this.bandBase = base;
    this.bands = bands;
  }

  /**
   * Source-over in painter's order at scene point (x, y), like samplePixie.
   * Writes into `out` and returns false when no rect covers the point.
   */
  sample(x: number, y: number, out: SampleOut): boolean {
    if (x < this.minX || x >= this.maxX || y < this.minY || y >= this.maxY) return false;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let h = 0;
    let part = -1;
    let hit = false;
    const band = Math.floor(y) - this.bandBase;
    if (band < 0 || band >= this.bands) return false;
    const {x0, y0, x1, y1, cr, cg, cb, ca, ch, pt, bandRects} = this;
    for (let q = this.bandStart[band], end = this.bandStart[band + 1]; q < end; q++) {
      const i = bandRects[q];
      if (x < x0[i] || x >= x1[i] || y < y0[i] || y >= y1[i]) continue;
      hit = true;
      const al = ca[i];
      const hh = ch[i];
      if (hh === hh) h = al >= 1 ? hh : h + (hh - h) * al; // NaN (shadow): keeps h
      r = cr[i] * al + r * (1 - al);
      g = cg[i] * al + g * (1 - al);
      b = cb[i] * al + b * (1 - al);
      a = al + a * (1 - al);
      if (al >= 1 || part < 0) part = pt[i];
    }
    out.r = r;
    out.g = g;
    out.b = b;
    out.a = a;
    out.h = h;
    out.part = part < 0 ? null : PARTS[part];
    return hit;
  }
}
