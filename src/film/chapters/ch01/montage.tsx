import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {dolly, projectToScreen, pushIn, rigPoseAt, type CameraKey, type CameraPose} from '../../../engine/camera';
import {circleField, flatField, pinAt, rectField, tileGridField, type Beat, type Board, type FieldFn, type LightKey, type LiveFieldFn, type LiveLayer, type PinSample} from '../../../engine/pins';
import type {PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import shipJson from '../../../data/ch01/ship.json';
import {bodyStyle, capsStyle, Chip, chipSlot, clamp01, easeOut, Em, env, legible, monoStyle, MONO_MIN, NamePlate, pull, ramp, TypedChip} from './kit';
import {pose, wxy, type Part, type Stage} from './stage';

// 01.7 the oldest repositories, a fast montage; 01.8 one literal automaton and its stationary
// distribution; 01.9 one deep learning course in two repositories.

/** Stationary distribution of the eight-state literal automaton (Dynamic_Visualization, lines 40-92). */
export const automatonPi = (s: number, ply = 0.8, py = 0.5, plbyb = 0.2): number[] => {
  const plby = 1 - ply;
  const pyb = 1 - py;
  const c = ply * py + plbyb * pyb;
  const p = [
    py ** 4 * plby ** 7,
    py ** 3 * plby ** 6 * s * c,
    py ** 2 * plby ** 5 * s ** 2 * c ** 2,
    py * plby ** 4 * s ** 3 * c ** 3,
    plby ** 3 * s ** 4 * c ** 4,
    ply * plby ** 2 * s ** 5 * c ** 4,
    ply ** 2 * plby * s ** 6 * c ** 4,
    ply ** 3 * s ** 7 * c ** 4,
  ];
  const S = p.reduce((a, b) => a + b, 0);
  return S === 0 ? new Array(8).fill(0.125) : p.map((x) => x / S);
};

const SHIP = (() => {
  const bin = atob((shipJson as {data: string}).data);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return {w: 48, h: 48, a};
})();

const shipField = (board: Board, cu: number, cv: number, sizePins: number, ground: FieldFn): FieldFn => {
  const half = (sizePins / 2) * board.p;
  const halfV = half / board.extH;
  return (u, v, i) => {
    const s = (u - (cu - half)) / (2 * half);
    const tt = (v - (cv - halfV)) / (2 * halfV);
    if (s < 0 || s > 1 || tt < 0 || tt > 1) return ground(u, v, i);
    const x = Math.min(SHIP.w - 1, Math.max(0, Math.round(s * (SHIP.w - 1))));
    const y = Math.min(SHIP.h - 1, Math.max(0, Math.round((1 - tt) * (SHIP.h - 1))));
    const g = SHIP.a[y * SHIP.w + x] / 255;
    return {h: 0.05 + 0.32 * g, tint: 0.3 + 0.7 * g};
  };
};

/** A hex board for Hex: an 11 x 11 rhombus of cells, empty, its rim raised. */
const hexBoardField = (board: Board, cu: number, cv: number, cell: number, ground: FieldFn): FieldFn => {
  const N = 11;
  return (u, v, i) => {
    const x = (u - cu) / board.p / cell;
    const y = ((v - cv) * board.extH) / board.p / cell;
    // axial coordinates of a rhombus leaning right
    const r = -y / 0.866 + (N - 1) / 2;
    const q = x - 0.5 * (-y / 0.866) + (N - 1) / 2 - (N - 1) / 4;
    if (r < -0.6 || r > N - 0.4 || q < -0.6 || q > N - 0.4) return ground(u, v, i);
    const rr = Math.round(r);
    const qq = Math.round(q);
    const fr = Math.abs(r - rr);
    const fq = Math.abs(q - qq);
    const edge = rr <= 0 || rr >= N - 1 || qq <= 0 || qq >= N - 1;
    if (fr > 0.36 || fq > 0.36) return {h: 0.08, tint: 0.62};
    return edge ? {h: 0.14, tint: 0.95} : {h: 0.03, tint: 0.78};
  };
};

export interface MontageOut extends Part {
  endPose: CameraPose;
}

export const buildMontage = (st: Stage): MontageOut => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const s7 = tl.scene('01.7');
  const s8 = tl.scene('01.8');
  const s9 = tl.scene('01.9');
  const w = (u: string, word: string) => tl.word(u, word).start;
  const tA = w('u0121', 'cloud') - 0.3;
  const tW = w('u0122', 'practice') - 0.3;
  const tP = w('u0122', 'web') - 0.3;
  const tHx = w('u0123', 'Tsetlin') - 0.3;
  const steel = flatField();
  const enter = (origin: [number, number]) => ({kind: 'linear' as const, origin, direction: [-1, 0] as [number, number], speed: 1.25, jitterS: 0.03, tintFollowsWave: true});

  // ---------------------------------------------------------------- 01.7 plots
  const plotUV: [number, number] = [0.6, 0.5];
  const cardL = rectField(board, {u: 0.47, v: 0.52, w: 34, h: 22, radius: 2.5}, {h: 0.1, tint: 0.4, soft: 0.6});
  const cardR = rectField(board, {u: 0.69, v: 0.52, w: 34, h: 22, radius: 2.5}, {h: 0.1, tint: 0.4, soft: 0.6, ground: cardL});
  const page = rectField(board, {u: 0.6, v: 0.5, w: 64, h: 34, radius: 2}, {h: 0.06, tint: 0.42, soft: 0.6});
  const titleBar = rectField(board, {u: 0.6, v: 0.555, w: 46, h: 3.2, radius: 1}, {h: 0.3, tint: 1.0, soft: 0.5, ground: page});
  const cities = [0, 1, 2, 3, 4].map((k) => ({u: 0.42 + k * 0.09, v: 0.5}));
  let weather: FieldFn = steel;
  for (const c of cities) weather = circleField(board, {u: c.u, v: c.v, r: 3.4}, {h: 0.34, tint: 1.0, glow: 0.35, ground: weather});
  const hexB = hexBoardField(board, 0.6, 0.46, 2.6, steel);

  // ---------------------------------------------------------------- 01.8 the literal automaton
  const s8u = tl.utt('u0124');
  const w95 = tl.word('u0125', 'ninety-five');
  const sweepFrom = tl.utt('u0125').end + 0.3;
  const sweepTo = s8.end - 1.4;
  const sAt = (t: number) => {
    if (t <= sweepFrom || t >= sweepTo) return 5;
    const k = (t - sweepFrom) / (sweepTo - sweepFrom);
    // 5 -> 1 -> 25 -> 5, eased
    const e = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(x));
    if (k < 0.2) return 5 - 4 * e(k / 0.2);
    if (k < 0.7) return 1 + 24 * e((k - 0.2) / 0.5);
    return 25 - 20 * e((k - 0.7) / 0.3);
  };
  const barU0 = 0.36;
  const barStep = 0.04;
  const barV0 = 0.42;
  const barHPins = 32;
  const barW = 3.2;
  const railV = [0.27, 0.235, 0.2, 0.165];
  const railVals = (t: number) => [(sAt(t) - 1) / 24, 0.8, 0.5, 0.2];
  const autoLive: LiveFieldFn = (u, v, _i, t) => {
    const pi = automatonPi(sAt(t));
    for (let k = 0; k < 8; k++) {
      const cu = barU0 + k * barStep;
      if (Math.abs(u - cu) > (barW / 2) * board.p) continue;
      const top = barV0 + ((Math.max(0.012, pi[k]) * barHPins * board.p) / board.extH);
      if (v < barV0 - 0.004 || v > barV0 + (barHPins * board.p) / board.extH + 0.01) return null;
      if (v <= top) return {h: 0.22 + 0.25 * pi[k], tint: 1.0, glow: k === 7 ? 0.9 : 0.05};
      return {h: 0, tint: 0.55};
    }
    return null;
  };
  void railV;
  void railVals;
  const autoRegion: [number, number, number, number] = [barU0 - 0.03, barV0 - 0.02, barU0 + 7 * barStep + 0.03, barV0 + (barHPins * board.p) / board.extH + 0.02];

  // ---------------------------------------------------------------- 01.9 one course, two repositories
  const tDNN = s9.start + 0.15;
  const tDNA = w('u0126', 'two') - 0.2;
  const shipF = shipField(board, 0.44, 0.535, 28, steel);
  const ATT = [
    [0.2283, 0.3433, 0.257, 0.023, 0.1484],
    [0.0084, 0.0101, 0.0106, 0.9607, 0.0102],
    [0.1993, 0.3999, 0.2413, 0.0294, 0.13],
    [0.0967, 0.6225, 0.1306, 0.0552, 0.0951],
    [0.0861, 0.6883, 0.1294, 0.0305, 0.0656],
  ];
  const attn = tileGridField(
    board,
    {u: 0.71, v: 0.535, cols: 5, rows: 5, cell: 5.6, gap: 1.1},
    (c, r) => ({h: 0.06 + 0.5 * ATT[r][c], tint: r === 1 ? 1.0 : 0.55 + 0.45 * ATT[r][c], glow: r === 1 && c === 3 ? 0.9 : r === 1 ? 0.15 : 0}),
    {ground: shipF},
  );

  const beats: Beat[] = [
    {id: 'c01-a1c', at: tA, field: cardR, sweep: enter([1, 0.5])},
    {id: 'c01-woe', at: tW, field: titleBar, sweep: enter([1, 0.5])},
    {id: 'c01-prog', at: tP, field: weather, sweep: enter([1, 0.5])},
    {id: 'c01-hex', at: tHx, field: hexB, sweep: enter([1, 0.5])},
    {id: 'c01-auto-base', at: s8.start - 0.35, field: steel, sweep: enter([1, 0.5])},
    {id: 'c01-ship', at: tDNN, field: shipF, sweep: enter([1, 0.5])},
    {id: 'c01-attn', at: tDNA, field: attn, sweep: {kind: 'linear', origin: [0.62, 0.5], direction: [1, 0], speed: 0.9, jitterS: 0.03, tintFollowsWave: true}},
  ];
  const live: LiveLayer[] = [{fn: autoLive, region: autoRegion, from: s8.start - 0.1, to: s8.end - 0.2, fadeS: 0.45, speedHint: () => 0.6}];

  // ---------------------------------------------------------------- camera
  const P = pose(st, {uv: plotUV, pinsAcross: 150, screen: [0.6, 0.5], yaw: 0.1, pitch: 0.05});
  const Pauto = pose(st, {uv: [barU0 + 3.5 * barStep, 0.54], pinsAcross: 150, screen: [0.56, 0.47], yaw: 0.12, pitch: 0.06});
  const Pdnn = pose(st, {uv: [0.575, 0.5], pinsAcross: 150, screen: [0.55, 0.5], yaw: 0.08, pitch: 0.05});
  const camera: CameraKey[] = [
    {at: s7.start - 0.5, dur: 1.5, pose: P},
    // the montage travels: a steady lateral dolly to the right while each plot slides in from the right
    {at: s7.start + 1, dur: Math.max(1, s7.end - s7.start - 1.6), pose: dolly(pushIn(P, 0.02), 0.035), ease: 'inOutSine'},
    {at: s8.start - 0.6, dur: 1.4, pose: Pauto},
    {at: s8.start + 0.8, dur: Math.max(1, s8.end - s8.start - 1.4), pose: pushIn(Pauto, 0.05), ease: 'inOutSine'},
    {at: s9.start - 0.5, dur: 1.3, pose: Pdnn},
    {at: s9.start + 0.8, dur: Math.max(1, s9.end - s9.start - 1.2), pose: dolly(pushIn(Pdnn, 0.03), 0.02), ease: 'inOutSine'},
  ];
  const [px, py] = wxy(board, plotUV[0], plotUV[1]);
  const light: LightKey[] = [
    {at: s7.start - 0.4, dur: 1.2, key: 0.96, spread: 1.4, poolAt: [px - 0.02, py + 0.02], look: [0.05, -0.05]},
    {at: s8.start - 0.4, dur: 1.2, spread: 1.15, poolAt: [barU0 + 3.5 * barStep - 0.5, 0.0], look: [0, 0.05]},
    {at: s9.start - 0.3, dur: 1.2, spread: 1.4, poolAt: [px, py + 0.02], look: [0, 0]},
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const chip = (k: number) => chipSlot(W, H, k);
  const plate = (id: string, from: number, to: number, name: string, status: string): TimedNode => ({
    id,
    from: from - 0.1,
    to: to + 0.2,
    render: (t) => <NamePlate t={t} at={from} exitAt={to} name={name} status={status} />,
  });
  const json = (t: number, from: number, to: number) => {
    const k = env(t, from + 0.35, to, 0.35, 0.3);
    if (k <= 0.001) return null;
    const card = (u: number, lang: string, books: string) => {
      const q = at(t, u - 0.075, 0.585, 0.1 * relief);
      return (
        <div style={{position: 'absolute', left: Math.round(q.x), top: Math.round(q.y), ...pull(k, H)}}>
          {['{', `  "language": "${lang}",`, `  "books": ${books},`, '  …', '}'].map((l, j) => (
            <div key={j} style={{...monoStyle(H, 0.026, j === 1 || j === 2 ? color.text.display : color.text.tertiary), lineHeight: 1.45, textShadow: legible(H)}}>
              {l}
            </div>
          ))}
        </div>
      );
    };
    return (
      <>
        {card(0.47, 'no', '21')}
        {card(0.69, 'fi', '2798')}
      </>
    );
  };
  const pi8 = automatonPi(5);
  const overlays: TimedNode[] = [
    plate('c01-a1c-plate', tA, tW - 0.15, 'Assignment1Cloud', 'Coursework · NTNU PROG2005 · Mar 2024'),
    {
      id: 'c01-a1c-json',
      from: tA,
      to: tW,
      render: (t) => (
        <>
          {json(t, tA, tW - 0.1)}
          <Chip t={t} at={tA + 0.7} exitAt={tW - 0.1} {...chip(0)} repo="Assignment1Cloud" path="README.md" line="71-89" />
        </>
      ),
    },
    plate('c01-woe-plate', tW, tP - 0.15, 'WebOfEverything-', 'Student practice · Aug 2024'),
    {
      id: 'c01-woe-text',
      from: tW,
      to: tP,
      render: (t) => {
        const q = at(t, 0.6 - 0.16, 0.555 + 0.06, 0.3 * relief);
        const k = env(t, tW + 0.35, tP - 0.1, 0.35, 0.3);
        return (
          <>
            {k > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(q.x), top: Math.round(q.y - H * 0.05), ...pull(k, H)}}>
                <div style={{...capsStyle(H, MONO_MIN, 0.14), color: color.text.tertiary, textShadow: legible(H)}}>index.html · &lt;title&gt;</div>
                <div style={{...bodyStyle(H, 0.046, 650), letterSpacing: '-0.02em', textShadow: legible(H)}}>Web for everthing</div>
              </div>
            ) : null}
            <Chip t={t} at={tW + 0.6} exitAt={tP - 0.1} {...chip(1)} repo="WebOfEverything-" path="index.html" line={6} />
            <TypedChip t={t} at={tW + 1.0} exitAt={tP - 0.1} {...chip(0)} kind="WebOfEverything- · commit 6869a27" text="adding the spanish translation to the book title and name" />
          </>
        );
      },
    },
    plate('c01-prog-plate', tP, tHx - 0.15, 'PROG2053', 'Coursework · web · Oct 2024'),
    {
      id: 'c01-prog-cities',
      from: tP,
      to: tHx,
      render: (t) => {
        const k = env(t, tP + 0.35, tHx - 0.1, 0.35, 0.3);
        const names = ['Tokyo', 'New York', 'London', 'Sydney', 'Cairo'];
        return (
          <>
            {k > 0.001
              ? cities.map((c, j) => {
                  const q = at(t, c.u, c.v - 0.06, 0.34 * relief);
                  return (
                    <div key={j} style={{position: 'absolute', left: Math.round(q.x - H * 0.1), width: Math.round(H * 0.2), top: Math.round(q.y), textAlign: 'center', ...pull(k * easeOut(ramp(t, tP + 0.4 + j * 0.12, 0.3)), H)}}>
                      <span style={{...bodyStyle(H, 0.03, 600), textShadow: legible(H)}}>{names[j]}</span>
                    </div>
                  );
                })
              : null}
            {k > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(at(t, cities[0].u, 0.6).x - H * 0.03), top: Math.round(at(t, cities[0].u, 0.6).y - H * 0.03), ...pull(k, H)}}>
                <span style={{...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>refreshed every 10 min</span>
              </div>
            ) : null}
            <Chip t={t} at={tP + 0.6} exitAt={tHx - 0.1} {...chip(1)} repo="PROG2053" path="controller/weather.js" line="8-13" />
            <Chip t={t} at={tP + 0.95} exitAt={tHx - 0.1} {...chip(0)} repo="PROG2053" path="controller/weather.js" line={5} />
          </>
        );
      },
    },
    plate('c01-hex-plate', tHx, s7.end - 0.2, 'HexGTM', 'Empty · 1 commit · 2-line README · 31 Oct 2025'),
    {
      id: 'c01-hex-readme',
      from: tHx,
      to: s7.end,
      render: (t) => {
        const k = env(t, tHx + 0.5, s7.end - 0.3, 0.4, 0.35);
        return (
          <>
            {k > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(W * 0.45), top: Math.round(H * 0.205), width: Math.round(W * 0.48), ...pull(k, H)}}>
                <div style={{...capsStyle(H, MONO_MIN, 0.14), color: color.text.tertiary, textShadow: legible(H)}}>HexGTM/README.md · the whole file</div>
                <div style={{...monoStyle(H, 0.03, color.text.key, 600), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}># HexGTM</div>
                <div style={{...bodyStyle(H, 0.027, 450, color.text.display), whiteSpace: 'normal', marginTop: Math.round(H * 0.006), textShadow: legible(H)}}>
                  This repsitory is created to train the Graph Teslin Machine to predict the winner in the end of a hex game, two moves before the end and five moves before the end.
                </div>
              </div>
            ) : null}
            <Chip t={t} at={tHx + 0.9} exitAt={s7.end - 0.3} {...chip(1)} repo="HexGTM" path="README.md" line={2} />
            <TypedChip t={t} at={tHx + 1.3} exitAt={s7.end - 0.3} {...chip(0)} kind="HexGTM" text="commit 18e940e · the only commit" />
          </>
        );
      },
    },
    plate('c01-auto-plate', s8.start + 0.3, s8.end - 0.4, 'Dynamic_Visualization', 'Coursework · learning systems · Nov 2025'),
    {
      id: 'c01-auto-labels',
      from: s8.start,
      to: s8.end,
      render: (t) => {
        const k = env(t, s8u.start + 0.2, s8.end - 0.4, 0.4, 0.35);
        const pi = automatonPi(sAt(t));
        if (k <= 0.001) return null;
        const labels = pi.map((x, j) => {
          const q = at(t, barU0 + j * barStep, barV0 - 0.035, 0);
          return (
            <div key={j} style={{position: 'absolute', left: Math.round(q.x - H * 0.03), width: Math.round(H * 0.06), top: Math.round(q.y), textAlign: 'center'}}>
              <div style={{...monoStyle(H, 0.026, j >= 4 ? color.text.display : color.text.tertiary, 600), textShadow: legible(H)}}>{j + 1}</div>
            </div>
          );
        });
        const qL = at(t, barU0 - 0.035, barV0 - 0.035, 0);
        const qR = at(t, barU0 + 7 * barStep + 0.035, barV0 - 0.035, 0);
        const q8 = at(t, barU0 + 7 * barStep, barV0 + ((Math.max(0.012, pi[7]) * barHPins * board.p) / board.extH), 0.3 * relief);
        const sTxt = sAt(t).toFixed(1);
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {labels}
            <div style={{position: 'absolute', left: Math.round(qL.x - H * 0.16), top: Math.round(qL.y), ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>exclude ←</div>
            <div style={{position: 'absolute', left: Math.round(qR.x), top: Math.round(qR.y), ...monoStyle(H, MONO_MIN, color.accent.mintLabel), textShadow: legible(H)}}>→ include</div>
            <div style={{position: 'absolute', left: Math.round(q8.x + H * 0.03), top: Math.round(q8.y - H * 0.02), ...pull(env(t, w95.start - 0.1, s8.end - 0.4, 0.4, 0.35), H)}}>
              <span style={{fontFamily: font.sans, fontWeight: 680, fontSize: Math.round(H * 0.07), letterSpacing: '-0.03em', color: color.text.display, textShadow: legible(H)}}>
                ≈ {Math.round(pi[7] * 100)}%
              </span>
              <span style={{...bodyStyle(H, 0.03, 500, color.text.secondary), marginLeft: Math.round(H * 0.012), textShadow: legible(H)}}>
                in state <Em>8</Em>
              </span>
            </div>
            <Sliders t={t} x={W * layout.marginLeftW} y={H * 0.49} s={sAt(t)} sTxt={sTxt} />
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.215), ...monoStyle(H, MONO_MIN, color.text.chipDim), lineHeight: 1.6, textShadow: legible(H)}}>
              {[4, 5, 6, 7].map((j) => (
                <div key={j}>
                  π{j + 1} <span style={{color: color.text.display}}>{automatonPi(5)[j].toFixed(4)}</span>
                </div>
              ))}
              <div style={{color: color.text.tertiary}}>π1–π4 &lt; 0.00001</div>
              <div style={{color: color.text.tertiary, marginTop: Math.round(H * 0.008)}}>at the default sliders</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'c01-auto-chips',
      from: s8.start,
      to: s8.end,
      render: (t) => (
        <>
          <Chip t={t} at={s8u.start + 0.8} exitAt={s8.end - 0.4} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="Dynamic_Visualization" path="literal_automaton_visualization.py" line="5-6" />
          <Chip t={t} at={w95.start + 0.2} exitAt={s8.end - 0.4} x={Math.round(W * 0.962)} y={Math.round(H * 0.142)} repo="Dynamic_Visualization" path="literal_automaton_visualization.py" line="121-166" />
        </>
      ),
    },
    plate('c01-dnn-plate', tDNN + 0.1, tDNA - 0.05, 'DNN', 'Coursework · deep neural networks · assignments 1–6'),
    plate('c01-dna-plate', tDNA + 0.1, s9.end - 0.3, 'Deep-Neural-Networks-Assignments', 'Coursework · UiA DNN course · all 10 · 2026'),
    {
      id: 'c01-dnn-text',
      from: tDNN,
      to: s9.end,
      render: (t) => {
        const k1 = env(t, tDNN + 0.4, tDNA, 0.35, 0.3);
        const k2 = env(t, tDNA + 0.4, s9.end - 0.3, 0.35, 0.3);
        const qs = at(t, 0.44 - 0.08, 0.535 - 0.155, 0);
        const qa = at(t, 0.71 - 0.08, 0.535 - 0.155, 0);
        const words = ['Darth', 'Vader', 'is', 'the', 'villain'];
        return (
          <>
            {k1 > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(Math.max(W * layout.marginLeftW, qs.x - H * 0.1)), top: Math.round(qs.y), width: Math.round(W * 0.28), ...pull(k1, H)}}>
                <div style={{...bodyStyle(H, 0.03, 500)}}>
                  LIME, run three times on one ship image: correlation as low as <b style={{color: color.text.key}}>−0.33</b>
                </div>
              </div>
            ) : null}
            {k2 > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(qa.x), top: Math.round(qa.y), ...pull(k2, H)}}>
                <div style={{...capsStyle(H, MONO_MIN, 0.14), color: color.text.tertiary, textShadow: legible(H)}}>self-attention by hand</div>
                <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.004), textShadow: legible(H)}}>{words.join(' ')}</div>
                <div style={{...bodyStyle(H, 0.03, 500), marginTop: Math.round(H * 0.006), textShadow: legible(H)}}>
                  ‘Vader’ → <b style={{color: color.text.key}}>0.9607</b> of its attention on ‘the’
                </div>
              </div>
            ) : null}
            {k2 > 0.001 ? <Bracket t={t} at={tDNA + 0.2} exitAt={s9.end - 0.3} x0={at(t, 0.44, 0.7).x} x1={at(t, 0.71, 0.7).x} y={at(t, 0.6, 0.7).y} /> : null}
            <Chip t={t} at={tDNN + 0.6} exitAt={tDNA} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="DNN" path="assignment-5/report.md" line={31} />
            <Chip t={t} at={tDNA + 0.4} exitAt={tDNA + 2.5} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="Deep-Neural-Networks-Assignments" path="README.md" line={3} />
            <Chip t={t} at={tDNA + 2.7} exitAt={s9.end - 0.3} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="Deep-Neural-Networks-Assignments" path="Assignment 2/results/part_a.json" line={1} />
          </>
        );
      },
    },
  ];
  void pi8;
  void pinAt;

  const pixie: PixieCue[] = [
    {frame: f(s7.start + 0.3), activity: 'searching', detail: 'Search 66 repos for “Tsetlin”'},
    {frame: f(tHx + 0.4), activity: 'reading', detail: 'Read HexGTM/README.md (2 lines)'},
    {frame: f(s8.start + 0.4), activity: 'thinking', detail: 'Planning the next step…'},
    {frame: f(s9.start + 0.3), activity: 'reading', detail: 'Read Assignment 2/results/part_a.json'},
  ];

  return {beats, live, camera, light, overlays, pixie, endPose: dolly(pushIn(Pdnn, 0.03), 0.02)};
};

