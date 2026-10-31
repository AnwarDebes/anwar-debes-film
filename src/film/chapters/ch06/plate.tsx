import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import {HANDOFF} from '../../handoff';
import {GlassCard} from '../../../engine/type';
import {color, font} from '../../../engine/tokens';
import type {Builder} from './kit/builder';
import {Cites, PathKicker, PlaceTitle, Statement, Tag, WallLabels, pull, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, disc, rect, ring, seg, type Look, type Shape} from './kit/shapes';
import {hollowBar} from './numbers';
import type {Times06} from './times';
import type {Beats06} from './beats';

// 06.6-06.9: the clause family on one gate plate (upper right). Four empty sockets along its top
// fill one per repository (graph input, escalation, explanation, fact-check); the plate is the
// film's diagram and the four are separate repositories, whose own numbers sit in the left column.
// It ends on one honest scoreboard and the chapter's payoff.

const SOCKETS = ['input', 'escalate', 'explain', 'fact-check'];

export const buildPlate = (b: Builder, T: Times06, ground: Look, B: Beats06) => {
  const {S} = b;
  const s6 = T.s6;
  const s7 = T.s7;
  const s8 = T.s8;
  const s9 = T.s9;
  // the plate sits a little right along the wall: the move from 06.5 is a lateral dolly
  const P6 = frameOn(b.ctx.board, {uv: S.uv(97, S.ext / 2), pinsAcross: 146, yaw: -0.1, pitch: 0.06, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P6, fx, fy);

  // ---------------------------------------------------------------- the plate
  const [pcx, pcy] = at(0.695, 0.36);
  const PW = 44;
  const PH = 34;
  const px0 = pcx - PW / 2;
  const px1 = pcx + PW / 2;
  const py0 = pcy - PH / 2;
  const py1 = pcy + PH / 2;
  const sockX = SOCKETS.map((_, k) => pcx + (k - 1.5) * 10.5);
  const sockY = py1 - 3.4;
  const eTop = sockY - 4.2;
  const eBot = py0 + 2.4;
  const eMid = (eTop + eBot) / 2;
  const rim: Look = {h: 0.12, tint: 0.95};
  const plateBase: Shape[] = [
    rect(pcx, pcy, PW, PH, {h: 0.05, tint: 0.56}, {r: 2.2}),
    seg(px0, py0, px1, py0, 0.8, rim),
    seg(px0, py1, px1, py1, 0.8, rim),
    seg(px0, py0, px0, py1, 0.8, rim),
    seg(px1, py0, px1, py1, 0.8, rim),
    // the input edge (left) and the verdict edge (right)
    rect(px0 + 2.2, eMid, 1.5, eTop - eBot, {h: 0.14, tint: 1.0}, {r: 0.6}),
    rect(px1 - 2.2, eMid, 1.5, eTop - eBot, {h: 0.14, tint: 1.0}, {r: 0.6}),
  ];
  const socket = (k: number, filled: boolean): Shape => rect(sockX[k], sockY, 6.4, 4, filled ? {h: 0.2, tint: PIN.mint, glow: 0.7} : {h: 0, tint: 0.24}, {r: 1});
  const plate = (filled: number, inner: Shape[] = []): Shape[] => [...plateBase, ...SOCKETS.map((_, k) => socket(k, k < filled)), ...inner];
  const wall = (shapes: Shape[]) => b.field(shapes, ground);
  const ix0 = px0 + 5;
  const ix1 = px1 - 5;
  const vX = px1 - 2.2;
  const vY = [eMid + 6.5, eMid, eMid - 6.5];
  const vPin = (k: number, lit: boolean) => disc(vX, vY[k], 1.3, lit ? {h: 0.32, tint: PIN.mint, glow: 0.85} : {h: 0.2, tint: 0.92});
  const link = (x0: number, y0: number, x1: number, y1: number) => seg(x0, y0, x1, y1, 0.6, {h: 0.06, tint: PIN.mint, glow: 0.65});

  // ---------------------------------------------------------------- left column
  const [lx0] = at(0.08, 0.5);
  const [lx1] = at(0.44, 0.5);
  const lw = lx1 - lx0;

  // ---------------------------------------------------------------- 06.6 clausegate
  const graph = (cx: number, cy: number, n: number, seed: number): Shape[] => {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + seed;
      pts.push([cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 2.2]);
    }
    const out: Shape[] = [];
    for (let k = 1; k < n; k++) out.push(seg(pts[0][0], pts[0][1], pts[k][0], pts[k][1], 0.45, {h: 0.06, tint: 0.9}));
    pts.forEach(([x, y], k) => out.push(disc(x, y, k === 0 ? 1.0 : 0.75, {h: k === 0 ? 0.2 : 0.15, tint: 1.0})));
    return out;
  };
  const gYs = [eTop - 2.2, eMid, eBot + 2.2];
  const gX = ix0 + 2.5;
  const graphs = [...graph(gX, gYs[0], 5, 0.3), ...graph(gX, gYs[1], 4, 1.1), ...graph(gX, gYs[2], 5, 2.0)];
  const BITS = [1, 0, 1, 1, 0, 0, 1, 0, 1];
  const bitX = (k: number) => ix0 + 9 + k * 1.9;
  const bitRow = (lit: boolean): Shape[] => BITS.map((on, k) => disc(bitX(k), eMid, 0.48, on ? (lit ? {h: 0.18, tint: PIN.mint, glow: 0.6} : {h: 0.18, tint: 1.0}) : {h: 0.03, tint: 0.42}, {soft: 0.2}));
  const binds = gYs.map((y) => seg(gX + 3.6, y, bitX(0) - 1, eMid, 0.45, {h: 0.05, tint: 0.85}));
  const vote = link(bitX(BITS.length - 1) + 1, eMid, vX - 1.4, vY[2]);
  const CM = [
    [27, 0, 39],
    [0, 34, 63],
    [0, 3, 190],
  ];
  const cell = 7.4;
  const [mcx, mcy] = at(0.27, 0.44);
  // (matrix cells span fy ~0.31-0.55; column labels above them)
  const cmCell = (r: number, c: number): [number, number] => [mcx + (c - 1) * cell, mcy - (r - 1) * cell];
  const matrix: Shape[] = CM.flatMap((row, r) =>
    row.map((n, c) => {
      const [x, y] = cmCell(r, c);
      if (n === 0) return r === 1 && c === 0 ? ring(x, y, 2.6, 0.7, {h: 0.12, tint: PIN.mint, glow: 0.75}) : rect(x, y, cell - 1.4, cell - 1.4, {h: 0.02, tint: 0.46}, {r: 1});
      return rect(x, y, cell - 1.4, cell - 1.4, {h: 0.05 + 0.5 * Math.sqrt(n / 190), tint: c === 2 ? 1.0 : 0.86}, {r: 1});
    }),
  );
  const [, uy] = at(0.1, 0.645);
  const utility: Shape[] = [
    ...hollowBar(lx0 + lw / 2, uy - 1.5, lw, 3).map((x) => ({...x, look: {h: 0.1, tint: 0.7}}) as Shape),
    rect(lx0 + (lw * 0.302) / 2, uy, lw * 0.302, 3, {h: 0.2, tint: 1.0}, {r: 0.6}),
    seg(lx0 + lw * 0.6, uy - 3.2, lx0 + lw * 0.6, uy + 3.2, 0.6, {h: 0.18, tint: 1.0}, {dash: [1.0, 0.8]}),
  ];

  // ---------------------------------------------------------------- 06.7 Clause-Driven-LLM
  const mX = ix1 - 1;
  const mScale = (v: number) => eBot + ((eTop - eBot) * v) / 7000;
  const thr = mScale(1500);
  const meter = (v: number | null): Shape[] => [
    rect(mX, eMid, 3, eTop - eBot, {h: 0.03, tint: 0.42}, {r: 0.8}),
    seg(mX - 3.2, thr, mX + 3.2, thr, 0.55, {h: 0.18, tint: 1.0}, {dash: [0.9, 0.7]}),
    ...(v !== null ? [rect(mX, (eBot + mScale(v)) / 2, 3, Math.max(1, mScale(v) - eBot), v < 1500 ? {h: 0.2, tint: 0.85} : {h: 0.22, tint: PIN.mint, glow: 0.5}, {r: 0.6})] : []),
  ];
  const qRow = (y: number, look: Look): Shape => rect(ix0 + 12, y, 25, 3.2, look, {r: 1.1});
  const qY = [eTop - 3, eBot + 4];
  const human = (lit: boolean): Shape[] => [
    disc(vX, vY[2] + 0.9, 1.0, lit ? {h: 0.34, tint: PIN.mint, glow: 0.85} : {h: 0.2, tint: 0.95}),
    rect(vX, vY[2] - 2.0, 2.6, 2.8, lit ? {h: 0.28, tint: PIN.mint, glow: 0.7} : {h: 0.16, tint: 0.95}, {r: 1.2}),
  ];
  const pairs: Array<[number, number, number]> = [
    [0.942, 0.956, 1],
    [0.94, 0.962, 1],
    [0.0028, 0.217, 0.25],
  ];
  const [, bBase] = at(0.1, 0.6);
  const [, bTop] = at(0.1, 0.38);
  const pw = lw / 3;
  const bh = bTop - bBase;
  const missBars: Shape[] = pairs.flatMap(([tm, base, scale], k) => {
    const cx = lx0 + (k + 0.5) * pw;
    const hTm = Math.max(1, (bh * tm) / scale);
    const hBase = (bh * base) / scale;
    return [
      rect(cx - 2.3, bBase + hTm / 2, 3.4, hTm, {h: 0.2, tint: 1.0}, {r: 0.6}),
      rect(cx + 2.3, bBase + hBase / 2, 3.4, hBase, {h: 0.14, tint: 0.6}, {r: 0.6}),
    ];
  });

  // ---------------------------------------------------------------- 06.8 clause86
  const litA = [0, 1, 2].map((k) => ix0 + 6 + k * 4);
  const litB = [0, 1].map((k) => ix0 + 6 + k * 4);
  const cA = eMid + 4.5;
  const cB = eMid - 4.5;
  const clauses = (lit: boolean): Shape[] => {
    const L: Look = lit ? {h: 0.2, tint: PIN.mint, glow: 0.6} : {h: 0.18, tint: 0.98};
    return [
      rect(ix0 + 10, cA, 18, 3.6, {h: 0.07, tint: 0.7}, {r: 1.1}),
      rect(ix0 + 8, cB, 14, 3.6, {h: 0.07, tint: 0.7}, {r: 1.1}),
      ...litA.map((x) => disc(x, cA, 1.0, L)),
      ...litB.map((x) => disc(x, cB, 1.0, L)),
      ...(lit ? [link(ix0 + 19.5, cA, vX - 1.4, vY[0]), link(ix0 + 15.5, cB, vX - 1.4, vY[0]), vPin(0, true)] : [vPin(0, false)]),
    ];
  };
  const synth = [0.775, 0.6875, 0.5125, 0.9125, 1.0];
  const adult = [0.7389, 0.7638, 0.7638, 0.7638, 0.7638];
  const sw = lw / 5;
  const [, sBase] = at(0.1, 0.62);
  const [, sTop] = at(0.1, 0.4);
  const sH = sTop - sBase;
  const seedBars = (vals: number[]): Shape[] => vals.map((v, k) => rect(lx0 + (k + 0.5) * sw, sBase + (sH * v) / 2, sw - 2.4, sH * v, {h: 0.2, tint: 1.0}, {r: 0.6}));
  const majority = seg(lx0 - 2, sBase + sH * 0.764, lx1 + 2, sBase + sH * 0.764, 0.7, {h: 0.27, tint: 1.05}, {dash: [1.2, 1.0]});

  // ---------------------------------------------------------------- 06.9 clauseguard
  const tX = [ix0 + 2, pcx - 1, ix1 - 3];
  const tC = eMid + 5;
  const tE = eMid - 5;
  const triple = (y: number, neg: boolean): Shape[] => [
    disc(tX[0], y, 1.15, {h: 0.2, tint: 1.0}),
    seg(tX[0] + 1.3, y, tX[1] - 1.3, y, 0.5, {h: 0.06, tint: 0.9}),
    disc(tX[1], y, 1.15, neg ? {h: 0.2, tint: 0.68} : {h: 0.2, tint: 1.0}),
    seg(tX[1] + 1.3, y, tX[2] - 1.3, y, 0.5, {h: 0.06, tint: 0.9}),
    disc(tX[2], y, 1.15, {h: 0.2, tint: 1.0}),
  ];
  const contradict = seg(tX[1], tC - 1.4, tX[1], tE + 1.4, 0.8, {h: 0.12, tint: PIN.mint, glow: 0.85});
  const [, tgY] = at(0.1, 0.46);
  const targets: Shape[] = [...Array(5).keys()].map((k) => ring(lx0 + 3 + k * ((lw - 6) / 4), tgY, 1.6, 0.55, {h: 0.12, tint: 0.8}));

  // ---------------------------------------------------------------- beats
  b.beat('s6-plate', s6.start - 0.6, wall(plate(0)), {sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.75, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s6-sock', s6.input - 0.05, wall(plate(1, graphs)), {sweep: {origin: S.uv(sockX[0], sockY), speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});
  b.beat('s6-bits', s6.graphs - 0.05, wall(plate(1, [...binds, ...graphs, ...bitRow(false)])), {sweep: {kind: 'linear', origin: S.uv(gX, eMid), direction: [1, 0], speed: 0.35, jitterS: 0.02, tintFollowsWave: true}});
  const {voteAt} = B;
  const voted = plate(1, [...bitRow(true), vote, vPin(0, false), vPin(1, false), vPin(2, true)]);
  b.beat('s6-vote', voteAt, wall(voted), {sweep: {kind: 'linear', origin: S.uv(bitX(0), eMid), direction: [1, 0], speed: 0.4, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s6-matrix', s6.seeds - 0.2, wall([...voted, ...matrix]), {sweep: {kind: 'linear', origin: S.uv(mcx, mcy - 1.5 * cell), direction: [0, 1], speed: 0.3, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s6-utility', s6.thirty - 0.1, wall([...voted, ...matrix, ...utility]), {sweep: {kind: 'linear', origin: S.uv(lx0, uy), direction: [1, 0], speed: 0.4, jitterS: 0.015}});
  b.ripple(s6.human, cmCell(2, 2)[0], cmCell(2, 2)[1], {amp: 0.3});

  const {q2At, escAt} = B;
  const q1 = [qRow(qY[0], LOOK.tile)];
  b.beat('s7-sock', s7.start - 0.2, wall(plate(2, [...meter(null), vPin(0, false), ...human(false)])), {sweep: {origin: S.uv(sockX[1], sockY), speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});
  b.beat('s7-q1', s7.transcript - 0.15, wall(plate(2, [...q1, ...meter(null), vPin(0, false), ...human(false)])), {sweep: {kind: 'linear', origin: S.uv(px0, qY[0]), direction: [1, 0], speed: 0.5, jitterS: 0.02}});
  b.beat('s7-q1m', s7.transcript + 0.6, wall(plate(2, [...q1, ...meter(6760), link(ix0 + 25, qY[0], vX - 1.4, vY[0]), vPin(0, true), ...human(false)])), {
    sweep: {kind: 'linear', origin: S.uv(mX, eBot), direction: [0, 1], speed: 0.35, jitterS: 0.015, tintFollowsWave: true},
  });
  b.beat('s7-q2', q2At, wall(plate(2, [qRow(qY[0], LOOK.tileDim), qRow(qY[1], LOOK.tile), ...meter(null), vPin(0, false), ...human(false)])), {sweep: {kind: 'linear', origin: S.uv(px0, qY[1]), direction: [1, 0], speed: 0.5, jitterS: 0.02}});
  b.beat('s7-q2m', escAt, wall(plate(2, [qRow(qY[0], LOOK.tileDim), qRow(qY[1], LOOK.tile), ...meter(584), vPin(0, false), ...human(false)])), {sweep: {kind: 'linear', origin: S.uv(mX, eBot), direction: [0, 1], speed: 0.35, jitterS: 0.015}});
  const toHuman = [qRow(qY[0], LOOK.tileDim), qRow(qY[1], LOOK.tile), ...meter(584), vPin(0, false), ...human(true), link(ix0 + 25, qY[1], vX - 1.6, vY[2])];
  b.beat('s7-human', s7.person - 0.1, wall(plate(2, toHuman)), {sweep: {kind: 'linear', origin: S.uv(ix0 + 18, qY[1]), direction: [1, 0], speed: 0.45, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s7-miss', s7.oos - 0.15, wall([...plate(2, toHuman), ...missBars]), {sweep: {kind: 'linear', origin: S.uv(lx0, bBase), direction: [0, 1], speed: 0.3, jitterS: 0.015}});

  b.beat('s8-sock', s8.start - 0.2, wall(plate(3, clauses(false))), {sweep: {origin: S.uv(sockX[2], sockY), speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});
  b.beat('s8-fired', s8.fired - 0.1, wall(plate(3, clauses(true))), {sweep: {kind: 'linear', origin: S.uv(ix0, eMid), direction: [1, 0], speed: 0.45, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s8-seeds', s8.readme - 0.2, wall([...plate(3, clauses(true)), ...seedBars(synth)]), {sweep: {kind: 'linear', origin: S.uv(lx0, sBase), direction: [0, 1], speed: 0.32, jitterS: 0.015}});
  b.beat('s8-adult', s8.adult - 0.05, wall([...plate(3, clauses(false)), ...seedBars(adult), majority]), {sweep: {kind: 'linear', origin: S.uv(lx0, sBase + sH), direction: [0, -1], speed: 0.3, jitterS: 0.015}});

  const tr = [...triple(tC, false), ...triple(tE, true)];
  b.beat('s9-sock', s9.start - 0.2, wall(plate(4, tr)), {sweep: {origin: S.uv(sockX[3], sockY), speed: 0.5, jitterS: 0.03, tintFollowsWave: true}});
  b.beat('s9-contra', s9.contradict - 0.1, wall(plate(4, [...tr, contradict])), {sweep: {origin: S.uv(tX[1], eMid), speed: 0.4, jitterS: 0.02, tintFollowsWave: true}});
  b.ripple(s9.contradict, tX[1], eMid, {amp: 0.25});
  b.beat('s9-targets', s9.runs - 0.1, wall([...plate(4, [...tr, contradict]), ...targets]), {sweep: {kind: 'linear', origin: S.uv(lx0, tgY), direction: [1, 0], speed: 0.35, jitterS: 0.015}});
  // the plate re-targets into the closing line (left half) as the scoreboard comes up on the right
  const [ln0, lnY] = at(0.07, 0.64);
  const [ln1] = at(0.5, 0.64);
  const line = rect((ln0 + ln1) / 2, lnY, ln1 - ln0, 0.9, {h: 0.1, tint: PIN.mint, glow: 1}, {soft: 0.3});
  b.beat('s9-line', s9.board - 0.25, wall([line]), {sweep: {kind: 'linear', origin: S.uv(px1, pcy), direction: [-1, 0], speed: 0.55, jitterS: 0.012, tintFollowsWave: true}});
  const {endAt} = B;
  b.beat('end', endAt, HANDOFF, {sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.9, jitterS: 0.04, tintFollowsWave: true}});

  // ---------------------------------------------------------------- camera
  b.move(s6.start - 0.9, 1.7, P6);
  b.move(s6.start + 0.8, s6.end - s6.start - 1.2, pushIn(P6, 0.035), 'inOutSine');
  b.move(s7.start - 0.3, 1.0, P6);
  b.move(s7.start + 0.8, s7.end - s7.start - 1.2, pushIn(P6, 0.035), 'inOutSine');
  b.move(s8.start - 0.3, 1.0, P6);
  b.move(s8.start + 0.8, s8.end - s8.start - 1.2, pushIn(P6, 0.035), 'inOutSine');
  b.move(s9.start - 0.3, 1.0, P6);
  b.move(s9.start + 0.8, Math.max(1, endAt - s9.start - 1.0), pushIn(P6, 0.04), 'inOutSine');
  // home to the handoff pose while the wall settles to bare steel
  b.move(endAt - 0.1, Math.max(0.8, T.ch.end - endAt - 0.05), b.home);

  // ---------------------------------------------------------------- overlays
  const L = (text: React.ReactNode, X: number, Y: number, a: number, e: number, extra: Partial<WallText> = {}): WallText => ({text, X, Y, at: a, exitAt: e, ...extra});
  const plateOut = s9.board - 0.3;
  const s6Out = s7.start - 0.3;
  const s7Out = s8.start - 0.3;
  const s8Out = s9.start - 0.3;
  const sockLabels: WallText[] = SOCKETS.map((n, k) => L(n, sockX[k], py1 + 2.4, s6.start + 0.2 + k * 0.1, plateOut, {color: color.text.chipDim}));
  const edgeLabels: WallText[] = [L('input', px0 - 1.4, eMid, s6.start + 0.5, plateOut, {align: 'right', color: color.text.chipDim}), L('verdict', px1 + 1.4, eMid, s6.start + 0.5, plateOut, {align: 'left', color: color.text.chipDim})];

  const s6Labels: WallText[] = [
    ...['action', 'context', 'policy'].map((n, k) => L(n, gX + 4, gYs[k] + 2.3, s6.input + 0.1 + k * 0.1, voteAt, {align: 'left', color: color.text.chipDim})),
    ...['allow', 'deny', 'oversight'].map((n, k) => L(n, vX - 2.2, vY[k], voteAt + 0.1, s6Out, {align: 'right', color: k === 2 ? color.accent.mint : color.text.chipDim})),
    ...CM.flatMap((row, r) => row.map((n, c) => L(String(n), cmCell(r, c)[0], cmCell(r, c)[1], s6.seeds + 0.2, s6Out, {h: 0.05 + 0.5 * Math.sqrt(n / 190), mono: false, weight: 700, sizeH: 0.027, color: n === 0 ? color.accent.mint : color.text.display}))),
    ...['allow', 'deny', 'oversight'].map((n, c) => L(n, cmCell(0, c)[0], mcy + 1.5 * cell + 1.6, s6.seeds, s6Out, {color: c === 2 ? color.accent.mintLabel : color.text.chipDim})),
    ...['allow', 'deny', 'oversight'].map((n, r) => L(n, mcx - 1.5 * cell - 1.2, cmCell(r, 0)[1], s6.seeds, s6Out, {align: 'right', color: color.text.chipDim})),
    L('seed 1 · predicted →', mcx + 1.5 * cell + 2, mcy + 1.5 * cell + 1.6, s6.seeds + 0.2, s6Out, {align: 'left', color: color.text.tertiary}),
    L('true ↓', mcx - 1.5 * cell - 1.2, mcy + 1.5 * cell + 1.6, s6.seeds + 0.2, s6Out, {align: 'right', color: color.text.tertiary}),
    L('DENY → ALLOW: 0', mcx + 1.5 * cell + 2, cmCell(1, 0)[1], s6.noAttack, s6Out, {align: 'left', color: color.accent.mint}),
    L('benign utility 0.302 ± 0.156', lx0, uy + 3.9, s6.thirty, s6Out, {align: 'left'}),
    L('target ≥ 0.60', lx0 + lw * 0.6 + 1.2, uy + 3.9, s6.thirty + 0.3, s6Out, {align: 'left', color: color.text.chipDim}),
  ];

  const s7Labels: WallText[] = [
    L('threshold 1,500', mX - 2.2, thr + 1.7, s7.start + 0.4, s7Out, {align: 'right', color: color.text.tertiary}),
    L('margin', mX, eTop + 2.0, s7.start + 0.4, s7Out, {color: color.text.chipDim}),
    ...['routing', 'OOS AUROC', 'recall @ 95% P'].map((n, k) => L(n, lx0 + (k + 0.5) * pw, bBase - 3.0, s7.oos, s7Out, {color: color.text.chipDim})),
    ...pairs.flatMap(([tm, base, scale], k) => [
      L(k === 0 ? '94.2%' : k === 1 ? '0.940' : '0.0028', lx0 + (k + 0.5) * pw - 2.3, bBase + Math.max(1, (bh * tm) / scale) + 2.4, s7.oos + 0.3, s7Out, {h: 0.2, mono: false, weight: 700, sizeH: 0.026}),
      L(k === 0 ? '95.6%' : k === 1 ? '0.962' : '0.217', lx0 + (k + 0.5) * pw + 2.3, bBase + (bh * base) / scale + (k < 2 ? 5.4 : 2.4), s7.oos + 0.5, s7Out, {h: 0.14, mono: false, weight: 600, sizeH: 0.024, color: color.text.chipDim}),
    ]),
  ];

  const s8Labels: WallText[] = [
    L('HIRE', vX - 2.2, vY[0], s8.fired, s8.adult - 0.1, {align: 'right', color: color.accent.mint}),
    ...synth.map((v, k) => L(v.toFixed(2), lx0 + (k + 0.5) * sw, sBase + sH * v + 2.0, s8.readme + 0.2 + k * 0.08, s8.adult - 0.1, {h: 0.2, mono: false, weight: 700, sizeH: 0.024})),
    ...adult.map((v, k) => L(v.toFixed(3), lx0 + (k + 0.5) * sw, sBase + 2.4, s8.adult + 0.4 + k * 0.06, s8Out, {h: 0.2, mono: false, weight: 600, sizeH: 0.022, color: color.text.caption})),
  ];

  const s9Labels: WallText[] = [
    L('claim', ix0 - 1, tC + 2.4, s9.start + 0.2, plateOut, {align: 'left', color: color.text.chipDim}),
    L('evidence', ix0 - 1, tE - 2.4, s9.start + 0.3, plateOut, {align: 'left', color: color.text.chipDim}),
    L('drug_x', tX[0], tC - 2.3, s9.start + 0.2, plateOut, {color: color.text.tertiary}),
    L('treats +', tX[1] + 1.6, tC + 2.3, s9.start + 0.2, plateOut, {align: 'left', color: color.text.chipDim}),
    L('disease_y', tX[2], tC - 2.3, s9.start + 0.2, plateOut, {color: color.text.tertiary}),
    L('treats −', tX[1] + 1.6, tE - 2.3, s9.start + 0.4, plateOut, {align: 'left', color: color.text.caption}),
    L('contradict:negation', tX[1] + 1.4, eMid, s9.contradict, plateOut, {align: 'left', color: color.accent.mint}),
    ...['FEVER', 'HaluEval', 'FActScore', 'MedHallBench', 'SAT p50'].map((n, k) => L(n, lx0 + 3 + k * ((lw - 6) / 4), tgY - 3.2, s9.runs + 0.2 + k * 0.08, s9.board - 0.3, {color: color.text.chipDim})),
    L('target · not measured', lx0, tgY + 3.6, s9.runs + 0.4, s9.board - 0.3, {align: 'left', color: color.text.caption}),
  ];

  const cites: CiteSpec[] = [
    {repo: 'clausegate', path: 'README.md', line: '106-122', at: s6.input + 0.2, exitAt: s6.seeds - 0.2, slot: 0},
    {repo: 'clausegate', path: 'results/headline/agentdojo_full_5seed_aggregate.json', line: '6-13', at: s6.noAttack, exitAt: s6Out, slot: 0},
    {repo: 'clausegate', path: 'results/headline/agentdojo_full_seed_1.json', line: '28-44', at: s6.seeds + 0.4, exitAt: s6Out, slot: 1},
    {repo: 'clausegate', path: 'README.md', line: 138, at: s6.thirty + 0.3, exitAt: s6Out, slot: 2},
    {repo: 'Clause-Driven-LLM', path: 'docs/demo_transcript.txt', line: '17-19, 45-47', at: s7.transcript + 0.3, exitAt: s7.oos - 0.2, slot: 0},
    {repo: 'Clause-Driven-LLM', path: 'README.md', line: '48-50', at: s7.oos + 0.2, exitAt: s7Out, slot: 0},
    {repo: 'Clause-Driven-LLM', path: 'results/tables/headline.json', line: '183-234', at: s7.oos + 0.4, exitAt: s7Out, slot: 1},
    {repo: 'Clause-Driven-LLM', path: 'results/baselines/clinc150__sbert__seed42.json', line: '6-12', at: s7.trails, exitAt: s7Out, slot: 2},
    {repo: 'clause86', path: 'src/clause86/data/synthetic.py', line: '18-22', at: s8.start + 0.4, exitAt: s8.readme, slot: 0},
    {repo: 'clause86', path: 'README.md', line: '73-74', at: s8.fired, exitAt: s8.readme, slot: 1},
    {repo: 'clause86', path: 'results/paper_d_synthetic.json', line: '5-18', at: s8.readme + 0.2, exitAt: s8Out, slot: 0},
    {repo: 'clause86', path: 'results/paper_d_adult.json', line: '5-18', at: s8.adult + 0.2, exitAt: s8Out, slot: 1},
    {repo: 'clause86', path: 'README.md', line: '213-215', at: s8.majority, exitAt: s8Out, slot: 2},
    {repo: 'clauseguard', path: 'src/clauseguard/graphs/dual_graph.py', line: '298-310', at: s9.start + 0.3, exitAt: s9.runs - 0.2, slot: 0},
    {repo: 'clauseguard', path: 'tests/test_graphs.py', line: '58-63', at: s9.contradict, exitAt: s9.runs - 0.2, slot: 1},
    {repo: 'clauseguard', path: 'README.md', line: '13-19', at: s9.runs, exitAt: s9.board, slot: 0},
    {repo: 'clauseguard', path: 'README.md', line: '243-262', at: s9.targets, exitAt: s9.board, slot: 1},
  ];

  const W = b.W;
  const H = b.H;
  const mono = (size: number, c: string, w = 500): React.CSSProperties => ({fontFamily: font.mono, fontSize: Math.round(size * H), color: c, fontWeight: w, whiteSpace: 'nowrap'});
  const textLine = (t: number, a: number, e: number, y: number, node: React.ReactNode) => {
    const k = pull(t, a, e);
    if (k <= 0) return null;
    return <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(y * H), opacity: k, ...mono(0.023, color.text.caption)}}>{node}</div>;
  };
  const board: Array<[string, string]> = [
    ['clausegate', 'no attack through · utility 0.302 (target 0.60)'],
    ['Clause-Driven-LLM', 'routing 94.2% vs 95.6% · OOS AUROC 0.940 vs 0.962'],
    ['clause86', 'first measured pass · majority class on Adult'],
    ['clauseguard', 'training not yet run · targets only'],
  ];
  const boardOut = endAt - 0.5;
  b.overlay('plate', s6.start - 0.9, T.ch.end, (t) => (
    <>
      <WallLabels t={t} lens={b.lens} items={[...sockLabels, ...edgeLabels]} />
      {/* 06.6 */}
      <PlaceTitle t={t} at={s6.plate} exitAt={s6Out} name="clausegate" status="research prototype · 5 seeds · single commit" />
      <PathKicker t={t} at={s6.input} exitAt={s6Out} text="socket 1 · graph input" y={Math.round(0.215 * H)} tone={color.accent.mint} />
      <Tag t={t} at={s6.start + 0.9} exitAt={s6.seeds - 0.2} text="four separate repositories · one plate is the film's diagram" x={Math.round(0.07 * W)} y={Math.round(0.3 * H)} />
      <WallLabels t={t} lens={b.lens} items={s6Labels} />
      {/* 06.7 */}
      <PlaceTitle t={t} at={s7.plate} exitAt={s7Out} name="Clause-Driven-LLM" status="research prototype v0.1.0 · 5 seeds" />
      <PathKicker t={t} at={s7.escalation - 0.2} exitAt={s7Out} text="socket 2 · escalation" y={Math.round(0.215 * H)} tone={color.accent.mint} />
      <Tag t={t} at={s7.transcript} exitAt={s7.oos - 0.2} text="demo transcript" x={Math.round(0.07 * W)} y={Math.round(0.29 * H)} />
      {textLine(t, s7.transcript + 0.6, s7.oos - 0.25, 0.33, <>good morning in japanese → translate · margin 6,760</>)}
      {textLine(t, s7.transcript + 0.9, s7.oos - 0.25, 0.37, <span style={{color: color.text.tertiary}}>417 clauses fired · then a local LLM answers</span>)}
      {textLine(t, escAt + 0.2, s7.oos - 0.25, 0.43, <>unladen swallow → margin 584 &lt; 1,500 → <span style={{color: color.accent.mint}}>a human</span></>)}
      <Tag t={t} at={s7.trails + 0.2} exitAt={s7Out} text="baseline: seed 42 only" x={Math.round(0.07 * W)} y={Math.round(0.29 * H)} />
      <PathKicker t={t} at={s7.oos + 0.2} exitAt={s7Out} text="clause margin (bright) · logistic regression / max softmax (grey)" y={Math.round(0.325 * H)} tone={color.text.chipDim} />
      <WallLabels t={t} lens={b.lens} items={s7Labels} />
      <WallLabels
        t={t}
        lens={b.lens}
        items={[
          L('good morning in japanese', ix0 + 12, qY[0], s7.transcript, q2At, {sizeH: 0.022}),
          L('good morning in japanese', ix0 + 12, qY[0], q2At, s7.oos - 0.2, {sizeH: 0.022, color: color.text.tertiary}),
          L('unladen swallow', ix0 + 12, qY[1], q2At + 0.05, s7Out, {sizeH: 0.022}),
        ]}
      />
      {/* 06.8 */}
      <PlaceTitle t={t} at={s8.plate} exitAt={s8Out} name="clause86" status="research prototype · first measured pass · accuracy gap documented" />
      <PathKicker t={t} at={s8.plate + 0.4} exitAt={s8Out} text="socket 3 · explanation" y={Math.round(0.215 * H)} tone={color.accent.mint} />
      {textLine(t, s8.start + 0.4, s8.readme - 0.2, 0.3, <>HIRE ⇐ (years ≥ 3 ∧ degree ∧ ¬empty_resume)</>)}
      {textLine(t, s8.start + 0.6, s8.readme - 0.2, 0.34, <>{'     '}∨ (years ≥ 10 ∧ ¬empty_resume)</>)}
      {textLine(t, s8.start + 0.8, s8.readme - 0.2, 0.39, <span style={{color: color.text.chipDim}}>a known synthetic hiring rule · gender present, irrelevant</span>)}
      <PathKicker t={t} at={s8.readme} exitAt={s8.adult - 0.15} text="synthetic rule · 5 seeds: 0.51 … 1.00" y={Math.round(0.325 * H)} tone={color.text.caption} />
      <PathKicker t={t} at={s8.adult + 0.2} exitAt={s8Out} text="Adult-Income: 0.759 · the majority class (≈ 0.764)" y={Math.round(0.325 * H)} tone={color.text.caption} />
      <Tag t={t} at={s8.readme + 0.6} exitAt={s8Out} text="EU AI Act Art. 86: motivation, not compliance" x={Math.round(0.07 * W)} y={Math.round(0.29 * H)} border="rgba(228,234,231,0.35)" tone={color.text.caption} />
      <WallLabels t={t} lens={b.lens} items={s8Labels} />
      {/* 06.9 */}
      <PlaceTitle t={t} at={s9.plate} exitAt={s9.payoff - 0.3} name="clauseguard" status="work in progress · 5-seed run not yet executed" />
      <PathKicker t={t} at={s9.plate + 0.4} exitAt={s9.board - 0.2} text="socket 4 · fact-check" y={Math.round(0.215 * H)} tone={color.accent.mint} />
      <WallLabels t={t} lens={b.lens} items={s9Labels} />
      <GlassCard x={Math.round(0.52 * W)} y={Math.round(0.2 * H)} width={Math.round(0.41 * W)} label="four repositories · as each states it" t={t} at={s9.board} exitAt={boardOut}>
        <div style={{display: 'flex', flexDirection: 'column', gap: Math.round(0.016 * H), marginTop: Math.round(0.018 * H)}}>
          {board.map(([repo, ln], k) => {
            const kk = pull(t, s9.board + 0.15 + k * 0.18, undefined, 0.3);
            return (
              <div key={repo} style={{opacity: kk}}>
                <div style={mono(0.024, color.text.display, 600)}>{repo}</div>
                <div style={{...mono(0.022, color.text.chipDim), marginTop: Math.round(0.004 * H)}}>{ln}</div>
              </div>
            );
          })}
        </div>
      </GlassCard>
      <Statement t={t} words={b.ctx.tl.utt('u0632').words} exitAt={endAt - 0.1} y={Math.round(0.42 * H)} />
      <Cites t={t} items={cites} />
    </>
  ));
  b.captionSkip.push('u0632');

  // ---------------------------------------------------------------- Pixie
  b.cue(s6.plate, 'reading', 'Read the 5-seed aggregate');
  b.cue(s7.plate, 'reading', 'Read docs/demo_transcript.txt');
  b.cue(s7.oos, 'reading', 'Read results/tables/headline.json');
  b.cue(s8.plate, 'reading', 'Read results/paper_d_adult.json');
  b.cue(s9.plate, 'reading', 'Read README.md (targets, not results)');
  b.cue(s9.board, 'idle', '');

  return {P6, endAt, escAt, q2At, voteAt};
};
