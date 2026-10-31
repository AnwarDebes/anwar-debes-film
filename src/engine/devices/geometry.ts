// Procedural geometry for the device mockups. Everything is built once (useMemo) as indexed
// BufferGeometry with analytic normals, so edges shade smoothly without normal smoothing hacks.
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Profile of the edge between a cap and the side wall of a slab. */
export type EdgeProfile = {kind: 'round'; r: number} | {kind: 'chamfer'; size: number} | {kind: 'sharp'};

export interface SlabSpec {
  /** extent along x */
  width: number;
  /** extent along z (plan depth) */
  depth: number;
  /** thickness along y; the slab spans y = 0 .. height */
  height: number;
  /** plan corner radius */
  radius: number;
  top?: EdgeProfile;
  bottom?: EdgeProfile;
  cornerSegments?: number;
  profileSegments?: number;
}

/** Material groups of a slab, in order. */
export const SLAB_GROUP = {topCap: 0, topEdge: 1, side: 2, bottomEdge: 3, bottomCap: 4} as const;

type Ring = {inset: number; y: number; ny: number; nh: number; group: number};

const profileRings = (spec: SlabSpec): Ring[] => {
  const h = spec.height;
  const segs = spec.profileSegments ?? 7;
  const top = spec.top ?? {kind: 'sharp'};
  const bottom = spec.bottom ?? {kind: 'sharp'};
  const rings: Ring[] = [];
  const topSize = top.kind === 'round' ? top.r : top.kind === 'chamfer' ? top.size : 0;
  const botSize = bottom.kind === 'round' ? bottom.r : bottom.kind === 'chamfer' ? bottom.size : 0;
  // top edge, from the cap edge down to the wall
  if (top.kind === 'round') {
    for (let s = 0; s <= segs; s++) {
      const phi = (Math.PI / 2) * (1 - s / segs);
      rings.push({inset: top.r * (1 - Math.cos(phi)), y: h - top.r + top.r * Math.sin(phi), ny: Math.sin(phi), nh: Math.cos(phi), group: SLAB_GROUP.topEdge});
    }
  } else if (top.kind === 'chamfer') {
    const c = Math.SQRT1_2;
    rings.push({inset: top.size, y: h, ny: c, nh: c, group: SLAB_GROUP.topEdge});
    rings.push({inset: 0, y: h - top.size, ny: c, nh: c, group: SLAB_GROUP.topEdge});
  }
  // the wall
  rings.push({inset: 0, y: h - topSize, ny: 0, nh: 1, group: SLAB_GROUP.side});
  rings.push({inset: 0, y: botSize, ny: 0, nh: 1, group: SLAB_GROUP.side});
  // bottom edge, from the wall down to the cap edge
  if (bottom.kind === 'round') {
    for (let s = 0; s <= segs; s++) {
      const phi = -(Math.PI / 2) * (s / segs);
      rings.push({inset: bottom.r * (1 - Math.cos(phi)), y: bottom.r + bottom.r * Math.sin(phi), ny: Math.sin(phi), nh: Math.cos(phi), group: SLAB_GROUP.bottomEdge});
    }
  } else if (bottom.kind === 'chamfer') {
    const c = Math.SQRT1_2;
    rings.push({inset: 0, y: bottom.size, ny: -c, nh: c, group: SLAB_GROUP.bottomEdge});
    rings.push({inset: bottom.size, y: 0, ny: -c, nh: c, group: SLAB_GROUP.bottomEdge});
  }
  return rings;
};

/**
 * Outline of a rounded rectangle inset by `inset`, counter-clockwise seen from +y.
 * Offset curves of a rounded rectangle share their corner centres, so every inset has the same
 * number of points and the same outward normals: rings line up one to one.
 */
const outline = (hw: number, hd: number, radius: number, inset: number, k: number) => {
  const r = Math.max(radius - inset, 1e-5);
  const cx = hw - radius;
  const cz = hd - radius;
  const centres: Array<[number, number]> = [
    [cx, -cz],
    [-cx, -cz],
    [-cx, cz],
    [cx, cz],
  ];
  const pts: Array<{x: number; z: number; nx: number; nz: number}> = [];
  centres.forEach(([ox, oz], c) => {
    for (let i = 0; i <= k; i++) {
      const th = (c * Math.PI) / 2 + (i / k) * (Math.PI / 2);
      const nx = Math.cos(th);
      const nz = -Math.sin(th);
      pts.push({x: ox + r * nx, z: oz + r * nz, nx, nz});
    }
  });
  return pts;
};

