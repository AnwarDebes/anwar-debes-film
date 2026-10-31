import type {RGB} from '../../../engine/pins';
import type {Clip} from '../ch03/kit/device';

// Chapter 04 constants: the VERITAS ground, the recording of the live prover, the place's walk index.

/** VERITAS navy-teal (#071119) as a steel tint. */
export const NAVY: RGB = [0.55, 0.7, 0.92];
export const LIT: RGB = [0.86, 1.08, 1.0];
export const AMBER: RGB = [1.45, 1.0, 0.32];
export const MINT_PIN: RGB = [0.74, 1.14, 0.98];

/**
 * veritas/?film, frame-stepped: setPrompt (0 s), prove (1.0 s; the counterexample card lands at about
 * 2.5 s), scroll to it (2.75 s), repair (5.0 s; seven probe rows, the last mark at 8.57 s), scroll to the
 * proof (10.2 s).
 */
export const PROVER: Clip = {src: 'recordings/ch04-prover.mp4', size: [1920, 1200], frames: 840, fps: 60};
export const PROVER_REC = {prove: 1.0, answer: 2.5, repair: 5.0, proof: 10.2};
/** When each repair probe's row appears in the recording (read off the frames), and the last mark. */
export const PROVER_PROBES = [5.17, 5.62, 6.23, 6.85, 7.13, 7.7, 8.28];
export const PROVER_FINAL = 8.57;

/** veritas is the 12th place of the walk (0-based 11). */
export const RULE_INDEX = 11;

/** Vocabulary indices of the claim's words in trace-model.json. */
export const CLAIM = {ignore: 30, previous: 183, instructions: 21, which: 124};
