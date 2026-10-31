import type {FilmTimeline} from '../../../timeline';

// Timing helpers shared by the scene builders and the cue sheets of chapters 07 and 11. Every
// time comes from the timeline (scenes, utterances, words), so a re-rendered narration re-times
// the picture and the sound together.

export interface Span {
  start: number;
  end: number;
}

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

/** Start of a word of an utterance (by index or text), minus an optional lead. */
export const wordAt = (tl: FilmTimeline, utt: string, which: number | string, lead = 0): number => tl.word(utt, which).start - lead;

/** End of a word of an utterance. */
export const wordEnd = (tl: FilmTimeline, utt: string, which: number | string): number => tl.word(utt, which).end;

export const uttStart = (tl: FilmTimeline, utt: string) => tl.utt(utt).start;
export const uttEnd = (tl: FilmTimeline, utt: string) => tl.utt(utt).end;

/** A scene's window. */
export const sceneSpan = (tl: FilmTimeline, id: string): Span => {
  const s = tl.scene(id);
  return {start: s.start, end: s.end};
};

/** The first scene of a chapter (its gate). */
export const firstScene = (tl: FilmTimeline, chapter: string): Span => {
  const s = tl.scenes.filter((x) => x.chapter === chapter).sort((a, b) => a.start - b.start)[0];
  if (!s) throw new Error(`timeline: chapter ${chapter} has no scenes`);
  return {start: s.start, end: s.end};
};

/** Midpoint between the end of one utterance and the start of the next (a pre-lap point). */
export const between = (tl: FilmTimeline, a: string, b: string, k = 0.5) => {
  const e = uttEnd(tl, a);
  const s = uttStart(tl, b);
  return e + (s - e) * k;
};
