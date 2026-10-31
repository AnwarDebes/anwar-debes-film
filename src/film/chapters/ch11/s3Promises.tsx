import React from 'react';
import {random, useVideoConfig} from 'remotion';
import {SWEEPS, barsField, hash01, overField, rectField, type Beat, type FieldFn, type LiveLayer} from '../../../engine/pins';
import {pushIn, type CameraKey, type CameraPose} from '../../../engine/camera';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeInOutCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import type {PartSpec} from '../ch07/kit/spec';
import {screenAtUv} from '../ch07/kit/frame';
import {Cite, MissDot, NamePlate, WinDot, mono, pullK, pullStyle} from '../ch07/kit/ui';
import {DARK, MINT, PLATE, STEEL_FLAT, bed, grid, gridCentre, low, on, tilePx, type GridSpec} from './plate';
import {rightPose} from './s0Plate';
import type {Times11} from './times';

// 11.3 ConfTM (cover), 11.4 RobTM (certify), 11.5 CCTM (pair), 11.6 FedTM (federate): the same
// plate, reconfigured in place for each promise; every number with the file it comes from.

const lab = (H: number): React.CSSProperties => ({...mono(H, Ty.monoKicker.size, 500), color: color.text.secondary, whiteSpace: 'nowrap'});
const kick = (H: number, tone: string = color.accent.mintLabel): React.CSSProperties => ({...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: tone});

// ------------------------------------------------------------------ ConfTM
const LABELS = ['Low', 'Moderate', 'High', 'Critical'];
const SET: GridSpec = {cols: 4, rows: 1, cell: 12, gap: 2.4};
const CHART = {w: 62, h: 34};

/** Coverage over the stream (schematic path; the end values are the repository's means). */
const covAt = (which: 'static' | 'aci', x: number) => {
  if (which === 'aci') return 0.9 + 0.004 * Math.sin(x * 23) * (x > 0.5 ? 1 : 0.5);
  if (x < 0.5) return 0.9 + 0.003 * Math.sin(x * 19);
  const k = easeInOutCubic(Math.min(1, (x - 0.5) / 0.25));
  return 0.9 + (0.8358 - 0.9) * k + 0.003 * Math.sin(x * 17);
};

