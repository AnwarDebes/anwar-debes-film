// Project emblems for the pin wall, ported from the site's emblems.js. Each is drawn on a 256 x 256
// canvas: red = pin height, green = pin brightness, blurred 1.1 px so slopes read as slopes.
// New repos get new drawers on the same convention.

import type {Board} from '../board';
import type {FieldFn, PinSample} from '../types';
import {samplePixels, type Pixels} from './image';
import {inside01, placer, type Place} from './place';

const S = 256;
type Ctx = CanvasRenderingContext2D;
type P = [number, number];

/** height 0..1 and brightness 0..1 packed into a colour */
export const col = (h: number, b = 0.92) => `rgb(${Math.round(h * 255)}, ${Math.round(b * 255)}, 0)`;

const roundRect = (x: Ctx, X: number, Y: number, W: number, H: number, r: number) => {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
};

const disc = (x: Ctx, p: P, r: number) => {
  x.beginPath();
  x.arc(p[0], p[1], r, 0, Math.PI * 2);
  x.fill();
};

const draw: Record<string, (x: Ctx) => void> = {
  glassbox(x) {
    // an isometric wire cube, back edges low, front edges high, one clause in the middle
    const c: P = [128, 136];
    const a = 70;
    const Pt = (X: number, Y: number, Z: number): P => [c[0] + (X - Z) * a * 0.866, c[1] + (X + Z) * a * 0.5 - Y * a];
    const v: Record<string, P> = {};
    for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) v[`${X}${Y}${Z}`] = Pt(X * 0.62, Y * 0.62, Z * 0.62);
    const edge = (p: string, q: string, h: number, w: number) => {
      x.strokeStyle = col(h);
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(...v[p]);
      x.lineTo(...v[q]);
      x.stroke();
    };
    for (const [p, q] of [['-1-1-1', '1-1-1'], ['-1-1-1', '-11-1'], ['-1-1-1', '-1-11']]) edge(p, q, 0.34, 15);
    x.fillStyle = col(1.0, 1);
    disc(x, [c[0], c[1] - 4], 21);
    const front = [['1-1-1', '11-1'], ['1-1-1', '1-11'], ['-11-1', '11-1'], ['-11-1', '-111'], ['-1-11', '1-11'], ['-1-11', '-111'], ['111', '11-1'], ['111', '1-11'], ['111', '-111']];
    for (const [p, q] of front) edge(p, q, 0.8, 18);
  },
  candor(x) {
    // a seal with a check mark and two ribbon tails
    x.fillStyle = col(0.42);
    x.beginPath(); x.moveTo(96, 160); x.lineTo(70, 236); x.lineTo(98, 218); x.lineTo(116, 244); x.lineTo(128, 172); x.fill();
    x.beginPath(); x.moveTo(160, 160); x.lineTo(186, 236); x.lineTo(158, 218); x.lineTo(140, 244); x.lineTo(128, 172); x.fill();
    x.fillStyle = col(0.55);
    x.beginPath();
    for (let i = 0; i < 48; i++) {
      const r = i % 2 ? 84 : 94;
      const t = (i / 48) * Math.PI * 2;
      x.lineTo(128 + r * Math.cos(t), 112 + r * Math.sin(t));
    }
    x.fill();
    x.strokeStyle = col(0.9); x.lineWidth = 12;
    x.beginPath(); x.arc(128, 112, 64, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = col(1.0, 1); x.lineWidth = 22;
    x.beginPath(); x.moveTo(98, 114); x.lineTo(120, 136); x.lineTo(162, 88); x.stroke();
  },
  trace(x) {
    // a shield: raised rim, lower field, and a trace line running through it
    const shield = (s: number) => {
      x.beginPath();
      x.moveTo(128, 32 + s);
      x.bezierCurveTo(160, 52 + s, 186, 56 + s * 0.5, 210 - s, 56 + s * 0.5);
      x.bezierCurveTo(212 - s, 140, 186 - s * 0.6, 196 - s * 0.6, 128, 230 - s);
      x.bezierCurveTo(70 + s * 0.6, 196 - s * 0.6, 44 + s, 140, 46 + s, 56 + s * 0.5);
      x.bezierCurveTo(70, 56 + s * 0.5, 96, 52 + s, 128, 32 + s);
      x.closePath();
    };
    x.fillStyle = col(0.95); shield(0); x.fill();
    x.fillStyle = col(0.3); shield(24); x.fill();
    x.strokeStyle = col(0.9, 1); x.lineWidth = 16;
    x.beginPath(); x.moveTo(78, 132); x.lineTo(100, 132); x.lineTo(114, 100); x.lineTo(136, 168); x.lineTo(152, 120); x.lineTo(162, 132); x.lineTo(186, 132); x.stroke();
  },
  veritas(x) {
    // the double turnstile: "is a valid consequence of"
    x.fillStyle = col(1.0, 1);
    x.fillRect(66, 54, 26, 148);
    x.fillRect(92, 94, 104, 22);
    x.fillRect(92, 142, 104, 22);
    x.fillStyle = col(0.45);
    x.fillRect(176, 196, 26, 26);
  },
  lucid(x) {
    // an ARC-style puzzle grid: cells at three heights
    const g = ['0000000', '0221220', '0210120', '0003000', '0210120', '0221220', '0000000'];
    const n = 7;
    const cs = 30;
    const o = (S - n * cs) / 2;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const k = +g[r][c];
        x.fillStyle = col([0.12, 0.45, 0.72, 1.0][k], [0.5, 0.8, 0.92, 1][k]);
        x.fillRect(o + c * cs + 3, o + r * cs + 3, cs - 6, cs - 6);
      }
  },
  graphtm(x) {
    // a benzene ring with a nitro group: the classic Ames-positive pattern
    const cx = 108;
    const cy = 140;
    const R = 54;
    const pts: P[] = [];
    for (let i = 0; i < 6; i++) {
      const t = Math.PI / 6 + (i * Math.PI) / 3;
      pts.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]);
    }
    x.strokeStyle = col(0.55); x.lineWidth = 14;
    x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p)));
    x.closePath(); x.stroke();
    x.lineWidth = 11;
    for (const i of [0, 2, 4]) {
      const a = pts[i];
      const b = pts[(i + 1) % 6];
      const k = 0.78;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const ix = cx + (mx - cx) * k;
      const iy = cy + (my - cy) * k;
      const dx = (b[0] - a[0]) * 0.32;
      const dy = (b[1] - a[1]) * 0.32;
      x.beginPath(); x.moveTo(ix - dx, iy - dy); x.lineTo(ix + dx, iy + dy); x.stroke();
    }
    const top = pts[4];
    const Np: P = [top[0] + 34, top[1] - 46];
    x.lineWidth = 14; x.beginPath(); x.moveTo(...top); x.lineTo(...Np); x.stroke();
    const O1: P = [Np[0] + 56, Np[1] - 8];
    const O2: P = [Np[0] + 8, Np[1] - 54];
    x.beginPath(); x.moveTo(...Np); x.lineTo(...O1); x.moveTo(...Np); x.lineTo(...O2); x.stroke();
    for (const [p, r, h] of [[Np, 21, 1.0], [O1, 19, 0.85], [O2, 19, 0.85]] as Array<[P, number, number]>) {
      x.fillStyle = col(h, 1);
      disc(x, p, r);
    }
    for (const p of pts) {
      x.fillStyle = col(0.75);
      disc(x, p, 14);
    }
  },
  vsclaude(x) {
    // Pixie, the companion from vsclaude
    x.strokeStyle = col(0.6); x.lineWidth = 14;
    x.beginPath(); x.moveTo(96, 92); x.lineTo(92, 46); x.moveTo(160, 92); x.lineTo(164, 46); x.stroke();
    x.fillStyle = col(0.95, 1);
    disc(x, [92, 40], 12);
    disc(x, [164, 40], 12);
    x.fillStyle = col(0.78);
    roundRect(x, 50, 84, 156, 112, 26); x.fill();
    x.fillStyle = col(0.18, 0.35);
    disc(x, [102, 132], 17);
    disc(x, [154, 132], 17);
    x.fillStyle = col(0.95, 1);
    disc(x, [107, 126], 6);
    disc(x, [159, 126], 6);
    x.fillStyle = col(0.35, 0.4);
    roundRect(x, 114, 162, 28, 9, 4); x.fill();
    x.fillStyle = col(0.42);
    roundRect(x, 92, 212, 72, 22, 10); x.fill();
  },
  pixie(x) {
    // Pixie at its laptop, drawn from the real sprite's pixels
    const cell = 10.704;
    const ox = -53.97;
    const oy = -33.1;
    const R: Array<[number, number, number, number, number, number]> = [
      [12.0, 24.5, 10.0, 1.2, 0.56, 0.8],
      [12.5, 17.5, 9.0, 7.0, 0.36, 0.5],
      [13.2, 18.3, 7.6, 5.4, 0.5, 0.95],
      [14.0, 19.1, 4.0, 0.7, 0.3, 0.55],
      [14.0, 20.5, 6.0, 0.7, 0.3, 0.55],
      [14.0, 21.9, 4.0, 0.7, 0.3, 0.55],
      [11.5, 18.5, 1.6, 2.6, 0.56, 0.8],
      [14.5, 18.5, 1.6, 2.6, 0.56, 0.8],
      [18.5, 18.5, 1.6, 2.6, 0.56, 0.8],
      [21.5, 18.5, 1.6, 2.6, 0.56, 0.8],
      [13.0, 5.6, 1.0, 2.8, 0.74, 0.92],
      [12.4, 4.4, 2.2, 1.6, 0.9, 1.0],
      [20.0, 5.6, 1.0, 2.8, 0.74, 0.92],
      [19.4, 4.4, 2.2, 1.6, 0.9, 1.0],
      [11.0, 8.0, 12.0, 11.0, 0.74, 0.92],
      [10.0, 9.0, 14.0, 9.0, 0.74, 0.92],
      [12.0, 8.6, 10.0, 1.0, 0.9, 1.0],
      [11.0, 17.6, 12.0, 1.4, 0.56, 0.8],
      [13.3, 11.4, 3.0, 3.2, 0.14, 0.3],
      [15.0, 11.8, 0.9, 0.9, 1.0, 1.0],
      [18.7, 11.4, 3.0, 3.2, 0.14, 0.3],
      [20.4, 11.8, 0.9, 0.9, 1.0, 1.0],
      [15.9, 16.0, 2.4, 0.8, 0.56, 0.8],
    ];
    for (const [cx, cy, cw, ch, h, b] of R) {
      x.fillStyle = col(h, b);
      x.fillRect(ox + cx * cell, oy + cy * cell, cw * cell, ch * cell);
    }
  },
  thgtm(x) {
    // a hierarchical graph with an echo ring around the root
    const top: P = [128, 62];
    const mid: P[] = [[78, 128], [178, 128]];
    const bot: P[] = [[48, 196], [100, 196], [156, 196], [208, 196]];
    x.strokeStyle = col(0.5); x.lineWidth = 12;
    x.beginPath();
    for (const m of mid) { x.moveTo(...top); x.lineTo(...m); }
    x.moveTo(...mid[0]); x.lineTo(...bot[0]); x.moveTo(...mid[0]); x.lineTo(...bot[1]);
    x.moveTo(...mid[1]); x.lineTo(...bot[2]); x.moveTo(...mid[1]); x.lineTo(...bot[3]);
    x.stroke();
    x.strokeStyle = col(0.32); x.lineWidth = 8;
    x.beginPath(); x.arc(top[0], top[1], 36, 0, Math.PI * 2); x.stroke();
    const nodes: Array<[P, number, number]> = [[top, 22, 1.0], [mid[0], 18, 0.85], [mid[1], 18, 0.85], ...bot.map((b): [P, number, number] => [b, 15, 0.7])];
    for (const [p, r, h] of nodes) {
      x.fillStyle = col(h, 1);
      disc(x, p, r);
    }
  },
  ditm(x) {
    // Boolean data diffusing into noise from left to right (seeded, so it is the same every time)
    const n = 8;
    const cs = 26;
    const o = (S - n * cs) / 2;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const clean = (r + c) % 3 === 0 || r === c;
        const noise = c / (n - 1);
        const on = rnd() < noise * 0.85 ? rnd() < 0.5 : clean;
        x.fillStyle = col(on ? 0.95 : 0.12, on ? 1 : 0.6);
        x.fillRect(o + c * cs + 3, o + r * cs + 3, cs - 6, cs - 6);
      }
  },
  reins(x) {
    // an agent trajectory where one step is blocked and repaired by the cheapest detour
    const ys = 160;
    const xs = [40, 92, 144, 196, 228];
    x.strokeStyle = col(0.5); x.lineWidth = 12;
    x.beginPath(); x.moveTo(xs[0], ys); x.lineTo(xs[1], ys); x.moveTo(xs[3], ys); x.lineTo(xs[4], ys); x.stroke();
    x.strokeStyle = col(0.18, 0.5); x.lineWidth = 6; x.setLineDash([8, 8]);
    x.beginPath(); x.moveTo(xs[1], ys); x.lineTo(xs[3], ys); x.stroke(); x.setLineDash([]);
    x.strokeStyle = col(0.9, 1); x.lineWidth = 12;
    x.beginPath(); x.moveTo(xs[1], ys); x.quadraticCurveTo(144, 50, xs[3], ys); x.stroke();
    for (const [px, h] of [[xs[0], 0.75], [xs[1], 0.8], [xs[3], 0.8], [xs[4], 0.75]]) {
      x.fillStyle = col(h, 1);
      disc(x, [px, ys], 16);
    }
    x.fillStyle = col(1.0, 1);
    disc(x, [144, 104], 15);
    x.strokeStyle = col(0.25, 0.4); x.lineWidth = 8;
    x.beginPath(); x.moveTo(132, ys - 12); x.lineTo(156, ys + 12); x.moveTo(156, ys - 12); x.lineTo(132, ys + 12); x.stroke();
  },
  attn(x) {
    // tokens in a row with attention arcs between them
    const xs = [40, 76, 112, 148, 184, 220];
    const y = 190;
    const arcs: Array<[number, number, number]> = [[0, 2, 0.55], [1, 4, 0.8], [2, 5, 0.65], [0, 5, 1.0], [3, 4, 0.45]];
    for (const [a, b, h] of arcs) {
      x.strokeStyle = col(h); x.lineWidth = 9;
      const mx = (xs[a] + xs[b]) / 2;
      const r = (xs[b] - xs[a]) / 2;
      x.beginPath(); x.ellipse(mx, y, r, r * 1.1, 0, Math.PI, 0); x.stroke();
    }
    for (const px of xs) {
      x.fillStyle = col(0.9, 1);
      disc(x, [px, y], 14);
    }
  },
  mneme(x) {
    // a textbook turning into a stack of flash cards
    const card = (X: number, Y: number, h: number) => {
      x.fillStyle = col(h); roundRect(x, X, Y, 132, 92, 10); x.fill();
      x.strokeStyle = col(h + 0.18 > 1 ? 1 : h + 0.18, 1); x.lineWidth = 7;
      x.beginPath(); x.moveTo(X + 20, Y + 34); x.lineTo(X + 108, Y + 34); x.moveTo(X + 20, Y + 58); x.lineTo(X + 84, Y + 58); x.stroke();
    };
    card(36, 120, 0.35); card(62, 92, 0.58); card(88, 64, 0.8);
  },
  pocketos(x) {
    // a phone with a desktop inside: two windows and a dock
    x.strokeStyle = col(0.95, 1); x.lineWidth = 12;
    roundRect(x, 70, 26, 116, 204, 22); x.stroke();
    x.fillStyle = col(0.6); roundRect(x, 88, 54, 58, 46, 6); x.fill();
    x.fillStyle = col(0.8); roundRect(x, 110, 92, 60, 52, 6); x.fill();
    x.fillStyle = col(0.45); roundRect(x, 92, 186, 72, 18, 8); x.fill();
  },
  nexus(x) {
    // the 121-hole star board of Chinese Checkers, with one marble hopping out of its home triangle
    const R = 4;
    const sz = 9.2;
    const cells: P[] = [];
    for (let q = -2 * R; q <= 2 * R; q++)
      for (let r = -2 * R; r <= 2 * R; r++) {
        const s = -q - r;
        const inHex = Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= R;
        const tip = (a: number, b2: number, c2: number) => a > R && a <= 2 * R && b2 <= 0 && c2 <= 0 && b2 >= -R && c2 >= -R;
        if (inHex || tip(q, r, s) || tip(r, q, s) || tip(s, q, r) || tip(-q, -r, -s) || tip(-r, -q, -s) || tip(-s, -q, -r)) cells.push([q, r]);
      }
    const px = ([q, r]: P): P => [128 + sz * Math.sqrt(3) * (q + r / 2), 128 + sz * 1.5 * r];
    const key = ([q, r]: P) => `${q},${r}`;
    const start: P = [-1, 5];
    const land: P[] = [[-1, 3], [-1, 1], [-1, -1]];
    const over = new Set(([[-1, 4], [-1, 2], [-1, 0]] as P[]).map(key));
    for (const c of cells) {
      const [X, Y] = px(c);
      const k = key(c);
      const home = c[1] > R && k !== key(start);
      const h = home ? 0.95 : over.has(k) ? 0.7 : 0.34;
      x.fillStyle = col(h, home || over.has(k) ? 1 : 0.6);
      disc(x, [X, Y], home || over.has(k) ? 7 : 4.8);
    }
    x.strokeStyle = col(0.8, 1); x.lineWidth = 4.5;
    let from = px(start);
    for (const l of land) {
      const to = px(l);
      x.beginPath(); x.moveTo(...from); x.quadraticCurveTo((from[0] + to[0]) / 2 + 17, (from[1] + to[1]) / 2, ...to); x.stroke();
      from = to;
    }
    x.fillStyle = col(1.0, 1);
    disc(x, from, 7.6);
  },
  idm(x) {
    // a star schema: one fact table in the middle, four dimension tables around it
    const dims: P[] = [[128, 40], [216, 128], [128, 216], [40, 128]];
    x.strokeStyle = col(0.4); x.lineWidth = 9;
    x.beginPath();
    for (const d of dims) { x.moveTo(128, 128); x.lineTo(...d); }
    x.stroke();
    x.fillStyle = col(0.62);
    for (const [ppx, ppy] of dims) { roundRect(x, ppx - 26, ppy - 19, 52, 38, 7); x.fill(); }
    x.fillStyle = col(0.95, 1); roundRect(x, 90, 98, 76, 60, 9); x.fill();
    x.strokeStyle = col(0.7, 0.85); x.lineWidth = 6;
    x.beginPath(); x.moveTo(102, 118); x.lineTo(154, 118); x.moveTo(102, 138); x.lineTo(154, 138); x.stroke();
  },
  sleep(x) {
    // a 24-hour dial with tonight's sleep marked, and a crescent moon in the middle
    const c = 128;
    const r = 98;
    const ang = (h: number) => (h / 24) * Math.PI * 2 - Math.PI / 2;
    x.strokeStyle = col(0.34); x.lineWidth = 8;
    x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = col(0.55); x.lineWidth = 8;
    for (const h of [0, 6, 12, 18]) {
      const a = ang(h);
      x.beginPath(); x.moveTo(c + (r - 22) * Math.cos(a), c + (r - 22) * Math.sin(a)); x.lineTo(c + (r - 10) * Math.cos(a), c + (r - 10) * Math.sin(a)); x.stroke();
    }
    x.strokeStyle = col(0.9, 1); x.lineWidth = 18;
    x.beginPath(); x.arc(c, c, r, ang(23), ang(31)); x.stroke();
    x.fillStyle = col(0.95, 1);
    disc(x, [c - 4, c + 6], 40);
    x.fillStyle = 'rgb(0, 235, 0)';
    disc(x, [c + 16, c - 8], 36);
  },
  thermo(x) {
    // a house with a thermometer inside: heat risk is an indoor problem
    x.strokeStyle = col(0.55); x.lineWidth = 12;
    x.beginPath(); x.moveTo(50, 122); x.lineTo(128, 52); x.lineTo(206, 122); x.stroke();
    x.beginPath(); x.moveTo(72, 108); x.lineTo(72, 214); x.lineTo(184, 214); x.lineTo(184, 108); x.stroke();
    x.fillStyle = col(0.6); roundRect(x, 116, 104, 24, 92, 12); x.fill();
    x.fillStyle = col(1.0, 1); roundRect(x, 123, 132, 10, 64, 5); x.fill();
    disc(x, [128, 194], 17);
  },
};

