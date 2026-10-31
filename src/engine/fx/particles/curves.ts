import * as THREE from 'three';

// Curves for data streams and links: sampled once, resampled by arc length so particles travel at
// a constant world speed, with a parallel-transport frame for the stream's cross-section. All of it
// is uploaded as one float texture, so every stream and every link draws in a single call.

export type Vec3 = [number, number, number];

export type CurveSpec =
  /** Centripetal Catmull-Rom through the points (no overshoot, no cusps). */
  | {kind: 'catmull'; points: readonly Vec3[]; alpha?: number}
  | {kind: 'bezier'; p0: Vec3; p1: Vec3; p2: Vec3; p3: Vec3}
  /** A cubic arc from `from` to `to` that bulges along `bend` (world offset at the middle). */
  | {kind: 'arc'; from: Vec3; to: Vec3; bend: Vec3}
  | {kind: 'line'; from: Vec3; to: Vec3};

const v = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Evaluate a curve at parameter u in [0, 1] (not arc length). */
export const curvePoint = (c: CurveSpec, u: number, out = new THREE.Vector3()): THREE.Vector3 => {
  switch (c.kind) {
    case 'line':
      return out.copy(v(c.from)).lerp(v(c.to), u);
    case 'bezier':
    case 'arc': {
      let p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3;
      if (c.kind === 'bezier') {
        ({p0, p1, p2, p3} = c);
      } else {
        p0 = c.from;
        p3 = c.to;
        // control points at 1/3 and 2/3, lifted so the midpoint moves by exactly `bend`
        const k = 4 / 3;
        p1 = [p0[0] + (p3[0] - p0[0]) / 3 + c.bend[0] * k, p0[1] + (p3[1] - p0[1]) / 3 + c.bend[1] * k, p0[2] + (p3[2] - p0[2]) / 3 + c.bend[2] * k];
        p2 = [p0[0] + ((p3[0] - p0[0]) * 2) / 3 + c.bend[0] * k, p0[1] + ((p3[1] - p0[1]) * 2) / 3 + c.bend[1] * k, p0[2] + ((p3[2] - p0[2]) * 2) / 3 + c.bend[2] * k];
      }
      const s = 1 - u;
      const a = s * s * s;
      const b = 3 * s * s * u;
      const d = 3 * s * u * u;
      const e = u * u * u;
      return out.set(
        a * p0[0] + b * p1[0] + d * p2[0] + e * p3[0],
        a * p0[1] + b * p1[1] + d * p2[1] + e * p3[1],
        a * p0[2] + b * p1[2] + d * p2[2] + e * p3[2],
      );
    }
    case 'catmull': {
      const pts = c.points;
      const n = pts.length;
      if (n === 1) return out.copy(v(pts[0]));
      const segs = n - 1;
      const x = Math.min(segs - 1e-9, Math.max(0, u * segs));
      const i = Math.floor(x);
      const f = x - i;
      const P1 = v(pts[i]);
      const P2 = v(pts[i + 1]);
      const P0 = i > 0 ? v(pts[i - 1]) : P1.clone().multiplyScalar(2).sub(P2);
      const P3 = i + 2 < n ? v(pts[i + 2]) : P2.clone().multiplyScalar(2).sub(P1);
      return centripetal(P0, P1, P2, P3, f, c.alpha ?? 0.5, out);
    }
  }
};

const centripetal = (P0: THREE.Vector3, P1: THREE.Vector3, P2: THREE.Vector3, P3: THREE.Vector3, f: number, alpha: number, out: THREE.Vector3) => {
  const knot = (a: THREE.Vector3, b: THREE.Vector3) => Math.max(1e-6, Math.pow(a.distanceToSquared(b), alpha / 2));
  const t0 = 0;
  const t1 = t0 + knot(P0, P1);
  const t2 = t1 + knot(P1, P2);
  const t3 = t2 + knot(P2, P3);
  const t = t1 + (t2 - t1) * f;
  const lerp = (A: THREE.Vector3, B: THREE.Vector3, ta: number, tb: number) => A.clone().multiplyScalar((tb - t) / (tb - ta)).add(B.clone().multiplyScalar((t - ta) / (tb - ta)));
  const A1 = lerp(P0, P1, t0, t1);
  const A2 = lerp(P1, P2, t1, t2);
  const A3 = lerp(P2, P3, t2, t3);
  const B1 = A1.multiplyScalar((t2 - t) / (t2 - t0)).add(A2.clone().multiplyScalar((t - t0) / (t2 - t0)));
  const B2 = A2.multiplyScalar((t3 - t) / (t3 - t1)).add(A3.multiplyScalar((t - t1) / (t3 - t1)));
  return out.copy(B1.multiplyScalar((t2 - t) / (t2 - t1)).add(B2.multiplyScalar((t - t1) / (t2 - t1))));
};

