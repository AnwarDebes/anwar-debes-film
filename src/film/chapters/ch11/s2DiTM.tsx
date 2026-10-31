import React from 'react';
import {random, useVideoConfig} from 'remotion';
import {SWEEPS, barsField, emblemField, rectField, type Beat, type FieldFn} from '../../../engine/pins';
import {pushIn, type CameraKey, type CameraPose} from '../../../engine/camera';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import {snippets} from '../../../data/ch11/code';
import trajectory from '../../../data/ch11/ditm-trajectory.json';
import type {PartSpec} from '../ch07/kit/spec';
import {screenAtUv} from '../ch07/kit/frame';
import {Card, Cite, MissDot, NamePlate, mono, pullK, pullStyle} from '../ch07/kit/ui';
import {DARK, DIM, MINT, PLATE, STEEL_FLAT, bed, grid, low, on, raised, tilePx, type GridSpec} from './plate';
import {GENERIC, rightPose} from './s0Plate';
import type {Times11} from './times';

// 11.2 DiTM: the plate becomes a generator. Forward, the input row flips toward noise step by step
// on DiTM's own schedule; reverse, six rows crystallise out of noise in eight steps (read from the
// paper's figure of a real sampling run); then the sensor pairs, the AUC, and the honest frame.

const SAMPLES = (trajectory as unknown as {samples: number[][][]}).samples; // [6][9][8]
const ROWS6: GridSpec = {cols: 8, rows: 6};

/**
 * DiTM's linear schedule (ditm/forward.py:44-61) with the model's own settings (ditm/model.py:39-40,
 * beta 0.005 to 0.30) over the 8 steps of the paper's trajectory run: flip probability after t steps.
 */
export const betaBar = (t: number, T = 8, bMin = 0.005, bMax = 0.3) => {
  let ab = 1;
  for (let k = 1; k <= t; k++) {
    const beta = bMin + ((bMax - bMin) * (k - 1)) / (T - 1);
    ab *= 1 - 2 * beta;
  }
  return (1 - ab) / 2;
};

const X0 = SAMPLES[5][8];

/** The input row (bottom row of the plate) after t forward steps (seeded corruption). */
const corrupted = (t: number): number[] => X0.map((b, i) => (random(`ditm-forward-${i}-${t}`) < betaBar(t) ? 1 - b : b));

const bitLook = (b: number) => (b ? on(0.55) : {h: 0.05, tint: [0.46, 0.47, 0.47] as [number, number, number]});

