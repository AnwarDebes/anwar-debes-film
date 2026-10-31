import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {ChapterCard, KineticLine, Stamp} from '../../../engine/type';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import type {CodeSnippet} from '../../../engine/code/types';
import {projectToScreen, pushIn, rigPoseAt, type CameraKey} from '../../../engine/camera';
import {emblemField, flatField, rectField, type Beat, type FieldFn, type LightKey} from '../../../engine/pins';
import {Streams} from '../../../engine/fx';
import type {PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import runlog from '../../../data/ch02/code/glassbox-runlog.json';
import {bodyStyle, capsStyle, Card, Chip, chipSlot, easeOut, Em, env, legible, monoStyle, MONO_MIN, NamePlate, pull, ramp} from '../ch01/kit';
import {pose, wxy, type Part, type Stage} from '../ch01/stage';
import {EARLY_N, GB, hypothesisField, pageField, tileUV, type BoardLayout} from './board';

// 02.0 the Act I gate, 02.1 the glassbox-lm place and its first test, 02.2 the registration
// frozen before the runs, 02.3 the engine: literals, and three implementations that must agree.

const RUNLOG = runlog as unknown as CodeSnippet;
export const EMBLEM_UV: [number, number] = [0.64, 0.5];
export const BOARD: BoardLayout = {u: 0.645, v: 0.47, cell: 6.2};

export const buildOpening = (st: Stage): Part => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const ch = tl.chapter('02');
  const s0 = tl.scene('02.0');
  const s1 = tl.scene('02.1');
  const s2 = tl.scene('02.2');
  const s3 = tl.scene('02.3');
  const u1 = tl.utt('u0201');
  const u2 = tl.utt('u0202');
  const u3 = tl.utt('u0203');
  const u4 = tl.utt('u0204');
  const u5 = tl.utt('u0205');
  const u6 = tl.utt('u0206');
  const w24 = tl.word('u0205', 'twenty-four');
  const wHash = tl.word('u0204', 'hash');
  const wBefore = tl.word('u0203', 'before');
  const steel = flatField();

  // ---------------------------------------------------------------- the wall
  // the gate: a cube face of dark pins carrying the faint print of a page of words
  const cubeSize = 52;
  const cube = rectField(board, {u: EMBLEM_UV[0], v: EMBLEM_UV[1], w: cubeSize, h: cubeSize, radius: 1}, {h: 0.42, tint: 0.26, soft: 0.4});
  const cubePrint = pageField(board, {u: EMBLEM_UV[0], v: EMBLEM_UV[1], w: cubeSize - 6, h: cubeSize - 6, lines: 14, seed: 4}, cube);
  const cubeFace: FieldFn = (u, v, i) => {
    const s = cubePrint(u, v, i);
    const c = cube(u, v, i);
    // the print stays faint: words a shade above the dark face
    return s.h > c.h + 0.001 && c.h > 0.3 ? {h: c.h + 0.04, tint: 0.36} : c;
  };
  const emblem = emblemField(board, 'glassbox', {u: EMBLEM_UV[0], v: EMBLEM_UV[1], height: 64}, {ground: 0.9, glowAbove: 0.95});
  // the target: two empty bars over a bits-per-byte axis
  const barsAt = u2.start + 0.6;
  const barW = 12;
  const barBase = 0.37;
  const barField = (fill: [number, number] | null, ground: FieldFn): FieldFn => {
    const outlineL = rectField(board, {u: 0.6, v: barBase + 0.16, w: barW, h: 56, radius: 1}, {h: 0.03, tint: 0.5, soft: 0.5, ground});
    const outlineR = rectField(board, {u: 0.75, v: barBase + 0.16, w: barW, h: 56, radius: 1}, {h: 0.03, tint: 0.5, soft: 0.5, ground: outlineL});
    if (!fill) return outlineR;
    return outlineR;
  };
  // the registration: a page of pins, then the 24 registered tiles and room for 67 more
  const page = pageField(board, {u: 0.66, v: 0.5, w: 58, h: 76, lines: 22, seed: 1}, steel);
  const s24 = w24.start - 0.1;
  const tiles24 = hypothesisField(board, BOARD, 'early', steel);
  const tilesEmpty = hypothesisField(board, BOARD, 'empty', steel);
  // the literal slots: offsets -8..-1, a gap, +1..+8; three included
  const slotU = (o: number) => 0.39 + (o < 0 ? o + 8 : o + 9) * 0.031;
  const slotV = 0.56;
  const included = new Set([-1, -2, -3]);
  const slots = (lit: boolean): FieldFn => {
    let fld: FieldFn = steel;
    for (let o = -8; o <= 8; o++) {
      if (o === 0) continue;
      const on = lit && included.has(o);
      fld = rectField(board, {u: slotU(o), v: slotV, w: 3.6, h: 6, radius: 1}, {h: on ? 0.4 : 0.06, tint: on ? 1.0 : 0.55, glow: on ? 0.8 : 0, soft: 0.5, ground: fld});
    }
    return fld;
  };
  const andPlate = (ground: FieldFn): FieldFn => rectField(board, {u: (slotU(-3) + slotU(-1)) / 2, v: slotV + 0.07, w: 13, h: 3, radius: 1}, {h: 0.3, tint: 1.0, glow: 0.5, soft: 0.5, ground});

  const beats: Beat[] = [
    {id: 'c02-cube', at: s0.start, field: cubeFace, sweep: {origin: EMBLEM_UV, speed: 0.55, jitterS: 0.06}},
    // the black box clears from its top edge down, and its inside is already the first place
    {id: 'c02-clear', at: s0.start + 1.1, field: emblem, sweep: {kind: 'linear', origin: [0.5, EMBLEM_UV[1] + 0.17], direction: [0, -1], speed: 0.28, jitterS: 0.05, tintFollowsWave: true}},
    {id: 'c02-target', at: barsAt, field: barField(null, emblem), sweep: {kind: 'linear', origin: [0.5, 0.2], direction: [0, 1], speed: 0.6, jitterS: 0.04, tintFollowsWave: true}},
    // a page turn: the target card flips into the registration, a page of pins
    {id: 'c02-page', at: s2.start - 0.2, field: page, sweep: {kind: 'linear', origin: [0.5, 1], direction: [0, -1], speed: 0.9, jitterS: 0.03, tintFollowsWave: true}},
    {id: 'c02-board-empty', at: u5.start - 0.2, field: tilesEmpty, sweep: {kind: 'linear', origin: [0.4, 0.5], direction: [1, 0], speed: 1.0, jitterS: 0.03, tintFollowsWave: true}},
    {id: 'c02-board-24', at: s24, field: tiles24, sweep: {kind: 'linear', origin: [0.45, 0.6], direction: [1, -0.2], speed: 0.7, jitterS: 0.05}},
    // a lit-pin path tracer: one of the 24 drops into a row of 16 literal slots
    {id: 'c02-slots', at: s3.start - 0.3, field: slots(false), sweep: {kind: 'linear', origin: [0.35, 0.5], direction: [1, 0], speed: 1.1, jitterS: 0.03, tintFollowsWave: true}},
    {id: 'c02-slots-lit', at: u6.start + 0.6, field: slots(true)},
    {id: 'c02-and', at: u6.start + 1.6, field: andPlate(slots(true))},
  ];

  // ---------------------------------------------------------------- camera and light
  const gatePose = pose(st, {uv: EMBLEM_UV, z: 0.42 * relief, pinsAcross: 132, screen: [0.6, 0.5], yaw: 0.14, pitch: 0.06});
  const placePose = pose(st, {uv: [EMBLEM_UV[0] - 0.04, EMBLEM_UV[1] - 0.02], pinsAcross: 150, screen: [0.58, 0.5], yaw: 0.1, pitch: 0.05});
  const pagePose = pose(st, {uv: [0.62, 0.5], pinsAcross: 150, screen: [0.6, 0.5], yaw: 0.12, pitch: 0.05});
  const slotPose = pose(st, {uv: [0.56, 0.55], pinsAcross: 140, screen: [0.5, 0.42], yaw: 0.08, pitch: 0.07});
  const camera: CameraKey[] = [
    {at: ch.start, pose: st.P0},
    {at: ch.start + 0.2, dur: s0.start - ch.start + 0.9, pose: gatePose},
    // the push through the front face lands inside the scene
    {at: s0.start + 1.1, dur: 2.0, pose: pushIn(placePose, -0.05)},
    {at: s1.start + 0.4, dur: Math.max(1, s1.end - s1.start - 0.8), pose: pushIn(placePose, 0.04), ease: 'inOutSine'},
    {at: s2.start - 0.4, dur: 1.4, pose: pagePose},
    {at: s2.start + 1, dur: Math.max(1, s2.end - s2.start - 1.6), pose: pushIn(pagePose, 0.05), ease: 'inOutSine'},
    {at: s3.start - 0.5, dur: 1.3, pose: slotPose},
    {at: s3.start + 0.8, dur: Math.max(1, s3.end - s3.start - 1.2), pose: pushIn(slotPose, 0.04), ease: 'inOutSine'},
  ];
  const [ex, ey] = wxy(board, EMBLEM_UV[0], EMBLEM_UV[1]);
  const light: LightKey[] = [
    {at: ch.start, key: 1, pool: 1, spread: 1, poolAt: [0, 0], look: [0, 0], env: 1},
    {at: s0.start - 0.4, dur: 0.6, key: 0.7, spread: 0.8, poolAt: [ex, ey + 0.03], look: [0.1, -0.2]},
    {at: s0.start + 1.0, dur: 1.6, key: 1.0, spread: 1.25, look: [0.05, -0.05]},
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const chip = (k: number) => chipSlot(W, H, k);
  const plateAt = s1.start + 0.5;
  const codePages: CodePage[] = [
    {
      at: u4.start - 0.5,
      source: {snippet: RUNLOG, lines: [116, 222]},
      view: 116,
      rows: 4,
      zoom: 0.87,
      width: Math.round(W * 0.47),
      header: {label: 'glassbox-lm', path: 'tmlm/common/runlog.py', meta: '381180c'},
      cues: [cue.reveal(u4.start - 0.4, {lines: [116, 119], stagger: 0.08}), cue.highlight(u4.start + 0.4, 119, {until: wHash.start - 0.3}), cue.annotate(u4.start + 0.6, 119, 'the registration in force', {match: 'PREREG_RELPATH', side: 'end', until: wHash.start - 0.3})],
    },
    {
      at: wHash.start - 0.5,
      transitionDur: 0.6,
      source: {snippet: RUNLOG, lines: [216, 222]},
      rows: 7,
      zoom: 0.87,
      width: Math.round(W * 0.47),
      header: {label: 'glassbox-lm', path: 'tmlm/common/runlog.py', meta: 'prereg_sha256'},
      cues: [cue.reveal(wHash.start - 0.45, {stagger: 0.06}), cue.highlight(wHash.start, 221, {until: u5.start}), cue.annotate(wHash.start + 0.2, 221, 'its *hash*, in every run.json', {match: 'hashing.sha256_file(path)', side: 'end', until: u5.start})],
    },
  ];
  const codeIn = u4.start - 0.6;
  const codeOut = u5.start + 0.2;
  const overlays: TimedNode[] = [
    {
      id: 'c02-card',
      from: s0.start - 0.1,
      to: s1.start + 0.4,
      render: (t) => <ChapterCard index="02" kicker="glassbox-lm" title="*Before the runs.*" at={s0.start + 0.15} exitAt={s1.start + 0.1} t={t} />,
    },
    {
      id: 'c02-plate',
      from: plateAt,
      to: s3.end,
      render: (t) => <NamePlate t={t} at={plateAt} exitAt={u5.start} name="glassbox-lm" status="Research programme · 5 studies · 19 Sep–25 Oct 2026" />,
    },
    {
      id: 'c02-blackbox-words',
      from: s1.start,
      to: u2.start,
      render: (t) => {
        // a sentence goes into the box, a single word comes out: no reasons shown
        const c = at(t, EMBLEM_UV[0], EMBLEM_UV[1], 0.3 * relief);
        const inK = ramp(t, s1.start + 0.5, 1.3);
        const outK = ramp(t, s1.start + 2.0, 1.1);
        const fadeAll = 1 - ramp(t, u1.end - 0.2, 0.5);
        if (fadeAll <= 0) return null;
        const xIn = c.x - H * 0.9 + H * 0.78 * easeOut(inK);
        const xOut = c.x + H * 0.04 + H * 0.2 * easeOut(outK);
        return (
          <div style={{position: 'absolute', inset: 0, opacity: fadeAll}}>
            {inK < 1 ? (
              <div style={{position: 'absolute', left: Math.round(xIn), top: Math.round(c.y - H * 0.03), opacity: 1 - ramp(t, s1.start + 1.4, 0.45), fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(H * 0.04), color: color.text.display, whiteSpace: 'pre', textShadow: legible(H)}}>
                It is a truth universally
              </div>
            ) : null}
            {outK > 0 ? (
              <div style={{position: 'absolute', left: Math.round(xOut), top: Math.round(c.y + H * 0.02), opacity: easeOut(outK), fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(H * 0.044), color: color.accent.mint, whiteSpace: 'pre', textShadow: legible(H)}}>
                acknowledged
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'c02-question',
      from: s1.start + 3,
      to: u2.start + 0.4,
      render: (t) => (
        <KineticLine text="What if a language model's knowledge were a list of *rules you could read?*" at={s1.start + 3.2} perWordS={0.11} t={t} kind="headline" sizeH={0.06} variant="focus" x={Math.round(W * layout.marginLeftW)} y={Math.round(H * 0.28)} yAnchor="capTop" maxWidth={0.42 * W} exitAt={u2.start + 0.2} />
      ),
    },
    {
      id: 'c02-target-card',
      from: barsAt - 0.2,
      to: s2.start + 0.3,
      render: (t) => {
        const k = env(t, barsAt, s2.start, 0.45, 0.35);
        if (k <= 0.001) return null;
        const qL = at(t, 0.6, barBase - 0.03);
        const qR = at(t, 0.75, barBase - 0.03);
        const qA = at(t, 0.675, barBase - 0.1);
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {[
              [qL, 'Kneser-Ney 5-gram'],
              [qR, 'Tsetlin Machine LM'],
            ].map(([q, name], j) => (
              <div key={j} style={{position: 'absolute', left: Math.round((q as {x: number}).x - H * 0.15), width: Math.round(H * 0.3), top: Math.round((q as {y: number}).y), textAlign: 'center', ...bodyStyle(H, 0.03, 600), textShadow: legible(H)}}>
                {name as string}
              </div>
            ))}
            <div style={{position: 'absolute', left: Math.round(qA.x - H * 0.5), width: Math.round(H * 1.0), top: Math.round(qA.y), textAlign: 'center', ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>
              bits per byte · WikiText-103 test · identical tokens · lower is better
            </div>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.3), width: Math.round(W * 0.36)}}>
              <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>the first test · H1.1</div>
              <div style={{...bodyStyle(H, 0.044, 650), letterSpacing: '-0.025em', marginTop: Math.round(H * 0.012), textShadow: legible(H)}}>
                beat Kneser-Ney 5-gram
              </div>
              <div style={{...bodyStyle(H, 0.03, 500, color.text.secondary), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}>bits per byte · same WikiText-103 tokens</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'c02-place-chips',
      from: plateAt,
      to: s2.start + 0.4,
      render: (t) => (
        <>
          <Chip t={t} at={plateAt + 0.6} exitAt={u1.end} {...chip(0)} repo="glassbox-lm" path="README.md" line={17} />
          <Chip t={t} at={u1.start + 1.4} exitAt={u2.start + 0.3} {...chip(1)} repo="glassbox-lm" path="README.md" line={25} />
          <Chip t={t} at={u2.start + 0.5} exitAt={s2.start + 0.2} {...chip(1)} repo="glassbox-lm" path="studies/tm_language_model/docs/13-preregistration.md" line="30-31" />
          <Chip t={t} at={u2.start + 1.1} exitAt={s2.start + 0.2} {...chip(0)} repo="glassbox-lm" path="studies/tm_language_model/docs/13-preregistration.md" line={49} />
        </>
      ),
    },
    {
      id: 'c02-prereg',
      from: s2.start,
      to: s2.end,
      render: (t) => {
        const kRow = env(t, wBefore.start - 0.2, codeIn + 0.2, 0.4, 0.35);
        const sq = at(t, 0.66 + 0.15, 0.5 + 0.22, 0.2 * relief);
        return (
          <>
            <Stamp kind="VERIFIED" label="FROZEN 2026-09-22" tone={color.text.display} at={u3.start + 0.5} exitAt={codeIn + 0.4} t={t} x={Math.round(sq.x)} y={Math.round(sq.y)} />
            {kRow > 0.001 ? (
              <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.3), width: Math.round(W * 0.38), ...pull(kRow, H)}}>
                <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>13-preregistration.md · one row</div>
                <div style={{...monoStyle(H, 0.03, color.text.key, 600), marginTop: Math.round(H * 0.014), textShadow: legible(H)}}>H1.1</div>
                <div style={{...bodyStyle(H, 0.03, 500), marginTop: Math.round(H * 0.008), whiteSpace: 'normal', textShadow: legible(H)}}>
                  causal TM beats in-house KN-5 · bits per byte · test split · <Em>every seed</Em>
                </div>
              </div>
            ) : null}
            <Chip t={t} at={u3.start + 0.8} exitAt={codeIn + 0.3} {...chip(1)} repo="glassbox-lm" path="studies/tm_language_model/docs/13-preregistration.md" line={3} />
            <Chip t={t} at={wBefore.start + 0.2} exitAt={codeIn + 0.3} {...chip(0)} repo="glassbox-lm" path="studies/tm_language_model/docs/13-preregistration.md" line={49} />
          </>
        );
      },
    },
    {
      id: 'c02-code',
      from: codeIn - 0.1,
      to: codeOut + 0.6,
      render: (t) => (
        <>
          <CodePanel pages={codePages} x={Math.round(W * layout.marginLeftW)} y={Math.round(H * 0.25)} anchor="top-left" t={t} enter={{at: codeIn, dur: 0.6}} exit={{at: codeOut, dur: 0.5}} maxWidth={Math.round(W * 0.48)} />
          <Chip t={t} at={u4.start + 0.5} exitAt={codeOut} {...chip(1)} repo="glassbox-lm" path="studies/tm_language_model/src/tmlm/common/runlog.py" line="116-119" />
          <Chip t={t} at={wHash.start + 0.1} exitAt={codeOut} {...chip(0)} repo="glassbox-lm" path="studies/tm_language_model/src/tmlm/common/runlog.py" line="216-222" />
        </>
      ),
    },
    {
      id: 'c02-24',
      from: u5.start,
      to: s2.end + 0.3,
      render: (t) => {
        const k = env(t, s24 + 0.3, s2.end, 0.4, 0.35);
        if (k <= 0.001) return null;
        const q0 = at(t, tileUV(board, BOARD, 0)[0], tileUV(board, BOARD, 0)[1] + 0.055);
        void EARLY_N;
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.3)}}>
              <div style={{fontFamily: font.sans, fontWeight: 680, fontSize: Math.round(H * 0.16), letterSpacing: '-0.03em', lineHeight: 0.9, color: color.text.display, textShadow: legible(H)}}>24</div>
              <div style={{...bodyStyle(H, 0.032, 500), marginTop: Math.round(H * 0.018), textShadow: legible(H)}}>hypotheses · 22 Sep 2026</div>
              <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}>19 frozen + 5 by same-day amendment A1</div>
            </div>
            <div style={{position: 'absolute', left: Math.round(q0.x), top: Math.round(q0.y - H * 0.03), ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>H1 … H6</div>
            <div style={{position: 'absolute', left: Math.round(q0.x), top: Math.round(at(t, BOARD.u, BOARD.v - 0.17).y), ...monoStyle(H, MONO_MIN, color.text.tertiary), textShadow: legible(H)}}>room left for 67 more</div>
          </div>
        );
      },
    },
    {
      id: 'c02-24-chips',
      from: u5.start,
      to: s2.end + 0.3,
      render: (t) => (
        <>
          <Chip t={t} at={s24 + 0.5} exitAt={s2.end - 0.1} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="glassbox-lm" path="docs/results-overview.md" line={11} />
          <Chip t={t} at={s24 + 0.9} exitAt={s2.end - 0.1} x={Math.round(W * 0.962)} y={Math.round(H * 0.142)} repo="glassbox-lm" path="studies/tm_language_model/docs/13-preregistration.md" line={126} />
        </>
      ),
    },
    {
      id: 'c02-slots-labels',
      from: s3.start,
      to: s3.end,
      render: (t) => {
        const k = env(t, s3.start + 0.2, s3.end - 0.2, 0.4, 0.35);
        if (k <= 0.001) return null;
        const labels: React.ReactNode[] = [];
        for (let o = -8; o <= 8; o++) {
          if (o === 0) continue;
          const q = at(t, slotU(o), slotV - 0.05);
          labels.push(
            <div key={o} style={{position: 'absolute', left: Math.round(q.x - H * 0.03), width: Math.round(H * 0.06), top: Math.round(q.y), textAlign: 'center', ...monoStyle(H, MONO_MIN, included.has(o) && t > u6.start + 0.6 ? color.accent.mint : color.text.tertiary), textShadow: legible(H)}}>
              {o > 0 ? `+${o}` : `${o}`}
            </div>,
          );
        }
        const gap = at(t, (slotU(-1) + slotU(1)) / 2, slotV);
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {labels}
            <div style={{position: 'absolute', left: Math.round(gap.x - H * 0.02), top: Math.round(gap.y - H * 0.03), ...monoStyle(H, 0.03, color.text.display), textShadow: legible(H)}}>?</div>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.53), ...monoStyle(H, 0.026, color.text.display), textShadow: legible(H)}}>
              literal = (segment, symbol, negation)
            </div>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.575), ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>
              offsets −8 … −1, +1 … +8 · the causal model reads the left eight
            </div>
            <HashTrio t={t} at={u6.start + 2.2} exitAt={s3.end - 0.2} />
          </div>
        );
      },
    },
    {
      id: 'c02-slots-chips',
      from: s3.start,
      to: s3.end,
      render: (t) => (
        <>
          <Chip t={t} at={u6.start + 0.4} exitAt={s3.end - 0.2} x={Math.round(W * 0.962)} y={Math.round(H * 0.09)} repo="glassbox-lm" path="studies/tm_language_model/docs/11-engine-spec.md" line="53-66" />
          <Chip t={t} at={u6.start + 2.6} exitAt={s3.end - 0.2} x={Math.round(W * 0.962)} y={Math.round(H * 0.142)} repo="glassbox-lm" path="studies/tm_language_model/src/tmlm/engine/core/tm_core.h" line="1-6" />
        </>
      ),
    },
  ];

  // a packet through the three engines, arriving as one hash
  const world: TimedNode[] = [
    {
      id: 'c02-hash-stream',
      from: u6.start + 2.2,
      to: s3.end,
      render: () => {
        const [ax, ay] = wxy(board, 0.4, 0.38);
        const [bx, by] = wxy(board, 0.78, 0.38);
        return (
          <Streams
            curves={[
              {curve: {kind: 'arc', from: [ax, ay, 0.02], to: [bx, by, 0.02], bend: [0, 0.03, 0.04]}, from: u6.start + 2.3, to: s3.end - 0.2, drawOnS: 1.4, fadeS: 0.4, speed: 0.4, every: 0.45, packetLength: 0.05, radius: 0.0022, intensity: 2.2, bloom: 0.8, line: {width: 1.2, intensity: 0.4, color: color.accent.mintLabel}},
            ]}
          />
        );
      },
    },
  ];

  const pixie: PixieCue[] = [
    {frame: f(ch.start), activity: 'idle', detail: ''},
    {frame: f(s1.start + 0.6), activity: 'reading', detail: 'Read glassbox-lm/README.md'},
    {frame: f(s2.start + 0.2), activity: 'reading', detail: 'Read 13-preregistration.md'},
    {frame: f(s3.start + 0.2), activity: 'reading', detail: 'Read 11-engine-spec.md'},
  ];

  void GB;
  return {beats, camera, light, overlays, world, pixie};
};

