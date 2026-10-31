import React from 'react';
import {Dust} from '../../../engine/fx';
import type {CameraKey} from '../../../engine/camera';
import type {Board} from '../../../engine/pins';
import type {TimedNode} from '../../types';
import {DeviceNode, type DeviceShot} from './kit/devices';

/** A device shot as a World node (camera-locked placement, recording through a Sequence). */
export const deviceNode = (id: string, shot: DeviceShot, keys: readonly CameraKey[], fps: number, aspect: number): TimedNode => {
  // a recording never plays past its last frame: the device leaves before it would freeze
  const end = shot.rec && !shot.swapToStill ? Math.min(shot.to, shot.rec.startAt + shot.rec.frames / fps - 0.05) : shot.to;
  const s: DeviceShot = {...shot, to: end};
  return {
    id,
    from: s.from,
    to: s.to,
    premountS: 0.6,
    render: (t) => <DeviceNode shot={s} keys={keys} t={t} fps={fps} aspect={aspect} />,
  };
};

/** Warm dust in front of the wall (the cookie flight answered by the wall's own particles). */
export const dustNode = (id: string, from: number, to: number, board: Board, centre: [number, number, number]): TimedNode => ({
  id,
  from,
  to,
  premountS: 0.3,
  render: (t) => {
    const fadeIn = Math.min(1, Math.max(0, (t - from) / 0.9));
    const fadeOut = Math.min(1, Math.max(0, (to - t) / 0.9));
    void board;
    return (
      <Dust
        count={2600}
        box={[0.95, 0.55, 0.5]}
        center={centre}
        drift={[0.004, 0.006, 0.0]}
        wander={0.01}
        size={[0.0009, 0.0026]}
        brightness={1.6}
        colors={['#E8A24C', '#cdb9a0']}
        twinkle={0.4}
        bloom={0.6}
        opacity={Math.min(fadeIn, fadeOut) * 0.85}
        seed={1023}
      />
    );
  },
});
