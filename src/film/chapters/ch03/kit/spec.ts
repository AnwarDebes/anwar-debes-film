import type {Beat, LightKey, LiveLayer, Magnet, Press, Ripple} from '../../../../engine/pins';
import type {CameraKey, FocusKey} from '../../../../engine/camera';
import type {PixieCue} from '../../../../pixie/timeline';
import type {MusicCue, SfxCue} from '../../../../engine/audio/types';
import type {ChapterSpec, TimedNode} from '../../../types';

/** Collects a chapter's contributions scene by scene, then hands back one ChapterSpec. */
export class SpecAcc {
  beats: Beat[] = [];
  camera: CameraKey[] = [];
  focus: FocusKey[] = [];
  light: LightKey[] = [];
  ripples: Ripple[] = [];
  magnets: Magnet[] = [];
  presses: Press[] = [];
  live: LiveLayer[] = [];
  world: TimedNode[] = [];
  overlays: TimedNode[] = [];
  captionSkip: string[] = [];
  pixie: PixieCue[] = [];
  sfx: SfxCue[] = [];
  music: MusicCue[] = [];

  constructor(readonly prefix: string) {}

  /** prefix an id with the chapter's namespace ("c03-") */
  id(s: string) {
    return `${this.prefix}${s}`;
  }

  beat(b: Omit<Beat, 'id'> & {id: string}) {
    this.beats.push({...b, id: this.id(b.id)});
  }

  overlay(n: Omit<TimedNode, 'id'> & {id: string}) {
    this.overlays.push({...n, id: this.id(n.id)});
  }

  prop(n: Omit<TimedNode, 'id'> & {id: string}) {
    this.world.push({...n, id: this.id(n.id)});
  }

  spec(): ChapterSpec {
    return {
      beats: this.beats,
      camera: this.camera,
      focus: this.focus,
      light: this.light,
      ripples: this.ripples,
      magnets: this.magnets,
      presses: this.presses,
      live: this.live,
      world: this.world,
      overlays: this.overlays,
      captionSkip: this.captionSkip,
      pixie: this.pixie,
      sfx: this.sfx,
      music: this.music,
    };
  }
}
