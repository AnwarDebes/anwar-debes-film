import React from 'react';
import {random} from 'remotion';
import {ChapterCard} from '../../../engine/type';
import {frameOn, pushIn} from '../../../engine/camera';
import {ruleLineField, type FieldFn, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {boxesField, ground, pinLattice, pinsField, strokesField} from '../ch03/kit/fields';
import {Chip, MonoKicker, Pill, env, pullStyle, useFrameSize, white} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {LIT, NAVY} from './common';

// 04.0 the gate: the mint thread reaches a cube engraved with a single ∀, which rises and clears.
// 04.1 red-teaming as a stream of probes against a wall, then the 2^256 inputs no test can try.

const TWO_256 = '115792089237316195423570985008687907853269984665640564039457584007913129639936';
if (TWO_256 !== (2n ** 256n).toString()) throw new Error('ch04: 2^256 digits');

export const FIELD_TL: [number, number] = [0.47, 0.67];

/** One probe of the stream: a short bar of word-glyphs (never legible text), seeded. */
interface Probe {
  y: number;
  start: number;
  speed: number;
  words: number[];
}

const probesFor = (n: number, from: number, to: number): Probe[] =>
  Array.from({length: n}, (_, k) => {
    const r = (s: string) => random(`c04-probe-${k}-${s}`);
    const words = Array.from({length: 2 + Math.floor(r('n') * 4)}, (_, j) => 0.6 + 1.6 * random(`c04-probe-${k}-w${j}`));
    return {y: 0.16 + 0.54 * r('y'), start: from + (to - from) * (k / n) + 0.15 * r('t'), speed: 0.55 + 0.35 * r('s'), words};
  });

const Stream: React.FC<{t: number; probes: Probe[]; wallX: number; from: number; to: number; passedAt: (k: number) => number}> = ({t, probes, wallX, from, to, passedAt}) => {
  const {W, H} = useFrameSize();
  const k = env(t, from, 0.4, to, 0.5);
  if (k <= 0.001) return null;
  const unit = 0.011 * H;
  let passed = 0;
  for (let i = 0; i < probes.length; i++) if (t >= passedAt(i)) passed++;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: k}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {probes.map((p, i) => {
          const age = t - p.start;
          if (age < 0) return null;
          const len = p.words.reduce((a, b) => a + b + 0.45, 0) * unit * 2.2;
          const travel = p.speed * W * 0.62;
          const xHit = wallX - len;
          const tHit = (xHit + len + 0.05 * W) / travel;
          let x: number;
          let alpha = 1;
          if (age < tHit) x = -len - 0.05 * W + age * travel;
          else {
            // bounce: back off the wall, slowing, and fade
            const a2 = age - tHit;
            x = xHit - a2 * travel * 0.45 + a2 * a2 * 0.0;
            alpha = Math.max(0, 1 - a2 / 0.9);
          }
          if (alpha <= 0) return null;
          const y = p.y * H;
          let cx = x;
          return (
            <g key={i} opacity={alpha * 0.85}>
              {p.words.map((w, j) => {
                const ww = w * unit * 2.2;
                const r = <rect key={j} x={cx} y={y} width={ww} height={unit * 0.9} rx={unit * 0.45} fill={age >= tHit ? color.text.secondary : color.text.caption} />;
                cx += ww + unit * 0.9;
                return r;
              })}
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.6 * H), fontFamily: font.mono, fontSize: Math.round(0.03 * H), color: color.text.caption, whiteSpace: 'nowrap'}}>
        probes passed: <span style={{color: color.text.key, fontWeight: 600, fontVariantNumeric: 'tabular-nums'}}>{passed}</span>
        <span style={{color: color.text.secondary}}>{'   ·   '}probe {passed} + 1: </span>
        <span style={{color: color.signal.amber, fontWeight: 600}}>?</span>
      </div>
    </div>
  );
};

