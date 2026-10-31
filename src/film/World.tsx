import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {PinStudio, PinWall} from '../engine/pins';
import {CameraRig} from '../engine/camera';
import {PostFX, REEL_LOOK} from '../engine/PostFX';
import type {ChapterSpec, FilmCtx, TimedNode} from './types';

const canvasGl = {antialias: false, powerPreference: 'high-performance' as const, stencil: false, alpha: false};
const dprFor = () => (typeof window === 'undefined' ? 1 : Math.min(1, window.devicePixelRatio || 1));

/** Nodes alive at film time t (mounted `premountS` early so textures and fonts are ready). */
export const activeNodes = (nodes: readonly TimedNode[] | undefined, t: number): TimedNode[] =>
  (nodes ?? []).filter((n) => t >= n.from - (n.premountS ?? 0.5) && t < n.to);

// The one continuous world: every chapter's pin beats, camera, light and 3D props share a
// single canvas and a single lens, so the film never cuts; it re-targets.
export const World: React.FC<{spec: ChapterSpec; ctx: FilmCtx}> = ({spec, ctx}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const nodes = activeNodes(spec.world, t);
  return (
    <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={dprFor()} camera={{fov: 18, near: 0.1, far: 20, position: [0, 0, 2]}}>
      <PinStudio light={spec.light} />
      <CameraRig keys={spec.camera} focus={spec.focus} board={ctx.board} />
      <PinWall
        board={ctx.board}
        beats={spec.beats}
        ripples={spec.ripples}
        magnets={spec.magnets}
        presses={spec.presses}
        live={spec.live}
        glowIntensity={3.0}
      />
      {nodes.map((n) => (
        <React.Fragment key={n.id}>{n.render(t)}</React.Fragment>
      ))}
      <PostFX width={width} height={height} {...REEL_LOOK} motionBlur />
    </ThreeCanvas>
  );
};
