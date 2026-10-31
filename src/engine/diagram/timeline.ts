// Everything a diagram does over time, as pure functions of t (seconds from the start of
// the Sequence the diagram lives in). No state is carried from one frame to the next.

import {Easing} from 'remotion';
import {easing as EASE} from '../tokens';
import {arcTable, roundedRoute, type ArcTable} from './geometry';
import type {DiagramLayout} from './types';

/** Arc-length tables of every edge route, as the renderer draws them (rounded corners). */
export const edgeTables = (layout: DiagramLayout): ArcTable[] =>
  layout.edges.map((e) => arcTable(roundedRoute(e.points, e.curve === 'smooth' ? 0 : layout.style.edge.cornerRadius, 12)));

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeUi = Easing.bezier(EASE.ui[0], EASE.ui[1], EASE.ui[2], EASE.ui[3]);
const easeText = Easing.bezier(EASE.text[0], EASE.text[1], EASE.text[2], EASE.text[3]);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);
export const ease = {ui: easeUi, text: easeText, inOut: easeInOut};

// ------------------------------------------------------------------ build

export interface BuildSpec {
  /** Seconds: the first card starts to appear. Default 0. */
  at?: number;
  /** Seconds between cards in build order. Default: spread over `span`. */
  stagger?: number;
  /** Seconds the whole build takes if `stagger` is not given. Default 3.6. */
  span?: number;
  /** Seconds one card takes to settle. Default 0.6. */
  nodeDur?: number;
  /** Seconds one edge takes to draw. Default 0.55. */
  edgeDur?: number;
  /** Seconds a group outline takes to draw. Default 1.1. */
  groupDur?: number;
  /** Explicit appear times for some nodes (seconds), e.g. when the narration names them. */
  times?: Record<string, number>;
  /** Build order; default: the layout's topological order. */
  order?: string[];
}

export interface Schedule {
  node: Map<string, number>;
  edge: Map<string, {t0: number; dur: number}>;
  group: Map<string, number>;
  nodeDur: number;
  groupDur: number;
  end: number;
}

export const buildSchedule = (layout: DiagramLayout, b: BuildSpec = {}): Schedule => {
  const at = b.at ?? 0;
  const nodeDur = b.nodeDur ?? 0.6;
  const edgeDur = b.edgeDur ?? 0.55;
  const groupDur = b.groupDur ?? 1.1;
  const order = b.order ?? layout.order;
  const n = order.length;
  const stagger = b.stagger ?? (n > 1 ? Math.max(0, (b.span ?? 3.6) - nodeDur) / (n - 1) : 0);
  const node = new Map<string, number>();
  order.forEach((id, i) => node.set(id, b.times?.[id] ?? at + i * stagger));
  for (const nd of layout.nodes) if (!node.has(nd.id)) node.set(nd.id, b.times?.[nd.id] ?? at);
  // an edge draws once its source is in, and lands as its target settles
  const edge = new Map<string, {t0: number; dur: number}>();
  for (const e of layout.edges) {
    const ts = node.get(e.from) ?? at;
    const tt = node.get(e.to) ?? at;
    const t0 = Math.max(ts + nodeDur * 0.45, tt + nodeDur * 0.35 - edgeDur);
    edge.set(e.id, {t0, dur: edgeDur});
  }
  const group = new Map<string, number>();
  for (const g of layout.groups) group.set(g.id, Math.min(...g.nodes.map((id) => node.get(id) ?? at)) - 0.12);
  let end = at;
  for (const v of node.values()) end = Math.max(end, v + nodeDur);
  for (const v of edge.values()) end = Math.max(end, v.t0 + v.dur);
  return {node, edge, group, nodeDur, groupDur, end};
};

// ------------------------------------------------------------------ packets

export interface PacketSpec {
  /** Node ids; each consecutive pair must share an edge (either direction). */
  path: string[];
  /** Seconds: the packet leaves path[0]. */
  at: number;
  /** u per second along the route. Default 560. */
  speed?: number;
  /** Seconds the packet rests in each node it passes through. Default 0.24. */
  dwell?: number;
  /** What travels on each hop, written to the packet log as the packet takes it. */
  chips?: Array<string | null>;
  /** What the last node gives back when the packet arrives (a final log line). */
  result?: {label: string; text: string; cite?: string};
  /** Trail length behind the packet, u. Default 170. */
  trail?: number;
}

