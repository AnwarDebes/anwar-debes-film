import type {NarrationTimeline, Utterance, Word} from '../narration/types';

// Helpers to drive code cues from narration word timings, so a line can be
// revealed, highlighted or annotated on the word that names it.

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '');

/** The n-th word matching `text` (case and punctuation ignored). */
export const findWord = (words: Word[], text: string, occurrence = 0): Word | undefined => {
  const want = norm(text);
  let k = 0;
  for (const w of words) {
    if (norm(w.text) !== want) continue;
    if (k === occurrence) return w;
    k++;
  }
  return undefined;
};

/** All words of an utterance (by id) in a timeline. */
export const utteranceWords = (tl: NarrationTimeline, id: string): Word[] =>
  tl.utterances.find((u: Utterance) => u.id === id)?.words ?? [];

/**
 * Start time of a word, shifted by `lead` seconds (negative = earlier).
 * Throws if the word is missing so a broken sync never renders silently.
 */
export const atWord = (words: Word[], text: string, lead = 0, occurrence = 0): number => {
  const w = findWord(words, text, occurrence);
  if (!w) throw new Error(`code cue: word "${text}" (#${occurrence}) not found in narration`);
  return w.start + lead;
};

/** End time of a word, shifted by `lag` seconds. */
export const afterWord = (words: Word[], text: string, lag = 0, occurrence = 0): number => {
  const w = findWord(words, text, occurrence);
  if (!w) throw new Error(`code cue: word "${text}" (#${occurrence}) not found in narration`);
  return w.end + lag;
};

/**
 * Per-line reveal times spread across a span of narration: line k appears on
 * the word at the matching fraction of the span. Use as `times` in a reveal cue.
 */
export const spreadOverWords = (words: Word[], from: number, to: number, lines: number, lead = -0.05): number[] => {
  const span = words.filter((w) => w.start >= from && w.start <= to);
  if (!span.length || lines <= 0) return [];
  return Array.from({length: lines}, (_, k) => {
    const idx = Math.min(span.length - 1, Math.round((k / Math.max(1, lines - 1)) * (span.length - 1)));
    return span[idx].start + lead;
  });
};
