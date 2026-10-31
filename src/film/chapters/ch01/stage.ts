import {frameOn, rigPoseAt, projectToScreen, type CameraKey, type CameraPose, type FrameSpec} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type Board} from '../../../engine/pins';
import type {ChapterSpec, FilmCtx} from '../../types';

// Plumbing shared by the scene builders of chapters 01, 02 and 14: the handoff pose, board
// coordinates, merging scene parts into one chapter spec, and screen positions of wall points.

export type Part = Partial<ChapterSpec>;

export interface Stage {
  ctx: FilmCtx;
  board: Board;
  W: number;
  H: number;
  fps: number;
  aspect: number;
  /** world height of h = 1 */
  relief: number;
  /** the bare-wall pose every chapter starts and ends on (the placeholder's) */
  P0: CameraPose;
  f: (s: number) => number;
}

export const makeStage = (ctx: FilmCtx): Stage => {
  const aspect = ctx.width / ctx.height;
  return {
    ctx,
    board: ctx.board,
    W: ctx.width,
    H: ctx.height,
    fps: ctx.fps,
    aspect,
    relief: DEFAULT_RELIEF_PITCHES * ctx.board.p,
    P0: frameOn(ctx.board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect}),
    f: (s) => Math.round(s * ctx.fps),
  };
};

export const pose = (st: Stage, spec: FrameSpec): CameraPose => frameOn(st.board, {aspect: st.aspect, ...spec});

/** World x, y of a board uv point. */
export const wxy = (b: Board, u: number, v: number): [number, number] => [u - 0.5, v * b.extH - b.extH / 2];

/** Merge scene parts into one chapter spec (arrays concatenated). */
export const mergeParts = (parts: Part[]): ChapterSpec => {
  const out: ChapterSpec = {beats: [], camera: [], focus: [], light: [], ripples: [], magnets: [], presses: [], live: [], world: [], overlays: [], captionSkip: [], pixie: []};
  for (const p of parts) {
    for (const k of Object.keys(out) as Array<keyof ChapterSpec>) {
      const v = p[k];
      if (Array.isArray(v)) (out[k] as unknown[]).push(...(v as unknown[]));
    }
  }
  return out;
};

/** Screen position (px) of a point on the wall at time t, for a camera key list. */
export const screenOf = (st: Stage, keys: readonly CameraKey[], t: number, u: number, v: number, z = 0): [number, number] => {
  const p = rigPoseAt(keys, t);
  const [x, y] = wxy(st.board, u, v);
  const s = projectToScreen(p, [x, y, z], st.W, st.H);
  return [s[0], s[1]];
};
