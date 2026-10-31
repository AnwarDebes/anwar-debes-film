import React, {useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, hash01, type Beat, type LiveLayer} from '../../../engine/pins';
import {type CameraKey} from '../../../engine/camera';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {pixieField, type PixieTimeline} from '../../../pixie';
import {resolveTimeline as resolveCore, STATE_LABELS, type PixieState} from '../../../pixie/pixie-core';
import type {FilmCtx, TimedNode} from '../../types';
import {snippets} from '../../../data/ch07/code';
import {poseOn} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {Cite, NamePlate, mono, pillWidth, plateRows, riseK} from './kit/ui';
import {WARM, warmFlat} from './look';
import {terminalSpec} from './s01Terminal';
import {termGeometry} from './pinTerminal';
import type {Times07} from './times';

// 07.2 Pixie arrives at its own place. The spinner's pins burst into coral and Pixie is pressed
// into the wall where it stood; the name plate lights its rule-line pin; mascot.js scrolls to the
// state machine; the dwell is shown as the real resolver plays a burst of requests.

export const PIXIE_CENTER: [number, number] = [0.77, 0.4625];
export const PINS_PER_CELL = 3;

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export const pinPixie = (ctx: FilmCtx, ptl: PixieTimeline, o: {center: [number, number]; from: [number, number]; formAt: number; paintAt?: number; exitAt: number}) => {
  const {board} = ctx;
  const cell = PINS_PER_CELL / board.cols;
  const cellV = cell / board.extH;
  const vTop = o.center[1] + 16 * cellV;
  const boxH = 32 * cellV;
  const [su, sv] = o.from;
  const field = pixieField({
    fps: ctx.fps,
    timeline: ptl,
    cell,
    boardAspect: board.extH,
    center: o.center,
    relief: 0.16,
    steel: WARM,
    gain: 1.6,
    presence: (t, u, v) => {
      // the coral pins flow out of the burst point into the creature
      const d = Math.hypot(u - su, (v - sv) * board.extH);
      let p = smooth((t - o.formAt - d / 0.42) / 0.22);
      if (o.paintAt !== undefined) {
        // "cell by cell": a scan repaints the creature row by row
        const row = (vTop - v) / boxH;
        const x = (t - o.paintAt - row * 1.1) / 0.2;
        if (x > -1 && x < 1) p *= 1 - 0.8 * Math.max(0, 1 - Math.abs(x));
      }
      const exitK = smooth((t - o.exitAt - hash01(77, Math.round(u * 997 + v * 9973)) * 0.45) / 0.18);
      return p * (1 - exitK);
    },
  });
  const layer: LiveLayer = {fn: field, from: o.formAt - 0.05, to: o.exitAt + 0.75, fadeS: 0.05, region: field.bounds, speedHint: () => 0.5};
  return {field, layer};
};

/** The canonical dwell, played on a burst of requests (the same resolver that draws the guide). */
const dwellLanes = () => {
  const fps = 1000; // one frame per millisecond
  const span = 900;
  const req: Array<{frame: number; activity: PixieState}> = [{frame: 0, activity: 'thinking'}];
  for (let ms = 50, k = 1; ms <= 650; ms += 50, k++) req.push({frame: ms, activity: k % 2 ? 'typing' : 'thinking'});
  const shown = resolveCore(req, fps, span).map((r) => r.state);
  const asked: PixieState[] = [];
  let cur: PixieState = 'thinking';
  let j = 0;
  for (let f = 0; f <= span; f++) {
    while (j < req.length && req[j].frame <= f) cur = req[j++].activity;
    asked.push(cur);
  }
  const runs = (xs: PixieState[]) => {
    const out: Array<{from: number; to: number; s: PixieState}> = [];
    for (let f = 0; f < xs.length; f++) {
      const last = out[out.length - 1];
      if (last && last.s === xs[f]) last.to = f + 1;
      else out.push({from: f, to: f + 1, s: xs[f]});
    }
    return out;
  };
  return {span, req, shown: runs(shown), asked: runs(asked)};
};

const STATE_FILL: Partial<Record<PixieState, string>> = {thinking: '#6C6E6D', typing: color.pixie.bodyHi};