export const scene1103 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {t3} = T;
  const pr = rightPose(ctx);
  const setField = (lit: boolean): FieldFn => grid(board, SET, (c) => (lit && c >= 2 ? on(0.6) : {h: 0.08, tint: [0.7, 0.71, 0.71]}), bed(board, SET));
  const [cu, cv] = PLATE;
  const chartBed = rectField(board, {u: cu, v: cv, w: CHART.w + 4, h: CHART.h + 4, radius: 2}, {h: 0.04, tint: [0.55, 0.56, 0.56]});
  const yOf = (c: number) => cv + ((-CHART.h / 2 + ((c - 0.8) / 0.15) * CHART.h) * board.p) / board.extH;
  const target = rectField(board, {u: cu, v: yOf(0.9), w: CHART.w, h: 0.6}, {h: 0.06, tint: [0.75, 0.76, 0.76], ground: chartBed});
  const beats: Beat[] = [
    {id: 'c11-conf', at: t3.place, field: setField(false), sweep: SWEEPS.from(PLATE, 1.0, 0.04)},
    {id: 'c11-conf-set', at: t3.set, field: setField(true), sweep: {...SWEEPS.raster([1, 0], 2.0), tintFollowsWave: true}},
    {id: 'c11-conf-chart', at: t3.stream, field: target, sweep: SWEEPS.from(PLATE, 1.1, 0.04)},
  ];
  // the two coverage lines draw on as the stream runs
  const x0 = cu - (CHART.w / 2) * board.p;
  const span = CHART.w * board.p;
  const drawFrom = t3.stream + 0.3;
  const drawTo = Math.max(drawFrom + 2, t3.ninety);
  const rowTol = (0.75 * board.rowH) / board.extH;
  const aciPin = {h: 0.12, tint: MINT, glow: 0.7};
  const staticPin = {h: 0.1, tint: [1.0, 1.0, 0.98] as [number, number, number], glow: 0};
  const line: LiveLayer = {
    fn: (u, v, _i, t) => {
      const x = (u - x0) / span;
      if (x < 0 || x > 1) return null;
      const head = prog(t, drawFrom, drawTo - drawFrom);
      if (x > head) return null;
      const dA = Math.abs(v - yOf(covAt('aci', x)));
      const dS = Math.abs(v - yOf(covAt('static', x)));
      if (dA < rowTol) return aciPin;
      if (dS < rowTol) return staticPin;
      return null;
    },
    from: drawFrom - 0.1,
    to: t3.out + 0.3,
    fadeS: 0.3,
    region: [x0 - 0.01, yOf(0.8) - 0.01, x0 + span + 0.01, yOf(0.95) + 0.01],
  };
  const camera: CameraKey[] = [{at: t3.place, dur: Math.max(1, t3.out - t3.place), pose: pushIn(pr, 0.035), ease: 'inOutSine'}];
  const x = Math.round(W * layout.marginLeftW);
  const overlays: TimedNode[] = [
    {id: 'c11-conf-plate', from: t3.plate, to: t3.out + 0.5, render: (t) => <NamePlate t={t} at={t3.plate} out={t3.out} repo="ConfTM" status="RESEARCH PROTOTYPE v0.1.0 · SYNTHETIC" />},
    {
      id: 'c11-conf-labels',
      from: t3.place,
      to: t3.out + 0.5,
      render: (t) => {
        const kSet = pullK(t, t3.set, t3.stream - 0.1);
        const kChart = pullK(t, t3.stream + 0.2, t3.out);
        const head = prog(t, drawFrom, drawTo - drawFrom);
        const [ex, ey] = screenAtUv(board, pr, x0 + span, yOf(0.9), W, H);
        const [, sy] = screenAtUv(board, pr, x0 + span, yOf(0.8358), W, H);
        const [mx, my] = screenAtUv(board, pr, x0 + span * 0.5, yOf(0.95), W, H);
        const [, by] = screenAtUv(board, pr, x0, yOf(0.8), W, H);
        return (
          <>
            {kSet > 0
              ? LABELS.map((l, c) => {
                  const [lx, ly] = tilePx(board, pr, SET, c, 0, W, H);
                  return (
                    <div key={l} style={{position: 'absolute', left: Math.round(lx), top: Math.round(ly + 0.05 * H), transform: 'translateX(-50%)', ...pullStyle(kSet, H), ...lab(H), color: c >= 2 && t >= t3.set ? color.accent.mint : color.text.secondary}}>
                      {l}
                    </div>
                  );
                })
              : null}
            {kSet > 0 ? (
              <div style={{position: 'absolute', left: x, top: Math.round(0.26 * H), ...pullStyle(kSet, H)}}>
                <div style={kick(H)}>{'a set of labels · target 90%'}</div>
                <div style={{...mono(H, 0.026, 500), color: color.text.display, marginTop: Math.round(0.012 * H)}}>{'{ High, Critical }'}</div>
                <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.006 * H)}}>{'should contain the true risk level 9 times in 10'}</div>
              </div>
            ) : null}
            {kChart > 0 ? (
              <div style={{position: 'absolute', inset: 0, ...pullStyle(kChart, H)}}>
                <div style={{position: 'absolute', left: Math.round(mx), top: Math.round(my - 0.045 * H), transform: 'translateX(-50%)', ...lab(H), opacity: easeOutCubic(prog(t, t3.change - 0.2, 0.4))}}>{'drift: chest_pain 0.10 → 0.30'}</div>
                <div style={{position: 'absolute', left: Math.round(mx), top: Math.round(my - 0.012 * H), width: 2, height: Math.round(by - my + 0.012 * H), background: 'rgba(251,191,36,0.55)', opacity: easeOutCubic(prog(t, t3.change - 0.2, 0.4))}} />
                {head > 0.97 ? (
                  <>
                    <div style={{position: 'absolute', left: Math.round(ex + 0.012 * H), top: Math.round(ey - 0.018 * H), ...mono(H, 0.026, 600), color: color.accent.mint}}>{'0.900'}</div>
                    <div style={{position: 'absolute', left: Math.round(ex + 0.012 * H), top: Math.round(sy - 0.012 * H), ...mono(H, 0.026, 600), color: color.text.display}}>{'0.836'}</div>
                  </>
                ) : null}
                <div style={{position: 'absolute', left: x, top: Math.round(0.26 * H)}}>
                  <div style={kick(H)}>{'coverage over the stream'}</div>
                  <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H), marginTop: Math.round(0.016 * H)}}>
                    <span style={{width: Math.round(0.04 * H), height: 3, background: color.text.display}} />
                    <span style={{...mono(H, 0.026, 500), color: color.text.display}}>{'static threshold'}</span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H), marginTop: Math.round(0.01 * H)}}>
                    <span style={{width: Math.round(0.04 * H), height: 3, background: color.accent.mint}} />
                    <span style={{...mono(H, 0.026, 500), color: color.accent.mint}}>{'adaptive (ACI)'}</span>
                  </div>
                  <div style={{...mono(H, 0.026, 500), color: color.text.key, marginTop: Math.round(0.03 * H), opacity: easeOutCubic(prog(t, t3.eightyFour - 0.1, 0.4))}}>
                    {'after drift: static 0.836 · adaptive 0.900'}
                  </div>
                  <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.signal.amber, marginTop: Math.round(0.012 * H)}}>{'schematic path · end values: means of 3 seeds'}</div>
                </div>
              </div>
            ) : null}
            <Cite t={t} repo="ConfTM" path="conftm/conformal.py" line="63-85" at={t3.set + 0.3} out={t3.stream} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="ConfTM" path="conftm/data.py" line="80, 103-107" at={t3.change + 0.2} out={t3.out} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="ConfTM" path="results/drift.json" line="18050-18054" at={t3.eightyFour + 0.2} out={t3.out} x={x} y={Math.round(0.645 * H)} />
            <Cite t={t} repo="ConfTM" path="README.md" line={84} at={t3.ninety} out={t3.out} x={x} y={Math.round(0.69 * H)} />
          </>
        );
      },
    },
  ];
  return {beats, live: [line], camera, overlays};
};

