import React from 'react';
import {frameOn} from '../../../engine/camera';
import {font} from '../../../engine/tokens';
import {easeOutCubic, prog, useFontsReady} from '../../../engine/type';
import check from '../../../data/ch05/candor-check.json';
import {Terminal, lineAt, type TerminalRun} from '../ch03/kit/Terminal';
import {Chip, env, pullStyle, useFrameSize} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {INK_TEXT, MUTED_TEXT, TEAL_TEXT} from './common';
import {InkPill} from './s02';
import {paper} from './s01';
import {InkCard} from './ink';

// 05.5 the browser test from a fresh clone, run for real; every reported result written by a
// script (one number traced from the results file to the paper); the retitle; the payoff.

/** The path of one number: results/planted.json:16 → scripts/paper_numbers.py → _numbers.tex:14 → PDF. */
const STATIONS: Array<{file: string; text: string; mono?: boolean}> = [
  {file: 'results/planted.json:16', text: '0.002122985664755106', mono: true},
  {file: 'scripts/paper_numbers.py', text: 'writes every macro'},
  {file: 'paper/_numbers.tex:14', text: '{\\deltaMain}{0.0021}', mono: true},
  {file: 'paper/candor.tex:144', text: 'abstract: mean δ = 0.0021'},
];

const Tracer: React.FC<{t: number; at: number; step: number; exitAt: number; y: number}> = ({t, at, step, exitAt, y}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const k = env(t, at, 0.4, exitAt);
  if (k <= 0.001) return null;
  const x0 = 0.07 * W;
  const span = 0.86 * W;
  const n = STATIONS.length;
  const w = span / n - 0.02 * W;
  const sw = Math.max(2, H / 500);
  // the lit dot travels the line from station to station
  const p = Math.min(n - 1, Math.max(0, (t - at) / step));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: k}}>
      <div style={{position: 'absolute', left: 0.055 * W, top: y - 0.05 * H, width: 0.89 * W, height: 0.19 * H, borderRadius: Math.round(0.02 * H), background: 'rgba(246,252,250,0.95)', border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(11,135,123,0.38)`, boxShadow: `0 ${Math.round(0.01 * H)}px ${Math.round(0.04 * H)}px rgba(14,42,38,0.18)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <line x1={x0 + w / 2} y1={y} x2={x0 + w / 2 + (span / n) * p} y2={y} stroke={TEAL_TEXT} strokeWidth={sw} />
        <circle cx={x0 + w / 2 + (span / n) * p} cy={y} r={0.011 * H} fill={TEAL_TEXT} />
        <circle cx={x0 + w / 2 + (span / n) * p} cy={y} r={0.022 * H} fill={TEAL_TEXT} opacity={0.18} />
      </svg>
      {STATIONS.map((s, i) => {
        const kk = easeOutCubic(prog(t, at + i * step - 0.1, 0.35));
        return (
          <div key={i} style={{position: 'absolute', left: x0 + (span / n) * i, top: y + 0.035 * H, width: w, ...pullStyle(Math.min(kk, k), H)}}>
            <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: TEAL_TEXT, letterSpacing: '0.04em'}}>{s.file}</div>
            <div style={{fontFamily: s.mono ? font.mono : font.serif, fontStyle: s.mono ? 'normal' : 'italic', fontSize: Math.round((s.mono ? 0.022 : 0.03) * H), color: INK_TEXT, marginTop: Math.round(0.008 * H), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.text}</div>
          </div>
        );
      })}
    </div>
  );
};

/** The retitle: the first title struck through by the pencil's line, the new one set in. */
const Retitle: React.FC<{t: number; at: number; strikeAt: number; newAt: number; exitAt: number; x: number; y: number}> = ({t, at, strikeAt, newAt, exitAt, x, y}) => {
  const {H} = useFrameSize();
  const k = env(t, at, 0.4, exitAt);
  if (k <= 0.001) return null;
  const strike = easeOutCubic(prog(t, strikeAt, 0.7));
  const kNew = env(t, newAt, 0.45, exitAt);
  const fs = Math.round(0.042 * H);
  return (
    <InkCard k={k} x={x} y={y}>
      <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: MUTED_TEXT, letterSpacing: '0.06em'}}>candor commit 9bd90a9</div>
      <div style={{position: 'relative', display: 'inline-block', marginTop: Math.round(0.008 * H), fontFamily: font.serif, fontStyle: 'italic', fontSize: fs, color: strike > 0.5 ? MUTED_TEXT : INK_TEXT, whiteSpace: 'nowrap'}}>
        The Way Toward Interpretable AGI
        <span style={{position: 'absolute', left: 0, top: '55%', height: Math.max(2, Math.round(H / 400)), width: `${strike * 100}%`, background: '#E3B341'}} />
      </div>
      <div style={{marginTop: Math.round(0.03 * H), ...pullStyle(kNew, H)}}>
        <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: TEAL_TEXT, letterSpacing: '0.06em'}}>candor commit 68ff26b</div>
        <div style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: fs, color: INK_TEXT, marginTop: Math.round(0.008 * H), whiteSpace: 'nowrap'}}>The Explanation Is the Forward Pass</div>
        <div style={{fontFamily: font.sans, fontSize: Math.round(0.028 * H), color: MUTED_TEXT, marginTop: Math.round(0.014 * H), whiteSpace: 'nowrap'}}>“the previous working title overclaimed scope”</div>
      </div>
    </InkCard>
  );
};

