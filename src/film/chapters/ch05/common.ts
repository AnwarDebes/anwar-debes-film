import type {RGB} from '../../../engine/pins';
import type {Clip} from '../ch03/kit/device';

// Chapter 05 constants: CANDOR's light paper palette on the wall (painted, non-metallic heads so
// the tint reads as paper, not as polished steel), its teal, and the recording of the glass box.

/** Paper ground #F3FBF8 as a painted pin tint. */
export const PAPER: RGB = [0.97, 1.02, 1.0];
/** CANDOR teal #0B877B as a painted pin tint (lit concepts). */
export const TEAL: RGB = [0.1, 0.62, 0.55];
export const TEAL_SOFT: RGB = [0.5, 0.85, 0.78];
/** The leak: a dim amber. */
export const LEAK: RGB = [1.0, 0.78, 0.3];
/** Ink for pins drawn dark on paper (the black box, the magnifier). */
export const INK: RGB = [0.16, 0.2, 0.2];

/** Colours for type set straight on the paper ground. */
export const INK_TEXT = '#0E2A26';
export const TEAL_TEXT = '#0B877B';
export const MUTED_TEXT = '#47605B';

/**
 * candor/?film, frame-stepped (light theme): box 1 at rest (0-2 s), atom 0 (concept C) off at 2.0 s,
 * restored at 4.0 s, atom 18 (distractor F) off at 5.0 s, restored at 7.0 s, scroll to box 2
 * (7.4-8.3 s), the trigger planted at 9.0 s.
 */
export const GLASSBOX: Clip = {src: 'recordings/ch05-glassbox.mp4', size: [1920, 1200], frames: 660, fps: 60};
export const GLASSBOX_REC = {rest: 1.0, cOff: 2.0, cBack: 4.0, fOff: 5.0, fBack: 7.0, toBox2: 7.4, trigger: 9.0};

/** candor is the 13th place of the walk (0-based 12). */
export const RULE_INDEX = 12;
