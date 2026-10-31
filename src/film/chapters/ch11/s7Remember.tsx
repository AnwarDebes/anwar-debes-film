import React from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, overField, type Beat, type FieldFn} from '../../../engine/pins';
import {pushIn, type CameraKey, type CameraPose} from '../../../engine/camera';
import {KineticLine} from '../../../engine/type';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeInOutCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import {HANDOFF} from '../../handoff';
import {handoffPose} from '../ch07/kit/frame';
import type {PartSpec} from '../ch07/kit/spec';
import {Card, Cite, NamePlate, mono, pullK, pullStyle} from '../ch07/kit/ui';
import {DARK, MINT, PLATE, STEEL_FLAT, bed, grid, gridCentre, tilePx, type GridSpec} from './plate';
import {CHIP_SLOTS, PROMISES, PromiseChip, centrePose, genericPlate, rightPose} from './s0Plate';
import type {Times11} from './times';

// 11.7 lifelong-tm: five tasks learned in sequence. Under a plain Tsetlin Machine the earlier
// strips erode as later ones are learned; under lifelong-tm about half as much, at ten times the
// memory. Then the six chips come back around the plate with their one number each.

const STRIP: GridSpec = {cols: 10, rows: 5, cell: 3.3, gap: 0.7};
const BWT = {plain: 0.127, lifelong: 0.068};

/** Tiles of strip j eroded once k tasks have been learned (schematic, scaled to the measured BWT). */
const eroded = (bwt: number, j: number, k: number) => (j >= k ? 0 : Math.round(STRIP.cols * bwt * 2 * ((k - j) / 4)));

const stripsField = (ctx: FilmCtx, k: number): FieldFn => {
  const {board} = ctx;
  const side = (dx: number, bwt: number) => {
    const g: GridSpec = {...STRIP, dx, dy: 2};
    const f = grid(board, g, (c, r) => {
      const j = 4 - r; // task 1 at the bottom
      if (j > k) return null;
      const lost = c >= STRIP.cols - eroded(bwt, j, k);
      return lost ? {h: 0.02, tint: DARK} : {h: 0.13, tint: j === k ? MINT : [0.9, 0.92, 0.91], glow: j === k ? 0.5 : 0};
    }, bed(board, g));
    const [u, v] = gridCentre(board, g);
    const hw = ((STRIP.cols * (STRIP.cell ?? 3.6)) / 2 + 3) * board.p;
    const hh = (((STRIP.rows * (STRIP.cell ?? 3.6)) / 2 + 3) * board.p) / board.extH;
    return (uu: number, vv: number, i: number) => (Math.abs(uu - u) < hw && Math.abs(vv - v) < hh ? f(uu, vv, i) : null);
  };
  return overField(STEEL_FLAT, side(-20, BWT.plain), side(20, BWT.lifelong));
};

export const scene1107 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {width: W, height: H} = ctx;
  const {t7} = T;
  const pr = rightPose(ctx);
  const pc = centrePose(ctx);
  const learnFrom = t7.place;
  const learnStep = Math.max(0.45, (t7.half - learnFrom) / 4.4);
  const beats: Beat[] = [];
  for (let k = 0; k <= 4; k++) {
    beats.push({id: `c11-life-${k}`, at: learnFrom + k * learnStep, field: stripsField(ctx, k), sweep: k === 0 ? SWEEPS.from(PLATE, 1.0, 0.04) : {...SWEEPS.raster([1, 0], 2.4), jitterS: 0.03}});
  }
  // the six promises again, around the same plate, each with its one number
  beats.push({id: 'c11-life-plate', at: t7.six, field: genericPlate(ctx), sweep: SWEEPS.from(PLATE, 0.9, 0.05)});
  // and the wall hands over, bare
  beats.push({id: 'c11-handoff', at: t7.clear, field: HANDOFF, sweep: SWEEPS.from(PLATE, 0.8, 0.06)});
  const camera: CameraKey[] = [
    {at: t7.place, dur: Math.max(1, t7.six - t7.place), pose: pushIn(pr, 0.03), ease: 'inOutSine'},
    {at: t7.six - 0.2, dur: 1.3, pose: pc, ease: 'camera'},
    {at: t7.six + 1.1, dur: Math.max(1, t7.clear - t7.six - 1.1), pose: pushIn(pc, 0.03), ease: 'inOutSine'},
    {at: t7.clear, dur: Math.max(1.2, T.ch.end - t7.clear - 0.25), pose: handoffPose(ctx), ease: 'camera'},
  ];
  const light = [{at: t7.clear, dur: Math.max(1.2, T.ch.end - t7.clear - 0.25), look: [0, 0] as [number, number], key: 1, pool: 1, env: 1, poolAt: [0, 0] as [number, number], spread: 1}];
  const x = Math.round(W * layout.marginLeftW);
  const overlays: TimedNode[] = [
    {id: 'c11-life-plate-name', from: t7.plate, to: t7.six + 0.5, render: (t) => <NamePlate t={t} at={t7.plate} out={t7.six - 0.2} repo="lifelong-tm" status="RESEARCH PROTOTYPE · SYNTHETIC FIRST PASS" />},
    {id: 'c11-life-labels', from: t7.place, to: t7.six + 0.5, render: (t) => <LifeLabels t={t} T={T} ctx={ctx} pose={pr} x={x} />},
    {id: 'c11-final-chips', from: t7.six, to: t7.clear + 0.6, render: (t) => <FinalChips t={t} at={t7.six + 0.3} out={t7.clear} />},
    {
      id: 'c11-closing',
      from: t7.six,
      to: T.ch.end,
      render: (t) => (
        <KineticLine words={ctx.tl.utt('u1120').words} t={t} kind="columnCaption" variant="focus" align="center" x={Math.round(W / 2)} y={Math.round(0.085 * H)} yAnchor="capTop" maxWidth={Math.round(W * 0.86)} maxLines={1} exitAt={t7.clear + 0.2} />
      ),
    },
  ];
  return {beats, camera, light, overlays, captionSkip: ['u1120']};
};

