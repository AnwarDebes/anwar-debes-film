import {
  barsField,
  circleField,
  col,
  emblemField,
  emblemPixels,
  flatField,
  inside01,
  placer,
  rectField,
  samplePixels,
  smooth01,
  STEEL,
  type Board,
  type FieldFn,
  type Look,
  type PinSample,
  type Pixels,
  type Place,
} from '../../../../engine/pins';

// Pin fields shared by chapters 10 and 13: the street icons (drawn on the emblem convention:
// red = height, green = brightness, on a 256 px canvas), layering by region, baked rasters and a
// few data primitives. All pure functions of (u, v, i).

export type Box = [number, number, number, number];
type Ctx = CanvasRenderingContext2D;

export const MINT: [number, number, number] = [0.62, 1.0, 0.86];
export const MINT_DIM: [number, number, number] = [0.55, 0.82, 0.74];
export const AMBER: [number, number, number] = [1.0, 0.78, 0.32];
export const WARM: [number, number, number] = [1.0, 0.86, 0.68];
export const COOL: [number, number, number] = [0.7, 0.82, 0.95];

const inBox = (u: number, v: number, b: Box) => u >= b[0] && u <= b[2] && v >= b[1] && v <= b[3];

/** Layer fields by region: the first layer whose box holds the pin decides it. */
export const regions = (base: FieldFn, layers: Array<{box: Box; field: FieldFn}>): FieldFn => (u, v, i) => {
  for (let k = 0; k < layers.length; k++) {
    const l = layers[k];
    if (inBox(u, v, l.box)) return l.field(u, v, i);
  }
  return base(u, v, i);
};

/** The uv box of a place (centre and size in pins) with a margin in pins. */
export const boxOf = (board: Board, p: {u: number; v: number; w: number; h: number}, margin = 1): Box => {
  const hu = ((p.w / 2 + margin) * board.p);
  const hv = ((p.h / 2 + margin) * board.p) / board.extH;
  return [p.u - hu, p.v - hv, p.u + hu, p.v + hv];
};

/** Horizontal distance in pins. */
export const pinsU = (board: Board, n: number) => n * board.p;
/** Vertical distance in pins, as v. */
export const pinsV = (board: Board, n: number) => (n * board.p) / board.extH;

// ---------------------------------------------------------------- icons

const rr = (x: Ctx, X: number, Y: number, W: number, H: number, r: number) => {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
};
const disc = (x: Ctx, cx: number, cy: number, r: number) => {
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
};
const ring = (x: Ctx, cx: number, cy: number, r: number, w: number) => {
  x.lineWidth = w;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.stroke();
};

