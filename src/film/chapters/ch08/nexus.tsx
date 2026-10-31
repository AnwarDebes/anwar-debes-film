import React from 'react';
import {random} from 'remotion';
import {frameOn, pushIn} from '../../../engine/camera';
import {type FieldFn, type LiveLayer, type RGB} from '../../../engine/pins';
import {HANDOFF} from '../../handoff';
import {KineticLine} from '../../../engine/type';
import {color, font, layout} from '../../../engine/tokens';
import type {Word} from '../../../engine/narration/types';
import type {Builder} from '../ch06/kit/builder';
import {CaseStamp, Cites, PathKicker, PlaceTitle, Tag, WallLabels, pull, type CiteSpec, type WallText} from '../ch06/kit/overlays';
import {PIN, disc, rect, ring, seg, type Shape} from '../ch06/kit/shapes';
import {hollowBar} from '../ch06/numbers';
import type {Times08} from './times';
import type {Beats08} from './beats';

// 08.6 RL: an empty repository whose one-line description is the same task. 08.7 RL-CCA: NEXUS,
// whose core is a line-for-line copy of the course server's scoring, a time component that costs
// a point per second of thinking, a six-player diagnostic, and no results yet. It ends on the
// chapter's payoff beside LUCID's one locked red pin.

const RLCCA = 'RL-CCA';
const R = 4;

/** The 121 holes of the Chinese Checkers star in axial coordinates (as the nexus emblem draws it). */
export const starCells = (): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  const tip = (a: number, b2: number, c2: number) => a > R && a <= 2 * R && b2 <= 0 && c2 <= 0 && b2 >= -R && c2 >= -R;
  for (let q = -2 * R; q <= 2 * R; q++)
    for (let r = -2 * R; r <= 2 * R; r++) {
      const s = -q - r;
      const inHex = Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= R;
      if (inHex || tip(q, r, s) || tip(r, q, s) || tip(s, q, r) || tip(-q, -r, -s) || tip(-r, -q, -s) || tip(-s, -q, -r)) cells.push([q, r]);
    }
  return cells;
};

/** Which home triangle a cell belongs to (0..5), or -1 for the centre hexagon. */
const triangleOf = ([q, r]: [number, number]): number => {
  const s = -q - r;
  const tip = (a: number, b2: number, c2: number) => a > R && b2 <= 0 && c2 <= 0;
  if (tip(q, r, s)) return 0;
  if (tip(r, q, s)) return 1;
  if (tip(s, q, r)) return 2;
  if (tip(-q, -r, -s)) return 3;
  if (tip(-r, -q, -s)) return 4;
  if (tip(-s, -q, -r)) return 5;
  return -1;
};

const MARBLE: RGB[] = [
  [0.96, 0.46, 0.42],
  [0.46, 0.63, 0.98],
  [0.5, 0.86, 0.56],
  [0.98, 0.86, 0.46],
  [0.88, 0.52, 0.86],
  [0.98, 0.67, 0.4],
];

