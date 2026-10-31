import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {applyPose, type CameraPose} from '../../camera/pose';
import {color, font, type as typeTokens} from '../../tokens';
import {constellationLayout, type ConstellationLayout, type LayoutNode} from './layout';
import {ignition, nodeRevealAt, type ConstellationReveal} from './Constellation';

// Repo labels as crisp HTML, pinned to the nodes by projecting them with the exact camera pose the
// 3D layer uses at the same time. Visibility is a smooth function of depth, focus, screen position,
// tier and overlap, so labels never pop, and each frame is computed from scratch.

export interface LabelLens {
  focusDistance: number;
  aperture: number;
}

export interface ConstellationLabelsProps {
  /** The camera pose at film time t (e.g. t => flightPoseAt(keys, t)). */
  poseAt: (t: number) => CameraPose;
  /** Lens at time t, for a gentle focus blur on labels off the focus plane. */
  lensAt?: (t: number) => LabelLens;
  layout?: ConstellationLayout;
  reveal?: ConstellationReveal;
  /** Mint names for highlighted repos (same function as the Constellation's). */
  highlight?: (id: string, t: number) => number;
  /** Which repos may carry a label. Default: everything except names gated by consent. */
  filter?: (node: LayoutNode) => boolean;
  /** View-depth band (world units) where labels show, with soft edges. */
  depth?: [number, number];
  /** Labels fade with distance from the focus plane over this range (world units). */
  focusRange?: number;
  /** Lowest tier weight that gets a label at the far end of the band. */
  minWeight?: number;
  maxLabels?: number;
  /** Show the year ticks of the time axis. */
  ticks?: boolean;
  /** Chapter titles at the start of each lane, shown in this view-depth band (wide shots). */
  laneTitles?: [number, number] | false;
  /** Overall opacity, or a function of film time. */
  opacity?: number | ((t: number) => number);
  timeOffset?: number;
  /** Second line under a name; default language and month. */
  meta?: (node: LayoutNode) => string;
  /** Screen rectangles [x0, y0, x1, y1] (fractions of W and H) that repo labels keep out of, e.g. a kicker. */
  avoid?: ReadonlyArray<readonly [number, number, number, number]>;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const defaultMeta = (n: LayoutNode): string => {
  const r = n.repo;
  const when = `${MONTHS[+r.created.slice(5, 7) - 1]} ${r.created.slice(0, 4)}`;
  const what = r.fork ? 'FORK' : r.empty ? 'EMPTY' : r.language ? r.language.toUpperCase() : 'DOCS';
  return `${what} · ${when}`;
};

let measureCtx: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
const measure = (text: string, cssFont: string, tracking: number, sizePx: number): number => {
  const key = `${cssFont}|${tracking}|${text}`;
  const hit = widths.get(key);
  if (hit !== undefined) return hit;
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  let w = text.length * sizePx * 0.56;
  if (measureCtx) {
    measureCtx.font = cssFont;
    w = measureCtx.measureText(text).width + tracking * sizePx * text.length;
  }
  widths.set(key, w);
  return w;
};

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const _cam = new THREE.PerspectiveCamera();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _fwd = new THREE.Vector3();

interface Placed {
  node: LayoutNode;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  blur: number;
  mint: number;
  score: number;
}

export const ConstellationLabels: React.FC<ConstellationLabelsProps> = ({
  poseAt,
  lensAt,
  layout: layoutProp,
  reveal,
  highlight,
  filter,
  depth = [0.35, 3.2],
  focusRange = 0.9,
  minWeight = 0.3,
  maxLabels = 9,
  ticks = true,
  laneTitles = [3.2, 14],
  opacity = 1,
  timeOffset = 0,
  meta = defaultMeta,
  avoid,
}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps + timeOffset;
  const layout = useMemo(() => layoutProp ?? constellationLayout(), [layoutProp]);
  const revealAt = useMemo(() => layout.nodes.map((n) => nodeRevealAt(layout, n, reveal)), [layout, reveal]);
  const allow = filter ?? ((n: LayoutNode) => !n.repo.gated && !n.repo.disclaimer);
  const op = typeof opacity === 'function' ? opacity(t) : opacity;
  if (op <= 0.001) return null;

  const pose = poseAt(t);
  applyPose(_cam, pose, W / H);
  _cam.getWorldDirection(_fwd);
  const lens = lensAt?.(t);

  const nameSize = Math.round(H * typeTokens.bodySmall.size);
  const metaSize = Math.round(H * typeTokens.monoCardLabel.size);
  const nameFont = `600 ${nameSize}px ${font.sans}`;
  const metaFont = `500 ${metaSize}px ${font.mono}`;
  const gap = Math.round(H * 0.016);
  const lineGap = Math.round(H * 0.006);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2);

