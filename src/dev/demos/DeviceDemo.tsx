import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {DemoSpec} from '../types';
import {PostFX, REEL_LOOK, type ToneMap} from '../../engine/PostFX';
import {color, font, layout, motion, type as typeTokens} from '../../engine/tokens';
import {
  applyPose,
  blendPose,
  DeviceStudio,
  easeCamera,
  easeUi,
  LAPTOP,
  Laptop,
  laptopScreenPose,
  MONITOR,
  Monitor,
  monitorScreenPose,
  orbitPosition,
  PHONE,
  PHONE_STATUS_BAR,
  Phone,
  phoneScreenPose,
  recordings,
  recordingSource,
  type OrbitPose,
  type RecordingName,
} from '../../engine/devices';

type Props = {
  device: 'laptop' | 'phone' | 'monitor';
  recording: RecordingName;
  /** the grade after the scene: PostFX's default AgX, or the pin wall's REEL_LOOK (ACES 0.92) */
  grade?: 'agx' | 'reel';
  /** look overrides for checking the pipeline: glass reflections / glare, post grain / vignette / bloom */
  debug?: {
    reflections?: number;
    glare?: number;
    grain?: number;
    vignette?: number;
    bloom?: number;
    spill?: number;
    dof?: boolean;
    pattern?: boolean;
    power?: number;
    env?: number;
    key?: number;
    hemi?: number;
    rim?: number;
    /** PostFX timing log (console) */
    post?: boolean;
    /** false: render the stale pre-video frame too (for timing comparisons) */
    skipStale?: boolean;
  };
};

const GRADES: Record<NonNullable<Props['grade']>, {toneMapping: ToneMap; exposure: number}> = {
  agx: {toneMapping: 'agx', exposure: 1},
  reel: {toneMapping: REEL_LOOK.toneMapping, exposure: REEL_LOOK.exposure},
};

const LID = 112;

// Shot design per device: start and end camera, and where the rack focus starts and lands
// (screen uv). The focus point travels across the glass, so the plane of focus sweeps from the
// near edge of the screen to the content.
const shots = {
  laptop: () => {
    const pose = laptopScreenPose(LID);
    const c = pose.centre;
    return {
      a: {target: [-0.42, 0.72, -0.55], yaw: -38, pitch: 15, distance: 10.8, fov: 21} as OrbitPose,
      // the screen sits a little high in the end frame, so the credit lands on the chin
      b: {target: [c.x - pose.up.x * 0.13, c.y - pose.up.y * 0.13, c.z - pose.up.z * 0.13], yaw: -8, pitch: 13, distance: 6.6, fov: 21} as OrbitPose,
      focusFrom: [0.0, 0.56] as [number, number],
      focusTo: [0.5, 0.56] as [number, number],
      point: pose.point,
      studio: {contactShadow: {width: LAPTOP.width, depth: LAPTOP.depth}},
    };
  },
  phone: () => {
    const pose = phoneScreenPose();
    const lift = 0.86;
    return {
      // subject right, text left (the film's layout): the camera looks left of the phone
      a: {target: [-0.55, lift, 0], yaw: -34, pitch: 8, distance: 6.4, fov: 21} as OrbitPose,
      b: {target: [-0.42, lift, 0.04], yaw: -8, pitch: 4, distance: 4.3, fov: 21} as OrbitPose,
      focusFrom: [0.0, 0.5] as [number, number],
      focusTo: [0.5, 0.55] as [number, number],
      point: (u: number, v: number, t = new THREE.Vector3()) => pose.point(u, v, t).add(new THREE.Vector3(0, lift, 0)),
      studio: {contactShadow: {width: PHONE.width * 1.6, depth: PHONE.thickness * 6}},
    };
  },
  monitor: () => {
    const pose = monitorScreenPose(MONITOR.aspect, 4);
    const c = pose.centre;
    return {
      a: {target: [-0.6, c.y - 0.4, 0], yaw: -36, pitch: 10, distance: 23, fov: 21} as OrbitPose,
      // the panel fills about 70% of the height and sits high, so the credit lands below the glass
      b: {target: [c.x, c.y - 0.46, c.z], yaw: -8, pitch: 4, distance: 15, fov: 21} as OrbitPose,
      focusFrom: [0.0, 0.5] as [number, number],
      focusTo: [0.5, 0.52] as [number, number],
      point: pose.point,
      studio: {contactShadow: {width: 2.5, depth: 1.9}},
    };
  },
};