/** Drawers for the street plots of chapters 10 and 13 (names are prefixed to keep caches apart). */
export const ICONS: Record<string, (x: Ctx) => void> = {
  'c10-db3'(x) {
    // three database cylinders: the same reports in three stores
    const cyl = (cx: number, top: number, h: number) => {
      const rx = 30;
      const ry = 11;
      x.fillStyle = col(h);
      x.fillRect(cx - rx, top, rx * 2, 112);
      x.beginPath();
      x.ellipse(cx, top + 112, rx, ry, 0, 0, Math.PI);
      x.fill();
      x.fillStyle = col(Math.min(1, h + 0.25), 1);
      x.beginPath();
      x.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = col(Math.min(1, h + 0.15), 1);
      x.lineWidth = 5;
      for (const yy of [top + 40, top + 76]) {
        x.beginPath();
        x.ellipse(cx, yy, rx, ry, 0, 0, Math.PI);
        x.stroke();
      }
    };
    cyl(56, 74, 0.6);
    cyl(128, 60, 0.7);
    cyl(200, 74, 0.6);
  },
  'c10-drone'(x) {
    // a quadcopter seen from above: body, four arms, four rotor rings
    const c = 128;
    const a = 70;
    x.strokeStyle = col(0.5);
    x.lineWidth = 14;
    x.beginPath();
    x.moveTo(c - a, c - a);
    x.lineTo(c + a, c + a);
    x.moveTo(c + a, c - a);
    x.lineTo(c - a, c + a);
    x.stroke();
    x.strokeStyle = col(0.85, 1);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ring(x, c + dx * a, c + dy * a, 34, 9);
    x.fillStyle = col(0.7, 0.9);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) disc(x, c + dx * a, c + dy * a, 9);
    x.fillStyle = col(0.95, 1);
    rr(x, c - 30, c - 22, 60, 44, 12);
    x.fill();
  },
  'c10-cv'(x) {
    // a CV page: header, a photo box and lines of text
    x.fillStyle = col(0.32);
    rr(x, 54, 22, 148, 212, 10);
    x.fill();
    x.fillStyle = col(0.78, 1);
    rr(x, 72, 42, 46, 54, 6);
    x.fill();
    x.fillStyle = col(0.9, 1);
    x.fillRect(130, 48, 56, 12);
    x.fillStyle = col(0.6, 0.95);
    x.fillRect(130, 72, 44, 8);
    for (let k = 0; k < 6; k++) x.fillRect(72, 118 + k * 18, k % 3 === 2 ? 70 : 112, 8);
  },
  'c10-wave'(x) {
    // a waveform: mirrored bars of a short phrase
    const n = 19;
    for (let k = 0; k < n; k++) {
      const s = k / (n - 1);
      const amp = 0.22 + 0.78 * Math.abs(Math.sin(s * 7.1 + 0.4) * 0.65 + Math.sin(s * 15.3) * 0.35);
      const h = 18 + amp * 86;
      x.fillStyle = col(0.5 + 0.45 * amp, 1);
      rr(x, 24 + k * 11, 128 - h, 7, h * 2, 3);
      x.fill();
    }
  },
  'c10-gpu'(x) {
    // a graphics card: board, two fans, the connector and the bracket
    x.fillStyle = col(0.4);
    rr(x, 30, 70, 196, 112, 10);
    x.fill();
    x.fillStyle = col(0.7, 1);
    x.fillRect(22, 62, 12, 128);
    x.fillStyle = col(0.62, 0.95);
    for (let k = 0; k < 9; k++) x.fillRect(84 + k * 13, 184, 8, 14);
    x.strokeStyle = col(0.85, 1);
    for (const cx of [88, 168]) {
      ring(x, cx, 126, 38, 8);
      x.lineWidth = 6;
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2 + 0.3;
        x.beginPath();
        x.moveTo(cx + Math.cos(ang) * 8, 126 + Math.sin(ang) * 8);
        x.lineTo(cx + Math.cos(ang + 0.6) * 30, 126 + Math.sin(ang + 0.6) * 30);
        x.stroke();
      }
      x.fillStyle = col(0.95, 1);
      disc(x, cx, 126, 10);
    }
  },
  'c10-cookie'(x) {
    // a cookie planet with chocolate chunks and a thin ring
    x.strokeStyle = col(0.62, 0.95);
    x.lineWidth = 6;
    x.beginPath();
    x.ellipse(128, 132, 116, 30, -0.18, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = col(0.62);
    disc(x, 128, 128, 74);
    x.fillStyle = col(0.9, 1);
    for (const [cx, cy, r] of [[100, 104, 11], [146, 96, 9], [160, 140, 12], [112, 150, 10], [134, 124, 7], [88, 132, 6], [150, 166, 6]]) disc(x, cx, cy, r);
  },
  'c13-house'(x) {
    // a house on a slope with sight lines to the sea
    x.strokeStyle = col(0.45);
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(10, 200);
    x.lineTo(246, 120);
    x.stroke();
    x.fillStyle = col(0.75, 1);
    x.beginPath();
    x.moveTo(78, 120);
    x.lineTo(128, 76);
    x.lineTo(178, 120);
    x.closePath();
    x.fill();
    x.fillStyle = col(0.6);
    x.fillRect(90, 118, 76, 62);
    x.fillStyle = col(0.95, 1);
    x.fillRect(112, 134, 20, 20);
    x.strokeStyle = col(0.9, 1);
    x.lineWidth = 3;
    for (let k = -3; k <= 3; k++) {
      x.beginPath();
      x.moveTo(122, 144);
      x.lineTo(122 + k * 30, 250);
      x.stroke();
    }
  },
  'c13-grill'(x) {
    // a flame over grill bars
    x.fillStyle = col(0.95, 1);
    x.beginPath();
    x.moveTo(128, 34);
    x.bezierCurveTo(168, 84, 188, 112, 170, 146);
    x.bezierCurveTo(160, 166, 96, 166, 86, 146);
    x.bezierCurveTo(70, 116, 100, 96, 112, 70);
    x.bezierCurveTo(120, 96, 130, 104, 140, 110);
    x.bezierCurveTo(140, 84, 136, 60, 128, 34);
    x.fill();
    x.strokeStyle = col(0.6);
    x.lineWidth = 9;
    for (let k = 0; k < 5; k++) {
      x.beginPath();
      x.moveTo(50, 182 + k * 0);
      x.moveTo(52 + k * 38, 176);
      x.lineTo(52 + k * 38, 222);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(40, 176);
    x.lineTo(216, 176);
    x.moveTo(40, 222);
    x.lineTo(216, 222);
    x.stroke();
  },
  'c13-bakery'(x) {
    // a cookie in a basket
    x.fillStyle = col(0.5);
    x.beginPath();
    x.moveTo(40, 132);
    x.lineTo(216, 132);
    x.lineTo(192, 220);
    x.lineTo(64, 220);
    x.closePath();
    x.fill();
    x.strokeStyle = col(0.72, 1);
    x.lineWidth = 6;
    for (let k = 0; k < 5; k++) {
      x.beginPath();
      x.moveTo(60 + k * 34, 140);
      x.lineTo(74 + k * 27, 214);
      x.stroke();
    }
    x.fillStyle = col(0.75, 1);
    disc(x, 128, 104, 52);
    x.fillStyle = col(0.98, 1);
    for (const [cx, cy, r] of [[108, 88, 8], [146, 96, 9], [122, 120, 7], [150, 124, 6]]) disc(x, cx, cy, r);
  },
  'c13-desk'(x) {
    // a trading desk: candles with their numbers blanked
    const vals = [0.42, 0.55, 0.47, 0.66, 0.6, 0.74, 0.58];
    x.strokeStyle = col(0.36);
    x.lineWidth = 4;
    x.strokeRect(26, 30, 204, 170);
    vals.forEach((vv, k) => {
      const cx = 46 + k * 28;
      const top = 190 - vv * 150;
      x.strokeStyle = col(0.7, 1);
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(cx, top - 16);
      x.lineTo(cx, top + 46);
      x.stroke();
      x.fillStyle = col(0.85, 1);
      x.fillRect(cx - 7, top, 14, 30);
    });
    x.fillStyle = col(0.55, 0.85);
    for (let k = 0; k < 3; k++) rr(x, 40 + k * 64, 214, 48, 16, 5), x.fill();
  },
};

/** Register an icon drawer (cached under its name) and return it as a field. */
export const iconField = (board: Board, name: string, place: Place, opts: {ground?: number; height?: number; glowAbove?: number} = {}): FieldFn => {
  const drawer = ICONS[name];
  if (drawer) emblemPixels(name, drawer);
  return emblemField(board, name, place, opts);
};

// ---------------------------------------------------------------- plots and shapes

/** Steel ground of the wall (flat, the reel's tint). */
export const ground = (tint = STEEL): FieldFn => flatField(tint);

/** Signed distance in pins from a uv point to a rounded rectangle (centre uv, size in pins). */
export const rectSd = (board: Board, r: {u: number; v: number; w: number; h: number; radius?: number}) => {
  const rad = r.radius ?? 0;
  const hx = r.w / 2 - rad;
  const hy = r.h / 2 - rad;
  const ip = 1 / board.p;
  return (u: number, v: number) => {
    const qx = Math.abs((u - r.u) * ip) - hx;
    const qy = Math.abs((v - r.v) * board.extH * ip) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
  };
};

/** A plot: a thin raised rim around a square of slightly darker steel, with an icon in it. */
export const plotField = (
  board: Board,
  p: {u: number; v: number; size: number; w?: number},
  icon: FieldFn | null,
  opts: {lit?: boolean; dim?: boolean; rimH?: number} = {},
): FieldFn => {
  const sd = rectSd(board, {u: p.u, v: p.v, w: p.w ?? p.size, h: p.size, radius: 2.4});
  const rimH = opts.rimH ?? 0.07;
  const rim: PinSample = opts.lit ? {h: rimH + 0.03, tint: MINT, glow: 0.9} : {h: rimH, tint: opts.dim ? 0.55 : 0.8};
  const floor: PinSample = {h: 0, tint: opts.dim ? 0.4 : 0.5};
  const base: PinSample = {h: 0, tint: STEEL};
  return (u, v, i) => {
    const d = sd(u, v);
    if (d > 0.45) return base;
    if (d > -1.1) return rim;
    if (icon) {
      const ic = icon(u, v, i);
      if (ic.h > 0.02) return opts.dim ? {h: ic.h * 0.55, tint: 0.6} : ic;
    }
    return floor;
  };
};

/** Raised text-free bars with an explicit look per bar. */
export const bars = (
  board: Board,
  chart: {u: number; v: number; width: number; height: number; values: readonly number[]; gap?: number},
  look: (k: number, value: number) => Look,
): FieldFn => barsField(board, chart, {looks: look, ground: 0.9});

export const disc01 = circleField;

/** A thin line of pins between two uv points (inclusive), `w` pins wide. */
export const segmentField = (board: Board, a: [number, number], b: [number, number], w: number, look: Look): FieldFn => {
  const ax = a[0];
  const ay = a[1] * board.extH;
  const bx = b[0];
  const by = b[1] * board.extH;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  const half = (w * board.p) / 2;
  const soft = 0.5 * board.p;
  const base: PinSample = {h: 0, tint: STEEL};
  return (u, v) => {
    const px = u - ax;
    const py = v * board.extH - ay;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
    const ex = px - dx * t;
    const ey = py - dy * t;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d > half + soft) return base;
    const k = smooth01((half + soft - d) / (2 * soft));
    return {h: (look.h ?? 0.2) * k, tint: look.tint ?? 1, glow: (look.glow ?? 0) * k, paint: look.paint};
  };
};

