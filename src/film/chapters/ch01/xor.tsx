import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {projectToScreen, pushIn, rigPoseAt, type CameraKey, type CameraPose} from '../../../engine/camera';
import {flatField, pinAt, type Beat, type FieldFn, type LightKey, type LiveFieldFn, type LiveLayer, type Magnet} from '../../../engine/pins';
import type {PixieCue} from '../../../pixie';
import {HANDOFF} from '../../handoff';
import type {TimedNode} from '../../types';
import xorRun from '../../../data/ch01/xor.json';
import {bodyStyle, capsStyle, Chip, chipSlot, clamp01, easeOut, env, legible, monoStyle, MONO_MIN, Oplus, pull, ramp, Statement} from './kit';
import {pose, wxy, type Part, type Stage} from './stage';

// 01.10 back on the website: a small Tsetlin Machine learns noisy XOR, and says when it has found
// it; then every decision in the film starts here: a pin that is true, or false.

interface Snap {
  sample: number;
  epoch: number;
  ta: number[];
  acc: number | null;
}

const RUN = xorRun as unknown as {seed: number; features: number; clauses: number; states: number; found: {epoch: number; clauses: string[]; acc: number}; snaps: Snap[]};
const NL = 12;
const NAMES = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'];

export interface XorOut extends Part {
  endPose: CameraPose;
}

