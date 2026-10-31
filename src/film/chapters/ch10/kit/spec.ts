import type {ChapterSpec} from '../../../types';

/** A scene's contribution: any subset of a chapter spec. */
export type Part = Partial<ChapterSpec>;

const KEYS = ['beats', 'camera', 'focus', 'light', 'ripples', 'magnets', 'presses', 'live', 'world', 'overlays', 'captionSkip', 'pixie', 'sfx', 'music'] as const;

/** Concatenate scene parts into one chapter spec (ids are checked once the film merges). */
export const mergeParts = (...parts: Part[]): ChapterSpec => {
  const out: Record<string, unknown[]> = {};
  for (const k of KEYS) out[k] = [];
  for (const p of parts) {
    for (const k of KEYS) {
      const v = p[k] as unknown[] | undefined;
      if (v) out[k].push(...v);
    }
  }
  return out as unknown as ChapterSpec;
};
