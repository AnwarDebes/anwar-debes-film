// Architecture diagrams: the input a dossier writes, and the laid-out form
// scripts/diagram/layout.mjs produces from it. All lengths are in u, where
// 1 u = 1/1000 of the frame height at camera zoom 1.

export type NodeKind = 'module' | 'data' | 'model' | 'ui' | 'service' | 'step' | 'test';

/** One line of code or an import that justifies an edge. */
export interface Evidence {
  file: string;
  line: number;
  code: string;
}

/** What a research dossier writes (`<repo>.arch.json`). Only id/label/kind/path and from/to/label are required. */
export interface ArchInput {
  id?: string;
  title?: string;
  repo?: string;
  commit?: string;
  about?: string;
  groups?: Array<{id: string; label?: string; path?: string; parent?: string}>;
  nodes: Array<{
    id: string;
    label: string;
    kind: NodeKind;
    path?: string;
    /** Third line of the card; defaults to the basename of `path`. */
    sub?: string;
    group?: string;
    /** Line count of the source, shown in the zoomed card. */
    loc?: number;
    /** Lines shown when the card opens (zoom into a module): real code or docstring lines. */
    detail?: string[];
    /** Composition hint for the layout: the row this card sits on (fractions allowed). */
    row?: number;
  }>;
  edges: Array<{from: string; to: string; label?: string; straight?: boolean; evidence?: Evidence[]}>;
  /** Named node paths (for packets and highlights). */
  paths?: Record<string, string[]>;
}

export interface TextStyle {
  font: 'sans' | 'mono';
  size: number;
  weight: number;
  tracking: number;
  lineH: number;
}

export interface DiagramStyle {
  card: {
    padX: number;
    padTop: number;
    padBottom: number;
    radius: number;
    minW: number;
    glyph: number;
    glyphGap: number;
    kind: TextStyle;
    gapKindTitle: number;
    title: TextStyle;
    gapTitleSub: number;
    sub: TextStyle;
    detail: TextStyle & {gapTop: number; padBottom: number};
    detailHead: TextStyle & {gapBelow: number};
  };
  group: {
    pad: number;
    clearance: number;
    radius: number;
    legendInset: number;
    legendGap: number;
    pathGap: number;
    label: TextStyle;
    path: TextStyle;
  };
  edge: {cornerRadius: number; arrow: number; label: TextStyle; labelPadX: number; labelPadY: number};
  spacing: Record<string, number>;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutNode extends Box {
  id: string;
  label: string;
  kind: NodeKind;
  sub: string;
  path?: string;
  group?: string;
  loc?: number;
  /** Column index, left to right. */
  rank: number;
  /** Position in topological order (the build order). */
  order: number;
  /** The opened card: its size, a mono header and the lines. */
  detail?: {w: number; h: number; head: string; lines: string[]};
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  /** Route from the source's east side to the target's west side (orthogonal unless `curve`). */
  points: Array<[number, number]>;
  /** 'smooth': a sampled spline route, drawn as is (no corner rounding). */
  curve?: 'smooth';
  labelBox?: Box;
  evidence?: Evidence[];
}

export interface LayoutGroup {
  id: string;
  label: string;
  path?: string;
  /** Usually one outline; several when the members could not share one rectangle. */
  rects: Box[];
  labelW: number;
  pathW: number;
  nodes: string[];
}

export interface DiagramLayout {
  id: string;
  title: string;
  repo?: string;
  commit?: string;
  about?: string;
  generated: {by: string; elk: string; routing: string; measured: boolean; cyclic: boolean};
  unit: string;
  style: DiagramStyle;
  bounds: {w: number; h: number};
  ranks: number;
  order: string[];
  nodes: LayoutNode[];
  groups: LayoutGroup[];
  edges: LayoutEdge[];
  paths?: Record<string, string[]>;
}

/** Checks the shape of an imported `<id>.layout.json` and types it. */
export const asDiagramLayout = (json: unknown): DiagramLayout => {
  const L = json as Partial<DiagramLayout>;
  if (!L || !Array.isArray(L.nodes) || !Array.isArray(L.edges) || !Array.isArray(L.groups) || !L.style || !L.bounds) {
    throw new Error('not a diagram layout: run scripts/diagram/layout.mjs on the architecture JSON first');
  }
  return L as DiagramLayout;
};