const DwellCard: React.FC<{t: number; at: number; out: number; x: number; y: number; w: number}> = ({t, at, out, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const lanes = useMemo(dwellLanes, []);
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  // a 0.9 s burst, slowed six times so the dwell can be seen
  const play = Math.max(0, Math.min(1, (t - at - 0.4) / 5.4));
  const head = play * lanes.span;
  const pad = Math.round(0.022 * H);
  const labelW = Math.round(0.27 * H);
  const laneW = w - 2 * pad - labelW;
  const laneH = Math.round(0.024 * H);
  const X = (ms: number) => labelW + (ms / lanes.span) * laneW;
  const lane = (title: string, runs: Array<{from: number; to: number; s: PixieState}>, row: number, ticks?: boolean) => (
    <div key={title} style={{position: 'absolute', left: pad, top: pad + Math.round(0.04 * H) + row * Math.round(0.036 * H), width: w - 2 * pad, height: laneH}}>
      <div style={{position: 'absolute', left: 0, top: -Math.round(0.003 * H), ...mono(H, Ty.monoKicker.size, 450), color: color.text.secondary}}>{title}</div>
      {runs
        .filter((r) => r.from < head)
        .map((r, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.round(X(r.from)),
              width: Math.max(1, Math.round(X(Math.min(r.to, head)) - X(r.from)) - (ticks ? 0 : 1)),
              top: ticks ? Math.round(laneH * 0.25) : 0,
              height: ticks ? Math.round(laneH * 0.5) : laneH,
              borderRadius: Math.round(laneH * 0.18),
              background: STATE_FILL[r.s] ?? '#888',
              opacity: ticks ? 0.8 : 1,
              borderLeft: ticks ? `2px solid rgba(255,255,255,0.75)` : undefined,
              boxSizing: 'border-box',
            }}
          />
        ))}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y + (1 - k) * 0.012 * H), width: Math.round(w), height: Math.round(0.128 * H), borderRadius: Math.round(H * layout.cardRadiusH), background: color.card.glass, border: `1px solid ${color.card.rule}`, opacity: k, boxShadow: `0 ${Math.round(0.018 * H)}px ${Math.round(0.06 * H)}px rgba(0,0,0,0.45)`}}>
      <div style={{position: 'absolute', left: pad, top: pad - Math.round(0.006 * H), ...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.12em', color: color.accent.mint}}>
        {'MIN_DWELL = 150 MS · ONESHOT_MS = 1500 MS'}
      </div>
      <div style={{position: 'absolute', right: pad, top: pad - Math.round(0.006 * H), ...mono(H, Ty.monoKicker.size, 450), color: color.text.tertiary, display: 'flex', gap: Math.round(0.018 * H)}}>
        <span>
          <span style={{color: STATE_FILL.thinking}}>{'■ '}</span>
          {STATE_LABELS.thinking}
        </span>
        <span>
          <span style={{color: STATE_FILL.typing}}>{'■ '}</span>
          {STATE_LABELS.typing}
        </span>
      </div>
      {lane('requested, 6× slow', lanes.asked, 0, true)}
      {lane('shown', lanes.shown, 1)}
      <div style={{position: 'absolute', left: pad + X(head), top: pad + Math.round(0.034 * H), width: 2, height: Math.round(0.074 * H), background: 'rgba(236,238,237,0.7)'}} />
    </div>
  );
};

