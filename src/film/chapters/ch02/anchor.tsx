import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {Numeral, Stamp} from '../../../engine/type';
import {projectToScreen, pushIn, rigPoseAt, type CameraKey} from '../../../engine/camera';
import {flatField, rectField, type Beat, type FieldFn, type LightKey, type LiveFieldFn, type LiveLayer, type Ripple, FILM_RIPPLE} from '../../../engine/pins';
import {Streams} from '../../../engine/fx';
import type {PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import {bodyStyle, capsStyle, Chip, chipSlot, easeOut, Em, env, fmtInt, legible, MissGlyph, monoStyle, MONO_MIN, pull, ramp, TypedChip} from '../ch01/kit';
import {pose, wxy, type Part, type Stage} from '../ch01/stage';
import {GB, hypothesisField, tileUV, EARLY_N} from './board';
import {BOARD} from './opening';

// 02.4 the anchor run and the miss, said out loud; 67 more hypotheses written down after the miss
// and before the runs they govern. 02.5 a measured identity: counting written as clause votes.
// 02.6 the document as memory, and how little the learned clauses add.

const A = GB.anchor;
const BPB_MAX = 2.5;

export const buildAnchor = (st: Stage): Part => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const s4 = tl.scene('02.4');
  const s5 = tl.scene('02.5');
  const s6 = tl.scene('02.6');
  const u7 = tl.utt('u0207');
  const u8 = tl.utt('u0208');
  const u9 = tl.utt('u0209');
  const u10 = tl.utt('u0210');
  const u11 = tl.utt('u0211');
  const u12 = tl.utt('u0212');
  const u13 = tl.utt('u0213');
  const u14 = tl.utt('u0214');
  const w = (u: string, word: string) => tl.word(u, word).start;
  const wScores = tl.word('u0207', 'scores');
  const wCounting = tl.word('u0208', 'Counting');
  const wNot = tl.word('u0209', 'not');
  const wTriggered = tl.word('u0210', 'triggered');
  const wSeeds = tl.word('u0210', 'seeds');
  const wSixty = tl.word('u0211', 'sixty-seven');
  const steel = flatField();

  // ---------------------------------------------------------------- 02.4 the wall
  const epU = (k: number) => 0.235 + k * 0.058;
  const epBase = 0.385;
  const epMax = Math.max(...A.epochS);
  const epochBars = (n: number): FieldFn => {
    let fld: FieldFn = steel;
    for (let k = 0; k < n; k++) {
      const hp = 20 * (A.epochS[k] / epMax);
      fld = rectField(board, {u: epU(k), v: epBase + (hp * board.p) / 2 / board.extH, w: 4.4, h: hp, radius: 0.8}, {h: 0.22, tint: 0.92, soft: 0.5, ground: fld});
    }
    return fld;
  };
  const barU = [0.555, 0.675];
  const barBase = 0.385;
  const barHp = (bpb: number) => (35 * bpb) / BPB_MAX;
  const resultBars = (kn: boolean, tm: boolean, ground: FieldFn): FieldFn => {
    let fld = ground;
    const add = (u: number, bpb: number, look: {tint: number; glow?: number}) => {
      const hp = barHp(bpb);
      fld = rectField(board, {u, v: barBase + (hp * board.p) / 2 / board.extH, w: 12, h: hp, radius: 1}, {h: 0.3, tint: look.tint, glow: look.glow ?? 0, soft: 0.5, ground: fld});
    };
    if (kn) add(barU[0], A.kn5, {tint: 1.0});
    if (tm) add(barU[1], A.tm, {tint: 0.92});
    return fld;
  };
  // KB7: the kill rule at 1.5 x KN-5, a dashed row of raised pins across both bars
  const kbV = barBase + (barHp(1.5 * A.kn5) * board.p) / board.extH;
  const kbRule = (ground: FieldFn): FieldFn => (u, v, i) => {
    const g = ground(u, v, i);
    if (u < barU[0] - 0.05 || u > barU[1] + 0.05) return g;
    if (Math.abs(v - kbV) > (0.55 * board.rowH) / board.extH) return g;
    const dash = Math.floor((u - (barU[0] - 0.05)) / (2.2 * board.p)) % 2 === 0;
    return dash ? {h: Math.max(g.h, 0.4), tint: 1.0, glow: 0.1} : g;
  };
  const epochs = epochBars(4);
  const withTM = resultBars(false, true, epochs);
  const withBoth = resultBars(true, true, epochs);
  const allTiles = hypothesisField(board, BOARD, 'all', steel);

  const beats: Beat[] = [
    {id: 'c02-epochs', at: u7.start + 0.3, field: epochBars(4), sweep: {kind: 'linear', origin: [0.26, 0.3], direction: [1, 0], speed: 0.4, jitterS: 0.04}},
    {id: 'c02-tm-bar', at: wScores.start - 0.1, field: withTM, sweep: {kind: 'linear', origin: [barU[1], barBase], direction: [0, 1], speed: 0.22, jitterS: 0.03}},
    {id: 'c02-kn-bar', at: wCounting.start - 0.1, field: withBoth, sweep: {kind: 'linear', origin: [barU[0], barBase], direction: [0, 1], speed: 0.22, jitterS: 0.03}},
    {id: 'c02-kb7', at: wNot.start - 0.6, field: kbRule(withBoth), sweep: {kind: 'linear', origin: [barU[0] - 0.06, kbV], direction: [1, 0], speed: 0.5, jitterS: 0.01, tintFollowsWave: true}},
    // after the miss: 67 new hypotheses rise beside the 24
    {id: 'c02-67', at: wSixty.start - 0.2, field: allTiles, sweep: {kind: 'linear', origin: [0.45, 0.6], direction: [1, -0.15], speed: 0.55, jitterS: 0.05}},
  ];

  // ---------------------------------------------------------------- 02.5 counting written as votes
  const rowV = [0.434, 0.393];
  const lockstep: LiveFieldFn = (u, v, i, t) => {
    const r = Math.abs(v - rowV[0]) < (1.1 * board.rowH) / board.extH ? 0 : Math.abs(v - rowV[1]) < (1.1 * board.rowH) / board.extH ? 1 : -1;
    if (r < 0 || u < 0.16 || u > 0.84) return null;
    // a schematic of the two read-outs at the same positions: the same heights, step for step
    const x = Math.round(u / board.p);
    const val = 0.5 + 0.5 * Math.sin(x * 0.73) * Math.cos(x * 0.21 + 1.3);
    const front = ramp(t, u12.start + 0.4 + r * 0.05, 3.2);
    if ((u - 0.16) / 0.68 > front) return {h: 0.02, tint: 0.5};
    return {h: 0.08 + 0.42 * val, tint: 1.0, glow: r === 1 ? 0.25 : 0};
  };
  const lockRegion: [number, number, number, number] = [0.15, rowV[1] - 0.02, 0.85, rowV[0] + 0.02];

  // ---------------------------------------------------------------- 02.6 the document as memory
  const docBeat = s6.start - 0.3;
  const docRows = (u: number, v: number, i: number) => {
    const x = (u - 0.42) / board.p;
    const y = ((v - 0.6) * board.extH) / board.p;
    if (Math.abs(x) > 44 || y > 11 || y < -11) return steel(u, v, i);
    const row = Math.round(y / 3.5);
    if (Math.abs(y - row * 3.5) > 0.7) return {h: 0, tint: 0.6};
    const len = 56 + 30 * Math.abs(Math.sin(row * 3.1));
    if (x + 44 > len) return {h: 0, tint: 0.6};
    return {h: 0.12, tint: 0.92};
  };
  const gainU = [0.66, 0.73, 0.8];
  const gainBars = (ground: FieldFn): FieldFn => {
    let fld = ground;
    GB.document.gains.forEach((g, k) => {
      const hp = 2 + 260 * g;
      fld = rectField(board, {u: gainU[k], v: 0.42 + (hp * board.p) / 2 / board.extH, w: 5, h: hp, radius: 0.8}, {h: 0.25, tint: 1.0, soft: 0.5, ground: fld});
    });
    return fld;
  };
  beats.push(
    {id: 'c02-lockstep-base', at: s5.start - 0.4, field: (u, v, i) => (Math.abs(v - rowV[0]) < 0.012 || Math.abs(v - rowV[1]) < 0.012 ? (u > 0.16 && u < 0.84 ? {h: 0.02, tint: 0.5} : steel(u, v, i)) : steel(u, v, i)), sweep: {kind: 'linear', origin: [0.5, 1], direction: [0, -1], speed: 0.9, jitterS: 0.03, tintFollowsWave: true}},
    {id: 'c02-doc', at: docBeat, field: docRows, sweep: {origin: [0.5, 0.62], speed: 0.7, jitterS: 0.05, tintFollowsWave: true}},
    {id: 'c02-gains', at: w('u0214', 'learned') - 0.2, field: gainBars(docRows), sweep: {kind: 'linear', origin: [0.62, 0.42], direction: [1, 0], speed: 0.6, jitterS: 0.04}},
  );
  const live: LiveLayer[] = [{fn: lockstep, region: lockRegion, from: s5.start - 0.1, to: s5.end - 0.2, fadeS: 0.4, speedHint: () => 0.4}];
  // Pixie's jump in 02.5 sends a ripple across the wall; the ripple becomes the document
  const ripples: Ripple[] = [{...FILM_RIPPLE, at: s6.start - 0.6, origin: [0.12, 0.2], amp: 0.06}];

  // ---------------------------------------------------------------- camera and light
  const anchorPose = pose(st, {uv: [0.5, 0.5], pinsAcross: 150, screen: [0.5, 0.4], yaw: 0.1, pitch: 0.06});
  const boardPose = pose(st, {uv: [0.6, 0.47], pinsAcross: 150, screen: [0.58, 0.5], yaw: 0.12, pitch: 0.06});
  const eqPose = pose(st, {uv: [0.5, 0.5], pinsAcross: 160, screen: [0.5, 0.42], yaw: 0.04, pitch: 0.12});
  const docPose = pose(st, {uv: [0.55, 0.47], pinsAcross: 150, screen: [0.55, 0.48], yaw: 0.14, pitch: 0.08});
  const camera: CameraKey[] = [
    {at: s4.start - 0.5, dur: 1.4, pose: anchorPose},
    {at: s4.start + 1.0, dur: Math.max(1, u11.start - s4.start - 1.4), pose: pushIn(anchorPose, 0.05), ease: 'inOutSine'},
    {at: wSixty.start - 0.8, dur: 1.4, pose: boardPose},
    {at: wSixty.start + 0.7, dur: Math.max(1, s4.end - wSixty.start - 0.9), pose: pushIn(boardPose, 0.04), ease: 'inOutSine'},
    {at: s5.start - 0.5, dur: 1.5, pose: eqPose},
    {at: s5.start + 1.1, dur: Math.max(1, s5.end - s5.start - 1.5), pose: pushIn(eqPose, 0.04), ease: 'inOutSine'},
    {at: s6.start - 0.4, dur: 1.4, pose: docPose},
    {at: s6.start + 1.1, dur: Math.max(1, s6.end - s6.start - 1.4), pose: pushIn(docPose, 0.05), ease: 'inOutSine'},
  ];
  const [bx, by] = wxy(board, 0.69, 0.42);
  const light: LightKey[] = [
    {at: s4.start - 0.4, dur: 1.4, key: 0.95, spread: 1.3, poolAt: [bx - 0.08, by + 0.03], look: [0.05, -0.05]},
    // the miss: the light tightens on the bars
    {at: wNot.start - 0.3, dur: 0.8, key: 0.86, spread: 0.95, poolAt: [bx, by + 0.02]},
    {at: wSixty.start - 0.5, dur: 1.4, key: 1.0, spread: 1.3},
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const chip = (k: number) => chipSlot(W, H, k);
  const top = (k: number) => ({x: Math.round(W * 0.962), y: Math.round(H * (0.09 + 0.052 * k))});
  const res = 'studies/tm_language_model/docs/results.md';
  const overlays: TimedNode[] = [
    {
      id: 'c02-anchor-counters',
      from: s4.start,
      to: wSixty.start,
      render: (t) => {
        const k = env(t, u7.start + 0.2, wSixty.start - 0.3, 0.4, 0.35);
        if (k <= 0.001) return null;
        const labels = A.epochS.map((s, j) => {
          const q = at(t, epU(j), epBase - 0.045);
          return (
            <div key={j} style={{position: 'absolute', left: Math.round(q.x - H * 0.05), width: Math.round(H * 0.1), top: Math.round(q.y), textAlign: 'center', ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>
              {fmtInt(s)}
            </div>
          );
        });
        const qe = at(t, epU(0) - 0.01, epBase + (21 * board.p) / board.extH + 0.02);
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.085), ...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>23 Sep 2026 · anchor run</div>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.125), display: 'flex', gap: Math.round(H * 0.05)}}>
              <span style={{...bodyStyle(H, 0.036, 650), textShadow: legible(H)}}>
                {fmtInt(A.clauses)} <span style={{fontWeight: 500, color: color.text.secondary}}>clauses</span>
              </span>
              <span style={{...bodyStyle(H, 0.036, 650), textShadow: legible(H)}}>
                {fmtInt(A.tokens)} <span style={{fontWeight: 500, color: color.text.secondary}}>training tokens</span>
              </span>
            </div>
            {labels}
            <div style={{position: 'absolute', left: Math.round(qe.x), top: Math.round(qe.y - H * 0.04), ...monoStyle(H, MONO_MIN, color.text.tertiary), textShadow: legible(H)}}>4 epochs · seconds, upper bounds</div>
          </div>
        );
      },
    },
    {
      id: 'c02-bars',
      from: wScores.start - 0.2,
      to: wSixty.start,
      render: (t) => {
        const k = env(t, wScores.start, wSixty.start - 0.3, 0.3, 0.35);
        if (k <= 0.001) return null;
        const tm = at(t, barU[1], barBase + (barHp(A.tm) * board.p) / board.extH + 0.02, 0.3 * relief);
        const kn = at(t, barU[0], barBase + (barHp(A.kn5) * board.p) / board.extH + 0.02, 0.3 * relief);
        const base0 = at(t, barU[0], barBase - 0.035);
        const base1 = at(t, barU[1], barBase - 0.035);
        const kbq = at(t, barU[0] - 0.2, kbV);
        const nl = (q: {x: number; y: number}, value: number, landAt: number) => (
          <div style={{position: 'absolute', left: Math.round(q.x - H * 0.12), width: Math.round(H * 0.24), top: Math.round(q.y - H * 0.075), textAlign: 'center'}}>
            <Numeral value={value} decimals={4} landAt={landAt} countS={0.9} sizeH={0.05} weight={680} t={t} x={Math.round(H * 0.055)} align="left" baseline={Math.round(H * 0.05)} />
          </div>
        );
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {t > wScores.start ? nl(tm, A.tm, wScores.start + 0.9) : null}
            {t > wCounting.start ? nl(kn, A.kn5, wCounting.start + 0.9) : null}
            <div style={{position: 'absolute', left: Math.round(base0.x - H * 0.13), width: Math.round(H * 0.26), top: Math.round(base0.y), textAlign: 'center', ...bodyStyle(H, 0.028, 600), textShadow: legible(H)}}>Kneser-Ney 5-gram</div>
            <div style={{position: 'absolute', left: Math.round(base1.x - H * 0.13), width: Math.round(H * 0.26), top: Math.round(base1.y), textAlign: 'center', ...bodyStyle(H, 0.028, 600), textShadow: legible(H)}}>Tsetlin Machine LM</div>
            <div style={{position: 'absolute', left: Math.round((base0.x + base1.x) / 2 - H * 0.3), width: Math.round(H * 0.6), top: Math.round(base0.y + H * 0.04), textAlign: 'center', ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>bits per byte · lower is better</div>
            {t > wNot.start - 0.5 ? (
              <div style={{position: 'absolute', left: Math.round(kbq.x), top: Math.round(kbq.y - H * 0.016), ...monoStyle(H, MONO_MIN, color.text.display), opacity: easeOut(ramp(t, wNot.start - 0.4, 0.4)), textShadow: legible(H)}}>KB7 · 1.5 × KN-5</div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'c02-stamps',
      from: wNot.start - 0.1,
      to: wSixty.start,
      render: (t) => {
        const q = {x: W * 0.8, y: H * 0.33};
        return (
          <>
            <Stamp kind="NOT MET" label="NOT MET · H1.1" at={wNot.start} exitAt={wSixty.start - 0.3} t={t} x={Math.round(q.x)} y={Math.round(q.y)} rotate={-8} />
            <Stamp kind="NOT MET" label="KB7 TRIGGERED (> 1.5 × KN-5)" at={wTriggered.start} exitAt={wSixty.start - 0.3} t={t} x={Math.round(q.x + H * 0.01)} y={Math.round(q.y + H * 0.085)} rotate={-8} sizeH={0.024} />
          </>
        );
      },
    },
    {
      id: 'c02-seeds',
      from: wSeeds.start - 0.2,
      to: wSixty.start,
      render: (t) => {
        const k = env(t, wSeeds.start - 0.1, wSixty.start - 0.3, 0.35, 0.35);
        if (k <= 0.001) return null;
        return (
          <div style={{position: 'absolute', left: Math.round(W * 0.7), top: Math.round(H * 0.5), ...pull(k, H)}}>
            {['seed 2 · not run', 'seed 3 · not run · rule fixed before the run'].map((s, j) => (
              <div key={j} style={{display: 'flex', alignItems: 'center', gap: Math.round(H * 0.012), marginBottom: Math.round(H * 0.01)}}>
                <MissGlyph size={Math.round(H * 0.024)} />
                <span style={{...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>{s}</span>
              </div>
            ))}
            <div style={{...monoStyle(H, MONO_MIN, color.text.tertiary), textShadow: legible(H)}}>single seed · one read of the test split</div>
          </div>
        );
      },
    },
    {
      id: 'c02-anchor-chips',
      from: s4.start,
      to: s4.end,
      render: (t) => (
        <>
          <Chip t={t} at={u7.start + 0.8} exitAt={u8.start} {...top(0)} repo="glassbox-lm" path={res} line={37} />
          <Chip t={t} at={wScores.start + 0.6} exitAt={u9.start} {...top(1)} repo="glassbox-lm" path="README.md" line={53} />
          <Chip t={t} at={wNot.start + 0.4} exitAt={wTriggered.start} {...top(0)} repo="glassbox-lm" path={res} line={49} />
          <Chip t={t} at={wTriggered.start + 0.3} exitAt={wSixty.start} {...top(0)} repo="glassbox-lm" path={res} line={175} />
          <TypedChip t={t} at={wSeeds.start + 0.3} exitAt={wSixty.start} {...top(1)} kind="run" text={A.run} />
          <Chip t={t} at={wSeeds.start + 0.8} exitAt={wSixty.start} {...top(2)} repo="glassbox-lm" path={res} line={39} />
        </>
      ),
    },
    {
      id: 'c02-67-labels',
      from: wSixty.start - 0.2,
      to: s4.end + 0.3,
      render: (t) => {
        const k = env(t, wSixty.start + 0.2, s4.end - 0.1, 0.4, 0.35);
        if (k <= 0.001) return null;
        const q1 = at(t, BOARD.u - (13 * BOARD.cell * board.p) / 2, BOARD.v + (3.5 * BOARD.cell * board.p) / board.extH + 0.012);
        void EARLY_N;
        void tileUV;
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.3), width: Math.round(W * 0.3)}}>
              <div style={{fontFamily: font.sans, fontWeight: 680, fontSize: Math.round(H * 0.13), letterSpacing: '-0.03em', lineHeight: 0.9, color: color.text.display, textShadow: legible(H)}}>+67</div>
              <div style={{...bodyStyle(H, 0.03, 500), marginTop: Math.round(H * 0.016), whiteSpace: 'normal', textShadow: legible(H)}}>
                amendments of 24–25 Sep · after the miss · <Em>before the runs</Em> they govern
              </div>
              <TimeStrip t={t} at={wSixty.start + 0.6} />
            </div>
            <div style={{position: 'absolute', left: Math.round(q1.x), top: Math.round(q1.y - H * 0.035), ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>
              <span style={{color: color.text.display}}>■</span> 24 of 22 Sep (H1–H6) · <span style={{color: color.text.tertiary}}>■</span> 67 of 24–25 Sep (H8–H17)
            </div>
          </div>
        );
      },
    },
    {
      id: 'c02-67-chips',
      from: wSixty.start,
      to: s4.end + 0.3,
      render: (t) => (
        <>
          <Chip t={t} at={wSixty.start + 0.5} exitAt={s4.end - 0.1} {...top(0)} repo="glassbox-lm" path="docs/results-overview.md" line="21-30" />
          <Chip t={t} at={wSixty.start + 1.0} exitAt={s4.end - 0.1} {...top(1)} repo="glassbox-lm" path={res} line={215} />
          <A3Note t={t} at={wSixty.start + 1.6} exitAt={s4.end - 0.1} />
        </>
      ),
    },
    {
      id: 'c02-equations',
      from: s5.start - 0.2,
      to: s5.end,
      render: (t) => <Equations t={t} at={s5.start + 0.1} meterAt={w('u0213', 'counting') - 0.6} exitAt={s5.end - 0.3} />,
    },
    {
      id: 'c02-eq-chips',
      from: s5.start,
      to: s5.end,
      render: (t) => (
        <>
          <Chip t={t} at={u12.start + 0.9} exitAt={s5.end - 0.3} {...top(0)} repo="glassbox-lm" path="studies/tm_language_model/docs/11-engine-spec.md" line="516-523" />
          <Chip t={t} at={u13.start + 0.2} exitAt={s5.end - 0.3} {...top(1)} repo="glassbox-lm" path={res} line={233} />
          <TypedChip t={t} at={u12.start + 1.6} exitAt={s5.end - 0.3} {...top(2)} kind="decision" text={GB.identity.decision} />
        </>
      ),
    },
    {
      id: 'c02-doc-labels',
      from: s6.start - 0.2,
      to: s6.end,
      render: (t) => <DocLabels t={t} at={s6.start + 0.3} gainsAt={w('u0214', 'learned') - 0.1} exitAt={s6.end - 0.3} gainQ={gainU.map((u) => at(t, u, 0.42 - 0.012))} />,
    },
    {
      id: 'c02-doc-chips',
      from: s6.start,
      to: s6.end,
      render: (t) => (
        <>
          <Chip t={t} at={s6.start + 0.8} exitAt={u14.start + 1.8} {...chip(1)} repo="glassbox-lm" path={res} line={233} />
          <Chip t={t} at={s6.start + 1.2} exitAt={u14.start + 1.8} {...chip(0)} repo="glassbox-lm" path="studies/tm_language_model/src/tmlm/cvtm/mixture.py" line="1-10" />
          <Chip t={t} at={u14.start + 2.0} exitAt={s6.end - 0.3} {...chip(1)} repo="glassbox-lm" path={res} line={221} />
          <Chip t={t} at={u14.start + 3.0} exitAt={s6.end - 0.3} {...chip(0)} repo="glassbox-lm" path={res} line={223} />
        </>
      ),
    },
  ];

  // the copy pointer arcs back to the longest earlier repeat
  const world: TimedNode[] = [
    {
      id: 'c02-pointer',
      from: s6.start + 0.6,
      to: s6.end,
      render: () => {
        const [ax, ay] = wxy(board, 0.56, 0.575);
        const [bx2, by2] = wxy(board, 0.3, 0.63);
        return (
          <Streams
            curves={[{curve: {kind: 'arc', from: [ax, ay, 0.02], to: [bx2, by2, 0.02], bend: [0, 0.025, 0.035]}, from: s6.start + 0.8, to: s6.end - 0.3, drawOnS: 1.2, fadeS: 0.4, speed: 0.45, every: 0.4, packetLength: 0.05, radius: 0.0022, intensity: 2.2, bloom: 0.8, reverse: false, line: {width: 1.3, intensity: 0.45, color: color.accent.mintLabel}}]}
          />
        );
      },
    },
  ];

  const pixie: PixieCue[] = [
    {frame: f(s4.start + 0.2), activity: 'reading', detail: `Read results.md (run ${A.run})`},
    {frame: f(wTriggered.start), activity: 'error', detail: `${A.tm} against ${A.kn5} bits per byte`},
    {frame: f(u11.start + 0.3), activity: 'writing', detail: 'Edit amendments A3–A10: 67 new hypotheses'},
    {frame: f(s5.start + 0.1), activity: 'thinking', detail: 'Planning F19: votes from counts…'},
    {frame: f(u12.start + 0.3), activity: 'reading', detail: 'Read results.md:233 (282,587 positions)'},
    {frame: f(w('u0213', 'counting') - 0.4), activity: 'success', detail: '5.3e-15 < 1e-9 (H8.2 met)'},
    {frame: f(s6.start + 0.4), activity: 'searching', detail: 'Search the document for the longest repeat'},
  ];

  return {beats, camera, light, live, ripples, overlays, world, pixie};
};

/** The order of events on one strip: 24 registered, the run and its miss, then the 67. */
const TimeStrip: React.FC<{t: number; at: number}> = ({t, at}) => {
  const {height: H} = useVideoConfig();
  const hair = Math.max(1, Math.round(H / 1080));
  const marks: Array<[string, string, string]> = [
    ['22 Sep', '24 written', color.text.display],
    ['23 Sep', 'run · miss', color.text.secondary],
    ['24–25 Sep', '+67 written', color.accent.mint],
  ];
  return (
    <div style={{display: 'flex', marginTop: Math.round(H * 0.03), borderTop: `${hair}px solid rgba(228,234,231,0.3)`}}>
      {marks.map(([d, s, c], j) => (
        <div key={j} style={{flex: 1, paddingTop: Math.round(H * 0.008), opacity: easeOut(ramp(t, at + j * 0.35, 0.35))}}>
          <div style={{...monoStyle(H, MONO_MIN, c), textShadow: legible(H)}}>{d}</div>
          <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>{s}</div>
        </div>
      ))}
    </div>
  );
};

/** A3's own disclosure, verbatim in spirit and cited: exploratory runs seen before H8's thresholds. */
const A3Note: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.625), width: Math.round(W * 0.3), ...pull(k, H)}}>
      <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), whiteSpace: 'normal', lineHeight: 1.4, textShadow: legible(H)}}>A3 discloses the exploratory runs seen before the H8 thresholds were set</div>
    </div>
  );
};

