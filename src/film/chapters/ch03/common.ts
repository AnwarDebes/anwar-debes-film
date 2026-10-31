import type {RGB} from '../../../engine/pins';
import type {Clip} from './kit/device';

// Chapter 03 constants: the TRACE palette on the wall, the two recordings of the live page, and
// where the places sit on the wall.

/** TRACE's ground (#061312 with a teal glow) as a steel tint. */
export const TEAL: RGB = [0.6, 0.86, 0.8];
/** The film's one red ground drop (03.4). */
export const RED_DROP: RGB = [0.95, 0.42, 0.36];
/** Lit, allowed: mint-white heads that glow. */
export const LIT: RGB = [0.86, 1.08, 1.0];
/** Verdict red pins. */
export const RED_PIN: RGB = [1.7, 0.55, 0.5];

export const CLIPS = {
  /** trace/?film: the exfil session stepped once per second (steps at 1..7 s), then the monitors (8.5 s) */
  session: {src: 'recordings/ch03-session.mp4', size: [1920, 1200], frames: 660, fps: 60} as Clip,
  /** trace/?film: seal (1.0 s), tamper mode (2.5), export bit flipped (3.6), verify fails (4.6), restored (6.8), verify passes (7.8) */
  ledger: {src: 'recordings/ch03-ledger.mp4', size: [1920, 1200], frames: 600, fps: 60} as Clip,
};

export const SESSION_REC = {steps: [1, 2, 3, 4, 5, 6, 7], monitors: 8.5};
export const LEDGER_REC = {seal: 1.0, tamper: 2.5, flip: 3.6, verifyBad: 4.6, restore: 6.8, verifyOk: 7.8};

/** The repository's place in the walk (0-based): glassbox-lm is the 10th, trace the 11th. */
export const RULE_INDEX = 10;
