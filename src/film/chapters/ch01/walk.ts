import walk from '../../../data/ch01/walk.json';
import type {FilmTimeline} from '../../timeline';

// The 66 repositories in the order of the walk, and when each one's rule-line pin lights: the
// moment its name plate first appears. Chapters 01, 02 and 14 place their own plates (overrides);
// every other place lights shortly after the start of the first scene that shows it.

export interface WalkRepo {
  n: number;
  repo: string;
  chapter: string;
  scene: string;
}

export const WALK: readonly WalkRepo[] = walk.repos as WalkRepo[];
export const WALK_N = WALK.length;

/** Plate times of the places these chapters build, from the timeline (s, film time). */
export type PlateTimes = Partial<Record<string, number>>;

const DEFAULT_DELAY_S = 0.9;

/** Film time at which each walk repo's rule-line pin lights, in walk order. */
export const ruleLitTimes = (tl: FilmTimeline, plates: PlateTimes): number[] =>
  WALK.map((r) => plates[r.repo] ?? tl.scene(r.scene).start + DEFAULT_DELAY_S);

/** How many rule-line pins are lit at time t (times in walk order are non-decreasing in practice). */
export const litCount = (times: readonly number[], t: number): number => {
  let n = 0;
  for (const x of times) if (x <= t) n++;
  return n;
};
