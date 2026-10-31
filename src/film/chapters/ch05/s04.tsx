import React from 'react';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type FieldFn} from '../../../engine/pins';
import {font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import D from '../../../data/ch05/candor.json';
import {Chip, env, pullStyle, useFrameSize} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {INK_TEXT, LEAK, MUTED_TEXT, TEAL, TEAL_TEXT} from './common';
import {paper} from './s01';
import {InkCard} from './ink';

// 05.4 the numbers card in two columns of equal width and type: planted concepts on the left, the
// misses on the right, and the per-input δ of 3,000 clean and 180 triggered inputs falling as pins
// onto a log axis, where the two piles overlap.

interface Line {
  at: number;
  text: React.ReactNode;
  chip?: {path: string; line: string | number};
}

const Column: React.FC<{t: number; head: React.ReactNode; kicker: string; sub?: string; lines: Line[]; x: number; y: number; w: number; at: number; exitAt: number}> = ({t, head, kicker, sub, lines, x, y, w, at, exitAt}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const k = env(t, at, 0.45, exitAt);
  if (k <= 0.001) return null;
  const fs = Math.round(0.028 * H);
  const top0 = Math.round((sub ? 0.15 : 0.115) * H);
  let yy = y + top0;
  const total = top0 + lines.reduce((a, l) => a + Math.round(0.052 * H) + (l.chip ? Math.round(0.044 * H) : 0), 0);
  return (
    <>
      <InkCard k={k} x={x - Math.round(0.02 * H)} y={y - Math.round(0.02 * H)} w={w + Math.round(0.04 * H)}>
        <div style={{height: total - Math.round(0.01 * H)}} />
      </InkCard>
      <div style={{position: 'absolute', left: x, top: y, width: w, ...pullStyle(k, H)}}>
        <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), letterSpacing: '0.16em', textTransform: 'uppercase', color: TEAL_TEXT}}>{kicker}</div>
        <div style={{fontFamily: font.sans, fontWeight: 700, fontSize: Math.round(0.05 * H), letterSpacing: '-0.025em', color: INK_TEXT, marginTop: Math.round(0.008 * H), lineHeight: 1.1}}>{head}</div>
        {sub ? <div style={{fontFamily: font.sans, fontSize: Math.round(0.026 * H), color: MUTED_TEXT, marginTop: Math.round(0.006 * H)}}>{sub}</div> : null}
      </div>
      {lines.map((l, i) => {
        const kk = env(t, l.at, 0.4, exitAt);
        const top = yy;
        yy += Math.round(0.052 * H) + (l.chip ? Math.round(0.044 * H) : 0);
        if (kk <= 0.001) return null;
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: x, top, width: w, fontFamily: font.sans, fontSize: fs, fontWeight: 500, color: INK_TEXT, whiteSpace: 'nowrap', ...pullStyle(kk, H)}}>{l.text}</div>
            {l.chip ? <Chip t={t} at={l.at + 0.3} exitAt={exitAt} repo="candor" path={l.chip.path} line={l.chip.line} x={x} y={top + Math.round(0.064 * H)} /> : null}
          </div>
        );
      })}
    </>
  );
};

const b = (s: React.ReactNode) => <b style={{fontWeight: 700}}>{s}</b>;
const m = (s: React.ReactNode) => <span style={{color: MUTED_TEXT}}>{s}</span>;

