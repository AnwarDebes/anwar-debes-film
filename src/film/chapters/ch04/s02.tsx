import React from 'react';
import {random} from 'remotion';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, emblemField, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import type {CodeSnippet} from '../../../engine/code/types';
import verify from '../../../data/ch04/code/veritas-verify.json';
import {ground, layers, pinLattice, pinsField} from '../ch03/kit/fields';
import {Chip, MonoKicker, NamePlate, Pill, clamp01, dim, env, mint, pullStyle, useFrameSize} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {CLAIM, LIT, NAVY} from './common';
import {FIELD_TL} from './s01';

// 04.2 the veritas place: the guard compiled into exact logic, the claim, and the solver asked for
// its opposite.

const verifySnippet = verify as unknown as CodeSnippet;

/** The browser prover's pipeline, file by file (veritas/live). */
const PIPE: Array<{name: string; what: string; lines: string}> = [
  {name: 'trace-model.json', what: 'the shipped guard', lines: '200 clauses'},
  {name: 'logic.js', what: 'gates and a counter', lines: '98 lines'},
  {name: 'cdcl.js', what: 'a SAT solver', lines: '136 lines'},
  {name: 'rup.js', what: 'proof checker', lines: '68 lines'},
  {name: 'index.html', what: 'the page', lines: 'UNSAT · SAT'},
];

const Pipeline: React.FC<{t: number; at: number; step: number; exitAt: number; y: number}> = ({t, at, step, exitAt, y}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const n = PIPE.length;
  const x0 = Math.round(0.07 * W);
  const span = Math.round(0.86 * W);
  const gap = Math.round(0.022 * W);
  const w = Math.round((span - gap * (n - 1)) / n);
  const h = Math.round(0.135 * H);
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {PIPE.slice(1).map((_, i) => {
          const k = clamp01((t - (at + (i + 1) * step - 0.25)) / 0.35) * (1 - clamp01((t - exitAt) / 0.35));
          const xa = x0 + (i + 1) * (w + gap) - gap + 4;
          const xb = x0 + (i + 1) * (w + gap) - 6;
          const yy = y + h / 2;
          return (
            <g key={i} opacity={k}>
              <line x1={xa} y1={yy} x2={xa + (xb - xa) * k} y2={yy} stroke={color.accent.mint} strokeWidth={Math.max(2, H / 540)} />
              <path d={`M ${xb - 9} ${yy - 6} L ${xb} ${yy} L ${xb - 9} ${yy + 6}`} fill="none" stroke={color.accent.mint} strokeWidth={Math.max(2, H / 540)} opacity={k > 0.95 ? 1 : 0} />
            </g>
          );
        })}
      </svg>
      {PIPE.map((p, i) => {
        const k = env(t, at + i * step, 0.4, exitAt);
        if (k <= 0.001) return null;
        return (
          <div
            key={p.name}
            style={{
              position: 'absolute',
              left: x0 + i * (w + gap),
              top: y,
              width: w,
              height: h,
              boxSizing: 'border-box',
              padding: Math.round(0.018 * H),
              borderRadius: Math.round(0.015 * H),
              background: 'rgba(7,12,18,0.92)',
              border: `${hair}px solid ${color.card.ruleStrong}`,
              ...pullStyle(k, H),
            }}
          >
            <div style={{fontFamily: font.mono, fontSize: Math.round(0.026 * H), fontWeight: 600, color: color.text.display, whiteSpace: 'nowrap'}}>{p.name}</div>
            <div style={{fontFamily: font.sans, fontSize: Math.round(0.026 * H), color: color.text.secondary, marginTop: Math.round(0.008 * H), whiteSpace: 'nowrap'}}>{p.what}</div>
            <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.accent.mintLabel, marginTop: Math.round(0.008 * H), whiteSpace: 'nowrap'}}>{p.lines}</div>
          </div>
        );
      })}
    </>
  );
};