/** Python oracle, C++ and CUDA: one state_hash() (an architecture fragment of the engine). */
const HashTrio: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.3);
  if (k <= 0.001) return null;
  const names = ['Python oracle', 'C++', 'CUDA'];
  const hair = Math.max(1, Math.round(H / 1080));
  const match = t > at + 1.2;
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.64), display: 'flex', alignItems: 'center', gap: Math.round(H * 0.02), ...pull(k, H)}}>
      <span style={{...monoStyle(H, MONO_MIN, color.text.chipDim)}}>spec →</span>
      {names.map((n, j) => (
        <span key={j} style={{padding: `${Math.round(H * 0.008)}px ${Math.round(H * 0.014)}px`, borderRadius: Math.round(H * 0.012), border: `${hair}px solid ${match ? color.accent.mint : 'rgba(228,234,231,0.28)'}`, background: 'rgba(12,16,15,0.88)', opacity: easeOut(ramp(t, at + j * 0.15, 0.3)), ...monoStyle(H, MONO_MIN, color.text.display)}}>
          {n}
        </span>
      ))}
      <span style={{...monoStyle(H, MONO_MIN, match ? color.accent.mint : color.text.chipDim), opacity: easeOut(ramp(t, at + 1.0, 0.3))}}>→ same state_hash()</span>
    </div>
  );
};
