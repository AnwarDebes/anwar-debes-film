// The diagram camera: a long-lens perspective view of the diagram plane, so a pan, a zoom
// and a 2.5D tilt are all one projection. Text is drawn with the local affine of the
// projection (exact at the anchor, sub-pixel off at a card's corners), so it stays vector
// type at every zoom: nothing is ever rasterised and scaled.

import {Easing} from 'remotion';
import {easing as EASE} from '../tokens';
import {unionBox} from './geometry';
import type {Box, DiagramLayout} from './types';

export interface CameraState {
  /** World point under the view anchor. */
  cx: number;
  cy: number;
  /** Screen px per u is zoom * H / 1000. */
  zoom: number;
  /** Degrees. Positive pitch lays the top of the diagram back; positive yaw turns its right side away. */
  pitch: number;
  yaw: number;
  /** Screen point the camera looks at, as fractions of W and H. */
  ax: number;
  ay: number;
}

export interface SafeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface CameraKey {
  /** Seconds. The camera arrives at this key at this time. */
  at: number;
  /** What to frame: 'all', node ids, group ids. Ignored when `center` is set. */
  target?: 'all' | string | string[];
  /** Multiplier on the zoom that frames the target (1 = fits the safe area). */
  zoom?: number;
  /** Explicit world centre. */
  center?: [number, number];
  /** Frame the opened (detail) size of target cards. */
  open?: boolean;
  pitch?: number;
  yaw?: number;
  /** Shift of the framed point inside the safe area, fractions of W/H. */
  offset?: [number, number];
  /** Easing of the move into this key. */
  ease?: 'camera' | 'ui' | 'text' | 'linear' | 'in' | 'out';
  /** Safe area for this key (fractions of the frame). */
  safe?: SafeArea;
}

export const DEFAULT_SAFE: SafeArea = {left: 0.07, right: 0.93, top: 0.15, bottom: 0.76};

const bez = (c: readonly number[]) => Easing.bezier(c[0], c[1], c[2], c[3]);
const EASINGS = {
  camera: bez(EASE.camera),
  ui: bez(EASE.ui),
  text: bez(EASE.text),
  linear: (x: number) => x,
  in: Easing.bezier(0.55, 0, 0.75, 0.25),
  out: Easing.bezier(0.25, 0.75, 0.45, 1),
};

export const targetBox = (layout: DiagramLayout, target: CameraKey['target'], open = false): Box => {
  if (!target || target === 'all') return {x: 0, y: 0, w: layout.bounds.w, h: layout.bounds.h};
  const ids = Array.isArray(target) ? target : [target];
  const boxes: Box[] = [];
  for (const id of ids) {
    const n = layout.nodes.find((q) => q.id === id);
    if (n) {
      boxes.push(open && n.detail ? {x: n.x, y: n.y, w: n.detail.w, h: n.detail.h} : n);
      continue;
    }
    const g = layout.groups.find((q) => q.id === id);
    if (g) boxes.push(...g.rects);
  }
  return boxes.length ? unionBox(boxes) : {x: 0, y: 0, w: layout.bounds.w, h: layout.bounds.h};
};

export const resolveKey = (layout: DiagramLayout, key: CameraKey, W: number, H: number, fallbackSafe: SafeArea): CameraState => {
  const safe = key.safe ?? fallbackSafe;
  const box = targetBox(layout, key.target, key.open);
  const sw = (safe.right - safe.left) * W;
  const sh = (safe.bottom - safe.top) * H;
  const fit = Math.min(sw / Math.max(1, box.w), sh / Math.max(1, box.h));
  const zoom = ((fit * 1000) / H) * (key.zoom ?? 1);
  const [cx, cy] = key.center ?? [box.x + box.w / 2, box.y + box.h / 2];
  const [ox, oy] = key.offset ?? [0, 0];
  return {
    cx,
    cy,
    zoom,
    pitch: key.pitch ?? 0,
    yaw: key.yaw ?? 0,
    ax: (safe.left + safe.right) / 2 + ox,
    ay: (safe.top + safe.bottom) / 2 + oy,
  };
};

