import React from 'react';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {ArchDiagram, asDiagramLayout, type PacketSpec} from '../../../engine/diagram';
import {DEFAULT_RELIEF_PITCHES, pinAt, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {easeCamera, easeOutCubic, prog, useFontsReady} from '../../../engine/type';
import type {CodeSnippet} from '../../../engine/code/types';
import traceLayout from '../../../data/diagrams/trace.layout.json';
import ltl from '../../../data/ch03/code/trace-ltl-count.json';
import traceData from '../../../data/ch03/trace.json';
import {boxesField, ground, ringField as ringSlots} from './kit/fields';
import {Chip, MonoKicker, Pill, clamp01, dim, env, mint, pullStyle, useFrameSize, white} from './kit/ui';
import {LIT, TEAL} from './common';
import type {SceneKit} from './scene';

// 03.3 the behaviour guard: three providers' calls become one event; each rule is a monitor with
// fixed memory (a ring buffer and a running count); the demo's monitors stay at 322 bytes.

const ltlSnippet = ltl as unknown as CodeSnippet;
const L = asDiagramLayout(traceLayout);

// tests/test_adapters_policy.py:15-17, the same send_email call in each provider's wire format
// (recipient strings replaced by a grey bar)
const R = '▇';
const DIALECTS: Array<{name: string; lines: string[]}> = [
  {name: 'openai', lines: ['{"function": {', '  "name": "send_email",', '  "arguments":', `  '{"to":"${R}","body":"secret"}'}}`]},
  {name: 'deepseek', lines: ['{"function": {', '  "name": "send_email",', `  "arguments": '{"to":"${R}"}'}}`]},
  {name: 'anthropic', lines: ['{"type": "tool_use",', ' "name": "send_email",', ` "input": {"to": ${R},`, '           "body": "secret"}}']},
];

const DialectCard: React.FC<{name: string; lines: string[]; x: number; y: number; w: number; k: number; merge: number}> = ({name, lines, x, y, w, k, merge}) => {
  const {H} = useFrameSize();
  if (k <= 0.001) return null;
  const fs = Math.round(0.022 * H);
  const hair = Math.max(1, Math.round(H / 1080));
  // the recipient string is a grey bar, never the test's address
  const rows = lines.map((l, i) => {
    const parts = l.split(R);
    return (
      <div key={i}>
        {parts.map((p, j) => (
          <React.Fragment key={j}>
            {p}
            {j < parts.length - 1 ? <span style={{display: 'inline-block', width: fs * 2.6, height: fs * 0.7, background: 'rgba(148,156,154,0.5)', borderRadius: 3, transform: `translateY(${(fs * 0.1).toFixed(1)}px)`}} /> : null}
          </React.Fragment>
        ))}
      </div>
    );
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        padding: Math.round(0.02 * H),
        borderRadius: Math.round(0.015 * H),
        background: 'rgba(6,11,13,0.92)',
        border: `${hair}px solid ${color.card.ruleStrong}`,
        fontFamily: font.mono,
        fontSize: fs,
        lineHeight: 1.45,
        color: color.text.secondary,
        whiteSpace: 'pre',
        opacity: k * (1 - merge),
        transform: `scale(${1 - 0.25 * merge})`,
        transformOrigin: '50% 50%',
      }}
    >
      <div style={{fontSize: fs, letterSpacing: '0.14em', textTransform: 'uppercase', color: color.accent.mintLabel, marginBottom: Math.round(fs * 0.5)}}>{name}</div>
      {rows}
    </div>
  );
};

