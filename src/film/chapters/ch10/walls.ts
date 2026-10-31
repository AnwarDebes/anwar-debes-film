import {
  blackBoxField,
  circleField,
  emblemField,
  flatField,
  rectField,
  STEEL,
  tileGridField,
  type Board,
  type FieldFn,
  type Look,
  type PinSample,
} from '../../../engine/pins';
import {AMBER, MINT, MINT_DIM, WARM, iconField, plotField, regions, rectSd, segmentField, pinsU, pinsV, type Box} from './kit/fields';

// The pin fields of chapter 10. One wall plays every place; these are its targets.

/** Where the subject of a place sits (board uv); the left third stays calm for text. */
export const SUBJ: [number, number] = [0.665, 0.56];

// ---------------------------------------------------------------- the street

/** The eight plots, left to right on the wall. The walk runs right, so the phone is last. */
export const STREET = ['c10-cookie', 'c10-gpu', 'c10-wave', 'c10-cv', 'c10-drone', 'c10-db3', 'mneme', 'pocketos'] as const;
/** Which repository each plot stands for (same order). */
export const STREET_REPOS = ['cookie-galaxy', 'Kaleido', 'CYFS', 'SkillBridgeNorway', 'drone-id', 'IDM', 'Mneme-Education-Ecosystem', 'PocketOS'] as const;
export const STREET_V = 0.53;
export const PLOT = 15;
export const PLOT_PITCH = 18;

export const streetU = (board: Board, k: number) => 0.5 + (k - 3.5) * PLOT_PITCH * board.p;

/** The street of eight plots; `lit` lights the rims of some plots mint (by index). */
export const streetField = (board: Board, opts: {lit?: readonly number[]; dimOthers?: boolean; v?: number} = {}): FieldFn => {
  const lit = new Set(opts.lit ?? []);
  const SV = opts.v ?? STREET_V;
  const layers = STREET.map((name, k) => {
    const u = streetU(board, k);
    const icon = name === 'mneme' || name === 'pocketos' ? emblemField(board, name, {u, v: SV, height: PLOT - 2}, {ground: 0.42}) : iconField(board, name, {u, v: SV, height: PLOT - 2}, {ground: 0.42});
    const field = plotField(board, {u, v: SV, size: PLOT}, icon, {lit: lit.has(k), dim: !!opts.dimOthers && !lit.has(k)});
    const box: Box = [u - pinsU(board, PLOT / 2 + 1), SV - pinsV(board, PLOT / 2 + 1), u + pinsU(board, PLOT / 2 + 1), SV + pinsV(board, PLOT / 2 + 1)];
    return {box, field};
  });
  // the road: a low kerb under the plots
  const road = rectField(board, {u: 0.5, v: SV - pinsV(board, PLOT / 2 + 3.5), w: PLOT_PITCH * 8 - 2, h: 1}, {h: 0.05, tint: 0.62, soft: 0.4});
  return regions(road, layers);
};

// ---------------------------------------------------------------- 10.0 the gate (Act III: unfold)

/** Where the gate's cube stands (right of the chapter card). */
export const GATE: [number, number] = [0.665, 0.52];

/** A raised, phone-shaped dark block with the PocketOS emblem on its face. */
export const cubeField = (board: Board): FieldFn => {
  const [gu, gv] = GATE;
  const block = blackBoxField(board, {u: gu, v: gv, size: 36, h: 0.46, tint: 0.3});
  const face = emblemField(board, 'pocketos', {u: gu, v: gv, height: 34}, {ground: 0.3});
  const sd = rectSd(board, {u: gu, v: gv, w: 36, h: 36});
  return (u, v, i) => {
    if (sd(u, v) > 0.6) return {h: 0, tint: STEEL};
    const f = face(u, v, i);
    const b = block(u, v, i);
    return f.h > 0.04 ? {h: b.h + f.h * 0.22, tint: f.tint, glow: f.h > 0.9 ? 0.22 : 0} : b;
  };
};

