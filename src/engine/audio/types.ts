// The cue sheet: what the film timeline emits for the audio renderer (scripts/audio/mix.py), and
// the report the renderer writes back. JSON on disk; these types are the contract.
// Times are film seconds unless a field says frames. Levels are LU relative to the voice target
// (-16 LUFS): a cue at level -15 peaks (momentary loudness) 15 LU under the narration.

export type Align = 'start' | 'end' | 'peak';
export type FadeCurve = 'qsin' | 'hsin' | 'lin' | 'log';

/** Every recipe in scripts/audio/sfx_synth.py. */
export type SfxType =
  | 'pin_tick'
  | 'pin_brush'
  | 'note'
  | 'chime'
  | 'error_buzz'
  | 'blip'
  | 'stamp'
  | 'tick'
  | 'typing'
  | 'whoosh'
  | 'swish'
  | 'riser'
  | 'reverse_swell'
  | 'sub_hit'
  | 'impact'
  | 'sub_drop'
  | 'glitch'
  | 'paper'
  | 'heartbeat'
  | 'camera_shutter';

export type SfxCategory = 'pin' | 'tonal' | 'ui' | 'transition' | 'hit' | 'other';

/** Binned pin motion for pin_brush, written by pins.ts from a compiled wall beat. */
export interface PinHist {
  /** bin width, seconds */
  binS: number;
  /** pins released in each bin */
  n: number[];
  /** sum of squared weights (movement energy) per bin */
  e: number[];
  /** mean column (0..1, left to right) and row (0..1, bottom to top) of the pins in each bin */
  u: number[];
  v: number[];
  /** spread (standard deviation) of column and row */
  us: number[];
  vs: number[];
}

export interface SfxCue {
  id?: string;
  type: SfxType;
  /** anchor frame (preferred: the timeline is frame-exact) */
  frame?: number;
  /** or anchor time, seconds */
  at?: number;
  /** start: begins on the anchor; end: finishes on it (risers, swells); peak: its loudest moment lands on it */
  align?: Align;
  /** event loudness, LU relative to the voice target. Default per type (sfx_synth.DEFAULTS). */
  level?: number | null;
  /** extra gain after the level match, dB */
  gainDb?: number;
  /** equal-power balance -1..1 */
  pan?: number;
  /** send to the shared hall, 0..1 (default per type) */
  send?: number;
  /** duck and band-limit while the narrator speaks (default on for transitions) */
  shield?: boolean;
  /** recipe seed; default `${type}@${frame}`, so every tick differs but never drifts */
  seed?: string | number;
  /** recipe arguments, e.g. {degree: 5, octave: 5} for a note or {hist} for a pin brush */
  params?: Record<string, unknown>;
}

export interface MusicCue {
  id?: string;
  /** id in audio/music-manifest.json */
  track: string;
  /** or a file instead of a manifest track */
  src?: string;
  /** film time the cue starts (or inFrame) */
  in?: number;
  inFrame?: number;
  /** film time it ends (or outFrame, or dur) */
  out?: number;
  outFrame?: number;
  dur?: number;
  /** seconds into the track at `in` */
  offset?: number;
  /** open level, LU relative to the voice target (default music.level, -5); null keeps the file's own level */
  level?: number | null;
  gainDb?: number;
  fadeIn?: number;
  fadeOut?: number;
  fadeInCurve?: FadeCurve;
  fadeOutCurve?: FadeCurve;
  /**
   * overlap with the previous cue, seconds: this cue fades in from `in` while the previous one
   * plays on to `in + crossfade` and fades out (equal-power by default)
   */
  crossfade?: number;
  /** 'hsin' (equal gain) only where the two share samples (an in-place swap, see `continues`) */
  crossfadeCurve?: FadeCurve;
  /**
   * id of an earlier cue this one picks up in place: its offset is computed so the music carries
   * on where that cue would be (using the alternative mix's measured alignment in the manifest,
   * e.g. resonance-alt = resonance + 219.83 ms), and it keeps that cue's gain unless `level` or
   * `gainDb` is set. With a crossfade this swaps a main mix for its alternative under narration.
   */
  continues?: string;
  /** gain automation in film time: [[t, dB], ...], raised-cosine between points */
  automation?: Array<[number, number]>;
  /** key override for the palette notes over this cue (else the manifest's estimate) */
  key?: string;
}

export interface VoiceClip {
  src: string;
  at?: number;
  frame?: number;
  trimStartS?: number;
  durS?: number;
  gainDb?: number;
}

export type WordTimes = Array<[number, number]> | Array<{start: number; end: number}>;

export interface VoiceSpec {
  /** one narration stem whose time 0 sits at film time `at` */
  src?: string;
  at?: number;
  trimStartS?: number;
  durS?: number;
  /** or individual lines placed on the timeline */
  clips?: VoiceClip[];
  gainDb?: number;
  /** integrated loudness the stem is normalised to (default -16); null leaves it as is */
  targetLufs?: number | null;
  highpassHz?: number | null;
  stereo?: boolean;
  /** word timings (same data as the captions) */
  words?: WordTimes;
  /** or a file: a NarrationTimeline, src/data/timeline.json or a reel.json */
  wordsFrom?: string;
  wordsOffsetS?: number;
}

