// The film's audio engine, Remotion side. The mix itself is rendered offline by
// scripts/audio/mix.py from a cue sheet (types.ts) that the timeline builds with cues.ts.

export type * from './types';
export {sfx, cue, chapterTurn, music, cueSheet, validateCueSheet, framesToS, sToFrames} from './cues';
export type {Pitch} from './cues';
export {pinBeatHist, pinBrushCue} from './pins';
export type {PinBeatSound, PinSoundOptions} from './pins';
export {makeMusicCurve, mergePhrases, wordIntervals, dbToGain, DUCK_DEFAULTS} from './duck';
export type {DuckParams, MusicCurve, Phrase} from './duck';
export {keyTonic, keyRoot, degreeMidi, noteName, keyLabel, midiHz} from './pitch';
export {PALETTE, paletteSound} from './palette';
export type {PaletteName, PaletteSound} from './palette';
export {FilmAudio} from './FilmAudio';
export type {FilmAudioProps, StemName, MixFile} from './FilmAudio';
export {Sfx} from './Sfx';
export type {SfxProps} from './Sfx';
export {
  useStaticJson,
  useStaticAudio,
  envelopeOf,
  useEnvelope,
  WaveLane,
  frameLevelsOf,
  meterAt,
  LevelMeter,
} from './scope';
export type {Envelope, WaveLaneProps, FrameLevels, MeterReading, LevelMeterProps, JsonState} from './scope';