export const buildNexus = (b: Builder, T: Times08, B: Beats08, ground: FieldFn, fatal: {X: number; Y: number}) => {
  const {S} = b;
  const s6 = T.s6;
  const s7 = T.s7;
  const cells = starCells();
  const hole = (cx: number, cy: number, [q, r]: [number, number]): [number, number] => [cx + 3 * (q + r / 2), cy - 2.6 * r];

  // ---------------------------------------------------------------- 08.6 RL: the empty board
  const rlC: [number, number] = [64, S.ext / 2 + 1];
  const P10 = frameOn(b.ctx.board, {uv: S.uv(rlC[0], rlC[1]), pinsAcross: 140, screen: [0.42, 0.52], yaw: 0.1, pitch: 0.06, aspect: b.aspect});
  const holes = (cx: number, cy: number): Shape[] => cells.map((c) => {
    const [x, y] = hole(cx, cy, c);
    return disc(x, y, 0.62, {h: 0, tint: 0.24});
  });
  const plateStar = (cx: number, cy: number): Shape[] => [
    // a raised star-shaped plate (two triangles) under the holes
    ...cells.map((c) => {
      const [x, y] = hole(cx, cy, c);
      return disc(x, y, 1.7, {h: 0.08, tint: 0.8});
    }),
  ];
  const rlBoard = [...plateStar(rlC[0], rlC[1]), ...holes(rlC[0], rlC[1])];

  // ---------------------------------------------------------------- 08.7 RL-CCA: mid-game, six colours
  const cc: [number, number] = [120, S.ext / 2 + 3];
  const P11 = frameOn(b.ctx.board, {uv: S.uv(cc[0], cc[1]), pinsAcross: 150, screen: [0.68, 0.47], yaw: -0.08, pitch: 0.06, aspect: b.aspect});
  const at11 = (fx: number, fy: number) => b.at(P11, fx, fy);
  const occupied = new Map<string, number>();
  for (let p = 0; p < 6; p++) {
    const home = cells.filter((c) => triangleOf(c) === p);
    const centre = cells.filter((c) => triangleOf(c) === -1);
    let placed = 0;
    // a seeded mid-game: some marbles still home, some out in the centre
    home.forEach((c, k) => {
      if (random(`c08-home-${p}-${k}`) < 0.55 && placed < 6) {
        occupied.set(`${c[0]},${c[1]}`, p);
        placed++;
      }
    });
    let k = 0;
    while (placed < 10 && k < 400) {
      const c = centre[Math.floor(random(`c08-mid-${p}-${k}`) * centre.length)];
      const key = `${c[0]},${c[1]}`;
      if (!occupied.has(key)) {
        occupied.set(key, p);
        placed++;
      }
      k++;
    }
  }
  const marbles = (lit: boolean): Shape[] =>
    cells.flatMap((c) => {
      const p = occupied.get(`${c[0]},${c[1]}`);
      if (p === undefined) return [];
      const [x, y] = hole(cc[0], cc[1], c);
      return [disc(x, y, 1.15, lit ? {h: 0.3, tint: MARBLE[p], paint: 0.62} : {h: 0.12, tint: 0.55})];
    });
  const ccBoard = (lit: boolean) => [...plateStar(cc[0], cc[1]), ...holes(cc[0], cc[1]), ...marbles(lit)];
  // one marble hopping (the NEXUS emblem's picture, played on the real board): three jumps on the
  // 0.45 s clock, each over an occupied hole, out of the bottom home triangle (a schematic move)
  const hopPath: Array<[number, number]> = [
    [-3, 7],
    [-3, 5],
    [-3, 3],
    [-3, 1],
  ];
  const hopOver: Array<[number, number]> = [
    [-3, 6],
    [-3, 4],
    [-3, 2],
  ];
  const key = (c: [number, number]) => `${c[0]},${c[1]}`;
  for (const c of hopPath) occupied.delete(key(c));
  for (const c of hopOver) occupied.set(key(c), 2);
  const hopper = 1;
  const hopFrom = s7.nexus + 0.2;
  const HOP_S = 0.45;
  const hopXY = hopPath.map((c) => hole(cc[0], cc[1], c));
  const hopLook = {tint: MARBLE[hopper]};
  const hop: LiveLayer = {
    fn: (u, v, _i, t) => {
      const X = u / b.ctx.board.p;
      const Y = (v * b.ctx.board.extH) / b.ctx.board.p;
      const n = Math.max(0, Math.min(hopPath.length - 1 - 1e-9, (t - hopFrom) / HOP_S));
      const k = Math.floor(n);
      const f = n - k;
      const e = f * f * (3 - 2 * f);
      const [x0, y0] = hopXY[k];
      const [x1, y1] = hopXY[Math.min(hopPath.length - 1, k + 1)];
      const x = x0 + (x1 - x0) * e;
      const y = y0 + (y1 - y0) * e;
      const d = Math.hypot(X - x, Y - y);
      if (d > 1.5) return null;
      const a = Math.max(0, Math.min(1, (1.5 - d) / 0.6));
      return {h: (0.3 + 0.45 * Math.sin(Math.PI * f) * (t > hopFrom ? 1 : 0)) * a, tint: hopLook.tint, paint: 0.62 * a, glow: 0};
    },
    from: s7.start - 0.3,
    to: B.diffAt + 0.2,
    fadeS: 0.25,
    region: [...S.uv(Math.min(...hopXY.map((p) => p[0])) - 2, Math.min(...hopXY.map((p) => p[1])) - 2), ...S.uv(Math.max(...hopXY.map((p) => p[0])) + 2, Math.max(...hopXY.map((p) => p[1])) + 2)] as [number, number, number, number],
    speedHint: () => 1.2,
  };
  b.live.push(hop);
  const withEmblem = (f: FieldFn): FieldFn => f;

  // the four score components, each column drawn to its own maximum
  const [cx0, cBase] = at11(0.09, 0.62);
  const [cx1, cTop] = at11(0.45, 0.3);
  const cw = (cx1 - cx0) / 4;
  const ch = cTop - cBase;
  const columns = (time: number): Shape[] =>
    [time, 1, 1, 1].flatMap((v, k) => [
      rect(cx0 + (k + 0.5) * cw, cBase + ch / 2, cw - 3, ch, {h: 0.03, tint: 0.44}, {r: 0.8}),
      rect(cx0 + (k + 0.5) * cw, cBase + (ch * v) / 2, cw - 3, ch * v, k === 2 ? {h: 0.22, tint: 1.0} : {h: 0.2, tint: 0.95}, {r: 0.8}),
    ]);
  // the six-player diagnostic: 0 of 1,344 games at iteration 20; then the fixed curriculum
  const [hx0, hBase] = at11(0.09, 0.62);
  const [hx1, hTop] = at11(0.45, 0.34);
  const hw = (hx1 - hx0) / 5;
  const hh = hTop - hBase;
  const diag: Shape[] = [
    rect(hx0 + 0.5 * hw, hBase + hh / 2, hw - 2.6, hh, {h: 0.2, tint: 0.95}, {r: 0.7}),
    ...[1, 2, 3, 4].flatMap((k) => [...hollowBar(hx0 + (k + 0.5) * hw, hBase, hw - 2.6, hh * 0.16), rect(hx0 + (k + 0.5) * hw, hBase + 0.5, hw - 2.6, 1, {h: 0.16, tint: 1.0})]),
  ];
  const fixW = [0.3, 0.175, 0.175, 0.175, 0.175];
  const fixed: Shape[] = fixW.map((v, k) => rect(hx0 + (k + 0.5) * hw, hBase + (hh * v) / 0.35 / 2, hw - 2.6, (hh * v) / 0.35, k === 4 ? {h: 0.22, tint: PIN.mint, glow: 0.45} : {h: 0.2, tint: 0.95}, {r: 0.7}));
  const protos = (): Shape[] => [0, 1, 2].map((k) => ring(cx0 + 3 + k * 6, at11(0.1, 0.665)[1], 1.5, 0.55, {h: 0.12, tint: 0.8}));

  // ---------------------------------------------------------------- beats
  const wall = (shapes: Shape[]) => b.field(shapes, ground);
  b.beat('s6-board', s6.start - 0.45, wall(rlBoard), {sweep: {kind: 'linear', origin: S.uv(rlC[0] + 40, rlC[1]), direction: [-1, 0], speed: 0.6, jitterS: 0.02, tintFollowsWave: true}});
  const thread: LiveLayer = {
    fn: (u, v, _i, t) => {
      const X = u / b.ctx.board.p;
      const Y = (v * b.ctx.board.extH) / b.ctx.board.p;
      if (Math.abs(Y - rlC[1]) > 0.7) return null;
      const x0 = rlC[0] + 28;
      const x1 = 150;
      if (X < x0 || X > x1) return null;
      const k = Math.round((X - x0) / 3);
      if (Math.abs(X - (x0 + k * 3)) > 0.6) return null;
      const front = x0 + (t - s6.line) * 30;
      if (X > front) return null;
      return {h: 0.06, tint: [0.62, 0.95, 0.84], glow: 0.7};
    },
    from: s6.line - 0.1,
    to: s7.plate + 0.8,
    fadeS: 0.3,
    region: [...S.uv(rlC[0] + 27, rlC[1] - 1.5), ...S.uv(151, rlC[1] + 1.5)] as [number, number, number, number],
  };
  b.live.push(thread);
  b.beat('s7-board', s7.start - 0.3, withEmblem(wall(ccBoard(true))), {sweep: {kind: 'linear', origin: S.uv(cc[0] - 30, cc[1]), direction: [1, 0], speed: 0.55, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s7-dimboard', B.diffAt, withEmblem(wall(ccBoard(false))), {tintTauS: 0.5});
  b.beat('s7-columns', B.columnsAt, withEmblem(wall([...ccBoard(false), ...columns(1)])), {sweep: {kind: 'linear', origin: S.uv(cx0, cBase), direction: [0, 1], speed: 0.35, jitterS: 0.015}});
  // the time column drains: one point per second of thinking (shown over the scene's seconds)
  const drain: LiveLayer = {
    fn: (u, v, _i, t) => {
      const X = u / b.ctx.board.p;
      const Y = (v * b.ctx.board.extH) / b.ctx.board.p;
      const x = cx0 + 0.5 * cw;
      if (Math.abs(X - x) > (cw - 3) / 2 + 0.3) return null;
      const secs = Math.max(0, Math.floor(t - B.drainFrom));
      const level = cBase + ch * Math.max(0, 1 - secs / 100);
      if (Y < level || Y > cBase + ch + 0.5) return null;
      return {h: 0.03, tint: 0.44};
    },
    from: B.drainFrom,
    to: B.histAt,
    fadeS: 0.15,
    region: [...S.uv(cx0, cBase - 1), ...S.uv(cx0 + cw, cBase + ch + 1)] as [number, number, number, number],
  };
  b.live.push(drain);
  b.beat('s7-hist', B.histAt, withEmblem(wall([...ccBoard(false), ...diag])), {sweep: {kind: 'linear', origin: S.uv(hx0, hBase), direction: [0, 1], speed: 0.35, jitterS: 0.015}});
  b.beat('s7-fix', B.fixAt, withEmblem(wall([...ccBoard(false), ...fixed])), {sweep: {kind: 'linear', origin: S.uv(hx0, hBase), direction: [1, 0], speed: 0.4, jitterS: 0.015}});
  b.beat('s7-protos', B.protoAt, withEmblem(wall([...ccBoard(false), ...protos()])), {sweep: {kind: 'random', origin: [0.3, 0.5], speed: 1, spreadS: 0.5, jitterS: 0.02, tintFollowsWave: true}});
  // the payoff: the marbles re-target into the closing line, beside LUCID's one locked red pin
  // (placed a little inside the margin: the slow push-in carries the left end outward)
  const [ln0, lnY] = at11(0.1, 0.6);
  const [ln1] = at11(0.52, 0.6);
  const line: Shape = rect((ln0 + ln1) / 2 + 1.5, lnY, ln1 - ln0 - 3, 0.9, {h: 0.1, tint: PIN.mint, glow: 1}, {soft: 0.3});
  const redPin: Shape = disc(ln0 - 0.6, lnY, 0.9, {h: 0.3, tint: [1.25, 0.5, 0.5], paint: 1});
  b.beat('s7-line', B.lineAt, wall([line, redPin]), {sweep: {kind: 'linear', origin: S.uv(cc[0], cc[1]), direction: [-1, 0], speed: 0.55, jitterS: 0.012, tintFollowsWave: true}});
  b.beat('end', B.endAt, HANDOFF, {sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.9, jitterS: 0.04, tintFollowsWave: true}});
  void fatal;

  // ---------------------------------------------------------------- camera
  b.move(s6.start - 0.5, 1.2, P10);
  b.move(s6.start + 0.7, Math.max(0.5, s6.end - s6.start - 1.2), pushIn(P10, 0.03), 'inOutSine');
  // lateral dolly to the full star board beside it
  b.move(s7.start - 0.5, 1.8, P11);
  b.move(s7.start + 1.3, Math.max(1, B.endAt - s7.start - 1.4), pushIn(P11, 0.05), 'inOutSine');
  b.move(B.endAt - 0.1, Math.max(0.8, T.ch.end - B.endAt - 0.05), b.home);

  // ---------------------------------------------------------------- overlays
  const W = b.W;
  const H = b.H;
  const s6Out = s6.end - 0.2;
  b.overlay('s6', s6.start - 0.4, s6.end + 0.6, (t) => (
    <>
      <PlaceTitle t={t} at={s6.plate} exitAt={s6Out} name="RL" status="empty · 0 commits" />
      <PathKicker
        t={t}
        at={s6.plate + 0.3}
        exitAt={s6Out}
        text="“Design and implement a RL agent that can play Chinese Checkers against each other, as well as against a human.”"
        y={Math.round(0.215 * H)}
        tone={color.text.caption}
      />
      <Tag t={t} at={s6.empty} exitAt={s6Out} text="api-snapshot · GET /repos/AnwarDebes/RL · 2026-10-29 · size 0 · created 2026-04-01" x={Math.round(0.07 * W)} y={Math.round(0.69 * H)} />
    </>
  ));

  const out = s7.payoff - 0.4;
  const rows: Array<[string, string, string, string, string]> = [
    ['time', 'max(0.0, 100.0 - pl.time_taken_sec)', '211', 'max(0.0, 100.0 - time_taken_sec)', '37'],
    ['moves', '(4 if x < 45 else 18)', '215', '4.0 if move_count < 45 else 18.0', '48'],
    ['pins', 'pins_in_goal * 100.0', '223', '100.0 * pins_in_goal', '54'],
    ['distance', 'max(0.0, 200.0 - total_dist)', '234', 'max(0.0, 200.0 - total_distance)', '63'],
  ];
  const mono = (s: number, c: string, w = 500): React.CSSProperties => ({fontFamily: font.mono, fontSize: Math.round(s * H), color: c, fontWeight: w, whiteSpace: 'nowrap', fontVariantLigatures: 'none', fontFeatureSettings: '"calt" 0, "liga" 0'});
  const colLabels: WallText[] = [
    ...['time', 'moves', 'pins in goal', 'distance'].map((n, k): WallText => ({text: n, X: cx0 + (k + 0.5) * cw, Y: cBase - 3, at: B.columnsAt + 0.2, exitAt: B.histAt - 0.2, color: color.text.chipDim})),
    ...['max 100', 'max 1', 'max 1,000', 'max 200'].map((n, k): WallText => ({text: n, X: cx0 + (k + 0.5) * cw, Y: cTop + 2.8, h: 0.2, at: B.columnsAt + 0.3, exitAt: B.histAt - 0.2, mono: false, weight: 650, sizeH: 0.026})),
  ];
  const histLabels: WallText[] = [
    {text: '6-player games at iteration 20: 0 of 1,344', X: hx0, Y: hTop + 3.4, at: B.histAt + 0.2, exitAt: B.fixAt - 0.2, align: 'left', color: color.text.caption},
    {text: 'old curriculum: 2 players only until iteration 50', X: hx0, Y: hTop + 0.2, at: B.histAt + 0.5, exitAt: B.fixAt - 0.2, align: 'left', color: color.text.chipDim},
    ...['2', '3', '4', '5', '6'].map((n, k): WallText => ({text: `N=${n}`, X: hx0 + (k + 0.5) * hw, Y: hBase - 3, at: B.histAt + 0.2, exitAt: B.protoAt - 0.2, color: k === 4 ? color.text.caption : color.text.chipDim})),
    {text: 'players per game', X: hx0 + 2.5 * hw, Y: hBase - 6.2, at: B.histAt + 0.3, exitAt: B.protoAt - 0.2, color: color.text.tertiary},
    {text: '0', X: hx0 + 4.5 * hw, Y: hBase + 3.2, h: 0.16, at: B.histAt + 0.3, exitAt: B.fixAt - 0.2, mono: false, weight: 700, sizeH: 0.034},
    ...fixW.map((v, k): WallText => ({text: v.toFixed(k === 0 ? 2 : 3), X: hx0 + (k + 0.5) * hw, Y: hBase + (hh * v) / 0.35 + 2.6, h: 0.2, at: B.fixAt + 0.3 + k * 0.08, exitAt: B.protoAt - 0.2, mono: false, weight: 650, sizeH: 0.024, color: k === 4 ? color.accent.mint : color.text.display})),
    {text: 'fix: every player count from iteration 0 (sampling weights)', X: hx0, Y: hTop + 3.4, at: B.fixAt + 0.2, exitAt: B.protoAt - 0.2, align: 'left', color: color.accent.mintLabel},
  ];
  const s7Cites: CiteSpec[] = [
    {repo: RLCCA, path: 'README.md', line: '8-13', at: s7.plate + 0.4, exitAt: s7.core - 0.2, slot: 0},
    {repo: RLCCA, path: 'RLChineseCheckers/README.md', line: 2, at: s7.players - 0.2, exitAt: s7.core - 0.2, slot: 1},
    {repo: RLCCA, path: 'core/teacher_score.py', line: '1-8', at: s7.referee, exitAt: s7.second - 0.3, slot: 0},
    {repo: RLCCA, path: 'tests/test_pre_flight.py', line: '283-316', at: s7.tests, exitAt: s7.second - 0.3, slot: 1},
    {repo: RLCCA, path: 'core/teacher_score.py', line: '33-37, 119', at: s7.second, exitAt: B.histAt - 0.2, slot: 0},
    {repo: RLCCA, path: 'config.py', line: '139-149', at: B.histAt + 0.3, exitAt: B.protoAt - 0.2, slot: 0},
    {repo: RLCCA, path: 'config.py', line: '151-152', at: B.fixAt + 0.2, exitAt: B.protoAt - 0.2, slot: 1},
    {repo: RLCCA, path: 'config.py', line: 70, at: s7.noLog + 0.2, exitAt: out, slot: 2},
    {repo: RLCCA, path: 'flagship_coalition_mcts/README.md', line: 5, at: s7.prototypes, exitAt: out, slot: 3},
  ];
  // the payoff, set as the storyboard's two short sentences on the spoken words' times
  const tl = b.ctx.tl;
  const ww = (which: string) => tl.word('u0825', which);
  const statement: Word[] = [
    {text: 'One', tag: '', start: ww('One').start, end: ww('One').end},
    {text: 'copies', tag: '', start: ww('copies').start, end: ww('copies').end},
    {text: 'the', tag: '', start: ww('the').start, end: ww('the').end},
    {text: 'referee.', tag: '', start: ww('referee').start, end: ww('letter').end},
    {text: 'One', tag: '', start: ww('other').start, end: ww('other').end},
    {text: 'has', tag: '', start: ww('has').start, end: ww('has').end},
    {text: 'to', tag: '', start: tl.word('u0825', 11).start, end: tl.word('u0825', 11).end},
    {text: 'discover', tag: '', start: ww('discover').start, end: ww('discover').end},
    {text: 'the', tag: 'em', start: tl.word('u0825', -2).start, end: tl.word('u0825', -2).end},
    {text: 'rules.', tag: 'em', start: tl.word('u0825', -1).start, end: tl.word('u0825', -1).end},
  ];
  b.captionSkip.push('u0825');
  b.overlay('s7', s7.start - 0.5, T.ch.end, (t) => {
    const tab = pull(t, B.diffAt + 0.2, s7.second - 0.3);
    return (
      <>
        <PlaceTitle t={t} at={s7.plate} exitAt={B.diffAt} name="RL-CCA" status="coursework tournament agent (NEXUS) + 3 research prototypes · no results reported" />
        <PathKicker t={t} at={s7.nexus} exitAt={B.diffAt} text="NEXUS · 2 to 6 players · a course tournament" y={Math.round(0.215 * H)} tone={color.accent.mint} />
        {tab > 0 ? (
          <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.11 * H), opacity: tab}}>
            {rows.map(([name, a, la, bb, lb], k) => {
              const lit = pull(t, B.matchAt[k], s7.second - 0.3, 0.25);
              const c = lit > 0.5 ? color.accent.mint : color.text.caption;
              const fileW = Math.round(0.165 * W);
              return (
                <div key={name} style={{marginBottom: Math.round(0.014 * H)}}>
                  <div style={mono(0.022, color.text.chipDim)}>{name}</div>
                  <div style={{display: 'flex'}}>
                    <span style={{...mono(0.022, color.text.tertiary), width: fileW}}>game.py:{la}</span>
                    <span style={mono(0.022, c)}>{a}</span>
                  </div>
                  <div style={{display: 'flex'}}>
                    <span style={{...mono(0.022, color.text.tertiary), width: fileW}}>teacher_score.py:{lb}</span>
                    <span style={mono(0.022, c)}>{bb}</span>
                  </div>
                </div>
              );
            })}
            <div style={{...mono(0.022, color.text.tertiary), marginTop: Math.round(0.004 * H)}}>final = the sum of the four · game.py:236 · teacher_score.py:86</div>
          </div>
        ) : null}
        {['move_score(45) = 1.0', 'pin_goal_score(7) = 700', 'distance_score(50) = 150'].map((txt, k) => (
          <CaseStamp key={txt} text={txt} at={B.stampAt[k]} t={t} exitAt={s7.second - 0.3} x={Math.round((0.15 + k * 0.155) * W)} y={Math.round(0.625 * H)} />
        ))}
        <WallLabels t={t} lens={b.lens} items={[...colLabels, ...histLabels]} />
        {pull(t, B.columnsAt + 0.4, B.histAt - 0.2) > 0 ? (
          <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.095 * H), opacity: pull(t, B.columnsAt + 0.4, B.histAt - 0.2), whiteSpace: 'nowrap'}}>
            <div style={{fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(0.04 * H), color: color.text.display}}>100 + 1 + 1,000 + 200 = 1,301</div>
            <div style={{...mono(0.022, color.text.chipDim), marginTop: Math.round(0.006 * H)}}>
              time {100 - Math.max(0, Math.min(100, Math.floor(t - B.drainFrom)))} · one point per second of thinking
            </div>
          </div>
        ) : null}
        <Tag t={t} at={s7.noLog} exitAt={out} text="0.45 s per move (configured cap; no timing log committed)" x={Math.round(0.07 * W)} y={Math.round(0.16 * H)} />
        <Tag t={t} at={s7.prototypes} exitAt={out} text="three research prototypes · results not reported yet" x={Math.round(0.07 * W)} y={Math.round(0.215 * H)} />
        <KineticLine words={statement} t={t} kind="statement" variant="rise" x={Math.round(W * 0.1)} y={Math.round(0.33 * H)} yAnchor="capTop" maxWidth={Math.round(W * 0.74)} maxLines={2} exitAt={B.endAt - 0.1} underline />
        <Cites t={t} items={s7Cites} />
      </>
    );
  });

  // ---------------------------------------------------------------- Pixie
  b.cue(s6.plate, 'reading', 'Read the description (no files)');
  b.cue(s7.plate, 'reading', 'Read RL-CCA/README.md');
  b.cue(B.diffAt, 'reading', 'Read game.py compute_scores');
  b.cue(s7.diagnostic, 'reading', 'Read config.py:146-149');
  b.cue(s7.payoff, 'idle', '');

  return {P11};
};