/** A thin bracket of pins' light joining two plots: one course, two repositories. */
const Bracket: React.FC<{t: number; at: number; exitAt: number; x0: number; x1: number; y: number}> = ({t, at, exitAt, x0, x1, y}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.5, 0.35);
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  const d = H * 0.02;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: k}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <path d={`M ${x0} ${y + d} L ${x0} ${y} L ${x1} ${y} L ${x1} ${y + d}`} fill="none" stroke={color.accent.mintLabel} strokeWidth={hair * 1.5} />
      </svg>
      <div style={{position: 'absolute', left: Math.round((x0 + x1) / 2 - H * 0.4), width: Math.round(H * 0.8), top: Math.round(y - H * 0.042), textAlign: 'center'}}>
        <span style={{...monoStyle(H, MONO_MIN, color.accent.mintLabel), textShadow: legible(H)}}>one course · two repositories · topics 1–6 match</span>
      </div>
    </div>
  );
};

export const unusedPin = (s: PinSample) => s;

/** The four sliders of the assignment, as set (s sweeps 1 to 25 and back). */
const Sliders: React.FC<{t: number; x: number; y: number; s: number; sTxt: string}> = ({x, y, s, sTxt}) => {
  const {height: H} = useVideoConfig();
  const rows: Array<[string, number, string]> = [
    ['s', (s - 1) / 24, sTxt],
    ['P(L|Y)', 0.8, '0.80'],
    ['P(Y)', 0.5, '0.50'],
    ['P(L̄|Ȳ)', 0.2, '0.20'],
  ];
  const w = H * 0.26;
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y)}}>
      {rows.map(([name, k, val], j) => (
        <div key={j} style={{display: 'flex', alignItems: 'center', gap: Math.round(H * 0.012), height: Math.round(H * 0.04)}}>
          <span style={{...monoStyle(H, MONO_MIN, color.text.chipDim), width: Math.round(H * 0.11), textShadow: legible(H)}}>{name}</span>
          <span style={{position: 'relative', width: Math.round(w), height: Math.round(H * 0.006), borderRadius: 4, background: 'rgba(228,234,231,0.2)'}}>
            <span style={{position: 'absolute', left: Math.round(w * k - H * 0.009), top: Math.round(-H * 0.006), width: Math.round(H * 0.018), height: Math.round(H * 0.018), borderRadius: '50%', background: j === 0 ? color.accent.mint : color.text.display, boxShadow: j === 0 ? `0 0 ${Math.round(H * 0.012)}px ${color.accent.mintGlow}` : undefined}} />
          </span>
          <span style={{...monoStyle(H, MONO_MIN, j === 0 ? color.text.display : color.text.chipDim), marginLeft: Math.round(H * 0.012), textShadow: legible(H)}}>{val}</span>
        </div>
      ))}
      <div style={{height: hair}} />
    </div>
  );
};
