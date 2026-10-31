import * as THREE from 'three';

// The pin (identity.md d.2): a lathe profile with a domed head and a thin shaft, axis along +Z.
// 'wall' keeps the site's exact profile at 8 radial segments (80 triangles). 'closeup' samples
// the same dome on a smooth curve at 16 segments; 'macro' at 32 segments for a single pin filling
// the frame (its silhouette stays within a pixel of a circle at 2160p).

export type PinLod = 'wall' | 'closeup' | 'macro';

const cache = new Map<string, THREE.BufferGeometry>();

const domeCurve = (rh: number, hh: number, steps: number): THREE.Vector2[] => {
  // the site's dome points, from the rim to the apex
  const pts = [
    new THREE.Vector2(rh, 0),
    new THREE.Vector2(rh * 0.94, hh * 0.42),
    new THREE.Vector2(rh * 0.6, hh * 0.86),
    new THREE.Vector2(0, hh),
  ];
  const curve = new THREE.SplineCurve(pts);
  const out: THREE.Vector2[] = [];
  for (let k = 0; k <= steps; k++) out.push(curve.getPoint(k / steps));
  out[out.length - 1].set(0, hh);
  return out;
};

/**
 * @param p pin pitch (world units)
 * @param reach shaft length behind the head (must exceed the tallest height)
 */
export const pinGeometry = (p: number, reach: number, lod: PinLod = 'wall', radialSegments?: number): THREE.BufferGeometry => {
  const radial = radialSegments ?? (lod === 'wall' ? 8 : lod === 'closeup' ? 16 : 32);
  const key = `${p.toFixed(7)}|${reach.toFixed(5)}|${lod}|${radial}|v2`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rh = 0.47 * p;
  const hh = 0.3 * p;
  const rs = 0.15 * p;
  const shaft = [new THREE.Vector2(rs, -reach), new THREE.Vector2(rs, -0.08 * p)];
  const head =
    lod === 'wall'
      ? [
          new THREE.Vector2(rh, 0),
          new THREE.Vector2(rh * 0.94, hh * 0.42),
          new THREE.Vector2(rh * 0.6, hh * 0.86),
          // exactly on the axis: pins.js used 0.0001, which leaves a tiny open polygon at every
          // apex (a dark speck under MSAA, a visible hole in macro shots)
          new THREE.Vector2(0, hh),
        ]
      : domeCurve(rh, hh, lod === 'closeup' ? 8 : 14);
  // bottom to top keeps the normals pointing out
  const g = new THREE.LatheGeometry([...shaft, ...head], radial);
  // The site's dome points sit close to an ellipse (r/rh)^2 + (y/hh)^2 = 1. Head normals come from
  // that ellipsoid instead of the lathe's averaged facets: shading stays smooth at 8 segments, and
  // the apex, where every facet meets, gets exactly the axis normal.
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const irh2 = 1 / (rh * rh);
  const ihh2 = 1 / (hh * hh);
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    if (y < -1e-9) continue;
    const nx = pos.getX(k) * irh2;
    const ny = y * ihh2;
    const nz = pos.getZ(k) * irh2;
    const n = Math.hypot(nx, ny, nz) || 1;
    nor.setXYZ(k, nx / n, ny / n, nz / n);
  }
  headFirst(g, shaft.length + head.length);
  g.rotateX(Math.PI / 2);
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
};

/**
 * Reorders the lathe's triangles so each pin draws its dome first and its shaft last. A raised
 * pin's shaft lies behind its own head and its neighbours' heads; drawn last, most of its
 * fragments fail the early depth test instead of being shaded and then covered. The degenerate
 * triangles the lathe leaves at the apex (one per segment) are dropped. The image is unchanged.
 */
const headFirst = (g: THREE.BufferGeometry, profileLen: number) => {
  const index = g.getIndex();
  if (!index) return;
  const pos = g.getAttribute('position');
  const same = (a: number, b: number) => pos.getX(a) === pos.getX(b) && pos.getY(a) === pos.getY(b) && pos.getZ(a) === pos.getZ(b);
  const src = index.array;
  const bands: number[][] = Array.from({length: profileLen}, () => []);
  for (let t = 0; t < src.length; t += 3) {
    const a = src[t];
    const b = src[t + 1];
    const c = src[t + 2];
    if (same(a, b) || same(b, c) || same(a, c)) continue;
    // vertex k of ring i sits at i * profileLen + k; a triangle belongs to its lowest profile point
    bands[Math.min(a % profileLen, b % profileLen, c % profileLen)].push(a, b, c);
  }
  const out: number[] = [];
  for (let j = profileLen - 1; j >= 0; j--) for (const v of bands[j]) out.push(v);
  g.setIndex(out);
};
