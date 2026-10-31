import React from 'react';
import {frameOn} from '../../../engine/camera';
import {emblemField, textField, type FieldFn, type LiveFieldFn, type Look, type PinSample} from '../../../engine/pins';
import {font} from '../../../engine/tokens';
import {ChapterCard} from '../../../engine/type';
import {HANDOFF} from '../../handoff';
import {boxesField, ground, layers} from '../ch03/kit/fields';
import {Chip, env, pullStyle, useFrameSize} from '../ch03/kit/ui';
import {InkCard} from './ink';
import type {SceneKit} from '../ch03/scene';
import {INK, INK_TEXT, MUTED_TEXT, PAPER, TEAL, TEAL_TEXT} from './common';

// 05.0 the Act II gate, sink: the wall in front of Pixie sinks into a square well whose floor is
// CANDOR's place, in the light paper palette. 05.1 a dark box that answers "3" with no reasons, and
// a magnifier looking in from outside.

/** The paper ground: painted (non-metallic) heads in CANDOR's #F3FBF8. */
export const paper = (k: number = 1): FieldFn => {
  const s: PinSample = {h: 0, tint: [PAPER[0] * k, PAPER[1] * k, PAPER[2] * k], paint: 1};
  return () => s;
};
/** Painted paper pins (non-metallic heads). */
export const paperLook = (h: number, tint = PAPER, glow = 0): Look => ({h, tint, glow, paint: 1});

export const BOX = {u: 0.62, v: 0.5, size: 30};

/** The magnifier: a ring and a handle of raised ink pins, orbiting the box. */
export const magnifierLayer = (k: SceneKit, from: number, to: number): LiveFieldFn => {
  const {board} = k;
  const ringR = 7.5;
  const ringW = 1.25;
  const handle = 8;
  const s: PinSample = {h: 0, tint: [0, 0, 0], paint: 0};
  return (u, v, _i, t) => {
    if (t < from - 0.5 || t > to + 0.5) return null;
    const a = 0.5 * (t - from);
    const cu = BOX.u + (Math.cos(a) * 3.5 + 20) * board.p;
    const cv = BOX.v + ((Math.sin(a * 1.3) * 3 + 13) * board.p) / board.extH;
    const px = (u - cu) / board.p;
    const py = ((v - cv) * board.extH) / board.p;
    const d = Math.hypot(px, py);
    const ring = Math.abs(d - ringR) < ringW;
    // the handle runs down-right from the ring
    const hx = px - ringR * 0.72;
    const hy = py + ringR * 0.72;
    const along = (hx - hy) / Math.SQRT2;
    const across = (hx + hy) / Math.SQRT2;
    const onHandle = along > 0 && along < handle && Math.abs(across) < 1.1;
    const lens = d < ringR - ringW;
    if (!ring && !onHandle && !lens) return null;
    s.h = onHandle ? 0.62 : lens ? 0.12 : 0.58;
    s.tint = lens ? [0.82, 0.95, 1.02] : INK;
    s.paint = lens ? 1 : 0.2;
    return s;
  };
};

