import type {FilmTimeline, TimedUtterance} from '../../../timeline';

// Small helpers over the film timeline. Every time in the chapters comes from here: scene
// bounds, utterance bounds and word starts, so a re-rendered narration re-times everything.

export interface Clock {
  tl: FilmTimeline;
  scene: (id: string) => {start: number; end: number};
  u: (id: string) => TimedUtterance;
  /** start of a word (by text or index) */
  w: (uttId: string, which: string | number) => number;
  /** end of a word */
  we: (uttId: string, which: string | number) => number;
  /** clamp a time into [a, b] */
  clamp: (x: number, a: number, b: number) => number;
}

export const clock = (tl: FilmTimeline): Clock => ({
  tl,
  scene: (id) => tl.scene(id),
  u: (id) => tl.utt(id),
  w: (u, which) => tl.word(u, which).start,
  we: (u, which) => tl.word(u, which).end,
  clamp: (x, a, b) => (x < a ? a : x > b ? b : x),
});

/** A time between two others (k = 0 gives a, 1 gives b). */
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