const timeline = {
  // camera: one continuous orbit + push-in on the film's camera curve
  cameraFrom: 0,
  cameraTo: 10,
  // focus holds on the edge, racks to the content, then holds
  rackFrom: 3.1,
  rackTo: 5.9,
};

const useShot = (device: Props['device']) => useMemo(() => shots[device](), [device]);

// flat sRGB patches, for checking that the screen shows exactly the colours it is given
export const PATTERN = ['#000000', '#101716', '#050d0c', '#404040', '#808080', '#c0c0c0', '#ffffff', '#74c9ae', '#f67374', '#fbbf24'];
const testPattern = () => {
  const c = document.createElement('canvas');
  c.width = 1000;
  c.height = 100;
  const g = c.getContext('2d')!;
  PATTERN.forEach((hex, i) => {
    g.fillStyle = hex;
    g.fillRect(i * 100, 0, 100, 100);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
};

const Scene: React.FC<Props & {pose: OrbitPose; glare: number}> = ({device, recording, grade = 'agx', pose, glare, debug}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    applyPose(camera, pose);
  }, [camera, pose]);
  const pattern = useMemo(() => (debug?.pattern ? testPattern() : null), [debug?.pattern]);
  const screen = useMemo(
    () =>
      pattern
        ? {texture: pattern, fit: 'fill' as const}
        : recordingSource(recording, {fit: 'cover', inset: device === 'phone' ? {top: PHONE_STATUS_BAR} : undefined, skipStaleRender: debug?.skipStale}),
    [recording, device, pattern, debug?.skipStale],
  );
  const look = useMemo(
    () => ({
      // the screen emits through the inverse of the grade PostFX applies
      tone: GRADES[grade].toneMapping,
      exposure: GRADES[grade].exposure,
      glare: debug?.glare ?? glare,
      ...(debug?.reflections !== undefined ? {reflections: debug.reflections} : {}),
      ...(debug?.power !== undefined ? {power: debug.power} : {}),
    }),
    [glare, debug, grade],
  );
  const shot = useShot(device);
  return (
    <>
      <DeviceStudio
        envIntensity={debug?.env ?? 1}
        keyIntensity={debug?.key ?? 5}
        hemiIntensity={debug?.hemi ?? 0.2}
        rimIntensity={debug?.rim ?? 2.6}
        rimPosition={[-6, 4.8, -7.5]}
        contactShadow={shot.studio.contactShadow}
      />
      {device === 'laptop' ? <Laptop lidAngle={LID} screen={screen} look={look} spill={debug?.spill ?? 1} /> : null}
      {device === 'phone' ? <Phone screen={screen} look={look} position={[0, 0.86, 0]} spill={debug?.spill ?? 1} /> : null}
      {device === 'monitor' ? <Monitor screen={screen} look={look} spill={debug?.spill ?? 1} /> : null}
    </>
  );
};

