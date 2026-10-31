import type {CameraPose} from '../../../engine/camera';
import type {Board} from '../../../engine/pins';
import type {FilmCtx} from '../../types';
import type {Clock} from './kit/time';
import type {SpecAcc} from './kit/spec';

/** What every scene builder of a chapter receives. */
export interface SceneKit {
  ctx: FilmCtx;
  board: Board;
  aspect: number;
  c: Clock;
  acc: SpecAcc;
  /** the hand-off pose the chapter starts and ends on */
  home: CameraPose;
}