  const cands: Placed[] = [];
  for (const node of layout.nodes) {
    if (!allow(node)) continue;
    const ig = Math.min(1, ignition(t, revealAt[node.index] + 0.12));
    if (ig <= 0) continue;
    _p.set(node.position[0], node.position[1], node.position[2]);
    const z = _q.copy(_p).sub(_cam.position).dot(_fwd);
    if (z <= _cam.near) continue;
    _p.project(_cam);
    const sx = ((_p.x + 1) / 2) * W;
    const sy = ((1 - _p.y) / 2) * H;
    const inDepth = smooth(depth[0], depth[0] * 1.6, z) * (1 - smooth(depth[1] * 0.75, depth[1], z));
    const fd = lens ? Math.abs(z - lens.focusDistance) : 0;
    const inFocus = 1 - smooth(focusRange * 0.45, focusRange, fd);
    // smaller tiers need to be nearer to earn a label
    const need = minWeight + (1 - minWeight) * smooth(depth[0], depth[1], z) * 0.6;
    const tierOk = smooth(need - 0.12, need, node.weight);
    const name = node.repo.id;
    const metaText = meta(node);
    const wName = measure(name, nameFont, typeTokens.bodySmall.tracking, nameSize);
    const wMeta = measure(metaText, metaFont, typeTokens.monoCardLabel.tracking, metaSize);
    const w = Math.max(wName, wMeta);
    const h = nameSize * 1.05 + lineGap + metaSize * 1.2;
    const x = sx + gap;
    const y = sy - nameSize * 0.52;
    // gone before any part of a label reaches the frame edge (or the caption band)
    const edge = smooth(W * 0.02, W * 0.06, x) * (1 - smooth(W * 0.95 - w, W * 0.985 - w, x)) * smooth(H * 0.045, H * 0.09, y) * (1 - smooth(H * 0.8, H * 0.86, y + h));
    let keepOut = 1;
    if (avoid) {
      const pad = H * 0.02;
      for (const [ax0, ay0, ax1, ay1] of avoid) {
        // overlap depth with the padded rectangle, in px: 0 = touching, fades out over `pad`
        const dx = Math.min(x + w - ax0 * W, ax1 * W - x) + pad;
        const dy = Math.min(y + h - ay0 * H, ay1 * H - y) + pad;
        if (dx > 0 && dy > 0) keepOut = Math.min(keepOut, 1 - smooth(0, pad, Math.min(dx, dy)));
      }
    }
    const alpha = ig * inDepth * inFocus * tierOk * edge * keepOut;
    if (alpha <= 0.004) continue;
    let blur = 0;
    if (lens && lens.aperture > 0) {
      const coc = (lens.aperture * H * Math.abs(1 / lens.focusDistance - 1 / z)) / (4 * tanHalf);
      blur = Math.min(4, coc * 0.18) * (H / 1440);
    }
    const mint = highlight ? Math.min(1, Math.max(0, highlight(node.repo.id, t))) : 0;
    cands.push({node, x, y, w, h, alpha, blur, mint, score: alpha * (0.4 + node.weight) * (1 + mint)});
  }
  cands.sort((a, b) => b.score - a.score);
  const placed: Placed[] = [];
  for (const c of cands) {
    if (placed.length >= maxLabels) break;
    // overlap with stronger labels (padded), weighted by how visible they are
    let cover = 0;
    const pad = gap * 0.8;
    for (const p of placed) {
      const ox = Math.max(0, Math.min(c.x + c.w + pad, p.x + p.w + pad) - Math.max(c.x - gap * 2.2, p.x - pad));
      const oy = Math.max(0, Math.min(c.y + c.h + pad, p.y + p.h + pad) - Math.max(c.y - pad, p.y - pad));
      cover = Math.max(cover, ((ox * oy) / (c.w * c.h)) * Math.min(1, p.alpha * 1.5));
    }
    const a = c.alpha * (1 - smooth(0.0, 0.1, cover));
    if (a <= 0.004) continue;
    placed.push({...c, alpha: a});
  }