export type EmblemName = keyof typeof draw;
export const emblemNames = Object.keys(draw) as EmblemName[];

const cache = new Map<string, Pixels>();

/** Draw an emblem with a custom drawer (same R/G convention), cached under `name`. */
export const emblemPixels = (name: string, drawer?: (x: Ctx) => void): Pixels => {
  const hit = cache.get(name);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d', {willReadFrequently: true});
  if (!x) throw new Error('2D canvas unavailable');
  x.fillStyle = 'rgb(0, 235, 0)';
  x.fillRect(0, 0, S, S);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  (drawer ?? draw[name] ?? draw.glassbox)(x);
  // a touch of blur so slopes read as slopes, not stairs
  const c2 = document.createElement('canvas');
  c2.width = c2.height = S;
  const y = c2.getContext('2d', {willReadFrequently: true});
  if (!y) throw new Error('2D canvas unavailable');
  y.fillStyle = 'rgb(0, 235, 0)';
  y.fillRect(0, 0, S, S);
  y.filter = 'blur(1.1px)';
  y.drawImage(c, 0, 0);
  const d = y.getImageData(0, 0, S, S);
  const px = {width: S, height: S, data: d.data};
  cache.set(name, px);
  return px;
};

export interface EmblemOptions {
  /** Tint of the ground, the whole wall included (the site's emblem board: 0.5). */
  ground?: number;
  /** Height multiplier (default 1). */
  height?: number;
  /** Pins above this height glow mint (e.g. 0.95 lights the brightest strokes). */
  glowAbove?: number;
}

/** An emblem as a field: h = R, tint = ground + (1 - ground) min(1, 3h) G (site convention). */
export const emblemField = (board: Board, name: string, place: Place, opts: EmblemOptions = {}): FieldFn => {
  const img = emblemPixels(name);
  const {local} = placer(board, place, 1);
  const ground = opts.ground ?? 0.5;
  const hk = opts.height ?? 1;
  const outside: PinSample = {h: 0, tint: ground};
  return (u, v) => {
    const [s, t] = local(u, v);
    if (!inside01(s, t)) return outside;
    const h = samplePixels(img, s, t, 0);
    const g = samplePixels(img, s, t, 1);
    const sample: PinSample = {h: h * hk, tint: ground + (1 - ground) * Math.min(1, h * 3) * g};
    if (opts.glowAbove !== undefined && h > opts.glowAbove) sample.glow = Math.min(1, (h - opts.glowAbove) / Math.max(1e-3, 1 - opts.glowAbove) * 2);
    return sample;
  };
};