export const scene1102 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {t2} = T;
  const pr = rightPose(ctx);
  const dimClauses = (c: number, r: number) => (r < 4 ? low() : null);
  const withRow = (bits: number[]): FieldFn => grid(board, GENERIC, (c, r) => (r < 4 ? dimClauses(c, r) : r === 5 ? bitLook(bits[c]) : null), bed(board, GENERIC));

  // the DiTM emblem first (a boolean grid diffusing into noise, left to right), then the plate
  const emblem = emblemField(board, 'ditm', {u: PLATE[0], v: PLATE[1], height: 46}, {ground: 0.9, height: 0.55});
  const beats: Beat[] = [
    {id: 'c11-ditm-emblem', at: t2.place, field: emblem, sweep: SWEEPS.from(PLATE, 1.0, 0.04)},
    {id: 'c11-ditm', at: Math.min(t2.flips - 0.6, t2.generator + 0.3), field: withRow(X0), sweep: SWEEPS.from(PLATE, 1.1, 0.04)},
  ];
  // forward: eight steps of DiTM's schedule on the bottom row
  const fwdStep = Math.min(0.42, Math.max(0.25, (t2.noise - 0.3 - t2.flips) / 8));
  for (let s = 1; s <= 8; s++) beats.push({id: `c11-ditm-fwd-${s}`, at: t2.flips + (s - 1) * fwdStep, field: withRow(corrupted(s)), sweep: {...SWEEPS.raster([1, 0], 3.0), jitterS: 0.02}});
  // reverse: six samples, nine states from noise (t = 8) to the sample (t = 0), as the figure shows them
  const revFrom = t2.noise;
  const revStep = Math.max(0.3, (t2.stepsEnd + 0.3 - revFrom) / 8);
  for (let s = 0; s <= 8; s++) {
    beats.push({
      id: `c11-ditm-rev-${s}`,
      at: revFrom + s * revStep,
      field: grid(board, ROWS6, (c, r) => bitLook(SAMPLES[r][s][c]), bed(board, ROWS6)),
      sweep: s === 0 ? SWEEPS.from(PLATE, 1.2, 0.04) : {...SWEEPS.raster([1, 0], 2.6), jitterS: 0.02},
    });
  }
  // sensors: four pairs that move together; one pair breaks
  const PAIRS: GridSpec = {cols: 4, rows: 2, cell: 9, gap: 1.8};
  const pairs = (k: number, broken: boolean): FieldFn => {
    const vals = [0, 1, 2, 3].map((p) => (random(`ditm-sensor-${p}-${k}`) < 0.5 ? 0 : 1));
    return grid(
      board,
      PAIRS,
      (c, r) => {
        const b = broken && c === 2 && r === 1 ? 1 - vals[c] : vals[c];
        const look = bitLook(b);
        return broken && c === 2 ? {...look, h: 0.14, tint: [1.0, 0.8, 0.38] as [number, number, number], glow: 0} : look;
      },
      bed(board, PAIRS),
    );
  };
  const sensorStep = Math.max(0.5, (t2.broken - t2.sensors) / 4);
  for (let k = 0; k < 4; k++) beats.push({id: `c11-ditm-pairs-${k}`, at: t2.sensors + k * sensorStep, field: pairs(k, false), sweep: k === 0 ? SWEEPS.from(PLATE, 1.2, 0.04) : undefined});
  beats.push({id: 'c11-ditm-broken', at: t2.broken, field: pairs(4, true)});
  // the AUC: two bars, DiTM against naive Bayes
  const aucBed = rectField(board, {u: PLATE[0], v: PLATE[1], w: 36, h: 42, radius: 2.5}, {h: 0.03, tint: [0.3, 0.31, 0.31]});
  const auc = barsField(board, {u: PLATE[0], v: PLATE[1], width: 30, height: 36, values: [0.677, 0.58], gap: 6}, {
    ground: aucBed,
    looks: (k, v) => (k === 0 ? {h: 0.16 + 0.3 * v, tint: MINT, glow: 0.45} : {h: 0.16 + 0.3 * v, tint: [1.0, 1.0, 0.98]}),
  });
  beats.push({id: 'c11-ditm-auc', at: t2.auc - 0.2, field: auc, sweep: {...SWEEPS.raster([0, 1], 1.2, [PLATE[0], PLATE[1] - 0.2]), tintFollowsWave: true}});

  const camera: CameraKey[] = [
    {at: t2.place - 0.2, dur: 1.4, pose: pr, ease: 'camera'},
    {at: t2.place + 1.2, dur: Math.max(1, t2.out - t2.place - 1.2), pose: pushIn(pr, 0.04), ease: 'inOutSine'},
  ];

  const x = Math.round(W * layout.marginLeftW);
  const pages: CodePage[] = [
    {
      at: t2.perFeature - 0.2,
      source: {snippet: snippets['ditm-tm'], lines: [53, 59]},
      dedent: 4,
      zoom: 0.87,
      width: Math.round(W * 0.38),
      header: {label: 'DiTM', path: 'ditm/tm.py', meta: '53-59'},
      cues: [cue.reveal(t2.perFeature - 0.1, {stagger: 0.05}), cue.highlight(t2.guess, 59, {until: t2.noise})],
    },
  ];
  const overlays: TimedNode[] = [
    {id: 'c11-ditm-plate', from: t2.plate, to: t2.out + 0.5, render: (t) => <NamePlate t={t} at={t2.plate} out={t2.out} repo="DiTM" status="RESEARCH PROTOTYPE v0.1 · SYNTHETIC · PURE NUMPY" />},
    {id: 'c11-ditm-code', from: t2.perFeature - 0.3, to: t2.noise + 0.6, render: (t) => <CodePanel pages={pages} x={x} y={Math.round(0.2 * H)} anchor="top-left" t={t} enter={{at: t2.perFeature - 0.2, dur: 0.5}} exit={{at: t2.noise, dur: 0.45}} />},
    {id: 'c11-ditm-labels', from: t2.flips - 0.2, to: t2.out + 0.5, render: (t) => <DitmLabels t={t} T={T} ctx={ctx} pose={pr} fwdStep={fwdStep} revStep={revStep} />},
    {id: 'c11-ditm-cards', from: t2.sensors, to: t2.out + 0.5, render: (t) => <DitmCards t={t} T={T} />},
  ];
  return {beats, camera, overlays};
};

