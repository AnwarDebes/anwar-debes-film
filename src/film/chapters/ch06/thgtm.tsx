import React from 'react';
import {Img, random, staticFile} from 'remotion';
import {frameOn, pushIn} from '../../../engine/camera';
import type {LiveLayer, PinSample} from '../../../engine/pins';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {color, font} from '../../../engine/tokens';
import {snippets} from '../../../data/ch06/code';
import {THGTM_ATTACK_TRAJECTORY} from '../../../data/ch06/thgtmTrajectory';
import type {Builder} from './kit/builder';
import {Cites, PathKicker, PlaceTitle, Tag, WallLabels, pull, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, disc, rect, seg, type Look, type Shape} from './kit/shapes';
import {hollowBar} from './numbers';
import type {Times06} from './times';
import {TRAJ_RASTER, type Beats06} from './beats';

// 06.5 THGTM: one decaying number per automaton (echo trails), the classic automaton at decay 0
// (how TRACE runs it), a delayed XOR solved with past literals, and a trajectory check whose
// perfect catch rate is built into its test.

const TG = 'THGTM';
const STEP_S = 0.2;
const LAMBDA = 0.7;

export const buildThgtm = (b: Builder, T: Times06, ground: Look, B: Beats06) => {
  const {S} = b;
  const s = T.s5;
  const P5 = frameOn(b.ctx.board, {uv: S.uv(88, S.ext / 2), pinsAcross: 146, yaw: 0.14, pitch: 0.07, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P5, fx, fy);

  // ---------------------------------------------------------------- echo trails (schematic)
  const N = 26;
  const SP = 3;
  const [ex0r, rowAr] = at(0.22, 0.215);
  const [ex0, rowA] = S.snap(ex0r, rowAr);
  const rowB = S.snap(ex0r, at(0.22, 0.31)[1])[1];
  const ex = (j: number) => ex0 + j * SP;
  const steps = Math.ceil((s.literal - s.start + 2) / STEP_S);
  const flips = new Uint8Array(N * steps);
  for (let j = 0; j < N; j++) for (let n = 0; n < steps; n++) flips[j * steps + n] = random(`c06-etta-${j}-${n}`) < 0.1 ? 1 : 0;
  const t0 = s.start - 0.3;
  const sample: PinSample = {h: 0, tint: [0.74, 0.74, 0.74], glow: 0};
  const tint = sample.tint as [number, number, number];
  const R2 = 1.15 * 1.15;
  const echo: LiveLayer = {
    fn: (u, v, _i, t) => {
      const X = u / b.ctx.board.p;
      const Y = (v * b.ctx.board.extH) / b.ctx.board.p;
      const row = Math.abs(Y - rowA) < 1.3 ? 0 : Math.abs(Y - rowB) < 1.3 ? 1 : -1;
      if (row < 0) return null;
      const j = Math.round((X - ex0) / SP);
      if (j < 0 || j >= N) return null;
      const dx = X - ex(j);
      const dy = Y - (row === 0 ? rowA : rowB);
      if (dx * dx + dy * dy > R2) return null;
      const n = Math.floor((t - t0) / STEP_S);
      let trace = 0;
      if (n >= 0 && n < steps) {
        if (row === 0) trace = flips[j * steps + n] ? 1 : 0;
        else {
          // trace = lambda * trace + |delta|, clamped to 1 (thgtm/etta.py:117-123)
          for (let m = Math.max(0, n - 24); m <= n; m++) trace = Math.min(1, trace * LAMBDA + flips[j * steps + m]);
        }
      }
      sample.h = 0.12 + 0.14 * trace;
      tint[0] = 0.95 + (PIN.mint[0] - 0.95) * trace;
      tint[1] = 0.95 + (PIN.mint[1] - 0.95) * trace;
      tint[2] = 0.95 + (PIN.mint[2] - 0.95) * trace;
      sample.glow = trace * 0.9;
      return sample;
    },
    from: t0,
    to: s.literal + 0.2,
    fadeS: 0.3,
    region: [...S.uv(ex0 - 2, rowB - 2), ...S.uv(ex(N - 1) + 2, rowA + 2)] as [number, number, number, number],
    speedHint: () => 0.6,
  };
  b.live.push(echo);
  const echoBase: Shape[] = [...Array(N).keys()].flatMap((j) => [disc(ex(j), rowA, 1.05, {h: 0.12, tint: 0.95}), disc(ex(j), rowB, 1.05, {h: 0.12, tint: 0.95})]);

  // the thread back to TRACE's place: a lit pin running left along the decay-0 row and off the frame
  const {threadFrom} = B;
  const thread: LiveLayer = {
    fn: (u, v, _i, t) => {
      const X = u / b.ctx.board.p;
      const Y = (v * b.ctx.board.extH) / b.ctx.board.p;
      if (Math.abs(Y - (rowA - 3.6)) > 0.8) return null;
      const head = ex0 - ((t - threadFrom) / 1.4) * (ex0 + 4);
      const d = X - head;
      if (d < -0.8 || d > 22) return null;
      const k = d < 0 ? 1 + d / 0.8 : Math.max(0, 1 - d / 22);
      return {h: 0.04 + 0.08 * k, tint: [0.62 + 0.38 * k, 0.74 + 0.26 * k, 0.7 + 0.26 * k], glow: k};
    },
    from: threadFrom,
    to: threadFrom + 2.2,
    fadeS: 0.25,
    region: [...S.uv(0, rowA - 5.1), ...S.uv(ex0 + 1, rowA - 2.1)] as [number, number, number, number],
    speedHint: () => 1.2,
  };
  b.live.push(thread);

  // ---------------------------------------------------------------- the delay line and the temporal XOR
  const bits = [1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1];
  const [dx0, dyA] = at(0.32, 0.165);
  const [, dyB] = at(0.32, 0.255);
  const dX = (j: number) => dx0 + j * 3.6;
  const delayShapes: Shape[] = bits.flatMap((bit, j) => [
    disc(dX(j), dyA, 1.05, bit ? {h: 0.24, tint: 1.08} : {h: 0.04, tint: 0.5}),
    ...(j + 1 < bits.length ? [disc(dX(j + 1), dyB, 1.0, bit ? {h: 0.2, tint: PIN.mint, glow: 0.55} : {h: 0.04, tint: 0.5})] : []),
    ...(j + 1 < bits.length ? [seg(dX(j) + 0.9, dyA - 1.1, dX(j + 1) - 0.7, dyB + 1.1, 0.6, {h: 0.08, tint: 0.95})] : []),
  ]);
  // bars: raw 0.486, past 0.909 (± 0.129), past + echo 1.000 (results/temporal_xor.json, delay 1, 3 seeds)
  const xor = [0.486, 0.909, 1.0];
  const [bx0, bBase] = at(0.1, 0.6);
  const [bx1, bTop] = at(0.47, 0.375);
  const bw = (bx1 - bx0) / 3;
  const bh = bTop - bBase;
  const chance = bBase + bh * 0.5;
  const xorShapes = (n: number): Shape[] => [
    ...xor.map((_, k) => rect(bx0 + (k + 0.5) * bw, bBase + bh / 2, bw - 4, bh, {h: 0.04, tint: 0.44}, {r: 1})),
    ...xor.slice(0, n).map((v, k) => rect(bx0 + (k + 0.5) * bw, bBase + (bh * v) / 2, bw - 4, bh * v, k === 2 ? LOOK.lit : {h: 0.2, tint: k === 0 ? 0.72 : 1.0}, {r: 0.8})),
    // the past-only spread across seeds: +- 0.129, drawn as a whisker
    ...(n >= 2 ? [seg(bx0 + 1.5 * bw, bBase + bh * (0.909 - 0.129), bx0 + 1.5 * bw, bBase + bh * Math.min(1.035, 0.909 + 0.129), 0.6, {h: 0.26, tint: 1.0})] : []),
    seg(bx0 - 1, chance, bx1 + 1, chance, 0.6, {h: 0.06, tint: 0.95}, {dash: [1.4, 1.2]}),
  ];

  // ---------------------------------------------------------------- the trajectory: 50 steps x 4 pins
  const TRJ = THGTM_ATTACK_TRAJECTORY.bits;
  const [gx0, gyTop] = at(0.17, 0.2);
  const gY = (r: number) => gyTop - r * 3.6;
  const gX = (n: number) => gx0 + n * 2;
  const exportsAt = TRJ[2].flatMap((v, n) => (v ? [n] : []));
  const trip = exportsAt[2];
  const trajShapes = (lit: number): Shape[] =>
    TRJ.flatMap((row, r) =>
      row.map((v, n) => {
        const X = gx0 + n * 2;
        const Y = gY(r);
        const cellR = (look: Look) => rect(X, Y, 1.45, 2.5, look, {r: 0.5, soft: 0.35});
        if (!v) return cellR({h: 0.02, tint: 0.46});
        if (r !== 2) return cellR({h: 0.14, tint: 0.92});
        const k = exportsAt.indexOf(n);
        if (k === 2 && k < lit) return cellR({h: 0.3, tint: PIN.redPaint, paint: 0.85});
        if (k < lit) return cellR({h: 0.26, tint: 1.08});
        return cellR({h: 0.2, tint: 1.0});
      }),
    );
  // bars: per-step attack success 0.687 -> trajectory 0.000, false positives 0.093 (same size)
  const tv = [0.687, 0.0, 0.093];
  const [tb0, tBase] = at(0.1, 0.6);
  const [tb1, tTop] = at(0.5, 0.43);
  const tbw = (tb1 - tb0) / 3;
  const tbh = tTop - tBase;
  const tvShapes: Shape[] = tv.flatMap((v, k) => [
    rect(tb0 + (k + 0.5) * tbw, tBase + tbh / 2, tbw - 5, tbh, {h: 0.04, tint: 0.44}, {r: 1}),
    v > 0 ? rect(tb0 + (k + 0.5) * tbw, tBase + (tbh * v) / 2, tbw - 5, Math.max(1, tbh * v), {h: 0.2, tint: 1.0}, {r: 0.8}) : rect(tb0 + (k + 0.5) * tbw, tBase + 0.5, tbw - 5, 1, {h: 0.08, tint: 1.0}),
  ]);

  // ---------------------------------------------------------------- beats
  const wall = (shapes: Shape[]) => b.field(shapes, ground);
  b.beat('s5-echo', s.start - 0.35, wall(echoBase), {sweep: {kind: 'linear', origin: S.uv(ex0 - 4, rowA), direction: [1, 0], speed: 0.55, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s5-delay', s.literal - 0.2, wall(delayShapes), {sweep: {kind: 'linear', origin: S.uv(dx0 - 3, dyA), direction: [1, 0], speed: 0.6, jitterS: 0.02, tintFollowsWave: true}});
  const {xorAt} = B;
  xorAt.forEach((t, k) => b.beat(`s5-xor${k}`, t, wall([...delayShapes, ...xorShapes(k + 1)]), {sweep: {kind: 'linear', origin: S.uv(bx0, bBase), direction: [0, 1], speed: 0.45, jitterS: 0.015}}));
  b.ripple(s.every + 0.1, bx0 + 2.5 * bw, bBase + bh, {amp: 0.25});
  // the raster runs along the 50 steps; the third export trips count_le(export, 2, 50)
  const {trajAt, tripAt} = B;
  const rasterS = TRAJ_RASTER;
  b.beat('s5-traj', trajAt, wall([...trajShapes(2), ...tvShapes.slice(0, 0)]), {sweep: {kind: 'linear', origin: S.uv(gx0 - 2, gyTop), direction: [1, 0], speed: rasterS, jitterS: 0.015, tintFollowsWave: true}});
  b.beat('s5-trip', tripAt, wall(trajShapes(10)), {sweep: {origin: S.uv(gX(trip), gY(2)), speed: 0.8, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s5-bars', s.stops - 0.1, wall([...trajShapes(10), ...tvShapes]), {sweep: {kind: 'linear', origin: S.uv(tb0, tBase), direction: [0, 1], speed: 0.4, jitterS: 0.015}});

  // ---------------------------------------------------------------- camera
  b.move(s.start - 0.4, 1.3, P5);
  b.move(s.start + 0.9, s.literal - s.start - 1.3, pushIn(P5, 0.05), 'inOutSine');
  b.move(s.literal - 0.3, 1.2, P5);
  b.move(s.literal + 0.9, s.agent - s.literal - 1.3, pushIn(P5, 0.05), 'inOutSine');
  b.move(s.agent - 0.4, 1.2, P5);
  b.move(s.agent + 0.8, s.end - s.agent - 2.6, pushIn(P5, 0.045), 'inOutSine');

  // ---------------------------------------------------------------- overlays
  const pages: CodePage[] = [
    {
      at: s.memory - 0.3,
      source: {snippet: snippets['thgtm-etta'], lines: [117, 123]},
      dedent: true,
      zoom: 0.88,
      header: {label: 'THGTM', path: 'thgtm/etta.py', meta: '_apply_delta'},
      cues: [cue.reveal(s.memory - 0.2, {stagger: 0.05}), cue.highlight(s.fades - 0.1, [118, 123])],
    },
  ];
  const outEcho = s.literal - 0.35;
  const outDelay = s.agent - 0.4;
  const out = s.end - 0.5;
  const labels: WallText[] = [
    {text: 'decay 0', X: ex0 - 3, Y: rowA, at: s.start + 0.2, exitAt: outEcho, align: 'right', color: color.text.chipDim},
    {text: `decay ${LAMBDA}`, X: ex0 - 3, Y: rowB, at: s.start + 0.4, exitAt: outEcho, align: 'right', color: color.accent.mintLabel},
    {text: 'x_t', X: dx0 - 3, Y: dyA, at: s.literal, exitAt: outDelay, align: 'right', color: color.text.chipDim},
    {text: 'PAST_1 = x one step ago', X: dx0 - 3, Y: dyB, at: s.kAgo - 0.2, exitAt: outDelay, align: 'right', color: color.accent.mintLabel},
    ...['raw inputs', 'past literals', 'past + echo trace'].map((n, k): WallText => ({text: n, X: bx0 + (k + 0.5) * bw, Y: bBase - 3, at: xorAt[k], exitAt: outDelay, color: color.text.chipDim})),
    {text: '0.486', X: bx0 + 0.5 * bw, Y: bBase + bh * 0.486 + 3, h: 0.2, at: xorAt[0] + 0.2, exitAt: outDelay, mono: false, weight: 700, sizeH: 0.032, color: color.text.caption},
    {text: '0.909 ± 0.129', X: bx0 + 1.5 * bw, Y: bBase + bh * 1.04 + 3, h: 0.2, at: xorAt[1] + 0.2, exitAt: outDelay, mono: false, weight: 700, sizeH: 0.03},
    {text: '1.000', X: bx0 + 2.5 * bw, Y: bBase + bh + 3, h: 0.2, at: xorAt[2] + 0.2, exitAt: outDelay, mono: false, weight: 700, sizeH: 0.032, color: color.accent.mint},
    {text: 'chance', X: bx1 + 1.6, Y: chance, at: xorAt[0], exitAt: outDelay, align: 'left', color: color.text.tertiary},
    ...['read', 'write', 'export', 'in scope'].map((n, r): WallText => ({text: n, X: gx0 - 2.5, Y: gY(r), at: trajAt + 0.2, exitAt: out, align: 'right', color: r === 2 ? color.text.caption : color.text.chipDim})),
    ...['per-step', 'trajectory', 'false positives'].map((n, k): WallText => ({text: n, X: tb0 + (k + 0.5) * tbw, Y: tBase - 3, at: s.stops, exitAt: out, color: color.text.chipDim})),
    {text: '0.687', X: tb0 + 0.5 * tbw, Y: tBase + tbh * 0.687 + 3, h: 0.2, at: s.stops + 0.2, exitAt: out, mono: false, weight: 700, sizeH: 0.032},
    {text: '0.000', X: tb0 + 1.5 * tbw, Y: tBase + 3.4, h: 0.08, at: s.stops + 0.35, exitAt: out, mono: false, weight: 700, sizeH: 0.032, color: color.accent.mint},
    {text: '9.3%', X: tb0 + 2.5 * tbw, Y: tBase + tbh * 0.093 + 3, h: 0.2, at: s.flags, exitAt: out, mono: false, weight: 700, sizeH: 0.032},
    {text: 'attack success', X: (tb0 + tb1) / 2 - tbw / 2, Y: tTop + 3.4, at: s.stops, exitAt: out, color: color.accent.mintLabel},
  ];

  const cites: CiteSpec[] = [
    {repo: TG, path: 'thgtm/etta.py', line: '109-123', at: s.memory, exitAt: s.zero - 0.2, slot: 0},
    {repo: TG, path: 'thgtm/etta.py', line: '10-11', at: s.classic, exitAt: s.literal - 0.3, slot: 0},
    {repo: 'trace', path: 'tracekit/automata.py', line: '1-16', at: s.trace + 0.1, exitAt: s.literal - 0.3, slot: 1},
    {repo: TG, path: 'thgtm/temporal.py', line: '93-109', at: s.kAgo, exitAt: s.echo, slot: 0},
    {repo: TG, path: 'results/temporal_xor.json', line: '220-237', at: s.chance, exitAt: s.agent - 0.4, slot: 1},
    {repo: TG, path: 'experiments/trajectory_verification.py', line: '61-92', at: s.agent, exitAt: s.but - 0.2, slot: 0},
    {repo: TG, path: 'results/trajectory_verification.json', line: '58-74', at: s.stops, exitAt: out, slot: 1},
    {repo: TG, path: 'experiments/trajectory_verification.py', line: '132-159', at: s.builtIn - 0.2, exitAt: out, slot: 0},
  ];

  // the trajectory's own counter: count(export) as the raster passes each export
  const countAtT = (t: number): number => {
    let n = 0;
    for (const at of B.exportPass) if (t >= at) n++;
    return n;
  };

  const W = b.W;
  const H = b.H;
  b.overlay('s5', s.start - 0.5, s.end + 0.1, (t) => {
    const n = countAtT(t);
    const tripped = n >= 3;
    const cK = pull(t, trajAt + 0.3, out);
    const [, cy] = b.lens.at(t, gX(49) + 2, gY(0) + 3.4);
    return (
      <>
        <PlaceTitle t={t} at={s.plate} exitAt={s.literal - 0.4} name="THGTM" status="research prototype v0.1 · synthetic benchmarks" />
        <PathKicker t={t} at={s.plate + 0.6} exitAt={outEcho} text="one decaying number per automaton · schematic" x={b.lens.at(t, ex0 - 1, rowB - 2.6)[0]} y={b.lens.at(t, ex0 - 1, rowB - 2.6)[1]} />
        <CodePanel pages={pages} x={Math.round(0.47 * W)} y={Math.round(0.395 * H)} anchor="top-left" t={t} enter={{at: s.memory - 0.3, dur: 0.6}} exit={{at: s.zero - 0.2, dur: 0.4}} />
        {/* the paper's illustration, tagged for what it is */}
        {pull(t, s.zero - 0.1, s.literal - 0.45) > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: Math.round(0.07 * W),
              top: Math.round(0.405 * H),
              width: Math.round(0.24 * W),
              padding: Math.round(0.008 * H),
              borderRadius: Math.round(0.012 * H),
              background: '#F4F6F5',
              boxShadow: `0 ${Math.round(0.012 * H)}px ${Math.round(0.04 * H)}px rgba(0,0,0,0.5)`,
              opacity: pull(t, s.zero - 0.1, s.literal - 0.45),
            }}
          >
            <Img src={staticFile('ch06/thgtm-trace_dynamics.png')} style={{width: '100%', display: 'block'}} />
          </div>
        ) : null}
        <Tag t={t} at={s.zero + 0.3} exitAt={s.literal - 0.45} text="illustration · generated, not experiment data" x={Math.round(0.07 * W)} y={Math.round(0.375 * H)} />
        <Tag t={t} at={s.classic} exitAt={s.literal - 0.45} text="decay 0 = the classic automaton, bit for bit · used by TRACE" x={Math.round(0.93 * W)} y={Math.round(0.47 * H)} align="right" border="rgba(116,201,174,0.4)" tone={color.accent.mintLabel} />
        <PathKicker t={t} at={s.chance - 0.3} exitAt={outDelay} text="THGTM/results/temporal_xor.json · temporal XOR · delay 1 · 3 seeds" y={Math.round(0.072 * H)} />
        <Tag t={t} at={s.literal + 0.2} exitAt={outDelay} text="schematic bits · PAST_k: the value k steps ago, as a new literal" x={Math.round(0.93 * W)} y={Math.round(0.335 * H)} align="right" />
        <PathKicker t={t} at={trajAt + 0.1} exitAt={out} text="one attack trajectory from the test generator · 50 steps" x={b.lens.at(t, gx0, gyTop + 4)[0]} y={b.lens.at(t, gx0, gyTop + 4)[1] - 0.03 * H} />
        {cK > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: Math.round(0.07 * W),
              top: Math.round(cy - 0.02 * H),
              fontFamily: font.mono,
              fontSize: Math.round(0.024 * H),
              color: tripped ? '#F2A9A9' : color.text.caption,
              opacity: cK,
              whiteSpace: 'nowrap',
            }}
          >
            count(export) {Math.min(n, 3)}
            {tripped ? ' > 2 · flagged' : ''}
          </div>
        ) : null}
        <Tag t={t} at={s.three - 0.1} exitAt={out} text="attacks are generated with ≥ 3 exports; the rule flags > 2" x={Math.round(0.53 * W)} y={Math.round(0.55 * H)} />
        <WallLabels t={t} lens={b.lens} items={labels} />
        <Cites t={t} items={cites} />
      </>
    );
  });

  // ---------------------------------------------------------------- Pixie
  b.cue(s.plate, 'reading', 'Read thgtm/etta.py');
  b.cue(s.literal, 'reading', 'Read results/temporal_xor.json');
  b.cue(xorAt[2] + 0.15, 'success', 'delay 1 · 1.000 on 3 seeds');
  b.cue(s.agent, 'searching', 'Search 50 steps for exports');

  return {P5, tripAt};
};

/** Hollow bars, re-exported for the plate scenes. */
export {hollowBar};