// ------------------------------------------------------------------ RobTM
const ROB: GridSpec = {cols: 24, rows: 12, cell: 2.2, gap: 0.55};
const SURVIVOR = 134;

export const scene1104 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {t4} = T;
  const pr = rightPose(ctx);
  const idx = (c: number, r: number) => r * ROB.cols + c;
  const all = grid(board, ROB, (c, r) => (idx(c, r) < 277 ? {h: 0.12, tint: MINT, glow: 0.5} : null), bed(board, ROB));
  const fallen = grid(board, ROB, (c, r) => {
    const k = idx(c, r);
    if (k >= 277) return null;
    return k === SURVIVOR ? {h: 0.26, tint: MINT, glow: 1} : {h: 0.0, tint: [0.34, 0.35, 0.35]};
  }, bed(board, ROB));
  const beats: Beat[] = [
    {id: 'c11-rob', at: t4.place, field: all, sweep: SWEEPS.from(PLATE, 1.0, 0.04)},
    // one flipped bit is enough for 276 of them; one holds to radius 2
    {id: 'c11-rob-fall', at: t4.single, field: fallen, sweep: {...SWEEPS.dissolve(0.55), tintLeadS: 0.08}},
  ];
  // the exact search: a scanning wave across the answers
  const [gu] = gridCentre(board, ROB);
  const w = ROB.cols * (ROB.cell ?? 2.2) * board.p;
  const scanFrom = t4.scan;
  const scanTo = Math.max(scanFrom + 1.5, t4.single - 0.3);
  const scanPin = {h: 0, tint: [0, 1, 0] as [number, number, number], glow: 0};
  const scan: LiveLayer = {
    fn: (u, _v, _i, t) => {
      const head = (t - scanFrom) / (scanTo - scanFrom);
      if (head < 0 || head > 1.05) return null;
      const x = (u - (gu - w / 2)) / w;
      const d = Math.abs(x - head * 1.1 + 0.05);
      if (d > 0.06) return null;
      const k = 1 - d / 0.06;
      scanPin.h = 0.12 + 0.08 * k;
      scanPin.tint[0] = 0.62 + 0.38 * k;
      scanPin.tint[2] = 0.86 + 0.14 * k;
      scanPin.glow = 0.5 + 0.5 * k;
      return scanPin;
    },
    from: scanFrom - 0.05,
    to: scanTo + 0.2,
    fadeS: 0.15,
    region: [gu - w / 2 - 0.01, PLATE[1] - 0.15, gu + w / 2 + 0.01, PLATE[1] + 0.15],
    mode: 'replace',
  };
  const camera: CameraKey[] = [{at: t4.place, dur: Math.max(1, t4.out - t4.place), pose: pushIn(pr, 0.03), ease: 'inOutSine'}];
  const x = Math.round(W * layout.marginLeftW);
  const [svx, svy] = tilePx(board, pr, ROB, SURVIVOR % ROB.cols, Math.floor(SURVIVOR / ROB.cols), W, H);
  const overlays: TimedNode[] = [
    {id: 'c11-rob-plate', from: t4.plate, to: t4.out + 0.5, render: (t) => <NamePlate t={t} at={t4.plate} out={t4.out} repo="RobTM" status="RESEARCH PROTOTYPE v0.1.0 · SYNTHETIC · NEGATIVE ROBUSTNESS" />},
    {
      id: 'c11-rob-labels',
      from: t4.place,
      to: t4.out + 0.5,
      render: (t) => {
        const k = pullK(t, t4.place + 0.4, t4.out);
        const n = Math.round(175 * easeOutCubic(prog(t, scanFrom, scanTo - scanFrom)));
        const kFall = pullK(t, t4.single + 0.3, t4.out);
        return (
          <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
            <div style={{position: 'absolute', left: x, top: Math.round(0.26 * H)}}>
              <div style={kick(H)}>{'277 correct answers'}</div>
              <div style={{...mono(H, 0.026, 500), color: color.text.display, marginTop: Math.round(0.012 * H)}}>{'exact flip-distance certificate'}</div>
              <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.008 * H), fontVariantNumeric: 'tabular-nums'}}>
                {`subsets of up to 3 flipped inputs: ${n} of 175`}
              </div>
              <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.tertiary, marginTop: Math.round(0.004 * H)}}>{'10 features: 10 + 45 + 120'}</div>
              {kFall > 0 ? (
                <div style={{display: 'flex', alignItems: 'flex-start', gap: Math.round(0.012 * H), marginTop: Math.round(0.03 * H), opacity: kFall, width: Math.round(0.33 * W)}}>
                  <span style={{marginTop: Math.round(0.007 * H)}}>
                    <MissDot H={H} />
                  </span>
                  <span style={{...mono(H, 0.026, 600), color: color.text.display, whiteSpace: 'normal', lineHeight: 1.4}}>{'276 of 277 correct answers: certified radius 1'}</span>
                </div>
              ) : null}
            </div>
            {kFall > 0 ? (
              <div style={{position: 'absolute', left: Math.round(svx), top: Math.round(svy - 0.06 * H), transform: 'translateX(-50%)', opacity: kFall, ...mono(H, Ty.monoKicker.size, 500), color: color.accent.mint}}>{'radius 2'}</div>
            ) : null}
            <Cite t={t} repo="RobTM" path="robtm/verify.py" line="1-11" at={t4.plate + 0.4} out={t4.scan} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="RobTM" path="paper/robtm.tex" line={78} at={t4.scan + 0.3} out={t4.single} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="RobTM" path="results/certified_radius.json" line="103-106" at={t4.single + 0.4} out={t4.out} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="RobTM" path="README.md" line={89} at={t4.single + 0.7} out={t4.out} x={x} y={Math.round(0.645 * H)} />
          </div>
        );
      },
    },
  ];
  return {beats, live: [scan], camera, overlays};
};

