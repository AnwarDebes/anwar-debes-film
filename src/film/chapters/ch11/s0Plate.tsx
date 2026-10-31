import React from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, overField, rectField, type Beat, type FieldFn} from '../../../engine/pins';
import {pushIn, type CameraKey, type CameraPose} from '../../../engine/camera';
import {color, font, layout, type as Ty} from '../../../engine/tokens';
import {easeInOutCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import {handoffPose, poseOn, screenAtUv} from '../ch07/kit/frame';
import type {PartSpec} from '../ch07/kit/spec';
import {mono, pullK, pullStyle} from '../ch07/kit/ui';
import {RepoCard} from '../ch07/parts';
import {BRIGHT, DARK, PLATE, STEEL_FLAT, bed, grid, includes, low, on, raised, tilePx, type GridSpec} from './plate';
import type {Times11} from './times';

// 11.0 the gate (Act III, unfold): a cube rises, its faces unfold flat into the wall like a box
// net, one promise per face. 11.1 the faces become six chips around one small Tsetlin plate,
// each saying what its repository is: a prototype, tested on synthetic data only.

export const PROMISES = [
  {repo: 'DiTM', promise: 'generate', readme: 53},
  {repo: 'ConfTM', promise: 'cover', readme: 84},
  {repo: 'RobTM', promise: 'certify', readme: 89},
  {repo: 'CCTM', promise: 'pair', readme: 51},
  {repo: 'FedTM', promise: 'federate', readme: 73},
  {repo: 'lifelong-tm', promise: 'remember', readme: 20},
] as const;

/** Face positions of the net, in face units (x right, y up): a cross plus one. */
const NET: Array<[number, number]> = [
  [0, 1], // generate
  [-1, 0], // cover
  [0, 0], // certify
  [1, 0], // pair
  [2, 0], // federate
  [0, -1], // remember
];
const FACE = 15;
const FACE_PITCH = 16.5;

export const GENERIC: GridSpec = {cols: 8, rows: 6};

/** The generic plate: four clauses of eight literals over one input row of eight bits. */
export const genericPlate = (ctx: FilmCtx): FieldFn => {
  const {board} = ctx;
  const g = GENERIC;
  const bits = [1, 0, 1, 1, 0, 0, 1, 0];
  return grid(board, g, (c, r) => (r < 4 ? (includes(c, r) ? raised(0.16) : low()) : r === 5 ? (bits[c] ? on(0.5) : {h: 0.04, tint: [0.36, 0.37, 0.37]}) : null), bed(board, g));
};

// the plate sits right of the wall's centre, so the right pose (text left, subject right) never
// shows the edge of the wall; the centre pose is a little closer for the same reason
export const centrePose = (ctx: FilmCtx): CameraPose => poseOn(ctx, {uv: PLATE, pinsAcross: 138, yaw: 0.06, pitch: 0.05, screen: [0.5, 0.45]});
export const rightPose = (ctx: FilmCtx): CameraPose => poseOn(ctx, {uv: PLATE, pinsAcross: 150, yaw: 0.07, pitch: 0.05, screen: [0.675, 0.45]});
export const gatePose = (ctx: FilmCtx): CameraPose => poseOn(ctx, {uv: PLATE, pinsAcross: 140, yaw: 0.07, pitch: 0.06, screen: [0.64, 0.47]});

const faceUv = (ctx: FilmCtx, k: number): [number, number] => {
  const {board} = ctx;
  const [fx, fy] = NET[k];
  // the net is centred one face to the right of the plate so the cross sits in the frame
  return [PLATE[0] + (fx - 0.5) * FACE_PITCH * board.p, PLATE[1] + (fy * FACE_PITCH * board.p) / board.extH];
};

export const scene1100 = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {board, width: W, height: H} = ctx;
  const {g, t1} = T;
  const base = handoffPose(ctx);
  const pc = centrePose(ctx);
  const pg = gatePose(ctx);
  const cubeU = faceUv(ctx, 2);
  // the cube: a raised block whose darker rim reads as its sides
  const cube: FieldFn = rectField(board, {u: cubeU[0], v: cubeU[1], w: FACE + 4, h: FACE + 4, radius: 1}, {
    h: 0.32,
    tint: [0.36, 0.37, 0.37],
    ground: STEEL_FLAT,
    soft: 0.5,
  });
  const cubeTop = rectField(board, {u: cubeU[0], v: cubeU[1], w: FACE, h: FACE, radius: 0.8}, {h: 0.62, tint: [0.96, 0.97, 0.97], ground: cube});
  const net: FieldFn = overField(
    STEEL_FLAT,
    ...NET.map((_, k) => {
      const [u, v] = faceUv(ctx, k);
      const f = rectField(board, {u, v, w: FACE, h: FACE, radius: 0.8}, {h: k === 2 ? 0.16 : 0.1, tint: BRIGHT, soft: 0.5});
      const half = ((FACE / 2 + 1) * board.p) as number;
      return (uu: number, vv: number, i: number) => (Math.abs(uu - u) < half && Math.abs(vv - v) < half / board.extH ? f(uu, vv, i) : null);
    }),
  );
  const beats: Beat[] = [
    {id: 'c11-cube', at: g.at - 0.1, field: cubeTop, sweep: {...SWEEPS.from([cubeU[0], cubeU[1] - 0.2], 1.4, 0.05)}},
    {id: 'c11-net', at: g.unfold, field: net, sweep: SWEEPS.from(cubeU, 0.75, 0.04)},
    // the faces fold away into one plate: the chapter's instrument
    {id: 'c11-plate', at: t1.plate, field: genericPlate(ctx), sweep: SWEEPS.from(PLATE, 0.9, 0.05)},
  ];
  const camera: CameraKey[] = [
    {at: T.ch.start, pose: base},
    {at: g.at - 0.4, dur: 1.6, pose: pg, ease: 'camera'},
    {at: t1.plate - 0.3, dur: 1.3, pose: pc, ease: 'camera'},
    {at: t1.plate + 1.0, dur: Math.max(1, t1.out - t1.plate - 1.0), pose: pushIn(pc, 0.035), ease: 'inOutSine'},
  ];
  const light = [
    {at: T.ch.start, look: [0, 0] as [number, number], key: 1, pool: 1, env: 1, poolAt: [0, 0] as [number, number], spread: 1},
    {at: g.at - 0.3, dur: 1.5, poolAt: [PLATE[0] - 0.5, PLATE[1] * board.extH - board.extH / 2] as [number, number], spread: 1.1, key: 1.04},
  ];
  const facesPx = NET.map((_, k) => {
    const [u, v] = faceUv(ctx, k);
    return screenAtUv(board, pg, u, v, W, H);
  });
  const overlays: TimedNode[] = [
    {id: 'c11-card', from: g.at, to: g.cardOut + 0.5, render: (t) => <RepoCard t={t} at={g.cardIn} exitAt={g.cardOut} index="11" repos="DiTM · ConfTM · RobTM · CCTM · FedTM · lifelong-tm" title="Promises." />},
    {id: 'c11-faces', from: g.unfold, to: t1.plate + 0.8, render: (t) => <FaceWords t={t} at={g.unfold + 0.35} out={t1.plate + 0.1} faces={facesPx} />},
    {id: 'c11-chips', from: t1.plate, to: t1.out + 0.5, render: (t) => <SixChips t={t} at={t1.chips} out={t1.out} from={facesPx} T={T} />},
    {id: 'c11-plate-labels', from: t1.plate, to: t1.out + 0.5, render: (t) => <PlateLabels t={t} at={t1.plate + 0.6} out={t1.out} ctx={ctx} pose={pc} />},
  ];
  return {beats, camera, light, overlays};
};

