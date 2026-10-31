// Narration timing: produced by the voice pipeline (TTS + forced alignment),
// consumed by captions, kinetic type, Pixie cues and the sound mix.

/** '' plain, 'em' mint italic idea word, 'key' bold term, 'name' a proper name */
export type WordTag = '' | 'em' | 'key' | 'name';

export interface Word {
  text: string;
  /** seconds, film time */
  start: number;
  end: number;
  tag: WordTag;
}

export interface Utterance {
  id: string;
  chapter: string;
  words: Word[];
}

export interface Chapter {
  id: string;
  title: string;
  /** seconds, film time */
  start: number;
  end: number;
}

export interface NarrationTimeline {
  fps: number;
  durationS: number;
  chapters: Chapter[];
  utterances: Utterance[];
}