// ------------------------------------------------------------------ CCTM
const PAIR: GridSpec = {cols: 8, rows: 2, cell: 7.2, gap: 1.4, dy: 9};
const GAP_FULL = 40;
const APPLICANT = [1, 0, 1, 1, 0, 1, 0, 1];

export const scene1105 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {t5} = T;
  const pr = rightPose(ctx);
  const bit = (b: number, flag: boolean) => (b ? {...on(flag ? 0.9 : 0.45), tint: flag ? ([1.0, 0.86, 0.5] as [number, number, number]) : MINT} : {h: 0.05, tint: DARK});
  const pairField = (twin: boolean, gaps = 0): FieldFn => {
    const rows = grid(board, PAIR, (c, r) => (r === 0 ? bit(APPLICANT[c], c === 0) : twin ? bit(c === 0 ? 1 - APPLICANT[c] : APPLICANT[c], c === 0) : null), bed(board, PAIR));
    if (!gaps) return rows;
    // the parity gap, as horizontal bars from one baseline: 0.181, then 0.041, then 0.019
    const [gu, gv] = gridCentre(board, {cols: 1, rows: 1, dy: -18});
    const full = GAP_FULL;
    const vals = [0.181, 0.041, 0.019].slice(0, gaps);
    let f: FieldFn = rectField(board, {u: gu, v: gv, w: full + 6, h: 18, radius: 2.5}, {h: 0.03, tint: [0.3, 0.31, 0.31], ground: rows});
    vals.forEach((val, k) => {
      const w = Math.max(1.5, (val / 0.181) * full);
      const u = gu - (full / 2) * board.p + (w / 2) * board.p;
      const v = gv + ((5.2 - k * 5.2) * board.p) / board.extH;
      const look = k === 0 ? {h: 0.16, tint: [1.0, 1.0, 0.98] as [number, number, number]} : {h: 0.16, tint: MINT, glow: 0.5};
      f = rectField(board, {u, v, w, h: 3.4, radius: 1}, {...look, ground: f});
    });
    return f;
  };
  const beats: Beat[] = [
    {id: 'c11-cctm', at: t5.place, field: pairField(false), sweep: SWEEPS.from(PLATE, 1.0, 0.04)},
    {id: 'c11-cctm-twin', at: t5.twin - 0.15, field: pairField(true), sweep: {...SWEEPS.raster([1, 0], 2.2), tintFollowsWave: true}},
    {id: 'c11-cctm-gap-a', at: t5.gap - 0.1, field: pairField(true, 1), sweep: SWEEPS.raster([1, 0], 1.4)},
    {id: 'c11-cctm-gap-b', at: t5.four - 0.1, field: pairField(true, 2), sweep: SWEEPS.raster([1, 0], 1.4)},
    {id: 'c11-cctm-gap-c', at: t5.muted, field: pairField(true, 3), sweep: SWEEPS.raster([1, 0], 1.4)},
  ];
  const camera: CameraKey[] = [{at: t5.place, dur: Math.max(1, t5.out - t5.place), pose: pushIn(pr, 0.03), ease: 'inOutSine'}];
  const x = Math.round(W * layout.marginLeftW);
  const overlays: TimedNode[] = [
    {id: 'c11-cctm-plate', from: t5.plate, to: t5.out + 0.5, render: (t) => <NamePlate t={t} at={t5.plate} out={t5.out} repo="CCTM" status="RESEARCH PROTOTYPE v0.1.0 · SYNTHETIC" />},
    {
      id: 'c11-cctm-labels',
      from: t5.place,
      to: t5.out + 0.5,
      render: (t) => {
        const [, ay] = tilePx(board, pr, PAIR, 7, 0, W, H);
        const [, ty] = tilePx(board, pr, PAIR, 7, 1, W, H);
        const [fx, fy] = tilePx(board, pr, PAIR, 0, 0, W, H);
        const [ex] = tilePx(board, pr, PAIR, 7, 0, W, H);
        const ax = (fx + ex) / 2;
        const kA = pullK(t, t5.place + 0.3, t5.out);
        const kT = pullK(t, t5.twin, t5.out);
        const kG = pullK(t, t5.gap, t5.out);
        const kO = pullK(t, t5.oracle - 0.2, t5.out);
        const v = t >= t5.muted ? '0.019' : t >= t5.four - 0.1 ? '0.041' : '0.181';
        return (
          <>
            {kA > 0 ? <div style={{position: 'absolute', left: Math.round(ax), top: Math.round(ay - 0.085 * H), transform: 'translateX(-50%)', ...pullStyle(kA, H), ...lab(H)}}>{'applicant'}</div> : null}
            {kT > 0 ? <div style={{position: 'absolute', left: Math.round(ax), top: Math.round(ty + 0.045 * H), transform: 'translateX(-50%)', ...pullStyle(kT, H), ...lab(H)}}>{'twin: one feature flipped · label from the oracle'}</div> : null}
            {kT > 0 ? <div style={{position: 'absolute', left: Math.round(fx), top: Math.round(fy - 0.085 * H), transform: 'translateX(-50%)', ...pullStyle(kT, H), ...lab(H), color: color.signal.amber}}>{'group flag'}</div> : null}
            <div style={{position: 'absolute', left: x, top: Math.round(0.26 * H), ...pullStyle(Math.max(kA * 0.999, 0), H)}}>
              <div style={kick(H)}>{'applicant + one-feature twin'}</div>
              {kG > 0 ? (
                <div style={{marginTop: Math.round(0.03 * H), opacity: kG}}>
                  <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim}}>{'demographic parity gap, biased synthetic loans'}</div>
                  <div style={{...mono(H, 0.034, 600), color: color.text.key, marginTop: Math.round(0.008 * H), fontVariantNumeric: 'tabular-nums'}}>{v}</div>
                  <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, marginTop: Math.round(0.006 * H)}}>{'0.181 vanilla TM → 0.041 CCTM → 0.019 muted clauses'}</div>
                </div>
              ) : null}
            </div>
            {[0, 1, 2].map((k) => {
              const at = [t5.gap, t5.four - 0.1, t5.muted][k];
              const kk = pullK(t, at + 0.2, t5.out);
              if (kk <= 0) return null;
              const [gu, gv] = gridCentre(board, {cols: 1, rows: 1, dy: -18});
              const val = [0.181, 0.041, 0.019][k];
              const end = gu - (GAP_FULL / 2) * board.p + Math.max(1.5, (val / 0.181) * GAP_FULL) * board.p;
              const [bx, by] = screenAtUv(board, pr, end, gv + ((5.2 - k * 5.2) * board.p) / board.extH, W, H);
              return (
                <div key={k} style={{position: 'absolute', left: Math.round(bx + 0.012 * H), top: Math.round(by - 0.014 * H), ...pullStyle(kk, H), ...mono(H, Ty.monoKicker.size, 500), color: k ? color.accent.mint : color.text.display, textShadow: '0 1px 6px rgba(5,8,7,0.9)'}}>
                  {`${val.toFixed(3)} ${['vanilla TM', 'CCTM', 'muted clauses'][k]}`}
                </div>
              );
            })}
            {kO > 0 ? (
              <div style={{position: 'absolute', left: x, top: Math.round(0.47 * H), width: Math.round(0.36 * W), display: 'flex', gap: Math.round(0.014 * H), alignItems: 'flex-start', ...pullStyle(kO, H)}}>
                <span style={{marginTop: Math.round(0.006 * H)}}>
                  <MissDot H={H} />
                </span>
                <span style={{...mono(H, 0.026, 500), color: color.text.display, whiteSpace: 'normal', lineHeight: 1.4}}>{'counterfactual labels from a bias-free oracle (synthetic) · real data has no such oracle'}</span>
              </div>
            ) : null}
            <Cite t={t} repo="CCTM" path="cctm/causal.py" line="6-10" at={t5.twin + 0.3} out={t5.gap} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="CCTM" path="results/fairness_audit.json" line="74-77, 86-89, 102-104" at={t5.four} out={t5.out} x={x} y={Math.round(0.6 * H)} />
            <Cite t={t} repo="CCTM" path="experiments/fairness_audit.py" line="102-108" at={t5.oracle} out={t5.out} x={x} y={Math.round(0.645 * H)} />
            <Cite t={t} repo="CCTM" path="README.md" line={51} at={t5.noOracle} out={t5.out} x={x} y={Math.round(0.69 * H)} />
          </>
        );
      },
    },
  ];
  return {beats, camera, overlays};
};

