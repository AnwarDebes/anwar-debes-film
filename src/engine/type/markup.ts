import type {Utterance, Word, WordTag} from '../narration/types';

/** Typographic punctuation: curly quotes and apostrophes, ellipsis, minus in numbers. */
export const typo = (s: string): string =>
  s
    .replace(/(\p{L}|\p{N})'(\p{L})/gu, '$1’$2')
    .replace(/(\p{L}|\p{N})'/gu, '$1’')
    .replace(/'(\p{L}|\p{N})/gu, '‘$1')
    .replace(/'/g, '’')
    .replace(/"(\S)/g, '“$1')
    .replace(/"/g, '”')
    .replace(/\.\.\./g, '…')
    .replace(/(^|[\s(])-(\d)/g, '$1−$2');

export interface Token {
  text: string;
  tag: WordTag;
}

/**
 * Inline markup for display lines: *idea words* become em (mint STIX italic),
 * **terms** become key (bold white). Words are split on spaces.
 *   parseMarkup('He builds AI you can *check.*')
 */
export const parseMarkup = (src: string): Token[] => {
  const out: Token[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|[^*]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const chunk = m[0];
    let tag: WordTag = '';
    let body = chunk;
    if (chunk.startsWith('**')) {
      tag = 'key';
      body = chunk.slice(2, -2);
    } else if (chunk.startsWith('*')) {
      tag = 'em';
      body = chunk.slice(1, -1);
    }
    for (const w of body.split(/\s+/)) {
      if (w.length > 0) out.push({text: w, tag});
    }
  }
  return out;
};

/**
 * Timed words for a line that is not spoken (titles, cards): one word every
 * `perWordS` seconds from `at`.
 */
export const wordsFromMarkup = (src: string, at: number, perWordS = 0.12): Word[] =>
  parseMarkup(src).map((tk, i) => ({
    text: tk.text,
    tag: tk.tag,
    start: at + i * perWordS,
    end: at + (i + 1) * perWordS,
  }));

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Start time of a spoken word, for landing a hit on it:
 *   wordStart(utts, 'u05', 'measured')   // first match in that utterance
 *   wordStart(utts, 'u04', 21)           // by index
 */
export const wordStart = (utts: Utterance[], uttId: string, which: string | number, occurrence = 0): number => {
  const u = utts.find((x) => x.id === uttId);
  if (!u) throw new Error(`wordStart: no utterance ${uttId}`);
  if (typeof which === 'number') {
    const w = u.words[which];
    if (!w) throw new Error(`wordStart: ${uttId} has no word ${which}`);
    return w.start;
  }
  const target = norm(which);
  let seen = 0;
  for (const w of u.words) {
    if (norm(w.text) === target) {
      if (seen === occurrence) return w.start;
      seen++;
    }
  }
  throw new Error(`wordStart: "${which}" not in ${uttId}`);
};

/** Shift every word of an utterance list by `dt` seconds. */
export const shiftUtterances = (utts: Utterance[], dt: number): Utterance[] =>
  utts.map((u) => ({...u, words: u.words.map((w) => ({...w, start: w.start + dt, end: w.end + dt}))}));