/** The 78 digits of 2^256, typed across the frame. */
const Digits: React.FC<{t: number; at: number; endAt: number; exitAt: number; line: number}> = ({t, at, endAt, exitAt, line}) => {
  const {W, H} = useFrameSize();
  const k = env(t, at - 0.2, 0.3, exitAt, 0.4);
  if (k <= 0.001) return null;
  const n = Math.max(0, Math.min(78, Math.floor(((t - at) / Math.max(0.1, endAt - at)) * 78)));
  const shown = TWO_256.slice(0, n);
  const fs = Math.round(0.0335 * H);
  return (
    <div style={{position: 'absolute', left: Math.round(0.055 * W), right: Math.round(0.055 * W), top: Math.round(0.33 * H), padding: `${Math.round(0.025 * H)}px ${Math.round(0.015 * W)}px`, borderRadius: Math.round(0.02 * H), background: 'rgba(4,8,12,0.72)', boxShadow: `0 0 ${Math.round(0.06 * H)}px rgba(4,8,12,0.7)`, ...pullStyle(k, H)}}>
      <div style={{fontFamily: font.mono, fontSize: fs, lineHeight: 1.4, letterSpacing: '0.02em', color: color.text.display, wordBreak: 'break-all', whiteSpace: 'normal', maxWidth: Math.round(0.86 * W)}}>
        {shown}
        {n < 78 ? <span style={{display: 'inline-block', width: fs * 0.55, height: fs * 0.95, background: color.accent.mint, transform: `translateY(${(fs * 0.14).toFixed(1)}px)`}} /> : null}
      </div>
      <div style={{marginTop: Math.round(0.022 * H), fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.036 * H), color: color.text.caption, opacity: env(t, line, 0.5)}}>
        Checking one input per nanosecond since the Big Bang would not dent it.
      </div>
    </div>
  );
};