export const buildGateAndBox = (k: SceneKit) => {
  const {board, aspect, c, acc, home, ctx} = k;
  const ch = c.tl.chapter('05');
  const S0 = c.sc('05.0');
  const S1 = c.sc('05.1');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);

  // ---------------------------------------------------------------- the well: the rim rises, the floor is paper
  const well = {u: BOX.u, v: BOX.v, w: 56, h: 46};
  const rim = (inner: Look, rimLook: Look): FieldFn =>
    boxesField(board, [
      {u: well.u, v: well.v + ((well.h / 2 + 1.5) * board.p) / board.extH, w: well.w + 6, h: 3, look: rimLook},
      {u: well.u, v: well.v - ((well.h / 2 + 1.5) * board.p) / board.extH, w: well.w + 6, h: 3, look: rimLook},
      {u: well.u - (well.w / 2 + 1.5) * board.p, v: well.v, w: 3, h: well.h, look: rimLook},
      {u: well.u + (well.w / 2 + 1.5) * board.p, v: well.v, w: 3, h: well.h, look: rimLook},
      {u: well.u, v: well.v, w: well.w, h: well.h, look: inner},
    ], ground(0.62));
  // the dark box that answers 3, set on the paper floor
  const boxField = (answerGlow: number): FieldFn => {
    const base = boxesField(board, [{u: BOX.u, v: BOX.v, w: BOX.size, h: BOX.size, radius: 1, look: {h: 0.42, tint: INK, paint: 0.3}}], paper());
    const three = textField(board, {text: '3', weight: 700}, {u: BOX.u, v: BOX.v, height: 16}, {h: 0.62, tint: 1.0, ground: 0.3, glow: answerGlow});
    return layers(base, (u, v, i) => {
      if (Math.abs(u - BOX.u) > (BOX.size / 2) * board.p || Math.abs(v - BOX.v) > ((BOX.size / 2) * board.p) / board.extH) return null;
      const s = three(u, v, i);
      return s.h > 0.05 ? {...s, tint: [0.96, 1.0, 0.98], paint: 1} : null;
    });
  };

  acc.beat({id: 'handoff', at: ch.start, field: HANDOFF});
  acc.beat({id: 'well-rim', at: S0.start, field: rim({h: 0, tint: 0.42}, {h: 0.85, tint: 0.7}), sweep: {origin: [well.u, well.v], speed: 0.55, jitterS: 0.08}});
  // the floor of the well re-tints to paper, from the centre out, then the whole wall follows
  acc.beat({id: 'well-paper', at: S0.start + 0.8, field: rim(paperLook(0), {h: 0.85, tint: [0.86, 0.94, 0.92], paint: 1}), sweep: {origin: [well.u, well.v], speed: 0.45, jitterS: 0.05, tintFollowsWave: true}});
  acc.beat({id: 'paper', at: S0.end - 0.4, field: boxField(0), sweep: {origin: [well.u, well.v], speed: 0.7, jitterS: 0.06, tintFollowsWave: true}});
  acc.beat({id: 'answer', at: c.u('u0501').start - 0.1, field: boxField(0.9)});

  // the camera descends into the well: steeper, closer, onto its floor
  const rimPose = frameOn(board, {uv: [well.u - 0.04, well.v], pinsAcross: 132, yaw: 0.14, pitch: 0.12, aspect});
  const floorPose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 112, yaw: 0.06, pitch: 0.03, aspect});
  acc.camera.push(
    {at: ch.start, pose: home},
    {at: ch.start + 0.2, dur: S0.start - ch.start + 0.6, pose: rimPose, ease: 'camera'},
    {at: S0.start + 0.9, dur: 2.3, pose: floorPose, ease: 'camera'},
    {at: S0.end + 1.4, dur: S1.end - S0.end - 1.6, pose: {...floorPose, distance: floorPose.distance * 0.955}, ease: 'inOutSine'},
  );
  // the light comes up: the one mid-film moment inside the glass
  acc.light.push(
    {at: ch.start, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1},
    {at: S0.start, dur: 0.8, key: 0.9, spread: 0.9, poolAt: [well.u - 0.5, 0]},
    {at: S0.start + 0.8, dur: 2.2, key: 1.45, spread: 2.6, pool: 1.35, env: 0.5, look: [0, 0.05], poolAt: [0.05, 0]},
  );

  acc.overlay({
    id: 'card',
    from: S0.start,
    to: S0.end + 0.6,
    render: (t) => <ChapterCard index="05" kicker="candor" title="The forward *pass.*" kind="displayM" maxWidth={Math.round(0.5 * W)} at={S0.start + 0.12} exitAt={S0.end - 0.1} t={t} />,
  });

  // ---------------------------------------------------------------- 05.1: the magnifier, the line, the place
  const magFrom = S1.start - 0.2;
  const magTo = c.u('u0502').start + 0.6;
  acc.live.push({fn: magnifierLayer(k, magFrom, magTo), from: magFrom, to: magTo, fadeS: 0.45, region: [BOX.u, BOX.v - 0.05, BOX.u + 0.22, BOX.v + 0.25], mode: 'replace'});
  const lineAt = c.u('u0501').start - 0.15;
  const plateAt = c.u('u0502').start - 0.1;
  acc.overlay({
    id: 'black-box',
    from: S1.start - 0.1,
    to: c.sc('05.2').start + 0.3,
    render: (t) => (
      <>
        <ReasonsLine t={t} at={lineAt} exitAt={plateAt - 0.4} x={left} y={Math.round(0.28 * H)} />
        <Chip t={t} at={lineAt + 0.6} exitAt={plateAt - 0.4} repo="AnwarDebes.github.io" path="assets/video/candor-720p.mp4" line="0:03" x={left} y={Math.round(0.5 * H)} />
        <Chip t={t} at={c.w('u0501', 'afterwards')} exitAt={plateAt - 0.4} repo="candor" path="README.md" line="23-28" x={left} y={Math.round(0.545 * H)} />
      </>
    ),
  });
  acc.overlay({id: 'plate', from: plateAt, to: c.sc('05.2').start + 0.4, render: (t) => <LightPlate t={t} at={plateAt} exitAt={c.sc('05.2').start} />});
  acc.overlay({
    id: 'question',
    from: c.w('u0502', 'measurable'),
    to: c.sc('05.2').start + 0.3,
    render: (t) => <Chip t={t} at={c.w('u0502', 'measurable') + 0.3} exitAt={c.sc('05.2').start - 0.2} repo="candor" path="paper/candor.tex" line="205-208" x={left} y={Math.round(0.5 * H)} />,
  });
  // the seal emblem rises beside the box as the place is named
  const seal = emblemField(board, 'candor', {u: 0.775, v: 0.47, height: 22}, {ground: 0.9});
  acc.beat({
    id: 'seal',
    at: plateAt,
    field: layers(boxField(0.9), (u, v, i) => {
      if (Math.abs(u - 0.775) > 0.08 || Math.abs(v - 0.47) > 0.14) return null;
      const s = seal(u, v, i);
      return s.h > 0.02 ? {...s, tint: s.h > 0.95 ? [0.6, 1.1, 1.0] : TEAL, paint: 1, glow: s.h > 0.95 ? 0.4 : 0} : null;
    }),
    sweep: {origin: [0.775, 0.47], speed: 0.6, jitterS: 0.06},
  });

  acc.pixie.push(
    {frame: c.f(ch.start), activity: 'idle', detail: ''},
    {frame: c.f(S1.start + 0.2), activity: 'searching', detail: 'Search a trained model for reasons'},
  );
  return {boxField, plateAt};
};

