import React, {useMemo} from 'react';
import {Freeze, staticFile} from 'remotion';
import * as THREE from 'three';
import {Laptop, laptopScreenPose, Monitor, monitorScreenPose, MONITOR, type ScreenLook, type ScreenSource} from '../../../../engine/devices';
import {applyPose, type CameraPose} from '../../../../engine/camera';
import {easeCamera} from '../../../../engine/type';
import {clamp01} from './ui';

// A device in front of the wall, showing a frame-exact recording of a live demo. The recording's
// own events (a step, a verify) are placed on spoken words by a piecewise time remap, so a re-timed
// narration moves the page with it: after each event the clip plays on in real time, then holds.

export interface Clip {
  /** path in public/ */
  src: string;
  size: [number, number];
  frames: number;
  fps: number;
}

export interface RemapKey {
  /** film time the event should land on */
  film: number;
  /** recording time of the event (s) */
  rec: number;
}

/** Recording frame for film time t. Before the first key the clip holds its first event's lead-in. */
export const remapper = (keys: readonly RemapKey[], clip: Clip) => {
  const ks = [...keys].sort((a, b) => a.film - b.film);
  const last = clip.frames - 1;
  return (t: number): number => {
    if (!ks.length) return 0;
    if (t < ks[0].film) {
      // lead-in: hold the frame just before the first event
      return Math.max(0, Math.round(ks[0].rec * clip.fps) - 1);
    }
    let k = 0;
    for (let i = 0; i < ks.length; i++) if (ks[i].film <= t) k = i;
    const next = ks[k + 1];
    const maxRun = next ? Math.max(0, next.rec - ks[k].rec - 1 / clip.fps) : Infinity;
    const rec = ks[k].rec + Math.min(t - ks[k].film, maxRun);
    return Math.min(last, Math.max(0, Math.round(rec * clip.fps)));
  };
};

const _cam = new THREE.PerspectiveCamera();
const _v = new THREE.Vector3();

/** The world point on the ray through screen point (sx, sy) (0..1 from top-left), `depth` in front of the wall plane z = zPlane. */
export const pointOnScreen = (pose: CameraPose, sx: number, sy: number, zPlane: number, aspect: number): [number, number, number] => {
  applyPose(_cam, pose, aspect);
  _v.set(sx * 2 - 1, 1 - sy * 2, 0.5).unproject(_cam).sub(_cam.position).normalize();
  const o = _cam.position;
  const s = (zPlane - o.z) / _v.z;
  return [o.x + _v.x * s, o.y + _v.y * s, zPlane];
};

export interface DeviceMotion {
  enterAt: number;
  enterS?: number;
  exitAt?: number;
  exitS?: number;
  /** 'swing' hinges in from edge-on; 'rise' comes up from below the frame; 'none' cuts on */
  enter?: 'swing' | 'rise' | 'none';
  exit?: 'swing' | 'sink' | 'none';
  /** gentle drift while it holds (radians of yaw over the hold) */
  drift?: number;
  /** the side it swings in from and out to (default right) */
  side?: 'left' | 'right';
}

export interface DevicePropProps {
  t: number;
  kind: 'laptop' | 'monitor';
  clip: Clip;
  recFrame: number;
  /** world position of the screen centre */
  at: [number, number, number];
  /** resting rotation (x tilt, y yaw) */
  rest: [number, number];
  /** world width of the active screen area */
  screenWidth: number;
  motion: DeviceMotion;
  /** 0..1.2 display brightness (dims the page under a payoff) */
  brightness?: number;
  crop?: ScreenSource['crop'];
  lid?: number;
}

export const DeviceProp: React.FC<DevicePropProps> = ({t, kind, clip, recFrame, at, rest, screenWidth, motion, brightness = 1, crop, lid = 104}) => {
  const screen = useMemo<ScreenSource>(
    () => ({src: staticFile(clip.src), size: clip.size, durationInFrames: clip.frames, fit: 'cover', crop}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clip.src, clip.size[0], clip.size[1], clip.frames, crop?.x, crop?.y, crop?.width, crop?.height],
  );
  const bq = Math.round(brightness * 100) / 100;
  const look = useMemo<ScreenLook>(() => ({tone: 'aces', exposure: 0.92, brightness: bq, glare: 0.16, reflections: 0.22, viewFalloff: 0.15, bloom: 0}), [bq]);
  const geo = useMemo(() => {
    if (kind === 'laptop') {
      const p = laptopScreenPose(lid);
      return {centre: p.centre.clone(), width: p.width};
    }
    const p = monitorScreenPose(MONITOR.aspect, 3);
    return {centre: p.centre.clone(), width: p.width};
  }, [kind, lid]);
  const scale = screenWidth / geo.width;

  // entry and exit: a hinge swing from edge-on (or a rise), on the film's camera curve
  const enterS = motion.enterS ?? 0.9;
  const exitS = motion.exitS ?? 0.8;
  const kin = motion.enter === 'none' ? (t >= motion.enterAt ? 1 : 0) : easeCamera(clamp01((t - motion.enterAt) / enterS));
  const kout = motion.exitAt === undefined || motion.exit === 'none' ? (motion.exitAt !== undefined && t >= motion.exitAt ? 1 : 0) : easeCamera(clamp01((t - motion.exitAt) / exitS));
  const visible = t >= motion.enterAt && kout < 1;
  const sgn = motion.side === 'left' ? -1 : 1;
  const swingIn = motion.enter === 'rise' ? 0 : (1 - kin) * 1.25 * sgn;
  const swingOut = motion.exit === 'sink' ? 0 : kout * -1.15 * sgn;
  const riseIn = motion.enter === 'rise' ? (1 - kin) * -0.32 * screenWidth * 1.6 : 0;
  const sinkOut = motion.exit === 'sink' ? kout * -0.32 * screenWidth * 1.6 : 0;
  const slide = ((1 - kin) * 0.55 * screenWidth + kout * 0.5 * screenWidth) * sgn;
  const hold = motion.drift ? motion.drift * clamp01((t - motion.enterAt - enterS) / 12) : 0;
  const ry = rest[1] + swingIn + swingOut + hold;
  const rx = rest[0];

  return (
    <group position={[at[0] + slide, at[1] + riseIn + sinkOut, at[2]]} rotation={[rx, ry, 0]} scale={scale} visible={visible}>
      <Freeze frame={recFrame} active>
        {kind === 'laptop' ? (
          <Laptop lidAngle={lid} screen={screen} look={look} spill={0} castShadow={false} position={[-geo.centre.x, -geo.centre.y, -geo.centre.z]} />
        ) : (
          <Monitor screen={screen} look={look} spill={0} castShadow={false} tilt={3} position={[-geo.centre.x, -geo.centre.y, -geo.centre.z]} />
        )}
      </Freeze>
    </group>
  );
};
