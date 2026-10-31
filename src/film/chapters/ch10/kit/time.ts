import type {FilmTimeline, TimedUtterance} from '../../../timeline';

// Every time in these chapters comes from the film timeline: scenes, utterances and words.
// Nothing is typed in seconds except offsets relative to those anchors, so a new voice take
// re-times the whole chapter.

export interface Clock {
  tl: FilmTimeline;
  fps: number;
  /** a scene's window, film seconds */
  sc: (id: string) => {start: number; end: number};
  /** is this utterance in the timeline (consent and approval gates drop lines) */
  has: (uttId: string) => boolean;
  u: (id: string) => TimedUtterance;
  /** start of a spoken word (index or text) */
  w: (uttId: string, word: string | number) => number;
  /** end of a spoken word */
  we: (uttId: string, word: string | number) => number;
  /** start of the first `word` that comes after the first `after` in an utterance */
  wa: (uttId: string, after: string, word: string) => number;
  /** frame of a film time */
  f: (s: number) => number;
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9%µ.]+/g, '').replace(/\.$/, '');

export const makeClock = (tl: FilmTimeline): Clock => {
  const ids = new Set(tl.utterances.map((u) => u.id));
  return {
    tl,
    fps: tl.fps,
    sc: (id) => {
      const s = tl.scene(id);
      return {start: s.start, end: s.end};
    },
    has: (id) => ids.has(id),
    u: (id) => tl.utt(id),
    w: (id, word) => tl.word(id, word).start,
    we: (id, word) => tl.word(id, word).end,
    wa: (id, after, word) => {
      const ws = tl.utt(id).words;
      const a = ws.findIndex((x) => clean(x.text) === clean(after));
      if (a < 0) throw new Error(`timeline: ${id} has no word "${after}"`);
      const k = ws.findIndex((x, i) => i > a && clean(x.text) === clean(word));
      if (k < 0) throw new Error(`timeline: ${id} has no word "${word}" after "${after}"`);
      return ws[k].start;
    },
    f: (s) => tl.f(s),
  };
};

/** A word start if the utterance exists, else a fallback time. */
export const wordOr = (c: Clock, id: string, word: string | number, fallback: number): number => (c.has(id) ? c.w(id, word) : fallback);

/** Start and end of an utterance if it exists, else a fallback window. */
export const uttOr = (c: Clock, id: string, fallback: [number, number]): [number, number] => {
  if (!c.has(id)) return fallback;
  const u = c.u(id);
  return [u.start, u.end];
};

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
