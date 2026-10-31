import React from 'react';
import * as THREE from 'three';
import {Freeze, staticFile, useVideoConfig} from 'remotion';
import {Laptop, laptopScreenPose} from '../../../engine/devices';
import {applyPose, apertureForBlur, pushIn, type CameraKey, type CameraPose, type FocusKey} from '../../../engine/camera';
import {REEL_LOOK} from '../../../engine/PostFX';
import {color, font, layout, type as Ty} from '../../../engine/tokens';
import {easeInCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import {presetCell} from '../../../pixie';
import type {FilmCtx, TimedNode} from '../../types';
import {poseOn} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {Cite, mono, pullK, pullStyle, sans} from './kit/ui';
import {GuideAt, GuideCard} from './kit/guide';
import {REC, sessionMap, type SessionMap} from './session';
import type {Times07} from './times';

// 07.4 One recorded session, at its real speed: a laptop swings in with the frame-stepped capture
// of the live demo (the unmodified web UI replaying demo/session.js); the guide leaves its corner
// box and acts the session out at featured size; a strip under the screen sets the lines that
// matter in the film's own type.

const LID = 112;
const SRC = 'recordings/ch07-ccim-replay.mp4';

interface Placement {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: number;
  center: THREE.Vector3;
  axisUp: THREE.Vector3;
}

/** Put the laptop's display at a screen rectangle (fractions of the frame), facing the lens. */
const placeLaptop = (pose: CameraPose, aspect: number, o: {cx: number; cy: number; widthFrac: number; z: number; turn: number}): Placement => {
  const cam = new THREE.PerspectiveCamera();
  applyPose(cam, pose, aspect);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(o.cx * 2 - 1, 1 - o.cy * 2), cam);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -o.z);
  const center = new THREE.Vector3();
  ray.ray.intersectPlane(plane, center);
  const dist = center.distanceTo(cam.position);
  const frameW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(pose.fov) / 2) * aspect;
  const lp = laptopScreenPose(LID);
  const scale = (o.widthFrac * frameW) / lp.width;
  // the display faces the lens, turned a little toward the frame centre
  const n = cam.position.clone().sub(center).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), o.turn);
  const worldUp = new THREE.Vector3(0, 1, 0);
  const up = worldUp.clone().sub(n.clone().multiplyScalar(worldUp.dot(n))).normalize();
  const right = new THREE.Vector3().crossVectors(up, n).normalize();
  const Bd = new THREE.Matrix4().makeBasis(right, up, n);
  const Bl = new THREE.Matrix4().makeBasis(lp.right.clone(), lp.up.clone(), lp.normal.clone());
  const R = Bd.multiply(Bl.transpose());
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(R);
  const offset = lp.centre.clone().multiplyScalar(scale).applyQuaternion(quaternion);
  const position = center.clone().sub(offset);
  return {position, quaternion, scale, center, axisUp: up};
};

const LaptopNode: React.FC<{t: number; P: Placement; m: SessionMap; swingIn: number; swingOut: number}> = ({t, P, m, swingIn, swingOut}) => {
  const recFrame = Math.max(0, Math.min(REC.frames - 1, Math.round(m.rec(t) * REC.fps)));
  // swing in from edge-on about the display's vertical axis, slide out to the right
  const kin = easeOutCubic(prog(t, swingIn, 0.95));
  const kout = easeInCubic(prog(t, swingOut, 0.75));
  const swing = (1 - kin) * 1.15 - kout * 0.5;
  const q = new THREE.Quaternion().setFromAxisAngle(P.axisUp, swing).multiply(P.quaternion);
  // rotate about the display centre, not the laptop's feet
  const pos = P.position.clone().sub(P.center).applyQuaternion(P.quaternion.clone().invert()).applyQuaternion(q).add(P.center);
  pos.x += (1 - kin) * 0.12 + kout * 0.55;
  const screen = React.useMemo(() => ({src: staticFile(SRC), size: [2560, 1600] as [number, number], durationInFrames: REC.frames, fit: 'cover' as const}), []);
  const look = React.useMemo(() => ({tone: REEL_LOOK.toneMapping, exposure: REEL_LOOK.exposure, glare: 0.14, reflections: 0.1, viewFalloff: 0.15}), []);
  return (
    <group position={pos} quaternion={q} scale={P.scale}>
      <Freeze frame={recFrame} active>
        <Laptop lidAngle={LID} screen={screen} look={look} spill={0.5} castShadow={false} />
      </Freeze>
    </group>
  );
};