/** The Kneser-Ney recursion and its vote form, the identity meter, and its honest caption. */
const Equations: React.FC<{t: number; at: number; meterAt: number; exitAt: number}> = ({t, at, meterAt, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.5, 0.35);
  if (k <= 0.001) return null;
  const eq: React.CSSProperties = {fontFamily: font.serif, fontSize: Math.round(H * 0.044), color: color.text.display, whiteSpace: 'pre', textShadow: legible(H)};
  const i: React.CSSProperties = {fontStyle: 'italic'};
  const sub: React.CSSProperties = {fontSize: '0.62em', verticalAlign: '-0.3em'};
  const k1 = easeOut(ramp(t, at, 0.6));
  const k2 = easeOut(ramp(t, at + 1.4, 0.6));
  const mk = easeOut(ramp(t, meterAt, 0.6));
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.215), opacity: k1}}>
        <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.text.tertiary}}>Kneser-Ney, the recursion</div>
        <div style={{...eq, marginTop: Math.round(H * 0.012)}}>
          <span style={i}>p</span>
          <span style={sub}>k+1</span>(<span style={i}>w</span> | <span style={i}>u</span>) = α(<span style={i}>u</span>, <span style={i}>w</span>) + γ(<span style={i}>u</span>) <span style={i}>p</span>
          <span style={sub}>k</span>(<span style={i}>w</span> | <span style={i}>u′</span>)
        </div>
      </div>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.335), opacity: k2}}>
        <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel}}>the same, as clause votes</div>
        <div style={{...eq, marginTop: Math.round(H * 0.012)}}>
          ln <span style={i}>P</span>
          <span style={sub}>KN</span>(<span style={i}>w</span> | <span style={i}>h</span>) = <span style={i}>b</span>(<span style={i}>w</span>) + Σ<span style={sub}>fired</span> [ <span style={i}>d</span>(<span style={i}>u</span>) + <span style={i}>v</span>(<span style={i}>u</span>, <span style={i}>w</span>) ]
        </div>
      </div>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.585), opacity: mk}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: Math.round(H * 0.02)}}>
          <span style={{...monoStyle(H, 0.03, color.text.display)}}>max |Δ ln P| =</span>
          <span style={{fontFamily: font.sans, fontWeight: 680, fontSize: Math.round(H * 0.06), color: color.accent.mint, letterSpacing: '-0.02em'}}>
            5.3 × 10<sup style={{fontSize: '0.55em'}}>−15</sup>
          </span>
        </div>
        <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.004)}}>threshold 10<sup>−9</sup> · 282,587 validation positions · pin rows a schematic</div>
      </div>
      <div style={{position: 'absolute', right: Math.round(W * 0.038), top: Math.round(H * 0.6), padding: `${Math.round(H * 0.008)}px ${Math.round(H * 0.016)}px`, borderRadius: Math.round(H * 0.01), background: 'rgba(40,44,43,0.85)', opacity: easeOut(ramp(t, meterAt + 0.8, 0.5))}}>
        <span style={{...monoStyle(H, MONO_MIN, color.text.display)}}>counting written as votes · not Tsetlin learning</span>
      </div>
    </div>
  );
};

