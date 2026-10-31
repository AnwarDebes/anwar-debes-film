import React from 'react';
import {Audio} from '@remotion/media';
import {staticFile, useVideoConfig} from 'remotion';
import {dbToGain} from './duck';

export type StemName = 'voice' | 'music' | 'sfx';
export type MixFile = 'master' | StemName;

export interface FilmAudioProps {
  /** folder under public/ that mix.py wrote (master, voice, music, sfx), e.g. 'audio/film' */
  dir?: string;
  /** the files' format, as the cue sheet's files.format (default 'flac') */
  ext?: 'flac' | 'wav';
  /** or explicit files, paths under public/ (they override `dir`) */
  files?: Partial<Record<MixFile, string>>;
  /**
   * 'master': the finished mix, what the delivery carries (default).
   * 'stems': voice, music and sfx as mixed (ducked, pocketed, shielded) but before the master's
   * gain and limiter, for checking balances in the Studio.
   */
  mode?: 'master' | 'stems';
  /** film time (s) at this composition's frame 0, when a chapter is rendered on its own */
  startS?: number;
  /** stems mode: play one stem alone, or leave some out */
  solo?: StemName;
  mute?: readonly StemName[];
  /** stems mode: per-stem trim in dB (only downward; the stems are already at mix level) */
  trimDb?: Partial<Record<StemName, number>>;
  /** overall trim in dB, applied in both modes (volume never exceeds 1) */
  gainDb?: number;
}

const STEMS: readonly StemName[] = ['voice', 'music', 'sfx'];

/**
 * The film's audio in sync with the picture: frame f plays the mix at film time
 * startS + f / fps (checked: a rendered clip matches the master at 0 samples). Place it once, at
 * the top of a composition. For delivery, render the picture with --muted and mux the master with
 * ffmpeg (audio.md 5.4; FLAC is lossless, so master.flac is the master) so the mastered file is
 * what ships.
 */
export const FilmAudio: React.FC<FilmAudioProps> = ({dir, ext = 'flac', files, mode = 'master', startS = 0, solo, mute = [], trimDb = {}, gainDb = 0}) => {
  const {fps} = useVideoConfig();
  const path = (k: MixFile): string | undefined => files?.[k] ?? (dir ? `${dir.replace(/\/$/, '')}/${k}.${ext}` : undefined);
  const trimBefore = Math.max(0, Math.round(startS * fps));
  if (mode === 'master') {
    const src = path('master');
    if (!src) return null;
    return <Audio src={staticFile(src)} trimBefore={trimBefore} volume={Math.min(1, dbToGain(gainDb))} name="mix: master" />;
  }
  return (
    <>
      {STEMS.filter((s) => (solo ? s === solo : !mute.includes(s))).map((s) => {
        const src = path(s);
        if (!src) return null;
        const v = Math.min(1, dbToGain(gainDb + Math.min(0, trimDb[s] ?? 0)));
        return <Audio key={s} src={staticFile(src)} trimBefore={trimBefore} volume={v} name={`mix: ${s}`} />;
      })}
    </>
  );
};
