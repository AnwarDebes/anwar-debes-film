import type {Board, FieldFn, PinSample} from '../../../engine/pins';
import {pinAt} from '../../../engine/pins';
import {WALK} from './walk';

// The map of the walk: the 66 places on the wall, grouped into the fourteen neighbourhoods (the
// chapters) and laid out along a serpentine in the order of the walk. Planted faintly in 01.2
// ("one of these repositories"), it returns in 14.3, where the camera pulls back and the map is
// drawn whole, with its solid, dotted and dashed lines.

export interface MapPlace {
  repo: string;
  n: number;
  chapter: string;
  u: number;
  v: number;
  /** the pin under the place */
  pin: number;
}

const ROWS: string[][] = [
  ['01', '02', '03', '04', '05'],
  ['10', '09', '08', '07', '06'],
  ['11', '12', '13', '14'],
];

/** Cluster offsets in pins: a hex spiral, densest first. */
const spiral = (n: number, step: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [[0, 0]];
  let ring = 1;
  while (out.length < n) {
    for (let k = 0; k < 6 * ring && out.length < n; k++) {
      const side = Math.floor(k / ring);
      const off = k % ring;
      const a0 = (Math.PI / 3) * side;
      const a1 = (Math.PI / 3) * (side + 1);
      const x0 = ring * Math.cos(a0);
      const y0 = ring * Math.sin(a0);
      const x1 = ring * Math.cos(a1);
      const y1 = ring * Math.sin(a1);
      const f = off / ring;
      out.push([(x0 + (x1 - x0) * f) * step, (y0 + (y1 - y0) * f) * step]);
    }
    ring++;
  }
  return out;
};

const cache = new Map<string, MapPlace[]>();

export const mapPlaces = (board: Board): MapPlace[] => {
  const hit = cache.get(board.key);
  if (hit) return hit;
  const byChapter = new Map<string, typeof WALK[number][]>();
  for (const r of WALK) {
    const l = byChapter.get(r.chapter) ?? [];
    l.push(r);
    byChapter.set(r.chapter, l);
  }
  const out: MapPlace[] = [];
  const u0 = 0.14;
  const u1 = 0.86;
  const vRows = [0.69, 0.535, 0.38];
  ROWS.forEach((row, ri) => {
    row.forEach((ch, ci) => {
      const cu = row.length === 1 ? 0.5 : u0 + ((u1 - u0) * ci) / (ROWS[0].length - 1) + (ri === 2 ? (u1 - u0) / (ROWS[0].length - 1) / 2 : 0);
      const cv = vRows[ri];
      const repos = byChapter.get(ch) ?? [];
      const offs = spiral(repos.length, 4.2);
      repos.forEach((r, k) => {
        const [dx, dy] = offs[k];
        const u = cu + dx * board.p;
        const v = cv + (dy * board.p) / board.extH;
        out.push({repo: r.repo, n: r.n, chapter: ch, u, v, pin: pinAt(board, u, v)});
      });
    });
  });
  out.sort((a, b) => a.n - b.n);
  cache.set(board.key, out);
  return out;
};

/**
 * The map as a field: each place a lit pin (and, with `patch`, its six neighbours raised as a
 * small plate). `look(place)` returns the place's look, null to leave it out.
 */
export const mapField = (
  board: Board,
  look: (p: MapPlace) => {h: number; tint: number; glow: number; patch?: number} | null,
  ground: FieldFn,
): FieldFn => {
  const places = mapPlaces(board);
  const byPin = new Map<number, {p: MapPlace; centre: boolean}>();
  for (const p of places) {
    byPin.set(p.pin, {p, centre: true});
  }
  const patchOf = new Map<number, MapPlace>();
  for (const p of places) {
    const lk = look(p);
    if (!lk?.patch) continue;
    for (let k = 0; k < board.nbCount[p.pin]; k++) {
      const j = board.nb[p.pin * 6 + k];
      if (j >= 0 && !byPin.has(j)) patchOf.set(j, p);
    }
  }
  return (u, v, i): PinSample => {
    const c = byPin.get(i);
    if (c) {
      const lk = look(c.p);
      if (lk) return {h: lk.h, tint: lk.tint, glow: lk.glow};
    }
    const pp = patchOf.get(i);
    if (pp) {
      const lk = look(pp);
      if (lk?.patch) return {h: lk.patch, tint: Math.min(1, lk.tint * 0.92), glow: 0};
    }
    return ground(u, v, i);
  };
};
