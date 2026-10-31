import type {Board, FieldFn, LiveFieldFn, PinSample, RGB} from '../../../engine/pins';
import {smooth01} from '../../../engine/pins';
import {ADVANCE, GLYPH_H, LINE_PITCH, textCoverage} from './kit/pixfont';

// A terminal window pressed into the pins: a dark plate, a title strip, log lines in the pixel
// font that scroll up as new ones print, and a spinner in the corner that turns on its own clock.
// The plate is a beat field (static); the text and the spinner are a live layer (every frame).

export interface TermLine {
  text: string;
  /** film time the line starts printing */
  at: number;
  /** 'cmd' lines start with "$ " and type on; 'out' lines print whole */
  kind: 'cmd' | 'out';
  /** characters per second for typed lines */
  cps?: number;
  /** mint, glowing: the line the narration names */
  mark?: {from: number; to?: number};
}

export interface TermSpec {
  board: Board;
  /** centre of the plate, board uv */
  center: [number, number];
  /** size in pin pitches */
  w: number;
  h: number;
  lines: readonly TermLine[];
  /** visible text rows */
  rows: number;
  /** the spinner turns from `spinFrom`; at `burst` it bursts into coral pins and is gone */
  spinFrom: number;
  burst?: number;
  /** the spinner's period per step, seconds */
  spinStep?: number;
  /** pins colour: plate, text, command text */
  plate?: RGB;
  ink?: RGB;
  cmdInk?: RGB;
  /** extra spinner: a second, small spinner somewhere else (the 07.6 callback) */
}

const MINT_TINT: RGB = [0.62, 1.0, 0.86];
const CORAL: RGB = [0.69, 0.18, 0.1];

export interface TermGeometry {
  /** world position of the plate's top-left corner */
  x0: number;
  y0: number;
  /** text origin (top-left of row 0), pins from the plate corner */
  tx: number;
  ty: number;
  /** spinner centre, pins from the plate corner */
  sx: number;
  sy: number;
  /** spinner centre, board uv */
  spinnerUv: [number, number];
  region: [number, number, number, number];
}

export const termGeometry = (s: TermSpec): TermGeometry => {
  const {board} = s;
  const p = board.p;
  const cx = s.center[0] - 0.5;
  const cy = s.center[1] * board.extH - board.extH / 2;
  const x0 = cx - (s.w * p) / 2;
  const y0 = cy + (s.h * p) / 2;
  const sx = s.w - 7;
  const sy = 5;
  const spinnerUv: [number, number] = [x0 + sx * p + 0.5, (y0 - sy * p + board.extH / 2) / board.extH];
  const pad = 2 * p;
  const region: [number, number, number, number] = [
    x0 + 0.5 - pad,
    (y0 - s.h * p + board.extH / 2) / board.extH - pad / board.extH,
    x0 + s.w * p + 0.5 + pad,
    (y0 + board.extH / 2) / board.extH + pad / board.extH,
  ];
  return {x0, y0, tx: 6, ty: 11, sx, sy, spinnerUv, region};
};

/** The plate and its title strip (three dots, a rule), as a static field over a ground field. */
export const termPlateField = (s: TermSpec, ground: FieldFn): FieldFn => {
  const g = termGeometry(s);
  const {board} = s;
  const p = board.p;
  const plate = s.plate ?? [0.2, 0.18, 0.16];
  return (u, v, i) => {
    const x = (u - 0.5 - g.x0) / p;
    const y = (g.y0 - (v * board.extH - board.extH / 2)) / p;
    if (x < -0.6 || x > s.w + 0.6 || y < -0.6 || y > s.h + 0.6) return ground(u, v, i);
    // soft edge
    const e = Math.min(x + 0.6, s.w + 0.6 - x, y + 0.6, s.h + 0.6 - y);
    const a = smooth01(e / 1.2);
    const base = ground(u, v, i);
    let h = 0.05;
    let tint: RGB = plate;
    // title strip: three dots and a rule under it
    if (y < 8.4) {
      tint = [plate[0] * 1.18, plate[1] * 1.18, plate[2] * 1.18];
      h = 0.07;
      for (let k = 0; k < 3; k++) {
        const dx = x - (4 + k * 3.2);
        const dy = y - 4.4;
        if (dx * dx + dy * dy < 1.25 * 1.25) {
          h = 0.16;
          tint = [0.62, 0.58, 0.52];
        }
      }
    } else if (y < 9.3) {
      h = 0.03;
      tint = [plate[0] * 0.8, plate[1] * 0.8, plate[2] * 0.8];
    }
    const bt = typeof base.tint === 'number' ? ([base.tint, base.tint, base.tint] as RGB) : base.tint;
    return {
      h: base.h + (h - base.h) * a,
      tint: [bt[0] + (tint[0] - bt[0]) * a, bt[1] + (tint[1] - bt[1]) * a, bt[2] + (tint[2] - bt[2]) * a],
      glow: (base.glow ?? 0) * (1 - a),
      paint: (base.paint ?? 0) * (1 - a),
    };
  };
};

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));

