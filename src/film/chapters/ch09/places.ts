import {emblemPixels, samplePixels, STEEL, type Board, type FieldFn, type LiveFieldFn, type LiveLayer, type PinSample} from '../../../engine/pins';
import {Pic, picField, pinXY, type Look} from './kit/pic';
import zooLines from '../../../data/ch09/zoo-lines.json';

// The pin pictures of chapter 09's first places. Units are pins (y up) around each place origin.

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ---------------------------------------------------------------- 09.0 the gate

export interface GateGeom {
  /** cube centre, uv */
  u: number;
  v: number;
  /** cube side, pins */
  side: number;
  /** cube height, reliefs */
  hc: number;
}

const DARK = 0.4;

/** The cube's top face (with the nitrobenzene emblem pressed into it), at pin coordinates. */
const topFace = (g: GateGeom, x: number, y: number, out: PinSample) => {
  const half = g.side / 2;
  const s = (x + half) / g.side;
  const t = (y + half) / g.side;
  const img = emblemPixels('graphtm');
  const r = samplePixels(img, s, t, 0);
  const gch = samplePixels(img, s, t, 1);
  out.h = g.hc + 0.2 * r;
  out.tint = DARK + (0.98 - DARK) * Math.min(1, 3 * r) * gch;
  out.glow = 0;
  return out;
};

/** The raised cube (beat field). */
export const cubeField = (b: Board, g: GateGeom): FieldFn => {
  const half = g.side / 2;
  const flat: PinSample = {h: 0, tint: STEEL};
  return (u, v) => {
    const [x, y] = pinXY(b, g.u, g.v, u, v);
    if (Math.abs(x) > half || Math.abs(y) > half) return flat;
    return topFace(g, x, y, {h: 0, tint: 0});
  };
};

/** The unfolded net: the top face plus four flaps lying flat at the cube's height (beat field). */
export const netField = (b: Board, g: GateGeom): FieldFn => {
  const half = g.side / 2;
  const L = g.hc * 22;
  const flat: PinSample = {h: 0, tint: STEEL};
  return (u, v) => {
    const [x, y] = pinXY(b, g.u, g.v, u, v);
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax <= half && ay <= half) return topFace(g, x, y, {h: 0, tint: 0});
    if ((ax <= half && ay <= half + L) || (ay <= half && ax <= half + L)) return {h: g.hc, tint: DARK + 0.06};
    return flat;
  };
};

/**
 * The unfold, live: each flap is hinged on a top edge of the cube and swings out from hanging
 * straight down (no footprint) to flat at the cube's height, like a box net opening.
 */
export const unfoldLayer = (b: Board, g: GateGeom, at: number, dur: number): LiveLayer => {
  const half = g.side / 2;
  const L = g.hc * 22;
  const faceDur = dur * 0.72;
  const stagger = (dur - faceDur) / 3;
  const out: PinSample = {h: 0, tint: STEEL, glow: 0};
  const kx = 1 / b.p;
  const ky = b.extH / b.p;
  const fn: LiveFieldFn = (u, v, _i, t) => {
    const x = (u - g.u) * kx;
    const y = (v - g.v) * ky;
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax <= half && ay <= half) return topFace(g, x, y, out);
    let f = -1;
    let d = 0;
    if (ay <= half && x > half) {
      f = 0;
      d = x - half;
    } else if (ax <= half && y > half) {
      f = 1;
      d = y - half;
    } else if (ay <= half && x < -half) {
      f = 2;
      d = -x - half;
    } else if (ax <= half && y < -half) {
      f = 3;
      d = -y - half;
    }
    out.glow = 0;
    if (f < 0 || d > L + 0.5) {
      out.h = 0;
      out.tint = STEEL;
      return out;
    }
    const k = ease((t - at - f * stagger) / faceDur);
    const phi = (Math.PI / 2) * (1 - k);
    const foot = L * Math.cos(phi);
    if (d > foot) {
      out.h = 0;
      out.tint = STEEL;
      return out;
    }
    out.h = g.hc - (d * Math.tan(phi)) / 22;
    if (out.h < 0) out.h = 0;
    // the flap's underside catches less light while it is still steep
    out.tint = DARK + 0.06 * k;
    return out;
  };
  const pad = (half + L + 2) * b.p;
  return {fn, from: at, to: at + dur + 0.05, fadeS: 0.04, region: [g.u - pad, g.v - (pad / b.extH) * 1.02, g.u + pad, g.v + (pad / b.extH) * 1.02], speedHint: () => 0.9};
};