export const scene0702 = (ctx: FilmCtx, T: Times07, ptl: PixieTimeline): PartSpec => {
  const {board, height: H, width: W} = ctx;
  const {t1, t2, t3} = T;
  const term = terminalSpec(ctx, T);
  const spinUv = termGeometry(term).spinnerUv;

  const beats: Beat[] = [
    // the terminal goes: its plate dissolves back to the warm wall as the spinner bursts
    {id: 'c07-clear', at: t1.burst + 0.05, field: warmFlat, sweep: {...SWEEPS.dissolve(0.7)}},
  ];
  const px = pinPixie(ctx, ptl, {center: PIXIE_CENTER, from: spinUv, formAt: t2.form, paintAt: t2.paint, exitAt: t3.diagram - 0.2});
  const live: LiveLayer[] = [px.layer];

  // camera: out of the spinner close-up to Pixie's place, then the reel's slow creep
  const place = poseOn(ctx, {uv: [0.5, 0.5], pinsAcross: 166, yaw: 0.09, pitch: 0.05, screen: [0.5, 0.47]});
  const camera: CameraKey[] = [
    {at: t1.burst + 0.1, dur: 1.9, pose: place, ease: 'camera'},
    {at: t1.burst + 2.0, dur: Math.max(1, t3.diagram - t1.burst - 2.0), pose: {...place, distance: place.distance * 0.965}, ease: 'inOutSine'},
  ];
  const light = [{at: t1.burst, dur: 1.6, poolAt: [PIXIE_CENTER[0] - 0.5 - 0.05, PIXIE_CENTER[1] * board.extH - board.extH / 2 + 0.02] as [number, number], spread: 1.15, key: 1.04}];
  const ripples = [{at: t1.burst + 0.05, origin: spinUv, amp: 0.35, speed: 0.3, width: 0.03, decayPerS: 1.4, lifeS: 2.4}];

  const codeX = Math.round(W * layout.marginLeftW);
  const rows = plateRows(H);
  // the code sits under the plate's second row, where the source chips type in
  const codeY = Math.round(rows.bottom + 0.014 * H);
  const codeW = Math.round(W * 0.565);
  const pages: CodePage[] = [
    {
      at: t2.codeIn,
      source: {snippet: snippets['ccim-mascot'], lines: [1, 112]},
      view: 6,
      rows: 6,
      zoom: 0.87,
      width: codeW,
      header: {label: 'Claude-Code-In-Motion', path: 'web/js/mascot.js', meta: '360 lines · 2c79ee0'},
      cues: [
        cue.reveal(t2.codeIn + 0.15, {lines: [6, 12], stagger: 0.035}),
        cue.scroll(t2.grid - 0.2, [24, 30], {dur: 1.1, align: 'top'}),
        cue.highlight(t2.grid + 0.7, [25, 28], {until: t2.fsm - 0.1}),
        cue.annotate(t2.grid + 0.9, 25, 'the *34 × 32* scene grid', {match: 'SCENE_W = 34', until: t2.fsm - 0.1}),
        cue.scroll(t2.fsm, [100, 105], {dur: 1.25, align: 'top'}),
        cue.highlight(t2.dwell - 0.1, 101, {until: t2.flickers + 0.4}),
        cue.scroll(t2.flickers + 0.3, [103, 108], {dur: 0.8, align: 'top'}),
        cue.highlight(t2.flickers + 0.45, [105, 107], {until: t2.codeOut}),
      ],
    },
  ];

  const mapChipX = codeX + pillWidth('not on the research map (01.6)', H, false) + Math.round(0.012 * H);
  const overlays: TimedNode[] = [
    {
      id: 'c07-ccim-plate',
      from: t2.plate,
      to: t3.diagram + 0.6,
      render: (t) => (
        <NamePlate
          t={t}
          at={t2.plate}
          out={t3.diagram - 0.1}
          repo="Claude-Code-In-Motion"
          status="WORKING TOOL · EARLY RELEASE v0.1.1 · LIVE REPLAY DEMO"
          extra={[{text: 'not on the research map (01.6)', at: t2.map, out: t2.codeIn - 0.2}]}
        />
      ),
    },
    {
      id: 'c07-mascot-code',
      from: t2.codeIn,
      to: t2.codeOut + 0.6,
      render: (t) => <CodePanel pages={pages} x={codeX} y={codeY} anchor="top-left" t={t} enter={{at: t2.codeIn, dur: 0.55}} exit={{at: t2.codeOut, dur: 0.45}} />,
    },
    {
      id: 'c07-dwell',
      from: t2.lanes,
      to: t2.codeOut + 0.6,
      render: (t) => <DwellCard t={t} at={t2.lanes} out={t2.codeOut} x={codeX} y={Math.round(H * 0.556)} w={codeW} />,
    },
    {
      id: 'c07-ccim-cites',
      from: t2.map,
      to: t3.diagram + 0.5,
      render: (t) => (
        <>
          <Cite t={t} repo="AnwarDebes" path="assets/research-map.svg" line="12-13" at={t2.map + 0.25} out={t2.codeIn - 0.2} x={mapChipX} y={Math.round(rows.extraCentre)} />
          <Cite t={t} repo="Claude-Code-In-Motion" path="web/js/mascot.js" line="25-28" at={t2.grid + 0.9} out={t2.fsm} x={codeX} y={Math.round(rows.extraCentre)} />
          <Cite t={t} repo="Claude-Code-In-Motion" path="web/js/mascot.js" line="97-112" at={t2.dwell + 0.25} out={t2.codeOut} x={codeX} y={Math.round(rows.extraCentre)} />
          <Cite t={t} repo="Claude-Code-In-Motion" path="test/mascot.test.js" line="61-74" at={Math.max(t2.fsm + 0.2, t2.lanes + 0.5)} out={t2.dwell + 0.05} x={codeX} y={Math.round(rows.extraCentre)} />
        </>
      ),
    },
  ];
  return {beats, live, camera, light, ripples, overlays};
};