// the final reply, word by word at the session's own gaps (demo/session.js, after "Fixed.")
const REPLY: Array<[string, number]> = [
  ['Fixed.', 0],
  ['`parseConfig`', 0.187],
  ['now', 0.24],
  ['trims', 0.32],
  ['keys', 0.387],
  ['and', 0.44],
  ['values,', 0.547],
  ['so', 0.587],
  ['`PORT', 0.667],
  ['=', 0.694],
  ['3000`', 0.774],
  ['parses', 0.867],
  ['to', 0.907],
  ['`{', 0.947],
  ['port:', 1.027],
  ['3000', 1.094],
  ['}`.', 1.147],
  ['Both', 1.214],
  ['tests', 1.294],
  ['pass.', 1.361],
];

const Code: React.FC<{children: React.ReactNode; H: number}> = ({children, H}) => (
  <span style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: '#E9E1D6', background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: `0 ${Math.round(0.004 * H)}px`}}>{children}</span>
);

/** Over the transcript, once npm test returns: the recorded tool output, held while the reply types. */
const TestCallout: React.FC<{t: number; m: SessionMap; T: Times07; x: number; y: number; w: number}> = ({t, m, T, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const k = pullK(t, m.film(REC.testOut) - 0.05, T.t4.swingOut - 0.35);
  if (k <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(w),
        boxSizing: 'border-box',
        padding: `${Math.round(0.016 * H)}px ${Math.round(0.022 * H)}px`,
        borderRadius: Math.round(H * layout.cardRadiusH),
        background: 'rgba(12,11,10,0.94)',
        border: `1px solid rgba(125,179,106,0.55)`,
        boxShadow: `0 ${Math.round(0.016 * H)}px ${Math.round(0.05 * H)}px rgba(0,0,0,0.55)`,
        ...pullStyle(k, H),
      }}
    >
      <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.text.secondary, marginBottom: Math.round(0.008 * H)}}>{'Run npm test · tool output: real (recorded)'}</div>
      <div style={{...mono(H, 0.024, 500), color: '#7db36a', lineHeight: 1.45}}>{'✔ parses KEY=VALUE pairs'}</div>
      <div style={{...mono(H, 0.024, 500), color: '#7db36a', lineHeight: 1.45}}>{'✔ tolerates spaces around ='}</div>
      <div style={{...mono(H, 0.024, 500), color: '#7aa2d9', lineHeight: 1.45}}>{'ℹ tests 2   ℹ pass 2   ℹ fail 0'}</div>
    </div>
  );
};

