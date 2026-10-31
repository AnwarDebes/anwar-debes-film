import React from 'react';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import check from '../../../data/ch03/trace-check.json';
import traceData from '../../../data/ch03/trace.json';
import {barsAt, ground} from './kit/fields';
import {Terminal, lineAt, runEnd, type TerminalRun} from './kit/Terminal';
import {Chip, MonoKicker, Pill, dim, env, italic, mint, pullStyle, useFrameSize, white} from './kit/ui';
import {LIT, TEAL} from './common';
import type {SceneKit} from './scene';

// 03.6 the independent check, run for real (the CI path of trace/.github/workflows/pages.yml), then
// the numbers card from the results files, the main failure at the same size as the wins.

export interface Row {
  at: number;
  text: React.ReactNode;
  small?: boolean;
  chips: Array<{path: string; line?: number | string; repo?: string}>;
}

/** A column of claims, each with its sources typed underneath. */
export const ClaimColumn: React.FC<{t: number; rows: Row[]; x: number; y: number; exitAt: number; maxW: number; repo: string}> = ({t, rows, x, y, exitAt, maxW, repo}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  let yy = y;
  return (
    <>
      {rows.map((r, i) => {
        const size = r.small ? 0.026 : 0.034;
        const k = env(t, r.at, 0.4, exitAt);
        const top = yy;
        yy += Math.round((r.small ? 0.05 : 0.064) * H) + Math.round(0.046 * H) * Math.max(1, Math.ceil(r.chips.length / 2));
        if (k <= 0.001) return null;
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: x, top, maxWidth: maxW, fontFamily: font.sans, fontSize: Math.round(size * H), fontWeight: r.small ? 500 : 600, color: color.text.caption, letterSpacing: '-0.01em', lineHeight: 1.18, whiteSpace: 'nowrap', ...pullStyle(k, H)}}>{r.text}</div>
            {r.chips.map((ch, j) => (
              <Chip key={j} t={t} at={r.at + 0.3 + j * 0.25} exitAt={exitAt} repo={ch.repo ?? repo} path={ch.path} line={ch.line} x={x + (j % 2) * Math.round(0.27 * H * 1.778)} y={top + Math.round((r.small ? 0.052 : 0.066) * H) + Math.round(0.046 * H) * Math.floor(j / 2)} />
            ))}
          </div>
        );
      })}
    </>
  );
};