export interface Hop {
  edge: number;
  reversed: boolean;
  t0: number;
  t1: number;
  /** node the hop arrives at */
  to: string;
  chip: string | null;
}

export interface PacketPlan {
  spec: PacketSpec;
  hops: Hop[];
  /** Arrival time at every node on the path after the first (for pulses, sound, narration). */
  arrivals: Array<{node: string; t: number}>;
  start: number;
  end: number;
}

export const planPacket = (layout: DiagramLayout, tables: ArcTable[], spec: PacketSpec): PacketPlan => {
  const speed = spec.speed ?? 560;
  const dwell = spec.dwell ?? 0.24;
  const hops: Hop[] = [];
  const arrivals: Array<{node: string; t: number}> = [];
  let t = spec.at;
  for (let i = 0; i < spec.path.length - 1; i++) {
    const a = spec.path[i];
    const b = spec.path[i + 1];
    let idx = layout.edges.findIndex((e) => e.from === a && e.to === b);
    let reversed = false;
    if (idx < 0) {
      idx = layout.edges.findIndex((e) => e.from === b && e.to === a);
      reversed = true;
    }
    if (idx < 0) throw new Error(`packet path: no edge between ${a} and ${b}`);
    const dur = Math.max(0.25, tables[idx].total / speed);
    hops.push({edge: idx, reversed, t0: t, t1: t + dur, to: b, chip: spec.chips?.[i] ?? null});
    t += dur;
    arrivals.push({node: b, t});
    t += dwell;
  }
  return {spec, hops, arrivals, start: spec.at, end: t - dwell};
};

/** Where a packet is at time t: the hop, arc length along the edge (in travel direction), or null. */
export const packetAt = (plan: PacketPlan, t: number): {hop: number; s: number; f: number} | null => {
  if (t < plan.start || !plan.hops.length) return null;
  for (let i = 0; i < plan.hops.length; i++) {
    const h = plan.hops[i];
    if (t < h.t0) return {hop: i - 1, s: Infinity, f: 1}; // resting in a node
    if (t <= h.t1) {
      const f = easeInOut(clamp01((t - h.t0) / (h.t1 - h.t0)));
      return {hop: i, s: f, f};
    }
  }
  return null;
};

// ------------------------------------------------------------------ highlights and focus

export interface HighlightSpec {
  /** Node paths; every consecutive pair lights the edge between them. */
  paths: string[][];
  /** Extra nodes to light. */
  nodes?: string[];
  from: number;
  /** Seconds; omit to hold to the end. */
  to?: number;
  /** Seconds to come in and go out. Default 0.45. */
  fade?: number;
  /** Opacity everything else keeps at full strength. Default 0.34. */
  dim?: number;
}

export interface FocusSpec {
  /** The card that opens. */
  node: string;
  from: number;
  to?: number;
  /** Seconds to open and to close. Default 0.6. */
  fade?: number;
  /** Opacity everything else keeps. Default 0.1. */
  dim?: number;
}

export const envelope = (t: number, from: number, to: number | undefined, fade: number): number => {
  const a = clamp01((t - from) / fade);
  const b = to == null ? 1 : clamp01((to - t) / fade);
  return easeUi(Math.min(a, b));
};

/** Ids of edges lit by a set of node paths. */
export const pathEdges = (layout: DiagramLayout, paths: string[][]): Set<number> => {
  const out = new Set<number>();
  for (const p of paths)
    for (let i = 0; i < p.length - 1; i++) {
      const idx = layout.edges.findIndex((e) => (e.from === p[i] && e.to === p[i + 1]) || (e.from === p[i + 1] && e.to === p[i]));
      if (idx >= 0) out.add(idx);
    }
  return out;
};

// ------------------------------------------------------------------ timing exports

/** When things happen (seconds), for narration, Pixie cues and the sound mix. */
export const diagramTimes = (
  layout: DiagramLayout,
  build: BuildSpec = {},
  packets: PacketSpec[] = [],
): {appear: Record<string, number>; built: number; arrivals: Array<Array<{node: string; t: number}>>} => {
  const sch = buildSchedule(layout, build);
  const tables = edgeTables(layout);
  return {
    appear: Object.fromEntries(sch.node),
    built: sch.end,
    arrivals: packets.map((p) => planPacket(layout, tables, p).arrivals),
  };
};
