import React from 'react';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, FILM_RIPPLE, emblemField, ruleLineField, type FieldFn, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import {boxesField, ground, layers} from './kit/fields';
import {DeviceProp, pointOnScreen, remapper} from './kit/device';
import {frameWidthAt} from './kit/camera';
import {Chip, Pill, dim, env, italic, pullStyle, useFrameSize} from './kit/ui';
import {CLIPS, LIT, TEAL} from './common';
import type {SceneKit} from './scene';

// 03.7 the payoff: the agent is scripted; the guard, the monitors and the ledger that judge it are
// real. Then the mint thread runs on along the wall toward chapter 04.

export const buildPayoff = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S7 = c.sc('03.7');
  const ch = c.tl.chapter('03');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const teal = ground(TEAL);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // the three real parts, as pin pictures: the shield (guard), the 322 B bin (monitors), the chain
  const v = 0.5;
  const shieldAt = {u: 0.23, v, height: 26};
  const binU = 0.375;
  const chainU = 0.52;
  const shield = emblemField(board, 'trace', shieldAt, {ground: TEAL[1] * 0.8, glowAbove: 0.85, height: 0.6});
  const OFF: Look = {h: 0.16, tint: 0.6};
  const ON: Look = {h: 0.3, tint: LIT, glow: 0.65};
  const bin = (lk: Look) => [-1.5, -0.5, 0.5, 1.5].map((j, i) => ({u: binU + j * 4.6 * board.p, v, w: [3.4, 5.4, 4.0, 3.4][i], h: 12, radius: 0.8, look: lk}));
  const chain = (lk: Look) => [-1, 0, 1].flatMap((j) => [
    {u: chainU + j * 7.2 * board.p, v, w: 5.2, h: 5.2, radius: 1, look: lk},
    ...(j < 1 ? [{u: chainU + (j + 0.5) * 7.2 * board.p, v, w: 2.4, h: 1.2, look: lk}] : []),
  ]);
  const parts = (s: boolean, b: boolean, l: boolean): FieldFn => {
    const base = boxesField(board, [...bin(b ? ON : OFF), ...chain(l ? ON : OFF)], teal);
    const sh = (u: number, vv: number, i: number) => {
      if (Math.abs(u - shieldAt.u) > 0.08 || Math.abs(vv - v) > 0.13) return null;
      const smp = shield(u, vv, i);
      if (smp.h <= 0.01) return null;
      return s ? {...smp, tint: LIT, glow: Math.max(smp.glow ?? 0, 0.35)} : {...smp, tint: 0.7};
    };
    return layers(base, sh);
  };
  const tGuard = c.w('u0321', 'guard');
  const tMon = c.w('u0321', 'monitors');
  const tLedger = c.w('u0321', 'ledger');
  const tReal = c.w('u0321', 'real');
  acc.beat({id: 'parts', at: S7.start - 0.5, field: parts(false, false, false), sweep: {origin: [0.38, 0.5], speed: 0.75, jitterS: 0.06}});
  acc.beat({id: 'part-guard', at: tGuard, field: parts(true, false, false)});
  acc.beat({id: 'part-monitors', at: tMon, field: parts(true, true, false)});
  acc.beat({id: 'part-ledger', at: tLedger, field: parts(true, true, true)});
  // the TRACE emblem presses into the wall on "real"
  acc.presses.push({at: tReal, origin: [shieldAt.u, v], radius: 0.035, depth: 0.55});
  acc.ripples.push({...FILM_RIPPLE, at: tReal, origin: [shieldAt.u, v]});

  const payPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: S7.start - 0.5, dur: 1.5, pose: payPose, ease: 'camera'}, {at: S7.start + 1.0, dur: ch.end - S7.start - 3.4, pose: {...payPose, distance: payPose.distance * 0.95}, ease: 'inOutSine'});
  acc.light.push({at: S7.start - 0.5, dur: 1.2, key: 1.02, spread: 1.25, poolAt: [-0.06, 0], look: [0, 0]});

  // the laptop with the demo's scripted rows, dimmed to 40% on "scripted"
  const screenAt = pointOnScreen(payPose, 0.74, 0.43, 0.12, aspect);
  const screenWidth = 0.33 * frameWidthAt(payPose, screenAt, aspect);
  const tScripted = c.w('u0321', 'scripted');
  const recAt = remapper([{film: S7.start, rec: 2.6}], CLIPS.session);
  const lapIn = S7.start - 0.6;
  const lapOut = ch.end - 2.4;
  acc.prop({
    id: 'laptop-scripted',
    from: lapIn,
    to: lapOut + 0.9,
    premountS: 1.0,
    render: (t) => {
      const dimK = env(t, tScripted, 0.8);
      return <DeviceProp t={t} kind="laptop" clip={CLIPS.session} recFrame={recAt(t)} at={screenAt} rest={[0.05, -0.28]} screenWidth={screenWidth} motion={{enterAt: lapIn, exitAt: lapOut, enter: 'swing', exit: 'swing'}} brightness={1 - 0.84 * dimK} />;
    },
  });

  const pose = (t: number) => rigPoseAt(acc.camera, t);
  const labelAt = (u: number): [number, number, number] => [u - 0.5, (v - 0.085) * board.extH - board.extH / 2, 0.1 * relief];
  acc.overlay({
    id: 'real',
    from: S7.start - 0.3,
    to: ch.end,
    render: (t) => (
      <>
        <PartLabel t={t} at={tGuard} exitAt={lapOut} p={projectToScreen(pose(t), labelAt(shieldAt.u), W, H)} name="guard" />
        <PartLabel t={t} at={tMon} exitAt={lapOut} p={projectToScreen(pose(t), labelAt(binU), W, H)} name="monitors" />
        <PartLabel t={t} at={tLedger} exitAt={lapOut} p={projectToScreen(pose(t), labelAt(chainU), W, H)} name="ledger" />
        <Pill k={env(t, tReal + 0.2, 0.5, lapOut)} x={left} y={Math.round(0.2 * H)} sizeH={0.026}>
          the agent: {dim('scripted')} {dim('·')} the guard, monitors and ledger: {italic('real')}
        </Pill>
        <Chip t={t} at={tReal + 0.6} exitAt={lapOut} repo="trace" path="live/README.md" line="45-46" x={left} y={Math.round(0.255 * H)} />
        <Chip t={t} at={tScripted + 0.3} exitAt={lapOut} repo="trace" path="live/index.html" line={116} x={Math.round(0.93 * W)} y={Math.round(0.74 * H)} align="right" />
      </>
    ),
  });

  // chapter change: the mint thread from the website's guard runs on to the right along the wall
  const threadAt = ch.end - 2.2;
  acc.beat({id: 'thread', at: threadAt, field: ruleLineField(board, {v: 0.5, u0: 0.0, u1: 1.0}, {ground: teal, glow: 1, h: 0.1}), sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.7, jitterS: 0.015, tintFollowsWave: true}});

  acc.pixie.push({frame: c.f(S7.start + 0.2), activity: 'idle', detail: ''});
  return {threadAt};
};

const PartLabel: React.FC<{t: number; at: number; exitAt: number; p: [number, number, number]; name: string}> = ({t, at, exitAt, p, name}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  const k = env(t, at, 0.4, exitAt);
  if (!ready || k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: p[0], top: p[1], transform: 'translate(-50%, 0)', fontFamily: font.mono, fontSize: Math.round(0.026 * H), fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text.display, textShadow: '0 0 12px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', ...pullStyle(k, H)}}>
      {name}
    </div>
  );
};