// ---------------------------------------------------------------- 09.0/09.1 the family tree

export interface TreeGeom {
  /** uv of each plot centre, left to right (film order) */
  plots: Array<[number, number]>;
  /** trunk: uv y and u range */
  trunkV: number;
  trunkU0: number;
  trunkU1: number;
  plot: number;
}

const PLOT: Look = {h: 0.42, tint: 0.97};
const PLOT_INSET: Look = {h: 0.2, tint: 0.62};
const LINE: Look = {h: 0.16, tint: 0.86};

/** Nine plots hanging off one trunk of pin lines; the first (the survey) is a small page. */
export const treeField = (b: Board, g: TreeGeom): FieldFn => {
  const ou = 0.5;
  const ov = g.trunkV;
  const pic = new Pic();
  const xs = (u: number) => (u - ou) / b.p;
  const ys = (v: number) => ((v - ov) * b.extH) / b.p;
  pic.seg(xs(g.trunkU0), 0, xs(g.trunkU1), 0, 0.55, LINE);
  g.plots.forEach(([u, v], k) => {
    const x = xs(u);
    const y = ys(v);
    const edge = y > 0 ? y - g.plot / 2 : y + g.plot / 2;
    pic.seg(x, 0, x, edge, 0.5, LINE);
    pic.disc(x, 0, 1.3, {h: 0.3, tint: 1.0});
    pic.rect(x, y, g.plot, g.plot, PLOT, 1.2, 0.6);
    if (k === 0) {
      // the survey: a page of lines
      for (let r = 0; r < 5; r++) pic.seg(x - g.plot * 0.32, y + g.plot * 0.3 - r * 1.75, x + g.plot * (r % 2 ? 0.12 : 0.3), y + g.plot * 0.3 - r * 1.75, 0.32, PLOT_INSET, 0.35);
    } else {
      // a small graph inside every other plot
      const n = 3 + (k % 3);
      const pts: Array<[number, number]> = [];
      for (let j = 0; j < n; j++) {
        const a = (j / n) * Math.PI * 2 + k;
        pts.push([x + Math.cos(a) * g.plot * 0.27, y + Math.sin(a) * g.plot * 0.27]);
      }
      for (let j = 0; j < n; j++) pic.seg(pts[j][0], pts[j][1], pts[(j + 1) % n][0], pts[(j + 1) % n][1], 0.3, PLOT_INSET, 0.35);
      for (const [px, py] of pts) pic.disc(px, py, 0.9, {h: 0.62, tint: 1.0}, 0.4);
    }
  });
  return picField(b, pic, ou, ov);
};

// ---------------------------------------------------------------- 09.1 the survey in pins

interface DocLayout {
  /** pins per column, bars scale to it */
  colW: number;
  gap: number;
  rowsPerCol: number;
  /** lines per pin row */
  per: number;
}

export interface ZooGeom {
  /** uv of the top-left corner of the paper */
  u: number;
  v: number;
}

const ROW = Math.sqrt(3) / 2;
const BAR: Look = {h: 0.3, tint: 1.0};
const BAR_HEAD: Look = {h: 0.55, tint: 1.06};
const BAR_TABLE: Look = {h: 0.4, tint: 1.02};
const BAR_JSON: Look = {h: 0.3, tint: 0.95};

type PaperLine = [number, string];

/** Lay a list of line lengths out as columns of raised bars, `per` lines to one pin row. */
const docPic = (lines: ReadonlyArray<{len: number; look: Look; indent?: number}>, L: DocLayout, maxLen: number, highlight?: (line: number) => Look | null) => {
  const pic = new Pic();
  const rows = Math.ceil(lines.length / L.per);
  for (let r = 0; r < rows; r++) {
    const col = Math.floor(r / L.rowsPerCol);
    const rr = r % L.rowsPerCol;
    const x0 = col * (L.colW + L.gap);
    const y = -rr * ROW;
    let len = 0;
    let look: Look = BAR;
    let indent = 0;
    let hl: Look | null = null;
    let n = 0;
    for (let k = 0; k < L.per; k++) {
      const j = r * L.per + k;
      if (j >= lines.length) break;
      n++;
      len += lines[j].len;
      indent += lines[j].indent ?? 0;
      if (lines[j].look.h > look.h) look = lines[j].look;
      const h = highlight?.(j);
      if (h) hl = h;
    }
    if (!n) continue;
    len /= n;
    indent /= n;
    const w = Math.min(1, len / maxLen) * L.colW;
    const xi = Math.min(L.colW * 0.4, (indent / maxLen) * L.colW);
    if (w - xi < 0.6) continue;
    pic.seg(x0 + xi + 0.3, y, x0 + Math.max(xi + 0.4, w - 0.3), y, 0.24, hl ?? look, 0.36);
  }
  return {pic, width: Math.ceil(rows / L.rowsPerCol) * (L.colW + L.gap) - L.gap, height: L.rowsPerCol * ROW};
};

