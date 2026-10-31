import * as THREE from 'three';
import {applyPose, type CameraPose} from '../../camera/pose';

// A flight path for fly-throughs: camera position, look-at target, lens and roll keyed in time and
// joined by cubic Hermite splines whose tangents come from the neighbouring keys (time-based
// Catmull-Rom). Velocity is continuous through every key, the camera starts and ends at rest, and
// the result converts to the engine's CameraPose so HTML layers project with the exact same camera.

export type Vec3 = [number, number, number];

export interface FlightKey {
  /** Film seconds. */
  at: number;
  position: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees (default: the previous key's, first key 24). */
  fov?: number;
  /** Focus: view-depth distance, a world point, or 'target' (default). */
  focus?: number | Vec3 | 'target';
  /** Aperture diameter, world units (default: the previous key's, first key 0). */
  aperture?: number;
  roll?: number;
  /** Stop here: zero velocity at this key (the camera settles and leaves again). */
  hold?: boolean;
}

export interface FlightTrack {
  keys: FlightKey[];
  /** resolved per-key scalars: fov, aperture, roll */
  fov: number[];
  aperture: number[];
  roll: number[];
  /** tangents per key (world units per second) */
  mPos: THREE.Vector3[];
  mTgt: THREE.Vector3[];
}

const V = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);

const cache = new WeakMap<readonly FlightKey[], FlightTrack>();

export const compileFlight = (keysIn: readonly FlightKey[]): FlightTrack => {
  const hit = cache.get(keysIn);
  if (hit) return hit;
  if (!keysIn.length) throw new Error('flight track has no keys');
  const keys = [...keysIn].sort((a, b) => a.at - b.at);
  const fov: number[] = [];
  const aperture: number[] = [];
  const roll: number[] = [];
  keys.forEach((k, i) => {
    fov.push(k.fov ?? (i ? fov[i - 1] : 24));
    aperture.push(k.aperture ?? (i ? aperture[i - 1] : 0));
    roll.push(k.roll ?? (i ? roll[i - 1] : 0));
  });
  const tangents = (get: (k: FlightKey) => Vec3) =>
    keys.map((k, i) => {
      if (i === 0 || i === keys.length - 1 || k.hold) return new THREE.Vector3();
      const a = keys[i - 1];
      const b = keys[i + 1];
      return V(get(b))
        .sub(V(get(a)))
        .multiplyScalar(1 / Math.max(1e-6, b.at - a.at));
    });
  const tr: FlightTrack = {keys, fov, aperture, roll, mPos: tangents((k) => k.position), mTgt: tangents((k) => k.target)};
  cache.set(keysIn, tr);
  return tr;
};

const hermite = (p0: THREE.Vector3, m0: THREE.Vector3, p1: THREE.Vector3, m1: THREE.Vector3, dt: number, u: number, out: THREE.Vector3) => {
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return out
    .copy(p0)
    .multiplyScalar(h00)
    .addScaledVector(m0, h10 * dt)
    .addScaledVector(p1, h01)
    .addScaledVector(m1, h11 * dt);
};

/** Monotone cubic for scalars (no overshoot between keys). */
const smoothScalar = (a: number, b: number, u: number) => a + (b - a) * (u * u * (3 - 2 * u));

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();

export interface FlightState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  aperture: number;
  roll: number;
  focus: number | Vec3 | 'target';
  /** index of the segment's first key (for focus blending) */
  k: number;
  u: number;
}