/** Under the screen: the line of the session that matters right now, in the film's own type. */
const Strip: React.FC<{t: number; m: SessionMap; T: Times07; x: number; y: number; w: number}> = ({t, m, T, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const F = (r: number) => m.film(r);
  const prompt = {at: Math.max(T.s4.start + 0.2, F(REC.send) - 0.5), out: F(REC.edit) - 0.35};
  const edit = {at: F(REC.edit), morph: F(REC.resolved1), out: F(REC.reply) - 1.05};
  const reply = {at: F(REC.reply) - 0.7};
  const box: React.CSSProperties = {
    position: 'absolute',
    left: Math.round(x),
    top: Math.round(y),
    width: Math.round(w),
    boxSizing: 'border-box',
    padding: `${Math.round(0.016 * H)}px ${Math.round(0.024 * H)}px`,
    borderRadius: Math.round(H * layout.cardRadiusH),
    background: 'rgba(16,14,12,0.9)',
    border: `1px solid ${color.card.rule}`,
    boxShadow: `0 ${Math.round(0.016 * H)}px ${Math.round(0.05 * H)}px rgba(0,0,0,0.5)`,
  };
  const label = (s: string, tone: string = color.pixie.bodyHi) => (
    <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: tone, marginBottom: Math.round(0.008 * H)}}>{s}</div>
  );
  const kp = pullK(t, prompt.at, prompt.out);
  const ke = pullK(t, edit.at, edit.out);
  const kr = pullK(t, reply.at, T.t4.end - 0.3);
  const mk = easeOutCubic(prog(t, edit.morph, 0.55));
  const typedNew = Math.floor(prog(t, edit.morph + 0.1, 0.7) * '.map((s) => s.trim())'.length);
  return (
    <>
      {kp > 0 ? (
        <div style={{...box, ...pullStyle(kp, H)}}>
          {label('the prompt · demo/session.js', color.text.secondary)}
          <div style={{...sans(H, 0.03, 500), whiteSpace: 'normal', color: color.text.display, lineHeight: 1.3}}>
            parseConfig chokes on <Code H={H}>PORT = 3000</Code> in my .env. Fix it and run the tests.
          </div>
        </div>
      ) : null}
      {ke > 0 ? (
        <div style={{...box, ...pullStyle(ke, H)}}>
          {label(t < edit.morph ? 'Edit src/config.js · waiting for your yes' : 'Edit src/config.js · allowed', t < edit.morph ? color.text.secondary : color.accent.mint)}
          <div style={{...mono(H, 0.026, 500), color: '#E9E1D6'}}>
            <span style={{color: color.text.tertiary}}>{'const [key, value] = '}</span>
            {'line.split("=")'}
            <span style={{color: color.accent.mint}}>{'.map((s) => s.trim())'.slice(0, typedNew)}</span>
            <span style={{color: color.text.tertiary}}>;</span>
          </div>
          <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.secondary, marginTop: Math.round(0.01 * H), display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H)}}>
            <span>{'the key from "PORT = 3000":'}</span>
            <span style={{color: '#E9E1D6'}}>
              {'"port'}
              <span style={{display: 'inline-block', width: Math.round(0.0146 * H), position: 'relative', height: Math.round(0.02 * H), verticalAlign: 'middle'}}>
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: Math.round(0.011 * H),
                    height: Math.round(0.011 * H),
                    marginLeft: -Math.round(0.0055 * H),
                    marginTop: -Math.round(0.0055 * H) + Math.round(mk * 0.012 * H),
                    borderRadius: 99,
                    background: 'radial-gradient(circle at 35% 30%, #fff 0%, #c9cfcd 45%, #6d7371 100%)',
                    opacity: 1 - mk,
                    boxShadow: `0 ${Math.round((1 - mk) * 0.006 * H)}px ${Math.round(0.006 * H)}px rgba(0,0,0,0.6)`,
                  }}
                />
              </span>
              {'"'}
            </span>
            <span style={{color: color.text.tertiary}}>{mk < 0.5 ? 'a trailing space, one raised pin' : 'trimmed: "port"'}</span>
          </div>
        </div>
      ) : null}
      {kr > 0 ? (
        <div style={{...box, ...pullStyle(kr, H)}}>
          {label('the reply · model replies: scripted (README)', color.text.secondary)}
          <div style={{...sans(H, 0.03, 500), whiteSpace: 'normal', color: color.text.display, lineHeight: 1.32}}>
            {REPLY.map(([wd, at], i) => {
              const a = easeOutCubic(prog(t, reply.at + 0.7 + at - 0.03, 0.12));
              const code = wd.includes('`');
              return (
                <span key={i} style={{opacity: a}}>
                  {code ? <Code H={H}>{wd.replace(/`/g, '')}</Code> : wd}
                  {i < REPLY.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
};

export const scene0704 = (ctx: FilmCtx, T: Times07): PartSpec => {
  const {width: W, height: H} = ctx;
  const {t4} = T;
  const m = sessionMap(T);
  const aspect = W / H;
  const pose = poseOn(ctx, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.05, pitch: 0.03});
  const P = placeLaptop(pose, aspect, {cx: 0.665, cy: 0.355, widthFrac: 0.44, z: 0.3, turn: -0.12});
  const camera: CameraKey[] = [
    {at: t4.swingIn - 0.4, dur: 1.2, pose, ease: 'camera'},
    {at: t4.swingIn + 0.8, dur: Math.max(1, t4.swingOut - t4.swingIn - 0.8), pose: pushIn(pose, 0.035), ease: 'inOutSine'},
  ];
  const fd = P.center.distanceTo(new THREE.Vector3(...(() => {
    const c = new THREE.PerspectiveCamera();
    applyPose(c, pose, aspect);
    return c.position.toArray() as [number, number, number];
  })()));
  const focus: FocusKey[] = [
    {at: t4.swingIn, dur: 0.8, to: {point: [P.center.x, P.center.y, P.center.z]}, aperture: apertureForBlur(5, fd, 0.3, pose.fov, 1440)},
    {at: t4.swingOut, dur: 0.7, to: 'target', aperture: 0},
  ];
  const light = [{at: t4.swingIn - 0.3, dur: 1.4, poolAt: [0.12, 0.03] as [number, number], spread: 1.3, key: 1.0, look: [0.12, 0.05] as [number, number]}];

  const u20 = presetCell('featured', H);
  const pixX = Math.round(W * layout.marginLeftW) - 10 * u20;
  const pixY = Math.round(0.215 * H);
  const f = (s: number) => ctx.tl.f(s);
  const stripX = W * 0.405;
  const stripW = W * 0.52;
  const stripY = H * 0.615;

  const world: TimedNode[] = [
    {id: 'c07-laptop', from: t4.swingIn, to: t4.swingOut + 0.8, premountS: 1.2, render: (t) => <LaptopNode t={t} P={P} m={m} swingIn={t4.swingIn} swingOut={t4.swingOut} />},
  ];
  const overlays: TimedNode[] = [
    {id: 'c07-featured', from: t4.swingIn, to: t4.swingOut + 1.2, render: () => <GuideAt preset="featured" x={pixX} y={pixY} enterAt={f(t4.swingIn - 0.1)} exitAt={f(t4.swingOut)} />},
    {id: 'c07-featured-card', from: t4.swingIn, to: t4.swingOut + 0.6, render: () => <GuideCard preset="guide" x={Math.round(W * layout.marginLeftW)} y={Math.round(0.17 * H)} enterAt={f(t4.swingIn + 0.9)} exitAt={f(t4.swingOut)} />},
    {id: 'c07-strip', from: t4.swingIn, to: t4.swingOut + 0.4, render: (t) => (t < t4.swingOut ? <Strip t={t} m={m} T={T} x={stripX} y={stripY} w={stripW} /> : null)},
    {id: 'c07-test-callout', from: m.film(REC.testOut) - 0.2, to: t4.swingOut + 0.2, render: (t) => <TestCallout t={t} m={m} T={T} x={W * 0.445} y={H * 0.3} w={W * 0.3} />},
    {
      id: 'c07-session-cites',
      from: t4.session,
      to: t4.swingOut + 0.4,
      render: (t) => (
        <>
          <Cite t={t} repo="Claude-Code-In-Motion" path="demo/session.js" line={4} at={t4.session + 0.6} out={t4.swingOut - 0.2} x={W * layout.marginLeftW} y={Math.round(0.645 * H)} />
          <Cite t={t} repo="Claude-Code-In-Motion" path="README.md" line="167-172" at={t4.scripted + 0.2} out={t4.swingOut - 0.2} x={W * layout.marginLeftW} y={Math.round(0.69 * H)} />
        </>
      ),
    },
  ];
  return {world, overlays, camera, focus, light, captionSkip: []};
};
