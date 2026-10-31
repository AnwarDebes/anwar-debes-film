import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Sequence, cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {Laptop, Monitor, Phone, PHONE_STATUS_BAR, laptopScreenPose, monitorScreenPose, phoneScreenPose, type ScreenSource} from '../../../../engine/devices';
import {posePosition, rigPoseAt, type CameraKey} from '../../../../engine/camera';
import {REEL_LOOK} from '../../../../engine/PostFX';
import {easeCamera, easeUI, prog} from '../../../../engine/type';

// Devices held in front of the wall, placed in the camera's frame so a phone or a laptop lands
// exactly where the layout wants it while the wall keeps its own depth behind. They stand upright
// (world up) and turn to the lens; swing-in and swing-out are a yaw plus a slide, eased.

export type DeviceKind = 'phone' | 'laptop' | 'monitor';

export interface Hold {
  /** display centre on screen, 0..1 from the top left */
  sx: number;
  sy: number;
  /** display height as a fraction of the frame height */
  h: number;
  /** extra yaw in radians (+ turns the screen to the left of frame) */
  yaw?: number;
}

export interface DeviceShot {
  kind: DeviceKind;
  /** film seconds: swing in starts, swing out ends */
  from: number;
  to: number;
  /** where it rests; keyframes (film time) let it move between holds */
  holds: Array<{at: number; dur?: number; hold: Hold}>;
  /** the recording on its screen: a file in public/, its pixel size and length in frames */
  rec?: {src: string; size: [number, number]; frames: number; startAt: number};
  /** a still image on its screen instead */
  still?: {src: string; size: [number, number]};
  /** from this film time on, show this still instead of the recording (keeps one video at a time) */
  swapToStill?: {at: number; src: string; size: [number, number]};
  inS?: number;
  outS?: number;
  /** distance from the lens as a fraction of the camera's target distance */
  depth?: number;
  /** a calmer glass for a device whose screen catches a studio light */
  look?: {glare?: number; reflections?: number};
}

const DEVICE_LOOK = {tone: REEL_LOOK.toneMapping, exposure: REEL_LOOK.exposure, glare: 0.14, reflections: 0.25, bloom: 0} as const;
const LID = 104;

const displayOf = (kind: DeviceKind) => {
  if (kind === 'phone') return phoneScreenPose();
  if (kind === 'laptop') return laptopScreenPose(LID);
  return monitorScreenPose(16 / 10, 3);
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The hold in effect at time t (eased between keys). */
const holdAt = (shot: DeviceShot, t: number): Hold => {
  const hs = shot.holds;
  let cur = hs[0].hold;
  for (let k = 1; k < hs.length; k++) {
    const key = hs[k];
    if (t < key.at) break;
    const e = easeCamera(prog(t, key.at, key.dur ?? 1));
    const prev = cur;
    cur = {
      sx: lerp(prev.sx, key.hold.sx, e),
      sy: lerp(prev.sy, key.hold.sy, e),
      h: lerp(prev.h, key.hold.h, e),
      yaw: lerp(prev.yaw ?? 0, key.hold.yaw ?? 0, e),
    };
  }
  return cur;
};

const _cam = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Group transform for a device at time t: position, yaw and uniform scale. */
export const devicePlacement = (shot: DeviceShot, keys: readonly CameraKey[], t: number, aspect: number) => {
  const pose = rigPoseAt(keys, t);
  posePosition(pose, _cam);
  _tgt.set(pose.target[0], pose.target[1], pose.target[2]);
  _f.copy(_tgt).sub(_cam).normalize();
  _r.copy(_f).cross(UP).normalize();
  _u.copy(_r).cross(_f).normalize();
  const dist = pose.distance * (shot.depth ?? 0.62);
  const fh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2);
  const fw = fh * aspect;
  const h = holdAt(shot, t);
  // swing in from the right and turned away, swing out the same way
  const kin = easeUI(prog(t, shot.from, shot.inS ?? 0.7));
  const kout = easeCamera(prog(t, shot.to - (shot.outS ?? 0.6), shot.outS ?? 0.6));
  const away = (1 - kin) + kout;
  const sx = h.sx + 0.34 * away;
  const yawSwing = 0.95 * away;
  _d.copy(_cam)
    .addScaledVector(_f, dist)
    .addScaledVector(_r, (sx - 0.5) * fw)
    .addScaledVector(_u, (0.5 - h.sy) * fh);
  const disp = displayOf(shot.kind);
  const scale = (h.h * fh) / disp.height;
  const yaw = Math.atan2(_cam.x - _d.x, _cam.z - _d.z) + (h.yaw ?? 0) + yawSwing;
  // the display centre lands on _d
  _c.copy(disp.centre).multiplyScalar(scale).applyAxisAngle(UP, yaw);
  return {position: [_d.x - _c.x, _d.y - _c.y, _d.z - _c.z] as [number, number, number], yaw, scale, visible: away < 0.999};
};

