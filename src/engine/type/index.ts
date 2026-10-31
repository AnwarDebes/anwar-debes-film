// Typography, captions and the film's "show its work" UI.
// Every component is an HTML layer sized from the frame height H and is a
// pure function of film time t (seconds); pass `t` explicitly or let it
// follow the current frame.

// captions
export {Captions, buildCaptionPages} from './Captions';
export type {CaptionsProps, CaptionPage, CaptionGeometry} from './Captions';
export {Scrim} from './Scrim';
export type {ScrimProps} from './Scrim';

// kinetic type
export {KineticLine} from './KineticLine';
export type {KineticLineProps, KineticVariant} from './KineticLine';
export {Numeral, countAt, formatNumber, useNumeralWidth} from './Numeral';
export type {NumeralProps} from './Numeral';
export {Kicker, kickerString, toneColor} from './Kicker';
export type {KickerProps, Tone} from './Kicker';
export {ChapterCard} from './ChapterCard';
export type {ChapterCardProps} from './ChapterCard';

// show its work
export {CitationChip} from './CitationChip';
export type {CitationChipProps} from './CitationChip';
export {StepPill} from './StepPill';
export type {StepPillProps} from './StepPill';
export {Stamp, STAMPS} from './Stamp';
export type {StampKind, StampProps} from './Stamp';
export {Legend} from './Legend';
export type {LegendItem, LegendProps} from './Legend';
export {GlassCard, WindowFrame} from './Cards';
export type {GlassCardProps, WindowFrameProps} from './Cards';
export {Tick} from './Tick';
export type {TickProps} from './Tick';

// layout and type primitives
export {layoutBlock, paginate} from './layout';
export type {Align, BlockLayout, BlockOptions, LayoutInput, LineBox, Page, PlacedRun, TimedInput} from './layout';
export {advance, inkWidth, baselineOffset, runTop, fontCSS, capHeightOf, faceMetrics, RUN_LH} from './metrics';
export type {FontSpec} from './metrics';
export {fontOf, typeCSS, emFont, tagLook, mintGlow, legibilityShadow, TABULAR} from './styles';
export type {TagLook} from './styles';
export {typo, parseMarkup, wordsFromMarkup, wordStart, shiftUtterances} from './markup';
export type {Token} from './markup';
export {useFontsReady, fontsAreReady} from './fontsReady';
export {useUnits, useTime, makeUnits, REF_H, px} from './units';
export type {Units} from './units';
export * from './ease';
