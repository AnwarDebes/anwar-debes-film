import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import {emblemField, type FieldFn, type LiveLayer} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import type {Builder} from './kit/builder';
import {ChapterTitle, Cites, PlaceTitle, WallLabels, pull, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, disc, rect, seg, shapesLive, shapesRegion, type Look, type Shape} from './kit/shapes';
import type {Times06} from './times';

// 06.0 the gate (Act II, sink) and 06.1 reins: what blocking does to a legitimate task.

const R = 'reins';

/** A tool-call tile: a raised plate of pins with its call written on it. */
export interface Tile {
  shape: Shape;
  label: WallText;
  x0: number;
  x1: number;
}

export const tile = (x0: number, y: number, w: number, text: string, look: Look, at: number, exitAt?: number, hPitch = 5): Tile => ({
  shape: rect(x0 + w / 2, y, w, hPitch, look, {r: 1.5}),
  label: {text, X: x0 + w / 2, Y: y, h: look.h ?? 0.16, at, exitAt, color: (look.tint === LOOK.tileDim.tint ? color.text.chipDim : color.text.display) as string},
  x0,
  x1: x0 + w,
});

/** A dashed outline where a step should have been. */
export const missingSlot = (x0: number, y: number, w: number, hPitch = 5): Shape[] => {
  const L: Look = {h: 0.07, tint: 0.95};
  const x1 = x0 + w;
  const y0 = y - hPitch / 2;
  const y1 = y + hPitch / 2;
  const dash: [number, number] = [1.6, 1.2];
  return [seg(x0, y0, x1, y0, 0.7, L, {dash}), seg(x0, y1, x1, y1, 0.7, L, {dash}), seg(x0, y0, x0, y1, 0.7, L, {dash}), seg(x1, y0, x1, y1, 0.7, L, {dash})];
};