const SourceCredit: React.FC<{recording: RecordingName}> = ({recording}) => {
  const frame = useCurrentFrame();
  const {fps, height: H, width: W} = useVideoConfig();
  const t = frame / fps;
  const k = easeUi(interpolate(t, [0.7, 0.7 + motion.textFocusPull.inS * 2.2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const blur = (1 - k) * motion.textFocusPull.blurAt1080 * (H / 1080);
  const url = recordings[recording].url.replace(/^https:\/\//, '').replace(/\?film$/, '').replace(/\/$/, '');
  const [host, ...rest] = url.split('/');
  const kicker = typeTokens.monoKicker;
  const chip = typeTokens.monoChip;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(W * layout.marginLeftW),
        bottom: Math.round(H * 0.085),
        opacity: k,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(H * 0.011),
          fontFamily: font.mono,
          fontSize: Math.round(H * kicker.size),
          fontWeight: kicker.weight,
          letterSpacing: `${kicker.tracking}em`,
          lineHeight: kicker.lineHeight,
          textTransform: 'uppercase',
          color: color.accent.mintLabel,
        }}
      >
        <span
          style={{
            width: Math.round(H * 0.0105),
            height: Math.round(H * 0.0105),
            borderRadius: '50%',
            background: color.accent.mint,
            boxShadow: `0 0 ${Math.round(H * 0.012)}px ${color.accent.mintGlow}`,
          }}
        />
        <span>{recording === 'trace' ? 'TRACE' : 'Home'} · live capture{recording === 'homePhone' ? ' · phone' : ''} · 60 fps</span>
      </div>
      <div
        style={{
          marginTop: Math.round(H * 0.012),
          fontFamily: font.mono,
          fontSize: Math.round(H * chip.size),
          fontWeight: chip.weight,
          letterSpacing: `${chip.tracking}em`,
          lineHeight: chip.lineHeight,
          color: color.text.chipDim,
        }}
      >
        {host}/<span style={{color: color.text.key}}>{rest.join('/')}</span>
      </div>
    </div>
  );
};

const DeviceDemoComp: React.FC<Props> = ({device = 'laptop', recording = 'trace', grade = 'agx', debug}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const shot = useShot(device);

  // camera: a pure function of the frame
  const k = easeCamera(interpolate(t, [timeline.cameraFrom, timeline.cameraTo], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const pose = blendPose(shot.a, shot.b, k);

  // rack focus: the focus point slides across the screen from its near edge to the content
  const r = easeCamera(interpolate(t, [timeline.rackFrom, timeline.rackTo], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const fu = shot.focusFrom[0] + (shot.focusTo[0] - shot.focusFrom[0]) * r;
  const fv = shot.focusFrom[1] + (shot.focusTo[1] - shot.focusFrom[1]) * r;
  const camPos = orbitPosition(pose);
  const focusPoint = shot.point(fu, fv);
  const focus = camPos.distanceTo(focusPoint);
  // a thin sharp band while the edge is in focus (the content is clearly soft), widening as the
  // focus lands so the whole tilted screen is sharp at the end while the keyboard stays soft
  const range = (0.3 + 0.04 * pose.distance) * (1 + 1.1 * r);
  // the reflected strip glides over the glass during the orbit, then settles to a trace
  const glare = interpolate(t, [0, 5.5, 8.5], [0.42, 0.42, 0.16], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: color.wall.deep}}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="variance"
        gl={{antialias: false, powerPreference: 'high-performance', stencil: false}}
        camera={{fov: pose.fov ?? 21, near: 0.2, far: 80, position: [0, 2, 10]}}
      >
        <Scene device={device} recording={recording} grade={grade} pose={pose} glare={glare} debug={debug} />
        <PostFX
          width={width}
          height={height}
          focusDistance={debug?.dof === false ? 0 : focus}
          focusRange={range}
          bokehScale={3.4}
          toneMapping={GRADES[grade].toneMapping}
          exposure={GRADES[grade].exposure}
          // devices never bloom (the film's rule: only lit things glow), so the passes are skipped
          bloom={debug?.bloom ?? 0}
          vignette={debug?.vignette ?? 0.62}
          grain={debug?.grain ?? 0.05}
          debug={debug?.post ?? false}
        />
      </ThreeCanvas>
      {/* caption scrim, as in the reel */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, rgba(5,8,7,0) ${layout.captionScrim.fromH * 100}%, rgba(5,8,7,${layout.captionScrim.maxAlpha * 0.8}) 100%)`,
        }}
      />
      <SourceCredit recording={recording} />
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {
  id: 'DeviceDemo',
  component: DeviceDemoComp,
  durationInFrames: 600,
  defaultProps: {device: 'laptop', recording: 'trace', grade: 'agx'},
};
