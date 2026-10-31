// Pixie, the film's guide. Public API.
//
// Canonical source: the original CCIM web/js/mascot.js, through pixie-core.ts
// (verified by scripts/pixie/verify.mjs). Never redesign, rename or add parts.

export {
  PALETTE,
  STATE_LABELS,
  PIXIE_STATES,
  SCENE_W,
  SCENE_H,
  PIN_HEIGHT,
  pixieRects,
  translateRects,
  mirrorRects,
  toDevice,
  cellFor,
  samplePixie,
  type PixieState,
  type Rect,
  type Part,
} from './pixie-core';
export {
  resolveTimeline,
  walkAt,
  walkArrivalFrame,
  type PixieCue,
  type PixieMoment,
  type PixieTimeline,
  type PixieWalk,
  type WalkPose,
  type Facing,
} from './timeline';
export {pixiePose, isBlinkingAt, blinkScheduleFor, type PixiePose, type PixiePoseInput} from './pose';
export {CompiledPixie, type SampleOut} from './sampler';
export {pixieField, type PixieFieldOptions, type PixiePinSample, type PixieFieldFn} from './field';
export {Pixie, pixieCell, type PixieProps} from './Pixie';
export {PixieCard, cardGeometry, type PixieCardProps, type CardGeometry} from './PixieCard';
export {PixieGuide, guideLayout, type PixieGuideProps, type GuideLayout} from './PixieGuide';
export {PIXIE_PRESETS, presetCell, CARD_COLORS, DEFAULT_KICKER, type PixiePreset} from './presets';