export const PAPER_LAYOUT: DocLayout = {colW: 12, gap: 2.2, rowsPerCol: 36, per: 4};
export const TABLE_LAYOUT: DocLayout = {colW: 9.5, gap: 1.8, rowsPerCol: 28, per: 3};
/** headline_table.json lines 160-163: the four R8 rows (1-based) */
export const R8_LINES: [number, number] = [160, 163];

export interface ZooPics {
  paper: Pic;
  table: Pic;
  tableLit: Pic;
  /** pin offsets of the table's top-left from the paper's top-left */
  tableDx: number;
  width: number;
  height: number;
}

export const zooPics = (): ZooPics => {
  const paperLines = (zooLines.paper as PaperLine[]).map(([len, kind]) => ({
    len: kind === 'b' ? 0 : len,
    look: kind === 'h' ? BAR_HEAD : kind === 't' ? BAR_TABLE : BAR,
  }));
  const tableLines = (zooLines.table as Array<[number, number]>).map(([len, indent]) => ({len, indent, look: BAR_JSON}));
  const paper = docPic(paperLines, PAPER_LAYOUT, 76);
  const lit: Look = {h: 0.34, tint: [0.86, 1.08, 1.0], glow: 0.9};
  const table = docPic(tableLines, TABLE_LAYOUT, 110);
  const tableLit = docPic(tableLines, TABLE_LAYOUT, 110, (j) => (j + 1 >= R8_LINES[0] && j + 1 <= R8_LINES[1] ? lit : null));
  const tableDx = paper.width + 4;
  return {paper: paper.pic, table: table.pic, tableLit: tableLit.pic, tableDx, width: tableDx + table.width, height: Math.max(paper.height, table.height)};
};

/** The plot under a document: a low raised platform, slightly darker than the steel. */
export const plotPic = (w: number, h: number, pad = 2.2): Pic => new Pic().rect(w / 2, -h / 2, w + pad * 2, h + pad * 2, {h: 0.05, tint: 0.6}, 1.6, 0.8);

export const zooField = (b: Board, g: ZooGeom, z: ZooPics, lit: boolean): FieldFn => {
  const pic = new Pic().put(plotPic(z.width, z.height)).put(z.paper).put(lit ? z.tableLit : z.table, z.tableDx, 0);
  return picField(b, pic, g.u, g.v);
};

// ---------------------------------------------------------------- 09.2 'CEO earned more'

export const SUB_TOKENS = ['ce', '##o', 'earn', '##ed', 'more'] as const;
export const SUB_SPACING = 16.5;
const NODE: Look = {h: 0.58, tint: 1.04};
const SEQ: Look = {h: 0.2, tint: 0.84};
const DEP: Look = {h: 0.52, tint: 1.0};

/** Node x positions (pins) around the place origin. */
export const subNodeX = (k: number) => (k - 2) * SUB_SPACING;
export const SUB_ARC_BULGE = 8.5;

export interface SubStage {
  nodes: boolean;
  seq: boolean;
  deps: boolean;
}

export const subPic = (st: SubStage): Pic => {
  const pic = new Pic().put(plotPic(SUB_SPACING * 4 + 22, 30, 0), -(SUB_SPACING * 4 + 22) / 2, 19);
  const r = 3.1;
  if (st.seq) for (let k = 0; k < 4; k++) pic.seg(subNodeX(k) + r + 0.6, 0, subNodeX(k + 1) - r - 0.6, 0, 0.55, SEQ, 0.5);
  if (st.deps) {
    // earn -> ce (nsubj) and earn -> more (advmod), arcs over the row
    pic.arc(subNodeX(2), r + 0.4, subNodeX(0), r + 0.4, -SUB_ARC_BULGE, 0.62, DEP, 0.5);
    pic.arc(subNodeX(2), r + 0.4, subNodeX(4), r + 0.4, SUB_ARC_BULGE, 0.62, DEP, 0.5);
  }
  if (st.nodes) for (let k = 0; k < 5; k++) pic.disc(subNodeX(k), 0, r, NODE, 0.6);
  return pic;
};
