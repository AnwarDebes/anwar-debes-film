import React from 'react';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type FieldFn, type Look} from '../../../engine/pins';
import {font} from '../../../engine/tokens';
import {easeOutCubic, prog, useFontsReady} from '../../../engine/type';
import type {CodeSnippet} from '../../../engine/code/types';
import bottleneck from '../../../data/ch05/code/candor-bottleneck.json';
import testCode from '../../../data/ch05/code/candor-test.json';
import certCode from '../../../data/ch05/code/candor-certificate.json';
import D from '../../../data/ch05/candor.json';
import {Chip, clamp01, env, pullStyle, useFrameSize} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {INK_TEXT, LEAK, MUTED_TEXT, TEAL, TEAL_TEXT} from './common';
import {paper} from './s01';
import {InkCard} from './ink';

// 05.2 one input, three rows of pins: the activation h, what the named concepts rebuild (ĥ), and
// the leak r = h − ĥ; then the three routings and the certificate δ.

const bottleneckSnippet = bottleneck as unknown as CodeSnippet;
const testSnippet = testCode as unknown as CodeSnippet;
const certSnippet = certCode as unknown as CodeSnippet;

/** Signed bars in pins around a midline: one column per value, rows of `rowH` pins up or down. */
const signedRow = (k: SceneKit, row: {u: number; v: number; values: readonly number[]; scale: number; pitch: number; width: number; look: Look; outline?: boolean}, base: FieldFn): FieldFn => {
  const {board} = k;
  const n = row.values.length;
  const half = (n * row.pitch) / 2;
  return (u, v, i) => {
    const px = (u - row.u) / board.p + half;
    const py = ((v - row.v) * board.extH) / board.p;
    const col = Math.floor(px / row.pitch);
    if (col < 0 || col >= n) return base(u, v, i);
    const cx = (col + 0.5) * row.pitch;
    if (Math.abs(px - cx) > row.width / 2) return base(u, v, i);
    const val = row.values[col] * row.scale;
    const lo = Math.min(0, val);
    const hi = Math.max(0, val);
    if (py < lo - 0.35 || py > hi + 0.35) return base(u, v, i);
    if (row.outline) {
      const edge = Math.abs(py - val) < 0.9 || Math.abs(px - cx) > row.width / 2 - 0.9;
      return edge ? row.look as ReturnType<FieldFn> : base(u, v, i);
    }
    return row.look as ReturnType<FieldFn>;
  };
};