/** The cube's five visible faces laid flat into the wall, like a box net. */
export const netField = (board: Board): FieldFn => {
  const s = 18;
  const faces: Array<[number, number]> = [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]];
  const [gu, gv] = GATE;
  const sds = faces.map(([dx, dy]) => rectSd(board, {u: gu + dx * s * board.p, v: gv + (dy * s * board.p) / board.extH, w: s - 1.2, h: s - 1.2, radius: 1.4}));
  const centre = emblemField(board, 'pocketos', {u: gu, v: gv, height: s - 3}, {ground: 0.34});
  return (u, v, i) => {
    for (let k = 0; k < sds.length; k++) {
      const d = sds[k](u, v);
      if (d < 0.5) {
        if (d > -1.1) return {h: 0.12, tint: 0.85};
        if (k === 0) {
          const c = centre(u, v, i);
          return c.h > 0.04 ? {h: 0.04 + c.h * 0.3, tint: c.tint} : {h: 0.03, tint: 0.34};
        }
        return {h: 0.03, tint: 0.4};
      }
    }
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.2 PocketOS

export const pocketField = (board: Board): FieldFn => emblemField(board, 'pocketos', {u: SUBJ[0] + 0.01, v: SUBJ[1], height: 70}, {ground: 0.66});

/** The breakpoint: one mint rule of lit pins at the frame's centre column. */
export const breakpointField = (board: Board, ruleU: number, lit: boolean): FieldFn => {
  const rule = segmentField(board, [ruleU, 0.3], [ruleU, 0.76], 1.6, lit ? {h: 0.16, tint: MINT, glow: 1} : {h: 0.02, tint: 0.8});
  const left = rectField(board, {u: ruleU - pinsU(board, 30), v: 0.53, w: 58, h: 64, radius: 3}, {h: 0, tint: 0.7, soft: 2.5});
  return (u, v, i) => {
    const r = rule(u, v, i);
    if (r.h > 0.01 || (r.glow ?? 0) > 0.01) return r;
    return lit ? left(u, v, i) : {h: 0, tint: STEEL};
  };
};

/** src/ of PocketOS as pin tiles: ten folders, and kernel/ holding a single file. */
export const POCKET_SRC = ['apps', 'components', 'fs', 'hooks', 'kernel', 'lib', 'shell', 'store', 'styles', 'windowing'] as const;
export const treeTile = (board: Board, k: number): {u: number; v: number} => {
  const colK = k < 5 ? 0 : 1;
  const row = k % 5;
  return {u: 0.56 + colK * pinsU(board, 19), v: 0.78 - pinsV(board, 1.5) - row * pinsV(board, 8)};
};
export const TREE_TILE = {w: 15, h: 5.5};
export const TREE_FILE = (board: Board) => ({u: treeTile(board, 4).u + pinsU(board, 6), v: treeTile(board, 4).v - pinsV(board, 7.5)});

export const treeField = (board: Board, highlight: boolean): FieldFn => {
  const tiles = POCKET_SRC.map((name, k) => {
    const p = treeTile(board, k);
    const isKernel = name === 'kernel';
    const look: Look = isKernel && highlight ? {h: 0.22, tint: MINT_DIM, glow: 0.3} : {h: 0.14, tint: 0.82};
    return rectField(board, {u: p.u, v: p.v, w: TREE_TILE.w, h: TREE_TILE.h, radius: 1.5}, {...look, soft: 0.5});
  });
  const fileP = TREE_FILE(board);
  const file = rectField(board, {u: fileP.u, v: fileP.v, w: 12, h: TREE_TILE.h, radius: 1}, highlight ? {h: 0.3, tint: 1, glow: 0.15, soft: 0.5} : {h: 0.12, tint: 0.8, soft: 0.5});
  const k4 = treeTile(board, 4);
  const lit: Look = highlight ? {h: 0.06, tint: MINT, glow: 0.7} : {h: 0.04, tint: 0.85};
  // kernel/ └ types.ts: down from the folder, then across to the file
  const down = segmentField(board, [k4.u - pinsU(board, 4.5), k4.v - pinsV(board, 3.2)], [k4.u - pinsU(board, 4.5), fileP.v], 0.9, lit);
  const across = segmentField(board, [k4.u - pinsU(board, 4.5), fileP.v], [fileP.u - pinsU(board, 6.5), fileP.v], 0.9, lit);
  return (u, v, i) => {
    for (const t of tiles) {
      const s = t(u, v, i);
      if (s.h > 0.005) return s;
    }
    const f = file(u, v, i);
    if (f.h > 0.005) return f;
    const a = down(u, v, i);
    if (a.h > 0.005) return a;
    const b = across(u, v, i);
    if (b.h > 0.005) return b;
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.3 Mneme

export const mnemeField = (board: Board): FieldFn => emblemField(board, 'mneme', {u: SUBJ[0], v: SUBJ[1], height: 66}, {ground: 0.66});

/** The funnel from the stored run: 1 source → 2 chunks → 13 facts → 19 cards → 17. */
export const FUNNEL = [1, 2, 13, 19, 17] as const;
export const FUNNEL_LABELS = ['source', 'chunks', 'facts', 'cards', 'after dedupe'] as const;
export const funnelChart = (board: Board) => ({u: SUBJ[0], v: 0.5 + pinsV(board, 4.7), width: 62, height: 36});
export const funnelField = (board: Board, shown: number): FieldFn => {
  const ch = funnelChart(board);
  const vals = FUNNEL.map((n, k) => (k < shown ? n / 19 : 0));
  const pitch = ch.width / FUNNEL.length;
  return (u, v, i) => {
    const px = (u - ch.u) / board.p + ch.width / 2;
    const py = ((v - ch.v) * board.extH) / board.p + ch.height / 2;
    const k = Math.floor(px / pitch);
    if (k < 0 || k >= FUNNEL.length || py < -0.5) return {h: 0, tint: STEEL};
    const inX = Math.abs(px - (k + 0.5) * pitch) <= pitch * 0.36;
    const top = vals[k] * ch.height;
    if (!inX) return {h: 0, tint: STEEL};
    if (py <= Math.max(0.6, top) && vals[k] > 0) {
      const last = k === FUNNEL.length - 1;
      return {h: 0.2 + 0.45 * (py / ch.height), tint: last ? MINT : 0.95, glow: last ? 0.55 : 0};
    }
    // the empty slot of a stage not yet counted
    return py <= 0.8 ? {h: 0.03, tint: 0.62} : {h: 0, tint: STEEL};
  };
};

/** The 8-stage receipt strip (counts in and out of each stage). */
export const RECEIPT = [
  ['load', 0, 1],
  ['chunk', 0, 2],
  ['extract_facts', 2, 13],
  ['generate_cards', 13, 19],
  ['quality_filter', 19, 19],
  ['deduplicate', 19, 17],
  ['difficulty', 17, 17],
  ['write_anki', 17, 17],
] as const;
export const RECEIPT_V = 0.54;
export const receiptField = (board: Board): FieldFn => {
  const n = RECEIPT.length;
  const width = 64;
  const height = 30;
  const cu = SUBJ[0];
  const cv = RECEIPT_V;
  const pitch = width / n;
  return (u, v) => {
    const px = (u - cu) / board.p + width / 2;
    const py = ((v - cv) * board.extH) / board.p + height / 2;
    const k = Math.floor(px / pitch);
    if (k < 0 || k >= n || py < -0.4) return {h: 0, tint: STEEL};
    if (Math.abs(px - (k + 0.5) * pitch) > pitch * 0.34) return {h: 0, tint: STEEL};
    const out = RECEIPT[k][2] / 19;
    return py <= out * height ? {h: 0.16 + 0.3 * (py / height), tint: 0.95} : {h: 0, tint: STEEL};
  };
};

/** A card shape seen from the side (flipping is the sweep that re-targets it). */
export const cardField = (board: Board, face: 'front' | 'back'): FieldFn => {
  const sd = rectSd(board, {u: SUBJ[0], v: SUBJ[1], w: 44, h: 28, radius: 3});
  const lineA = rectSd(board, {u: SUBJ[0] - pinsU(board, 4), v: SUBJ[1] + pinsV(board, 5), w: 28, h: 2});
  const lineB = rectSd(board, {u: SUBJ[0] - pinsU(board, 8), v: SUBJ[1] - pinsV(board, 1), w: 20, h: 2});
  return (u, v) => {
    const d = sd(u, v);
    if (d > 0.5) return {h: 0, tint: STEEL};
    if (d > -1.1) return {h: 0.3, tint: face === 'back' ? AMBER : 0.95, glow: face === 'back' ? 0.15 : 0};
    if (face === 'front' && (lineA(u, v) < 0 || lineB(u, v) < 0)) return {h: 0.3, tint: 1};
    if (face === 'back' && lineA(u, v) < 0) return {h: 0.28, tint: AMBER};
    return {h: 0.22, tint: face === 'back' ? 0.5 : 0.7};
  };
};

/** The calm miss glyph: a hollow pin ring, nothing inside. */
export const missField = (board: Board, c: [number, number] = SUBJ, r = 14): FieldFn => {
  const ring: PinSample = {h: 0.22, tint: 0.72};
  const hole: PinSample = {h: 0, tint: 0.46};
  const base: PinSample = {h: 0, tint: STEEL};
  return (u, v) => {
    const d = Math.hypot((u - c[0]) / board.p, ((v - c[1]) * board.extH) / board.p);
    if (d < r - 3) return hole;
    if (d <= r) return ring;
    return base;
  };
};

// ---------------------------------------------------------------- 10.4 IDM

export const idmField = (board: Board): FieldFn => emblemField(board, 'idm', {u: SUBJ[0], v: SUBJ[1], height: 62}, {ground: 0.66});

export const SPLIT_U = [0.535, 0.665, 0.795];
export const seedField = (board: Board): FieldFn => {
  const i0 = (() => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < board.N; i++) {
      const d = (board.u[i] - SPLIT_U[0]) ** 2 + ((board.v[i] - SUBJ[1]) * board.extH) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  })();
  return (_u, _v, i) => (i === i0 ? {h: 0.9, tint: MINT, glow: 1} : {h: 0, tint: STEEL});
};

/** One weekly report, three shapes: a star schema, month buckets and a graph. */
export const splitField = (board: Board): FieldFn => {
  const star = emblemField(board, 'idm', {u: SPLIT_U[0], v: SUBJ[1], height: 30}, {ground: 0.9});
  const buckets = tileGridField(board, {u: SPLIT_U[1], v: SUBJ[1], cols: 4, rows: 3, cell: 7, gap: 1.6}, (c, r) => ({h: 0.16 + 0.1 * ((c + r) % 3), tint: 0.95}));
  const nodes: Array<[number, number]> = [[-9, 7], [8, 9], [-2, -1], [10, -6], [-10, -8], [2, -11]];
  const edges: Array<[number, number]> = [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5], [0, 1]];
  const P = (k: number): [number, number] => [SPLIT_U[2] + nodes[k][0] * board.p, SUBJ[1] + (nodes[k][1] * board.p) / board.extH];
  const nodeF = nodes.map((_, k) => circleField(board, {u: P(k)[0], v: P(k)[1], r: 2.4}, {h: 0.4, tint: 1}));
  const edgeF = edges.map(([a, b]) => segmentField(board, P(a), P(b), 0.8, {h: 0.1, tint: 0.85}));
  const box = (cu: number): Box => [cu - pinsU(board, 17), SUBJ[1] - pinsV(board, 17), cu + pinsU(board, 17), SUBJ[1] + pinsV(board, 17)];
  const graph: FieldFn = (u, v, i) => {
    for (const n of nodeF) {
      const s = n(u, v, i);
      if (s.h > 0.01) return s;
    }
    for (const e of edgeF) {
      const s = e(u, v, i);
      if (s.h > 0.01) return s;
    }
    return {h: 0, tint: STEEL};
  };
  return regions(flatField(), [
    {box: box(SPLIT_U[0]), field: star},
    {box: box(SPLIT_U[1]), field: buckets},
    {box: box(SPLIT_U[2]), field: graph},
  ]);
};

/** The race lanes (rows of pins that fill left to right). */
export const LANE_U0 = 0.535;
export const LANE_U1 = 0.83;
export const laneV = (k: number) => 0.66 - k * 0.1;
export const lanesField = (board: Board, filled: readonly boolean[], q11 = false): FieldFn => {
  const rows = filled.length;
  const looks: PinSample[] = [
    {h: 0.24, tint: MINT, glow: 0.7},
    {h: 0.2, tint: 0.95},
    {h: 0.2, tint: 0.95},
  ];
  const tracks = Array.from({length: rows}, (_, k) => rectSd(board, {u: (LANE_U0 + LANE_U1) / 2, v: laneV(k), w: (LANE_U1 - LANE_U0) / board.p, h: 3.2, radius: 1.2}));
  const q11Track = rectSd(board, {u: (LANE_U0 + 1.1) / 2, v: laneV(3), w: (1.1 - LANE_U0) / board.p, h: 3.2, radius: 1.2});
  return (u, v) => {
    for (let k = 0; k < rows; k++) {
      if (tracks[k](u, v) < 0.3) return filled[k] ? looks[k] : {h: 0.03, tint: 0.62};
    }
    if (q11 && q11Track(u, v) < 0.3) return {h: 0.24, tint: AMBER, glow: 0.25};
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.5 drone-id

export const droneField = (board: Board): FieldFn => iconField(board, 'c10-drone', {u: SUBJ[0], v: SUBJ[1], height: 56}, {ground: 0.66});
export const TILES = {u: 0.752, v: 0.68, cols: 8, rows: 7, cell: 3.8};
export const SCORES = [
  ['frequency', 0.3],
  ['weight', 0.2],
  ['size', 0.2],
  ['Remote ID', 0.15],
  ['visual', 0.15],
] as const;
/** Horizontal score bars: left edge, row centres and the length of a weight of 0.35. */
export const scoreChart = {u0: 0.6, v0: 0.515, pitchV: 3.1, len035: 38};
export const scoreRowV = (board: Board, k: number) => scoreChart.v0 - k * pinsV(board, scoreChart.pitchV);
export const droneTilesField = (board: Board, scores: 'none' | 'all' | 'renorm'): FieldFn => {
  const tiles = tileGridField(board, {u: TILES.u, v: TILES.v, cols: TILES.cols, rows: TILES.rows, cell: TILES.cell, gap: 1.1}, () => ({h: 0.2, tint: 0.92}));
  const present = scores === 'renorm' ? [1, 1, 1, 1, 0] : [1, 1, 1, 1, 1];
  const wsum = SCORES.reduce((a, sc, k) => a + sc[1] * present[k], 0);
  const lens = SCORES.map((sc, k) => (scores === 'none' ? 0 : ((present[k] * sc[1]) / wsum / 0.353) * scoreChart.len035));
  const rows = SCORES.map((_, k) => scoreRowV(board, k));
  const barsF: FieldFn = (u, v) => {
    for (let k = 0; k < rows.length; k++) {
      const dy = Math.abs((v - rows[k]) * board.extH) / board.p;
      if (dy > 1.15) continue;
      const px = (u - scoreChart.u0) / board.p;
      if (px < 0) return {h: 0, tint: STEEL};
      if (scores !== 'none' && present[k] === 0) return px < 1.2 ? {h: 0.08, tint: 0.55} : {h: 0, tint: STEEL};
      return px <= lens[k] ? {h: 0.22, tint: k === 0 ? MINT_DIM : 0.96, glow: k === 0 ? 0.2 : 0} : px <= scoreChart.len035 ? {h: 0.02, tint: 0.62} : {h: 0, tint: STEEL};
    }
    return {h: 0, tint: STEEL};
  };
  const halfT = (TILES.cols * TILES.cell) / 2 + 1;
  const halfTv = (TILES.rows * TILES.cell) / 2 + 1;
  return regions(flatField(), [
    {box: [TILES.u - pinsU(board, halfT), TILES.v - pinsV(board, halfTv), TILES.u + pinsU(board, halfT), TILES.v + pinsV(board, halfTv)], field: tiles},
    {box: [scoreChart.u0 - pinsU(board, 1), scoreRowV(board, 4) - pinsV(board, 2), scoreChart.u0 + pinsU(board, scoreChart.len035 + 2), scoreChart.v0 + pinsV(board, 2)], field: barsF},
  ]);
};

// ---------------------------------------------------------------- 10.6 SkillBridgeNorway

export const cvField = (board: Board): FieldFn => iconField(board, 'c10-cv', {u: SUBJ[0], v: SUBJ[1], height: 60}, {ground: 0.66});
export const FORMULA = [
  ['meaning', 0.55],
  ['skills', 0.2],
  ['place', 0.15],
  ['freshness', 0.1],
] as const;
export const formulaChart = {u: 0.665, v: 0.5, width: 48, height: 46};
export const formulaField = (board: Board, shown: number): FieldFn => {
  const pitch = formulaChart.width / FORMULA.length;
  return (u, v) => {
    const px = (u - formulaChart.u) / board.p + formulaChart.width / 2;
    const py = ((v - formulaChart.v) * board.extH) / board.p + formulaChart.height / 2;
    const k = Math.floor(px / pitch);
    if (k < 0 || k >= FORMULA.length || py < -0.4) return {h: 0, tint: STEEL};
    if (Math.abs(px - (k + 0.5) * pitch) > pitch * 0.34) return {h: 0, tint: STEEL};
    if (k >= shown) return py <= 0.7 ? {h: 0.02, tint: 0.62} : {h: 0, tint: STEEL};
    const top = (FORMULA[k][1] / 0.55) * formulaChart.height;
    return py <= top ? {h: 0.18 + 0.42 * (py / formulaChart.height), tint: k === 0 ? MINT_DIM : 0.96, glow: k === 0 ? 0.25 : 0} : {h: 0, tint: STEEL};
  };
};

/** The simple score as a gauge from 0 to 100 with its floor at 40. */
export const gaugeChart = {u0: 0.53, u1: 0.83, v: 0.54};
export const gaugeField = (board: Board, score: number): FieldFn => {
  const {u0, u1, v: gv} = gaugeChart;
  const at = (x: number) => u0 + (u1 - u0) * (x / 100);
  const track = rectSd(board, {u: (u0 + u1) / 2, v: gv, w: (u1 - u0) / board.p, h: 6, radius: 1.8});
  const floor = segmentField(board, [at(40), gv - pinsV(board, 7)], [at(40), gv + pinsV(board, 7)], 1.2, {h: 0.2, tint: MINT, glow: 0.9});
  return (u, v, i) => {
    const f = floor(u, v, i);
    if (f.h > 0.02) return f;
    if (track(u, v) < 0.3) return u <= at(score) ? {h: 0.22, tint: 0.95} : {h: 0.03, tint: 0.6};
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.7 CYFS

export const waveField = (board: Board): FieldFn => iconField(board, 'c10-wave', {u: SUBJ[0], v: SUBJ[1], height: 58}, {ground: 0.66});
export const MEASURES = [
  ['tempo', 0.62],
  ['key', 0.5],
  ['energy', 0.7],
  ['brightness', 0.58],
  ['mood', 0.44],
] as const;
export const measureChart = {u: 0.7, v: 0.58, width: 64, height: 30};
export const measureField = (board: Board, slots: boolean): FieldFn => {
  const pitch = measureChart.width / MEASURES.length;
  const slotSd = [0, 1, 2].map((k) => rectSd(board, {u: 0.625 + k * pinsU(board, 15), v: 0.8, w: 12, h: 7, radius: 1.6}));
  return (u, v) => {
    if (slots) {
      for (const sd of slotSd) {
        const d = sd(u, v);
        if (d < 0.4) return d > -1 ? {h: 0.14, tint: 0.8} : {h: 0, tint: 0.5};
      }
    }
    const px = (u - measureChart.u) / board.p + measureChart.width / 2;
    const py = ((v - measureChart.v) * board.extH) / board.p + measureChart.height / 2;
    const k = Math.floor(px / pitch);
    if (k < 0 || k >= MEASURES.length || py < -0.4) return {h: 0, tint: STEEL};
    if (Math.abs(px - (k + 0.5) * pitch) > pitch * 0.33) return {h: 0, tint: STEEL};
    const top = MEASURES[k][1] * measureChart.height;
    return py <= top ? {h: 0.16 + 0.38 * (py / measureChart.height), tint: 0.95} : {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.8 Kaleido

export const gpuField = (board: Board): FieldFn => iconField(board, 'c10-gpu', {u: SUBJ[0], v: SUBJ[1], height: 58}, {ground: 0.66});
export const PLATE = {u: 0.68, v: 0.67, w: 54, h: 16};
export const VBARS = {u0: 0.55, vA: 0.49, vB: 0.42, len249: 52};
/** The card's plate with one model block on it (0 text, 1 image, 2 video; -1 none). */
export const plateField = (board: Board, model: number, bars: 'none' | 'both' | 'rejected'): FieldFn => {
  const plate = rectSd(board, {u: PLATE.u, v: PLATE.v, w: PLATE.w, h: PLATE.h, radius: 2});
  const block = rectSd(board, {u: PLATE.u - pinsU(board, 12) + model * pinsU(board, 12), v: PLATE.v, w: 11, h: 10, radius: 1.5});
  const la = (90 / 249) * VBARS.len249;
  const barA = rectSd(board, {u: VBARS.u0 + pinsU(board, la / 2), v: VBARS.vA, w: la, h: 4, radius: 1.2});
  const barB = rectSd(board, {u: VBARS.u0 + pinsU(board, VBARS.len249 / 2), v: VBARS.vB, w: VBARS.len249, h: 4, radius: 1.2});
  return (u, v) => {
    if (model >= 0 && block(u, v) < 0.4) return {h: 0.62, tint: 1, glow: 0.15};
    const d = plate(u, v);
    if (d < 0.4) return d > -1.1 ? {h: 0.16, tint: 0.85} : {h: 0.1, tint: 0.55};
    if (bars !== 'none') {
      if (barA(u, v) < 0.3) return {h: 0.22, tint: MINT, glow: 0.6};
      const b = barB(u, v);
      if (b < 0.3) {
        if (bars === 'rejected') return b > -0.9 ? {h: 0.16, tint: 0.72} : {h: 0.02, tint: 0.5};
        return {h: 0.2, tint: 0.92};
      }
    }
    return {h: 0, tint: STEEL};
  };
};

// ---------------------------------------------------------------- 10.9 cookie-galaxy

export const cookieField = (board: Board): FieldFn => iconField(board, 'c10-cookie', {u: SUBJ[0], v: SUBJ[1], height: 64}, {ground: 0.5});

/** A sparse starfield in pins (seeded by pin index, deterministic). */
export const starsField = (board: Board): FieldFn => {
  const base: PinSample = {h: 0, tint: 0.42};
  return (_u, _v, i) => {
    const r = ((i * 2654435761) >>> 0) / 4294967296;
    if (r < 0.035) return {h: 0.08 + r * 2.5, tint: WARM, glow: r < 0.012 ? 0.5 : 0};
    return base;
  };
};
