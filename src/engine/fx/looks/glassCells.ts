// The glass box's surface is a hex lattice of cells, one literal each. Every cell flips from black
// to clear at its own time: a sweep from an origin on the box plus a seeded jitter. This file is the
// single definition of that lattice and its timing, in GLSL (for the surface and its god-ray
// transmittance) and in JS (for sparks that leave each cell as it flips). The hash is the same pcg.

export type Vec3 = [number, number, number];

export interface ClaritySweep {
  /** Film seconds the first cell (at the origin) flips. */
  at: number;
  /** Object-space origin of the sweep (default: centre of the +Z face). */
  origin?: Vec3;
  /** Object units per second the flip front travels. */
  speed?: number;
  /** Seconds of random delay added per cell. */
  jitter?: number;
  /** Seconds one cell takes to clear. */
  cellDur?: number;
}

export const CELLS_GLSL = /* glsl */ `
uniform vec3 uHalf;
uniform float uCellSize;
uniform vec4 uSweep;
uniform vec4 uSweep2;

void fxFace(vec3 nObj, out int face, out vec3 U, out vec3 V, out vec3 N) {
  vec3 a = abs(nObj);
  if (a.x > 0.5) {
    face = nObj.x > 0.0 ? 0 : 1;
    N = vec3(sign(nObj.x), 0.0, 0.0);
    U = vec3(0.0, 0.0, -sign(nObj.x));
    V = vec3(0.0, 1.0, 0.0);
  } else if (a.y > 0.5) {
    face = nObj.y > 0.0 ? 2 : 3;
    N = vec3(0.0, sign(nObj.y), 0.0);
    U = vec3(1.0, 0.0, 0.0);
    V = vec3(0.0, 0.0, -sign(nObj.y));
  } else {
    face = nObj.z > 0.0 ? 4 : 5;
    N = vec3(0.0, 0.0, sign(nObj.z));
    U = vec3(sign(nObj.z), 0.0, 0.0);
    V = vec3(0.0, 1.0, 0.0);
  }
}

// pointy hex lattice with unit spacing: returns local offset (xy) and centre (zw), cell units
vec4 fxHex(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy * s) : vec4(h.zw, (hC.zw + 0.5) * s);
}
// 0.5 on the cell edge, 0 at the centre
float fxHexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}

// clarity of the cell containing object-space point p on the face with normal nObj, at time t;
// also returns the cell's local offset (cell units), its 0..1 flip progress and a per-cell random
float fxCellClarity(vec3 p, vec3 nObj, float t, out vec2 local, out float prog, out float rnd) {
  int face;
  vec3 U, V, N;
  fxFace(nObj, face, U, V, N);
  vec2 uv = vec2(dot(p, U), dot(p, V)) / uCellSize;
  vec4 hx = fxHex(uv);
  local = hx.xy;
  vec2 c = hx.zw;
  vec3 centre = N * dot(uHalf, abs(N)) + (U * c.x + V * c.y) * uCellSize;
  int ix = int(floor(c.x * 2.0 + 0.5));
  int iy = int(floor(c.y / 0.8660254 + 0.5));
  float jit = fxHash1(uint(ix + 4096) * 8u + uint(face), uint(iy + 4096));
  rnd = fxHash1(uint(iy + 4096) * 8u + uint(face), uint(ix + 4096) + 77u);
  float tFlip = uSweep.w + distance(centre, uSweep.xyz) / max(1e-4, uSweep2.x) + uSweep2.y * jit;
  prog = clamp((t - tFlip) / max(1e-4, uSweep2.z), 0.0, 1.0);
  float k = prog * prog * (3.0 - 2.0 * prog);
  return uSweep2.w >= 0.0 ? uSweep2.w : k;
}
`;

const pcg = (v: number): number => {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
};
const hash1 = (a: number, b: number) => pcg((a ^ pcg((b + 0x9e3779b9) >>> 0)) >>> 0) / 4294967296;

const FACES: Array<{N: Vec3; U: Vec3; V: Vec3}> = [
  {N: [1, 0, 0], U: [0, 0, -1], V: [0, 1, 0]},
  {N: [-1, 0, 0], U: [0, 0, 1], V: [0, 1, 0]},
  {N: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1]},
  {N: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1]},
  {N: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0]},
  {N: [0, 0, -1], U: [-1, 0, 0], V: [0, 1, 0]},
];

export interface GlassCell {
  /** Object-space centre of the cell on the box surface. */
  position: Vec3;
  normal: Vec3;
  face: number;
  /** Film seconds the cell starts to clear. */
  flipAt: number;
}

/** Cell size in object units for `cells` cells across the largest face. */
export const cellSizeFor = (half: Vec3, cells: number) => (2 * Math.max(half[0], half[1], half[2])) / Math.max(1, cells);

/** Every cell whose centre lies on the box, with its flip time (the GLSL timing, in JS). */
export const glassCells = (half: Vec3, cells: number, sweep: ClaritySweep): GlassCell[] => {
  const size = cellSizeFor(half, cells);
  const origin = sweep.origin ?? [0, 0, half[2]];
  const speed = sweep.speed ?? 0.5;
  const jitter = sweep.jitter ?? 0.35;
  const out: GlassCell[] = [];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const absv = (a: Vec3): Vec3 => [Math.abs(a[0]), Math.abs(a[1]), Math.abs(a[2])];
  FACES.forEach((f, face) => {
    const hu = dot(half, absv(f.U)) / size;
    const hv = dot(half, absv(f.V)) / size;
    const nd = dot(half, absv(f.N));
    // two interleaved lattices: (i + 0.5, (j + 0.5) * sqrt3) and (i + 1, (j + 1) * sqrt3)
    for (const off of [0.5, 1]) {
      for (let j = Math.floor(-hv / 1.7320508) - 2; j <= Math.ceil(hv / 1.7320508) + 2; j++) {
        for (let i = Math.floor(-hu) - 2; i <= Math.ceil(hu) + 2; i++) {
          const cx = i + off;
          const cy = (j + off) * 1.7320508;
          if (Math.abs(cx) > hu || Math.abs(cy) > hv) continue;
          const p: Vec3 = [
            f.N[0] * nd + (f.U[0] * cx + f.V[0] * cy) * size,
            f.N[1] * nd + (f.U[1] * cx + f.V[1] * cy) * size,
            f.N[2] * nd + (f.U[2] * cx + f.V[2] * cy) * size,
          ];
          const ix = Math.floor(cx * 2 + 0.5);
          const iy = Math.floor(cy / 0.8660254 + 0.5);
          const jit = hash1(((ix + 4096) * 8 + face) >>> 0, (iy + 4096) >>> 0);
          const d = Math.hypot(p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]);
          out.push({position: p, normal: f.N, face, flipAt: sweep.at + d / speed + jitter * jit});
        }
      }
    }
  });
  return out;
};
