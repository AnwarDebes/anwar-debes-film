// Pixie, the 2D renderer: an SVG of integer device rects (pixie.md 8.11).
// Every rect is painted exactly as mascot.js paints it, via toDevice:
// x = round(x * u), y = round(y * u), w = ceil(w * u), h = ceil(h * u).
// The background is transparent; place the box at whole px and never scale it.

import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SCENE_H, SCENE_W, toDevice, type PixieState} from './pixie-core';
import {pixiePose, type PixiePoseInput} from './pose';
import {resolveTimeline, type Facing, type PixieCue, type PixieTimeline, type PixieWalk} from './timeline';
import {
  assembleShadow,
  blockAt,
  decompose,
  disperseShadow,
  MIN_FLIGHT_COVERAGE,
  planAssemble,
  planDisperse,
  type Decomposition,
  type DeviceRect,
  type ScatterPlan,
} from './assemble';

export interface PixieProps {
  /** Fixed pose; ignored when `cues` or `timeline` is given. */
  state?: PixieState;
  /** Absolute frames, resolved by the canonical state machine (memoised for the film). */
  cues?: readonly PixieCue[];
  /** A timeline already resolved with resolveTimeline (shared with the card). */
  timeline?: PixieTimeline | null;
  /** Box width in px; cell u = max(1, floor(size / 34)); box = 34u x 32u. */
  size?: number;
  /** Integer px per scene cell; overrides size. */
  cell?: number;
  /** Seconds added to t (phase continuity across cuts). t is kept >= 0. */
  timeOffset?: number;
  /** Absolute frame. Default useCurrentFrame(), which restarts inside a <Sequence>. */
  frame?: number;
  /** 'right' is the canonical drawing. */
  facing?: Facing;
  /** Blink seed. Default 'pixie'. */
  seed?: string;
  /** The canonical static path (t = 0, no blinking). */
  reducedMotion?: boolean;
  /** Walk with the existing legs and bob; the box moves by round(dx * u) px. */
  walk?: PixieWalk | readonly PixieWalk[];
  /** The floor shadow is part of the design. Default true. */
  shadow?: boolean;
  /** Force the leg formula ('scurry' = the running/searching wave). */
  gait?: 'state' | 'scurry';
  /** Entrance: absolute frame the pixel squares appear; Pixie lands enterDuration later. */
  enterAt?: number;
  /** Seconds. Default 1.2. */
  enterDuration?: number;
  /** Exit: absolute frame Pixie starts dispersing into pixel squares. */
  exitAt?: number;
  /** Seconds. Default 0.8. */
  exitDuration?: number;
  style?: React.CSSProperties;
  className?: string;
}

/** Integer px per scene cell from the size props (default size 340, u = 10). */
export const pixieCell = (p: Pick<PixieProps, 'cell' | 'size'>): number =>
  Math.max(1, Math.floor(p.cell ?? Math.floor((p.size ?? 340) / SCENE_W)));

type Phase =
  | {kind: 'hidden'}
  | {kind: 'live'}
  | {kind: 'assemble'; s: number; at: number}
  | {kind: 'disperse'; s: number; at: number};

export const pixiePhase = (
  frame: number,
  fps: number,
  enterAt: number | undefined,
  enterDuration: number,
  exitAt: number | undefined,
  exitDuration: number,
): Phase => {
  if (exitAt !== undefined && frame >= exitAt) {
    const s = (frame - exitAt) / fps;
    return s >= exitDuration ? {kind: 'hidden'} : {kind: 'disperse', s, at: exitAt};
  }
  if (enterAt !== undefined) {
    if (frame < enterAt) return {kind: 'hidden'};
    const land = enterAt + Math.round(enterDuration * fps);
    if (frame < land) return {kind: 'assemble', s: (frame - enterAt) / fps, at: land};
  }
  return {kind: 'live'};
};

const Rects: React.FC<{rects: ReadonlyArray<readonly [number, number, number, number, string, ...unknown[]]>}> = ({
  rects,
}) => (
  <>
    {rects.map((r, i) => (
      <rect key={i} x={r[0]} y={r[1]} width={r[2]} height={r[3]} fill={r[4]} />
    ))}
  </>
);

