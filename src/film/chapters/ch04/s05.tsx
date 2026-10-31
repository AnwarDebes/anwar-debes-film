import React from 'react';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, emblemField, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {Stamp, easeOutCubic, prog} from '../../../engine/type';
import V from '../../../data/ch04/veritas.json';
import {barsAt, boxesField, ground, layers, pinLattice, pinsField} from '../ch03/kit/fields';
import {Chip, Headline, MonoKicker, Pill, dim, env, mint, pullStyle, white} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {LIT, NAVY} from './common';
import {FIELD_TL} from './s01';

// 04.5 its own false alarm, the word audit, and what random probing can and cannot say.
// 04.6 hardening: retraining makes it worse, repair by construction reaches zero; the payoff.

export const buildFalseAlarmAndHardening = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S5 = c.sc('04.5');
  const S6 = c.sc('04.6');
  const ch = c.tl.chapter('04');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);
  const navy = ground(NAVY);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- "Your nun": two blocks of pins
  const nunAt = c.w('u0417', 'Your');
  const blocked = c.w('u0417', 'blocked');
  const wordBox = (on: boolean): Look => (on ? {h: 0.42, tint: [0.86, 0.9, 0.98]} : {h: 0.02, tint: 0.45});
  const words = (a: boolean, b: boolean) =>
    boxesField(board, [
      {u: 0.585, v: 0.5, w: 22, h: 12, radius: 2, look: wordBox(a)},
      {u: 0.585 + 27 * board.p, v: 0.5, w: 17, h: 12, radius: 2, look: wordBox(b)},
    ], navy);
  acc.beat({id: 'nun', at: nunAt - 0.2, field: words(true, true), sweep: {origin: [0.62, 0.5], speed: 0.7, jitterS: 0.05}});
  const dropA = blocked + 0.55;
  const dropB = dropA + 0.75;
  acc.beat({id: 'drop-your', at: dropA, field: words(false, true)});
  acc.beat({id: 'back-your', at: dropA + 0.55, field: words(true, true)});
  acc.beat({id: 'drop-nun', at: dropB, field: words(true, false)});
  acc.beat({id: 'back-nun', at: dropB + 0.55, field: words(true, true)});
  const nunPose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: S5.start - 0.4, dur: 1.4, pose: nunPose, ease: 'camera'});
  acc.light.push({at: S5.start - 0.4, dur: 1.2, key: 1.0, spread: 1.2, poolAt: [0.08, 0], look: [0, 0]});
  const fa = V.falseAlarm;
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  acc.overlay({
    id: 'nun',
    from: S5.start,
    to: dropB + 1.6,
    render: (t) => {
      const exit = dropB + 1.1;
      const dropK = (at: number) => Math.min(easeOutCubic(prog(t, at, 0.2)), 1 - easeOutCubic(prog(t, at + 0.55, 0.2)));
      const aK = dropK(dropA);
      const bK = dropK(dropB);
      return (
        <>
          <MonoKicker text="falseAlarm() · no attack words at all" x={left} y={Math.round(0.075 * H)} k={env(t, S5.start + 0.1, 0.4, exit)} />
          <div style={{position: 'absolute', left, top: Math.round(0.2 * H), fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.09 * H), color: color.text.display, whiteSpace: 'nowrap', ...pullStyle(env(t, nunAt, 0.35, exit), H)}}>
            “<span style={{opacity: 1 - 0.75 * aK}}>{fa.text.split(' ')[0]}</span> <span style={{opacity: 1 - 0.75 * bK}}>{fa.text.split(' ')[1]}</span>”
          </div>
          <Stamp label="BLOCKED" tone={color.text.secondary} filled={false} at={blocked} t={t} exitAt={exit} x={Math.round(0.36 * W)} y={Math.round(0.42 * H)} sizeH={0.036} rotate={-4} />
          <Pill k={env(t, blocked + 0.3, 0.4, exit)} x={left} y={Math.round(0.5 * H)} sizeH={0.024}>
            {white(fa.text)} {dim('·')} vote {white(`+${fa.vote}`)} {dim('·')} no attack words
          </Pill>
          <Pill k={env(t, dropA, 0.4, exit)} x={left} y={Math.round(0.56 * H)} sizeH={0.024}>
            remove either word {dim('→')} {mint('allowed')} {dim(`· votes ${fa.drops.map((d) => `−${-d.vote}`).join(' / ')}`)}
          </Pill>
          <Chip t={t} at={blocked + 0.6} exitAt={exit} repo="veritas" path="README.md" line={43} x={left} y={Math.round(0.62 * H)} />
          <Chip t={t} at={dropA + 0.4} exitAt={exit} repo="veritas" path="live/engine.js" line="136-167" x={left + Math.round(0.19 * W)} y={Math.round(0.62 * H)} />
          {(['Your', 'nun'] as const).map((w, j) => {
            const [x, y] = projectToScreen(pose(t), [0.585 + j * 27 * board.p - 0.5, (0.5 - (8.5 * board.p) / board.extH) * board.extH - board.extH / 2, 0.2 * relief], W, H);
            return (
              <div key={w} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, 0)', fontFamily: font.mono, fontSize: Math.round(0.026 * H), color: color.text.caption, ...pullStyle(env(t, nunAt + 0.2, 0.4, exit), H)}}>
                {w}
              </div>
            );
          })}
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the audit: 256 solver calls, one per pin
  const lattice = pinLattice(board, FIELD_TL, 16, 16, 2);
  const auditFrom = dropB + 1.0;
  const auditTo = auditFrom + 2.4;
  const DIM: Look = {h: 0.06, tint: [0.42, 0.55, 0.72]};
  const ASKED: Look = {h: 0.2, tint: [0.75, 0.88, 1.02], glow: 0.15};
  const auditField = (n: number) => {
    const m = new Map<number, Look>();
    for (let i = 0; i < 256; i++) if (lattice[i] >= 0) m.set(lattice[i], i < n ? ASKED : DIM);
    return pinsField(m, navy);
  };
  acc.beat({id: 'audit', at: auditFrom - 0.3, field: auditField(0), sweep: {origin: [0.62, 0.5], speed: 0.8, jitterS: 0.05}});
  const steps = 16;
  for (let s = 1; s <= steps; s++) acc.beat({id: `audit-${s}`, at: auditFrom + ((auditTo - auditFrom) * s) / steps, field: auditField(16 * s)});
  const auditPose = frameOn(board, {uv: [0.6, 0.5], pinsAcross: 132, yaw: 0.12, pitch: 0.06, aspect, screen: [0.66, 0.5]});
  acc.camera.push({at: auditFrom - 0.5, dur: 1.3, pose: auditPose, ease: 'camera'});
  const audit = (V as unknown as {audit?: {total: number; proved: string[]}}).audit;
  acc.overlay({
    id: 'audit',
    from: auditFrom - 0.2,
    to: auditTo + 2.2,
    render: (t) => {
      const n = Math.round(256 * Math.min(1, Math.max(0, (t - auditFrom) / (auditTo - auditFrom))));
      const exit = auditTo + 1.6;
      const k = env(t, auditFrom, 0.4, exit);
      return (
        <>
          <MonoKicker text="audit() · does any one word always force a block?" x={left} y={Math.round(0.075 * H)} k={k} />
          <div style={{position: 'absolute', left, top: Math.round(0.24 * H), width: Math.round(0.36 * W), height: Math.round(0.012 * H), borderRadius: 999, background: 'rgba(228,234,231,0.12)', ...pullStyle(k, H)}}>
            <div style={{width: `${(n / 256) * 100}%`, height: '100%', borderRadius: 999, background: color.accent.mint}} />
          </div>
          <div style={{position: 'absolute', left, top: Math.round(0.27 * H), fontFamily: font.mono, fontSize: Math.round(0.026 * H), color: color.text.caption, ...pullStyle(k, H)}}>
            {white(String(n))} of 256 solver calls
          </div>
          <Pill k={env(t, auditTo + 0.1, 0.4, exit)} x={left} y={Math.round(0.38 * H)} sizeH={0.03}>
            No single word always forces a block. {audit ? dim(`(${audit.proved.length} of ${audit.total})`) : null}
          </Pill>
          <Chip t={t} at={auditTo + 0.4} exitAt={exit} repo="veritas" path="live/engine.js" line="123-134" x={left} y={Math.round(0.445 * H)} />
          <Chip t={t} at={auditTo + 0.6} exitAt={exit} repo="veritas" path="CHANGELOG.md" line={17} x={left + Math.round(0.2 * W)} y={Math.round(0.445 * H)} />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- random probing, as pin bars
  const chartAt = Math.max(auditTo + 1.5, c.w('u0418', 'random'));
  const chart = {u: 0.585, v: 0.36, height: 20};
  const BAR: Look = {h: 0.3, tint: [0.84, 0.94, 1.05]};
  const SLIVER: Look = {h: 0.42, tint: LIT, glow: 0.9};
  const recall = [0.9017, 0.99896, 1.0];
  acc.beat({id: 'chart', at: chartAt - 0.2, field: barsAt(board, {...chart, bars: recall.map((v, j) => ({x: j * 13, w: 8, value: v, look: BAR}))}, navy), sweep: {kind: 'linear', origin: [0.5, chart.v], direction: [0, 1], speed: 0.5, jitterS: 0.04}});
  const certAt = Math.max(chartAt + 1.6, c.w('u0419', 'certify'));
  acc.beat({id: 'certified', at: certAt, field: barsAt(board, {...chart, bars: [...recall.map((v, j) => ({x: j * 13, w: 8, value: v, look: {h: 0.22, tint: 0.7} as Look})), {x: 3 * 13 + 4, w: 8, value: 0.0865, look: SLIVER}]}, navy)});
  const chartPose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: chartAt - 0.5, dur: 1.3, pose: chartPose, ease: 'camera'});
  acc.overlay({
    id: 'chart',
    from: chartAt,
    to: S6.start + 0.3,
    render: (t) => {
      const exit = S6.start - 0.3;
      const lab = (j: number, v: number): [number, number] => {
        const [x, y] = projectToScreen(pose(t), [chart.u + (j * 13 + 4) * board.p - 0.5, chart.v * board.extH - board.extH / 2 + (v * chart.height + 1.4) * board.p, 0.3 * relief], W, H);
        return [x, y];
      };
      const kc = env(t, chartAt + 0.4, 0.4, exit);
      return (
        <>
          <MonoKicker text="results/bypass_discovery.json · 8 seeds" x={left} y={Math.round(0.075 * H)} k={env(t, chartAt, 0.4, exit)} />
          <Pill k={env(t, chartAt + 0.2, 0.4, exit)} x={left} y={Math.round(0.2 * H)} sizeH={0.026}>
            random probing found {white('0.90 / 0.999 / 1.00')} of bypasses at {white('10 / 100 / 1000')} probes
          </Pill>
          {kc > 0.001
            ? ['10', '100', '1000'].map((p, j) => {
                const [x, y] = lab(j, recall[j]);
                return (
                  <div key={p} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', textAlign: 'center', fontFamily: font.mono, whiteSpace: 'nowrap', lineHeight: 1.3, ...pullStyle(kc, H)}}>
                    <div style={{fontSize: Math.round(0.022 * H), color: color.text.secondary}}>{p} probes</div>
                    <div style={{fontSize: Math.round(0.028 * H), color: color.text.key, fontWeight: 600}}>{[0.9, 0.999, 1.0][j].toFixed(j === 1 ? 3 : 2)}</div>
                  </div>
                );
              })
            : null}
          {t >= certAt
            ? (() => {
                const [x, y] = lab(3.3, 0.0865);
                return (
                  <div style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', textAlign: 'center', fontFamily: font.mono, whiteSpace: 'nowrap', lineHeight: 1.3, ...pullStyle(env(t, certAt, 0.4, exit), H)}}>
                    <div style={{fontSize: Math.round(0.022 * H), color: color.accent.mint}}>certified robust</div>
                    <div style={{fontSize: Math.round(0.028 * H), color: color.accent.mint, fontWeight: 600}}>9% of targets</div>
                  </div>
                );
              })()
            : null}
          <Pill k={env(t, certAt + 0.2, 0.4, exit)} x={left} y={Math.round(0.27 * H)} sizeH={0.026}>
            certified robust: {mint('9% of targets')} {dim('· only a proof can say this')}
          </Pill>
          <Chip t={t} at={chartAt + 0.5} exitAt={exit} repo="veritas" path="results/bypass_discovery.json" line="115-169" x={left} y={Math.round(0.335 * H)} />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- 04.6 hardening: eight seeds, round by round
  const hist = [
    [7, 8, 8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8, 8, 8],
    [6, 7, 8, 8, 8, 8, 8, 8],
    [6, 8, 8, 8, 8, 8, 8, 8],
    [6, 7, 8, 8, 8, 8, 8, 8],
    [6, 8, 8, 8, 8, 8, 8, 8],
    [7, 8, 8, 8, 8, 8, 8, 8],
    [8, 8, 8, 8, 8, 8, 8, 8],
  ];
  const hChart = {u: 0.655, v: 0.337, height: 18};
  const roundsFrom = c.w('u0420', 'Retraining');
  const roundsTo = c.w('u0420', 'bypassable');
  const SEED: Look = {h: 0.3, tint: [0.84, 0.94, 1.05]};
  const REPAIR: Look = {h: 0.4, tint: LIT, glow: 0.85};
  const hField = (round: number, repair: number | null) =>
    barsAt(board, {
      ...hChart,
      bars: [
        ...hist.map((h, s) => ({x: s * 4.0, w: 2.8, value: h[Math.min(7, round)] / 8, look: SEED})),
        ...(repair !== null ? [{x: 8 * 4.0 + 4, w: 4.2, value: repair / 8, look: REPAIR}] : []),
      ],
    }, navy);
  acc.beat({id: 'seeds', at: S6.start - 0.3, field: hField(0, 6.75), sweep: {kind: 'linear', origin: [0.5, hChart.v], direction: [0, 1], speed: 0.5, jitterS: 0.04}});
  for (let r = 1; r < 8; r++) acc.beat({id: `round-${r}`, at: roundsFrom + ((roundsTo - roundsFrom) * r) / 7, field: hField(r, 6.75)});
  const zeroAt = c.w('u0421', 'zero');
  acc.beat({id: 'repair-zero', at: zeroAt, field: hField(7, 0), sweep: {origin: [hChart.u + 38 * board.p, hChart.v], speed: 0.9, jitterS: 0.03}});
  // 144 tampered certificates (6 classes x 24), every one detected: a row of pins that all flip
  const certAt2 = c.w('u0422', 'false');
  const certPins = pinLattice(board, [hChart.u, hChart.v + (11 * board.p) / board.extH], 36, 4, 1);
  const certField = (n: number) => {
    const m = new Map<number, Look>();
    for (let i = 0; i < 144; i++) if (certPins[i] >= 0) m.set(certPins[i], i < n ? {h: 0.3, tint: LIT, glow: 0.7} : {h: 0.14, tint: 0.6});
    return pinsField(m, navy);
  };
  acc.beat({id: 'certs', at: certAt2 - 0.4, field: certField(0), sweep: {kind: 'linear', origin: [0.5, 0.9], direction: [0, -1], speed: 0.9, jitterS: 0.03}});
  acc.beat({id: 'certs-flip', at: certAt2, field: certField(144), sweep: {kind: 'linear', origin: [hChart.u, 0.5], direction: [1, 0], speed: 0.6, jitterS: 0.02, tintFollowsWave: true}});
  const hPose = frameOn(board, {uv: [0.55, 0.47], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: S6.start - 0.4, dur: 1.4, pose: hPose, ease: 'camera'});

  acc.overlay({
    id: 'hardening',
    from: S6.start - 0.1,
    to: c.u('u0423').start + 0.4,
    render: (t) => {
      const exit = c.u('u0423').start - 0.25;
      const lab = (xPins: number, v: number): [number, number] => {
        const [x, y] = projectToScreen(pose(t), [hChart.u + xPins * board.p - 0.5, hChart.v * board.extH - board.extH / 2 + (v * hChart.height + 1.3) * board.p, 0.3 * relief], W, H);
        return [x, y];
      };
      let round = 0;
      for (let r = 1; r < 8; r++) if (t >= roundsFrom + ((roundsTo - roundsFrom) * r) / 7) round = r;
      const [s2x, s2y] = lab(2 * 4.0 + 1.4, hist[2][round] / 8);
      const [rx, ry] = lab(8 * 4.0 + 6.1, t >= zeroAt ? 0 : 6.75 / 8);
      const kk = env(t, S6.start + 0.2, 0.4, exit);
      return (
        <>
          <MonoKicker text="results/hardening.json · 8 seeds · 8 targets each" x={left} y={Math.round(0.075 * H)} k={kk} />
          <div style={{position: 'absolute', left: s2x, top: s2y, transform: 'translate(-50%, -100%)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.caption, whiteSpace: 'nowrap', ...pullStyle(env(t, roundsFrom + 0.3, 0.4, Math.min(exit, certAt2 - 0.45)), H)}}>
            seed 2: {hist[2].slice(0, round + 1).join(' ')}
          </div>
          <div style={{position: 'absolute', left: rx, top: ry, transform: 'translate(-50%, -100%)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.accent.mint, whiteSpace: 'nowrap', ...pullStyle(Math.min(kk, env(t, S6.start, 0.4, certAt2 - 0.45)), H)}}>
            repair · {t >= zeroAt ? '0' : '6.75'}
          </div>
          <Pill k={env(t, c.w('u0420', 'worse'), 0.4, exit)} x={left} y={Math.round(0.14 * H)} sizeH={0.026}>
            provable bypasses: {white('6.75 → 8.0')} of 8 after retraining
          </Pill>
          <Pill k={env(t, zeroAt - 0.1, 0.4, exit)} x={left} y={Math.round(0.195 * H)} sizeH={0.026}>
            {mint('0')} after repair {dim('· all 8 seeds')}
          </Pill>
          <Pill k={env(t, zeroAt + 0.4, 0.4, exit)} x={left} y={Math.round(0.25 * H)} sizeH={0.024}>
            test accuracy {white('0.692 → 0.565')} {dim('(retraining) ·')} {mint('0.711')} {dim('(repair)')}
          </Pill>
          <Chip t={t} at={c.w('u0420', 'worse') + 0.4} exitAt={exit} repo="veritas" path="results/hardening.json" line="198-224" x={left} y={Math.round(0.3 * H)} />
          <Chip t={t} at={roundsFrom + 0.6} exitAt={exit} repo="veritas" path="results/hardening.json" line="61-81" x={left} y={Math.round(0.345 * H)} />
          <Chip t={t} at={zeroAt + 0.6} exitAt={exit} repo="veritas" path="results/hardening.json" line="225-251" x={left} y={Math.round(0.39 * H)} />
          {([
            [zeroAt + 0.5, c.w('u0422', 'targets') - 0.25, <>repair appends {white('104')} clauses</>, 'results/hardening.json', '252-260'],
            [c.w('u0422', 'targets') - 0.15, c.u('u0422').end + 0.6, <>repair targets: attack-exclusive tokens</>, 'paper/veritas.tex', '493-495'],
          ] as Array<[number, number, React.ReactNode, string, string | number]>).map(([a, b, text, path, line], i) => (
            <React.Fragment key={i}>
              <Pill k={env(t, a, 0.35, b, 0.3)} x={left} y={Math.round(0.47 * H)} sizeH={0.022} tone={color.text.caption}>
                {text}
                {i === 1 ? <span style={{color: color.text.secondary}}> · others raise false positives</span> : null}
              </Pill>
              <Chip t={t} at={a + 0.3} exitAt={b} repo="veritas" path={path} line={line} x={left} y={Math.round(0.52 * H)} />
            </React.Fragment>
          ))}
        </>
      );
    },
  });

  acc.overlay({
    id: 'assurance',
    from: certAt2 - 0.3,
    to: c.u('u0423').end + 2.6,
    render: (t) => {
      const out = c.u('u0423').end + 2.2;
      return (
        <>
          <Pill k={env(t, certAt2, 0.4, out)} x={right} y={Math.round(0.12 * H)} align="right" sizeH={0.022}>
            {white('144 / 144')} tampered certificates detected
          </Pill>
          <Chip t={t} at={certAt2 + 0.3} exitAt={out} repo="veritas" path="results/assurance_cert.json" line="8-34" x={right} y={Math.round(0.165 * H)} align="right" />
          <Pill k={env(t, certAt2 + 0.5, 0.4, out)} x={right} y={Math.round(0.215 * H)} align="right" sizeH={0.022} tone={color.text.secondary}>
            “under a second”: not measured in the repo
          </Pill>
          <Chip t={t} at={certAt2 + 0.8} exitAt={out} repo="veritas" path="README.md" line={41} x={right} y={Math.round(0.26 * H)} align="right" />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the payoff: the social card's headline, the ⊨ in pins
  const payAt = c.u('u0423').start;
  const emblemAt = {u: 0.71, v: 0.47, height: 46};
  const emblem = emblemField(board, 'veritas', emblemAt, {ground: NAVY[1] * 0.85, glowAbove: 0.95});
  const withEmblem = layers(navy, (u, v, i) => {
    if (Math.abs(u - emblemAt.u) > 0.2 || Math.abs(v - emblemAt.v) > 0.3) return null;
    const s = emblem(u, v, i);
    return s.h > 0.01 ? {...s, tint: s.h > 0.95 ? LIT : [0.75, 0.9, 1.05]} : null;
  });
  acc.beat({id: 'payoff', at: payAt - 0.5, field: withEmblem, sweep: {kind: 'linear', origin: [0.5, 0], direction: [0, 1], speed: 0.6, jitterS: 0.04, tintFollowsWave: true}});
  const payPose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 138, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: payAt - 0.6, dur: 1.5, pose: payPose, ease: 'camera'}, {at: payAt + 1.0, dur: ch.end - payAt - 3.4, pose: {...payPose, distance: payPose.distance * 0.95}, ease: 'inOutSine'});
  acc.captionSkip.push('u0423');
  const u = c.u('u0423');
  const split = u.words.findIndex((w) => w.text.startsWith('Prove'));
  acc.overlay({
    id: 'payoff',
    from: payAt - 0.2,
    to: ch.end - 0.3,
    render: (t) => (
      <>
        <Headline t={t} words={u.words.slice(0, split).map((w) => ({text: w.text, start: w.start}))} x={left} y={Math.round(0.47 * H)} sizeH={0.088} exitAt={ch.end - 1.25} />
        <Headline t={t} words={u.words.slice(split).map((w) => ({text: w.text, start: w.start, em: true}))} x={left} y={Math.round(0.6 * H)} sizeH={0.088} exitAt={ch.end - 1.25} />
        <Chip t={t} at={u.end + 0.5} exitAt={ch.end - 2.2} repo="veritas" path="live/og.jpg" x={left} y={Math.round(0.69 * H)} />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(S5.start + 0.2), activity: 'searching', detail: 'Search 256 features for a forced block'},
    {frame: c.f(S6.start + 0.2), activity: 'reading', detail: 'Read results/hardening.json'},
    {frame: c.f(payAt), activity: 'idle', detail: ''},
  );
  return {nunAt, blocked, dropA, dropB, auditFrom, auditTo, chartAt, certAt, roundsFrom, roundsTo, zeroAt, certAt2, payAt};
};