/** 02.6: the document's clauses and pointer, what the whole document buys, and what learning adds. */
const DocLabels: React.FC<{t: number; at: number; gainsAt: number; exitAt: number; gainQ: Array<{x: number; y: number}>}> = ({t, at, gainsAt, exitAt, gainQ}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.45, 0.35);
  if (k <= 0.001) return null;
  const D = GB.document;
  const gk = easeOut(ramp(t, gainsAt, 0.5));
  return (
    <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.085), width: Math.round(W * 0.86)}}>
        <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>document clauses D0–D4 + copy pointer</div>
        <div style={{...bodyStyle(H, 0.04, 650), marginTop: Math.round(H * 0.01), letterSpacing: '-0.02em', textShadow: legible(H)}}>
          {D.bpbFrom} → {D.bpbTo} <span style={{...bodyStyle(H, 0.028, 500, color.text.secondary)}}>bits per byte · validation · the whole document as context</span>
        </div>
        <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}>
          {fmtInt(D.ns16)} ns per token at a window of 16 · {fmtInt(D.ns65536)} ns at 65,536
        </div>
      </div>
      {gk > 0.001 ? (
        <div style={{opacity: gk}}>
          {gainQ.map((q, j) => (
            <div key={j} style={{position: 'absolute', left: Math.round(q.x - H * 0.07), width: Math.round(H * 0.14), top: Math.round(q.y), textAlign: 'center', ...monoStyle(H, MONO_MIN, color.text.display), textShadow: legible(H)}}>
              {D.gains[j].toFixed(4)}
              <div style={{color: color.text.tertiary}}>{D.gainAtM[j]}M</div>
            </div>
          ))}
          <div style={{position: 'absolute', left: Math.round(W * 0.6), top: Math.round(H * 0.25), width: Math.round(W * 0.33)}}>
            <div style={{...bodyStyle(H, 0.03, 500), whiteSpace: 'normal', textShadow: legible(H)}}>
              learned clauses' gain in the mixture shrinks as the counts grow
            </div>
            <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}>bits per byte · derived, exploratory</div>
            <div style={{...bodyStyle(H, 0.034, 650), marginTop: Math.round(H * 0.022), textShadow: legible(H)}}>
              +{D.overBest.toFixed(4)} <span style={{...bodyStyle(H, 0.028, 500, color.text.secondary)}}>over the best row without them</span>
            </div>
            <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.006), textShadow: legible(H)}}>derived, exploratory</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
