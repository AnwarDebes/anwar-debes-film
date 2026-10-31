import {STEEL, type Board, type FieldFn, type LiveFieldFn, type LiveLayer, type PinSample} from '../../../engine/pins';
import {Pic, picField, segDist, type Look} from './kit/pic';
import molecules from '../../../data/ch09/molecules.json';

// Molecules in pins, from RDKit layouts (src/data/ch09/molecules.json): atoms as raised clusters,
// bonds as ridges, aromatic rings with an inner ring, double bonds as two ridges.

interface Atom {
  i: number;
  el: string;
  arom: boolean;
  x: number;
  y: number;
}
interface Bond {
  a: number;
  b: number;
  order: number;
  ring: boolean;
}
export interface Mol {
  atoms: Atom[];
  bonds: Bond[];
  rings: number[][];
}
export interface MolCase {
  name: string;
  before: string;
  after: string;
  edit: {kind: string; atoms: number[]};
  molBefore: Mol;
  molAfter: Mol;
}

export const CASES = (molecules as unknown as {cases: MolCase[]}).cases;
export const mol31 = CASES.find((c) => c.name === 'mol_31') as MolCase;
export const mol22 = CASES.find((c) => c.name === 'mol_22') as MolCase;

export interface MolStyle {
  /** pins per RDKit unit (bond length 1) */
  scale: number;
  /** atoms lit (glow) by index */
  glow?: (i: number) => number;
  /** bonds left out, as 'a-b' keys */
  without?: ReadonlySet<string>;
  /** height multiplier (assembly) */
  hk?: number;
}

export const bondKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

const ATOM_C: Look = {h: 0.7, tint: 1.04};
const ATOM_N: Look = {h: 0.98, tint: [0.92, 1.0, 1.1]};
const BOND: Look = {h: 0.4, tint: 0.95};
const RING: Look = {h: 0.26, tint: 0.88};