/** A rounded slab (laptop deck, lid, phone body, monitor panel...) with smooth analytic normals. */
export function roundedSlab(spec: SlabSpec): THREE.BufferGeometry {
  const hw = spec.width / 2;
  const hd = spec.depth / 2;
  const radius = Math.min(spec.radius, hw - 1e-4, hd - 1e-4);
  const k = spec.cornerSegments ?? 12;
  const rings = profileRings(spec);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const index: number[][] = [[], [], [], [], []];
  const n = 4 * (k + 1);
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(x / spec.width + 0.5, 0.5 - z / spec.depth);
    return pos.length / 3 - 1;
  };
  // side rings
  const ringStart: number[] = [];
  for (const ring of rings) {
    ringStart.push(pos.length / 3);
    for (const p of outline(hw, hd, radius, ring.inset, k)) {
      push(p.x, ring.y, p.z, p.nx * ring.nh, ring.ny, p.nz * ring.nh);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    const a0 = ringStart[r];
    const b0 = ringStart[r + 1];
    const same = Math.abs(rings[r].y - rings[r + 1].y) < 1e-9 && Math.abs(rings[r].inset - rings[r + 1].inset) < 1e-9;
    if (same) continue; // a crease: two rings at one place with different normals
    const g = rings[r + 1].group === SLAB_GROUP.side && rings[r].group === SLAB_GROUP.side ? SLAB_GROUP.side : rings[r].group === SLAB_GROUP.side ? rings[r + 1].group : rings[r].group;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const a = a0 + j, b = a0 + j1, c = b0 + j, d = b0 + j1;
      index[g].push(a, c, b, b, c, d);
    }
  }
  // caps (fans; rounded rectangles are convex)
  const topRing = rings[0];
  const botRing = rings[rings.length - 1];
  const cap = (ring: Ring, up: boolean, group: number) => {
    const y = up ? spec.height : 0;
    const centre = push(0, y, 0, 0, up ? 1 : -1, 0);
    const first = pos.length / 3;
    for (const p of outline(hw, hd, radius, ring.inset, k)) push(p.x, y, p.z, 0, up ? 1 : -1, 0);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      if (up) index[group].push(centre, first + j, first + j1);
      else index[group].push(centre, first + j1, first + j);
    }
  };
  cap(topRing, true, SLAB_GROUP.topCap);
  cap(botRing, false, SLAB_GROUP.bottomCap);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const all: number[] = [];
  index.forEach((ix, g) => {
    geo.addGroup(all.length, ix.length, g);
    for (const v of ix) all.push(v);
  });
  geo.setIndex(all);
  return geo;
}

/** A flat rounded rectangle in the xz plane at y = 0, facing +y, with uv 0..1 across it. */
export function roundedPlate(width: number, depth: number, radius: number, k = 12): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const pts = outline(hw, hd, Math.min(radius, hw - 1e-4, hd - 1e-4), 0, k);
  const pos: number[] = [0, 0, 0];
  const uv: number[] = [0.5, 0.5];
  for (const p of pts) {
    pos.push(p.x, 0, p.z);
    uv.push(p.x / width + 0.5, 0.5 - p.z / depth);
  }
  const idx: number[] = [];
  const n = pts.length;
  for (let j = 0; j < n; j++) idx.push(0, 1 + j, 1 + ((j + 1) % n));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** A rounded-rectangle ring (frame) in the xz plane, facing +y: outer size minus inner size. */
export function roundedFrame(width: number, depth: number, radius: number, inset: number, k = 12): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const rad = Math.min(radius, hw - 1e-4, hd - 1e-4);
  const outer = outline(hw, hd, rad, 0, k);
  const inner = outline(hw, hd, rad, inset, k);
  const pos: number[] = [];
  const uv: number[] = [];
  for (const p of [...outer, ...inner]) {
    pos.push(p.x, 0, p.z);
    uv.push(p.x / width + 0.5, 0.5 - p.z / depth);
  }
  const n = outer.length;
  const idx: number[] = [];
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    idx.push(j, n + j, j1, j1, n + j, n + j1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Translate / rotate a geometry in place and return it (for building merged parts). */
export const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
};

/** Merge parts that share one material; groups are dropped. */
export const mergeParts = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  for (const g of parts) g.clearGroups();
  const m = mergeGeometries(parts, false);
  if (!m) throw new Error('mergeParts: incompatible geometries');
  parts.forEach((p) => p.dispose());
  return m;
};

/* ---------------------------------------------------------------------------------------------
 * Keyboard: a generic laptop layout (no legends). Units are key units u; the caller scales.
 * Six rows: a half-height function row, then five full rows; the bottom row ends in an inverted-T
 * arrow cluster. Every row is 14.5 u wide.
 * ------------------------------------------------------------------------------------------- */
export type KeySpec = {x: number; z: number; w: number; d: number};

export function keyboardLayout(): {keys: KeySpec[]; width: number; depth: number} {
  const rows: Array<{h: number; keys: number[]}> = [
    {h: 0.62, keys: [1.5, ...Array(13).fill(1)]},
    {h: 1, keys: [...Array(13).fill(1), 1.5]},
    {h: 1, keys: [1.5, ...Array(13).fill(1)]},
    {h: 1, keys: [1.75, ...Array(11).fill(1), 1.75]},
    {h: 1, keys: [2.25, ...Array(10).fill(1), 2.25]},
  ];
  const keys: KeySpec[] = [];
  const gapRow = 0.0; // pitch includes the gap; caps are shrunk by the caller
  let z = 0;
  for (const row of rows) {
    let x = 0;
    for (const w of row.keys) {
      keys.push({x: x + w / 2, z: z + row.h / 2, w, d: row.h});
      x += w;
    }
    z += row.h + gapRow;
  }
  // bottom row: fn ctrl opt cmd [space] cmd opt, then the arrow cluster (3 u)
  let x = 0;
  for (const w of [1, 1, 1, 1.25, 5, 1.25, 1]) {
    keys.push({x: x + w / 2, z: z + 0.5, w, d: 1});
    x += w;
  }
  // arrows: left and right full-width half-height at the bottom, up/down stacked in the middle
  keys.push({x: x + 0.5, z: z + 0.75, w: 1, d: 0.5});
  keys.push({x: x + 1.5, z: z + 0.25, w: 1, d: 0.5});
  keys.push({x: x + 1.5, z: z + 0.75, w: 1, d: 0.5});
  keys.push({x: x + 2.5, z: z + 0.75, w: 1, d: 0.5});
  z += 1;
  return {keys, width: 14.5, depth: z};
}