export const buildGateAndProbes = (k: SceneKit) => {
  const {board, aspect, c, acc, home, ctx} = k;
  const ch = c.tl.chapter('04');
  const S0 = c.sc('04.0');
  const S1 = c.sc('04.1');
  const S2 = c.sc('04.2');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const navy = ground(NAVY);

  // ---------------------------------------------------------------- the gate: thread, ∀ cube, rise, clear
  const box = {u: 0.705, v: 0.5, w: 38, h: 34};
  // chapter 03's mint thread (v 0.5) runs into the cube's left face; past it the wall is the cube
  const threadTo = box.u - (box.w / 2 + 1) * board.p;
  const thread = ruleLineField(board, {v: 0.5, u0: 0.0, u1: threadTo}, {glow: 1, h: 0.1});
  const withThread = (f: FieldFn): FieldFn => (u, v, i) => (u < threadTo ? (thread(u, v, i).glow ?? 0) > 0.5 ? thread(u, v, i) : f(u, v, i) : f(u, v, i));
  // ∀: two diagonals from the top corners to the foot, and the crossbar, in pins from the centre
  const forall = (look: Look, base: FieldFn) => strokesField(board, {u: box.u, v: box.v}, [[-9, 11, 0, -11], [9, 11, 0, -11], [-5.2, 1.5, 5.2, 1.5]], 2.6, look, base);
  const cubeDark = boxesField(board, [{...box, radius: 1.2, look: {h: 0.5, tint: 0.24}}], navy);
  const cubeGlass = boxesField(board, [{...box, radius: 1.2, look: {h: 0.5, tint: [0.6, 0.82, 1.0], glow: 0.06}}], navy);
  // chapter 03 hands over the mint thread along the wall: it runs on to the cube's face
  acc.beat({id: 'gate-rise', at: S0.start, field: withThread(forall({h: 0.62, tint: [0.9, 1.1, 1.06], glow: 0.9}, cubeDark)), sweep: {origin: [box.u, box.v], speed: 0.5, jitterS: 0.08}});
  acc.beat({
    id: 'gate-clear',
    at: S0.start + 0.9,
    field: withThread(forall({h: 0.62, tint: [0.95, 1.15, 1.1], glow: 1}, cubeGlass)),
    sweep: {kind: 'linear', origin: [box.u, box.v + (box.h / 2) * (board.p / board.extH)], direction: [0, -1], speed: 0.3, jitterS: 0.05, tintFollowsWave: true},
  });

  // the wall the probes bounce off: a raised band of pins on the right
  const wallU = 0.645;
  const guardWall = boxesField(board, [{u: wallU, v: 0.5, w: 5, h: 64, radius: 1.5, look: {h: 0.55, tint: [0.72, 0.9, 1.05], glow: 0.12}}], navy);
  acc.beat({id: 'guard-wall', at: S0.end - 0.5, field: guardWall, sweep: {origin: [box.u, box.v], speed: 0.85, jitterS: 0.07}});

  const gatePose = frameOn(board, {uv: [0.62, 0.5], pinsAcross: 130, yaw: 0.16, pitch: 0.08, aspect});
  const streamPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 140, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push(
    {at: ch.start, pose: home},
    {at: ch.start + 0.2, dur: S0.start - ch.start + 0.4, pose: gatePose, ease: 'camera'},
    {at: S0.end - 0.5, dur: 1.5, pose: streamPose, ease: 'camera'},
    {at: S0.end + 1.0, dur: c.u('u0402').start - S0.end - 1.0, pose: pushIn(streamPose, 0.04), ease: 'inOutSine'},
  );
  const bx = box.u - 0.5;
  const by = box.v * board.extH - board.extH / 2;
  acc.light.push(
    {at: ch.start, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1},
    {at: S0.start, dur: 0.6, key: 0.82, spread: 0.8, poolAt: [bx, by], look: [0.12, -0.06]},
    {at: S0.start + 0.9, dur: 1.3, key: 1.0, spread: 1.0},
    {at: S0.end, dur: 1.2, key: 1.0, spread: 1.3, poolAt: [0.0, 0.0], look: [0, 0]},
  );

  acc.overlay({
    id: 'card',
    from: S0.start,
    to: S0.end + 0.6,
    render: (t) => <ChapterCard index="04" kicker="veritas" title="Prove *it.*" kind="displayM" maxWidth={Math.round(0.5 * W)} at={S0.start + 0.12} exitAt={S0.end - 0.15} t={t} />,
  });

  // ---------------------------------------------------------------- 04.1 the stream of probes
  const streamFrom = S1.start - 0.2;
  const streamTo = c.u('u0402').start - 0.3;
  const probes = probesFor(110, streamFrom, streamTo - 1.0);
  const wallX = 0.6 * W;
  const passedAt = (i: number) => {
    const p = probes[i];
    const len = p.words.reduce((a, b) => a + b + 0.45, 0) * 0.011 * H * 2.2;
    return p.start + (wallX + 0.05 * W) / (p.speed * W * 0.62) - len / (p.speed * W * 0.62);
  };
  acc.overlay({
    id: 'stream',
    from: streamFrom,
    to: streamTo + 0.6,
    render: (t) => (
      <>
        <Stream t={t} probes={probes} wallX={wallX} from={streamFrom} to={streamTo} passedAt={passedAt} />
        <MonoKicker text="red-teaming · every probe bounces" x={left} y={Math.round(0.075 * H)} k={env(t, S1.start + 0.2, 0.4, streamTo)} />
        <Chip t={t} at={c.w('u0401', 'nothing')} exitAt={streamTo} repo="veritas" path="README.md" line="20-22" x={left} y={Math.round(0.675 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- the 256 features, every pattern
  const lattice = pinLattice(board, FIELD_TL, 16, 16, 2);
  const DIM: Look = {h: 0.06, tint: [0.42, 0.55, 0.72]};
  const ON: Look = {h: 0.4, tint: LIT, glow: 0.9};
  const pattern = (seed: string, density: number) => {
    const m = new Map<number, Look>();
    for (let i = 0; i < 256; i++) {
      const p = lattice[i];
      if (p >= 0) m.set(p, random(`${seed}-${i}`) < density ? ON : DIM);
    }
    return pinsField(m, navy);
  };
  const fAt = c.w('u0402', 'two') - 0.2;
  acc.beat({id: 'field', at: fAt - 0.3, field: pattern('c04-none', 0), sweep: {origin: [0.6, 0.5], speed: 0.8, jitterS: 0.05}});
  const patAt = c.w('u0402', 'every');
  const patternTimes = [0, 1, 2, 3, 4, 5].map((j) => patAt + j * 0.22);
  patternTimes.forEach((at, j) => acc.beat({id: `pattern-${j}`, at, field: pattern(`c04-pat-${j}`, 0.32)}));
  // the field doubles, doubles again, and dissolves into grain across the whole wall
  const doubleAt = c.u('u0402').end - 0.15;
  const fine = (seed: string, step: number, cols: number, rows: number, tl: [number, number]) => {
    const lat = pinLattice(board, tl, cols, rows, step);
    const m = new Map<number, Look>();
    for (let i = 0; i < lat.length; i++) if (lat[i] >= 0) m.set(lat[i], random(`${seed}-${i}`) < 0.34 ? ON : DIM);
    return pinsField(m, navy);
  };
  acc.beat({id: 'double-1', at: doubleAt, field: fine('c04-d1', 1, 32, 32, FIELD_TL), sweep: {origin: [0.56, 0.5], speed: 0.9, jitterS: 0.04}});
  acc.beat({id: 'double-2', at: doubleAt + 0.55, field: fine('c04-d2', 1, 64, 50, [0.39, 0.78]), sweep: {origin: [0.56, 0.5], speed: 0.9, jitterS: 0.04}});
  const grainAt = c.w('u0403', 'try');
  const grain: FieldFn = (_u, _v, i) => (random(`c04-grain-${i}`) < 0.33 ? {h: 0.1, tint: [0.66, 0.8, 0.95], glow: 0.05} : {h: 0, tint: [0.42, 0.53, 0.7]});
  acc.beat({id: 'grain', at: grainAt, field: grain, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.7, jitterS: 0.04, tintFollowsWave: true}});

  const fieldPose = frameOn(board, {uv: [0.6, 0.5], pinsAcross: 132, yaw: 0.12, pitch: 0.07, aspect});
  acc.camera.push({at: fAt - 0.4, dur: 1.4, pose: fieldPose, ease: 'camera'}, {at: fAt + 1.0, dur: S1.end - fAt - 1.0, pose: pushIn(fieldPose, 0.05), ease: 'inOutSine'});

  const digitsAt = c.u('u0403').end + 0.05;
  const digitsEnd = S1.end - 0.8;
  acc.overlay({
    id: 'inputs',
    from: fAt,
    to: S2.start + 0.4,
    render: (t) => (
      <>
        <MonoKicker text="256 word features · every pattern is an input" x={left} y={Math.round(0.075 * H)} k={env(t, fAt + 0.3, 0.4, grainAt)} />
        <Pill k={env(t, c.w('u0403', 'all'), 0.4, S2.start - 0.3)} x={left} y={Math.round(0.26 * H)} sizeH={0.03}>
          2<sup style={{fontSize: '0.62em'}}>256</sup> ≈ {white('1.16 × 10')}
          <sup style={{fontSize: '0.62em', color: color.text.key}}>77</sup> possible inputs
        </Pill>
        <Digits t={t} at={digitsAt} endAt={digitsEnd} exitAt={S2.start - 0.25} line={digitsAt + 0.4} />
        <Chip t={t} at={digitsAt + 0.8} exitAt={S2.start - 0.25} repo="veritas" path="live/index.html" line={82} x={left} y={Math.round(0.6 * H)} />
        <Chip t={t} at={fAt + 0.6} exitAt={grainAt} repo="veritas" path="live/trace-model.json" line={1} x={Math.round(0.93 * W)} y={Math.round(0.7 * H)} align="right" />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(ch.start), activity: 'idle', detail: ''},
    {frame: c.f(S1.start + 0.3), activity: 'thinking', detail: 'Planning the claim…'},
  );
  return {lattice, grainAt, digitsAt, digitsEnd, patternTimes, doubleAt, probes, passedAt, streamFrom, streamTo};
};

