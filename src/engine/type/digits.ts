import {advance, type FontSpec} from './metrics';

// Counting numbers: proportional glyphs placed in fixed tabular slots while
// the value changes (so nothing jitters), then eased into their natural,
// kerned spacing once the value has landed. Schibsted's tabular figures are
// different designs (a footed 1), so swapping fonts at the landing would pop.

export interface GlyphRun {
  /** left edge of each character, px from the run's left */
  xs: number[];
  chars: string[];
  width: number;
}

const isDigit = (c: string): boolean => c >= '0' && c <= '9';

const slotCache = new Map<string, number>();

/** Widest digit advance in this face: the slot every digit sits in while counting. */
export const digitSlot = (f: FontSpec): number => {
  const key = `${f.family}|${f.weight}|${f.style ?? 'normal'}|${f.size.toFixed(3)}|${f.tracking ?? 0}|${f.features ?? ''}`;
  const hit = slotCache.get(key);
  if (hit !== undefined) return hit;
  let w = 0;
  for (let d = 0; d <= 9; d++) w = Math.max(w, advance(String(d), f));
  slotCache.set(key, w);
  return w;
};

/** Digits centred in equal slots; separators and signs at their own advance. */
export const slotRun = (s: string, f: FontSpec): GlyphRun => {
  const slot = digitSlot(f);
  const chars = Array.from(s);
  const xs: number[] = [];
  let pen = 0;
  for (const c of chars) {
    const a = advance(c, f);
    const cell = isDigit(c) ? slot : a;
    xs.push(pen + (cell - a) / 2);
    pen += cell;
  }
  return {xs, chars, width: pen};
};

/** The string as the font sets it, kerning included. */
export const naturalRun = (s: string, f: FontSpec): GlyphRun => {
  const chars = Array.from(s);
  const xs: number[] = [];
  let prefix = '';
  for (const c of chars) {
    xs.push(advance(prefix, f));
    prefix += c;
  }
  return {xs, chars, width: advance(s, f)};
};

/** Blend two layouts of the same string: k = 0 slots, k = 1 natural. */
export const blendRuns = (a: GlyphRun, b: GlyphRun, k: number): GlyphRun => ({
  chars: a.chars,
  xs: a.xs.map((x, i) => x + ((b.xs[i] ?? x) - x) * k),
  width: a.width + (b.width - a.width) * k,
});