export const buildXor = (st: Stage): XorOut => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const ch = tl.chapter('01');
  const s10 = tl.scene('01.10');
  const u27 = tl.utt('u0127');
  const u28 = tl.utt('u0128');
  const wFound = tl.word('u0127', 'found');
  const wTrue = tl.word('u0128', 'true');
  const wFalse = tl.word('u0128', 'false');

  // ---------------------------------------------------------------- the automaton bars
  const cu = 0.585;
  const cv = 0.5;
  const colStep = 6.2;
  const rowStep = 8.6;
  const barCU = (k: number) => cu + (k - (NL - 1) / 2) * colStep * board.p + (k >= 6 ? 1.6 * board.p : -1.6 * board.p);
  const barCV = (j: number) => cv + (((1.5 - j) * rowStep * board.p) / board.extH);
  const learnFrom = s10.start + 0.9;
  const learnTo = wFound.start - 0.35;
  const N = RUN.states;
  const snapAt = (t: number) => {
    const n = RUN.snaps.length - 1;
    const x = clamp01((t - learnFrom) / Math.max(0.5, learnTo - learnFrom));
    // learning starts fast and settles (the page's epochs slow down as the clauses converge)
    const k = Math.sqrt(x) * n;
    const i = Math.min(n - 1, Math.floor(k));
    return {a: RUN.snaps[i], b: RUN.snaps[i + 1], f: k - i};
  };
  const outAt = wTrue.start - 0.5;
  const barsLive: LiveFieldFn = (u, v, _i, t) => {
    if (t >= outAt + 0.5) return null;
    // which bar is this pin under?
    const kf = Math.round((u - cu) / (colStep * board.p) + (NL - 1) / 2);
    const jf = Math.round(1.5 - ((v - cv) * board.extH) / (rowStep * board.p));
    if (kf < 0 || kf >= NL || jf < 0 || jf >= 4) return null;
    const du = Math.abs(u - barCU(kf)) / board.p;
    const dv = (Math.abs(v - barCV(jf)) * board.extH) / board.p;
    if (du > 2.1 || dv > 2.6) return {h: 0, tint: 0.62};
    const {a, b, f: fr} = snapAt(t);
    const ta = a.ta[jf * NL + kf] * (1 - fr) + b.ta[jf * NL + kf] * fr;
    const x = ta / (2 * N);
    const included = ta > N;
    return {h: 0.04 + 0.6 * x, tint: included ? 1.0 : 0.55, glow: included ? 0.35 + 0.6 * clamp01((ta - N) / 40) : 0};
  };
  const region: [number, number, number, number] = [cu - 0.25, cv - 0.16, cu + 0.25, cv + 0.16];

  // the closing pair: one pin true (raised, lit), one false (flush, dark)
  const pT = pinAt(board, 0.62, 0.5);
  const pF = pinAt(board, 0.72, 0.5);
  const truePin = (h: number, glow: number): FieldFn => (u, v, i) => (i === pT ? {h, tint: 1.0, glow} : i === pF ? {h: 0, tint: 0.22} : {h: 0, tint: 0.88});
  const beats: Beat[] = [
    // the hand behind the pins sweeps the attention matrix away; the bars rise where it passes
    {id: 'c01-xor-base', at: s10.start - 0.55, field: (u, v, i) => (u > cu - 0.25 && u < cu + 0.25 && v > cv - 0.16 && v < cv + 0.16 ? {h: 0, tint: 0.62} : {h: 0, tint: 0.9}), sweep: {kind: 'linear', origin: [0.25, 0.5], direction: [1, 0], speed: 0.65, jitterS: 0.04, tintFollowsWave: true}},
    {id: 'c01-true-false', at: outAt, field: truePin(0.04, 0), sweep: {kind: 'random', origin: [0.6, 0.5], speed: 1, spreadS: 0.7, jitterS: 0.04, tintFollowsWave: true}},
    {id: 'c01-true', at: wTrue.start - 0.05, field: truePin(1.05, 1)},
    {id: 'c01-false', at: wFalse.start - 0.05, field: (u, v, i) => (i === pT ? {h: 1.05, tint: 1.0, glow: 1} : i === pF ? {h: 0, tint: 0.12} : {h: 0, tint: 0.88})},
    // the bare wall the next chapter starts from
    {id: 'c01-handoff', at: ch.end - 2.4, field: HANDOFF, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.9, jitterS: 0.05, tintFollowsWave: true}},
  ];
  void flatField;
  const magnets: Magnet[] = [
    {
      from: s10.start - 0.9,
      to: s10.start + 0.5,
      amp: 0.8,
      sigma: 0.05,
      path: (t) => {
        const k = clamp01((t - (s10.start - 0.9)) / 1.4);
        const e = k * k * (3 - 2 * k);
        return [0.3 + 0.55 * e, 0.5 + 0.04 * Math.sin(e * Math.PI)];
      },
    },
  ];
  const live: LiveLayer[] = [{fn: barsLive, region, from: s10.start - 0.2, to: outAt + 0.5, fadeS: 0.4, speedHint: () => 0.5}];

  // ---------------------------------------------------------------- camera and light
  const P = pose(st, {uv: [cu + 0.02, cv], pinsAcross: 150, screen: [0.58, 0.47], yaw: 0.16, pitch: 0.12});
  const Pend = pose(st, {uv: [0.67, 0.5], z: 0.3 * relief, pinsAcross: 58, screen: [0.79, 0.52], yaw: 0.22, pitch: 0.1});
  const camera: CameraKey[] = [
    {at: s10.start - 0.7, dur: 1.6, pose: P},
    {at: s10.start + 1, dur: Math.max(1, outAt - s10.start - 1.4), pose: pushIn(P, 0.06), ease: 'inOutSine'},
    {at: outAt - 0.2, dur: 1.4, pose: Pend},
    {at: outAt + 1.4, dur: Math.max(1, ch.end - 2.6 - outAt - 1.4), pose: pushIn(Pend, 0.05), ease: 'inOutSine'},
    // back to the bare wall's pose, where every chapter begins and ends
    {at: ch.end - 2.4, dur: 2.2, pose: st.P0},
  ];
  const [x0, y0] = wxy(board, cu, cv);
  const [xt, yt] = wxy(board, 0.66, 0.5);
  const light: LightKey[] = [
    {at: s10.start - 0.5, dur: 1.4, key: 0.98, spread: 1.2, poolAt: [x0, y0 + 0.02], look: [0.1, -0.08]},
    {at: outAt, dur: 1.2, spread: 0.9, poolAt: [xt, yt + 0.01], look: [0.25, -0.1]},
    // the default light, handed to the next chapter
    {at: ch.end - 2.4, dur: 2.2, key: 1, pool: 1, spread: 1, poolAt: [0, 0], look: [0, 0], env: 1},
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const chip = (k: number) => chipSlot(W, H, k);
  const lit = (name: string): React.ReactNode =>
    name.startsWith('¬') ? (
      <>
        <span>¬</span>x<sub style={{fontSize: '0.72em'}}>{name.slice(2)}</sub>
      </>
    ) : (
      <>
        x<sub style={{fontSize: '0.72em'}}>{name.slice(1)}</sub>
      </>
    );
  const labelNames = [...NAMES, ...NAMES.map((n) => `¬${n}`)];
  const clauseTxt = RUN.found.clauses;
  const overlays: TimedNode[] = [
    {
      id: 'c01-xor-labels',
      from: s10.start,
      to: outAt + 0.6,
      render: (t) => {
        const k = env(t, s10.start + 0.4, Math.min(outAt + 0.3, u28.start - 0.1), 0.5, 0.4);
        if (k <= 0.001) return null;
        const found = t >= wFound.start - 0.1;
        const {a, b, f: fr} = snapAt(t);
        const epoch = a.epoch * (1 - fr) + b.epoch * fr;
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {labelNames.map((n, kk) => {
              const q = at(t, barCU(kk), barCV(0) + (6.2 * board.p) / board.extH, 0);
              return (
                <div key={kk} style={{position: 'absolute', left: Math.round(q.x - H * 0.03), width: Math.round(H * 0.06), top: Math.round(q.y - H * 0.03), textAlign: 'center', ...monoStyle(H, 0.026, kk < 2 || (kk >= 6 && kk < 8) ? color.text.display : color.text.tertiary), textShadow: legible(H)}}>
                  {lit(n)}
                </div>
              );
            })}
            {[0, 1, 2, 3].map((j) => {
              const q = at(t, barCU(0) - 5.5 * board.p, barCV(j), 0);
              return (
                <div key={j} style={{position: 'absolute', right: Math.round(W - q.x), top: Math.round(q.y - H * 0.016), textAlign: 'right', whiteSpace: 'pre', ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>
                  {`C${j + 1} ${j % 2 === 0 ? '+' : '−'}`}
                  {found ? <span style={{color: j % 2 === 0 ? color.accent.mint : color.text.display, marginLeft: Math.round(H * 0.012)}}>{clauseTxt[j].replace(/x(\d)/g, 'x$1')}</span> : null}
                </div>
              );
            })}
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.085), ...capsStyle(H, MONO_MIN, 0.16), color: color.text.chipDim, textShadow: legible(H)}}>
              {`AnwarDebes.github.io/tm/ · noisy XOR · epoch ${Math.min(RUN.found.epoch, Math.floor(epoch + 1e-6))}`}
            </div>
            {found ? (
              <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.13), ...pull(easeOut(ramp(t, wFound.start - 0.1, 0.5)), H)}}>
                <div style={{fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(H * 0.06), letterSpacing: '-0.03em', color: color.text.display, textShadow: legible(H)}}>
                  {typeOn('It found XOR on its own', t, wFound.start - 0.1, 30)}
                </div>
                <div style={{...bodyStyle(H, 0.032, 500, color.text.secondary), marginTop: Math.round(H * 0.012), opacity: easeOut(ramp(t, wFound.start + 0.7, 0.4)), textShadow: legible(H)}}>
                  <span style={{fontFamily: font.mono, color: color.text.display}}>x<sub>1</sub></span>
                  <Oplus size={Math.round(H * 0.028)} c={color.accent.mint} />
                  <span style={{fontFamily: font.mono, color: color.text.display}}>x<sub>2</sub></span>
                  <span> · ignores x<sub>3</sub> to x<sub>6</sub></span>
                </div>
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'c01-xor-chips',
      from: s10.start,
      to: outAt + 0.6,
      render: (t) => (
        <>
          <Chip t={t} at={u27.start + 0.8} exitAt={outAt + 0.3} {...chip(1)} repo="AnwarDebes.github.io" path="tm/tm.js" line="1-60" />
          <Chip t={t} at={wFound.start + 0.3} exitAt={outAt + 0.3} {...chip(0)} repo="AnwarDebes.github.io" path="tm/index.html" line={122} />
          <Chip t={t} at={u27.start + 1.3} exitAt={outAt + 0.3} {...chip(2)} repo="AnwarDebes.github.io" path="tm/index.html" line={134} />
        </>
      ),
    },
    {
      id: 'c01-closing',
      from: u28.start - 0.3,
      to: ch.end - 1.6,
      render: (t) => (
        <>
          <Statement t={t} words={u28.words} exitAt={ch.end - 2.2} y={H * 0.12} maxWidthW={0.44} />
          <TFLabel t={t} at={wTrue.start + 0.05} exitAt={ch.end - 2.3} q={at(t, 0.62, 0.5, 1.05 * relief)} text="true" tone={color.accent.mint} />
          <TFLabel t={t} at={wFalse.start + 0.05} exitAt={ch.end - 2.3} q={at(t, 0.72, 0.5, 0)} text="false" tone={color.text.secondary} />
        </>
      ),
    },
  ];

  const pixie: PixieCue[] = [
    {frame: f(s10.start + 0.4), activity: 'running', detail: 'Run tm/tm.js'},
    {frame: f(wFound.start), activity: 'success', detail: 'It found XOR on its own'},
    {frame: f(u28.start + 0.5), activity: 'idle', detail: ''},
  ];

  return {beats, magnets, live, camera, light, overlays, pixie, captionSkip: ['u0128'], endPose: st.P0};
};

const typeOn = (text: string, t: number, at: number, cps: number) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - at) * cps))));

const TFLabel: React.FC<{t: number; at: number; exitAt: number; q: {x: number; y: number}; text: string; tone: string}> = ({t, at, exitAt, q, text, tone}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(q.x - H * 0.14), width: Math.round(H * 0.28), top: Math.round(q.y + H * 0.03), textAlign: 'center', ...pull(k, H)}}>
      <span style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(H * 0.05), color: tone, textShadow: legible(H)}}>{text}</span>
    </div>
  );
};