// ---------------------------------------------------------------- baked rasters

/** A grey raster baked offline (R channel only, base64), sampled like an image. */
export interface BakedRaster {
  w: number;
  h: number;
  /** ink height / raster height */
  inkFrac: number;
  data: string;
}

const bakedCache = new Map<string, Pixels>();

/** Decode a baked raster into RGBA pixels (R = coverage), cached by its data. */
export const bakedPixels = (r: BakedRaster): Pixels => {
  const hit = bakedCache.get(r.data);
  if (hit) return hit;
  const bin = atob(r.data);
  const data = new Uint8ClampedArray(r.w * r.h * 4);
  for (let k = 0; k < r.w * r.h; k++) {
    const g = bin.charCodeAt(k);
    data[k * 4] = g;
    data[k * 4 + 1] = g;
    data[k * 4 + 2] = g;
    data[k * 4 + 3] = 255;
  }
  const px = {width: r.w, height: r.h, data};
  bakedCache.set(r.data, px);
  return px;
};

/**
 * Text pressed into pins from a raster baked in the film's own font (so a field never depends on
 * whether the web font had loaded when the wall was compiled). `place.height` is the ink height.
 */
export const bakedTextField = (
  board: Board,
  r: BakedRaster,
  place: Omit<Place, 'width'>,
  opts: {h?: number; tint?: number | [number, number, number]; ground?: number; glow?: number} = {},
): FieldFn => {
  const px = bakedPixels(r);
  const {local} = placer(board, {...place, height: place.height / Math.max(0.2, r.inkFrac)}, r.w / r.h);
  const hk = opts.h ?? 0.5;
  const g = opts.ground ?? STEEL;
  const tint = opts.tint ?? 1;
  const glow = opts.glow ?? 0;
  const outside: PinSample = {h: 0, tint: g};
  return (u, v) => {
    const [s, t] = local(u, v);
    if (!inside01(s, t)) return outside;
    const a = samplePixels(px, s, t, 0);
    if (a <= 0.004) return outside;
    const tt: number | [number, number, number] =
      typeof tint === 'number' ? g + (tint - g) * a : [g + (tint[0] - g) * a, g + (tint[1] - g) * a, g + (tint[2] - g) * a];
    return {h: a * hk, tint: tt, glow: glow * a};
  };
};