export const buildNumbers = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S4 = c.sc('05.4');
  const S5 = c.sc('05.5');
  const W = ctx.width;
  const H = ctx.height;
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const colW = Math.round(0.4 * W);
  const xL = Math.round(0.07 * W);
  const xR = Math.round(0.53 * W);
  const exit = S5.start - 0.4;

  // ---------------------------------------------------------------- the δ histogram: two piles on a log axis
  const hist = D.hist;
  const histU = 0.72;
  const histV = 0.4;
  const binW = 2.2;
  const maxN = Math.max(...hist.clean.map((n) => n / hist.nClean), ...hist.trig.map((n) => n / hist.nTrig));
  const hPins = 16;
  const histField = (fill: number): FieldFn => {
    const base = paper();
    return (u, v, i) => {
      const px = (u - histU) / board.p + (hist.bins * binW) / 2;
      const py = ((v - histV) * board.extH) / board.p;
      const bin = Math.floor(px / binW);
      if (bin < 0 || bin >= hist.bins || py < -0.4) return base(u, v, i);
      const inBin = px - bin * binW;
      const cTop = (hist.clean[bin] / hist.nClean / maxN) * hPins * fill;
      const tTop = (hist.trig[bin] / hist.nTrig / maxN) * hPins * fill;
      // clean on the left half of each bin, triggered on the right: the piles overlap bin for bin
      if (inBin < binW * 0.5 && py <= cTop && cTop > 0.2) return {h: 0.3, tint: TEAL, paint: 1};
      if (inBin >= binW * 0.5 && py <= tTop && tTop > 0.2) return {h: 0.3, tint: LEAK, paint: 1};
      if (Math.abs(py + 0.6) < 0.5) return {h: 0.08, tint: [0.6, 0.66, 0.65], paint: 1};
      return base(u, v, i);
    };
  };
  const histAt = c.w('u0513', 'alone');
  acc.beat({id: 'hist-axis', at: S4.start - 0.4, field: histField(0), sweep: {kind: 'linear', origin: [0, histV], direction: [1, 0], speed: 0.8, jitterS: 0.03, tintFollowsWave: true}});
  // the δ values fall into place pile by pile (the cascade, pitch by log δ)
  const falls = [0.25, 0.5, 0.75, 1];
  falls.forEach((f, j) => acc.beat({id: `hist-${j}`, at: histAt + j * 0.35, field: histField(f), sweep: {kind: 'linear', origin: [histU, histV + 0.2], direction: [0, -1], speed: 0.9, jitterS: 0.05}}));
  acc.beat({id: 'hist-off', at: c.u('u0514').start - 0.2, field: paper(), sweep: {kind: 'linear', origin: [histU, histV], direction: [0, 1], speed: 0.8, jitterS: 0.04}});

  const numPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 140, yaw: 0.04, pitch: 0.03, aspect});
  acc.camera.push({at: S4.start - 0.5, dur: 1.4, pose: numPose, ease: 'camera'}, {at: S4.start + 0.9, dur: S4.end - S4.start - 1.3, pose: {...numPose, distance: numPose.distance * 0.96}, ease: 'inOutSine'});

  const pose = (t: number) => rigPoseAt(acc.camera, t);
  acc.overlay({
    id: 'hist-labels',
    from: histAt - 0.2,
    to: c.u('u0514').start + 0.3,
    render: (t) => {
      const kk = env(t, histAt + 0.3, 0.4, c.u('u0514').start - 0.3);
      if (kk <= 0.001) return null;
      const at = (bin: number): [number, number] => {
        const [x, y] = projectToScreen(pose(t), [histU - (hist.bins * binW * board.p) / 2 + bin * binW * board.p - 0.5, histV * board.extH - board.extH / 2 - 2.4 * board.p, 0.05 * relief], W, H);
        return [x, y];
      };
      const ticks = [0, 6, 12, 18, 24];
      return (
        <div style={{position: 'absolute', inset: 0, ...pullStyle(kk, H)}}>
          {ticks.map((bin) => {
            const [x, y] = at(bin);
            const e = hist.lo + ((hist.hi - hist.lo) * bin) / hist.bins;
            return (
              <div key={bin} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, 0)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: INK_TEXT, background: 'rgba(246,252,250,0.9)', padding: `0 ${Math.round(0.006 * H)}px`, borderRadius: 4}}>
                10<sup>{e}</sup>
              </div>
            );
          })}
          <div style={{position: 'absolute', left: at(0)[0], top: at(0)[1] + Math.round(0.04 * H), fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: MUTED_TEXT, whiteSpace: 'nowrap'}}>
            <span style={{background: 'rgba(246,252,250,0.92)', padding: `${Math.round(0.004 * H)}px ${Math.round(0.01 * H)}px`, borderRadius: 6}}>per-input δ, log scale <span style={{color: TEAL_TEXT}}>■ 3,000 clean</span> <span style={{color: '#B7791F'}}>■ 180 triggered</span></span>
          </div>
        </div>
      );
    },
  });

  // ---------------------------------------------------------------- the two columns
  const pl = c.u('u0512');
  const left: Line[] = [
    {at: c.w('u0512', 'zero'), text: <><span style={{fontFamily: font.serif, fontStyle: 'italic'}}>δ</span> {b('0.0021')} {m('· mean certificate')}</>, chip: {path: 'results/planted.json', line: '16-18'}},
    {at: c.w('u0512', 'two') + 0.3, text: <>agreement {b('99.9%')} {m('·')} recovery {b('0.919')} {m('(SAE 0.966)')}</>, chip: {path: 'results/planted.json', line: '20, 32'}},
    {at: c.u('u0512').end + 0.2, text: <>necessity gap {b('0.773')}</>, chip: {path: 'results/planted.json', line: '23-25'}},
    {at: c.w('u0513', 'AUC'), text: <>backdoor AUC {b('0.901')} {m('· distributions overlap')}</>, chip: {path: 'results/planted.json', line: '77-79'}},
  ];
  const missAt = c.u('u0514').start - 0.1;
  const right: Line[] = [
    {at: c.w('u0515', 'frozen'), text: <>frozen GPT-2 {m('·')} SAE {b('0.1136')} {'<'} CANDOR {b('0.1299')}</>, chip: {path: 'results/gpt2.json', line: '15, 24'}},
    {at: c.w('u0515', 'tighter'), text: <>{m('the SAE is')} {b('tighter')} {m('· single seed')}</>, chip: {path: 'README.md', line: '81-85'}},
    {at: c.w('u0516', 'scratch'), text: <>from scratch {m('·')} {b('0.467')} vs control {b('0.645')}</>, chip: {path: 'results/lm_scratch.json', line: '216-219, 246-253'}},
    {at: c.w('u0516', 'loose'), text: <>p95 {b('0.907')} {m('·')} {b('still loose')} {m('· 2 seeds')}</>},
  ];
  acc.overlay({
    id: 'columns',
    from: S4.start - 0.2,
    to: S5.start + 0.3,
    render: (t) => (
      <>
        <Column t={t} kicker="results/planted.json" sub="synthetic data, one training seed" head="Planted concepts" lines={left} x={xL} y={Math.round(0.08 * H)} w={colW} at={pl.start - 0.2} exitAt={exit} />
        <Column t={t} kicker="results/gpt2.json · lm_scratch.json" sub="the same size, the same type" head="The misses" lines={right} x={xR} y={Math.round(0.08 * H)} w={colW} at={missAt} exitAt={exit} />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(S4.start + 0.1), activity: 'reading', detail: 'Read results/planted.json'},
    {frame: c.f(c.u('u0516').start), activity: 'reading', detail: 'Read results/gpt2.json'},
  );
  return {histAt, missAt, falls};
};
