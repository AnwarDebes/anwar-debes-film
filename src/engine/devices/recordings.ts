// Recordings of the live apps, made by scripts/record/record.mjs from scripts/record/shots/*.json.
// Each mp4 has a sidecar .json (url, viewport, encode settings and a per-frame log).
import {staticFile} from 'remotion';
import type {ScreenSource} from './DeviceScreen';

export interface Recording {
  /** path inside public/ */
  src: string;
  /** the page that was recorded */
  url: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** what happens when, in seconds of the recording */
  beats: Record<string, number>;
}

export const recordings = {
  /** TRACE live, film mode: hero, click "Watch a session", the session runs to the violation */
  trace: {
    src: 'recordings/trace.mp4',
    url: 'https://anwardebes.github.io/trace/?film',
    width: 3200,
    height: 2000,
    fps: 60,
    durationInFrames: 600,
    beats: {click: 1.0, scrolled: 1.65, firstStep: 1.5, outsideSend1: 6.1, violation: 8.4},
  },
  /** anwardebes.github.io: the pin portrait rises, follows the pointer, ripples, turns boolean */
  home: {
    src: 'recordings/home.mp4',
    url: 'https://anwardebes.github.io/',
    width: 3200,
    height: 2000,
    fps: 60,
    durationInFrames: 390,
    beats: {risen: 1.3, ripple: 3.35, booleans: 4.7},
  },
  /** anwardebes.github.io on a phone (390 x 798 CSS at 3x, touch): rise, tap ripple, booleans */
  homePhone: {
    src: 'recordings/home-phone.mp4',
    url: 'https://anwardebes.github.io/',
    width: 1170,
    height: 2394,
    fps: 60,
    durationInFrames: 390,
    beats: {risen: 1.4, ripple: 2.2, booleans: 3.8},
  },
} as const satisfies Record<string, Recording>;

export type RecordingName = keyof typeof recordings;

/** A ready ScreenSource for a recording (frame-exact, starting at the Sequence start). */
export const recordingSource = (name: RecordingName, opts: Omit<ScreenSource, 'src' | 'size' | 'durationInFrames'> = {}): ScreenSource => {
  const r = recordings[name];
  return {src: staticFile(r.src), size: [r.width, r.height], durationInFrames: r.durationInFrames, ...opts};
};