/** Centre of a molecule's layout, RDKit units. */
export const molCentre = (m: Mol): [number, number] => {
  const xs = m.atoms.map((a) => a.x);
  const ys = m.atoms.map((a) => a.y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

/** A molecule as a pin picture, centred on `centre` (RDKit units). */
export const molPic = (m: Mol, st: MolStyle, centre: [number, number]): Pic => {
  const pic = new Pic();
  const S = st.scale;
  const hk = st.hk ?? 1;
  const P = (i: number): [number, number] => [(m.atoms[i].x - centre[0]) * S, (m.atoms[i].y - centre[1]) * S];
  const scaleLook = (l: Look, g = 0): Look => ({...l, h: l.h * hk, glow: g});
  for (const bd of m.bonds) {
    if (st.without?.has(bondKey(bd.a, bd.b))) continue;
    const [ax, ay] = P(bd.a);
    const [bx, by] = P(bd.b);
    if (bd.order === 2) {
      const dx = bx - ax;
      const dy = by - ay;
      const L = Math.hypot(dx, dy) || 1;
      const ox = (-dy / L) * S * 0.12;
      const oy = (dx / L) * S * 0.12;
      pic.seg(ax + ox, ay + oy, bx + ox, by + oy, 0.36, scaleLook(BOND), 0.4, 'max');
      pic.seg(ax - ox, ay - oy, bx - ox, by - oy, 0.36, scaleLook(BOND), 0.4, 'max');
    } else pic.seg(ax, ay, bx, by, 0.5, scaleLook(BOND), 0.45, 'max');
  }
  for (const r of m.rings) {
    if (r.length !== 6 || !r.every((i) => m.atoms[i].arom)) continue;
    let cx = 0;
    let cy = 0;
    for (const i of r) {
      const [x, y] = P(i);
      cx += x / r.length;
      cy += y / r.length;
    }
    pic.ring(cx, cy, 0.5 * S, 0.3, scaleLook(RING), 0.4, 'max');
  }
  for (const a of m.atoms) {
    const [x, y] = P(a.i);
    const g = st.glow ? st.glow(a.i) : 0;
    pic.disc(x, y, a.el === 'N' ? 1.75 : 1.4, scaleLook(a.el === 'N' ? ATOM_N : ATOM_C, g), 0.55, 'max');
  }
  return pic;
};

export const molField = (b: Board, m: Mol, st: MolStyle, ou: number, ov: number, centre: [number, number] = molCentre(m)): FieldFn => picField(b, molPic(m, st, centre), ou, ov);

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The ring opening, live: atoms slide from the before layout to the after layout (same RDKit
 * indices) while bonds follow them. Rings that exist only before fade out early, rings and double
 * bonds that exist only after fade in late. Scratch arrays only; nothing is allocated per frame.
 */
export const molMorphLayer = (b: Board, mc: MolCase, S: number, ou: number, ov: number, centreB: [number, number], centreA: [number, number], at: number, dur: number): LiveLayer => {
  const A0 = mc.molBefore.atoms;
  const A1 = mc.molAfter.atoms;
  const n = A0.length;
  const bonds = mc.molAfter.bonds;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const isN = A0.map((a) => a.el === 'N');
  const aromB = mc.molBefore.rings.filter((r) => r.length === 6 && r.every((i) => mc.molBefore.atoms[i].arom));
  const aromA = mc.molAfter.rings.filter((r) => r.length === 6 && r.every((i) => mc.molAfter.atoms[i].arom));
  const same = (r: number[], s: number[]) => r.length === s.length && r.every((i) => s.includes(i));
  const rings = [
    ...aromB.map((r) => ({r, fade: aromA.some((s) => same(r, s)) ? 0 : -1})),
    ...aromA.filter((r) => !aromB.some((s) => same(r, s))).map((r) => ({r, fade: 1})),
  ];
  let lastT = NaN;
  const pose = (t: number) => {
    if (t === lastT) return;
    lastT = t;
    const k = ease((t - at) / dur);
    for (let i = 0; i < n; i++) {
      px[i] = ((A0[i].x - centreB[0]) * (1 - k) + (A1[i].x - centreA[0]) * k) * S;
      py[i] = ((A0[i].y - centreB[1]) * (1 - k) + (A1[i].y - centreA[1]) * k) * S;
    }
  };
  const out: PinSample = {h: 0, tint: STEEL, glow: 0};
  const kx = 1 / b.p;
  const ky = b.extH / b.p;
  const fn: LiveFieldFn = (u, v, _i, t) => {
    pose(t);
    const k = (t - at) / dur;
    const x = (u - ou) * kx;
    const y = (v - ov) * ky;
    let h = 0;
    let tint = STEEL;
    // bonds
    for (let j = 0; j < bonds.length; j++) {
      const bd = bonds[j];
      const d = segDist(x, y, px[bd.a], py[bd.a], px[bd.b], py[bd.b]) - 0.5;
      if (d > 0.45) continue;
      const c = smooth(0.5 - d / 0.45);
      const hh = 0.4 * c;
      if (hh > h) {
        h = hh;
        tint = STEEL + (0.95 - STEEL) * c;
      }
    }
    // rings
    for (const rg of rings) {
      const w = rg.fade === 0 ? 1 : rg.fade < 0 ? 1 - smooth(k / 0.3) : smooth((k - 0.7) / 0.3);
      if (w <= 0) continue;
      let cx = 0;
      let cy = 0;
      for (const i of rg.r) {
        cx += px[i] / rg.r.length;
        cy += py[i] / rg.r.length;
      }
      const d = Math.abs(Math.hypot(x - cx, y - cy) - 0.5 * S) - 0.3;
      if (d > 0.4) continue;
      const c = smooth(0.5 - d / 0.4) * w;
      const hh = 0.26 * c;
      if (hh > h) {
        h = hh;
        tint = STEEL + (0.88 - STEEL) * c;
      }
    }
    // atoms
    for (let i = 0; i < n; i++) {
      const r = isN[i] ? 1.75 : 1.4;
      const d = Math.hypot(x - px[i], y - py[i]) - r;
      if (d > 0.55) continue;
      const c = smooth(0.5 - d / 0.55);
      const hh = (isN[i] ? 0.98 : 0.7) * c;
      if (hh > h) {
        h = hh;
        tint = STEEL + (1.04 - STEEL) * c;
      }
    }
    out.h = h;
    out.tint = tint;
    return out;
  };
  // region: the union of both layouts
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    for (const [ax, ay] of [
      [(A0[i].x - centreB[0]) * S, (A0[i].y - centreB[1]) * S],
      [(A1[i].x - centreA[0]) * S, (A1[i].y - centreA[1]) * S],
    ]) {
      x0 = Math.min(x0, ax);
      x1 = Math.max(x1, ax);
      y0 = Math.min(y0, ay);
      y1 = Math.max(y1, ay);
    }
  }
  const m = 4;
  const region: [number, number, number, number] = [ou + (x0 - m) * b.p, ov + ((y0 - m) * b.p) / b.extH, ou + (x1 + m) * b.p, ov + ((y1 + m) * b.p) / b.extH];
  return {fn, from: at, to: at + dur, fadeS: 0.22, region, speedHint: () => 1.2};
};

/** Atom indices within `hops` bonds of atom `src`. */
export const hopsFrom = (m: Mol, src: number): number[] => {
  const dist = new Array(m.atoms.length).fill(Infinity);
  dist[src] = 0;
  const q = [src];
  while (q.length) {
    const a = q.shift() as number;
    for (const bd of m.bonds) {
      const o = bd.a === a ? bd.b : bd.b === a ? bd.a : -1;
      if (o >= 0 && dist[o] === Infinity) {
        dist[o] = dist[a] + 1;
        q.push(o);
      }
    }
  }
  return dist;
};