/** The scrolling text and the spinner (live). */
export const termLiveField = (s: TermSpec): LiveFieldFn => {
  const g = termGeometry(s);
  const {board} = s;
  const p = board.p;
  const ink = s.ink ?? [0.78, 0.74, 0.68];
  const cmdInk = s.cmdInk ?? [1.02, 0.98, 0.92];
  const step = s.spinStep ?? 0.1;
  const textTop = g.ty - 1;
  const textBottom = g.ty + s.rows * LINE_PITCH - 1;
  const chars = s.lines.map((l) => [...l.text]);
  // per frame: which lines are where
  let lastT = NaN;
  const slotY = new Float64Array(s.lines.length);
  const shown = new Int32Array(s.lines.length);
  const visible: number[] = [];
  const out: PinSample = {h: 0, tint: [0, 0, 0], glow: 0, paint: 0};
  const outTint = out.tint as RGB;

  const prepare = (t: number) => {
    lastT = t;
    visible.length = 0;
    let n = 0;
    for (let j = 0; j < s.lines.length; j++) if (s.lines[j].at <= t) n = j + 1;
    // scroll: the newest line slides up into the last slot
    const newest = n > 0 ? s.lines[n - 1].at : 0;
    const sk = n > 0 ? 1 - ease((t - newest) / 0.24) : 0;
    for (let j = 0; j < n; j++) {
      const slot = s.rows - 1 - (n - 1 - j) + sk;
      if (slot < -1 || slot > s.rows) continue;
      slotY[j] = g.ty + slot * LINE_PITCH;
      const l = s.lines[j];
      const typed = l.kind === 'cmd' ? Math.floor((t - l.at) * (l.cps ?? 26)) + 2 : chars[j].length;
      shown[j] = Math.max(0, Math.min(chars[j].length, typed));
      visible.push(j);
    }
  };

  return (u, v, _i, t) => {
    if (t !== lastT) prepare(t);
    const x = (u - 0.5 - g.x0) / p;
    const y = (g.y0 - (v * board.extH - board.extH / 2)) / p;
    // spinner
    const dxs = x - g.sx;
    const dys = y - g.sy;
    const burstK = s.burst !== undefined ? (t - s.burst) / 0.7 : -1;
    const reach = burstK > 0 ? 196 : 36;
    if (dxs * dxs + dys * dys < reach && t >= s.spinFrom) {
      if (burstK >= 1) return null;
      const head = Math.floor((t - s.spinFrom) / step) % 8;
      let best = 0;
      let bestK = 0;
      const r = burstK > 0 ? 2.6 + 9 * ease(burstK) : 2.6;
      const rad = burstK > 0 ? 0.95 * (1 - 0.6 * burstK) : 0.95;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        const d = Math.hypot(dxs - px, dys - py);
        const c = smooth01((rad + 0.5 - d) / 1.0);
        if (c > best) {
          best = c;
          bestK = k;
        }
      }
      if (best <= 0.01) return null;
      const trail = (head - bestK + 8) % 8;
      const b = burstK > 0 ? 1 : [1, 0.62, 0.4, 0.26, 0.17, 0.12, 0.1, 0.1][trail];
      out.h = 0.05 + best * (0.03 + 0.07 * b);
      if (burstK > 0) {
        const fade = 1 - burstK;
        outTint[0] = CORAL[0];
        outTint[1] = CORAL[1];
        outTint[2] = CORAL[2];
        out.paint = best * fade;
        out.glow = 0;
        out.h *= fade + 0.2;
      } else {
        const k = 0.35 + 0.65 * b;
        outTint[0] = 0.26 + (cmdInk[0] - 0.26) * k * best;
        outTint[1] = 0.24 + (cmdInk[1] - 0.24) * k * best;
        outTint[2] = 0.21 + (cmdInk[2] - 0.21) * k * best;
        out.paint = 0;
        out.glow = 0;
      }
      return out;
    }
    if (x < g.tx - 1 || x > s.w - 2 || y < textTop - 1 || y > textBottom + 1) return null;
    // text: find the line under this pin
    let cov = 0;
    let line = -1;
    for (let q = 0; q < visible.length; q++) {
      const j = visible[q];
      const ly = y - slotY[j];
      if (ly < -1 || ly > GLYPH_H + 1) continue;
      const c = textCoverage(chars[j], x - g.tx, ly, shown[j]);
      // a block cursor after the typed part of a command that is still typing
      const l = s.lines[j];
      let cur = 0;
      if (l.kind === 'cmd' && j === visible[visible.length - 1]) {
        const cx = shown[j] * ADVANCE;
        const blink = Math.floor((t - l.at) / 0.45) % 2 === 0 ? 1 : 0.35;
        if (x - g.tx >= cx && x - g.tx < cx + 5 && ly >= 0 && ly < GLYPH_H - 1) cur = 0.75 * blink;
      }
      const cc = Math.max(c, cur);
      if (cc > cov) {
        cov = cc;
        line = j;
      }
    }
    if (line < 0 || cov <= 0.02) return null;
    // fade at the top and bottom of the text area (the fold)
    const edge = smooth01(Math.min(y - textTop, textBottom - y) / 2.5);
    const c = cov * edge;
    if (c <= 0.02) return null;
    const l = s.lines[line];
    const marked = l.mark && t >= l.mark.from && (l.mark.to === undefined || t < l.mark.to);
    const markK = marked ? Math.min(1, (t - l.mark!.from) / 0.3) : 0;
    const base = l.kind === 'cmd' ? cmdInk : ink;
    const tint0 = base[0] + (MINT_TINT[0] - base[0]) * markK;
    const tint1 = base[1] + (MINT_TINT[1] - base[1]) * markK;
    const tint2 = base[2] + (MINT_TINT[2] - base[2]) * markK;
    const plate = s.plate ?? [0.2, 0.18, 0.16];
    out.h = 0.05 + c * (l.kind === 'cmd' ? 0.075 : 0.05);
    outTint[0] = plate[0] + (tint0 - plate[0]) * c;
    outTint[1] = plate[1] + (tint1 - plate[1]) * c;
    outTint[2] = plate[2] + (tint2 - plate[2]) * c;
    out.glow = 0.85 * markK * c;
    out.paint = 0;
    return out;
  };
};
