import React from 'react';
import {random} from 'remotion';
import {apertureForBlur, frameOn, pushIn} from '../../../engine/camera';
import type {FieldFn, LiveLayer, PinSample} from '../../../engine/pins';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {ArchDiagram, asDiagramLayout} from '../../../engine/diagram';
import {GlassCard, Scrim} from '../../../engine/type';
import {color, font} from '../../../engine/tokens';
import {snippets} from '../../../data/ch08/code';
import lucidLayout from '../../../data/ch08/diagrams/lucid.layout.json';
import type {Builder} from '../ch06/kit/builder';
import {ChapterTitle, Cites, PathKicker, PlaceTitle, Tag, WallLabels, pull, type CiteSpec, type WallText} from '../ch06/kit/overlays';
import {PIN, disc, shapesLive, shapesRegion, type Shape} from '../ch06/kit/shapes';
import {N, OBJECTS, WALLS, arcField, arcFrame, cellCentre, cellOf, maskedSignature, type ArcPlace} from './arc';
import type {Times08} from './times';
import type {Beats08} from './beats';

// 08.0 the gate (Act III, unfold), 08.1-08.3 LUCID: a game with no instructions, perception and
// a world model you can read, a shield that never repeats a fatal move, a plain BFS plan, and the
// click-only game where a level clears.

const LUCID = 'lucid';
const LAYOUT = asDiagramLayout(lucidLayout);

