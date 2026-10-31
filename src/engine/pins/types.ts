// Contract between the pin wall and everything that draws on it.
// Fields are pure functions: no clocks, no Math.random, no shared mutable state.

export type RGB = [number, number, number];

export interface PinSample {
  /** Height as a fraction of the wall relief: 0 = flush, 1 = fully raised (up to ~1.35 allowed). */
  h: number;
  /** Steel tint multiplier (0..1), or an RGB tint (each ~0..1.2) multiplying white steel. */
  tint: number | RGB;
  /** Emissive mint glow, 0..1 (lit pins: literals, the rule line, verdicts). */
  glow?: number;
  /**
   * 0 (default) = bare steel. 1 = a painted, non-metallic pin head, so an RGB tint reads as its
   * true colour (Pixie's coral) instead of tinted metal (which reads as copper).
   */
  paint?: number;
}

/** u, v in 0..1 across the board (v up); i = pin index. Evaluated once per beat. */
export type FieldFn = (u: number, v: number, i: number) => PinSample;

/** Evaluated every frame at film time t (seconds). Return null where it does not apply. */
export type LiveFieldFn = (u: number, v: number, i: number, t: number) => PinSample | null;

/** A wave that releases pins toward a new field, spreading from an origin in board uv. */
export interface Sweep {
  origin: [number, number];
  /** board widths per second */
  speed: number;
  delayS?: number;
  jitterS?: number;
  /** false (default): the tint switches for all pins at the beat time; true: tint travels with the wave */
  tintFollowsWave?: boolean;
  /**
   * 'radial' (default): a circular front from `origin`.
   * 'linear': a straight front through `origin`, travelling along `direction` (a ruled line, a raster).
   * 'random': no front; every pin releases at a seeded random time within `spreadS` (dissolve).
   */
  kind?: 'radial' | 'linear' | 'random';
  /** Travel direction for 'linear' sweeps, in board uv (normalised internally). Default [1, 0]. */
  direction?: [number, number];
  /** Release window for 'random' sweeps, seconds. Default 0.9. */
  spreadS?: number;
  /**
   * With tintFollowsWave: tint, glow and paint arrive this many seconds ahead of the height (never
   * before the beat time), so a boolean flip reads as "tint first, then height". Default 0.
   */
  tintLeadS?: number;
}

/** One re-target of the wall. `at` is in seconds of the composition that renders the wall. */
export interface Beat {
  id: string;
  at: number;
  field: FieldFn;
  sweep?: Sweep;
  /** Tint easing time constant for this beat (default 0.22 s, measured). */
  tintTauS?: number;
}

export interface Ripple {
  at: number;
  origin: [number, number];
  amp?: number;
  /** Front speed, board widths per second (default scales the site's 0.75 to the board density). */
  speed?: number;
  /** Ring width, board widths (default scales the site's 0.045 to the board density). */
  width?: number;
  /** Amplitude decay, per second (default 1.8, the site's). A film ripple decays slower so it reads. */
  decayPerS?: number;
  /** Seconds until the ring is gone (default 2.2). */
  lifeS?: number;
}

export interface Magnet {
  from: number;
  to: number;
  /** position over time (uv), pure */
  path: (t: number) => [number, number];
  amp?: number;
  sigma?: number;
}

export interface Press {
  at: number;
  origin: [number, number];
  radius: number;
  depth: number;
}

/**
 * Animated content painted onto the wall every frame (Pixie, counters, a tracer).
 * Samples replace the beat state ('replace', default) or add to it ('add': heights and glow add,
 * tint multiplies), weighted by a fade envelope over [from, to].
 */
export interface LiveLayer {
  fn: LiveFieldFn;
  from?: number;
  to?: number;
  /** Cross-fade with the wall state at both ends of the window, seconds (default 0.25). */
  fadeS?: number;
  /** Only pins inside this uv box are evaluated: [u0, v0, u1, v1]. Default: the whole board. */
  region?: [number, number, number, number];
  mode?: 'replace' | 'add';
  /**
   * Largest height speed in this layer, in reliefs per second, at time t. Lets adaptive motion
   * blur take more samples while the layer moves fast. Omit for slow content.
   */
  speedHint?: (t: number) => number;
}