const DitmLabels: React.FC<{t: number; T: Times11; ctx: FilmCtx; pose: CameraPose; fwdStep: number; revStep: number}> = ({t, T, ctx, pose, fwdStep, revStep}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t2} = T;
  const x = Math.round(W * layout.marginLeftW);
  const [, rowY] = tilePx(ctx.board, pose, GENERIC, 0, 5, W, H);
  const [lx] = tilePx(ctx.board, pose, GENERIC, 0, 5, W, H);
  const [rx] = tilePx(ctx.board, pose, GENERIC, 7, 5, W, H);
  const step = Math.max(0, Math.min(8, Math.floor((t - t2.flips) / fwdStep) + 1));
  const kf = pullK(t, t2.flips, t2.noise - 0.2);
  const kr = pullK(t, t2.noise, t2.sensors - 0.2);
  const rstep = Math.max(0, Math.min(8, Math.floor((t - t2.noise) / revStep)));
  const kp = pullK(t, t2.perFeature, t2.noise - 0.1);
  const lab: React.CSSProperties = {...mono(H, Ty.monoKicker.size, 500), color: color.text.secondary, whiteSpace: 'nowrap'};
  return (
    <>
      {kf > 0 ? (
        <div style={{position: 'absolute', left: Math.round((lx + rx) / 2), top: Math.round(rowY + 0.062 * H), transform: 'translateX(-50%)', ...pullStyle(kf, H), ...lab}}>
          {`forward step ${step} of 8 · each bit flips with p = ${betaBar(step).toFixed(3)}`}
        </div>
      ) : null}
      {kp > 0 ? (
        <div style={{position: 'absolute', left: x, top: Math.round(0.585 * H), width: Math.round(0.36 * W), ...pullStyle(kp, H), ...mono(H, 0.026, 500), whiteSpace: 'normal', lineHeight: 1.4, color: color.text.display}}>
          {'one Tsetlin Machine per feature · p = 0.5 + 0.5 v / T'}
        </div>
      ) : null}
      {kr > 0 ? (
        <div style={{position: 'absolute', left: Math.round((lx + rx) / 2), top: Math.round(rowY + 0.062 * H), transform: 'translateX(-50%)', ...pullStyle(kr, H), ...lab}}>
          {`noise → 8 steps → sample · step ${8 - rstep}`}
        </div>
      ) : null}
      {kr > 0 ? (
        <div style={{position: 'absolute', left: x, top: Math.round(0.36 * H), ...pullStyle(kr, H), width: Math.round(W * 0.36)}}>
          <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.signal.amber}}>{'read from figure'}</div>
          <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.008 * H), whiteSpace: 'normal', lineHeight: 1.45}}>
            {'six samples of a trained DiTM, real model output, re-created bit for bit from the paper figure'}
          </div>
        </div>
      ) : null}
      <AucLabels t={t} T={T} ctx={ctx} pose={pose} />
      <Cite t={t} repo="DiTM" path="ditm/forward.py" line="44-91" at={t2.flips + 0.3} out={t2.perFeature - 0.3} x={x} y={Math.round(0.545 * H)} />
      <Cite t={t} repo="DiTM" path="ditm/model.py" line="39-40" at={t2.flips + 0.6} out={t2.perFeature - 0.3} x={x} y={Math.round(0.59 * H)} />
      <Cite t={t} repo="DiTM" path="ditm/tm.py" line="53-59" at={t2.guess} out={t2.noise - 0.2} x={x} y={Math.round(0.7 * H)} />
      <Cite t={t} repo="DiTM" path="paper/figures/trajectory.png" at={t2.noise + 0.4} out={t2.sensors - 0.2} x={x} y={Math.round(0.545 * H)} />
    </>
  );
};

const AucLabels: React.FC<{t: number; T: Times11; ctx: FilmCtx; pose: CameraPose}> = ({t, T, ctx, pose}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t2} = T;
  const k = pullK(t, T.t2.auc + 0.1, t2.out);
  if (k <= 0) return null;
  const {board} = ctx;
  const base = PLATE[1] - (18 * board.p) / board.extH;
  const bars: Array<[string, string, number, string]> = [
    ['DiTM', '0.677', -7.5, color.accent.mint],
    ['naive Bayes', '0.580', 7.5, color.text.display],
  ];
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      {bars.map(([name, val, dx, tone]) => {
        const [bx, by] = screenAtUv(board, pose, PLATE[0] + dx * board.p, base, W, H);
        return (
          <div key={name} style={{position: 'absolute', left: Math.round(bx), top: Math.round(by + 0.03 * H), transform: 'translateX(-50%)', textAlign: 'center', textShadow: '0 1px 6px rgba(5,8,7,0.9)'}}>
            <div style={{...mono(H, 0.026, 600), color: tone}}>{val}</div>
            <div style={{...mono(H, Ty.monoKicker.size, 500), color: color.text.chipDim}}>{name}</div>
          </div>
        );
      })}
    </div>
  );
};

