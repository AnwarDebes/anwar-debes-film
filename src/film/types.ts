import type React from 'react';
import type {Beat, Board, LightKey, LiveLayer, Magnet, Pixels, Press, Ripple} from '../engine/pins';
import type {CameraKey, FocusKey} from '../engine/camera';
import type {PixieCue} from '../pixie/timeline';
import type {MusicCue, SfxCue} from '../engine/audio/types';
import type {FilmTimeline} from './timeline';

/** Something on screen for a window of film time. `render` receives film time t in seconds. */
export interface TimedNode {
  id: string;
  /** seconds, film time */
  from: number;
  to: number;
  /** Mount this many seconds early (video textures, fonts, heavy layouts). Default 0.5. */
  premountS?: number;
  render: (t: number) => React.ReactNode;
}

/** Shared, already-loaded resources every chapter can use while building its spec. */
export interface FilmAssets {
  /** the portrait height map (R relief, G grey, B mask) */
  face: Pixels;
}

/** What a chapter module receives: the one wall, the timed script, the assets. */
export interface FilmCtx {
  board: Board;
  tl: FilmTimeline;
  assets: FilmAssets;
  width: number;
  height: number;
  fps: number;
}

/**
 * Everything one chapter contributes to the film, in ABSOLUTE film seconds.
 * The pin wall, camera and light are one continuous world across chapters: a chapter must
 * start from the state the previous chapter leaves (by default the settled bare wall,
 * `HANDOFF` in ./handoff) and end on it, unless the storyboard asks for a carried state.
 */
export interface ChapterSpec {
  beats: Beat[];
  camera: CameraKey[];
  focus?: FocusKey[];
  light?: LightKey[];
  ripples?: Ripple[];
  magnets?: Magnet[];
  presses?: Press[];
  live?: LiveLayer[];
  /** 3D props inside the World canvas: devices, the constellation, the glass box, particles. */
  world?: TimedNode[];
  /** HTML/SVG layers above the World: cards, code, diagrams, kinetic type, citation chips. */
  overlays?: TimedNode[];
  /** Utterance ids rendered as scene typography instead of bottom captions. */
  captionSkip?: string[];
  /** The guide: Pixie's activity cues, absolute frames. */
  pixie?: PixieCue[];
  sfx?: SfxCue[];
  music?: MusicCue[];
}

export interface ChapterModule {
  id: string;
  build: (ctx: FilmCtx) => ChapterSpec;
}
