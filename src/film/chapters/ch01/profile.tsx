import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {pushIn, rigPoseAt, projectToScreen, type CameraKey, type FocusKey} from '../../../engine/camera';
import {noiseField, portraitField, rectField, pinAt, type Beat, type FieldFn, type LightKey, type PinSample} from '../../../engine/pins';
import type {PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import researchMap from '../../../data/ch01/research-map.json';
import {bodyStyle, capsStyle, Card, Chip, chipSlot, easeOut, Em, env, legible, MissGlyph, monoStyle, MONO_MIN, NamePlate, pull, ramp} from './kit';
import {pinTextField} from './pinText';
import {pose, wxy, type Part, type Stage} from './stage';

// 01.6 the profile: the banner in pins, one line, the person, the Measured column that lists the
// misses, and the research map of forty projects, on which the guide's own repository is missing.

interface MapNode {
  x: number;
  y: number;
  r: number;
  line: number;
}

const MAP = researchMap as {lines: string[]; nodes: MapNode[]; segments: number[][]};

export const buildProfile = (st: Stage): Part => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const face = ctx.assets.face;
  const s6 = tl.scene('01.6');
  const u16 = tl.utt('u0116');
  const u17 = tl.utt('u0117');
  const u18 = tl.utt('u0118');
  const u19 = tl.utt('u0119');
  const u20 = tl.utt('u0120');
  const wAI = tl.word('u0116', 'AI');
  const wMeasured = tl.word('u0118', 'Measured');
  const wMisses = tl.word('u0118', 'misses');
  const wForty = tl.word('u0119', 'forty');
  const wNot = tl.word('u0119', 'not');
  const wFile = tl.word('u0120', 'file');

  // ---------------------------------------------------------------- the banner in pins
  // the banner's layout (AnwarDebes/assets/banner-dark.webp): the line on the left, the portrait in a
  // dark square frame on the right
  const frameUV: [number, number] = [0.71, 0.5];
  const frameSize = 78;
  const frame = rectField(board, {u: frameUV[0], v: frameUV[1], w: frameSize, h: frameSize, radius: 3}, {h: 0.02, tint: 0.5, soft: 0.8});
  const portrait = portraitField(board, face, {u: frameUV[0], v: frameUV[1], height: frameSize - 8});
  const bannerBase: FieldFn = (u, v, i) => {
    const p = portrait(u, v, i);
    if (p.h > 0.004) return p;
    return frame(u, v, i);
  };
  const lineLeft = 0.124;
  const lineV = 0.665;
  const line2V = 0.575;
  // a dark band under the line, so the raised white letters read
  const band = rectField(board, {u: lineLeft + 0.2, v: (lineV + line2V) / 2, w: 82, h: 22, radius: 2}, {h: 0, tint: 0.5, soft: 1.5, ground: bannerBase});
  const head1 = pinTextField(board, 'banner1', {left: lineLeft, v: lineV, heightPins: 6.8}, {h: 0.12, tint: 1.0, ground: band});
  const headline = pinTextField(board, 'banner2', {left: lineLeft, v: line2V, heightPins: 6.8}, {h: 0.12, tint: 1.0, ground: head1});

  // the research map: its forty dots and the lines between them, pressed into the frame
  const mx0 = 842;
  const my0 = 268;
  const mr = 210;
  const nodeUV = MAP.nodes.map((n) => [frameUV[0] + ((n.x - mx0) / mr) * 34 * board.p, frameUV[1] - (((n.y - my0) / mr) * 34 * board.p) / board.extH] as [number, number]);
  const nodePins = nodeUV.map(([u, v]) => pinAt(board, u, v));
  const nodeOf = new Map<number, number>();
  nodePins.forEach((p, k) => nodeOf.set(p, k));
  const ring = new Map<number, number>();
  nodePins.forEach((p, k) => {
    if (MAP.nodes[k].r < 4.2) return;
    for (let j = 0; j < board.nbCount[p]; j++) {
      const q = board.nb[p * 6 + j];
      if (q >= 0 && !nodeOf.has(q)) ring.set(q, k);
    }
  });
  const segDist = (u: number, v: number): number => {
    let best = Infinity;
    for (const s of MAP.segments) {
      const ax = frameUV[0] + ((s[0] - mx0) / mr) * 34 * board.p;
      const ay = (frameUV[1] - (((s[1] - my0) / mr) * 34 * board.p) / board.extH) * board.extH;
      const bx = frameUV[0] + ((s[2] - mx0) / mr) * 34 * board.p;
      const by = (frameUV[1] - (((s[3] - my0) / mr) * 34 * board.p) / board.extH) * board.extH;
      const px = u;
      const py = v * board.extH;
      const dx = bx - ax;
      const dy = by - ay;
      const L2 = dx * dx + dy * dy || 1e-9;
      const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
      const d = Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
      if (d < best) best = d;
    }
    return best / board.p;
  };
  const lineTints = [0.98, 0.84, 1.0, 0.7, 0.92, 0.78, 0.88];
  const mapField: FieldFn = (u, v, i) => {
    const k = nodeOf.get(i);
    if (k !== undefined) return {h: 0.3 + 0.03 * MAP.nodes[k].r, tint: lineTints[MAP.nodes[k].line], glow: 0.55};
    const rk = ring.get(i);
    if (rk !== undefined) return {h: 0.16, tint: lineTints[MAP.nodes[rk].line] * 0.9};
    const du = u - frameUV[0];
    const dv = (v - frameUV[1]) * board.extH;
    if (Math.hypot(du, dv) > 37 * board.p) return {h: 0, tint: 0.9};
    const d = segDist(u, v);
    if (d < 0.55) return {h: 0.035, tint: 0.92} as PinSample;
    return {h: 0.01, tint: 0.56};
  };

  const noiseAt = s6.start - 0.55;
  const beats: Beat[] = [
    {id: 'c01-noise', at: noiseAt, field: noiseField(board, {seed: 'c01-profile', scale: 5, h: 0.22, tint: [0.45, 0.95], z: 3}), sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.5, jitterS: 0.05, tintFollowsWave: true}},
    {id: 'c01-banner', at: s6.start + 0.15, field: bannerBase, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 1.1, jitterS: 0.05, tintFollowsWave: true}},
    {id: 'c01-headline', at: wAI.start - 0.15, field: headline, sweep: {kind: 'linear', origin: [lineLeft - 0.02, 0.62], direction: [1, -0.4], speed: 0.9, jitterS: 0.04, tintFollowsWave: true}},
    {id: 'c01-research-map', at: u19.start - 0.5, field: (u, v, i) => (u > frameUV[0] - 0.24 ? mapField(u, v, i) : {h: 0, tint: 0.9}), sweep: {origin: frameUV, speed: 0.5, jitterS: 0.06, tintFollowsWave: true}},
  ];

  // ---------------------------------------------------------------- camera, lens, light
  const bannerPose = pose(st, {uv: [0.5, 0.5], pinsAcross: 170, screen: [0.5, 0.5], yaw: 0.08, pitch: 0.05});
  const tablePose = pushIn(pose(st, {uv: [0.5, 0.5], pinsAcross: 170, screen: [0.5, 0.5], yaw: 0.05, pitch: 0.04}), 0.04);
  const mapPose = pose(st, {uv: [frameUV[0] - 0.02, frameUV[1]], pinsAcross: 112, screen: [0.6, 0.5], yaw: 0.16, pitch: 0.08});
  const camera: CameraKey[] = [
    {at: s6.start - 0.8, dur: 1.4, pose: bannerPose},
    {at: s6.start + 0.6, dur: Math.max(1, u18.start - s6.start - 1.2), pose: pushIn(bannerPose, 0.05), ease: 'inOutSine'},
    {at: u18.start - 0.4, dur: 1.4, pose: tablePose},
    {at: u19.start - 0.6, dur: 1.8, pose: mapPose},
    {at: u19.start + 1.2, dur: Math.max(1, s6.end - u19.start - 2.4), pose: pushIn(mapPose, 0.05), ease: 'inOutSine'},
  ];
  // the lens follows Pixie's search across the map, from its left edge to its right
  const [m0x, m0y] = wxy(board, frameUV[0] - 0.17, frameUV[1]);
  const [m1x, m1y] = wxy(board, frameUV[0] + 0.17, frameUV[1]);
  const focus: FocusKey[] = [
    {at: s6.start, to: {uv: frameUV, h: 0.3 * relief}, aperture: 0},
    {at: u19.start + 0.3, dur: 0.8, to: {point: [m0x, m0y, 0.3 * relief]}, aperture: 0.0045},
    {at: u19.start + 1.1, dur: Math.max(1, wNot.start - u19.start - 1.1), to: {point: [m1x, m1y, 0.3 * relief]}, ease: 'inOutSine'},
    {at: wNot.start + 0.2, dur: 0.9, to: {uv: frameUV, h: 0.3 * relief}, aperture: 0.002},
    {at: s6.end - 1.2, dur: 0.8, to: {uv: [0.5, 0.5], h: 0}, aperture: 0},
  ];
  const [fx, fy] = wxy(board, frameUV[0], frameUV[1]);
  const light: LightKey[] = [
    {at: s6.start - 0.4, dur: 1.4, key: 0.95, spread: 1.4, poolAt: [fx - 0.12, fy + 0.03], look: [0, -0.05]},
    {at: u19.start - 0.5, dur: 1.4, spread: 1.05, poolAt: [fx, fy + 0.02], look: [0.15, -0.05]},
  ];

  // ---------------------------------------------------------------- overlays
  const chip = (k: number) => chipSlot(W, H, k);
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const tableAt = wMeasured.start - 0.3;
  const tableOut = u19.start - 0.3;
  const overlays: TimedNode[] = [
    {
      id: 'c01-profile-plate',
      from: s6.start + 0.4,
      to: s6.end,
      render: (t) => <NamePlate t={t} at={s6.start + 0.5} exitAt={s6.end - 0.5} name="AnwarDebes" status="Profile README · no app code" />,
    },
    {
      id: 'c01-profile-line',
      from: wAI.start,
      to: tableOut + 0.5,
      render: (t) => {
        // the line resolves out of the pins into crisp type, as the living banner does
        const top = at(t, lineLeft, lineV + (3.4 * board.p) / board.extH, 0.12 * relief);
        const bot = at(t, lineLeft, lineV - (3.4 * board.p) / board.extH, 0.12 * relief);
        const top2 = at(t, lineLeft, line2V + (3.4 * board.p) / board.extH, 0.12 * relief);
        const cap = Math.max(1, bot.y - top.y);
        const fs = cap / 0.703;
        const k = env(t, wAI.start + 1.1, tableAt + 0.1, 0.7, 0.4);
        const style: React.CSSProperties = {position: 'absolute', left: Math.round(top.x), fontFamily: font.sans, fontWeight: 700, fontSize: Math.round(fs), letterSpacing: '-0.03em', lineHeight: 1, color: color.text.display, whiteSpace: 'pre', textShadow: legible(H)};
        return (
          <>
            {k > 0.001 ? (
              <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
                <div style={{...style, top: Math.round(top.y - fs * 0.24)}}>AI that</div>
                <div style={{...style, top: Math.round(top2.y - fs * 0.24)}}>
                  <Em>shows its work.</Em>
                </div>
              </div>
            ) : null}
            <Chip t={t} at={wAI.start + 0.6} exitAt={u17.start + 1.2} {...chip(0)} repo="AnwarDebes" path="README.md" line={6} />
          </>
        );
      },
    },
    {
      id: 'c01-person',
      from: u17.start - 0.2,
      to: tableAt + 0.5,
      render: (t) => {
        const q = at(t, lineLeft, 0.505);
        const k = env(t, u17.start, tableAt + 0.3, 0.4, 0.35);
        if (k <= 0.001) return null;
        return (
          <>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(q.y), ...pull(k, H)}}>
              <span style={{...bodyStyle(H, 0.034, 500, color.text.display), textShadow: legible(H)}}>
                master's student <span style={{color: color.text.secondary}}>·</span> University of Agder
              </span>
            </div>
            <Chip t={t} at={u17.start + 0.9} exitAt={tableAt + 0.3} {...chip(1)} repo="glassbox-lm" path="README.md" line={141} />
          </>
        );
      },
    },
    {
      id: 'c01-measured',
      from: tableAt - 0.2,
      to: tableOut + 0.5,
      render: (t) => {
        const rowK = (d: number) => easeOut(ramp(t, wMisses.start - 0.4 + d, 0.5));
        const rows: Array<[string, React.ReactNode]> = [
          ['Clause-Driven-LLM', <>94.2% on CLINC150 <span style={{color: color.text.secondary}}>(logistic regression: 95.6%)</span></>],
          ['tm-llm-robustness-benchmark', <>the TM loses <b style={{color: color.text.key}}>27 points</b> on counterfactual IMDb, BERT loses 2</>],
        ];
        return (
          <>
            <Card t={t} at={tableAt} exitAt={tableOut} x={W * layout.marginLeftW} y={H * 0.375} w={W * 0.5} label="AnwarDebes/README.md · Tsetlin Machine work">
              <div style={{display: 'flex', gap: Math.round(H * 0.02), ...capsStyle(H, MONO_MIN, 0.12), color: color.text.tertiary, paddingBottom: Math.round(H * 0.01), borderBottom: `1px solid ${color.card.rule}`}}>
                <span>Project</span>
                <span style={{color: color.text.tertiary}}>·</span>
                <span style={{color: color.accent.mint, fontWeight: 600}}>Measured</span>
              </div>
              {rows.map(([name, txt], j) => (
                <div key={j} style={{paddingTop: Math.round(H * 0.014), opacity: rowK(j * 0.55), transform: `translateX(${((1 - rowK(j * 0.55)) * -H * 0.02).toFixed(1)}px)`}}>
                  <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim)}}>{name}</div>
                  <div style={{...bodyStyle(H, 0.027, 500), marginTop: Math.round(H * 0.004), whiteSpace: 'nowrap'}}>{txt}</div>
                </div>
              ))}
            </Card>
            <Chip t={t} at={wMeasured.start + 0.4} exitAt={tableOut} {...chip(2)} repo="AnwarDebes" path="README.md" line={191} />
            <Chip t={t} at={wMisses.start - 0.2} exitAt={tableOut} {...chip(1)} repo="AnwarDebes" path="README.md" line={195} />
            <Chip t={t} at={wMisses.start + 0.35} exitAt={tableOut} {...chip(0)} repo="AnwarDebes" path="README.md" line={207} />
          </>
        );
      },
    },
    {
      id: 'c01-map-labels',
      from: u19.start - 0.2,
      to: s6.end,
      render: (t) => {
        const k = env(t, wForty.start - 0.2, s6.end - 0.6, 0.4, 0.4);
        const nk = env(t, wNot.start + 0.1, s6.end - 0.6, 0.4, 0.4);
        return (
          <>
            {k > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.3), ...pull(k, H)}}>
                <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>Research map</div>
                <div style={{fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(H * 0.06), letterSpacing: '-0.03em', color: color.text.display, textShadow: legible(H), marginTop: Math.round(H * 0.012)}}>
                  40 projects <span style={{color: color.text.secondary, fontWeight: 500}}>·</span> 7 lines of research
                </div>
                <div style={{marginTop: Math.round(H * 0.018)}}>
                  {MAP.lines.map((name, j) => (
                    <div key={j} style={{...monoStyle(H, MONO_MIN, color.text.chipDim), lineHeight: 1.45, textShadow: legible(H)}}>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {nk > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.645), display: 'flex', alignItems: 'center', gap: Math.round(H * 0.012), ...pull(nk, H)}}>
                <MissGlyph size={Math.round(H * 0.026)} />
                <span style={{...monoStyle(H, 0.026, color.text.display), textShadow: legible(H)}}>Claude-Code-In-Motion</span>
                <span style={{...bodyStyle(H, 0.03, 500, color.text.secondary), textShadow: legible(H)}}>
                  · <Em>not on the map</Em>
                </span>
              </div>
            ) : null}
            <Chip t={t} at={wForty.start + 0.3} exitAt={s6.end - 0.6} {...chip(1)} repo="AnwarDebes" path="assets/research-map.svg" line={1} />
            <Chip t={t} at={wForty.start + 0.7} exitAt={s6.end - 0.6} {...chip(0)} repo="AnwarDebes" path="README.md" line={106} />
          </>
        );
      },
    },
    {
      id: 'c01-every-claim',
      from: u20.start,
      to: s6.end,
      render: (t) => <BigChip t={t} at={wFile.start - 0.45} exitAt={s6.end - 0.5} />,
    },
  ];

  const pixie: PixieCue[] = [
    {frame: f(s6.start + 0.6), activity: 'reading', detail: 'Read AnwarDebes/README.md'},
    {frame: f(u19.start + 0.2), activity: 'searching', detail: 'Search research-map.svg for “Claude-Code-In-Motion”'},
    {frame: f(wNot.start + 0.4), activity: 'idle', detail: 'not among the 40'},
  ];

  return {beats, camera, focus, light, overlays, pixie};
};