  const tickEls: React.ReactNode[] = [];
  if (ticks) {
    const tickSize = Math.round(H * typeTokens.monoCardLabel.size);
    for (const tk of layout.spine.ticks) {
      if (!tk.major) continue;
      _p.set(tk.position[0], tk.position[1], tk.position[2]);
      const z = _q.copy(_p).sub(_cam.position).dot(_fwd);
      if (z <= _cam.near) continue;
      _p.project(_cam);
      const sx = ((_p.x + 1) / 2) * W;
      const sy = ((1 - _p.y) / 2) * H;
      const ig = reveal ? smooth(reveal.from, reveal.from + 0.6, t) : 1;
      const a = ig * smooth(0, W * 0.05, sx) * (1 - smooth(W * 0.93, W * 0.99, sx)) * (1 - smooth(H * 0.8, H * 0.86, sy)) * (1 - smooth(depth[1] * 1.2, depth[1] * 2.4, z));
      if (a <= 0.004) continue;
      tickEls.push(
        <div
          key={tk.label}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${(sx - tickSize * 1.2).toFixed(2)}px, ${(sy + tickSize * 0.7).toFixed(2)}px)`,
            fontFamily: font.mono,
            fontWeight: 500,
            fontSize: tickSize,
            letterSpacing: `${typeTokens.monoCardLabel.tracking}em`,
            color: color.text.secondary,
            opacity: a * op,
            whiteSpace: 'nowrap',
          }}
        >
          {tk.label}
        </div>,
      );
    }
  }

  const laneEls: React.ReactNode[] = [];
  if (laneTitles) {
    const size = Math.round(H * typeTokens.monoCardLabel.size);
    const lf = `500 ${size}px ${font.mono}`;
    layout.lanes.forEach((lane, li) => {
      _p.set(lane.titleAt[0], lane.titleAt[1], lane.titleAt[2]);
      const z = _q.copy(_p).sub(_cam.position).dot(_fwd);
      if (z <= _cam.near) return;
      _p.project(_cam);
      const sx = ((_p.x + 1) / 2) * W;
      const sy = ((1 - _p.y) / 2) * H;
      const text = `${String(lane.chapter).padStart(2, '0')} · ${lane.title.toUpperCase()}`;
      const w = measure(text, lf, typeTokens.monoCardLabel.tracking, size);
      // above the start of the strand, left-aligned with it
      const x = sx;
      const ig = reveal ? smooth(reveal.from + li * 0.04, reveal.from + 0.5 + li * 0.04, t) : 1;
      const a =
        ig *
        smooth(laneTitles[0], laneTitles[0] * 1.35, z) *
        (1 - smooth(laneTitles[1] * 0.8, laneTitles[1], z)) *
        smooth(W * 0.01, W * 0.04, x) *
        (1 - smooth(W * 0.96, W * 0.995, x + w)) *
        (1 - smooth(H * 0.84, H * 0.9, sy));
      if (a <= 0.004) return;
      laneEls.push(
        <div
          key={`lane${lane.chapter}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${x.toFixed(2)}px, ${(sy - size * 1.55).toFixed(2)}px)`,
            fontFamily: font.mono,
            fontWeight: 500,
            fontSize: size,
            letterSpacing: `${typeTokens.monoCardLabel.tracking}em`,
            color: color.text.secondary,
            opacity: a * op,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{color: color.accent.mintLabel}}>{String(lane.chapter).padStart(2, '0')}</span>
          {` · ${lane.title.toUpperCase()}`}
        </div>,
      );
    });
  }

  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none'}}>
      {laneEls}
      {tickEls}
      {placed.map((p) => {
        const nameColor = p.mint > 0 ? mixHex(color.text.display, color.accent.mint, p.mint) : color.text.display;
        const metaColor = p.mint > 0 ? mixHex(color.text.secondary, color.accent.mintLabel, p.mint) : color.text.secondary;
        return (
          <div
            key={p.node.repo.id}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px)`,
              opacity: p.alpha * op,
              filter: p.blur > 0.05 ? `blur(${p.blur.toFixed(2)}px)` : undefined,
              whiteSpace: 'nowrap',
              textShadow: `0 0 ${Math.round(H * 0.01)}px rgba(5,8,7,0.85)`,
            }}
          >
            <div style={{fontFamily: font.sans, fontWeight: 600, fontSize: nameSize, lineHeight: 1.05, letterSpacing: `${typeTokens.bodySmall.tracking}em`, color: nameColor}}>
              {p.node.repo.id}
            </div>
            <div
              style={{
                marginTop: lineGap,
                fontFamily: font.mono,
                fontWeight: 500,
                fontSize: metaSize,
                lineHeight: 1.2,
                letterSpacing: `${typeTokens.monoCardLabel.tracking}em`,
                color: metaColor,
              }}
            >
              {meta(p.node)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const hexRgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, k: number) => {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};