const Blocks: React.FC<{d: Decomposition; plan: ScatterPlan; s: number; u: number}> = ({d, plan, s, u}) => (
  <>
    {d.blocks.map((b, k) => {
      const st = blockAt(plan, k, s, b.coverage >= MIN_FLIGHT_COVERAGE);
      if (st.opacity <= 0.001) return null;
      const opacity = st.opacity < 1 ? st.opacity : undefined;
      if (!st.exact) {
        return <rect key={k} x={b.x + st.dx} y={b.y + st.dy} width={u} height={u} fill={b.fill} opacity={opacity} />;
      }
      return (
        <g key={k} opacity={opacity}>
          <Rects rects={b.rects} />
        </g>
      );
    })}
  </>
);

/** A frozen frame cut into pixel blocks, with its scatter plan. */
const useFrozen = (
  at: number | null,
  mode: 'assemble' | 'disperse',
  duration: number,
  u: number,
  pose: Omit<PixiePoseInput, 'frame'>,
  deps: unknown[],
) =>
  useMemo(() => {
    if (at === null) return null;
    const p = pixiePose({...pose, frame: at});
    const dev = toDevice(p.rects, u) as DeviceRect[];
    const d = decompose(dev, u);
    const seed = `${pose.seed ?? 'pixie'}-${at}`;
    const plan = mode === 'assemble' ? planAssemble(d, u, seed, duration) : planDisperse(d, u, seed, duration);
    return {d, plan, dxPx: Math.round(p.dx * u)};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, mode, duration, u, ...deps]);

export const Pixie: React.FC<PixieProps> = (p) => {
  const {fps} = useVideoConfig();
  const current = useCurrentFrame();
  const frame = p.frame ?? current;
  const u = pixieCell(p);
  const timeline = useMemo(
    () => p.timeline ?? (p.cues ? resolveTimeline(p.cues, fps) : null),
    [p.timeline, p.cues, fps],
  );
  const poseIn: Omit<PixiePoseInput, 'frame'> = {
    fps,
    state: p.state,
    timeline,
    timeOffset: p.timeOffset,
    seed: p.seed,
    facing: p.facing,
    walk: p.walk,
    reducedMotion: p.reducedMotion,
    shadow: p.shadow,
    gait: p.gait,
  };
  const deps = [fps, p.state, timeline, p.timeOffset, p.seed, p.facing, p.walk, p.reducedMotion, p.shadow, p.gait];
  const enterDuration = p.enterDuration ?? 1.2;
  const exitDuration = p.exitDuration ?? 0.8;
  const phase = pixiePhase(frame, fps, p.enterAt, enterDuration, p.exitAt, exitDuration);
  const assembled = useFrozen(phase.kind === 'assemble' ? phase.at : null, 'assemble', enterDuration, u, poseIn, deps);
  const dispersed = useFrozen(phase.kind === 'disperse' ? phase.at : null, 'disperse', exitDuration, u, poseIn, deps);

  const W = SCENE_W * u;
  const H = SCENE_H * u;
  let content: React.ReactNode = null;
  let dxPx = 0;
  if (phase.kind === 'live') {
    const pose = pixiePose({...poseIn, frame});
    dxPx = Math.round(pose.dx * u);
    content = <Rects rects={toDevice(pose.rects, u)} />;
  } else if (phase.kind === 'assemble' && assembled) {
    dxPx = assembled.dxPx;
    const so = assembleShadow(phase.s, enterDuration);
    content = (
      <>
        {so > 0.001 ? (
          <g opacity={so < 1 ? so : undefined}>
            <Rects rects={assembled.d.shadow} />
          </g>
        ) : null}
        <Blocks d={assembled.d} plan={assembled.plan} s={phase.s} u={u} />
      </>
    );
  } else if (phase.kind === 'disperse' && dispersed) {
    dxPx = dispersed.dxPx;
    const so = disperseShadow(phase.s, exitDuration);
    content = (
      <>
        {so > 0.001 ? (
          <g opacity={so < 1 ? so : undefined}>
            <Rects rects={dispersed.d.shadow} />
          </g>
        ) : null}
        <Blocks d={dispersed.d} plan={dispersed.plan} s={phase.s} u={u} />
      </>
    );
  }
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      shapeRendering="crispEdges"
      className={p.className}
      style={{display: 'block', overflow: 'visible', ...p.style}}
    >
      {content ? <g transform={dxPx ? `translate(${dxPx} 0)` : undefined}>{content}</g> : null}
    </svg>
  );
};