const DeviceBody: React.FC<{shot: DeviceShot; keys: readonly CameraKey[]; t: number; aspect: number}> = ({shot, keys, t, aspect}) => {
  const screen = useMemo<ScreenSource | undefined>(() => {
    if (shot.rec) {
      return {
        src: staticFile(shot.rec.src),
        size: shot.rec.size,
        durationInFrames: shot.rec.frames,
        fit: 'cover',
        inset: shot.kind === 'phone' ? {top: PHONE_STATUS_BAR} : undefined,
      };
    }
    return undefined;
  }, [shot.rec, shot.kind]);
  const stillTex = useStillTexture(shot.still?.src);
  const look = useMemo(() => (shot.look ? {...DEVICE_LOOK, ...shot.look} : DEVICE_LOOK), [shot.look]);
  const p = devicePlacement(shot, keys, t, aspect);
  if (!p.visible || (shot.still && !stillTex)) return null;
  const src: ScreenSource | undefined = screen ?? (stillTex ? {texture: stillTex, fit: 'cover', size: shot.still?.size} : undefined);
  const common = {position: p.position, rotation: [0, p.yaw, 0] as [number, number, number], scale: p.scale, look, screen: src, spill: 0.4, castShadow: false};
  if (shot.kind === 'phone') return <Phone {...common} />;
  if (shot.kind === 'laptop') return <Laptop {...common} lidAngle={LID} />;
  return <Monitor {...common} tilt={3} />;
};

/** A still image as a screen texture, loaded once (the render holds until it is decoded). */
const stills = new Map<string, THREE.Texture>();
const pendingStills = new Map<string, Promise<THREE.Texture>>();
const loadStill = (src: string): Promise<THREE.Texture> => {
  let p = pendingStills.get(src);
  if (!p) {
    p = new Promise<THREE.Texture>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        stills.set(src, tex);
        resolve(tex);
      };
      img.onerror = () => reject(new Error(`could not load ${src}`));
      img.src = staticFile(src);
    });
    pendingStills.set(src, p);
  }
  return p;
};
const useStillTexture = (src?: string): THREE.Texture | null => {
  const [, bump] = useState(0);
  const advance = useThree((st) => st.advance);
  const tex = src ? stills.get(src) ?? null : null;
  const hold = useRef<number | null>(null);
  if (src && !tex && hold.current === null) hold.current = delayRender(`still texture ${src}`);
  useLayoutEffect(() => {
    if (!src || tex) return;
    let live = true;
    loadStill(src).then(
      () => {
        if (live) bump((n) => n + 1);
      },
      (e) => cancelRender(e),
    );
    return () => {
      live = false;
    };
  }, [src, tex]);
  useEffect(() => {
    if (tex && hold.current !== null) {
      // the canvas renders once per frame on its own; draw again now that the screen has content,
      // so the captured frame has it (as DeviceScreen does for each decoded video frame)
      advance(performance.now());
      continueRender(hold.current);
      hold.current = null;
    }
  }, [tex, advance]);
  useEffect(
    () => () => {
      if (hold.current !== null) continueRender(hold.current);
      hold.current = null;
    },
    [],
  );
  return tex;
};

/**
 * The device as a World node. Its recording starts at `rec.startAt` (film seconds), through a
 * Sequence so the video's frame 0 is that film frame.
 */
export const DeviceNode: React.FC<{shot: DeviceShot; keys: readonly CameraKey[]; t: number; fps: number; aspect: number}> = ({shot, keys, t, fps, aspect}) => {
  if (shot.rec && shot.swapToStill && t >= shot.swapToStill.at) {
    const {src, size} = shot.swapToStill;
    return <DeviceBody shot={{...shot, rec: undefined, still: {src, size}}} keys={keys} t={t} aspect={aspect} />;
  }
  if (shot.rec) {
    const from = Math.round(shot.rec.startAt * fps);
    return (
      <Sequence from={from} layout="none" name={`device ${shot.kind}`}>
        <DeviceBody shot={shot} keys={keys} t={t} aspect={aspect} />
      </Sequence>
    );
  }
  return <DeviceBody shot={shot} keys={keys} t={t} aspect={aspect} />;
};
