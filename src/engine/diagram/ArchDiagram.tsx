import React, {useId, useMemo} from 'react';
import {evolvePath} from '@remotion/paths';
import {interpolateColors, useCurrentFrame, useVideoConfig} from 'remotion';
import {color, font, type as typeTokens} from '../tokens';
import {Projector, boxMatrix, cameraAt, DEFAULT_SAFE, resolveKey, type CameraKey, type SafeArea} from './camera';
import {arcTable, outlineWithLegendGap, pointAt, subRoute, type ArcTable} from './geometry';
import {KindGlyph} from './glyphs';
import {
  buildSchedule,
  clamp01,
  ease,
  edgeTables,
  envelope,
  pathEdges,
  planPacket,
  type BuildSpec,
  type FocusSpec,
  type HighlightSpec,
  type PacketPlan,
  type PacketSpec,
} from './timeline';
import type {Box, DiagramLayout, LayoutNode} from './types';

export interface PacketLogSpec {
  /** Left edge and baseline of the newest line, as fractions of W and H. */
  x: number;
  y: number;
  /** Lines kept on screen (newest at the bottom). Default 3. */
  lines?: number;
  /** Seconds the log stays after its packet's last arrival. Default 1.4. */
  hold?: number;
  /** Seconds it takes to fade away. Default 0.5. */
  fade?: number;
  /** Append the line of code that moves each payload (the edge's last evidence). Default true. */
  cite?: boolean;
}

export interface ArchDiagramProps {
  layout: DiagramLayout;
  /** How the diagram assembles. Default: all cards in topological order over 3.6 s from t = 0. */
  build?: BuildSpec;
  /** Camera keys (seconds). Default: frame the whole diagram in the safe area, flat. */
  camera?: CameraKey[];
  highlights?: HighlightSpec[];
  packets?: PacketSpec[];
  /** Cards that open to show their detail lines (zoom into a module). */
  focus?: FocusSpec[];
  /** Which edge labels show: only on lit edges (default), always, or never. */
  edgeLabels?: 'active' | 'all' | 'none';
  /** Region of the frame a fitting camera frames (fractions). */
  safe?: SafeArea;
  /** Vertical field of view of the camera, degrees. Default 26 (a long lens). */
  fov?: number;
  /** Fade the whole diagram out. */
  exit?: {at: number; dur?: number};
  /** A running log of what each packet carried, one line per hop. */
  packetLog?: PacketLogSpec | false;
  /** Override the clock (seconds); default is the current frame of the enclosing Sequence. */
  time?: number;
  /**
   * A soft dark plate behind the whole diagram (0..1), for scenes where the wall behind it
   * is bright. It follows the camera and the build. Default 0 (none).
   */
  backdrop?: number;
}

const C = color;
const RULE = C.card.rule;
const EDGE = 'rgba(228,234,231,0.34)';
const MINT = C.accent.mint;
const CAP = {sans: 0.703, mono: 0.73};
const AFTERGLOW_S = 2.2;
const PING_S = 0.75;
const FOCUS_PULL_S = 0.42;

const baselineIn = (top: number, lineH: number, size: number, f: 'sans' | 'mono') => top + (lineH + CAP[f] * size) / 2;