export interface SampledCurve {
  /** samples x 3 positions, uniform in arc length */
  pos: Float32Array;
  /** samples x 3 unit normals (parallel transport) */
  nrm: Float32Array;
  /** arc length at each sample */
  arc: Float32Array;
  length: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Sample densely, then resample uniformly in arc length, with a rotation-minimising frame. */
export const sampleCurve = (c: CurveSpec, samples: number, dense = 512): SampledCurve => {
  const P: THREE.Vector3[] = [];
  const L = new Float64Array(dense + 1);
  for (let i = 0; i <= dense; i++) {
    P.push(curvePoint(c, i / dense, new THREE.Vector3()));
    if (i > 0) L[i] = L[i - 1] + P[i].distanceTo(P[i - 1]);
  }
  const length = L[dense];
  const pos = new Float32Array(samples * 3);
  const arc = new Float32Array(samples);
  let j = 0;
  for (let k = 0; k < samples; k++) {
    const target = (length * k) / (samples - 1);
    while (j < dense - 1 && L[j + 1] < target) j++;
    const seg = L[j + 1] - L[j];
    const f = seg > 1e-12 ? (target - L[j]) / seg : 0;
    _a.copy(P[j]).lerp(P[j + 1], Math.min(1, Math.max(0, f)));
    pos[k * 3] = _a.x;
    pos[k * 3 + 1] = _a.y;
    pos[k * 3 + 2] = _a.z;
    arc[k] = target;
  }
  // parallel transport frame
  const nrm = new Float32Array(samples * 3);
  const T = new THREE.Vector3();
  const Tprev = new THREE.Vector3();
  const N = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let k = 0; k < samples; k++) {
    const k0 = Math.max(0, k - 1);
    const k1 = Math.min(samples - 1, k + 1);
    _a.fromArray(pos, k0 * 3);
    _b.fromArray(pos, k1 * 3);
    T.subVectors(_b, _a);
    if (T.lengthSq() < 1e-14) T.set(1, 0, 0);
    T.normalize();
    if (k === 0) {
      const ref = Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      N.crossVectors(T, ref).normalize();
    } else {
      q.setFromUnitVectors(Tprev, T);
      N.applyQuaternion(q);
      // re-orthogonalise
      N.addScaledVector(T, -N.dot(T)).normalize();
    }
    Tprev.copy(T);
    nrm[k * 3] = N.x;
    nrm[k * 3 + 1] = N.y;
    nrm[k * 3 + 2] = N.z;
  }
  return {pos, nrm, arc, length};
};

export interface CurveAtlas {
  /** samples x (2 * curves): row 2c = (position, arc length), row 2c + 1 = (normal, 0). */
  texture: THREE.DataTexture;
  samples: number;
  curves: SampledCurve[];
}

export const buildAtlas = (specs: readonly CurveSpec[], samples = 128): CurveAtlas => {
  const curves = specs.map((s) => sampleCurve(s, samples));
  const rows = Math.max(2, 2 * curves.length);
  const data = new Float32Array(samples * rows * 4);
  curves.forEach((c, ci) => {
    for (let k = 0; k < samples; k++) {
      const o = ((2 * ci) * samples + k) * 4;
      data[o] = c.pos[k * 3];
      data[o + 1] = c.pos[k * 3 + 1];
      data[o + 2] = c.pos[k * 3 + 2];
      data[o + 3] = c.arc[k];
      const on = ((2 * ci + 1) * samples + k) * 4;
      data[on] = c.nrm[k * 3];
      data[on + 1] = c.nrm[k * 3 + 1];
      data[on + 2] = c.nrm[k * 3 + 2];
    }
  });
  const texture = new THREE.DataTexture(data, samples, rows, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return {texture, samples, curves};
};

/** Point at a fraction of the arc length of a sampled curve. */
export const pointAtArc = (c: SampledCurve, s: number, out = new THREE.Vector3()): THREE.Vector3 => {
  const n = c.arc.length;
  const x = Math.min(n - 1 - 1e-9, Math.max(0, s * (n - 1)));
  const k = Math.floor(x);
  const f = x - k;
  _a.fromArray(c.pos, k * 3);
  _b.fromArray(c.pos, Math.min(n - 1, k + 1) * 3);
  return out.copy(_a).lerp(_b, f);
};
