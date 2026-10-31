import React from 'react';
import {Audio} from '@remotion/media';
import {Sequence, staticFile, useVideoConfig} from 'remotion';
import {dbToGain} from './duck';
import {paletteSound, type PaletteName} from './palette';
import type {Align} from './types';

export interface SfxProps {
  /** a palette preview from public/audio/sfx/ (scripts/audio/render_palette.py) */
  name: PaletteName;
  /** anchor time in seconds of this composition */
  at: number;
  /** start | end (risers, swells) | peak (whooshes); default: what the sound is designed for */
  align?: Align;
  /** trim in dB (<= 0); the previews are already at their default mix level */
  gainDb?: number;
}

/**
 * One palette sound placed on the timeline, for auditioning a scene in the Studio before its cues
 * go through mix.py. Frame-accurate (the renderer is sample-accurate and key-aware; use it for
 * the film).
 */
export const Sfx: React.FC<SfxProps> = ({name, at, align, gainDb = 0}) => {
  const {fps} = useVideoConfig();
  const s = paletteSound(name);
  const a = align ?? s.align;
  const startS = a === 'end' ? at - s.durS : a === 'peak' ? at - s.peakS : at;
  const from = Math.round(startS * fps);
  const head = from < 0 ? -from : 0;
  const len = Math.ceil(s.durS * fps) - head;
  if (len <= 0) return null;
  return (
    <Sequence from={Math.max(0, from)} durationInFrames={len} layout="none" name={`sfx: ${name}`}>
      <Audio src={staticFile(s.file)} trimBefore={head} volume={Math.min(1, dbToGain(gainDb))} />
    </Sequence>
  );
};
