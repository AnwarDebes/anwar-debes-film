import {flatField, settledBeat, type Beat, type FieldFn} from '../engine/pins';

/**
 * The state the wall is in between chapters: settled, bare steel. A chapter's first beat
 * re-targets from it and its last beat returns to it, so chapters can be built, previewed and
 * rendered independently and still join without a cut.
 */
export const HANDOFF: FieldFn = flatField();

/** The wall at the very start of the film. */
export const OPENING: Beat = settledBeat('film-open', HANDOFF);