export const buildPlace = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S2 = c.sc('04.2');
  const S3 = c.sc('04.3');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);
  const navy = ground(NAVY);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- the place: the ⊨ emblem in pins
  const emblemAt = {u: 0.705, v: 0.5, height: 58};
  const emblem = emblemField(board, 'veritas', emblemAt, {ground: NAVY[1] * 0.85, glowAbove: 0.95});
  const withEmblem = layers(navy, (u, v, i) => (Math.abs(u - emblemAt.u) < 0.2 && Math.abs(v - emblemAt.v) < 0.3 ? (() => {
    const s = emblem(u, v, i);
    return s.h > 0.01 ? {...s, tint: s.h > 0.95 ? LIT : [0.75, 0.9, 1.05]} : null;
  })() : null));
  acc.beat({id: 'emblem', at: S2.start - 0.35, field: withEmblem, sweep: {origin: [emblemAt.u, emblemAt.v], speed: 0.6, jitterS: 0.07}});
  const placePose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 136, yaw: 0.13, pitch: 0.07, aspect});
  acc.camera.push({at: S2.start - 0.5, dur: 1.6, pose: placePose, ease: 'camera'}, {at: S2.start + 1.2, dur: c.u('u0405').end - S2.start - 1.0, pose: {...placePose, distance: placePose.distance * 0.955}, ease: 'inOutSine'});
  acc.light.push({at: S2.start - 0.5, dur: 1.2, key: 1.02, spread: 1.2, poolAt: [0.12, 0], look: [0.1, 0]});

  const plateAt = S2.start + 0.25;
  acc.overlay({id: 'plate', from: plateAt, to: c.u('u0405').start + 0.4, render: (t) => <NamePlate t={t} at={plateAt} exitAt={c.u('u0405').start - 0.25} name="veritas" status="research prototype · paper draft · live prover" />});

  // ---------------------------------------------------------------- the pipeline, from the real module graph
  const pipeAt = c.u('u0405').start - 0.05;
  const pipeOut = c.u('u0406').start - 0.35;
  acc.overlay({
    id: 'pipeline',
    from: pipeAt - 0.2,
    to: pipeOut + 0.5,
    render: (t) => (
      <>
        <MonoKicker text="veritas/live · the guard as exact logic" x={left} y={Math.round(0.075 * H)} k={env(t, pipeAt, 0.4, pipeOut)} />
        <Pipeline t={t} at={pipeAt} step={0.24} exitAt={pipeOut} y={Math.round(0.17 * H)} />
        <Pill k={env(t, c.w('u0405', 'gate'), 0.4, pipeOut)} x={left} y={Math.round(0.4 * H)} sizeH={0.03} border="rgba(116,201,174,0.55)">
          clause {dim('→')} {mint('gate')} {dim('·')} vote {dim('→')} {mint('counter')} {dim('·')} about 21,000 variables and 48,000 clauses
        </Pill>
        <Chip t={t} at={c.w('u0405', 'gate') + 0.3} exitAt={pipeOut} repo="veritas" path="live/logic.js" line="17-90" x={left} y={Math.round(0.47 * H)} />
        <Chip t={t} at={c.w('u0405', 'counter') + 0.5} exitAt={pipeOut} repo="veritas" path="live/index.html" line={154} x={left} y={Math.round(0.515 * H)} />
        <Chip t={t} at={c.w('u0405', 'counter') + 0.2} exitAt={pipeOut} repo="veritas" path="veritaskit/encode.py" line="3-6" x={left + Math.round(0.21 * W)} y={Math.round(0.47 * H)} />
        <Chip t={t} at={pipeAt + 1.3} exitAt={pipeOut} repo="veritas" path="live/cdcl.js" line="1-131" x={left + Math.round(0.42 * W)} y={Math.round(0.47 * H)} />
        <Pill k={env(t, pipeAt + 1.6, 0.4, pipeOut)} x={right} y={Math.round(0.555 * H)} align="right" sizeH={0.022} tone={color.text.secondary}>
          exact encoding: Przybysz et al. 2023 {dim('(cited, not claimed)')}
        </Pill>
        <Chip t={t} at={pipeAt + 1.9} exitAt={pipeOut} repo="veritas" path="README.md" line="61-66" x={right} y={Math.round(0.61 * H)} align="right" />
      </>
    ),
  });

  // ---------------------------------------------------------------- the claim: three words locked
  const lattice = pinLattice(board, FIELD_TL, 16, 16, 2);
  const locked = [CLAIM.ignore, CLAIM.previous, CLAIM.instructions];
  const DIM: Look = {h: 0.06, tint: [0.42, 0.55, 0.72]};
  const ON: Look = {h: 0.36, tint: [0.84, 1.0, 1.06], glow: 0.35};
  const LOCK: Look = {h: 0.5, tint: LIT, glow: 1};
  const fieldOf = (seed: string | null) => {
    const m = new Map<number, Look>();
    for (let i = 0; i < 256; i++) {
      const p = lattice[i];
      if (p < 0) continue;
      if (locked.includes(i)) m.set(p, LOCK);
      else m.set(p, seed && random(`${seed}-${i}`) < 0.3 ? ON : DIM);
    }
    return pinsField(m, navy);
  };
  const claimAt = c.w('u0406', 'claim') - 0.1;
  acc.beat({id: 'claim-field', at: claimAt - 0.25, field: fieldOf(null), sweep: {origin: [0.6, 0.5], speed: 0.8, jitterS: 0.05}});
  // the solver's search: waves of pins flickering on and off around the three locked words
  const searchFrom = c.w('u0407', 'opposite');
  const searchTo = S2.end - 0.6;
  const waves = Math.min(16, Math.floor((searchTo - searchFrom) / 0.42));
  const waveTimes = Array.from({length: waves}, (_, j) => searchFrom + j * ((searchTo - searchFrom) / waves));
  waveTimes.forEach((at, j) => acc.beat({id: `search-${j}`, at, field: fieldOf(`c04-search-${j}`), sweep: {origin: [0.6 + 0.06 * Math.sin(j * 1.7), 0.5], speed: 1.6, jitterS: 0.05}}));
  acc.beat({id: 'search-end', at: searchTo, field: fieldOf(null)});

  const fieldPose = frameOn(board, {uv: [0.61, 0.56], pinsAcross: 132, yaw: 0.12, pitch: 0.06, aspect, screen: [0.73, 0.5]});
  acc.camera.push({at: claimAt - 0.5, dur: 1.5, pose: fieldPose, ease: 'camera'}, {at: claimAt + 1.0, dur: S2.end - claimAt - 1.2, pose: {...fieldPose, distance: fieldPose.distance * 0.95}, ease: 'inOutSine'});

  // the three locked pins carry their words (the only labels on the field)
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  const pinPoint = (i: number): [number, number, number] => {
    const p = lattice[i];
    return [board.u[p] - 0.5, board.v[p] * board.extH - board.extH / 2, 0.5 * relief];
  };
  acc.overlay({
    id: 'claim',
    from: claimAt - 0.2,
    to: S3.start + 0.3,
    render: (t) => (
      <>
        <Formula t={t} at={claimAt} exitAt={S3.start - 0.3} x={left} y={Math.round(0.085 * H)} />
        {(['ignore', 'previous', 'instructions'] as const).map((w, j) => {
          const [x, y] = projectToScreen(pose(t), pinPoint(CLAIM[w]), W, H);
          const kk = env(t, c.w('u0406', w) - 0.05, 0.35, S3.start - 0.3);
          if (kk <= 0.001) return null;
          return (
            <div key={w} style={{position: 'absolute', left: x, top: y - Math.round(0.035 * H) - j * 0, transform: 'translate(-50%, -100%)', fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: color.accent.mint, whiteSpace: 'nowrap', textShadow: '0 0 10px rgba(0,0,0,0.9)', ...pullStyle(kk, H)}}>
              {w}
            </div>
          );
        })}
        <Pill k={env(t, c.w('u0407', 'opposite'), 0.4, S3.start - 0.3)} x={left} y={Math.round(0.24 * H)} sizeH={0.028}>
          ask for: pre {mint('∧')} ¬post
        </Pill>
        <Pill k={env(t, c.w('u0408', 'proof'), 0.4, S3.start - 0.3)} x={left} y={Math.round(0.3 * H)} sizeH={0.022}>
          {mint('UNSAT')} = proof over all inputs {dim('·')} <span style={{color: color.signal.amber}}>SAT</span> = the exact counterexample
        </Pill>
        <Chip t={t} at={claimAt + 0.6} exitAt={S3.start - 0.3} repo="veritas" path="README.md" line={41} x={left} y={Math.round(0.175 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- the code: the solver, asked for the opposite
  const codeAt = c.w('u0407', 'solver') - 0.2;
  const codeOut = S3.start - 0.3;
  const pages: CodePage[] = [
    {
      at: codeAt,
      source: {snippet: verifySnippet, lines: [119, 124]},
      dedent: 8,
      zoom: 0.74,
      width: Math.round(0.42 * W),
      header: {label: 'veritas', path: 'veritaskit/verify.py', meta: '111-135'},
      cues: [cue.reveal(codeAt + 0.1, {stagger: 0.04}), cue.highlight(c.w('u0407', 'opposite'), [119, 120], {until: c.w('u0408', 'none') - 0.4})],
    },
    {
      at: c.w('u0408', 'none') - 0.4,
      transitionDur: 0.45,
      source: {snippet: verifySnippet, lines: [126, 134]},
      dedent: 8,
      zoom: 0.74,
      width: Math.round(0.42 * W),
      header: {label: 'veritas', path: 'veritaskit/verify.py', meta: '111-135'},
      cues: [cue.highlight(c.w('u0408', 'none'), [126, 128], {until: c.nth('u0408', 'one', 1)}), cue.highlight(c.nth('u0408', 'one', 1), [129, 134], {until: codeOut})],
    },
  ];
  acc.overlay({
    id: 'code',
    from: codeAt - 0.2,
    to: codeOut + 0.5,
    render: (t) => (
      <>
        <CodePanel pages={pages} x={left} y={Math.round(0.345 * H)} anchor="top-left" t={t} enter={{at: codeAt, dur: 0.5}} exit={{at: codeOut, dur: 0.4}} />
      </>
    ),
  });
  acc.overlay({
    id: 'code-chip',
    from: codeAt,
    to: codeOut + 0.5,
    render: (t) => <Chip t={t} at={codeAt + 0.6} exitAt={codeOut} repo="veritas" path="veritaskit/verify.py" line="111-135" x={right} y={Math.round(0.7 * H)} align="right" />,
  });

  acc.pixie.push(
    {frame: c.f(S2.start + 0.3), activity: 'reading', detail: 'Read trace-model.json'},
    {frame: c.f(c.u('u0407').start), activity: 'debugging', detail: 'Check all 2^256 inputs'},
  );
  return {emblemAt, withEmblem, lattice, fieldOf, waveTimes, claimAt, pipeAt};
};

/** The claim, typed as a formula (STIX for the operators). */
const Formula: React.FC<{t: number; at: number; exitAt: number; x: number; y: number}> = ({t, at, exitAt, x, y}) => {
  const {H} = useFrameSize();
  const k = env(t, at, 0.4, exitAt);
  if (k <= 0.001) return null;
  const parts: Array<[string, boolean]> = [['∀', false], ['p ', false], ['⊇', false], [' {', false], ['ignore', true], [', ', false], ['previous', true], [', ', false], ['instructions', true], ['} : blocked(p)', false]];
  const total = parts.reduce((n, [x]) => n + x.length, 0);
  let left = Math.min(total, Math.floor(Math.max(0, t - at) * 34));
  return (
    <div style={{position: 'absolute', left: x, top: y, fontFamily: font.serif, fontSize: Math.round(0.05 * H), color: color.text.display, whiteSpace: 'nowrap', ...pullStyle(k, H)}}>
      {parts.map(([txt, word], i) => {
        const shown = txt.slice(0, Math.max(0, left));
        left -= txt.length;
        return (
          <span key={i} style={word ? {fontFamily: font.mono, fontSize: '0.8em', color: color.accent.mint} : txt === '∀' || txt === '⊇' ? {fontFamily: font.mono} : undefined}>
            {shown}
          </span>
        );
      })}
    </div>
  );
};