/** "every claim gets the file it came from": one chip typed large, the film's promise. */
const BigChip: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.3, 0.35);
  if (k <= 0.001) return null;
  const text = 'AnwarDebes/assets/research-map.svg:1';
  const n = Math.min(text.length, Math.floor(Math.max(0, t - at - 0.1) * 40));
  const fs = Math.round(H * 0.03);
  const hair = Math.max(1, Math.round(H / 1080));
  const done = n >= text.length;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(W * layout.marginLeftW),
        top: Math.round(H * 0.565),
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(fs * 0.6),
        height: Math.round(fs * 1.9),
        padding: `0 ${Math.round(fs * 0.8)}px`,
        borderRadius: Math.round(fs),
        background: 'rgba(19,19,19,0.94)',
        border: `${hair}px solid rgba(116,201,174,${done ? 0.6 : 0.25})`,
        opacity: k,
      }}
    >
      <span style={{...monoStyle(H, 0.03, color.text.display)}}>
        <span>{text.slice(0, Math.min(n, 10))}</span>
        <span style={{color: color.text.chipDim}}>{text.slice(10, Math.min(n, 34))}</span>
        <span>{text.slice(34, n)}</span>
      </span>
      {done ? <span style={{width: Math.round(fs * 0.9), height: Math.round(fs * 0.9), borderRadius: '50%', background: color.accent.mint, opacity: easeOut(ramp(t, at + 0.1 + text.length / 40, 0.25))}} /> : null}
    </div>
  );
};
