import React from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, type Beat, type LiveLayer} from '../../../engine/pins';
import {dolly, pushIn, type CameraKey} from '../../../engine/camera';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import npmTest from '../../../data/ch07/npm-test.json';
import {poseOn, uvAtScreen} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {Card, Cite, MissDot, WinDot, mono, pullK, pullStyle, riseK} from './kit/ui';
import {warmFlat} from './look';
import type {Times07} from './times';

// 07.5 The independent check, real and on camera: npm test from a fresh clone of
// Claude-Code-In-Motion at 2c79ee0, captured on this laptop (src/data/ch07/npm-test.*); the terminal
// card replays exactly what was printed. Beside it the numbers, the misses at the same size, and a
// mint thread back along the wall to the website, whose mascot file is this one plus a header.

type Seg = [string, string];
const LINES = npmTest.lines as unknown as Seg[][];
const SEG_COLOR: Record<string, string> = {'': '#D9D4CC', pass: '#7db36a', dim: '#7d7a74', info: '#7aa2d9', bold: '#EDEDED'};

const Terminal: React.FC<{t: number; T: Times07; x: number; y: number; w: number; rows: number}> = ({t, T, x, y, w, rows}) => {
  const {height: H} = useVideoConfig();
  const {t5} = T;
  const k = riseK(t, t5.term, t5.thread + 0.2);
  if (k <= 0) return null;
  const fs = Math.round(0.022 * H);
  const lh = Math.round(fs * 1.42);
  const pad = Math.round(0.022 * H);
  const head = Math.round(0.05 * H);
  // the command types, npm's own spinner turns (the six frames it printed), then the lines print
  const cmd = '$ npm test';
  const typed = Math.max(0, Math.min(cmd.length, Math.floor((t - t5.typeCmd) * 16)));
  const printFrom = t5.typeCmd + cmd.length / 16 + 0.45;
  const printTo = Math.max(printFrom + 2.5, t5.tally - 0.25);
  const n = LINES.length;
  const shown = t < printFrom ? 0 : Math.min(n, Math.ceil(prog(t, printFrom, printTo - printFrom) * n));
  const spinning = t >= t5.typeCmd + cmd.length / 16 && t < printFrom + 0.2;
  const SPIN = ['⠙', '⠹', '⠸', '⠼', '⠴', '⠦'];
  const spin = SPIN[Math.floor((t - t5.typeCmd) / 0.08) % SPIN.length];
  const all: Seg[][] = [[['$ ', 'dim'], ['npm test'.slice(0, Math.max(0, typed - 2)), 'bold']], ...LINES.slice(0, shown)];
  const first = Math.max(0, all.length - rows);
  const tallyK = easeOutCubic(prog(t, printTo, 0.4));
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y + (1 - k) * 0.014 * H), width: Math.round(w), height: head + pad * 2 + rows * lh, opacity: k, borderRadius: Math.round(H * layout.windowRadiusH), background: '#0C0B0A', border: `1px solid ${color.card.rule}`, boxShadow: `0 ${Math.round(0.02 * H)}px ${Math.round(0.07 * H)}px rgba(0,0,0,0.55)`, overflow: 'hidden'}}>
      <div style={{height: head, display: 'flex', alignItems: 'center', gap: Math.round(0.01 * H), padding: `0 ${pad}px`, background: '#171513', borderBottom: `1px solid ${color.card.rule}`}}>
        {['#5a5550', '#5a5550', '#5a5550'].map((c, i) => (
          <span key={i} style={{width: Math.round(0.011 * H), height: Math.round(0.011 * H), borderRadius: 99, background: c}} />
        ))}
        <span style={{...mono(H, Ty.monoKicker.size, 500), color: color.text.chipDim, marginLeft: Math.round(0.01 * H)}}>
          <span style={{color: color.accent.mint}}>{'Claude-Code-In-Motion'}</span>
          {` @ ${npmTest.commit.slice(0, 7)} · ${npmTest.startedAt.slice(0, 10)} · WSL2`}
        </span>
      </div>
      <div style={{position: 'relative', padding: pad}}>
        {all.slice(first).map((segs, i) => {
          const plain = segs.map((s) => s[0]).join('');
          const isTally = /^ℹ (tests|pass|fail) /.test(plain);
          return (
            <div key={first + i} style={{height: lh, ...mono(H, 0.022, 450), lineHeight: `${lh}px`, color: SEG_COLOR['']}}>
              {segs.map((s, j) => (
                <span key={j} style={{color: isTally && /pass|fail/.test(plain) ? (plain.includes('pass') ? color.accent.mint : SEG_COLOR.info) : SEG_COLOR[s[1]] ?? SEG_COLOR[''], fontWeight: isTally ? 600 : undefined, opacity: isTally ? 0.6 + 0.4 * tallyK : 1}}>
                  {s[0]}
                </span>
              ))}
              {first + i === 0 && spinning ? <span style={{color: SEG_COLOR.dim}}>{` ${spin}`}</span> : null}
              {first + i === 0 && typed < cmd.length && Math.floor(t / 0.45) % 2 === 0 ? <span style={{color: color.accent.mint}}>{'▌'}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const NumbersCard: React.FC<{t: number; at: number; out: number; x: number; y: number; w: number}> = ({t, at, out, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  const c = (i: number) => easeOutCubic(prog(t, at + 0.25 + i * 0.25, 0.9));
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
  const big: React.CSSProperties = {...mono(H, 0.032, 600), color: color.text.key, fontVariantNumeric: 'tabular-nums'};
  const small: React.CSSProperties = {...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim};
  const dot = <span style={{...small, color: color.text.tertiary}}>{' · '}</span>;
  return (
    <Card t={t} at={at} out={out} x={x} y={y} w={w} label="the numbers">
      <div style={{display: 'flex', alignItems: 'baseline', gap: Math.round(0.01 * H)}}>
        <span style={big}>{`${fmt(150 * c(0))} ms`}</span>
        <span style={small}>{'dwell'}</span>
        {dot}
        <span style={big}>{`${fmt(1500 * c(1))} ms`}</span>
        <span style={small}>{'one-shots'}</span>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: Math.round(0.01 * H), marginTop: Math.round(0.01 * H)}}>
        <span style={big}>{fmt(2000 * c(2))}</span>
        <span style={small}>{'-event replay buffer'}</span>
        <span style={{...small, marginLeft: Math.round(0.012 * H)}}>{'binds'}</span>
        <span style={{...small, color: color.text.key, fontWeight: 600}}>{'127.0.0.1'}</span>
      </div>
    </Card>
  );
};

const MissesCard: React.FC<{t: number; at: number; out: number; x: number; y: number; w: number}> = ({t, at, out, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  const row = (text: React.ReactNode, i: number) => (
    <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: Math.round(0.014 * H), marginTop: i ? Math.round(0.012 * H) : 0}}>
      <span style={{marginTop: Math.round(0.006 * H)}}>
        <MissDot H={H} />
      </span>
      <span style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, whiteSpace: 'normal', lineHeight: 1.4}}>{text}</span>
    </div>
  );
  return (
    <Card t={t} at={at} out={out} x={x} y={y} w={w} label="the misses" labelTone={color.text.secondary}>
      {row('read-only commands run without asking', 0)}
      {row('--yolo auto-approves all but the catastrophic', 1)}
      {row('‘acts out every step’: list_dir and glob share one pose', 2)}
    </Card>
  );
};

/** The header the website adds, and the check that the rest is the same file. */
const CopyCard: React.FC<{t: number; at: number; out: number; x: number; y: number; w: number}> = ({t, at, out, x, y, w}) => {
  const {height: H} = useVideoConfig();
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  const typed = Math.floor(prog(t, at + 0.9, 1.0) * 200);
  const cmd = '$ tail -n +4 AnwarDebes.github.io/assets/js/pixie-mascot.js | diff - Claude-Code-In-Motion/web/js/mascot.js';
  return (
    <Card t={t} at={at} out={out} x={x} y={y} w={w} label="the website's copy of the mascot">
      <div style={{...mono(H, 0.022, 500), color: color.text.display, marginBottom: Math.round(0.012 * H)}}>{'assets/js/pixie-mascot.js = web/js/mascot.js + 3-line header'}</div>
      <div style={{...mono(H, 0.022, 450), color: '#a7a198', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
        <div>
          <span style={{color: color.text.tertiary}}>{'1  '}</span>
          {'// Pixie the mascot, from Claude Code, in motion (MIT, by Anwar Debes):'}
        </div>
        <div>
          <span style={{color: color.text.tertiary}}>{'2  '}</span>
          {'// https://github.com/AnwarDebes/Claude-Code-In-Motion/blob/main/web/js/mascot.js'}
        </div>
        <div>
          <span style={{color: color.text.tertiary}}>{'3  '}</span>
        </div>
      </div>
      <div style={{...mono(H, 0.022, 450), color: '#D9D4CC', marginTop: Math.round(0.014 * H), whiteSpace: 'normal', lineHeight: 1.45}}>
        {cmd.slice(0, typed)}
        {typed >= cmd.length ? (
          <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H), marginTop: Math.round(0.006 * H), color: color.accent.mint, opacity: easeOutCubic(prog(t, at + 2.1, 0.3))}}>
            <WinDot H={H} size={0.013} />
            {'no output: the other 360 lines are identical'}
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export const scene0705 = (ctx: FilmCtx, T: Times07): PartSpec => {
  const {width: W, height: H, board} = ctx;
  const {t5} = T;
  const pose = poseOn(ctx, {uv: [0.5, 0.5], pinsAcross: 152, yaw: 0.07, pitch: 0.05});
  // a mint thread of lit pins runs from this place back along the wall, toward chapter 01
  const [u0, v0] = uvAtScreen(board, pose, 0.97, 0.688, W / H);
  const [u1] = uvAtScreen(board, pose, -0.06, 0.688, W / H);
  const from = t5.thread + 0.2;
  const dur = 2.6;
  const rowH = board.rowH / board.extH;
  const threadPin = {h: 0, tint: [0, 0, 0] as [number, number, number], glow: 0};
  const thread: LiveLayer = {
    fn: (u, v, _i, t) => {
      const head = Math.min(1, Math.max(0, (t - from) / dur));
      const k = (u0 - u) / (u0 - u1);
      if (k < 0 || k > head) return null;
      const wave = v0 + 0.012 * Math.sin(k * Math.PI * 3);
      if (Math.abs(v - wave) > rowH * 0.9) return null;
      const tail = Math.max(0, 1 - (head - k) * 1.6);
      const lit = 0.35 + 0.65 * tail;
      threadPin.h = 0.05 + 0.05 * tail;
      threadPin.tint[0] = 0.55 + 0.4 * lit;
      threadPin.tint[1] = 0.9 + 0.1 * lit;
      threadPin.tint[2] = 0.8 + 0.12 * lit;
      threadPin.glow = lit;
      return threadPin;
    },
    from,
    to: t5.out + 0.4,
    fadeS: 0.5,
    region: [Math.min(u0, u1) - 0.01, v0 - 0.03, Math.max(u0, u1) + 0.01, v0 + 0.03],
    speedHint: (t) => (t > from && t < from + dur ? 0.6 : 0),
  };
  const beats: Beat[] = [{id: 'c07-tests-wall', at: t5.term - 0.3, field: warmFlat, sweep: SWEEPS.from([0.5, 0.5], 1.4, 0.05)}];
  const camera: CameraKey[] = [
    {at: t5.term - 0.4, dur: 1.1, pose, ease: 'camera'},
    {at: t5.term + 0.7, dur: Math.max(1, t5.thread - t5.term - 0.7), pose: pushIn(pose, 0.03), ease: 'inOutSine'},
    // ride the thread a little, left along the wall
    {at: t5.thread, dur: Math.max(1, t5.out - t5.thread), pose: dolly(pushIn(pose, 0.03), -0.035, 0), ease: 'camera'},
  ];
  const light = [{at: t5.term - 0.3, dur: 1.2, poolAt: [-0.05, 0.02] as [number, number], spread: 1.3, key: 1.0}];

  const x = Math.round(W * layout.marginLeftW);
  const termW = Math.round(W * 0.5);
  const rightX = Math.round(W * 0.566);
  const rightW = Math.round(W * (0.931 - 0.566));
  const overlays: TimedNode[] = [
    {id: 'c07-terminal', from: t5.term, to: t5.thread + 0.7, render: (t) => <Terminal t={t} T={T} x={x} y={Math.round(0.1 * H)} w={termW} rows={13} />},
    {id: 'c07-numbers', from: t5.cards, to: t5.out + 0.4, render: (t) => <NumbersCard t={t} at={t5.cards} out={t5.out} x={rightX} y={Math.round(0.085 * H)} w={rightW} />},
    {id: 'c07-misses', from: t5.cards + 0.5, to: t5.out + 0.4, render: (t) => <MissesCard t={t} at={t5.cards + 0.6} out={t5.out} x={rightX} y={Math.round(0.285 * H)} w={rightW} />},
    {id: 'c07-copy', from: t5.thread, to: t5.out + 0.4, render: (t) => <CopyCard t={t} at={t5.thread + 0.4} out={t5.out} x={x} y={Math.round(0.2 * H)} w={Math.round(W * 0.485)} />},
    {
      id: 'c07-tests-cites',
      from: t5.tally - 0.5,
      to: t5.out + 0.4,
      render: (t) => (
        <>
          <RunLabel t={t} at={t5.term + 0.4} out={t5.thread} x={x} y={Math.round(0.6 * H)} />
          <Cite t={t} repo="Claude-Code-In-Motion" path="package.json" line={12} at={t5.tally} out={t5.thread} x={x} y={Math.round(0.665 * H)} />
          <TallyChip t={t} at={t5.tally + 0.1} out={t5.thread} x={x + Math.round(0.33 * W)} y={Math.round(0.665 * H)} />
          {/* the sources of the numbers and the misses, one after another, each held 3 s or more */}
          {(() => {
            const span = Math.max(9.5, t5.out - t5.cards);
            const third = span / 3;
            const A: Array<[string, string]> = [['web/js/mascot.js', '27-28'], ['src/events.js', '5'], ['src/server.js', '72-73']];
            const B: Array<[string, string]> = [['src/safety.js', '188'], ['README.md', '126'], ['src/tools/fs-tools.js', '148']];
            return (
              <>
                {A.map(([path, line], k) => (
                  <Cite key={path} t={t} repo="Claude-Code-In-Motion" path={path} line={line} at={t5.cards + 0.3 + k * third} out={k < 2 ? t5.cards + 0.3 + (k + 1) * third - 0.35 : t5.out} x={W * 0.931} y={Math.round(0.6 * H)} align="right" />
                ))}
                {B.map(([path, line], k) => (
                  <Cite key={path} t={t} repo="Claude-Code-In-Motion" path={path} line={line} at={t5.cards + 1.0 + k * third} out={k < 2 ? t5.cards + 1.0 + (k + 1) * third - 0.35 : t5.out} x={W * 0.931} y={Math.round(0.64 * H)} align="right" />
                ))}
              </>
            );
          })()}
          <Cite t={t} repo="AnwarDebes.github.io" path="assets/js/pixie-mascot.js" line="1-3" at={t5.header} out={t5.out} x={x} y={Math.round(0.64 * H)} />
        </>
      ),
    },
  ];
  return {beats, live: [thread], camera, light, overlays};
};

const RunLabel: React.FC<{t: number; at: number; out: number; x: number; y: number}> = ({t, at, out, x, y}) => {
  const {height: H} = useVideoConfig();
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y), ...pullStyle(k, H), ...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.accent.mintLabel}}>
      {'fresh clone · npm test · 32 tests · tally as printed'}
    </div>
  );
};

/** The capture the tally comes from, as a ledger entry (its SHA-256, computed when it was made). */
const TallyChip: React.FC<{t: number; at: number; out: number; x: number; y: number}> = ({t, at, out, x, y}) => {
  const {height: H} = useVideoConfig();
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y - 0.019 * H), ...pullStyle(k, H), ...mono(H, Ty.monoKicker.size, 450), color: color.text.chipDim, padding: `${Math.round(0.008 * H)}px ${Math.round(0.016 * H)}px`, borderRadius: 999, background: 'rgba(19,19,19,0.9)', border: `1px solid ${color.card.rule}`}}>
      <span style={{color: color.text.secondary}}>{'capture '}</span>
      {`sha256 ${npmTest.capture.sha256.slice(0, 12)}…`}
    </div>
  );
};