export interface DuckSpec {
  depthDb?: number;
  mergeGapS?: number;
  preS?: number;
  attackS?: number;
  holdS?: number;
  releaseS?: number;
  /** gaps longer than mergeGapS swell partially, fully from this length */
  fullSwellGapS?: number;
  /** lift above the open level in holds of swellMinGapS or more */
  swellDb?: number;
  swellMinGapS?: number;
  swellRiseS?: number;
  swellFallS?: number;
  /** EQ dip on the music while the narrator speaks */
  pocket?: {freqHz: number; q?: number; gainDb: number} | null;
}

export interface MasterSpec {
  lufs?: number;
  /** limiter ceiling, dBTP (default -2.0, leaving room for the AAC encode) */
  ceilingDb?: number;
  /** delivery limit, checked after encoding (default -1.5) */
  truePeakMaxDb?: number;
  highpassHz?: number | null;
  aacCheck?: boolean;
}

export interface CueSheet {
  version: 1;
  name: string;
  fps: number;
  durationS?: number;
  durationInFrames?: number;
  /** output folder, project-relative (default public/audio/<name>) */
  out?: string;
  /** key when no music cue is under a tonal cue (default 'D major', the reel's palette) */
  key?: string;
  voiceTargetLufs?: number;
  voice?: VoiceSpec;
  duck?: DuckSpec;
  music?: {level?: number; cues: MusicCue[]};
  sfx?: {
    cues: SfxCue[];
    shieldDb?: number;
    reverb?: {rt60?: number; durS?: number; predelayS?: number; returnDb?: number; seed?: number};
  };
  master?: MasterSpec;
  /**
   * audio files written to `out`: 'flac' (default; lossless, about a third of the WAV's size, and
   * every Remotion render copies public/) or 'wav'. The master is always 24-bit; stems are 16-bit
   * by default for FLAC (previews and meters) and 24-bit for WAV.
   */
  files?: {format?: 'flac' | 'wav'; stemBits?: 16 | 24};
}

// ---------- what mix.py writes back ----------
export interface LoudnessStats {
  I: number;
  LRA: number;
  TP: number;
  SP: number;
  Mmax: number;
  Smax: number;
}

export interface PlacedSfx {
  id: string;
  type: SfxType;
  category: SfxCategory;
  align: Align;
  anchorS: number;
  frame: number;
  startS: number;
  endS: number;
  level: number | null;
  gainDb: number;
  eventLufs: number;
  key: string | null;
  speaking: number;
  voiceLufs: number | null;
  relToVoiceLU: number | null;
  send: number;
  shield: boolean;
  params: Record<string, unknown>;
  /** pin_brush: how many pins of the wall this sound was built from */
  pins?: number;
}

export interface PlacedMusic {
  id: string;
  track: string;
  title?: string;
  attribution?: string;
  in: number;
  out: number;
  offset: number;
  fadeIn: number;
  fadeOut: number;
  fadeInCurve: FadeCurve;
  fadeOutCurve: FadeCurve;
  sliceLufs: number;
  level: number | null;
  gainDb: number;
  key: string;
  continues?: string;
  /** the cue whose gain this one kept (in-place continuation) */
  gainFrom?: string | null;
  sha256?: string;
}

/** How the music measured against the narration (centred 3 s short-term loudness). */
export interface MixBalance {
  method: string;
  musicUnderVoiceLU?: {median: number; p10: number; p90: number; seconds: number; target: [number, number]};
  musicInHoldsLU?: {median: number; p90: number; seconds: number; target: [number, number]};
}

export interface MixReport {
  version: 1;
  name: string;
  cueSheet: string;
  fps: number;
  durationS: number;
  sampleRate: number;
  /** paths relative to public/ (pass to staticFile) */
  files: {voice?: string; music?: string; sfx?: string; master?: string};
  voice: {words: number; phrases: Array<[number, number]>; measuredLufs?: number; normaliseGainDb?: number};
  /** the automation parameters used (duck_env.py names: depth_db, merge_gap, swell_db, ...) */
  duck: {params: Record<string, number>; pocket: {freqHz: number; q?: number; gainDb: number} | null};
  music: PlacedMusic[];
  sfx: PlacedSfx[];
  balance: MixBalance;
  stems: {voice: LoudnessStats; music: LoudnessStats; sfx: LoudnessStats; premix: LoudnessStats};
  master: null | {
    target: {lufs: number; truePeakMaxDb: number};
    premixLufs: number;
    gainDb: number;
    limiter: {ceilingDb: number; maxGainReductionDb: number; pctTimeLimiting: number; truePeakDb: number};
    stats: LoudnessStats;
    ffmpeg: {I: number | null; LRA: number | null; TP: number | null};
    aac: null | {I: number | null; LRA: number | null; TP: number | null; bitrate: string};
    pass: boolean;
  };
  warnings: string[];
  timing: Record<string, number>;
}

/** meters.json: one value per video frame. */
export interface MixMeters {
  fps: number;
  frames: number;
  momentaryLufs: {voice: number[]; music: number[]; sfx: number[]; master: number[]};
  musicGainDb: number[];
  voiceActivity: number[];
}