export const flightStateAt = (tr: FlightTrack, t: number, out?: FlightState): FlightState => {
  const s: FlightState = out ?? {position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 24, aperture: 0, roll: 0, focus: 'target', k: 0, u: 0};
  const {keys} = tr;
  let k = 0;
  for (let j = 0; j < keys.length; j++) if (keys[j].at <= t) k = j;
  if (t <= keys[0].at || keys.length === 1) {
    const a = keys[0];
    s.position.copy(V(a.position));
    s.target.copy(V(a.target));
    s.fov = tr.fov[0];
    s.aperture = tr.aperture[0];
    s.roll = tr.roll[0];
    s.focus = a.focus ?? 'target';
    s.k = 0;
    s.u = 0;
    return s;
  }
  if (k >= keys.length - 1) {
    const z = keys.length - 1;
    const a = keys[z];
    s.position.copy(V(a.position));
    s.target.copy(V(a.target));
    s.fov = tr.fov[z];
    s.aperture = tr.aperture[z];
    s.roll = tr.roll[z];
    s.focus = a.focus ?? 'target';
    s.k = z;
    s.u = 1;
    return s;
  }
  const a = keys[k];
  const b = keys[k + 1];
  const dt = Math.max(1e-6, b.at - a.at);
  const u = Math.min(1, Math.max(0, (t - a.at) / dt));
  hermite(_p0.copy(V(a.position)), tr.mPos[k], _p1.copy(V(b.position)), tr.mPos[k + 1], dt, u, s.position);
  hermite(_p0.copy(V(a.target)), tr.mTgt[k], _p1.copy(V(b.target)), tr.mTgt[k + 1], dt, u, s.target);
  s.fov = smoothScalar(tr.fov[k], tr.fov[k + 1], u);
  s.aperture = smoothScalar(tr.aperture[k], tr.aperture[k + 1], u);
  s.roll = smoothScalar(tr.roll[k], tr.roll[k + 1], u);
  s.focus = b.focus ?? 'target';
  s.k = k;
  s.u = u;
  return s;
};

const _d = new THREE.Vector3();

/** The engine pose (orbit form) for a flight state: target, distance, yaw, pitch, roll, fov. */
export const stateToPose = (s: FlightState): CameraPose => {
  _d.subVectors(s.position, s.target);
  const distance = Math.max(1e-6, _d.length());
  const pitch = Math.asin(Math.max(-1, Math.min(1, _d.y / distance)));
  const yaw = Math.atan2(_d.x, _d.z);
  return {target: [s.target.x, s.target.y, s.target.z], distance, yaw, pitch, roll: s.roll, fov: s.fov};
};

const _st: FlightState = {position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 24, aperture: 0, roll: 0, focus: 'target', k: 0, u: 0};

/** The camera pose of a flight at time t (pure; for HTML layers and projections). */
export const flightPoseAt = (keys: readonly FlightKey[], t: number): CameraPose => stateToPose(flightStateAt(compileFlight(keys), t, _st));

const _fwd = new THREE.Vector3();
const _pt = new THREE.Vector3();

const focusDepth = (focus: number | Vec3 | 'target', s: FlightState): number => {
  if (typeof focus === 'number') return focus;
  _fwd.subVectors(s.target, s.position).normalize();
  if (focus === 'target') return Math.max(1e-4, _pt.subVectors(s.target, s.position).dot(_fwd));
  return Math.max(1e-4, _pt.set(focus[0], focus[1], focus[2]).sub(s.position).dot(_fwd));
};

/**
 * Lens at time t: focus distance blended in diopters between the two keys of the segment (the way
 * a focus ring travels), aperture from the track.
 */
export const flightLensAt = (tr: FlightTrack, t: number, s: FlightState): {focusDistance: number; aperture: number} => {
  const {keys} = tr;
  const k = s.k;
  const a = keys[k];
  const b = keys[Math.min(keys.length - 1, k + 1)];
  const za = focusDepth(a.focus ?? 'target', s);
  const zb = focusDepth(b.focus ?? 'target', s);
  const u = s.u * s.u * (3 - 2 * s.u);
  const inv = 1 / za + (1 / zb - 1 / za) * (k + 1 < keys.length ? u : 0);
  return {focusDistance: 1 / Math.max(1e-6, inv), aperture: s.aperture};
};

/** Put a camera on the flight at time t. */
export const applyFlight = (cam: THREE.PerspectiveCamera, keys: readonly FlightKey[], t: number, aspect: number, clip?: {near: number; far: number}) => {
  const tr = compileFlight(keys);
  const s = flightStateAt(tr, t, _st);
  applyPose(cam, stateToPose(s), aspect, clip ?? {near: 0.02, far: 80});
  return {state: s, lens: flightLensAt(tr, t, s)};
};
