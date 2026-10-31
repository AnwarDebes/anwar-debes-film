import React from 'react';
import {SWEEPS, rectField, type Beat, type FieldFn, type LiveLayer} from '../../../engine/pins';
import {pushIn, type CameraKey} from '../../../engine/camera';
import type {FilmCtx, TimedNode} from '../../types';
import {poseOn, handoffPose} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {termGeometry, termLiveField, termPlateField, type TermSpec} from './pinTerminal';
import {WARM, warmFlat} from './look';
import type {Times07} from './times';
import {ChapterCard07} from './parts';
import {Cite} from './kit/ui';
import {color, font, layout, type as Ty} from '../../../engine/tokens';
import {useVideoConfig} from 'remotion';

// 07.0 the gate (Act II, sink): the wall in front of Pixie rises around a square well, the camera
// descends into it, and the well's floor is a terminal agent at work behind a spinner (07.1).

export const TERM_CENTER: [number, number] = [0.5, 0.525];
export const TERM_W = 100;
export const TERM_H = 54;

export const terminalSpec = (ctx: FilmCtx, T: Times07): TermSpec => {
  const {t1} = T;
  const start = T.g.at + 0.35;
  const lines: TermSpec['lines'] = [
    {text: '$ git pull', at: start, kind: 'cmd'},
    {text: 'up to date', at: start + 0.75, kind: 'out'},
    {text: '$ npm install', at: start + 1.3, kind: 'cmd'},
    {text: 'up to date', at: start + 2.05, kind: 'out'},
    {text: '$ npm run lint', at: Math.min(t1.agent, start + 2.8), kind: 'cmd'},
    {text: 'lint clean', at: Math.min(t1.agent + 0.8, t1.rm - 2.6), kind: 'out'},
    {text: '$ npm test', at: Math.min(t1.spinner, t1.rm - 1.9), kind: 'cmd'},
    {text: 'all passing', at: t1.rm - 0.9, kind: 'out'},
    {text: '$ rm -rf build', at: t1.rm, kind: 'cmd', cps: 17, mark: {from: t1.rmSpoken - 0.05}},
    {text: 'removing build/', at: t1.after1, kind: 'out'},
    {text: '$ npm run build', at: t1.after2, kind: 'cmd'},
  ];
  return {
    board: ctx.board,
    center: TERM_CENTER,
    w: TERM_W,
    h: TERM_H,
    lines,
    rows: 4,
    spinFrom: T.g.at - 0.2,
    burst: t1.burst,
  };
};