export const ArchDiagram: React.FC<ArchDiagramProps> = ({
  layout,
  build,
  camera,
  highlights = [],
  packets = [],
  focus = [],
  edgeLabels = 'active',
  safe = DEFAULT_SAFE,
  fov = 26,
  exit,
  packetLog = false,
  time,
  backdrop = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = time ?? frame / fps;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const S = layout.style;

  // ------------------------------------------------ built once per layout / props
  const tables = useMemo<ArcTable[]>(() => edgeTables(layout), [layout]);
  const schedule = useMemo(() => buildSchedule(layout, build), [layout, build]);
  const keys = useMemo<CameraKey[]>(() => (camera?.length ? [...camera].sort((a, b) => a.at - b.at) : [{at: 0, target: 'all'}]), [camera]);
  const camStates = useMemo(() => keys.map((k) => resolveKey(layout, k, W, H, safe)), [keys, layout, W, H, safe]);
  const plans = useMemo<PacketPlan[]>(() => packets.map((p) => planPacket(layout, tables, p)), [packets, layout, tables]);
  const lit = useMemo(
    () => highlights.map((h) => ({h, edges: pathEdges(layout, h.paths), nodes: new Set([...h.paths.flat(), ...(h.nodes ?? [])])})),
    [highlights, layout],
  );
  const outlines = useMemo(
    () =>
      layout.groups.map((g) =>
        g.rects.map((r) => {
          const lx = r.x + S.group.legendInset;
          const textW = g.labelW + (g.path ? S.group.pathGap + g.pathW : 0);
          const gap = S.group.legendGap;
          return arcTable(outlineWithLegendGap(r, S.group.radius, lx - gap, lx + textW + gap, 10));
        }),
      ),
    [layout, S],
  );
  const nodeIndex = useMemo(() => new Map(layout.nodes.map((n, i) => [n.id, i])), [layout]);
  // the log's value column is fixed by the longest label any packet can write
  const logLabelChars = useMemo(
    () => Math.max(10, ...plans.flatMap((p) => [...p.hops.map((h) => layout.edges[h.edge].label.length), p.spec.result?.label.length ?? 0])),
    [plans, layout],
  );

  // ------------------------------------------------ this frame
  const cam = cameraAt(camStates, keys, t);
  const P = new Projector(cam, W, H, fov);
  const px = H / 1080;
  const zoomGrow = Math.pow(Math.min(3, Math.max(0.5, cam.zoom)), 0.55);
  const lineW = 1.25 * px * zoomGrow;
  const exitK = exit ? 1 - ease.ui(clamp01((t - exit.at) / (exit.dur ?? 0.5))) : 1;
  if (exitK <= 0) return null;

  // highlight and focus levels
  const nodeLit = new Float64Array(layout.nodes.length);
  const nodeDim = new Float64Array(layout.nodes.length);
  const edgeLit = new Float64Array(layout.edges.length);
  const edgeDim = new Float64Array(layout.edges.length);
  let groupDim = 0;
  for (const {h, edges, nodes} of lit) {
    const k = envelope(t, h.from, h.to, h.fade ?? 0.45);
    if (k <= 0) continue;
    const d = (1 - (h.dim ?? 0.34)) * k;
    groupDim = Math.max(groupDim, d * 0.8);
    layout.nodes.forEach((n, i) => {
      if (nodes.has(n.id)) nodeLit[i] = Math.max(nodeLit[i], k);
      else nodeDim[i] = Math.max(nodeDim[i], d);
    });
    layout.edges.forEach((_, i) => {
      if (edges.has(i)) edgeLit[i] = Math.max(edgeLit[i], k);
      else edgeDim[i] = Math.max(edgeDim[i], d);
    });
  }
  const opened = new Map<string, number>();
  for (const f of focus) {
    const k = envelope(t, f.from, f.to, f.fade ?? 0.6);
    if (k <= 0) continue;
    opened.set(f.node, Math.max(opened.get(f.node) ?? 0, k));
    const d = (1 - (f.dim ?? 0.1)) * k;
    groupDim = Math.max(groupDim, d);
    layout.nodes.forEach((n, i) => {
      if (n.id !== f.node) nodeDim[i] = Math.max(nodeDim[i], d);
    });
    layout.edges.forEach((e, i) => {
      if (e.from !== f.node && e.to !== f.node) edgeDim[i] = Math.max(edgeDim[i], d);
      else edgeDim[i] = Math.max(edgeDim[i], d * 0.55);
    });
  }

  // packets: positions, lit wires, pulses, log
  const pulse = new Float64Array(layout.nodes.length);
  // time since the latest packet arrival at each card (for the ping), or -1
  const ping = new Float64Array(layout.nodes.length).fill(-1);
  const wires: Array<{edge: number; s0: number; s1: number; a: number}> = [];
  const dots: Array<{x: number; y: number; fade: number; trail: number[]}> = [];
  const logLines: Array<{label: string; text: string; cite: string; age: number; current: boolean; idx: number; k: number; pi: number}> = [];
  const tmp = new Float64Array(4);
  plans.forEach((plan, pi) => {
    const trailLen = plan.spec.trail ?? 170;
    const logK = packetLog ? 1 - ease.ui(clamp01((t - plan.end - (packetLog.hold ?? 1.4)) / (packetLog.fade ?? 0.5))) : 0;
    const startIdx = nodeIndex.get(plan.spec.path[0]);
    if (startIdx != null && t >= plan.start - 0.25 && t < plan.start + 0.6) pulse[startIdx] = Math.max(pulse[startIdx], 1 - Math.abs(t - plan.start) / 0.6);
    plan.hops.forEach((h, hi) => {
      const tab = tables[h.edge];
      const L = tab.total;
      if (t >= h.t0) {
        const f = t >= h.t1 ? 1 : ease.inOut(clamp01((t - h.t0) / (h.t1 - h.t0)));
        const s = f * L;
        // afterglow: the travelled wire fades out over a fixed time, and is fully gone after it
        const after = t > h.t1 ? t - h.t1 : 0;
        const a = after < AFTERGLOW_S ? (1 - after / AFTERGLOW_S) ** 2 : 0;
        if (a > 0) {
          const [s0, s1] = h.reversed ? [L - s, L] : [0, s];
          wires.push({edge: h.edge, s0, s1, a});
        }
        if (t <= h.t1) {
          const sw = h.reversed ? L - s : s;
          pointAt(tab, sw, tmp);
          // the trail runs from its tail to the packet, whichever way the edge is travelled
          let trail = h.reversed ? subRoute(tab, sw, Math.min(L, sw + trailLen)) : subRoute(tab, Math.max(0, sw - trailLen), sw);
          if (h.reversed) {
            const rev: number[] = [];
            for (let k = trail.length - 2; k >= 0; k -= 2) rev.push(trail[k], trail[k + 1]);
            trail = rev;
          }
          dots.push({x: tmp[0], y: tmp[1], fade: 1, trail});
        }
        if (h.chip && t >= h.t0 && logK > 0) {
          const ev = layout.edges[h.edge].evidence;
          const last = ev?.[ev.length - 1];
          const cite = last && packetLog && packetLog.cite !== false ? `${last.file.slice(last.file.lastIndexOf('/') + 1)}:${last.line}` : '';
          logLines.push({label: layout.edges[h.edge].label, text: h.chip, cite, age: t - h.t0, current: t <= h.t1 + (plan.spec.dwell ?? 0.24), idx: hi, k: logK, pi});
        }
      }
      const ni = nodeIndex.get(h.to);
      if (ni != null && t >= h.t1) {
        const dt = t - h.t1;
        if (dt < PING_S && (ping[ni] < 0 || dt < ping[ni])) ping[ni] = dt;
        const next = plan.hops[hi + 1];
        const resting = next ? t < next.t0 : dt < 0.3;
        const k = resting ? 1 : Math.max(0, 1 - (next ? t - next.t0 : dt - 0.3) / 0.8);
        pulse[ni] = Math.max(pulse[ni], k);
      }
    });
    // absorbed into the last node, which may give something back
    const last = plan.hops[plan.hops.length - 1];
    const res = plan.spec.result;
    if (res && last && t >= last.t1 && logK > 0)
      logLines.push({label: res.label, text: res.text, cite: packetLog && packetLog.cite !== false ? res.cite ?? '' : '', age: t - last.t1, current: true, idx: plan.hops.length, k: logK, pi});
    if (last && t > last.t1 && t < last.t1 + 0.35) {
      const tab = tables[last.edge];
      pointAt(tab, last.reversed ? 0 : tab.total, tmp);
      dots.push({x: tmp[0], y: tmp[1], fade: 1 - (t - last.t1) / 0.35, trail: []});
    }
  });

  // ------------------------------------------------ backdrop
  let backdropEl: React.ReactNode = null;
  if (backdrop > 0) {
    const k = backdrop * exitK * ease.ui(clamp01((t - (schedule.node.get(layout.order[0]) ?? 0) + 0.3) / 0.8));
    const {w: bw, h: bh} = layout.bounds;
    // feathered: stacked plates growing outwards, so the edge of the plate has no edge
    backdropEl = (
      <g opacity={k}>
        {[0, 1, 2, 3, 4].map((j) => {
          const g = 40 + j * 26;
          const xy = outlineWithLegendGap({x: -g, y: -g, w: bw + 2 * g, h: bh + 2 * g}, 60 + g, 0, 0, 8);
          return <path key={j} d={`${P.path(xy)}Z`} fill="#050807" opacity={0.22} />;
        })}
      </g>
    );
  }

  // ------------------------------------------------ groups
  const groupEls: React.ReactNode[] = [];
  layout.groups.forEach((g, gi) => {
    const t0 = schedule.group.get(g.id) ?? 0;
    const q = ease.text(clamp01((t - t0) / schedule.groupDur));
    if (q <= 0) return;
    const legend = ease.ui(clamp01((t - t0 - 0.1) / 0.5));
    const op = exitK * (1 - groupDim);
    g.rects.forEach((r, ri) => {
      const d = P.path(outlines[gi][ri].xy);
      const ev = evolvePath(q, d);
      groupEls.push(
        <path key={`g${gi}-${ri}`} d={d} fill="none" stroke="rgba(228,234,231,0.15)" strokeWidth={lineW * 0.9} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={op} />,
      );
    });
    const lab = S.group.label;
    g.rects.forEach((r, ri) => {
      const box: Box = {x: r.x + S.group.legendInset, y: r.y - lab.lineH / 2, w: g.labelW + (g.path ? S.group.pathGap + g.pathW : 0), h: lab.lineH};
      groupEls.push(
        <g key={`gl${gi}-${ri}`} transform={boxMatrix(P, box)} opacity={op * legend}>
          <text x={0} y={baselineIn(0, lab.lineH, lab.size, 'mono')} fontFamily={font.mono} fontSize={lab.size} fontWeight={lab.weight} letterSpacing={lab.tracking * lab.size} fill={C.text.secondary}>
            {g.label.toUpperCase()}
          </text>
          {g.path ? (
            <text x={g.labelW + S.group.pathGap} y={baselineIn(0, lab.lineH, lab.size, 'mono')} fontFamily={font.mono} fontSize={S.group.path.size} fontWeight={S.group.path.weight} fill={C.text.tertiary}>
              {g.path}
            </text>
          ) : null}
        </g>,
      );
    });
  });

  // ------------------------------------------------ edges
  const edgeEls: React.ReactNode[] = [];
  const glowEls: React.ReactNode[] = [];
  const labelEls: React.ReactNode[] = [];
  const wireLit = new Float64Array(layout.edges.length);
  for (const w of wires) wireLit[w.edge] = Math.max(wireLit[w.edge], w.a);
  layout.edges.forEach((e, i) => {
    const sch = schedule.edge.get(e.id);
    const q = sch ? ease.text(clamp01((t - sch.t0) / sch.dur)) : 1;
    if (q <= 0) return;
    const d = P.path(tables[i].xy);
    const ev = evolvePath(q, d);
    const op = exitK * (1 - edgeDim[i] * (1 - Math.max(edgeLit[i], wireLit[i])));
    edgeEls.push(<path key={`e${i}`} d={d} fill="none" stroke={EDGE} strokeWidth={lineW} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={op} />);
    // arrowhead, once the line has landed
    const ah = clamp01((q - 0.82) / 0.18);
    if (ah > 0) {
      const xy = tables[i].xy;
      const n = xy.length / 2;
      const a = [0, 0];
      const b = [0, 0];
      P.project(xy[2 * n - 4], xy[2 * n - 3], a);
      P.project(xy[2 * n - 2], xy[2 * n - 1], b);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const len = S.edge.arrow * P.scaleAt(xy[2 * n - 2], xy[2 * n - 1]) * ah;
      const sp = 0.52;
      const p1 = [b[0] - len * (ux * Math.cos(sp) - uy * Math.sin(sp)), b[1] - len * (uy * Math.cos(sp) + ux * Math.sin(sp))];
      const p2 = [b[0] - len * (ux * Math.cos(sp) + uy * Math.sin(sp)), b[1] - len * (uy * Math.cos(sp) - ux * Math.sin(sp))];
      const lk = Math.max(edgeLit[i], wireLit[i] * 0.8);
      edgeEls.push(
        <path
          key={`a${i}`}
          d={`M${p1[0].toFixed(2)} ${p1[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}L${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`}
          fill="none"
          stroke={lk > 0.01 ? interpolateColors(lk, [0, 1], [EDGE, MINT]) : EDGE}
          strokeWidth={lineW * 1.05}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={op}
        />,
      );
    }
    // a lit path: soft mint underglow and a crisp mint line
    const hl = edgeLit[i] * q;
    if (hl > 0.005) {
      glowEls.push(<path key={`hg${i}`} d={d} fill="none" stroke={MINT} strokeWidth={lineW * 6} strokeLinecap="round" opacity={0.1 * hl * exitK} />);
      glowEls.push(<path key={`hl${i}`} d={d} fill="none" stroke={MINT} strokeWidth={lineW * 1.6} strokeLinecap="round" opacity={0.95 * hl * exitK} />);
    }
    const showLabel = edgeLabels === 'all' ? 1 : edgeLabels === 'none' ? 0 : Math.max(edgeLit[i], Math.min(1, wireLit[i] * 1.2));
    if (showLabel > 0.01 && e.label && e.labelBox) {
      const L = S.edge.label;
      const b = e.labelBox;
      labelEls.push(
        <g key={`l${i}`} transform={boxMatrix(P, b)} opacity={showLabel * exitK * q}>
          <rect x={0} y={0} width={b.w} height={b.h} rx={b.h / 2} fill="#0B100E" fillOpacity={0.94} stroke={MINT} strokeOpacity={0.45} strokeWidth={lineW * 0.9} vectorEffect="non-scaling-stroke" />
          <text x={b.w / 2} y={baselineIn(0, b.h, L.size, 'mono')} textAnchor="middle" fontFamily={font.mono} fontSize={L.size} fontWeight={L.weight} letterSpacing={L.tracking * L.size} fill={C.accent.mintLabel}>
            {e.label}
          </text>
        </g>,
      );
    }
  });
  // wires lit by packets: the stretch already travelled glows and fades behind the packet
  wires.forEach((w, wi) => {
    const seg = subRoute(tables[w.edge], w.s0, w.s1);
    if (seg.length < 4) return;
    glowEls.push(<path key={`w${wi}`} d={P.path(seg)} fill="none" stroke={MINT} strokeWidth={lineW * 1.5} strokeLinecap="round" opacity={0.75 * w.a * exitK} />);
  });

  // ------------------------------------------------ cards
  // Cards focus in the way the film's type does: a short blur-and-fade pull.
  const blurDefs: React.ReactNode[] = [];
  const blurFor = (i: number, since: number, scale: number): string | undefined => {
    if (since < 0 || since >= FOCUS_PULL_S) return undefined;
    const k = 1 - ease.text(since / FOCUS_PULL_S);
    const sd = (k * 4.5 * px) / Math.max(1e-3, scale);
    if (sd < 0.05) return undefined;
    const id = `${uid}-pull-${i}`;
    blurDefs.push(
      <filter key={id} id={id} x="-10%" y="-20%" width="120%" height="140%">
        <feGaussianBlur stdDeviation={sd.toFixed(3)} />
      </filter>,
    );
    return `url(#${id})`;
  };
  const cardEl = (n: LayoutNode, i: number) => {
    const t0 = schedule.node.get(n.id) ?? 0;
    const p = clamp01((t - t0) / schedule.nodeDur);
    if (p <= 0) return null;
    const e = ease.ui(p);
    const open = opened.get(n.id) ?? 0;
    const lift = (1 - e) * 16;
    const w = n.detail ? n.w + (n.detail.w - n.w) * ease.inOut(open) : n.w;
    const h = n.detail ? n.h + (n.detail.h - n.h) * ease.inOut(open) : n.h;
    const box: Box = {x: n.x, y: n.y + lift, w, h};
    const lk = Math.max(nodeLit[i], pulse[i], open);
    const op = exitK * e * (1 - nodeDim[i] * (1 - lk));
    const Ck = S.card;
    const content = ease.ui(clamp01((t - t0 - 0.08) / (schedule.nodeDur * 0.9)));
    const kindY = baselineIn(Ck.padTop, Ck.kind.lineH, Ck.kind.size, 'mono');
    const titleTop = Ck.padTop + Ck.kind.lineH + Ck.gapKindTitle;
    const subTop = titleTop + Ck.title.lineH + Ck.gapTitleSub;
    const kindColor = lk > 0.01 ? interpolateColors(lk, [0, 1], [C.text.secondary, MINT]) : C.text.secondary;
    const r = Ck.radius;
    const fold = n.kind === 'data' ? 16 : 0;
    const body = fold
      ? `M${r} 0H${w - fold}L${w} ${fold}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
      : `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
    const detailK = n.detail ? ease.ui(clamp01((open - 0.45) / 0.55)) : 0;
    const D = Ck.detail;
    const DH = Ck.detailHead;
    const divY = n.h - Ck.padBottom + D.gapTop * 0.5;
    const headTop = divY + D.gapTop * 0.5;
    const linesTop = headTop + DH.lineH + DH.gapBelow;
    return (
      <g key={n.id} transform={boxMatrix(P, box)} opacity={op} filter={blurFor(i, t - t0, P.scaleAt(box.x + box.w / 2, box.y + box.h / 2))}>
        {/* a soft shadow from stacked translucent plates */}
        {[
          [3, 0.2],
          [8, 0.11],
          [15, 0.06],
        ].map(([g, a]) => (
          <rect key={g} x={-g * 0.5} y={g * 0.35} width={w + g} height={h + g * 0.6} rx={r + g * 0.5} fill="#000" opacity={a} />
        ))}
        {open > 0 ? <path d={body} fill="#0C1110" opacity={ease.ui(open)} /> : null}
        <path d={body} fill={`url(#${uid}-card)`} />
        {n.kind === 'ui' ? <path d={`M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${Ck.padTop + Ck.kind.lineH + 4}H0V${r}A${r} ${r} 0 0 1 ${r} 0Z`} fill="rgba(228,234,231,0.035)" /> : null}
        {fold ? <path d={`M${w - fold} 0V${fold}H${w}Z`} fill="rgba(228,234,231,0.07)" stroke={RULE} strokeWidth={lineW} vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null}
        <path d={body} fill="none" stroke={C.card.ruleStrong} strokeOpacity={0.62} strokeWidth={lineW} vectorEffect="non-scaling-stroke" />
        {lk > 0.01 ? <path d={body} fill="none" stroke={MINT} strokeWidth={lineW * 1.5} opacity={lk * 0.95} vectorEffect="non-scaling-stroke" /> : null}
        {lk > 0.01 ? (
          <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={r + 4} fill="none" stroke={MINT} strokeWidth={lineW * 4} opacity={lk * 0.12} vectorEffect="non-scaling-stroke" />
        ) : null}
        {ping[i] >= 0
          ? (() => {
              const q = ping[i] / PING_S;
              const g = 3 + 15 * ease.ui(q);
              return <rect x={-g} y={-g} width={w + 2 * g} height={h + 2 * g} rx={r + g} fill="none" stroke={MINT} strokeWidth={lineW * 1.2} opacity={0.55 * (1 - q) * (1 - q)} vectorEffect="non-scaling-stroke" />;
            })()
          : null}
        <g opacity={content}>
          <g transform={`translate(${Ck.padX + Ck.glyph / 2} ${Ck.padTop + Ck.kind.lineH / 2})`}>
            <KindGlyph kind={n.kind} size={Ck.glyph} stroke={kindColor} fill={kindColor} sw={1.25} />
          </g>
          <text x={Ck.padX + Ck.glyph + Ck.glyphGap} y={kindY} fontFamily={font.mono} fontSize={Ck.kind.size} fontWeight={Ck.kind.weight} letterSpacing={Ck.kind.tracking * Ck.kind.size} fill={kindColor}>
            {n.kind.toUpperCase()}
          </text>
          <text x={Ck.padX} y={baselineIn(titleTop, Ck.title.lineH, Ck.title.size, 'sans')} fontFamily={font.sans} fontSize={Ck.title.size} fontWeight={Ck.title.weight} letterSpacing={Ck.title.tracking * Ck.title.size} fill={C.text.display}>
            {n.label}
          </text>
          <text x={Ck.padX} y={baselineIn(subTop, Ck.sub.lineH, Ck.sub.size, 'mono')} fontFamily={font.mono} fontSize={Ck.sub.size} fontWeight={Ck.sub.weight} fill={C.text.secondary}>
            {n.sub}
          </text>
        </g>
        {n.detail && detailK > 0 ? (
          <g opacity={detailK}>
            <path d={`M${Ck.padX} ${divY}H${w - Ck.padX}`} stroke={RULE} strokeWidth={lineW} vectorEffect="non-scaling-stroke" />
            <text x={Ck.padX} y={baselineIn(headTop, DH.lineH, DH.size, 'mono')} fontFamily={font.mono} fontSize={DH.size} fontWeight={DH.weight} letterSpacing={DH.tracking * DH.size} fill={C.text.tertiary}>
              {n.detail.head}
            </text>
            {n.detail.lines.map((line, li) => {
              const k = ease.ui(clamp01((open - 0.55 - li * 0.06) / 0.4));
              const hash = line.indexOf('#');
              const code = hash >= 0 ? line.slice(0, hash) : line;
              const note = hash >= 0 ? line.slice(hash) : '';
              return (
                <text key={li} x={Ck.padX} y={baselineIn(linesTop + li * D.lineH, D.lineH, D.size, 'mono')} fontFamily={font.mono} fontSize={D.size} fontWeight={D.weight} opacity={k} xmlSpace="preserve" style={{whiteSpace: 'pre'}}>
                  <tspan fill={C.text.caption}>{code}</tspan>
                  {note ? <tspan fill={C.text.tertiary}>{note}</tspan> : null}
                </text>
              );
            })}
          </g>
        ) : null}
      </g>
    );
  };
  const order = [...layout.nodes.keys()].sort((a, b) => (opened.get(layout.nodes[a].id) ?? 0) - (opened.get(layout.nodes[b].id) ?? 0));
  const cardEls = order.map((i) => cardEl(layout.nodes[i], i));

  // ------------------------------------------------ packets
  const dotEls = dots.map((d, i) => {
    const o = [0, 0];
    P.project(d.x, d.y, o);
    const sc = P.scaleAt(d.x, d.y);
    const trail = d.trail;
    const segs: React.ReactNode[] = [];
    const n = trail.length / 2;
    if (n >= 2) {
      // the trail brightens toward the packet: drawn as overlapping tails
      for (let k = 0; k < 5; k++) {
        const from = Math.floor(((n - 1) * k) / 5);
        const part = Array.prototype.slice.call(trail, from * 2) as number[];
        if (part.length < 4) continue;
        segs.push(<path key={k} d={P.path(part)} fill="none" stroke={MINT} strokeWidth={lineW * (1.4 + k * 0.35)} strokeLinecap="round" opacity={0.12 + k * 0.1} />);
      }
    }
    return (
      <g key={`p${i}`} opacity={exitK * d.fade}>
        {segs}
        <circle cx={o[0]} cy={o[1]} r={26 * sc} fill={`url(#${uid}-halo)`} />
        <circle cx={o[0]} cy={o[1]} r={5.2 * sc} fill="#E9FFF7" />
        <circle cx={o[0]} cy={o[1]} r={8.5 * sc} fill="none" stroke={MINT} strokeWidth={lineW * 1.2} opacity={0.85} />
      </g>
    );
  });

  // ------------------------------------------------ packet log
  let logEl: React.ReactNode = null;
  if (packetLog && logLines.length) {
    const max = packetLog.lines ?? 3;
    const size = typeTokens.monoChip.size * H;
    const labelSize = typeTokens.monoCardLabel.size * H;
    const lineH = size * 1.55;
    const shown = logLines.slice(-max);
    const x = packetLog.x * W;
    const y0 = packetLog.y * H;
    // mono: every character is 0.6 em, plus the 0.15 em tracking of the label column
    const valueX = x + labelSize * 2.6 + labelSize * 0.75 * (logLabelChars + 3);
    logEl = (
      <g opacity={exitK}>
        {shown.map((l, i) => {
          const fromBottom = shown.length - 1 - i;
          const enter = ease.ui(clamp01(l.age / 0.35));
          const y = y0 - fromBottom * lineH + (1 - enter) * size * 0.5;
          const op = l.k * enter * (l.current ? 1 : 0.58 - fromBottom * 0.12);
          return (
            <g key={`${l.pi}-${l.idx}`} opacity={Math.max(0, op)}>
              <text x={x} y={y} fontFamily={font.mono} fontSize={labelSize} fontWeight={500} letterSpacing={0.15 * labelSize} fill={l.current ? C.accent.mintLabel : C.text.tertiary}>
                {String(l.idx + 1).padStart(2, '0')}
              </text>
              <text x={x + labelSize * 2.6} y={y} fontFamily={font.mono} fontSize={labelSize} fontWeight={500} letterSpacing={0.15 * labelSize} fill={l.current ? C.text.secondary : C.text.tertiary}>
                {l.label.toUpperCase()}
              </text>
              <text x={valueX} y={y} fontFamily={font.mono} fontSize={size} fontWeight={450} fill={l.current ? MINT : C.text.secondary} xmlSpace="preserve" style={{whiteSpace: 'pre'}}>
                {l.text}
                {l.cite ? (
                  <tspan fill={C.text.tertiary} fontSize={labelSize} letterSpacing={0.04 * labelSize}>
                    {'   '}
                    {l.cite}
                  </tspan>
                ) : null}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <linearGradient id={`${uid}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151C1A" stopOpacity={0.96} />
          <stop offset="1" stopColor="#0C1110" stopOpacity={0.96} />
        </linearGradient>
        {blurDefs}
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0" stopColor={MINT} stopOpacity={0.55} />
          <stop offset="0.35" stopColor={MINT} stopOpacity={0.18} />
          <stop offset="1" stopColor={MINT} stopOpacity={0} />
        </radialGradient>
      </defs>
      {backdropEl}
      <g>{groupEls}</g>
      <g>{edgeEls}</g>
      <g>{glowEls}</g>
      <g>{cardEls}</g>
      <g>{labelEls}</g>
      <g>{dotEls}</g>
      {logEl}
    </svg>
  );
};
