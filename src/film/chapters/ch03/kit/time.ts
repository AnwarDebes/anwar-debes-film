import type {FilmTimeline, SceneTime, TimedUtterance} from '../../../timeline';

// Every time in chapters 03-05 comes from the master timeline: scenes, utterances and words.
// Nothing is typed in seconds, so a re-rendered narration re-times every hit.

export interface Clock {
  tl: FilmTimeline;
  fps: number;
  sc: (id: string) => SceneTime;
  u: (id: string) => TimedUtterance;
  /** start of a word of an utterance (index, or text: first match) */
  w: (uid: string, which: number | string) => number;
  /** end of a word */
  we: (uid: string, which: number | string) => number;
  /** start of the n-th (0-based) occurrence of a word in an utterance */
  nth: (uid: string, text: string, n: number) => number;
  /** absolute frame of a time */
  f: (s: number) => number;
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9%µ.]+/g, '').replace(/\.$/, '');

export const clock = (tl: FilmTimeline): Clock => ({
  tl,
  fps: tl.fps,
  sc: (id) => tl.scene(id),
  u: (id) => tl.utt(id),
  w: (uid, which) => tl.word(uid, which).start,
  we: (uid, which) => tl.word(uid, which).end,
  nth: (uid, text, n) => {
    const key = clean(text);
    const hits = tl.utt(uid).words.filter((x) => clean(x.text) === key);
    const hit = hits[Math.min(n, hits.length - 1)];
    if (!hit) throw new Error(`timeline: ${uid} has no word "${text}"`);
    return hit.start;
  },
  f: (s) => tl.f(s),
});

/** Linear interpolation of a time between two others (0 = a, 1 = b). */
export const between = (a: number, b: number, k: number) => a + (b - a) * k;

/** Force a list of hit times to increase by at least `gap` (estimated or tight narration). */
export const monotone = (ts: number[], gap = 0.22): number[] => {
  const out = ts.slice();
  for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1] + gap) out[i] = out[i - 1] + gap;
  return out;
};