const FaceWords: React.FC<{t: number; at: number; out: number; faces: Array<[number, number]>}> = ({t, at, out, faces}) => {
  const {height: H} = useVideoConfig();
  return (
    <>
      {faces.map(([x, y], k) => {
        const kk = pullK(t, at + k * 0.06, out);
        if (kk <= 0) return null;
        return (
          <div key={k} style={{position: 'absolute', left: Math.round(x), top: Math.round(y), transform: 'translate(-50%, -50%)', ...pullStyle(kk, H), ...mono(H, 0.024, 600), letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1d2120'}}>
            {PROMISES[k].promise}
          </div>
        );
      })}
    </>
  );
};

/** Where the six chips sit around the plate (fractions of the frame). */
export const CHIP_SLOTS: Array<[number, number]> = [
  [0.172, 0.25],
  [0.172, 0.44],
  [0.172, 0.63],
  [0.828, 0.25],
  [0.828, 0.44],
  [0.828, 0.63],
];

export const PromiseChip: React.FC<{k: number; H: number; value?: React.ReactNode; status?: boolean; source?: boolean}> = ({k, H, value, status = true, source = true}) => {
  const p = PROMISES[k];
  return (
    <div style={{minWidth: Math.round(0.31 * H), boxSizing: 'border-box', padding: `${Math.round(0.014 * H)}px ${Math.round(0.02 * H)}px`, borderRadius: Math.round(H * layout.cardRadiusH), background: color.card.glass, border: `1px solid ${color.card.rule}`, boxShadow: `0 ${Math.round(0.012 * H)}px ${Math.round(0.04 * H)}px rgba(0,0,0,0.45)`}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: Math.round(0.02 * H)}}>
        <span style={{...mono(H, 0.028, 600), color: color.text.display}}>{p.repo}</span>
        <span style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.034 * H), color: color.accent.mint}}>{p.promise}</span>
      </div>
      {value !== undefined ? <div style={{...mono(H, 0.034, 600), color: color.text.key, marginTop: Math.round(0.006 * H)}}>{value}</div> : null}
      {status ? (
        <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.1em', color: color.text.chipDim, marginTop: Math.round(0.006 * H), lineHeight: 1.35}}>
          <div>{'PROTOTYPE'}</div>
          <div>{'SYNTHETIC DATA'}</div>
        </div>
      ) : null}
      {source ? (
        <div style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.tertiary, marginTop: Math.round(0.004 * H)}}>
          {`${p.repo}/README.md:${p.readme} `}
          <span style={{color: color.accent.mint}}>{'✓'}</span>
        </div>
      ) : null}
    </div>
  );
};