// ------------------------------------------------------------------ FedTM
const MASK: GridSpec = {cols: 4, rows: 3, cell: 4.2, gap: 0.8};
const SITES = 5;
const siteBit = (s: number, c: number, r: number) => {
  // a shared structure every site learns, plus each site's own disagreements
  const shared = ((c * 3 + r * 5) % 7) < 3 ? 1 : 0;
  return random(`fed-site-${s}-${c}-${r}`) < 0.22 ? 1 - shared : shared;
};
const meanBit = (c: number, r: number) => {
  let m = 0;
  for (let s = 0; s < SITES; s++) m += siteBit(s, c, r);
  return m / SITES;
};

export const scene1106 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {t6} = T;
  const pr = rightPose(ctx);
  const siteSpec = (s: number): GridSpec => (s < 3 ? {...MASK, dx: (s - 1) * 21, dy: 9} : {...MASK, dx: (s - 3.5) * 21, dy: -9});
  const sites: FieldFn = overField(
    STEEL_FLAT,
    ...Array.from({length: SITES}, (_, s) => {
      const g = siteSpec(s);
      const f = grid(board, g, (c, r) => (siteBit(s, c, r) ? {h: 0.14, tint: [0.95, 0.96, 0.96]} : {h: 0.03, tint: DARK}), bed(board, g));
      const [u, v] = gridCentre(board, g);
      const hw = 10.5 * board.p;
      const hh = (8.5 * board.p) / board.extH;
      return (uu: number, vv: number, i: number) => (Math.abs(uu - u) < hw && Math.abs(vv - v) < hh ? f(uu, vv, i) : null);
    }),
  );
  const ONE: GridSpec = {...MASK, cell: 8.4, gap: 1.4, dy: 0};
  const averaged = grid(board, ONE, (c, r) => {
    const m = meanBit(c, r);
    return {h: 0.03 + 0.14 * m, tint: [0.3 + 0.62 * m, 0.31 + 0.62 * m, 0.31 + 0.62 * m]};
  }, bed(board, ONE));
  const noisy = (c: number, r: number) => meanBit(c, r) + 0.242 * (random(`fed-noise-${c}-${r}`) * 2 - 1) * 1.2;
  const consensus = grid(board, ONE, (c, r) => (noisy(c, r) > 0.5 ? on(0.5) : {h: 0.03, tint: DARK}), bed(board, ONE));
  const beats: Beat[] = [
    {id: 'c11-fed-sites', at: t6.place, field: sites, sweep: {...SWEEPS.raster([1, 0], 1.6), tintFollowsWave: true}},
    {id: 'c11-fed-average', at: t6.average - 0.2, field: averaged, sweep: SWEEPS.from(PLATE, 0.9, 0.04), tintTauS: 0.35},
    {id: 'c11-fed-consensus', at: t6.round, field: consensus, sweep: {...SWEEPS.booleanFlip([PLATE[0] - 0.1, PLATE[1] + 0.1]), speed: 1.6}},
  ];
  // the privacy noise: tints jitter on the averaged mask before the snap
  const [ou, ov] = gridCentre(board, ONE);
  const hw = ((ONE.cols * (ONE.cell ?? 8.4)) / 2) * board.p;
  const hh = (((ONE.rows * (ONE.cell ?? 8.4)) / 2) * board.p) / board.extH;
  const jit = {h: 0, tint: [1, 1, 1] as [number, number, number], glow: 0};
  const jitter: LiveLayer = {
    fn: (u, v, i, t) => {
      if (Math.abs(u - ou) > hw || Math.abs(v - ov) > hh) return null;
      // Gaussian-like privacy noise, a new draw twelve times a second (seeded, no allocation)
      const n = hash01(Math.floor(t * 12) + 7919, i) + hash01(Math.floor(t * 12) + 104729, i) - 1;
      jit.tint[0] = jit.tint[1] = jit.tint[2] = 1 + 0.5 * n;
      return jit;
    },
    from: t6.noise - 0.1,
    to: t6.round + 0.1,
    fadeS: 0.25,
    region: [ou - hw, ov - hh, ou + hw, ov + hh],
    mode: 'add',
  };
  const camera: CameraKey[] = [{at: t6.place, dur: Math.max(1, t6.out - t6.place), pose: pushIn(pr, 0.03), ease: 'inOutSine'}];
  const x = Math.round(W * layout.marginLeftW);
  const overlays: TimedNode[] = [
    {id: 'c11-fed-plate', from: t6.plate, to: t6.out + 0.5, render: (t) => <NamePlate t={t} at={t6.plate} out={t6.out} repo="FedTM" status="RESEARCH PROTOTYPE v0.1.0 · SYNTHETIC" />},
    {id: 'c11-fed-sites-labels', from: t6.place, to: t6.average + 0.6, render: (t) => <SiteLabels t={t} T={T} ctx={ctx} pose={pr} specs={Array.from({length: SITES}, (_, s) => siteSpec(s))} />},
    {id: 'c11-fed-text', from: t6.sharing, to: t6.out + 0.5, render: (t) => <FedText t={t} T={T} x={x} />},
    {id: 'c11-fed-cites', from: t6.sharing, to: t6.out + 0.5, render: (t) => <FedCites t={t} T={T} />},
  ];
  return {beats, live: [jitter], camera, overlays};
};