export const buildRows = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S2 = c.sc('05.2');
  const S3 = c.sc('05.3');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- the three rows
  const rowsU = 0.75;
  const vs = [0.62, 0.5, 0.38];
  const max = Math.max(...D.box1.h.map((x) => Math.abs(x)));
  const scale = 5.2 / max;
  const pitch = 1.85;
  const rowH = signedRow(k, {u: rowsU, v: vs[0], values: D.box1.h, scale, pitch, width: 1.35, look: {h: 0.34, tint: [0.42, 0.52, 0.5], paint: 0.6}}, paper());
  const rowHat = (base: FieldFn) => signedRow(k, {u: rowsU, v: vs[1], values: D.box1.hHat, scale, pitch, width: 1.35, look: {h: 0.38, tint: TEAL, paint: 1, glow: 0.15}}, base);
  const rowLeak = (base: FieldFn) => signedRow(k, {u: rowsU, v: vs[2], values: D.box1.leak, scale, pitch, width: 1.35, look: {h: 0.26, tint: LEAK, paint: 1}}, base);
  const splitAt = S2.start - 0.4;
  const hatAt = c.w('u0503', 'rebuilds');
  const leakAt = c.w('u0503', 'leak');
  acc.beat({id: 'row-h', at: splitAt, field: rowH, sweep: {origin: [0.62, 0.5], speed: 0.7, jitterS: 0.05}});
  acc.beat({id: 'row-hat', at: hatAt, field: rowHat(rowH), sweep: {kind: 'linear', origin: [rowsU - 0.25, vs[1]], direction: [1, 0], speed: 0.8, jitterS: 0.02, tintFollowsWave: true}});
  acc.beat({id: 'row-leak', at: leakAt - 0.1, field: rowLeak(rowHat(rowH)), sweep: {kind: 'linear', origin: [rowsU - 0.25, vs[2]], direction: [1, 0], speed: 0.8, jitterS: 0.02, tintFollowsWave: true}});

  const rowsPose = frameOn(board, {uv: [0.62, 0.5], pinsAcross: 122, yaw: 0.08, pitch: 0.04, aspect});
  acc.camera.push({at: S2.start - 0.5, dur: 1.5, pose: rowsPose, ease: 'camera'}, {at: S2.start + 1.0, dur: c.u('u0504').start - S2.start - 0.8, pose: {...rowsPose, distance: rowsPose.distance * 0.96}, ease: 'inOutSine'});

  const pose = (t: number) => rigPoseAt(acc.camera, t);
  const rowLabel = (v: number): [number, number, number] => [rowsU - 16 * pitch * board.p - 0.5, v * board.extH - board.extH / 2 + 7.2 * board.p, 0.1 * relief];
  const rowsOut = c.u('u0504').start - 0.3;
  acc.overlay({
    id: 'row-labels',
    from: splitAt,
    to: rowsOut + 0.5,
    render: (t) => {
      const lab = (j: number, at: number, text: React.ReactNode, colr: string) => {
        const [x, y] = projectToScreen(pose(t), rowLabel(vs[j]), W, H);
        return (
          <div key={j} style={{position: 'absolute', left: x, top: y, transform: 'translate(0, -50%)'}}>
            <InkCard k={env(t, at, 0.4, rowsOut)} x={0} y={0} pad={Math.round(0.012 * H)}>
              <div style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.032 * H), color: colr, whiteSpace: 'nowrap', lineHeight: 1}}>{text}</div>
            </InkCard>
          </div>
        );
      };
      return (
        <>
          {lab(0, splitAt + 0.3, <>h <span style={{fontFamily: font.sans, fontStyle: 'normal', fontSize: '0.6em', color: MUTED_TEXT}}>activation</span></>, INK_TEXT)}
          {lab(1, hatAt, <>ĥ <span style={{fontFamily: font.sans, fontStyle: 'normal', fontSize: '0.6em', color: MUTED_TEXT}}>named concepts</span></>, TEAL_TEXT)}
          {lab(2, leakAt, <>r = h − ĥ <span style={{fontFamily: font.sans, fontStyle: 'normal', fontSize: '0.6em', color: MUTED_TEXT}}>the leak</span></>, '#B7791F')}
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the code: the bottleneck, and the test that pins it
  const codeAt = c.w('u0503', 'reads');
  const testAt = c.u('u0503').end + 0.1;
  const codeOut = rowsOut;
  const pages: CodePage[] = [
    {
      at: codeAt,
      source: {snippet: bottleneckSnippet, lines: [90, 101]},
      dedent: 4,
      zoom: 0.74,
      width: Math.round(0.36 * W),
      header: {label: 'candor', path: 'candorkit/bottleneck.py', meta: '90-106'},
      cues: [cue.reveal(codeAt + 0.1, {stagger: 0.04}), cue.highlight(c.w('u0503', 'concepts'), 92, {until: leakAt - 0.2}), cue.highlight(leakAt - 0.2, 101, {until: testAt})],
    },
    {
      at: testAt,
      transitionDur: 0.5,
      source: {snippet: testSnippet, lines: [16, 23]},
      dedent: 4,
      zoom: 0.74,
      width: Math.round(0.36 * W),
      header: {label: 'candor', path: 'tests/test_candor.py', meta: '16-23'},
      cues: [cue.highlight(testAt + 0.4, [22, 23], {until: codeOut})],
    },
  ];
  acc.overlay({
    id: 'code',
    from: codeAt - 0.2,
    to: codeOut + 0.6,
    render: (t) => (
      <>
        <CodePanel pages={pages} x={left} y={Math.round(0.16 * H)} anchor="top-left" t={t} enter={{at: codeAt, dur: 0.5}} exit={{at: codeOut, dur: 0.4}} />
        <InkPill k={env(t, leakAt + 0.2, 0.4, codeOut)} x={left} y={Math.round(0.618 * H)}>
          <span style={{color: TEAL_TEXT}}>recon</span> + <span style={{color: '#B7791F'}}>leak</span> == h <span style={{color: MUTED_TEXT}}>· counted in the repo</span>
        </InkPill>
        <Chip t={t} at={codeAt + 0.6} exitAt={testAt} repo="candor" path="candorkit/bottleneck.py" line="4-13" x={left} y={Math.round(0.668 * H)} />
        <Chip t={t} at={testAt + 0.5} exitAt={codeOut} repo="candor" path="tests/test_candor.py" line="16-23" x={left} y={Math.round(0.668 * H)} />
      </>
    ),
  });
  acc.overlay({
    id: 'twin',
    from: leakAt,
    to: rowsOut + 0.5,
    render: (t) => (
      <InkCard k={env(t, leakAt + 0.4, 0.4, rowsOut)} x={right} y={Math.round(0.575 * H)} align="right" pad={Math.round(0.012 * H)}>
        <div style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.032 * H), color: '#B7791F', whiteSpace: 'nowrap'}}>The twin never sees it.</div>
      </InkCard>
    ),
  });

  // ---------------------------------------------------------------- three routings, packets down each lane
  const lanesAt = c.u('u0504').start - 0.2;
  const lanesOut = c.u('u0505').start - 0.2;
  acc.beat({id: 'clear', at: lanesAt - 0.3, field: paper(), sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.9, jitterS: 0.04, tintFollowsWave: true}});
  acc.overlay({
    id: 'lanes',
    from: lanesAt - 0.1,
    to: lanesOut + 0.6,
    render: (t) => (
      <>
        <Lanes t={t} at={lanesAt} exitAt={lanesOut} twinAt={c.w('u0504', 'twin')} swapAt={c.w('u0504', 'swapped')} />
        <Chip t={t} at={lanesAt + 0.8} exitAt={lanesOut} repo="candor" path="candorkit/model.py" line="30-42" x={left} y={Math.round(0.7 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- the certificate, δ
  const deltaAt = c.w('u0505', 'delta');
  const fOut = S3.start - 0.3;
  const certPages: CodePage[] = [
    {
      at: deltaAt + 0.3,
      source: {snippet: certSnippet, lines: [52, 60]},
      dedent: 0,
      zoom: 0.72,
      width: Math.round(0.42 * W),
      header: {label: 'candor', path: 'candorkit/certificate.py', meta: '42-66'},
      cues: [cue.reveal(deltaAt + 0.4, {stagger: 0.03}), cue.highlight(c.w('u0505', 'differ'), [57, 58], {until: c.w('u0506', 'measured')}), cue.highlight(c.w('u0506', 'measured'), 59, {until: fOut})],
    },
  ];
  acc.overlay({
    id: 'delta',
    from: deltaAt - 0.2,
    to: fOut + 0.6,
    render: (t) => (
      <>
        <Formula t={t} at={deltaAt} exitAt={fOut} x={left} y={Math.round(0.15 * H)} />
        <CodePanel pages={certPages} x={Math.round(0.5 * W)} y={Math.round(0.14 * H)} anchor="top-left" t={t} enter={{at: deltaAt + 0.3, dur: 0.5}} exit={{at: fOut, dur: 0.4}} />
        <InkPill k={env(t, c.w('u0506', 'pass'), 0.4, fOut)} x={left} y={Math.round(0.575 * H)}>
          measured with one extra pass <span style={{color: MUTED_TEXT}}>·</span> not predicted <span style={{color: MUTED_TEXT}}>·</span> cannot under-report
        </InkPill>
        <Chip t={t} at={c.w('u0506', 'under')} exitAt={fOut} repo="candor" path="README.md" line="155-158" x={left} y={Math.round(0.4 * H)} />
        <Chip t={t} at={deltaAt + 0.8} exitAt={fOut} repo="candor" path="candorkit/losses.py" line="96-122" x={left} y={Math.round(0.31 * H)} />
        <Chip t={t} at={deltaAt + 1.1} exitAt={fOut} repo="candor" path="candorkit/certificate.py" line="42-66" x={left} y={Math.round(0.355 * H)} />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(S2.start + 0.2), activity: 'reading', detail: 'Read candorkit/bottleneck.py'},
    {frame: c.f(testAt), activity: 'reading', detail: 'Read tests/test_candor.py'},
    {frame: c.f(c.u('u0504').start), activity: 'thinking', detail: 'Planning three routings…'},
  );
  return {splitAt, hatAt, leakAt, lanesAt, deltaAt};
};

/** A light chip set on paper: teal hairline, ink text. */
export const InkPill: React.FC<{k: number; x: number; y: number; children: React.ReactNode; align?: 'left' | 'right'; sizeH?: number}> = ({k, x, y, children, align = 'left', sizeH = 0.024}) => {
  const {W, H} = useFrameSize();
  if (k <= 0.001) return null;
  const fs = Math.round(sizeH * H);
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', ...(align === 'right' ? {right: W - x} : {left: x}), top: y, transform: 'translate(0, -50%)', padding: `${Math.round(fs * 0.5)}px ${Math.round(fs * 0.85)}px`, borderRadius: 999, border: `${hair}px solid rgba(11,135,123,0.45)`, background: 'rgba(248,253,251,0.94)', fontFamily: font.mono, fontSize: fs, fontWeight: 500, color: INK_TEXT, whiteSpace: 'nowrap', lineHeight: 1.2, ...pullStyle(k, H)}}>
      {children}
    </div>
  );
};

/** δ(x) = ½ Σ |p_full − p_leg|, set in STIX. */
const Formula: React.FC<{t: number; at: number; exitAt: number; x: number; y: number}> = ({t, at, exitAt, x, y}) => {
  const {H} = useFrameSize();
  const k = env(t, at, 0.45, exitAt);
  if (k <= 0.001) return null;
  const fs = Math.round(0.064 * H);
  return (
    <InkCard k={k} x={x} y={y}>
    <div style={{fontFamily: font.serif, fontSize: fs, color: INK_TEXT, whiteSpace: 'nowrap', lineHeight: 1.15}}>
      <span style={{fontStyle: 'italic', color: TEAL_TEXT}}>δ</span>(<span style={{fontStyle: 'italic'}}>x</span>) = ½ Σ |<span style={{fontStyle: 'italic'}}>p</span>
      <sub style={{fontSize: '0.5em'}}>full</sub> − <span style={{fontStyle: 'italic'}}>p</span>
      <sub style={{fontSize: '0.5em'}}>leg</sub>|
    </div>
    </InkCard>
  );
};

/** The three routings of candorkit/model.py:30-42, with packets flowing down each lane. */
const Lanes: React.FC<{t: number; at: number; exitAt: number; twinAt: number; swapAt: number}> = ({t, at, exitAt, twinAt, swapAt}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  const k = env(t, at, 0.45, exitAt);
  if (!ready || k <= 0.001) return null;
  const x0 = 0.1 * W;
  const xs = 0.3 * W;
  const x1 = 0.86 * W;
  const yc = 0.4 * H;
  const lanes = [
    {y: 0.24 * H, name: 'full', code: 'routed = h', note: 'the deployed model', at: at + 0.2, color: '#33524D'},
    {y: 0.4 * H, name: 'legible', code: 'routed = bo.recon', note: 'the twin: named concepts only', at: twinAt, color: TEAL_TEXT},
    {y: 0.56 * H, name: 'leak-swapped', code: 'routed = bo.recon + bo.leak[perm]', note: 'leaks swapped between inputs', at: swapAt, color: '#B7791F'},
  ];
  const sw = Math.max(2, H / 450);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: k}}>
      <div style={{position: 'absolute', left: 0.055 * W, top: 0.11 * H, width: 0.89 * W, height: 0.56 * H, borderRadius: Math.round(0.02 * H), background: 'rgba(246,252,250,0.95)', border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(11,135,123,0.38)`, boxShadow: `0 ${Math.round(0.01 * H)}px ${Math.round(0.04 * H)}px rgba(14,42,38,0.18)`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <circle cx={x0} cy={yc} r={0.018 * H} fill={TEAL_TEXT} />
        {lanes.map((l, i) => {
          const g = easeOutCubic(prog(t, l.at, 0.6));
          const path = `M ${x0} ${yc} C ${(x0 + xs) / 2} ${yc}, ${(x0 + xs) / 2} ${l.y}, ${xs} ${l.y} L ${xs + (x1 - xs) * g} ${l.y}`;
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={l.color} strokeWidth={sw} strokeOpacity={0.85 * g} strokeDasharray={i === 2 ? `${sw * 4} ${sw * 3}` : undefined} />
              {/* packets: dots that run down the lane once it is drawn */}
              {g >= 1
                ? [0, 1, 2].map((j) => {
                    const ph = ((t - l.at - 0.6) * 0.45 + j / 3) % 1;
                    const px = xs + (x1 - xs) * clamp01(ph);
                    return <circle key={j} cx={px} cy={l.y} r={0.007 * H} fill={l.color} opacity={0.9} />;
                  })
                : null}
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', left: x0 - 0.01 * W, top: yc + 0.03 * H, fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.034 * H), color: INK_TEXT}}>h</div>
      {lanes.map((l, i) => {
        const g = env(t, l.at, 0.4);
        return (
          <div key={i} style={{position: 'absolute', left: xs + 0.02 * W, top: l.y - 0.075 * H, ...pullStyle(g, H)}}>
            <div style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), letterSpacing: '0.14em', textTransform: 'uppercase', color: l.color, fontWeight: 600}}>{l.name}</div>
            <div style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: INK_TEXT, marginTop: Math.round(0.004 * H)}}>
              {l.code} <span style={{color: MUTED_TEXT, fontFamily: font.sans}}>· {l.note}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