export const buildCheckAndPayoff = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S5 = c.sc('05.5');
  const ch = c.tl.chapter('05');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);

  // ---------------------------------------------------------------- the terminal
  const termAt = S5.start - 0.1;
  const typeAt = S5.start + 0.4;
  const run: TerminalRun = {cmd: check.runs[0].cmd, typeAt, cps: 24, outAt: typeAt + check.runs[0].cmd.length / 24 + 0.7, output: check.runs[0].output, lps: 16};
  const passIdx = check.runs[0].output.findIndex((l) => l.startsWith('# pass'));
  const passAt = lineAt(run, passIdx);
  const termOut = c.w('u0518', 'script') - 0.2;
  acc.beat({id: 'quiet', at: S5.start - 0.4, field: paper(0.97), sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.9, jitterS: 0.04, tintFollowsWave: true}});
  const pose5 = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 140, yaw: 0.06, pitch: 0.04, aspect});
  acc.camera.push({at: S5.start - 0.5, dur: 1.4, pose: pose5, ease: 'camera'}, {at: S5.start + 0.9, dur: ch.end - S5.start - 3.4, pose: {...pose5, distance: pose5.distance * 0.95}, ease: 'inOutSine'});
  acc.overlay({
    id: 'terminal',
    from: termAt - 0.1,
    to: termOut + 0.5,
    render: (t) => (
      <>
        <Terminal t={t} at={termAt} exitAt={termOut} x={left} y={Math.round(0.115 * H)} w={Math.round(0.53 * W)} h={Math.round(0.56 * H)} title={`AnwarDebes/candor @ ${check.commit.slice(0, 7)} · fresh clone`} meta="29 Oct 2026" runs={[run]} />
        <Chip t={t} at={typeAt + 0.6} exitAt={termOut} repo="candor" path="live/tests/forward.test.mjs" line="9-21" x={right} y={Math.round(0.2 * H)} align="right" />
        <InkPill k={env(t, passAt + 0.2, 0.4, termOut)} x={right} y={Math.round(0.255 * H)} align="right" sizeH={0.022}>
          capture <span style={{color: MUTED_TEXT}}>·</span> candor-check.txt <span style={{color: MUTED_TEXT}}>· SHA-256</span> <span style={{color: TEAL_TEXT}}>{check.captureSha256.slice(0, 8)}…</span>
        </InkPill>
        <InkPill k={env(t, termAt, 0.4, termOut)} x={left} y={Math.round(0.07 * H)} sizeH={0.022}>
          fresh clone <span style={{color: MUTED_TEXT}}>·</span> node --test live/tests/forward.test.mjs <span style={{color: MUTED_TEXT}}>· output as printed</span>
        </InkPill>
      </>
    ),
  });

  // ---------------------------------------------------------------- every reported result written by a script
  const traceAt = c.w('u0518', 'script');
  const step = Math.max(0.55, (c.u('u0518').end - traceAt - 0.4) / 3);
  const traceOut = c.u('u0519').start - 0.25;
  acc.overlay({
    id: 'tracer',
    from: traceAt - 0.2,
    to: traceOut + 0.5,
    render: (t) => (
      <>
        <Tracer t={t} at={traceAt} step={step} exitAt={traceOut} y={Math.round(0.47 * H)} />
        <InkPill k={env(t, c.w('u0518', 'sixty-five') - 0.3, 0.4, traceOut)} x={left} y={Math.round(0.15 * H)} sizeH={0.026}>
          % do not edit by hand <span style={{color: MUTED_TEXT}}>·</span> <b>165</b> macros
        </InkPill>
        <Chip t={t} at={traceAt + 0.4} exitAt={traceOut} repo="candor" path="paper/_numbers.tex" line="1, 14" x={left} y={Math.round(0.21 * H)} />
        <Chip t={t} at={traceAt + 0.7} exitAt={traceOut} repo="candor" path="scripts/paper_numbers.py" line="1-5" x={left} y={Math.round(0.255 * H)} />
        <Chip t={t} at={traceAt + 1.0} exitAt={traceOut} repo="candor" path="README.md" line="49-51" x={left} y={Math.round(0.3 * H)} />
        <Chip t={t} at={traceAt + 1.3} exitAt={traceOut} repo="candor" path="paper/candor.tex" line={144} x={left} y={Math.round(0.345 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- the retitle, then the share card's line
  const retAt = c.u('u0519').start - 0.1;
  const strikeAt = c.w('u0519', 'retitled');
  const newAt = c.w('u0519', 'overclaimed');
  const retOut = c.u('u0520').start - 0.05;
  acc.overlay({
    id: 'retitle',
    from: retAt - 0.2,
    to: retOut + 0.5,
    render: (t) => (
      <>
        <Retitle t={t} at={retAt} strikeAt={strikeAt} newAt={newAt} exitAt={retOut} x={left} y={Math.round(0.2 * H)} />
        <Chip t={t} at={newAt + 0.4} exitAt={retOut} repo="candor" path="CHANGELOG.md" line="108-109" x={left} y={Math.round(0.6 * H)} />
        <Chip t={t} at={strikeAt + 0.3} exitAt={retOut} repo="candor" path="commit 9bd90a9 → 68ff26b" x={left} y={Math.round(0.645 * H)} />
      </>
    ),
  });
  acc.captionSkip.push('u0520');
  const u = c.u('u0520');
  const split = u.words.findIndex((w) => w.text.toLowerCase().startsWith('and'));
  acc.overlay({
    id: 'payoff',
    from: u.start - 0.2,
    to: ch.end - 0.2,
    render: (t) => <Payoff t={t} words={u.words} split={split} exitAt={ch.end - 1.2} x={left} />,
  });

  acc.pixie.push(
    {frame: c.f(typeAt), activity: 'debugging', detail: 'Run node --test live/tests/forward.test.mjs'},
    {frame: c.f(passAt + 0.1), activity: 'success', detail: 'as printed by node --test'},
    {frame: c.f(traceAt), activity: 'reading', detail: 'Read paper/_numbers.tex'},
    {frame: c.f(strikeAt - 0.2), activity: 'writing', detail: 'Edit the paper title'},
    {frame: c.f(u.start), activity: 'idle', detail: ''},
  );
  return {typeAt, passAt, run, traceAt, step, strikeAt, newAt};
};

/** The payoff in the share card's teal: words land as they are spoken. */
const Payoff: React.FC<{t: number; words: ReadonlyArray<{text: string; start: number; tag: string}>; split: number; exitAt: number; x: number}> = ({t, words, split, exitAt, x}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const out = 1 - easeOutCubic(prog(t, exitAt, 0.4));
  if (out <= 0) return null;
  const line = (ws: typeof words, y: number, size: number, col: string) => (
    <div style={{position: 'absolute', left: x, top: y, fontFamily: font.sans, fontWeight: 650, fontSize: size, letterSpacing: '-0.03em', color: col, whiteSpace: 'nowrap', opacity: out, textShadow: `0 0 ${Math.round(0.02 * H)}px rgba(246,252,250,0.95), 0 0 ${Math.round(0.05 * H)}px rgba(246,252,250,0.8)`}}>
      {ws.map((w, i) => {
        const k = easeOutCubic(prog(t, w.start - 0.04, 0.25));
        const blur = (1 - k) * 6 * (H / 1080);
        const em = w.tag === 'em';
        return (
          <React.Fragment key={i}>
            <span style={{display: 'inline-block', opacity: k, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined, ...(em ? {fontFamily: font.serif, fontStyle: 'italic', fontWeight: 400, fontSize: size * font.emScale, color: TEAL_TEXT} : {})}}>{w.text}</span>
            {i < ws.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </div>
  );
  return (
    <>
      {line(words.slice(0, split), Math.round(0.36 * H), Math.round(0.082 * H), TEAL_TEXT)}
      {line(words.slice(split), Math.round(0.48 * H), Math.round(0.06 * H), INK_TEXT)}
    </>
  );
};