const SiteLabels: React.FC<{t: number; T: Times11; ctx: FilmCtx; pose: CameraPose; specs: GridSpec[]}> = ({t, T, ctx, pose, specs}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pullK(t, T.t6.place + 0.5, T.t6.average - 0.3);
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      {specs.map((g, s) => {
        const [x0] = tilePx(ctx.board, pose, g, 0, 2, W, H);
        const [x1, sy] = tilePx(ctx.board, pose, g, 3, 2, W, H);
        return (
          <div key={s} style={{position: 'absolute', left: Math.round((x0 + x1) / 2), top: Math.round(sy + 0.03 * H), transform: 'translateX(-50%)', ...lab(H)}}>
            {`site ${s + 1}`}
          </div>
        );
      })}
    </div>
  );
};

const FedText: React.FC<{t: number; T: Times11; x: number}> = ({t, T, x}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t6} = T;
  const kS = pullK(t, t6.sharing, t6.out);
  const kA = easeOutCubic(prog(t, t6.accuracy, 0.5));
  const kE = pullK(t, t6.rounds - 0.2, t6.out);
  const strike = easeInOutCubic(prog(t, t6.twenty - 0.15, 0.6));
  const kC = easeOutCubic(prog(t, t6.twenty + 0.45, 0.5));
  const bar = (label: string, v: number, tone: string, i: number) => (
    <div key={label} style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H), marginTop: i ? Math.round(0.01 * H) : 0}}>
      <span style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, minWidth: Math.round(0.21 * H)}}>{label}</span>
      <span style={{width: Math.round(0.36 * H * v * kA), height: Math.round(0.016 * H), borderRadius: 3, background: tone}} />
      <span style={{...mono(H, 0.024, 600), color: color.text.key}}>{v.toFixed(3)}</span>
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: Math.round(0.255 * H), width: Math.round(0.355 * W), ...pullStyle(kS, H)}}>
      <div style={kick(H)}>{'sites share only include masks'}</div>
      {kA > 0 ? (
        <div style={{marginTop: Math.round(0.022 * H)}}>
          {bar('ε 4 per round', 0.875, color.accent.mint, 0)}
          {bar('no noise', 0.91, '#cfd3d2', 1)}
        </div>
      ) : null}
      {kE > 0 ? (
        <div style={{marginTop: Math.round(0.026 * H), opacity: kE}}>
          <div style={{...mono(H, 0.026, 500), color: color.text.display, whiteSpace: 'normal', lineHeight: 1.4}}>{'ε = 4 per round × 5 rounds = 20 (simple composition)'}</div>
          <div style={{position: 'relative', display: 'inline-block', marginTop: Math.round(0.016 * H)}}>
            <span style={{...mono(H, 0.026, 500), color: strike > 0.5 ? color.text.tertiary : color.text.display}}>{'README: ε 13.7'}</span>
            <span style={{position: 'absolute', left: 0, top: '52%', height: Math.max(2, Math.round(0.003 * H)), width: `${(strike * 100).toFixed(1)}%`, background: color.pixie.bodyHi}} />
          </div>
          {kC > 0 ? (
            <div style={{display: 'flex', alignItems: 'flex-start', gap: Math.round(0.012 * H), marginTop: Math.round(0.012 * H), opacity: kC}}>
              <span style={{marginTop: Math.round(0.007 * H)}}>
                <WinDot H={H} size={0.013} />
              </span>
              <span style={{...mono(H, 0.024, 500), color: color.text.display, whiteSpace: 'normal', lineHeight: 1.4}}>{'13.7 is for ε = 1 per round · at 4 per round: 20 (simple composition)'}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const FedCites: React.FC<{t: number; T: Times11}> = ({t, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t6} = T;
  const x = Math.round(W * layout.marginLeftW);
  return (
    <>
      <Cite t={t} repo="FedTM" path="fedtm/site.py" line="33-39" at={t6.sharing + 0.3} out={t6.accuracy - 0.2} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="FedTM" path="fedtm/coordinator.py" line="95-112" at={t6.average} out={t6.accuracy - 0.2} x={x} y={Math.round(0.69 * H)} />
      <Cite t={t} repo="FedTM" path="results/privacy_accuracy.json" line="530-535" at={t6.accuracy + 0.3} out={t6.rounds - 0.2} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="FedTM" path="results/baselines.json" line="143-145" at={t6.accuracy + 0.5} out={t6.rounds - 0.2} x={x} y={Math.round(0.69 * H)} />
      <Cite t={t} repo="FedTM" path="results/privacy_accuracy.json" line="81-87, 213-219" at={t6.weakens} out={t6.out} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="FedTM" path="README.md" line={65} at={t6.twenty} out={t6.out} x={x} y={Math.round(0.69 * H)} />
    </>
  );
};

void low;