/** Camera at time t: keys are eased into one after another (zoom moves in log space). */
export const cameraAt = (states: CameraState[], keys: CameraKey[], t: number): CameraState => {
  if (!states.length) return {cx: 0, cy: 0, zoom: 1, pitch: 0, yaw: 0, ax: 0.5, ay: 0.5};
  if (t <= keys[0].at || states.length === 1) return states[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].at) {
      const a = states[i - 1];
      const b = states[i];
      const span = keys[i].at - keys[i - 1].at;
      const e = EASINGS[keys[i].ease ?? 'camera'](span > 0 ? (t - keys[i - 1].at) / span : 1);
      const lerp = (p: number, q: number) => p + (q - p) * e;
      return {
        cx: lerp(a.cx, b.cx),
        cy: lerp(a.cy, b.cy),
        zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom))),
        pitch: lerp(a.pitch, b.pitch),
        yaw: lerp(a.yaw, b.yaw),
        ax: lerp(a.ax, b.ax),
        ay: lerp(a.ay, b.ay),
      };
    }
  }
  return states[states.length - 1];
};

/** Projection of the diagram plane for one frame. */
export class Projector {
  readonly s: number;
  private readonly cp: number;
  private readonly sp: number;
  private readonly cyaw: number;
  private readonly syaw: number;
  private readonly f: number;
  private readonly ax: number;
  private readonly ay: number;

  constructor(
    readonly cam: CameraState,
    readonly W: number,
    readonly H: number,
    fovDeg = 26,
  ) {
    this.s = (cam.zoom * H) / 1000;
    const p = (cam.pitch * Math.PI) / 180;
    const y = (cam.yaw * Math.PI) / 180;
    this.cp = Math.cos(p);
    this.sp = Math.sin(p);
    this.cyaw = Math.cos(y);
    this.syaw = Math.sin(y);
    this.f = H / 2 / Math.tan((fovDeg * Math.PI) / 360);
    this.ax = cam.ax * W;
    this.ay = cam.ay * H;
  }

  /** World (x, y) to screen px, written into out[o], out[o + 1]; returns the depth scale. */
  project(x: number, y: number, out: Float64Array | number[], o = 0): number {
    const px = (x - this.cam.cx) * this.s;
    const py = (y - this.cam.cy) * this.s;
    const y1 = py * this.cp;
    const z1 = -py * this.sp;
    const x2 = px * this.cyaw - z1 * this.syaw;
    const z2 = px * this.syaw + z1 * this.cyaw;
    const k = this.f / (this.f + z2);
    out[o] = this.ax + x2 * k;
    out[o + 1] = this.ay + y1 * k;
    return k;
  }

  /** Local affine at a world point: [a, b, c, d, e, f] for SVG matrix(), mapping world offsets from (x, y). */
  affine(x: number, y: number): [number, number, number, number, number, number] {
    const o = [0, 0];
    const ex = [0, 0];
    const ey = [0, 0];
    const h = 0.5;
    this.project(x, y, o);
    this.project(x + h, y, ex);
    this.project(x, y + h, ey);
    return [(ex[0] - o[0]) / h, (ex[1] - o[1]) / h, (ey[0] - o[0]) / h, (ey[1] - o[1]) / h, o[0], o[1]];
  }

  /** Screen px per world unit at a point (geometric mean of the local axes). */
  scaleAt(x: number, y: number): number {
    const [a, b, c, d] = this.affine(x, y);
    return Math.sqrt(Math.abs(a * d - b * c));
  }

  /** Projects a flat xy array into an SVG path string. */
  path(xy: ArrayLike<number>, close = false): string {
    const n = xy.length / 2;
    if (n < 1) return '';
    const o = [0, 0];
    let d = '';
    for (let i = 0; i < n; i++) {
      this.project(xy[2 * i], xy[2 * i + 1], o);
      d += `${i ? 'L' : 'M'}${o[0].toFixed(2)} ${o[1].toFixed(2)}`;
    }
    return close ? `${d}Z` : d;
  }
}

/** SVG matrix() for drawing a box's content in its own world units, anchored at its centre. */
export const boxMatrix = (P: Projector, b: Box): string => {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const [a, bb, c, d, e, f] = P.affine(cx, cy);
  const tx = e - a * (b.w / 2) - c * (b.h / 2);
  const ty = f - bb * (b.w / 2) - d * (b.h / 2);
  return `matrix(${a.toFixed(5)} ${bb.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${tx.toFixed(2)} ${ty.toFixed(2)})`;
};
