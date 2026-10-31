import {circleField, emblemPixels, flatField, rectField, STEEL, type Board, type FieldFn, type Look, type PinSample} from '../../../engine/pins';
import {AMBER, COOL, MINT, MINT_DIM, WARM, bakedTextField, iconField, plotField, rectSd, regions, segmentField, pinsU, pinsV, type BakedRaster, type Box} from '../ch10/kit/fields';
import knotten from '../../../data/ch13/knotten.json';
import pintext from '../../../data/ch13/pintext.json';
import menu from '../../../data/ch13/menu.json';

// The pin fields of chapter 13. Terrain, houses, trees and water come from knotten-test-2's own
// committed data (baked into data/ch13/knotten.json); the grill's bars are its 74 menu prices.

export const SUBJ: [number, number] = [0.665, 0.56];
export const LENGDE = pintext.lengde as BakedRaster;
export const EIGHT = pintext.eight as BakedRaster;

// ---------------------------------------------------------------- rasters

const bytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
  return out;
};
const cache = new Map<string, Uint8Array>();
const raster = (key: string, b64: string) => {
  let a = cache.get(key);
  if (!a) {
    a = bytes(b64);
    cache.set(key, a);
  }
  return a;
};

interface Win {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  w: number;
  h: number;
}

/** Bilinear sample (0..1) of an 8-bit raster at pixel coordinates. */
const bil = (a: Uint8Array, w: number, h: number, fx: number, fy: number): number => {
  const x = Math.max(0, Math.min(w - 1.001, fx));
  const y = Math.max(0, Math.min(h - 1.001, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const i = y0 * w + x0;
  return ((a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + w] * (1 - tx) + a[i + w + 1] * tx) * ty) / 255;
};

/** Where a data window sits on the wall: centre uv and width in pins (the height follows). */
export interface WinPlace {
  u: number;
  v: number;
  widthPins: number;
}

/** uv -> local metres (x east, y north) for a window placed on the wall. */
const toLocal = (board: Board, win: Win, pl: WinPlace) => {
  const mPerPin = (2 * win.hw) / pl.widthPins;
  return (u: number, v: number): [number, number] => {
    const dxp = (u - pl.u) / board.p;
    const dyp = ((v - pl.v) * board.extH) / board.p;
    return [win.cx + dxp * mPerPin, win.cy + dyp * mPerPin];
  };
};
/** local metres -> uv. */
export const fromLocal = (board: Board, win: Win, pl: WinPlace) => {
  const mPerPin = (2 * win.hw) / pl.widthPins;
  return (x: number, y: number): [number, number] => [pl.u + ((x - win.cx) / mPerPin) * board.p, pl.v + (((y - win.cy) / mPerPin) * board.p) / board.extH];
};
const pixOf = (win: Win) => {
  const sx = (2 * win.hw) / (win.w - 1);
  const sy = (2 * win.hh) / (win.h - 1);
  return (x: number, y: number): [number, number] => [(x - (win.cx - win.hw)) / sx, (win.cy + win.hh - y) / sy];
};

export const CLOSE = knotten.close as unknown as Win & {terrain: string; canopy: string; corridor: string};
export const WIDE = knotten.wide as unknown as Win & {terrain: string; water: string};
export const HOUSES = knotten.houses as Array<[number, number, number, string]>;
export const PLOT1 = knotten.plot1;
/** Plot 1 on the wall, in the wide window. */
export const plot1Wide = (board: Board): [number, number] => fromLocal(board, WIDE, WIDE_AT)(PLOT1.x, PLOT1.y);

/** The close window (the slope with the thirty homes), placed on the wall. */
export const CLOSE_AT: WinPlace = {u: 0.68, v: 0.52, widthPins: 84};
/** The wide window (the river, the fjord, the water the houses see). */
export const WIDE_AT: WinPlace = {u: 0.68, v: 0.5, widthPins: 84};

export interface TerrainOpts {
  /** 0..1: the forest canopy */
  trees?: number;
  /** the trees in the sight lines: 'stand' (amber, flagged), 'gone' (cleared), 'plain' (like any tree) */
  corridor?: 'plain' | 'flag' | 'gone';
  houses?: boolean;
  /** light plot 1 */
  plot1?: boolean;
  /** lift everything out of the wall (0..1) */
  lift?: number;
  /** plot 1's sight lines: every fifth bearing, the water bearings lit */
  rays?: boolean;
}

/** The slope in pins: LiDAR ground, the canopy and the thirty planned houses. */
export const closeTerrain = (board: Board, o: TerrainOpts = {}): FieldFn => {
  const ter = raster('close-t', CLOSE.terrain);
  const can = raster('close-c', CLOSE.canopy);
  const cor = raster('close-k', CLOSE.corridor);
  const loc = toLocal(board, CLOSE, CLOSE_AT);
  const pix = pixOf(CLOSE);
  const lift = o.lift ?? 1;
  const treeK = o.trees ?? 1;
  const mPerPin = (2 * CLOSE.hw) / CLOSE_AT.widthPins;
  const hw = 5.5 / mPerPin;
  const hd = 4.25 / mPerPin;
  const halfW = CLOSE_AT.widthPins / 2;
  const halfH = (CLOSE_AT.widthPins * CLOSE.hh) / CLOSE.hw / 2;
  const houses = HOUSES.map(([x, y]) => fromLocal(board, CLOSE, CLOSE_AT)(x, y));
  const [b0, b1] = PLOT1.water as [number, number];
  return (u, v) => {
    const dxp = (u - CLOSE_AT.u) / board.p;
    const dyp = ((v - CLOSE_AT.v) * board.extH) / board.p;
    if (Math.abs(dxp) > halfW || Math.abs(dyp) > halfH) return {h: 0, tint: STEEL};
    const edge = Math.min(1, (halfW - Math.abs(dxp)) / 3, (halfH - Math.abs(dyp)) / 3);
    const [x, y] = loc(u, v);
    const [fx, fy] = pix(x, y);
    const g = bil(ter, CLOSE.w, CLOSE.h, fx, fy);
    let h = (0.05 + g * 0.62) * edge * lift;
    let tint: number | [number, number, number] = 0.6 + 0.32 * g;
    let glow = 0;
    if (o.houses !== false) {
      for (let k = 0; k < houses.length; k++) {
        const [hu, hv] = houses[k];
        if (Math.abs((u - hu) / board.p) <= hw && Math.abs(((v - hv) * board.extH) / board.p) <= hd) {
          const lit = o.plot1 && k === 0;
          return {h: h + 0.13 * lift, tint: lit ? MINT : 1, glow: lit ? 0.9 : 0};
        }
      }
    }
    if (o.rays) {
      const ex = (u - houses[0][0]) / board.p;
      const ey = ((v - houses[0][1]) * board.extH) / board.p;
      const r = Math.hypot(ex, ey);
      if (r > 2.5) {
        let brg = (Math.atan2(ex, ey) * 180) / Math.PI;
        if (brg < 0) brg += 360;
        const wb = Math.round(brg);
        if (wb >= b0 && wb <= b1 && wb % 2 === 1 && Math.abs(brg - wb) * (Math.PI / 180) * r < 0.42) return {h: h + 0.08 * lift, tint: MINT, glow: 0.7};
        const near = Math.round(brg / 10) * 10;
        if (r < 34 && Math.abs(brg - near) * (Math.PI / 180) * r < 0.36) return {h: h + 0.04 * lift, tint: 0.98};
      }
    }
    const c = treeK > 0 ? bil(can, CLOSE.w, CLOSE.h, fx, fy) : 0;
    const k = bil(cor, CLOSE.w, CLOSE.h, fx, fy);
    if (k > 0.05 && o.corridor !== 'gone') {
      if (o.corridor === 'flag') return {h: h + k * 0.32 * lift, tint: AMBER, glow: 0.35 * Math.min(1, k * 2)};
      h += k * 0.3 * treeK * lift;
      tint = 0.5;
    } else if (c > 0.05) {
      h += c * 0.3 * treeK * lift;
      tint = 0.42 + 0.2 * g;
    }
    void glow;
    return {h, tint};
  };
};

/** The wider land: the fjord and river in a cool tint, flat; plot 1's sight lines on top. */
export const wideTerrain = (board: Board, lines: 'none' | 'all' | 'water'): FieldFn => {
  const ter = raster('wide-t', WIDE.terrain);
  const wat = raster('wide-w', WIDE.water);
  const loc = toLocal(board, WIDE, WIDE_AT);
  const pix = pixOf(WIDE);
  const halfW = WIDE_AT.widthPins / 2;
  const halfH = (WIDE_AT.widthPins * WIDE.hh) / WIDE.hw / 2;
  const [pu, pv] = fromLocal(board, WIDE, WIDE_AT)(PLOT1.x, PLOT1.y);
  const [b0, b1] = PLOT1.water as [number, number];
  return (u, v) => {
    const dxp = (u - WIDE_AT.u) / board.p;
    const dyp = ((v - WIDE_AT.v) * board.extH) / board.p;
    if (Math.abs(dxp) > halfW || Math.abs(dyp) > halfH) return {h: 0, tint: STEEL};
    const edge = Math.min(1, (halfW - Math.abs(dxp)) / 3, (halfH - Math.abs(dyp)) / 3);
    const [x, y] = loc(u, v);
    const [fx, fy] = pix(x, y);
    const g = bil(ter, WIDE.w, WIDE.h, fx, fy);
    const w = bil(wat, WIDE.w, WIDE.h, fx, fy);
    const base: PinSample = w > 0.5 ? {h: 0.01, tint: COOL} : {h: (0.04 + g * 0.58) * edge, tint: 0.58 + 0.34 * g};
    if (lines === 'none') return base;
    // plot 1's bearings: one line every fifth degree, and the 23 water bearings all lit
    const ex = (u - pu) / board.p;
    const ey = ((v - pv) * board.extH) / board.p;
    const r = Math.hypot(ex, ey);
    if (r < 1.2) return {h: base.h + 0.3, tint: MINT, glow: 1};
    let brg = (Math.atan2(ex, ey) * 180) / Math.PI;
    if (brg < 0) brg += 360;
    const wb = Math.round(brg);
    if (wb >= b0 && wb <= b1 && wb % 2 === 1 && Math.abs(brg - wb) * (Math.PI / 180) * r < 0.42) return {h: base.h + 0.07, tint: MINT, glow: 0.75};
    const near = Math.round(brg / 5) * 5;
    const off = Math.abs(brg - near) * (Math.PI / 180) * r;
    if (lines === 'all' && r < 40 && off < 0.36) return {h: base.h + 0.04, tint: 0.98};
    return base;
  };
};

/** The winter-solstice dial: three arcs of 5-minute ticks; lit ticks are minutes of direct sun. */
export const SUN = {u: 0.7, v: 0.43, r: [16, 22, 28]};
export const SUN_ROWS = [
  {label: 'plot 9', hours: 2.25},
  {label: 'plot 1', hours: 3.75},
  {label: 'plots 16-19', hours: 4.42},
];
/** possible sun on 21 December, hours (plot 1's possible_hours; the dial spans it) */
export const SUN_DAY = 6.08;
export const sunDialField = (board: Board, lit: 'none' | number[]): FieldFn => {
  const ticks = Math.round(SUN_DAY * 12);
  return (u, v) => {
    const ex = (u - SUN.u) / board.p;
    const ey = ((v - SUN.v) * board.extH) / board.p;
    if (ey < -0.6) return {h: 0, tint: STEEL};
    const r = Math.hypot(ex, ey);
    for (let k = 0; k < SUN.r.length; k++) {
      if (Math.abs(r - SUN.r[k]) > 1.1) continue;
      const a = Math.atan2(ey, -ex); // 0 at the left (east), pi at the right (west)
      if (a < 0 || a > Math.PI) return {h: 0, tint: STEEL};
      const j = Math.floor((a / Math.PI) * ticks);
      const n = lit === 'none' ? 0 : lit[k];
      if (j < n) return {h: 0.2, tint: MINT, glow: 0.8};
      return {h: 0.08, tint: 0.62};
    }
    if (r < 3) return {h: 0.25, tint: WARM, glow: 0.3};
    return {h: 0, tint: STEEL};
  };
};

/** Live sun dial: ring and tick of every pin in the dial's box, computed once; lit per frame. */
export const sunDialLive = (board: Board, ticksLit: (t: number) => readonly number[]) => {
  const ticks = Math.round(SUN_DAY * 12);
  const ring = new Int8Array(board.N).fill(-1);
  const tick = new Int16Array(board.N);
  for (let i = 0; i < board.N; i++) {
    const ex = (board.u[i] - SUN.u) / board.p;
    const ey = ((board.v[i] - SUN.v) * board.extH) / board.p;
    if (ey < -0.6) continue;
    const r = Math.hypot(ex, ey);
    for (let k = 0; k < SUN.r.length; k++) {
      if (Math.abs(r - SUN.r[k]) > 1.1) continue;
      const a = Math.atan2(ey, -ex);
      if (a < 0 || a > Math.PI) break;
      ring[i] = k;
      tick[i] = Math.floor((a / Math.PI) * ticks);
      break;
    }
  }
  const s: PinSample = {h: 0, tint: 0, glow: 0};
  return (_u: number, _v: number, i: number, t: number): PinSample | null => {
    const k = ring[i];
    if (k < 0) return null;
    const lit = ticksLit(t);
    if (tick[i] >= lit[k]) return null;
    s.h = 0.2;
    s.tint = MINT;
    s.glow = 0.8;
    return s;
  };
};

/** A path of lit pins drawn from its first point to its last over [at, at + dur]. */
export const threadLive = (board: Board, path: Array<[number, number]>, at: number, dur: number) => {
  const pts = path.map(([u, v]) => [u, v * board.extH] as [number, number]);
  const lens = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const s: PinSample = {h: 0.09, tint: MINT, glow: 0.9};
  const half = 0.62 * board.p;
  return (u: number, v: number, _i: number, t: number): PinSample | null => {
    const k = Math.min(1, Math.max(0, (t - at) / dur));
    if (k <= 0) return null;
    let left = k * total;
    const y = v * board.extH;
    for (let j = 0; j < lens.length && left > 0; j++) {
      const [ax, ay] = pts[j];
      const [bx, by] = pts[j + 1];
      const L = lens[j];
      const use = Math.min(1, left / L);
      left -= L;
      const dx = bx - ax;
      const dy = by - ay;
      const q = Math.max(0, Math.min(use, ((u - ax) * dx + (y - ay) * dy) / (L * L)));
      const ex = u - ax - dx * q;
      const ey = y - ay - dy * q;
      if (ex * ex + ey * ey < half * half) return s;
    }
    return null;
  };
};

// ---------------------------------------------------------------- 13.2 knotten-web

export const NUM_AT = {u: 0.625, v: 0.58, h: 17};
export const PILL = {u: 0.84, v: 0.565, w: 13, h: 6.5};
/** The thread from the Kilde chip, over the number, to the quote it opens. */
export const THREAD: Array<[number, number]> = [[0.84, 0.6], [0.84, 0.76], [0.5, 0.76]];
export const numeralField = (board: Board, pill: 'off' | 'on' | 'dark'): FieldFn => {
  const num = bakedTextField(board, LENGDE, {u: NUM_AT.u, v: NUM_AT.v, height: NUM_AT.h}, {h: 0.55, tint: 1});
  const sd = rectSd(board, {u: PILL.u, v: PILL.v, w: PILL.w, h: PILL.h, radius: 3.4});
  return (u, v, i) => {
    const d = sd(u, v);
    if (pill !== 'off' && d < 0.45) {
      if (pill === 'dark') return d > -1 ? {h: 0.1, tint: 0.45} : {h: 0.04, tint: 0.3};
      return d > -1 ? {h: 0.24, tint: MINT, glow: 0.7} : {h: 0.16, tint: 0.95};
    }
    return num(u, v, i);
  };
};

// ---------------------------------------------------------------- 13.3 knotten-test

export const SPECS = {u: 0.67, v: 0.56, cols: 9, rows: 3, w: 6.4, h: 8.2, gapU: 1.6, gapV: 2.2};
export const specCell = (board: Board, k: number): [number, number] => {
  const c = k % SPECS.cols;
  const r = Math.floor(k / SPECS.cols);
  const pw = SPECS.w + SPECS.gapU;
  const ph = SPECS.h + SPECS.gapV;
  return [SPECS.u + pinsU(board, (c - (SPECS.cols - 1) / 2) * pw), SPECS.v + pinsV(board, ((SPECS.rows - 1) / 2 - r) * ph)];
};
/** The 27 specification cards; the first `n` are up, each with its completion pin lit. */
export const specsField = (board: Board, n: number): FieldFn => {
  const cards = Array.from({length: 27}, (_, k) => {
    const [cu, cv] = specCell(board, k);
    return {sd: rectSd(board, {u: cu, v: cv, w: SPECS.w, h: SPECS.h, radius: 1}), done: [cu + pinsU(board, SPECS.w / 2 - 1.3), cv - pinsV(board, SPECS.h / 2 - 1.3)] as [number, number], k};
  });
  return (u, v) => {
    for (const c of cards) {
      const d = c.sd(u, v);
      if (d > 0.45) continue;
      if (c.k >= n) return {h: 0.02, tint: 0.64};
      const dd = Math.hypot((u - c.done[0]) / board.p, ((v - c.done[1]) * board.extH) / board.p);
      if (dd < 1.05) return {h: 0.36, tint: MINT, glow: 0.9};
      return d > -0.9 ? {h: 0.26, tint: 1} : {h: 0.22, tint: 0.86};
    }
    return {h: 0, tint: STEEL};
  };
};

export const EIGHT_AT = {u: 0.68, v: 0.55, h: 40};
export const eightField = (board: Board, face: 'up' | 'flipped'): FieldFn => {
  const f = bakedTextField(board, EIGHT, {u: EIGHT_AT.u, v: EIGHT_AT.v, height: EIGHT_AT.h}, face === 'up' ? {h: 0.75, tint: 1} : {h: 0.06, tint: 0.5});
  return f;
};

// ---------------------------------------------------------------- 13.5 grimstad-kiosk-grill

export const MENU = (menu as {categories: Array<{id: string; prices: number[]}>}).categories;
export const MENU_CHART = {u0: 0.5, u1: 0.86, v0: 0.33, height: 42, max: 217};
/** The 74 prices as bars, grouped by category with a gap between groups. */
export const menuBars = (board: Board): Array<{u: number; v: number; price: number; group: number}> => {
  const total = MENU.reduce((a, c) => a + c.prices.length, 0);
  const gaps = MENU.length - 1;
  const span = (MENU_CHART.u1 - MENU_CHART.u0) / board.p;
  const pitch = span / (total + gaps * 1.6);
  const out: Array<{u: number; v: number; price: number; group: number}> = [];
  let x = pitch / 2;
  MENU.forEach((c, gi) => {
    c.prices.forEach((p) => {
      out.push({u: MENU_CHART.u0 + x * board.p, v: MENU_CHART.v0, price: p, group: gi});
      x += pitch;
    });
    x += pitch * 1.6;
  });
  return out;
};
export const menuField = (board: Board): FieldFn => {
  const bars = menuBars(board);
  const span = (MENU_CHART.u1 - MENU_CHART.u0) / board.p;
  const pitch = span / (74 + (MENU.length - 1) * 1.6);
  const halfW = pitch * 0.36;
  return (u, v) => {
    const py = ((v - MENU_CHART.v0) * board.extH) / board.p;
    if (py < -0.5 || py > MENU_CHART.height + 1) return {h: 0, tint: STEEL};
    // nearest bar by u
    let best = -1;
    let bd = Infinity;
    for (let k = 0; k < bars.length; k++) {
      const d = Math.abs((u - bars[k].u) / board.p);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best < 0 || bd > halfW + 0.3) return {h: 0, tint: STEEL};
    const b = bars[best];
    const top = (b.price / MENU_CHART.max) * MENU_CHART.height;
    if (py > top) return {h: 0, tint: STEEL};
    const k = py / MENU_CHART.height;
    const tip = py > top - 1.3;
    return {h: 0.14 + 0.36 * k, tint: tip ? MINT : 0.95, glow: tip ? 0.55 : 0};
  };
};

// ---------------------------------------------------------------- 13.6 Trondheim-Cookies

/** The delivery rule as pins: three ways to free delivery, one fee. */
export const RULE = {u: 0.57, v: 0.64, w: 13, h: 7, pitch: 16};
export const ruleTile = (board: Board, k: number): [number, number] => [RULE.u + pinsU(board, (k - 1) * RULE.pitch), RULE.v];
export const FREE_AT: [number, number] = [0.785, 0.64];
export const FEE_AT: [number, number] = [0.785, 0.54];
export const deliveryField = (board: Board, lit: boolean): FieldFn => {
  const tiles = [0, 1, 2].map((k) => {
    const [tu, tv] = ruleTile(board, k);
    return rectSd(board, {u: tu, v: tv, w: RULE.w, h: RULE.h, radius: 2});
  });
  const free = rectSd(board, {u: FREE_AT[0], v: FREE_AT[1], w: 12, h: 7, radius: 3});
  const fee = rectSd(board, {u: FEE_AT[0], v: FEE_AT[1], w: 12, h: 7, radius: 3});
  const arrow = segmentField(board, [RULE.u + pinsU(board, RULE.pitch + RULE.w / 2 + 0.8), RULE.v], [FREE_AT[0] - pinsU(board, 6.8), FREE_AT[1]], 0.9, lit ? {h: 0.08, tint: MINT, glow: 0.7} : {h: 0.05, tint: 0.85});
  return (u, v, i) => {
    for (const sd of tiles) {
      const d = sd(u, v);
      if (d < 0.4) return d > -1 ? {h: 0.22, tint: 1} : {h: 0.14, tint: 0.8};
    }
    const df = free(u, v);
    if (df < 0.4) return lit ? {h: 0.26, tint: MINT, glow: 0.75} : {h: 0.2, tint: 0.9};
    const de = fee(u, v);
    if (de < 0.4) return de > -1 ? {h: 0.2, tint: 0.92} : {h: 0.12, tint: 0.7};
    const a = arrow(u, v, i);
    if (a.h > 0.01) return a;
    return {h: 0, tint: STEEL};
  };
};

/** A 59 kr cookie with its 10% slice lifted out. */
export const COOKIE = {u: 0.605, v: 0.49, r: 8};
export const cookieField = (board: Board, slice: 'in' | 'out'): FieldFn => {
  return (u, v) => {
    const ex = (u - COOKIE.u) / board.p;
    const ey = ((v - COOKIE.v) * board.extH) / board.p;
    // the slice: 36 degrees, pushed out along its bisector when 'out'
    const bis = (54 * Math.PI) / 180;
    const off = slice === 'out' ? 3 : 0;
    const sx = ex - Math.cos(bis) * off;
    const sy = ey - Math.sin(bis) * off;
    const rs = Math.hypot(sx, sy);
    const as = Math.atan2(sy, sx);
    if (rs <= COOKIE.r && as >= (36 * Math.PI) / 180 && as <= (72 * Math.PI) / 180) return {h: slice === 'out' ? 0.42 : 0.3, tint: slice === 'out' ? MINT : WARM, glow: slice === 'out' ? 0.6 : 0};
    const r = Math.hypot(ex, ey);
    const a = Math.atan2(ey, ex);
    if (r <= COOKIE.r && !(a >= (36 * Math.PI) / 180 && a <= (72 * Math.PI) / 180)) {
      const chunk = (((Math.floor(ex * 0.9) * 73856093) ^ (Math.floor(ey * 0.9) * 19349663)) >>> 0) % 7 === 0;
      return {h: chunk ? 0.36 : 0.28, tint: chunk ? [0.62, 0.48, 0.38] : WARM};
    }
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 13.7 ballast

/** Three stacked layers: the model proposes, the strategy disposes, risk has the last word. */
export const LAYERS = {u: 0.585, v: [0.72, 0.61, 0.5], w: 30, h: 7};
export const layersField = (board: Board, hold: 'on' | 'grey', exitLit: boolean): FieldFn => {
  const sds = LAYERS.v.map((lv) => rectSd(board, {u: LAYERS.u, v: lv, w: LAYERS.w, h: LAYERS.h, radius: 1.6}));
  return (u, v) => {
    for (let k = 0; k < 3; k++) {
      const d = sds[k](u, v);
      if (d > 0.45) continue;
      if (k === 2) return d > -1 ? {h: 0.36, tint: exitLit ? MINT : 1, glow: exitLit ? 0.7 : 0} : {h: 0.3, tint: exitLit ? MINT_DIM : 0.9};
      if (k === 1 && hold === 'grey') return d > -1 ? {h: 0.1, tint: 0.6} : {h: 0.06, tint: 0.5};
      return d > -1 ? {h: 0.22, tint: 0.95} : {h: 0.16, tint: 0.78};
    }
    return {h: 0, tint: STEEL};
  };
};
/** The test's price path: 100 -> 94 past a stop at 95. */
export const PRICE = {u0: 0.7, u1: 0.815, v0: 0.42, v1: 0.74, lo: 92, hi: 101};
export const PRICE_STEPS = [100, 99, 97.5, 96, 94];
export const priceField = (board: Board, steps: number, fired: boolean): FieldFn => {
  const vy = (p: number) => PRICE.v0 + ((p - PRICE.lo) / (PRICE.hi - PRICE.lo)) * (PRICE.v1 - PRICE.v0);
  const ux = (k: number) => PRICE.u0 + (k / (PRICE_STEPS.length - 1)) * (PRICE.u1 - PRICE.u0);
  const segs: FieldFn[] = [];
  for (let k = 0; k < Math.min(steps, PRICE_STEPS.length - 1); k++)
    segs.push(segmentField(board, [ux(k), vy(PRICE_STEPS[k])], [ux(k + 1), vy(PRICE_STEPS[k + 1])], 1.3, k >= PRICE_STEPS.length - 2 && fired ? {h: 0.26, tint: AMBER, glow: 0.4} : {h: 0.22, tint: 1}));
  const stop = vy(95);
  return (u, v, i) => {
    for (const s of segs) {
      const r = s(u, v, i);
      if (r.h > 0.02) return r;
    }
    // the stop: a dashed line of lit pins at 95
    const dy = Math.abs((v - stop) * board.extH) / board.p;
    if (dy < 0.55 && u >= PRICE.u0 && u <= PRICE.u1 && Math.floor((u - PRICE.u0) / board.p / 2.2) % 2 === 0) return {h: 0.1, tint: fired ? MINT : 0.95, glow: fired ? 0.8 : 0.2};
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 13.8 hugin

export const LADDER = {u: 0.62, v: [0.4, 0.545, 0.69], w: 34, h: 6};
export const BREAKERS = {u: 0.795, v0: 0.4, step: 5};
export const ladderField = (board: Board, rungs: number): FieldFn => {
  const sds = LADDER.v.map((lv) => rectSd(board, {u: LADDER.u, v: lv, w: LADDER.w, h: LADDER.h, radius: 1.5}));
  const rails = [-1, 1].map((s) => segmentField(board, [LADDER.u + s * pinsU(board, LADDER.w / 2 + 1.5), LADDER.v[0] - 0.035], [LADDER.u + s * pinsU(board, LADDER.w / 2 + 1.5), LADDER.v[2] + 0.035], 1.2, {h: 0.16, tint: 0.86}));
  const breakers = Array.from({length: 8}, (_, k) => circleField(board, {u: BREAKERS.u, v: BREAKERS.v0 + k * pinsV(board, BREAKERS.step), r: 1.6}, {h: 0.3, tint: 1, glow: 0.25}));
  return (u, v, i) => {
    for (let k = 0; k < 3; k++) {
      const d = sds[k](u, v);
      if (d < 0.45) return k < rungs ? (d > -1 ? {h: 0.3, tint: k === 2 ? MINT : 1, glow: k === 2 ? 0.6 : 0} : {h: 0.24, tint: 0.88}) : {h: 0.04, tint: 0.62};
    }
    for (const r of rails) {
      const s = r(u, v, i);
      if (s.h > 0.02) return s;
    }
    for (const b of breakers) {
      const s = b(u, v, i);
      if (s.h > 0.02) return s;
    }
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 13.9 Goblin

export const SERVICES = ['api-gateway', 'backtesting', 'continuous-learner', 'executor', 'feature-store', 'market-data', 'portfolio-optimizer', 'position', 'prediction', 'risk', 'sentiment-analysis', 'signal', 'strategy', 'trend-analysis'] as const;
export const BUS = {u0: 0.515, u1: 0.815, v: 0.58};
export const SERVICE_BOX = {w: 6.5, h: 4.5};
export const serviceAt = (board: Board, k: number): [number, number] => {
  const col = k % 7;
  const up = k < 7;
  return [BUS.u0 + ((col + 0.5) / 7) * (BUS.u1 - BUS.u0), BUS.v + (up ? 1 : -1) * pinsV(board, 7)];
};
export const HIT = {u0: 0.53, u1: 0.8, v: 0.55};
export const goblinField = (board: Board, show: 'bus' | 'hit'): FieldFn => {
  const bus = segmentField(board, [BUS.u0, BUS.v], [BUS.u1, BUS.v], 1.6, {h: 0.12, tint: MINT_DIM, glow: 0.45});
  const nodes = SERVICES.map((_, k) => {
    const [nu, nv] = serviceAt(board, k);
    return {box: rectSd(board, {u: nu, v: nv, w: SERVICE_BOX.w, h: SERVICE_BOX.h, radius: 1}), stub: segmentField(board, [nu, nv], [nu, BUS.v], 0.7, {h: 0.06, tint: 0.85})};
  });
  const hitTrack = rectSd(board, {u: (HIT.u0 + HIT.u1) / 2, v: HIT.v, w: (HIT.u1 - HIT.u0) / board.p, h: 4.5, radius: 1.2});
  const at = (x: number) => HIT.u0 + (HIT.u1 - HIT.u0) * x;
  return (u, v, i) => {
    if (show === 'hit') {
      // the coin-flip line at 50% (dashed, from the track up), the measured 45.2% as a calm bar
      const dx = Math.abs((u - at(0.5)) / board.p);
      const dy = ((v - HIT.v) * board.extH) / board.p;
      if (dx < 0.6 && dy > -2.6 && dy < 6.5 && Math.floor((dy + 6) / 1.6) % 2 === 0) return {h: 0.18, tint: 1, glow: 0.3};
      if (hitTrack(u, v) < 0.3) return u <= at(0.452) ? {h: 0.24, tint: 1} : {h: 0.03, tint: 0.5};
      return {h: 0, tint: STEEL};
    }
    for (const n of nodes) {
      const d = n.box(u, v);
      if (d < 0.4) return d > -0.9 ? {h: 0.26, tint: 1} : {h: 0.2, tint: 0.84};
    }
    const b = bus(u, v, i);
    if (b.h > 0.02) return b;
    for (const n of nodes) {
      const s = n.stub(u, v, i);
      if (s.h > 0.02) return s;
    }
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- the street of chapter 13

/** Six plots, left to right; the walk runs right, so the house plot (Knotten) is last. */
export const STREET13 = ['c13-desk', 'c13-desk', 'c13-desk', 'c13-bakery', 'c13-grill', 'c13-house'] as const;
export const STREET13_V = 0.53;
export const PLOT13 = 16;
export const PITCH13 = 22;
export const street13U = (board: Board, k: number) => 0.5 + (k - 2.5) * PITCH13 * board.p;
export const street13Field = (board: Board, v = STREET13_V, lit: readonly number[] = []): FieldFn => {
  const layers = STREET13.map((name, k) => {
    const u = street13U(board, k);
    const icon = iconField(board, name, {u, v, height: PLOT13 - 2}, {ground: 0.42});
    const field = plotField(board, {u, v, size: PLOT13}, icon, {lit: lit.includes(k)});
    const box: Box = [u - pinsU(board, PLOT13 / 2 + 1), v - pinsV(board, PLOT13 / 2 + 1), u + pinsU(board, PLOT13 / 2 + 1), v + pinsV(board, PLOT13 / 2 + 1)];
    return {box, field};
  });
  const road = rectField(board, {u: 0.5, v: v - pinsV(board, PLOT13 / 2 + 3.5), w: PITCH13 * 6 - 2, h: 1}, {h: 0.05, tint: 0.62, soft: 0.4});
  return regions(road, layers);
};

/** A thin mint rule of lit pins under the closing statement. */
export const closingRule = (board: Board, v: number, u0: number, u1: number): FieldFn => segmentField(board, [u0, v], [u1, v], 1.1, {h: 0.1, tint: MINT, glow: 1});

void emblemPixels;
void flatField;
void circleField;
export type {Look};