export const buildLucid = (b: Builder, T: Times08, B: Beats08, groundTint: number) => {
  const {S} = b;
  const board = b.ctx.board;
  const P: ArcPlace = {row0: 31, col0: 86};
  const g = arcFrame();
  const sig = maskedSignature(g);
  const ground: FieldFn = (() => {
    const s: PinSample = {h: 0, tint: groundTint};
    return () => s;
  })();
  const [gcx, gcy] = cellCentre(board, P, 31.5, 31.5);
  const P8 = frameOn(board, {uv: S.uv(gcx, gcy), pinsAcross: 162, screen: [0.69, 0.39], yaw: -0.12, pitch: 0.07, aspect: b.aspect});
  const cellXY = (r: number, c: number) => cellCentre(board, P, r, c);
  const tileOf = (r: number, c: number): [number, number] => [Math.min(2, Math.floor(r / 21.34)), Math.min(2, Math.floor(c / 21.34))];

  // ---------------------------------------------------------------- 08.0 the gate: a cube unfolds into the grid
  const gate = (mode: 'cube' | 'cross'): FieldFn => {
    const full = arcField(board, P, g, ground);
    return (u, v, i) => {
      const cell = cellOf(board, P, i);
      if (cell < 0) return ground(u, v, i);
      const [tr, tc] = tileOf(Math.floor(cell / N), cell % N);
      const centre = tr === 1 && tc === 1;
      const arm = (tr === 1) !== (tc === 1);
      if (mode === 'cube') {
        if (!centre) return ground(u, v, i);
        // the cube's face: the grid's centre tile on a bright block
        const s = full(u, v, i);
        const tt = s.tint as [number, number, number];
        const bright = (x: number) => 0.55 + 0.45 * x;
        return {...s, h: s.h + 0.62, tint: [bright(tt[0]), bright(tt[1]), bright(tt[2])]};
      }
      return centre || arm ? full(u, v, i) : ground(u, v, i);
    };
  };
  const gridPlain = arcField(board, P, g, ground);
  const centreUV = S.uv(gcx, gcy);
  b.beat('cube', B.cubeAt, gate('cube'), {sweep: {origin: centreUV, speed: 0.45, jitterS: 0.04}});
  b.beat('unfold', B.unfoldAt, gate('cross'), {sweep: {origin: centreUV, speed: 0.4, jitterS: 0.03, tintFollowsWave: true}});
  b.beat('grid', B.settleAt, gridPlain, {sweep: {origin: centreUV, speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});

  // ---------------------------------------------------------------- 08.2 perception, the model, the shield, the plan
  const s2 = T.s2;
  const objLift = (r: number, c: number, color: number) => (color === 5 ? 0 : 0.22);
  b.beat('s2-objects', B.liftAt, arcField(board, P, g, ground, {lift: objLift}), {sweep: {kind: 'linear', origin: S.uv(gcx, gcy + 30), direction: [0, -1], speed: 0.25, jitterS: 0.015}});
  b.beat('s2-mask', B.maskAt, arcField(board, P, g, ground, {lift: objLift, hudMasked: true}), {sweep: {kind: 'linear', origin: S.uv(gcx - 34, gcy), direction: [1, 0], speed: 0.6, jitterS: 0.015, tintFollowsWave: true}});
  // the fatal (state, action) pair: a red-capped pin above the avatar, locked from this state
  const fatalCell: [number, number] = [39, 11];
  const fatalXY = cellXY(fatalCell[0], fatalCell[1]);
  const fatal: Shape = disc(fatalXY[0], fatalXY[1], 0.9, {h: 0.55, tint: [1.25, 0.5, 0.5], paint: 1});
  const withFatal = (f: FieldFn): FieldFn => {
    const live = shapesLive(S, [fatal]);
    return (u, v, i) => live(u, v) ?? f(u, v, i);
  };
  b.beat('s2-fatal', B.fatalAt, withFatal(arcField(board, P, g, ground, {lift: objLift, hudMasked: true})), {sweep: {origin: S.uv(fatalXY[0], fatalXY[1]), speed: 0.3, jitterS: 0.02}});
  b.ripple(B.fatalAt + 0.1, fatalXY[0], fatalXY[1], {amp: 0.3});

  // BFS over learned moves: a wave rises from the avatar around the walls to the goal (schematic)
  const blocked = new Uint8Array(N * N);
  for (const [r0, c0, h, w] of WALLS) for (let r = r0 - 1; r < r0 + h + 1; r++) for (let c = c0 - 1; c < c0 + w + 1; c++) if (r >= 0 && c >= 0 && r < N && c < N) blocked[r * N + c] = 1;
  for (const o of OBJECTS) if (o.name === 'hazard') for (let r = o.r0 - 1; r < o.r0 + o.h + 1; r++) for (let c = o.c0 - 1; c < o.c0 + o.w + 1; c++) blocked[r * N + c] = 1;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (r < 3 || r >= N - 3 || c < 3 || c >= N - 3) blocked[r * N + c] = 1;
  blocked[fatalCell[0] * N + fatalCell[1]] = 1;
  const dist = new Int16Array(N * N).fill(-1);
  const q: number[] = [];
  const start = 43 * N + 11;
  dist[start] = 0;
  q.push(start);
  for (let k = 0; k < q.length; k++) {
    const cur = q[k];
    const r = Math.floor(cur / N);
    const c = cur % N;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
      const n = nr * N + nc;
      if (blocked[n] || dist[n] >= 0) continue;
      dist[n] = dist[cur] + 1;
      q.push(n);
    }
  }
  const goalDist = dist[14 * N + 49];
  const rip: PinSample = {h: 0, tint: [0, 0, 0], glow: 0};
  const ripTint = rip.tint as [number, number, number];
  const ripple: LiveLayer = {
    fn: (u, v, i, t) => {
      const cell = cellOf(board, P, i);
      if (cell < 0) return null;
      const d = dist[cell];
      if (d < 0 || d > goalDist + 2) return null;
      const front = (t - B.bfsAt) / B.rippleS;
      const x = front - d;
      if (x < 0 || x > 6) return null;
      const k = Math.exp(-x / 1.8);
      rip.h = 0.1 * k;
      ripTint[0] = 0.5 + 0.12 * k;
      ripTint[1] = 0.62 + 0.38 * k;
      ripTint[2] = 0.58 + 0.3 * k;
      rip.glow = 0.6 * k;
      return rip;
    },
    from: B.bfsAt - 0.05,
    to: B.bfsAt + goalDist * B.rippleS + 0.9,
    fadeS: 0.2,
    mode: 'add',
    region: [...S.uv(gcx - 34, gcy - 30), ...S.uv(gcx + 34, gcy + 30)] as [number, number, number, number],
    speedHint: () => 0.8,
  };
  b.live.push(ripple);
  // only the first step is taken: the avatar moves 4 rows up (ACTION1, displacement (-4, 0))
  const stepped = (() => {
    const g2 = g.slice();
    const av = OBJECTS[0];
    for (let r = av.r0; r < av.r0 + av.h; r++) for (let c = av.c0; c < av.c0 + av.w; c++) g2[r * N + c] = 0;
    for (let r = av.r0 - 4; r < av.r0 - 4 + av.h; r++) for (let c = av.c0; c < av.c0 + av.w; c++) g2[r * N + c] = 12;
    return g2;
  })();
  const avXY = cellXY(42, 11);
  b.beat('s2-step', B.stepAt, withFatal(arcField(board, P, stepped, ground, {lift: objLift, hudMasked: true})), {sweep: {origin: S.uv(avXY[0], avXY[1] + 2), speed: 0.4, jitterS: 0.02}});
  b.beat('s2-dim', B.diagFrom - 0.3, withFatal(arcField(board, P, stepped, ground, {hudMasked: true, dim: 0.55})), {tintTauS: 0.5});

  // ---------------------------------------------------------------- 08.3 the click-only game (LP85, schematic)
  const s3 = T.s3;
  const click = (n: number): Uint8Array => {
    const g3 = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (r < 2 || r >= N - 2 || c < 2 || c >= N - 2) g3[r * N + c] = 10;
    for (let r = 29; r < 31; r++) for (let c = 7; c < 9; c++) g3[r * N + c] = 8;
    // each click changes the same 288 cells (12 x 24)
    for (let r = 30; r < 42; r++) for (let c = 20; c < 44; c++) g3[r * N + c] = n % 2 === 0 ? 5 : 13;
    return g3;
  };
  const clickCell = cellXY(29.5, 7.5);
  b.beat('s3-game', s3.start - 0.4, arcField(board, P, click(0), ground), {sweep: {kind: 'random', origin: [0.6, 0.5], speed: 1, spreadS: 0.7, jitterS: 0.03, tintFollowsWave: true}});
  B.clickAt.forEach((t, k) => {
    b.beat(`s3-click${k}`, t, arcField(board, P, click(k + 1), ground), {sweep: {origin: S.uv(clickCell[0], clickCell[1]), speed: 0.55, jitterS: 0.02, tintFollowsWave: true}});
    b.ripple(t, clickCell[0], clickCell[1], {amp: 0.35});
  });
  const levelUp = arcField(board, P, click(4), ground, {extra: (r, c) => (r >= 2 && r < N - 2 && c >= 2 && c < N - 2 ? 0.16 : 0)});
  b.beat('s3-level', B.levelAt, levelUp, {sweep: {origin: S.uv(clickCell[0], clickCell[1]), speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});
  // the cleared level sparkles: seeded pins flash and fade
  const sparkle: LiveLayer = {
    fn: (u, v, i, t) => {
      const cell = cellOf(board, P, i);
      if (cell < 0) return null;
      const ph = random(`c08-spark-${i}`);
      if (ph > 0.06) return null;
      const d = t - B.levelAt - ph * 6;
      if (d < 0 || d > 0.6) return null;
      const k = 1 - d / 0.6;
      return {h: 0.12 * k, tint: [1, 1, 1], glow: k};
    },
    from: B.levelAt,
    to: B.levelAt + 2.2,
    fadeS: 0.2,
    mode: 'add',
    region: [...S.uv(gcx - 34, gcy - 30), ...S.uv(gcx + 34, gcy + 30)] as [number, number, number, number],
  };
  b.live.push(sparkle);

  // ---------------------------------------------------------------- camera and focus
  const s1 = T.s1;
  b.cut(T.ch.start, b.home);
  b.move(T.gate.frame0 + 0.1, T.gate.end - T.gate.frame0 + 0.3, P8);
  b.move(s1.start + 0.4, s1.end - s1.start - 0.8, pushIn(P8, 0.05), 'inOutSine');
  b.move(s2.start - 0.3, 1.2, P8);
  b.move(s2.start + 1.0, Math.max(1, s2.ends - s2.start - 1.4), pushIn(P8, 0.04), 'inOutSine');
  b.move(B.bfsAt - 0.4, 1.2, P8);
  b.move(s3.start - 0.4, 1.0, pushIn(P8, 0.02));
  b.move(s3.start + 0.7, s3.end - s3.start - 1.2, pushIn(P8, 0.07), 'inOutSine');
  // Pixie searches; the focus follows from object to object across the frame
  const objXY = (k: number) => {
    const o = OBJECTS[k];
    return cellXY(o.r0 + o.h / 2, o.c0 + o.w / 2);
  };
  const ap = apertureForBlur(4, P8.distance, 0.05, P8.fov, 1440);
  const uvH = (xy: [number, number]): {uv: [number, number]; h: number} => ({uv: S.uv(xy[0], xy[1]), h: 0.3 * S.relief});
  b.focus.push({at: s2.splits - 0.4, to: uvH(objXY(0)), aperture: 0});
  b.focus.push({at: s2.splits - 0.3, dur: 0.5, to: uvH(objXY(0)), aperture: ap});
  b.focus.push({at: s2.objects + 0.1, dur: 0.6, to: uvH(objXY(1))});
  b.focus.push({at: s2.masks, dur: 0.6, to: uvH(objXY(4))});
  b.focus.push({at: s2.same + 0.2, dur: 0.6, to: uvH([gcx, gcy]), aperture: 0});

  // ---------------------------------------------------------------- overlays
  const W = b.W;
  const H = b.H;
  const g8 = T.gate;
  b.overlay('gate-card', g8.frame0 - 0.1, g8.cardOut + 0.45, (t) => <ChapterTitle t={t} at={g8.cardIn} exitAt={g8.cardOut} index="08" repos={['lucid', 'RL', 'RL-CCA']} title="*The rules.*" />);

  const s1Cites: CiteSpec[] = [
    {repo: LUCID, path: 'paper/lucid.tex', line: '86-90', at: s1.instructions, exitAt: s1.goal, slot: 0},
    {repo: LUCID, path: 'scripts/compute_scores.py', line: '3-6', at: s1.score, exitAt: s1.readme + 0.4, slot: 0},
    {repo: LUCID, path: 'paper/lucid.tex', line: '140-151', at: s1.count, exitAt: s1.readme + 0.4, slot: 1},
    {repo: LUCID, path: 'README.md', line: '17-20', at: s1.frontier, exitAt: s1.end - 0.4, slot: 0},
  ];
  b.overlay('s1', s1.start - 0.3, s1.end + 0.1, (t) => (
    <>
      <PlaceTitle t={t} at={s1.plate} exitAt={s1.end - 0.4} name="lucid" status="research prototype v1.0 · paper · live-API results" />
      <Tag t={t} at={s1.start + 0.4} exitAt={s1.end - 0.4} text="schematic grid · not a recorded frame" x={Math.round(0.93 * W)} y={Math.round(0.062 * H)} align="right" />
      <PathKicker t={t} at={s1.instructions - 0.1} exitAt={s1.goal + 0.6} text="no instructions" y={Math.round(0.24 * H)} tone={color.text.caption} sizeH={0.026} />
      <GlassCard x={Math.round(0.07 * W)} y={Math.round(0.24 * H)} width={Math.round(0.36 * W)} label="the score · per level" t={t} at={s1.score - 0.2} exitAt={s1.end - 0.4}>
        <div style={{fontFamily: font.sans, fontWeight: 600, fontSize: Math.round(0.042 * H), color: color.text.display, marginTop: Math.round(0.016 * H), whiteSpace: 'nowrap'}}>
          min(1, <span style={{fontFamily: font.mono, fontSize: Math.round(0.034 * H)}}>human ÷ agent</span>)²
        </div>
        <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.chipDim, marginTop: Math.round(0.012 * H)}}>actions to clear the level</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: Math.round(0.008 * H), marginTop: Math.round(0.02 * H)}}>
          {[
            ['same as a person', '1.0', s1.count - 0.2],
            ['twice as many', '0.25', s1.count + 0.4],
          ].map(([a, v, at]) => (
            <div key={a as string} style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: color.text.caption, opacity: pull(t, at as number), whiteSpace: 'nowrap'}}>
              {a} → <span style={{color: color.accent.mint}}>{v}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      <Tag t={t} at={s1.frontier - 0.1} exitAt={s1.end - 0.4} text="at release: frontier models < 1% (cited in the README) · people 100%" x={Math.round(0.07 * W)} y={Math.round(0.64 * H)} />
      <Cites t={t} items={s1Cites} />
    </>
  ));

  // 08.2 overlays
  const modelRows: Array<[string, string]> = [
    ['ACTION1', '141 tries · change 0.993 · (−4, 0)'],
    ['ACTION2', '125 tries · change 1.0 · (+4, 0)'],
    ['ACTION3', '7 tries · change 1.0 · —'],
    ['ACTION4', '7 tries · change 1.0 · —'],
    ['ACTION5', '3 tries · change 0.0 · —'],
    ['ACTION6', '2 tries · change 0.0 · —'],
  ];
  const pages: CodePage[] = [
    {
      at: s2.ends - 0.1,
      source: {snippet: snippets['lucid-agent'], lines: [218, 221]},
      dedent: true,
      zoom: 0.88,
      header: {label: 'lucid', path: 'lucidkit/agent.py', meta: 'LucidAgent.act'},
      cues: [cue.reveal(s2.ends, {stagger: 0.03}), cue.highlight(s2.locked - 0.1, 219, {until: B.bfsAt})],
    },
  ];
  const outCode = B.bfsAt - 0.3;
  const objLabels: WallText[] = [
    {text: 'avatar', obj: 0},
    {text: 'goal', obj: 1},
    {text: 'hazard', obj: 2},
  ].map(({text, obj}) => {
    const o = OBJECTS[obj];
    const [X, Y] = cellXY(o.r0 - 1.6, o.c0 + o.w / 2);
    return {text, X, Y: Y + 1.2, h: 0.4, at: s2.objects + 0.2 + obj * 0.15, exitAt: s2.masks + 1.2, color: color.text.caption, pill: true};
  });
  const s2Labels: WallText[] = [
    ...objLabels,
    {text: 'HUD band (2 cells) · masked, frozen after 8 steps', X: cellXY(32, 0)[0] - 2.4, Y: cellXY(40, 0)[1], at: s2.masks + 0.1, exitAt: s2.ends - 0.2, align: 'right', color: color.text.chipDim, pill: true},
    {text: 'fatal (state, action) → locked', X: fatalXY[0] + 2, Y: fatalXY[1] + 3.2, h: 0.55, at: s2.locked, exitAt: B.diagFrom - 0.3, align: 'left', color: '#F2B0B0', pill: true},
    {text: 'goal', X: cellXY(12, 49.5)[0], Y: cellXY(12, 49.5)[1] + 2.4, h: 0.3, at: B.bfsAt + 0.6, exitAt: B.diagFrom - 0.3, color: color.accent.mint, pill: true},
  ];
  const s2Cites: CiteSpec[] = [
    {repo: LUCID, path: 'README.md', line: '25-26', at: s2.cpu + 0.4, exitAt: s2.splits, slot: 0},
    {repo: LUCID, path: 'lucidkit/perception.py', line: '88-126', at: s2.objects, exitAt: s2.pressing - 0.2, slot: 0},
    {repo: LUCID, path: 'results/run_lucid.jsonl', line: 3, at: s2.pressing + 0.3, exitAt: s2.ends - 0.2, slot: 0},
    {repo: LUCID, path: 'paper/_results.tex', line: '19-27', at: s2.pressing + 0.6, exitAt: s2.ends - 0.2, slot: 1},
    {repo: LUCID, path: 'lucidkit/agent.py', line: '218-221', at: s2.locked, exitAt: outCode, slot: 0},
    {repo: LUCID, path: 'lucidkit/agent.py', line: '319-325', at: s2.locked + 0.3, exitAt: outCode, slot: 1},
    {repo: LUCID, path: 'lucidkit/agent.py', line: '43-66', at: B.bfsAt + 0.2, exitAt: B.diagFrom - 0.2, slot: 0},
    {repo: LUCID, path: 'lucidkit/agent.py', line: '69-76', at: s2.reason, exitAt: B.diagFrom - 0.2, slot: 1},
  ];
  b.overlay('s2', s2.start - 0.3, s2.end + 0.1, (t) => {
    const k = pull(t, s2.same - 0.1, s2.pressing - 0.25);
    return (
      <>
        <Tag t={t} at={s2.cpu + 0.2} exitAt={s2.splits - 0.1} text="pure NumPy on a CPU · no language model · no GPU" x={Math.round(0.07 * W)} y={Math.round(0.3 * H)} />
        <Tag t={t} at={s2.start + 0.2} exitAt={B.diagFrom - 0.3} text="schematic grid · not a recorded frame" x={Math.round(0.93 * W)} y={Math.round(0.062 * H)} align="right" />
        {k > 0 ? (
          <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.3 * H), opacity: k, fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: color.text.caption, lineHeight: 1.6}}>
            <div style={{color: color.accent.mintLabel}}>state signature = hash of the masked grid</div>
            <div>
              {sig.slice(0, 4)} {sig.slice(4)} <span style={{color: color.text.tertiary}}>(FNV-1a of this schematic frame)</span>
            </div>
          </div>
        ) : null}
        <GlassCard x={Math.round(0.07 * W)} y={Math.round(0.2 * H)} width={Math.round(0.4 * W)} label="world model · AR25 · learned by pressing" t={t} at={s2.pressing - 0.1} exitAt={s2.ends - 0.2}>
          <div style={{display: 'flex', flexDirection: 'column', gap: Math.round(0.006 * H), marginTop: Math.round(0.016 * H)}}>
            {modelRows.map(([a, v], i) => {
              const at = B.modelRows[i];
              const n = Math.max(0, Math.min(v.length, Math.floor((t - at) * 40)));
              if (t < at) return <div key={a} style={{height: Math.round(0.035 * H)}} />;
              return (
                <div key={a} style={{fontFamily: font.mono, fontSize: Math.round(0.023 * H), whiteSpace: 'nowrap', height: Math.round(0.035 * H)}}>
                  <span style={{color: i < 2 ? color.accent.mint : color.text.chipDim}}>{a}</span>
                  <span style={{color: color.text.caption}}> · {v.slice(0, n)}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
        <CodePanel pages={pages} x={Math.round(0.07 * W)} y={Math.round(0.075 * H)} anchor="top-left" t={t} enter={{at: s2.ends - 0.1, dur: 0.5}} exit={{at: outCode, dur: 0.4}} />
        <PathKicker t={t} at={B.bfsAt + 0.2} exitAt={B.diagFrom - 0.3} text="breadth-first search over learned moves · first step only" y={Math.round(0.24 * H)} tone={color.accent.mintLabel} />
        {pull(t, s2.reason - 0.2, B.diagFrom - 0.3) > 0 ? (
          <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.3 * H), width: Math.round(0.4 * W), opacity: pull(t, s2.reason - 0.2, B.diagFrom - 0.3), fontFamily: font.mono, fontSize: Math.round(0.022 * H), lineHeight: 1.5, color: color.text.caption}}>
            <div>
              step 12 ACTION1 <span style={{color: color.accent.mintLabel}}>[goal-seek]</span>
            </div>
            <div style={{color: color.text.chipDim}}>BFS plan: move ctrl(color 12) toward goal(color 3) @(14,50); ACTION1 disp=(-4, 0)</div>
            <div style={{color: color.text.tertiary, marginTop: Math.round(0.01 * H)}}>a reason for every step · format of lucidkit/agent.py:242-245 · schematic values</div>
          </div>
        ) : null}
        <WallLabels t={t} lens={b.lens} items={s2Labels} />
        {t >= B.diagFrom - 0.2 && t < B.diagTo + 0.6 ? (
          <>
            <Scrim from={0} to={1} maxAlpha={0.4 * pull(t, B.diagFrom - 0.2, B.diagTo - 0.3, 0.5, 0.5)} edge="top" />
            <ArchDiagram
              layout={LAYOUT}
              time={t}
              build={{at: B.diagFrom, span: 1.1}}
              packets={[{path: LAYOUT.paths?.loop ?? [], at: B.diagFrom + 1.3, speed: 900, dwell: 0.12}]}
              camera={[
                {at: B.diagFrom, target: 'all', zoom: 1.0, pitch: 4, yaw: -1, safe: {left: 0.06, right: 0.94, top: 0.3, bottom: 0.62}},
                {at: B.diagFrom + 1.5, target: ['perceive', 'model', 'plan'], zoom: 0.92, pitch: 2, yaw: -0.5, ease: 'camera', safe: {left: 0.06, right: 0.94, top: 0.3, bottom: 0.62}},
                {at: Math.max(B.diagFrom + 2.8, B.diagTo - 1.6), target: ['model', 'plan', 'act'], zoom: 0.92, pitch: 2, yaw: 0.5, ease: 'camera', safe: {left: 0.06, right: 0.94, top: 0.3, bottom: 0.62}},
              ]}
              edgeLabels="all"
              exit={{at: B.diagTo - 0.35, dur: 0.45}}
            />
            <PathKicker t={t} at={B.diagFrom + 0.2} exitAt={B.diagTo - 0.35} text="lucidkit · one step of the loop · every arrow a call site" y={Math.round(0.24 * H)} />
          </>
        ) : null}
        <Cites t={t} items={s2Cites} />
      </>
    );
  });

  // 08.3 overlays
  const trace = [
    ['step  22 ACTION6 @(29, 7) [curiosity-click]', '-> changed 288 cells', B.clickAt[0]],
    ['step  23 ACTION6 @(29, 7) [curiosity-click]', '-> changed 288 cells', B.clickAt[1]],
    ['step  24 ACTION6 @(29, 7) [curiosity-click]', '-> changed 288 cells', B.clickAt[2]],
    ['step  25 ACTION6 @(29, 7) [curiosity-click]', '-> LEVEL UP -> 1 (recorded as key move)', B.levelAt],
  ] as const;
  const s3Cites: CiteSpec[] = [
    {repo: LUCID, path: 'paper/_results.tex', line: '29-34', at: B.clickAt[0] + 0.2, exitAt: s3.end - 0.4, slot: 1},
    {repo: LUCID, path: 'results/run_lucid.jsonl', line: 5, at: s3.nine, exitAt: s3.end - 0.4, slot: 0},
    {repo: LUCID, path: 'results/scores.json', line: '14-30', at: s3.nine + 0.4, exitAt: s3.end - 0.4, slot: 2},
  ];
  b.overlay('s3', s3.start - 0.3, s3.end + 0.1, (t) => (
    <>
      <PathKicker t={t} at={s3.click - 0.1} exitAt={s3.end - 0.4} text="LP85 · a click-only game · the committed decision trace" y={Math.round(0.072 * H)} />
      <Tag t={t} at={s3.start + 0.2} exitAt={s3.end - 0.4} text="schematic grid · the trace is the paper's" x={Math.round(0.93 * W)} y={Math.round(0.062 * H)} align="right" />
      <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.2 * H), width: Math.round(0.42 * W), fontFamily: font.mono, fontSize: Math.round(0.022 * H), lineHeight: 1.45, fontVariantLigatures: 'none', fontFeatureSettings: '"calt" 0, "liga" 0'}}>
        {trace.map(([a, bb, at], k) => {
          const kk = pull(t, at, s3.end - 0.4, 0.15);
          if (kk <= 0) return null;
          return (
            <div key={k} style={{opacity: kk, marginBottom: Math.round(0.012 * H)}}>
              <div style={{color: color.text.caption}}>{a}</div>
              <div style={{color: k === 3 ? color.accent.mint : color.text.chipDim}}>{'    '}{bb}</div>
            </div>
          );
        })}
      </div>
      {pull(t, s3.nine - 0.1, s3.end - 0.4) > 0 ? (
        <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.56 * H), opacity: pull(t, s3.nine - 0.1, s3.end - 0.4), whiteSpace: 'nowrap'}}>
          <div style={{fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(0.042 * H), color: color.text.display}}>
            (17 ÷ 26)² = 0.4275
          </div>
          <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.chipDim, marginTop: Math.round(0.006 * H)}}>
            person 17 actions · LUCID 26 · game score 1.1875%
          </div>
        </div>
      ) : null}
      <Cites t={t} items={s3Cites} />
    </>
  ));

  // ---------------------------------------------------------------- Pixie
  b.cue(g8.frame0, 'idle', '');
  b.cue(s1.plate, 'reading', 'Read results/run_lucid.jsonl');
  b.cue(s2.splits - 0.2, 'searching', 'Search a 64 × 64 frame for objects');
  b.cue(s2.pressing, 'reading', 'Read results/run_lucid.jsonl (AR25)');
  b.cue(s2.plans, 'thinking', 'Planning a path over learned moves…');
  b.cue(s3.click, 'reading', 'Read paper/_results.tex (LP85 trace)');
  b.cue(B.levelAt + 0.05, 'success', 'LEVEL UP → 1');

  return {P, P8, g, gcx, gcy, fatalXY, ground, cellXY};
};