export const buildCheck = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S6 = c.sc('03.6');
  const S7 = c.sc('03.7');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);
  const teal = ground(TEAL);

  // ---------------------------------------------------------------- the terminal
  const typeAt = S6.start + 0.45;
  const run1: TerminalRun = {cmd: check.runs[0].cmd, typeAt, cps: 21, outAt: typeAt + check.runs[0].cmd.length / 21 + 1.0, output: check.runs[0].output, lps: 30};
  const reject = c.w('u0317', 'reject');
  const run2Type = Math.min(runEnd(run1) + 0.4, reject - 1.9);
  const run2: TerminalRun = {cmd: check.runs[1].cmd, typeAt: run2Type, cps: 22, outAt: Math.max(run2Type + check.runs[1].cmd.length / 22 + 0.35, reject), output: check.runs[1].output, lps: 30};
  const passAt = lineAt(run2, 0);
  const termOut = c.u('u0318').start - 0.35;
  acc.overlay({
    id: 'terminal',
    from: S6.start - 0.1,
    to: termOut + 0.6,
    render: (t) => (
      <>
        <Terminal
          t={t}
          at={S6.start}
          exitAt={termOut}
          x={left}
          y={Math.round(0.12 * H)}
          w={Math.round(0.645 * W)}
          h={Math.round(0.47 * H)}
          title={`AnwarDebes/trace @ ${check.commit.slice(0, 7)} · fresh clone · live/`}
          meta="29 Oct 2026"
          prompt="$"
          runs={[run1, run2]}
        />
        <MonoKicker text="fresh clone · npm test → crosscheck.py · output as printed" x={left} y={Math.round(0.065 * H)} k={env(t, S6.start + 0.2, 0.4, termOut)} />
        <Chip t={t} at={S6.start + 0.6} exitAt={termOut} repo="trace" path=".github/workflows/pages.yml" line="29-37" x={right} y={Math.round(0.635 * H)} align="right" />
        <Chip t={t} at={typeAt + 0.5} exitAt={termOut} repo="trace" path="live/package.json" x={left} y={Math.round(0.635 * H)} />
        <Chip t={t} at={run2Type + 0.3} exitAt={termOut} repo="trace" path="live/tests/crosscheck.py" line="1-22" x={right} y={Math.round(0.685 * H)} align="right" />
        <Pill k={env(t, passAt + 0.3, 0.4, termOut)} x={left} y={Math.round(0.685 * H)} sizeH={0.022} tone={color.text.chipDim}>
          capture {dim('·')} {white('trace-check.txt')} {dim('·')} SHA-256 {mint(check.captureSha256.slice(0, 8) + '…')}
        </Pill>
      </>
    ),
  });
  acc.beat({id: 'calm', at: S6.start - 0.4, field: teal, sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.8, jitterS: 0.04}});
  acc.light.push({at: S6.start - 0.4, dur: 1.2, key: 0.88, spread: 1.1, poolAt: [-0.05, 0.02]});
  const termPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 140, yaw: 0.12, pitch: 0.06, aspect});
  acc.camera.push({at: S6.start - 0.4, dur: 1.4, pose: termPose, ease: 'camera'});

  // ---------------------------------------------------------------- the numbers, as pin bars
  const p1 = c.u('u0318').start - 0.1;
  const p2 = c.u('u0319').start - 0.2;
  const p3 = c.u('u0320').start - 0.2;
  const quoteAt = c.u('u0320').end + 0.15;
  const end = S7.start - 0.3;
  const chart = {u: 0.575, v: 0.36, height: 30};
  const bar = (x: number, value: number, lk: Look) => ({x, w: 7, value, look: lk});
  const GAP = 21;
  const WIN: Look = {h: 0.34, tint: LIT, glow: 0.55};
  const PLAIN: Look = {h: 0.26, tint: [0.82, 0.92, 0.9]};
  const MISS: Look = {h: 0.26, tint: 0.74};
  const site = traceData.siteGuard.f1;
  acc.beat({id: 'bars-f1', at: p1 + 0.2, field: barsAt(board, {...chart, bars: [bar(0, site, WIN), bar(GAP, 0.827, WIN), bar(2 * GAP, 0.8, PLAIN)]}, teal), sweep: {kind: 'linear', origin: [0.5, chart.v], direction: [0, 1], speed: 0.5, jitterS: 0.04}});
  acc.beat({id: 'bars-asr', at: c.w('u0319', 'beats'), field: barsAt(board, {...chart, bars: [bar(0, 1.0, PLAIN), bar(GAP, 0.0, WIN)]}, teal), sweep: {kind: 'linear', origin: [0.5, chart.v], direction: [0, 1], speed: 0.5, jitterS: 0.04}});
  acc.beat({id: 'bars-miss', at: p3 + 0.2, field: barsAt(board, {...chart, bars: [bar(0, 0.967, MISS), bar(GAP, 0.849, MISS)]}, teal), sweep: {kind: 'linear', origin: [0.5, chart.v], direction: [0, 1], speed: 0.5, jitterS: 0.04}});
  const fallAt = c.w('u0320', 'falls');
  acc.beat({id: 'bars-fall', at: fallAt, field: barsAt(board, {...chart, bars: [bar(0, 0.209, MISS), bar(GAP, 0.713, MISS)]}, teal)});
  acc.beat({id: 'bars-off', at: end, field: teal, sweep: {kind: 'linear', origin: [0.5, 0.9], direction: [0, -1], speed: 0.7, jitterS: 0.04}});
  const numPose = frameOn(board, {uv: [0.56, 0.5], pinsAcross: 128, yaw: 0.13, pitch: 0.07, aspect});
  acc.camera.push({at: p1 - 0.3, dur: 1.5, pose: numPose, ease: 'camera'}, {at: p1 + 1.3, dur: end - p1 - 1.3, pose: {...numPose, distance: numPose.distance * 0.95}, ease: 'inOutSine'});
  acc.light.push({at: p1 - 0.3, dur: 1.2, key: 1.0, spread: 1.2, poolAt: [0.12, -0.02]});

  // value labels under the bars, pinned to the pins
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  // each label sits just above its bar's top, so it never meets the captions
  const barTop = (xPins: number, value: number): [number, number, number] => [chart.u + (xPins + 3.5) * board.p - 0.5, chart.v * board.extH - board.extH / 2 + (value * chart.height + 1.2) * board.p, 0.3 * relief];
  const groups = [
    {from: p1 + 0.4, to: p2, labels: [['0.819', 'his site · seed 0', 0.819, 0.819], ['0.827', '12 seeds', 0.827, 0.827], ['0.800', 'best CPU baseline', 0.8, 0.8]] as Array<[string, string, number, number]>},
    {from: c.w('u0319', 'beats') + 0.3, to: p3, labels: [['1.000', 'per-call rule', 1, 1], ['0.000', 'TRACE', 0, 0]] as Array<[string, string, number, number]>},
    {from: p3 + 0.5, to: end, labels: [['0.967 → 0.209', 'jailbreak → injection', 0.967, 0.209], ['0.849 → 0.713', 'injection → jailbreak', 0.849, 0.713]] as Array<[string, string, number, number]>},
  ];
  acc.overlay({
    id: 'bar-labels',
    from: p1,
    to: end + 0.4,
    render: (t) => (
      <>
        {groups.map((g, gi) =>
          g.labels.map(([v, l, v0, v1], j) => {
            const kk = env(t, g.from + j * 0.2, 0.4, g.to - 0.3);
            if (kk <= 0.001) return null;
            const falling = gi === 2;
            const fallen = falling && t >= fallAt + 0.15;
            const [x, y] = projectToScreen(pose(t), barTop(j * GAP, fallen ? v1 : v0), W, H);
            const shown = falling && !fallen ? v.split(' → ')[0] : v;
            return (
              <div key={`${gi}-${j}`} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', textAlign: 'center', whiteSpace: 'nowrap', fontFamily: font.mono, lineHeight: 1.3, ...pullStyle(kk, H)}}>
                <div style={{fontSize: Math.round(0.022 * H), color: color.text.secondary}}>{l}</div>
                <div style={{fontSize: Math.round(0.03 * H), color: falling ? color.text.caption : color.text.key, fontWeight: 600}}>{shown}</div>
              </div>
            );
          }),
        )}
      </>
    ),
  });

  // the claims, each with its file
  const rows1: Row[] = [
    {at: c.w('u0318', 'site'), text: <>his site: seed 0 {dim('·')} F1 {white('0.819')} {dim('·')} 116 prompts</>, chips: [{path: 'live/trace-model.json', line: 1}]},
    {at: c.w('u0318', 'seed') + 0.4, text: <>12 seeds: F1 {white('0.827 ± 0.036')} {dim('(best CPU baseline 0.800)')}</>, chips: [{path: 'results/content_guard.json', line: '36-44'}, {path: 'results/content_guard.json', line: 186}]},
    {at: c.u('u0318').end - 0.4, small: true, text: <>200-clause model (E5): median {white('107 µs')} per check {dim('·')} {white('12.5 KiB')}</>, chips: [{path: 'results/systems_benchmark.json', line: '25-33'}]},
    {at: c.u('u0318').end - 0.1, small: true, text: <>12-seed run: mean of per-seed medians {white('176 µs')} {dim('·')} {white('4.9 µs')} per behaviour step</>, chips: [{path: 'results/content_guard.json', line: '82-84'}, {path: 'results/systems_benchmark.json', line: '64-72'}]},
  ];
  const rows2: Row[] = [
    {at: c.w('u0319', 'beats') + 0.2, text: <>slow-roll attack success: per-call {white('1.000')} {dim('→')} TRACE {mint('0.000')}</>, chips: [{path: 'results/behavior_trajectory.json', line: '93-94, 122-123'}]},
    {at: c.w('u0319', 'construction') - 0.1, text: <>{dim('synthetic sessions ·')} {italic('exact by construction')}, not a statistical result</>, chips: [{path: 'paper/trace.tex', line: '438-440'}]},
    {at: c.u('u0319').end + 0.1, small: true, text: <>tamper detection {white('1.0')} {dim('·')} 6 classes</>, chips: [{path: 'results/tamper_evidence.json', line: '12-32'}]},
  ];
  const rows3: Row[] = [
    {at: c.w('u0320', 'trained'), text: <>the miss: {white('0.967 → 0.209')} F1</>, chips: [{path: 'results/adaptive_robustness.json', line: '132-141'}]},
    {at: c.w('u0320', 'injections') + 0.1, small: true, text: <>trained on jailbreaks, tested on injections {dim('· single seed')}</>, chips: []},
  ];
  acc.overlay({
    id: 'claims',
    from: p1 - 0.2,
    to: end + 0.4,
    render: (t) => (
      <>
        <MonoKicker text="results/content_guard.json · systems_benchmark.json" x={left} y={Math.round(0.075 * H)} k={env(t, p1, 0.4, p2 - 0.2)} />
        <MonoKicker text="results/behavior_trajectory.json · tamper_evidence.json" x={left} y={Math.round(0.075 * H)} k={env(t, p2 + 0.2, 0.4, p3 - 0.2)} />
        <MonoKicker text="results/adaptive_robustness.json · the main failure" x={left} y={Math.round(0.075 * H)} k={env(t, p3 + 0.2, 0.4, end)} tone={color.text.secondary} />
        <ClaimColumn t={t} rows={rows1} x={left} y={Math.round(0.15 * H)} exitAt={p2 - 0.25} maxW={Math.round(0.5 * W)} repo="trace" />
        <ClaimColumn t={t} rows={rows2} x={left} y={Math.round(0.15 * H)} exitAt={p3 - 0.25} maxW={Math.round(0.5 * W)} repo="trace" />
        <ClaimColumn t={t} rows={rows3} x={left} y={Math.round(0.15 * H)} exitAt={end} maxW={Math.round(0.5 * W)} repo="trace" />
        <Quote t={t} at={quoteAt} exitAt={end} x={left} y={Math.round(0.43 * H)} w={Math.round(0.44 * W)} />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(typeAt), activity: 'debugging', detail: 'Run npm test, then python tests/crosscheck.py'},
    {frame: c.f(passAt + 0.1), activity: 'success', detail: 'as printed by crosscheck.py'},
    {frame: c.f(p1 + 0.5), activity: 'reading', detail: 'Read results/content_guard.json'},
  );
  return {passAt, typeAt, run1, run2, fallAt};
};

/** The README's own limitation line, quoted, held at least 3 s. */
const Quote: React.FC<{t: number; at: number; exitAt: number; x: number; y: number; w: number}> = ({t, at, exitAt, x, y, w}) => {
  const {H} = useFrameSize();
  const k = env(t, at, 0.5, exitAt);
  if (k <= 0.001) return null;
  const hair = Math.max(2, Math.round(H / 540));
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, ...pullStyle(k, H)}}>
      <div style={{borderLeft: `${hair}px solid ${color.text.secondary}`, paddingLeft: Math.round(0.022 * H)}}>
        <div style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.034 * H), lineHeight: 1.32, color: color.text.caption}}>
          “Distribution shift. The content guard learns dataset-specific lexical cues; cross-corpus F1 falls to near chance.”
        </div>
      </div>
      <div style={{marginTop: Math.round(0.03 * H), position: 'relative', height: Math.round(0.04 * H)}}>
        <Chip t={t} at={at + 0.4} exitAt={exitAt} repo="trace" path="README.md" line="126-128" x={0} y={Math.round(0.02 * H)} />
      </div>
    </div>
  );
};
