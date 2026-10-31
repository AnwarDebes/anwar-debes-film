import {random} from 'remotion';

// Seeded per-pin randomness. A beat's seed comes from Remotion's random(); each pin then gets a
// fast integer hash of (seed, index), so every value is a pure function of its inputs.

/** A 32-bit seed derived from any string or number. */
export const seedOf = (s: string | number): number => Math.floor(random(`pins:${s}`) * 4294967296) >>> 0;

/** Uniform value in [0, 1) for (seed, i). */
export const hash01 = (seed: number, i: number): number => {
  let h = (seed ^ Math.imul(i + 0x632be5ab, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