export const scene0701 = (ctx: FilmCtx, T: Times07): PartSpec => {
  const {board} = ctx;
  const {g, t1} = T;
  const term = terminalSpec(ctx, T);
  const geo = termGeometry(term);

  // the well: everything rises to a plateau except a square that stays down; its floor is the terminal
  const well = {u: TERM_CENTER[0], v: TERM_CENTER[1], w: TERM_W + 14, h: TERM_H + 12};
  const plateau = rectField(board, {u: well.u, v: well.v, w: well.w, h: well.h, radius: 1.5}, {h: 0, tint: WARM, soft: 0.5, ground: (() => {
    const s = {h: 0.3, tint: [WARM[0] * 0.92, WARM[1] * 0.92, WARM[2] * 0.92] as [number, number, number]};
    return () => s;
  })()});
  const floorWithTerm: FieldFn = termPlateField(term, plateau);
  const termOnFlat: FieldFn = termPlateField(term, warmFlat);

  const beats: Beat[] = [
    // warm the bare wall first, from Pixie's corner
    {id: 'c07-warm', at: T.ch.start + 0.6, field: warmFlat, sweep: {...SWEEPS.from([0.04, 0.12], 1.1, 0.06), tintFollowsWave: true}, tintTauS: 0.5},
    // the wall in front of Pixie rises around the well (the well sinks), the terminal is its floor
    {id: 'c07-well', at: g.at - 0.05, field: floorWithTerm, sweep: {...SWEEPS.from([0.08, 0.2], 1.35, 0.06)}},
    // once the camera is inside, the rim settles back to the wall, out of frame
    {id: 'c07-floor', at: g.floor, field: termOnFlat, sweep: {origin: TERM_CENTER, speed: 0.9, jitterS: 0.05}},
  ];

  const live: LiveLayer[] = [
    {fn: termLiveField(term), from: g.at - 0.4, to: t1.burst + 0.72, fadeS: 0.3, region: geo.region, speedHint: () => 0.6},
  ];

  // camera: from the handoff pose, descend into the well and settle on the terminal
  const base = handoffPose(ctx);
  const inWell = poseOn(ctx, {uv: TERM_CENTER, pinsAcross: 136, yaw: 0.05, pitch: 0.16, screen: [0.5, 0.4]});
  const onTerm = poseOn(ctx, {uv: TERM_CENTER, pinsAcross: 158, yaw: 0.07, pitch: 0.07, screen: [0.53, 0.385]});
  const onSpinner = poseOn(ctx, {uv: geo.spinnerUv, pinsAcross: 84, yaw: 0.14, pitch: 0.09, screen: [0.6, 0.36]});
  const camera: CameraKey[] = [
    {at: T.ch.start, pose: base},
    {at: T.ch.start + 0.01, dur: g.descendFrom - T.ch.start, pose: pushIn(base, 0.03), ease: 'inOutSine'},
    {at: g.descendFrom, dur: g.descendTo - g.descendFrom, pose: inWell, ease: 'camera'},
    {at: g.descendTo, dur: 1.6, pose: onTerm, ease: 'camera'},
    {at: g.descendTo + 1.6, dur: Math.max(1, t1.push - g.descendTo - 1.6), pose: pushIn(onTerm, 0.05), ease: 'inOutSine'},
    // the hold on the spinner: a slow push toward it
    {at: t1.push, dur: Math.max(0.8, t1.burst - t1.push), pose: onSpinner, ease: 'camera'},
  ];

  // light: the pool follows the well, a little low and warm
  const [wx, wy] = [TERM_CENTER[0] - 0.5, TERM_CENTER[1] * board.extH - board.extH / 2];
  const light = [
    {at: T.ch.start, look: [0, 0] as [number, number], key: 1, pool: 1, env: 1, poolAt: [0, 0] as [number, number], spread: 1},
    {at: g.at - 0.2, dur: 2.2, poolAt: [wx, wy] as [number, number], spread: 0.95, key: 1.02},
    {at: t1.push, dur: 2, poolAt: [geo.spinnerUv[0] - 0.5, geo.spinnerUv[1] * board.extH - board.extH / 2] as [number, number], spread: 0.85},
  ];


  const overlays: TimedNode[] = [
    {
      id: 'c07-card',
      from: g.at,
      to: g.cardOut + 0.6,
      render: (t) => <ChapterCard07 t={t} at={g.cardIn} exitAt={g.cardOut} />,
    },
    {id: 'c07-term-tag', from: T.s1.start, to: t1.burst, render: (t) => <SchematicTag t={t} at={T.s1.start + 0.3} out={t1.burst - 0.3} />},
    {
      id: 'c07-term-cite',
      from: t1.rmSpoken,
      to: t1.burst,
      render: (t) => <TermCite t={t} at={t1.rmSpoken + 0.4} out={t1.burst - 0.4} />,
    },
  ];
  return {beats, live, camera, light, overlays};
};

/** The terminal is a staged illustration of the problem (only its last command is from the tests). */
const SchematicTag: React.FC<{t: number; at: number; out: number}> = ({t, at, out}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = Math.min(Math.max(0, Math.min(1, (t - at) / 0.4)), Math.max(0, Math.min(1, (out - t) / 0.3)));
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(0.7 * H) - Math.round(0.012 * H), opacity: k, fontFamily: font.mono, fontSize: Math.round(Ty.monoKicker.size * H), fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.signal.amber, whiteSpace: 'pre'}}>
      {'schematic'}
    </div>
  );
};

/** Under the terminal: where the command comes from. */
const TermCite: React.FC<{t: number; at: number; out: number}> = ({t, at, out}) => {
  const {width: W, height: H} = useVideoConfig();
  return <Cite t={t} repo="Claude-Code-In-Motion" path="test/safety.test.js" line={21} at={at} out={out} x={W * (1 - layout.marginLeftW)} y={Math.round(H * 0.7)} align="right" />;
};