const LifeLabels: React.FC<{t: number; T: Times11; ctx: FilmCtx; pose: CameraPose; x: number}> = ({t, T, ctx, pose, x}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t7} = T;
  const k = pullK(t, t7.place + 0.3, t7.six - 0.2);
  if (k <= 0) return null;
  const [lx, ly] = tilePx(ctx.board, pose, {...STRIP, dx: -20, dy: 2}, 5, 0, W, H);
  const [rx] = tilePx(ctx.board, pose, {...STRIP, dx: 20, dy: 2}, 5, 0, W, H);
  const [, by] = tilePx(ctx.board, pose, {...STRIP, dx: -20, dy: 2}, 5, 4, W, H);
  const kF = pullK(t, t7.forgets, t7.six - 0.2);
  const mem = easeOutCubic(prog(t, t7.memory, 1.0));
  const lab: React.CSSProperties = {...mono(H, Ty.monoKicker.size, 500), color: color.text.chipDim, whiteSpace: 'nowrap', textShadow: '0 1px 6px rgba(5,8,7,0.85)'};
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      <div style={{position: 'absolute', left: Math.round(lx), top: Math.round(ly - 0.075 * H), transform: 'translateX(-50%)', ...lab}}>{'plain Tsetlin Machine'}</div>
      <div style={{position: 'absolute', left: Math.round(rx), top: Math.round(ly - 0.075 * H), transform: 'translateX(-50%)', ...lab, color: color.accent.mint}}>{'lifelong-tm'}</div>
      <div style={{position: 'absolute', left: Math.round((lx + rx) / 2), top: Math.round(by + 0.045 * H), transform: 'translateX(-50%)', ...lab, color: color.text.tertiary}}>{'task 1 at the bottom · task 5 on top'}</div>
      <div style={{position: 'absolute', left: x, top: Math.round(0.26 * H), width: Math.round(0.36 * W)}}>
        <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.accent.mintLabel}}>{'five tasks, one after another'}</div>
        {kF > 0 ? (
          <div style={{marginTop: Math.round(0.02 * H), opacity: kF}}>
            <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim}}>{'forgetting (backward transfer, 5 seeds)'}</div>
            <div style={{...mono(H, 0.03, 600), color: color.text.key, marginTop: Math.round(0.008 * H)}}>
              {'plain −0.127 · '}
              <span style={{color: color.accent.mint}}>{'lifelong −0.068'}</span>
            </div>
          </div>
        ) : null}
        {mem > 0 ? (
          <div style={{marginTop: Math.round(0.024 * H), opacity: mem}}>
            <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim}}>{'memory'}</div>
            <div style={{...mono(H, 0.03, 600), color: color.text.key, marginTop: Math.round(0.008 * H), fontVariantNumeric: 'tabular-nums'}}>
              {`4,860 B → ${Math.round(4860 + (50519 - 4860) * mem).toLocaleString('en-US')} B`}
            </div>
          </div>
        ) : null}
        <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.signal.amber, marginTop: Math.round(0.02 * H)}}>{'schematic erosion · the numbers are measured'}</div>
      </div>
      <Cite t={t} repo="lifelong-tm" path="README.md" line="3-8" at={t7.plate + 0.4} out={t7.forgets} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="lifelong-tm" path="results/synthetic_drift_5seed.json" line="5, 9, 45, 49" at={t7.forgets + 0.3} out={t7.six - 0.2} x={x} y={Math.round(0.645 * H)} />
      <Cite t={t} repo="lifelong-tm" path="README.md" line="22-25, 39-41" at={t7.memory + 0.4} out={t7.six - 0.2} x={x} y={Math.round(0.69 * H)} />
    </div>
  );
};

const VALUES = ['0.677', '0.900', '276/277', '0.041', '0.875', '−0.068'];
const MISS = [false, false, true, false, false, false];

const FinalChips: React.FC<{t: number; at: number; out: number}> = ({t, at, out}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <>
      {PROMISES.map((_, k) => {
        const kk = pullK(t, at + k * 0.12, out, 0.35, 0.4);
        if (kk <= 0) return null;
        const [sx, sy] = CHIP_SLOTS[k];
        const m = easeInOutCubic(kk);
        return (
          <div key={k} style={{position: 'absolute', left: Math.round(sx * W), top: Math.round(sy * H), transform: `translate(-50%, -50%) scale(${(0.92 + 0.08 * m).toFixed(3)})`, ...pullStyle(kk, H)}}>
            <PromiseChip
              k={k}
              H={H}
              status={false}
              source={false}
              value={<span style={{color: MISS[k] ? color.text.chipDim : color.text.key}}>{VALUES[k]}</span>}
            />
          </div>
        );
      })}
    </>
  );
};

void Card;