/** The monitor bin: four compartments sized by their bytes, constant however long the session runs. */
const BINS = traceData.monitors.map((m) => ({name: m.name.replace(/\(.*$/, ''), bytes: m.bytes}));

export const buildMonitors = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S3 = c.sc('03.3');
  const S4 = c.sc('03.4');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const teal = ground(TEAL);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- dialects -> one event
  acc.beat({id: 'clear', at: S3.start - 0.35, field: teal, sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.85, jitterS: 0.04}});
  const tO = c.w('u0307', 'OpenAI');
  const tD = c.w('u0307', 'DeepSeek');
  const tA = c.w('u0307', 'Anthropic');
  const tEvent = c.w('u0307', 'event');
  const tPolicy = c.w('u0307', 'policy');
  const dAt = c.u('u0307').end - 0.15;
  const dOut = c.w('u0308', 'ring') - 0.7;
  const cardW = Math.round(0.275 * W);
  const slots = [
    {x: left, y: Math.round(0.24 * H), from: [-0.4 * W, 0]},
    {x: Math.round(0.365 * W), y: Math.round(0.12 * H), from: [0, -0.4 * H]},
    {x: Math.round(0.66 * W), y: Math.round(0.24 * H), from: [0.4 * W, 0]},
  ];
  const arrive = [tO, tD, tA];
  acc.overlay({
    id: 'dialects',
    from: S3.start,
    to: dAt + 0.6,
    render: (t) => {
      const merge = easeCamera(clamp01((t - tEvent + 0.2) / 0.55));
      return (
        <>
          {DIALECTS.map((d, i) => {
            const kk = easeCamera(clamp01((t - arrive[i] + 0.15) / 0.6));
            const s = slots[i];
            const cx = W * 0.5 - cardW / 2;
            const cy = H * 0.36;
            const x = s.x + s.from[0] * (1 - kk) + (cx - s.x) * merge;
            const y = s.y + s.from[1] * (1 - kk) + (cy - s.y) * merge;
            return <DialectCard key={d.name} name={d.name} lines={d.lines} x={x} y={y} w={cardW} k={Math.min(1, kk * 1.4)} merge={merge} />;
          })}
          <Pill k={env(t, tEvent + 0.15, 0.4, dAt - 0.1)} x={Math.round(0.5 * W)} y={Math.round(0.43 * H)} align="center" sizeH={0.03} border="rgba(116,201,174,0.6)">
            {'{ '}
            {mint('export: true')}, target_external: true, within_scope: true, write: true{' }'}
          </Pill>
          <MonoKicker text="openai · deepseek · anthropic → one event" x={Math.round(0.5 * W)} y={Math.round(0.5 * H)} k={env(t, tEvent + 0.35, 0.4, dAt - 0.1)} align="left" />
          <Chip t={t} at={tO + 0.3} exitAt={dAt - 0.1} repo="trace" path="tests/test_adapters_policy.py" line="12-18" x={left} y={Math.round(0.62 * H)} />
          <Chip t={t} at={tA + 0.3} exitAt={dAt - 0.1} repo="trace" path="tracekit/adapters.py" line="42-63, 99-141" x={left} y={Math.round(0.67 * H)} />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the module graph
  const packet: PacketSpec = {
    path: L.paths?.behaviour ?? [],
    at: dAt + 1.4,
    speed: 680,
    dwell: 0.18,
    chips: ['send_email', '{"export":1,"target_external":1}', 'count_le(export,2,50)', 'entry_hash · HMAC'],
  };
  acc.overlay({
    id: 'diagram',
    from: dAt - 0.1,
    to: dOut + 0.6,
    render: (t) => (
      <>
        <ArchDiagram
          layout={L}
          time={t}
          build={{at: dAt, span: 1.2}}
          camera={[
            {at: dAt, target: 'all', zoom: 1.02, pitch: 10, yaw: -5, safe: {left: 0.06, right: 0.94, top: 0.14, bottom: 0.7}},
            {at: dOut, target: 'all', zoom: 1.06, pitch: 4, yaw: -2, ease: 'camera', safe: {left: 0.06, right: 0.94, top: 0.14, bottom: 0.7}},
          ]}
          packets={[packet]}
          highlights={[{paths: [['automata', 'tm', 'content_guard'], ['ltl', 'policy', 'behavior_guard']], from: dAt + 1.0, to: dOut, fade: 0.4}]}
          backdrop={0.55}
          exit={{at: dOut, dur: 0.5}}
        />
        <MonoKicker text="two stacks, joined only in the engine and the ledger" x={left} y={Math.round(0.075 * H)} k={env(t, dAt + 0.6, 0.4, dOut)} />
        <Chip t={t} at={dAt + 1.2} exitAt={dOut} repo="trace" path="tracekit/ledger.py" line="38-39" x={Math.round(0.93 * W)} y={Math.round(0.72 * H)} align="right" />
      </>
    ),
  });

  // ---------------------------------------------------------------- the ring buffer on the wall
  const ringC = {u: 0.705, v: 0.5};
  const ringR = 14;
  const countPin = pinAt(board, ringC.u, ringC.v);
  const EMPTY: Look = {h: 0.16, tint: [0.88, 0.98, 0.95], glow: 0.05};
  const ZERO: Look = {h: 0.2, tint: [0.9, 1.0, 0.98], glow: 0.1};
  const ONE: Look = {h: 0.4, tint: LIT, glow: 1};
  const HEAD: Look = {h: 0.26, tint: [1.1, 1.08, 0.9], glow: 0.35};
  // behaviour steps 0..5 of the exfil session: export flags 0 0 0 1 1 (the third export waits for 03.4)
  const flags = traceData.steps.filter((s) => s.kind === 'behavior').map((s) => (s.export ? 1 : 0));
  const ringField = (filled: number, count: number) => {
    // the running count: a pad that rises one step per counted export
    const cu = board.u[countPin];
    const cv = board.v[countPin];
    const pad = boxesField(board, [{u: cu, v: cv, w: 7, h: 7, radius: 3.4, look: {h: 0.12 + 0.2 * count, tint: count ? LIT : 0.6, glow: count ? 0.6 : 0}}], teal);
    return ringSlots(board, {u: ringC.u, v: ringC.v, radius: ringR, n: 50, padR: 0.92}, (s) => (s < filled ? (flags[s] ? ONE : ZERO) : s === filled ? HEAD : EMPTY), pad);
  };
  const ringAt = c.w('u0308', 'ring');
  const stepGap = Math.max(0.32, Math.min(0.55, (c.u('u0308').end - ringAt - 0.4) / 5));
  acc.beat({id: 'ring', at: ringAt - 0.35, field: ringField(0, 0), sweep: {origin: [ringC.u, ringC.v], speed: 0.7, jitterS: 0.05}});
  let count = 0;
  for (let s = 0; s < 5; s++) {
    count += flags[s];
    acc.beat({id: `ring-${s}`, at: ringAt + 0.25 + s * stepGap, field: ringField(s + 1, count)});
  }
  const ringCountTimes = [0, 1, 2, 3, 4].map((s) => ringAt + 0.25 + s * stepGap);

  // the bin: four compartments, 64 / 114 / 80 / 64 bytes, one pin column per 2.5 bytes
  const binAt = c.w('u0309', 'bounded');
  const binW = 322 / 6;
  const binH = 9;
  let x0 = -binW / 2;
  const boxes = BINS.map((b) => {
    const w = b.bytes / 6;
    const box = {u: 0.66 + (x0 + w / 2) * board.p, v: ringC.v, w: w - 1.2, h: binH, radius: 1, look: {h: 0.3, tint: LIT, glow: 0.35} as Look};
    x0 += w;
    return box;
  });
  acc.beat({id: 'bin', at: binAt - 0.4, field: boxesField(board, boxes, teal), sweep: {origin: [0.66, ringC.v], speed: 0.6, jitterS: 0.05}});
  acc.beat({id: 'bin-off', at: S3.end - 0.5, field: teal, sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.9, jitterS: 0.04}});

  // ---------------------------------------------------------------- camera and code
  const ringPose = frameOn(board, {uv: [0.55, 0.5], pinsAcross: 118, yaw: 0.1, pitch: 0.06, aspect});
  acc.camera.push({at: c.u('u0308').start - 0.4, dur: 1.4, pose: ringPose, ease: 'camera'}, {at: c.u('u0308').start + 1.0, dur: S3.end - c.u('u0308').start - 1.4, pose: {...ringPose, distance: ringPose.distance * 0.95}, ease: 'inOutSine'});

  const codeAt = c.w('u0308', 'ring') - 0.35;
  const codeOut = c.u('u0309').start - 0.15;
  const pages: CodePage[] = [
    {
      at: codeAt,
      source: {snippet: ltlSnippet, lines: [174, 180]},
      dedent: 4,
      zoom: 0.92,
      width: Math.round(0.42 * W),
      header: {label: 'trace', path: 'tracekit/ltl.py', meta: 'BoundedCount · 170-187'},
      cues: [cue.reveal(codeAt + 0.1, {stagger: 0.04}), cue.highlight(ringCountTimes[1], 177, {until: ringCountTimes[3] + 0.3}), cue.highlight(ringCountTimes[3] + 0.3, 180, {until: codeOut})],
    },
  ];
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  acc.overlay({
    id: 'ring-ui',
    from: codeAt - 0.2,
    to: S3.end + 0.2,
    render: (t) => {
      const cp = projectToScreen(pose(t), [board.u[countPin] - 0.5, board.v[countPin] * board.extH - board.extH / 2, 0.5 * relief], W, H);
      const kRing = env(t, ringAt, 0.4, binAt - 0.4);
      let n = 0;
      for (let s = 0; s < 5; s++) if (t >= ringCountTimes[s]) n += flags[s];
      return (
        <>
          <CodePanel pages={pages} x={left} y={Math.round(0.17 * H)} anchor="top-left" t={t} enter={{at: codeAt, dur: 0.5}} exit={{at: codeOut, dur: 0.4}} />
          <Pill k={kRing} x={Math.round(0.93 * W)} y={Math.round(cp[1] + 0.2 * H)} align="right" sizeH={0.026}>
            count_le(export, 2, 50) {dim('·')} ring buffer of {white('50')} {dim('·')} count {mint(String(n))}
          </Pill>
        </>
      );
    },
  });

  // ---------------------------------------------------------------- 322 bytes, after 10,000 steps
  const raceFrom = binAt + 0.5;
  const raceTo = c.u('u0309').end - 0.2;
  acc.overlay({
    id: 'bin-ui',
    from: binAt - 0.3,
    to: S3.end + 0.2,
    render: (t) => <BinLabels t={t} at={binAt} raceFrom={raceFrom} raceTo={raceTo} exitAt={S3.end - 0.5} boxes={boxes} board={board} pose={pose(t)} relief={relief} />,
  });

  acc.pixie.push({frame: c.f(S3.start + 0.2), activity: 'thinking', detail: 'Planning count_le(export, 2, 50)…'});
  void S4;
  return {ringCountTimes, binAt};
};

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const BinLabels: React.FC<{
  t: number;
  at: number;
  raceFrom: number;
  raceTo: number;
  exitAt: number;
  boxes: Array<{u: number; v: number; w: number; h: number}>;
  board: SceneKit['board'];
  pose: ReturnType<typeof rigPoseAt>;
  relief: number;
}> = ({t, at, raceFrom, raceTo, exitAt, boxes, board, pose, relief}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const k = env(t, at + 0.2, 0.4, exitAt);
  if (k <= 0.001) return null;
  const steps = 10000 * easeOutCubic(prog(t, raceFrom, raceTo - raceFrom)) ** 1.6;
  const fs = Math.round(0.024 * H);
  const left = Math.round(0.07 * W);
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      {boxes.map((b, i) => {
        const p = projectToScreen(pose, [b.u - 0.5, (b.v - (b.h / 2 + 2.5) * (board.p / board.extH)) * board.extH - board.extH / 2, 0.3 * relief], W, H);
        return (
          <div key={i} style={{position: 'absolute', left: p[0], top: p[1], transform: 'translate(-50%, 0)', textAlign: 'center', fontFamily: font.mono, fontSize: fs, color: color.text.caption, whiteSpace: 'nowrap', lineHeight: 1.25}}>
            <div style={{color: color.text.key, fontWeight: 600}}>{BINS[i].bytes} B</div>
            <div style={{color: color.text.secondary}}>{BINS[i].name}</div>
          </div>
        );
      })}
      <div style={{position: 'absolute', left, top: Math.round(0.2 * H), fontFamily: font.mono, color: color.accent.mintLabel, fontSize: Math.round(0.024 * H), letterSpacing: '0.16em', textTransform: 'uppercase'}}>behaviour steps</div>
      <div style={{position: 'absolute', left, top: Math.round(0.235 * H), fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(0.11 * H), color: color.text.display, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em'}}>{fmt(steps)}</div>
      <div style={{position: 'absolute', left, top: Math.round(0.4 * H), fontFamily: font.mono, color: color.accent.mintLabel, fontSize: Math.round(0.024 * H), letterSpacing: '0.16em', textTransform: 'uppercase'}}>monitor state</div>
      <div style={{position: 'absolute', left, top: Math.round(0.435 * H), fontFamily: font.sans, fontWeight: 650, fontSize: Math.round(0.11 * H), color: color.accent.mint, letterSpacing: '-0.03em'}}>
        322 <span style={{fontSize: '0.45em', color: color.text.caption}}>bytes</span>
      </div>
      <Pill k={env(t, raceTo - 0.6, 0.4, exitAt)} x={left} y={Math.round(0.62 * H)} sizeH={0.024}>
        bounded at {white('322 bytes')} {dim('·')} the same after {white('10,000')} steps
      </Pill>
      <Chip t={t} at={at + 0.6} exitAt={exitAt} repo="trace" path="live/tests/monitors.test.mjs" line="35-41" x={left} y={Math.round(0.68 * H)} />
      <Chip t={t} at={raceTo - 0.2} exitAt={exitAt} repo="trace" path="results/systems_benchmark.json" line={71} x={Math.round(0.93 * W)} y={Math.round(0.68 * H)} align="right" />
      <Pill k={env(t, raceTo + 0.3, 0.4, exitAt)} x={Math.round(0.93 * W)} y={Math.round(0.14 * H)} align="right" sizeH={0.022} tone={color.text.secondary}>
        memory_bytes: a best-effort bound, constant by construction
      </Pill>
      <Chip t={t} at={raceTo + 0.6} exitAt={exitAt} repo="trace" path="tracekit/ltl.py" line="96-99" x={Math.round(0.93 * W)} y={Math.round(0.19 * H)} align="right" />
    </div>
  );
};