export const buildGateAndBlocking = (b: Builder, T: Times06, ground: Look) => {
  const {S, home} = b;
  const ch = T.ch;
  const g = T.gate;
  const s1 = T.s1;

  // ---------------------------------------------------------------- geometry
  const cx = b.ctx.board.cols / 2;
  const cy = S.ext / 2;
  const wellW = 112;
  const wellH = 63.5;
  const P1 = frameOn(b.ctx.board, {uv: S.uv(cx, cy), pinsAcross: wellW, yaw: 0.1, pitch: 0.05, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P1, fx, fy);

  // the well: the wall around it rises, so its floor reads as sunk; its rim is bright steel
  const rimTop = cy + wellH / 2;
  const around: Shape[] = [
    rect(cx, rimTop + 30, 260, 60, {h: 0.42, tint: 0.4}),
    rect(cx, cy - wellH / 2 - 30, 260, 60, {h: 0.42, tint: 0.4}),
    rect(cx - wellW / 2 - 40, cy, 80, wellH + 2, {h: 0.42, tint: 0.4}),
    rect(cx + wellW / 2 + 40, cy, 80, wellH + 2, {h: 0.42, tint: 0.4}),
    // the rim
    rect(cx, rimTop + 0.8, wellW + 3.2, 1.6, {h: 0.46, tint: 1.0}),
    rect(cx, cy - wellH / 2 - 0.8, wellW + 3.2, 1.6, {h: 0.46, tint: 1.0}),
    rect(cx - wellW / 2 - 0.8, cy, 1.6, wellH + 3.2, {h: 0.46, tint: 1.0}),
    rect(cx + wellW / 2 + 0.8, cy, 1.6, wellH + 3.2, {h: 0.46, tint: 1.0}),
  ];

  // ---------------------------------------------------------------- the floor: two transfer calls
  const [laneX0, laneAY] = at(0.12, 0.42);
  const [, laneBY] = at(0.12, 0.62);
  const gap = 3;
  const procW = 12;
  const slotW = 15;
  const xferW = 30;
  const xferX = laneX0 + procW + gap + slotW + gap;
  const blockX = xferX - 1.9;
  const plate: Look = LOOK.tile;
  const dim: Look = LOOK.tileDim;

  const laneRails: Shape[] = [
    seg(laneX0 - 2, laneAY, xferX + xferW + 4, laneAY, 1.0, {h: 0.03, tint: 0.55}),
    seg(laneX0 - 2, laneBY, xferX + xferW + 4, laneBY, 1.0, {h: 0.03, tint: 0.55}),
  ];
  const tA = tile(xferX, laneAY, 21, 'transfer_funds(…)', plate, s1.start, s1.end - 0.3);
  const tB0 = tile(laneX0, laneBY, procW, 'process()', plate, s1.start, s1.end - 0.3);
  const tB2 = tile(xferX, laneBY, xferW, 'transfer_funds(to=internal-acct)', plate, s1.start, s1.end - 0.3);
  const slot = missingSlot(laneX0 + procW + gap, laneBY, slotW);
  const tA_dim = tile(xferX, laneAY, 21, 'transfer_funds(…)', dim, s1.stops, s1.end - 0.3);
  const tB2_dim = tile(xferX, laneBY, xferW, 'transfer_funds(to=internal-acct)', dim, s1.stops, s1.end - 0.3);

  // the place's sign: the reins emblem in pins, top right
  const [emX, emY] = at(0.845, 0.215);
  const emblem = emblemField(b.ctx.board, 'reins', {u: S.uv(emX, emY)[0], v: S.uv(emX, emY)[1], height: 20}, {ground: (ground.tint as number) ?? 0.74, height: 0.6});
  const withEmblem = (f: FieldFn): FieldFn => {
    const [u0, v0] = S.uv(emX - 10.5, emY - 10.5);
    const [u1, v1] = S.uv(emX + 10.5, emY + 10.5);
    return (u, v, i) => (u > u0 && u < u1 && v > v0 && v < v1 ? emblem(u, v, i) : f(u, v, i));
  };

  // bars: blocking's attack success (0.000) and tasks completed (0.328), safety_utility.json
  const [barX0, barBase] = at(0.74, 0.6);
  const [barX1, barTop] = at(0.87, 0.43);
  const barH = barTop - barBase;
  const barW = 9;
  const bars = (k: number): Shape[] => [
    rect(barX0, barBase + barH / 2, barW, barH, {h: 0.04, tint: 0.42}, {r: 1}),
    rect(barX1, barBase + barH / 2, barW, barH, {h: 0.04, tint: 0.42}, {r: 1}),
    // 0.000: nothing rises; a hairline at the base marks the zero
    rect(barX0, barBase + 0.5, barW, 1, {h: 0.08, tint: 1.0}),
    rect(barX1, barBase + (barH * 0.328 * k) / 2, barW, Math.max(1, barH * 0.328 * k), {h: 0.2, tint: 1.0}, {r: 0.8}),
  ];

  const blocker: Shape = rect(blockX, (laneAY + laneBY) / 2, 3.2, laneAY - laneBY + 10, LOOK.red, {r: 0.8});

  const floor0 = [...laneRails, tA.shape, tB0.shape, ...slot, tB2.shape];
  const floorBlocked = [...laneRails, tA_dim.shape, tB0.shape, ...slot, tB2_dim.shape, blocker];

  // ---------------------------------------------------------------- beats
  const F = (shapes: Shape[]) => withEmblem(b.field(shapes, ground));
  b.beat('well', g.frame0, F([...around, ...floor0]), {sweep: {origin: S.uv(cx, cy), speed: 0.55, delayS: 0.05, jitterS: 0.06}});
  b.beat('floor', s1.start + 0.4, F(floor0), {sweep: {origin: S.uv(cx, cy), speed: 0.9, delayS: 0.4, jitterS: 0.05}});
  b.beat('blocked', s1.stops - 0.08, F(floorBlocked), {sweep: {kind: 'linear', origin: S.uv(blockX, laneAY + 8), direction: [0, -1], speed: 0.5, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('bars', s1.third - 0.15, F([...floorBlocked, ...bars(1)]), {sweep: {kind: 'linear', origin: S.uv(barX0, barBase - 1), direction: [0, 1], speed: 0.3, jitterS: 0.02}});
  b.ripple(s1.stops + 0.05, blockX, (laneAY + laneBY) / 2, {amp: 0.35});

  // the alarm pin: one red pin blinking at the centre of the well's rim, from the lead-in
  const alarmShapes: Shape[] = [disc(cx, rimTop + 0.8, 1.15, {h: 0.62, tint: PIN.redPaint, paint: 1})];
  const alarmOn = shapesLive(S, alarmShapes);
  const alarm: LiveLayer = {
    fn: (u, v, _i, t) => {
      const ph = ((t - g.alarmFrom) * 2) % 1;
      return ph < 0.55 ? alarmOn(u, v) : null;
    },
    from: g.alarmFrom,
    to: s1.start + 0.6,
    fadeS: 0.12,
    region: shapesRegion(S, alarmShapes, 1),
  };
  b.live.push(alarm);

  // ---------------------------------------------------------------- camera
  b.cut(ch.start, home);
  b.move(g.descentFrom, g.descentTo - g.descentFrom, P1);
  b.move(s1.start + 0.05, s1.end - s1.start - 0.6, pushIn(P1, 0.045), 'inOutSine');

  // ---------------------------------------------------------------- overlays
  b.overlay('gate-card', g.frame0 - 0.1, g.cardOut + 0.45, (t) => (
    <ChapterTitle t={t} at={g.cardIn} exitAt={g.cardOut} index="06" repos={['reins', 'THGTM', 'clausegate', 'Clause-Driven-LLM', 'clause86', 'clauseguard']} title="After the alarm." />
  ));

  const labels: WallText[] = [tA.label, tB0.label, tB2.label, {...tA_dim.label}, {...tB2_dim.label}].map((l, k) =>
    k === 0 || k === 2 ? {...l, exitAt: s1.stops - 0.05} : l,
  );
  const slotLabel: WallText = {text: 'authorize()', X: laneX0 + procW + gap + slotW / 2, Y: laneBY, h: 0.07, at: s1.start, exitAt: s1.end - 0.3, color: color.text.tertiary};
  const laneTitles: WallText[] = [
    {text: 'a malicious transfer', X: laneX0 - 1, Y: laneAY + 5.2, h: 0, at: s1.malicious - 0.1, exitAt: s1.end - 0.3, align: 'left', color: color.text.chipDim},
    {text: 'a legitimate one that forgot authorize()', X: laneX0 - 1, Y: laneBY + 5.2, h: 0, at: s1.legit - 0.1, exitAt: s1.end - 0.3, align: 'left', color: color.text.chipDim},
    {text: 'blocked', X: blockX, Y: laneBY - 6.6, h: 0.22, at: s1.stops + 0.25, exitAt: s1.end - 0.3, color: color.text.chipDim},
  ];
  const barLabels: WallText[] = [
    {text: 'attack success', X: barX0, Y: barBase - 2.6, at: s1.third, exitAt: s1.end - 0.3, color: color.text.chipDim},
    {text: 'tasks completed', X: barX1, Y: barBase - 2.6, at: s1.third, exitAt: s1.end - 0.3, color: color.text.chipDim},
    {text: '0.000', X: barX0, Y: barBase + 3.4, h: 0.08, at: s1.third + 0.25, exitAt: s1.end - 0.3, mono: false, weight: 700, sizeH: 0.042},
    {text: '0.328', X: barX1, Y: barBase + barH * 0.328 + 3.2, h: 0.2, at: s1.third + 0.35, exitAt: s1.end - 0.3, mono: false, weight: 700, sizeH: 0.042},
    {text: 'blocking', X: (barX0 + barX1) / 2, Y: barTop + 3.0, at: s1.third - 0.1, exitAt: s1.end - 0.3, color: color.accent.mintLabel},
  ];
  const cites: CiteSpec[] = [
    {repo: R, path: 'README.md', line: '23-26', at: s1.blocking, exitAt: s1.blocking + 4.2, slot: 0},
    {repo: R, path: 'experiments/_common.py', line: '111-116', at: s1.forgot, exitAt: s1.forgot + 4, slot: 1},
    {repo: R, path: 'results/safety_utility.json', line: '23-28', at: s1.third + 0.3, exitAt: s1.end - 0.6, slot: 0},
  ];
  b.overlay('s1', s1.start - 0.2, s1.end + 0.1, (t) => (
    <>
      <PlaceTitle t={t} at={s1.plate} exitAt={s1.end - 0.55} name="reins" status="research prototype v1.0 · paper · synthetic benchmark" />
      <WallLabels t={t} lens={b.lens} items={[...labels, slotLabel, ...laneTitles, ...barLabels]} />
      <Cites t={t} items={cites} />
    </>
  ));

  // ---------------------------------------------------------------- Pixie
  b.cue(g.frame0, 'idle', '');
  b.cue(s1.plate, 'reading', 'Read reins/README.md');

  return {P1, blockX, laneAY, laneBY, laneX0, xferX, emX, emY, withEmblem};
};

/** Envelope helper re-exported for scenes that fade their own pieces. */
export const fade = pull;
export const MONO = font.mono;
