// The music automation of scripts/audio/duck_env.py (music_curve), as a pure function of time, for
// Remotion previews before mix.py has run: `<Audio volume={(f) => dbToGain(curve.gainDb(f / fps))}>`.
// Same phrases, same ramps, same numbers: scripts/audio/parity.ts checks it against the Python frame
// by frame (they agree to 1e-15 dB).

import type {DuckSpec, WordTimes} from './types';

export interface DuckParams {
  depthDb: number;
  mergeGapS: number;
  preS: number;
  attackS: number;
  holdS: number;
  releaseS: number;
  fullSwellGapS: number;
  swellDb: number;
  swellMinGapS: number;
  swellRiseS: number;
  swellFallS: number;
}

export const DUCK_DEFAULTS: DuckParams = {
  depthDb: -10,
  mergeGapS: 1.5,
  preS: 0.15,
  attackS: 0.25,
  holdS: 0.35,
  releaseS: 0.6,
  fullSwellGapS: 3.0,
  swellDb: 3.0,
  swellMinGapS: 3.0,
  swellRiseS: 1.2,
  swellFallS: 1.0,
};

export type Phrase = [number, number];

export const wordIntervals = (words: WordTimes): Phrase[] =>
  (words as Array<[number, number] | {start: number; end: number}>).map((w) =>
    Array.isArray(w) ? [w[0], w[1]] : [w.start, w.end],
  );

/** Words closer than mergeGapS become one phrase. */
export const mergePhrases = (words: WordTimes, mergeGapS = DUCK_DEFAULTS.mergeGapS): Phrase[] => {
  const ws = wordIntervals(words).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Phrase[] = [];
  for (const [s, e] of ws) {
    const last = out[out.length - 1];
    if (last && s - last[1] < mergeGapS) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
};

const rc = (x: number): number => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
};

export interface MusicCurve {
  phrases: Phrase[];
  params: DuckParams;
  /** voice activity 0..1 (1 = the music is fully ducked) */
  depth: (t: number) => number;
  /** music gain in dB: depthDb under speech, partial swells in short gaps, +swellDb in long holds */
  gainDb: (t: number) => number;
}

interface Hold {
  fa: number;
  fb: number;
  rise: number;
  fall: number;
}

export const makeMusicCurve = (words: WordTimes, spec: DuckSpec = {}): MusicCurve => {
  const p: DuckParams = {...DUCK_DEFAULTS};
  for (const k of Object.keys(DUCK_DEFAULTS) as Array<keyof DuckParams>) {
    const v = (spec as Record<string, unknown>)[k];
    if (typeof v === 'number') p[k] = v;
  }
  const ph = mergePhrases(words, p.mergeGapS);
  const lead = p.preS + p.attackS;
  const tail = p.holdS + p.releaseS;
  const span = Math.max(1e-6, p.fullSwellGapS - p.mergeGapS);
  const frac = ph.slice(1).map(([s1], k) => Math.min(1, Math.max(0, (s1 - ph[k][1] - p.mergeGapS) / span)));
  const holds: Hold[] = [];
  const edges: Array<[number, number]> = ph.length ? [[-Infinity, ph[0][0]]] : [[-Infinity, Infinity]];
  for (let k = 1; k < ph.length; k++) edges.push([ph[k - 1][1], ph[k][0]]);
  if (ph.length) edges.push([ph[ph.length - 1][1], Infinity]);
  for (const [a, b] of edges) {
    if (b - a < p.swellMinGapS) continue;
    const fa = a === -Infinity ? -Infinity : a + tail;
    const fb = b === Infinity ? Infinity : b - lead;
    if (fb - fa <= 0.2) continue;
    const L = fb - fa;
    holds.push({
      fa,
      fb,
      rise: Number.isFinite(L) ? Math.min(p.swellRiseS, L / 2) : p.swellRiseS,
      fall: Number.isFinite(L) ? Math.min(p.swellFallS, L / 2) : p.swellFallS,
    });
  }
  // index of the last phrase whose start (minus `shift`) is at or before t; phrases are sorted
  const find = (t: number, shift: number): number => {
    let lo = 0;
    let hi = ph.length - 1;
    let k = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (ph[m][0] - shift <= t) {
        k = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return k;
  };
  const depth = (t: number): number => {
    const k = find(t, lead);
    let d = 0;
    for (let j = Math.max(0, k - 1); j <= Math.min(ph.length - 1, k + 1); j++) {
      const [s, e] = ph[j];
      if (t < s - lead || t >= e + tail) continue;
      d = Math.max(d, rc(Math.min((t - (s - lead)) / p.attackS, (e + tail - t) / p.releaseS)));
    }
    // inside the gap after phrase g: a partial swell that grows with the gap
    const g = find(t, 0);
    if (g >= 0 && g < ph.length - 1 && t >= ph[g][1] && t < ph[g + 1][0] && frac[g] < 1) d = 1 - frac[g] * (1 - d);
    return d;
  };
  const bump = (t: number): number => {
    let b = 0;
    for (const h of holds) {
      const up = h.fa === -Infinity ? 1 : rc((t - h.fa) / h.rise);
      const dn = h.fb === Infinity ? 1 : rc((h.fb - t) / h.fall);
      b = Math.max(b, Math.min(up, dn));
    }
    return b;
  };
  return {
    phrases: ph,
    params: p,
    depth,
    gainDb: (t: number) => p.depthDb * depth(t) + p.swellDb * bump(t),
  };
};

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
