import React from 'react';
import {frameOn, type CameraPose} from '../../../engine/camera';
import {CitationChip} from '../../../engine/type';
import type {Env} from './env';
import {Plate} from './kit/ui';

// Small builders every scene uses: framing, chips in their lane, plates, beats.

/** A pose framing a wall uv at a screen point. */
export const frame = (env: Env, uv: [number, number], pinsAcross = 150, screen: [number, number] = [0.5, 0.5], yaw = 0.12, pitch = 0.06): CameraPose =>
  frameOn(env.board, {uv, pinsAcross, screen, yaw, pitch, aspect: env.aspect});

/** The chip lane: right-aligned at the right margin, slot 0 just above the captions. */
export const CHIP_SLOTS = [0.797, 0.751, 0.705, 0.659];

export const chip = (env: Env, id: string, repo: string, path: string, line: string | number | undefined, at: number, exitAt: number, slot = 0) => {
  const {W, H} = env;
  env.top.push({
    id,
    from: at,
    to: exitAt + 0.4,
    render: (t) => (
      <CitationChip repo={repo} path={path} line={line} at={at} exitAt={exitAt} t={t} x={Math.round(0.931 * W)} y={Math.round(CHIP_SLOTS[slot] * H)} align="right" sizeH={0.022} />
    ),
  });
};

/** A name plate + status chip, and the place's rule-line pin. */
export const plate = (env: Env, id: string, name: string, status: string, at: number, exitAt: number) => {
  env.arrivals.push(at);
  env.overlays.push({id, from: at, to: exitAt + 0.4, render: (t) => <Plate t={t} name={name} status={status} at={at} exitAt={exitAt} />});
};

/** A camera move. */
export const move = (env: Env, at: number, dur: number, pose: CameraPose, ease: 'camera' | 'inOutSine' | 'ui' = 'camera') => {
  env.camera.push({at, dur, pose, ease});
};