const DitmCards: React.FC<{t: number; T: Times11}> = ({t, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t2} = T;
  const x = Math.round(W * layout.marginLeftW);
  const w = Math.round(W * 0.36);
  // the anomaly meter rises once a pair breaks
  const meter = easeOutCubic(prog(t, t2.broken + 0.1, 0.9));
  const ks = pullK(t, t2.sensors + 0.2, t2.readme - 0.2);
  const kh = pullK(t, t2.readme - 0.1, t2.out);
  return (
    <>
      {ks > 0 ? (
        <div style={{position: 'absolute', left: x, top: Math.round(0.24 * H), width: w, ...pullStyle(ks, H)}}>
          <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.accent.mintLabel}}>{'four sensor pairs · one breaks'}</div>
          <div style={{marginTop: Math.round(0.016 * H), height: Math.round(0.018 * H), borderRadius: 99, background: 'rgba(228,234,231,0.08)', border: `1px solid ${color.card.rule}`, overflow: 'hidden'}}>
            <div style={{width: `${(6 + 70 * meter).toFixed(1)}%`, height: '100%', background: color.signal.amber, opacity: 0.85}} />
          </div>
          <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.008 * H)}}>{'anomaly score (denoising likelihood)'}</div>
          <div style={{marginTop: Math.round(0.03 * H), opacity: easeOutCubic(prog(t, t2.auc, 0.4))}}>
            <div style={{...mono(H, 0.03, 600), color: color.text.key}}>
              {'anomaly AUC '}
              <span style={{color: color.accent.mint}}>{'0.677'}</span>
            </div>
            <div style={{...mono(H, 0.026, 500), color: color.text.chipDim, marginTop: Math.round(0.006 * H)}}>{'naive Bayes 0.580 · 3 seeds · synthetic 8-bit'}</div>
          </div>
        </div>
      ) : null}
      <Cite t={t} repo="DiTM" path="results/anomaly.json" line="summary" at={t2.auc + 0.3} out={t2.readme - 0.2} x={x} y={Math.round(0.6 * H)} />
      {kh > 0 ? (
        <Card t={t} at={t2.readme - 0.1} out={t2.out} x={x} y={Math.round(0.235 * H)} w={w} label="the honest frame" labelTone={color.text.secondary}>
          <div style={{...mono(H, 0.026, 500), color: color.text.display}}>
            {'marginal TV '}
            <span style={{color: color.text.key, fontWeight: 600}}>{'0.536'}</span>
          </div>
          <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.006 * H)}}>{'the training data itself: 0.029'}</div>
          <div style={{...mono(H, 0.024, 450), color: color.text.caption, marginTop: Math.round(0.016 * H), whiteSpace: 'normal', lineHeight: 1.4}}>{'“Absolute probability calibration is loose”'}</div>
          <div style={{display: 'flex', gap: Math.round(0.012 * H), alignItems: 'flex-start', marginTop: Math.round(0.016 * H), opacity: easeOutCubic(prog(t, t2.imputation, 0.4))}}>
            <span style={{marginTop: Math.round(0.006 * H)}}>
              <MissDot H={H} />
            </span>
            <span style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, whiteSpace: 'normal', lineHeight: 1.4}}>{'imputation: tested on rows drawn from the training set'}</span>
          </div>
        </Card>
      ) : null}
      <Cite t={t} repo="DiTM" path="results/generation.json" line="47-54" at={t2.readme + 0.2} out={t2.out} x={x} y={Math.round(0.6 * H)} />
      <Cite t={t} repo="DiTM" path="README.md" line="79-81" at={t2.loose} out={t2.out} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="DiTM" path="experiments/imputation.py" line={55} at={t2.imputation + 0.2} out={t2.out} x={x} y={Math.round(0.69 * H)} />
    </>
  );
};

void DIM;
void raised;