/** "Train a black box. Dig for reasons later." in dark ink on the paper ground. */
const ReasonsLine: React.FC<{t: number; at: number; exitAt: number; x: number; y: number}> = ({t, at, exitAt, x, y}) => {
  const {H} = useFrameSize();
  const k1 = env(t, at, 0.4, exitAt);
  const k2 = env(t, at + 0.9, 0.4, exitAt);
  if (k1 <= 0.001) return null;
  const fs = Math.round(0.056 * H);
  return (
    <InkCard k={k1} x={x} y={y}>
      <div style={{fontFamily: font.sans, fontWeight: 650, fontSize: fs, letterSpacing: '-0.03em', lineHeight: 1.12, color: INK_TEXT, whiteSpace: 'nowrap'}}>
        <div>Train a black box.</div>
        <div style={{...pullStyle(k2, H), color: MUTED_TEXT}}>Dig for reasons later.</div>
      </div>
    </InkCard>
  );
};

/** The name plate and status chip, re-inked for the paper ground. */
const LightPlate: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {W, H} = useFrameSize();
  const k1 = env(t, at, 0.4, exitAt);
  const k2 = env(t, at + 0.25, 0.4, exitAt);
  if (k1 <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.072 * H)}}>
      <div style={{display: 'inline-flex', alignItems: 'center', gap: Math.round(0.014 * H), padding: `${Math.round(0.006 * H)}px ${Math.round(0.016 * H)}px`, borderRadius: Math.round(0.014 * H), background: 'rgba(246,252,250,0.92)', ...pullStyle(k1, H)}}>
        <span style={{width: Math.round(0.014 * H), height: Math.round(0.014 * H), borderRadius: '50%', background: TEAL_TEXT}} />
        <span style={{fontFamily: font.mono, fontSize: Math.round(0.046 * H), fontWeight: 600, color: INK_TEXT, letterSpacing: '-0.01em', lineHeight: 1.1}}>candor</span>
      </div>
      <div style={{display: 'inline-block', marginTop: Math.round(0.016 * H), padding: `${Math.round(0.0092 * H)}px ${Math.round(0.0176 * H)}px`, borderRadius: 999, border: `${hair}px solid rgba(11,135,123,0.45)`, background: 'rgba(243,251,248,0.85)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEAL_TEXT, whiteSpace: 'nowrap', ...pullStyle(k2, H)}}>
        research prototype · july 2026 preprint · live glass box
      </div>
    </div>
  );
};