const SixChips: React.FC<{t: number; at: number; out: number; from: Array<[number, number]>; T: Times11}> = ({t, at, out, from, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const synth = easeOutCubic(prog(t, T.t1.synthetic - 0.1, 0.4));
  return (
    <>
      {PROMISES.map((_, k) => {
        const a = at + k * 0.22;
        const kk = pullK(t, a, out, 0.3, 0.35);
        if (kk <= 0) return null;
        const m = easeInOutCubic(prog(t, a - 0.1, 0.6));
        const [fx, fy] = from[k];
        const [sx, sy] = CHIP_SLOTS[k];
        const x = fx + (sx * W - fx) * m;
        const y = fy + (sy * H - fy) * m;
        return (
          <div key={k} style={{position: 'absolute', left: Math.round(x), top: Math.round(y), transform: `translate(-50%, -50%) scale(${(0.6 + 0.4 * m).toFixed(3)})`, opacity: kk, filter: kk < 1 ? `blur(${((1 - kk) * 6).toFixed(1)}px)` : undefined}}>
            <div style={{boxShadow: synth > 0 ? `0 0 ${Math.round(0.02 * H * synth)}px rgba(116,201,174,${(0.18 * synth).toFixed(3)})` : undefined, borderRadius: Math.round(H * layout.cardRadiusH)}}>
              <PromiseChip k={k} H={H} />
            </div>
          </div>
        );
      })}
    </>
  );
};

const PlateLabels: React.FC<{t: number; at: number; out: number; ctx: FilmCtx; pose: CameraPose}> = ({t, at, out, ctx, pose}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  const [cx, cy] = tilePx(ctx.board, pose, GENERIC, 0, 1, W, H);
  const [, iy] = tilePx(ctx.board, pose, GENERIC, 0, 5, W, H);
  const [rx] = tilePx(ctx.board, pose, GENERIC, 7, 5, W, H);
  const lab: React.CSSProperties = {...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.12em', textTransform: 'uppercase', color: color.text.secondary};
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      <div style={{position: 'absolute', left: Math.round((cx + rx) / 2), top: Math.round(cy - 0.165 * H), transform: 'translateX(-50%)', ...lab, color: color.text.chipDim}}>{'one Tsetlin plate'}</div>
      <div style={{position: 'absolute', left: Math.round((cx + rx) / 2), top: Math.round(iy + 0.058 * H), transform: 'translateX(-50%)', ...lab, color: color.text.chipDim}}>{'4 clauses · 8 literals · 1 input row'}</div>
    </div>
  );
};
