import React from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, barsField, rectField, type Beat, type FieldFn, type LiveLayer} from '../../../engine/pins';
import {pushIn, type CameraKey} from '../../../engine/camera';
import {ArchDiagram, asDiagramLayout, type CameraKey as DiagramCameraKey} from '../../../engine/diagram';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {KineticLine} from '../../../engine/type';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeInCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import type {PixieTimeline} from '../../../pixie';
import type {FilmCtx, TimedNode} from '../../types';
import {snippets} from '../../../data/ch07/code';
import vscLayout from '../../../data/ch07/vsclaude.layout.json';
import {handoffPose, poseOn, screenAtUv, uvAtScreen} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {Card, Cite, MissDot, NamePlate, WinDot, mono, pullK, pullStyle, riseK} from './kit/ui';
import {HANDOFF} from '../../handoff';
import {WARM, warmFlat} from './look';
import {pinPixie} from './s02Pixie';
import {termLiveField, type TermSpec} from './pinTerminal';
import type {Times07} from './times';

// 07.6 vsclaude: a desktop editor on the same idea. The wall becomes an editor's frame; the module
// chain from the Claude Code CLI to the stage assembles; one raw stream line becomes a file edit, a
// caption and a pose through a fixed table; the parser's live limit is shown (one event per line);
// the priority ladder stands in pins with the not-yet-live permission pose hollow. Then the
// spinner from 07.1 comes back once, small, dissolves, and Pixie stands where it was.

const L = asDiagramLayout(vscLayout);

/** An editor's frame pressed into the wall: title strip, explorer column, editor, a stage panel. */
const editorFrame = (ctx: FilmCtx, c: [number, number]): FieldFn => {
  const {board} = ctx;
  const p = board.p;
  const pv = p / board.extH;
  const lift = (k: number): [number, number, number] => [WARM[0] * k, WARM[1] * k, WARM[2] * k];
  const outer = rectField(board, {u: c[0], v: c[1], w: 134, h: 72, radius: 3}, {h: 0.09, tint: lift(1.08)});
  const body = rectField(board, {u: c[0], v: c[1] - 2 * pv, w: 130, h: 64, radius: 2}, {h: 0.02, tint: lift(0.62), ground: outer});
  const side = rectField(board, {u: c[0] - 52 * p, v: c[1] - 2 * pv, w: 22, h: 64, radius: 1}, {h: 0.035, tint: lift(0.72), ground: body});
  const stage = rectField(board, {u: c[0] + 50 * p, v: c[1] - 2 * pv, w: 26, h: 64, radius: 1}, {h: 0.035, tint: lift(0.74), ground: side});
  // a few explorer rows and editor lines as low bars
  let g: FieldFn = stage;
  for (let k = 0; k < 7; k++) {
    g = rectField(board, {u: c[0] - 53 * p, v: c[1] + (24 - k * 6) * pv, w: 14 - (k % 3) * 3, h: 2.2, radius: 1}, {h: 0.07, tint: lift(1.0), ground: g});
  }
  for (let k = 0; k < 9; k++) {
    const w = [52, 38, 44, 30, 58, 26, 40, 48, 34][k];
    g = rectField(board, {u: c[0] - 34 * p + (w / 2) * p, v: c[1] + (24 - k * 5.5) * pv, w, h: 2.2, radius: 1}, {h: 0.06, tint: lift(0.95), ground: g});
  }
  return g;
};

const PRIORITY: Array<[string, number]> = [
  ['idle', 0],
  ['reading', 10],
  ['typing', 20],
  ['debugging', 40],
  ['success', 60],
  ['confused', 80],
  ['waiting', 100],
];

export const scene0706 = (ctx: FilmCtx, T: Times07, ptl: PixieTimeline): PartSpec => {
  const {width: W, height: H, board} = ctx;
  const {t6} = T;
  const aspect = W / H;
  const base = handoffPose(ctx);
  const pose = poseOn(ctx, {uv: [0.53, 0.5], pinsAcross: 156, yaw: 0.09, pitch: 0.05});
  const [fcu, fcv] = uvAtScreen(board, pose, 0.5, 0.47, aspect);
  const frame = editorFrame(ctx, [fcu, fcv]);

  // the priority ladder: seven bars, the waiting bar hollow (in the tests, not live)
  const [lu, lv] = uvAtScreen(board, pose, 0.672, 0.445, aspect);
  const ladderW = 70;
  const ladderH = 40;
  const values = PRIORITY.map(([, v]) => Math.max(0.025, v / 100));
  const solid = barsField(board, {u: lu, v: lv, width: ladderW, height: ladderH, values, gap: 4}, {
    ground: frame,
    looks: (k, val) => (k === PRIORITY.length - 1 ? {h: 0.0, tint: [0.3, 0.28, 0.26]} : {h: 0.12 + 0.28 * val, tint: [0.98, 0.93, 0.86], glow: k === 0 ? 0 : 0.1}),
  });
  // the waiting bar is hollow: an outline at full height around a sunk floor
  const pitch = ladderW / PRIORITY.length;
  const wu = lu + (-ladderW / 2 + (PRIORITY.length - 0.5) * pitch) * board.p;
  const hollowOuter = rectField(board, {u: wu, v: lv, w: pitch - 4, h: ladderH, radius: 0.8}, {h: 0.2, tint: [0.78, 0.75, 0.7], ground: solid});
  const hollow = rectField(board, {u: wu, v: lv, w: pitch - 6.4, h: ladderH - 2.4, radius: 0.5}, {h: 0, tint: [0.3, 0.28, 0.26], ground: hollowOuter});
  const ladder: FieldFn = (u, v, i) => (Math.abs(u - wu) < (pitch / 2) * board.p && Math.abs(v - lv) < ((ladderH / 2 + 1) * board.p) / board.extH ? hollow(u, v, i) : solid(u, v, i));

  // the closing: a small spinner where Pixie will stand
  const closePose = poseOn(ctx, {uv: [0.53, 0.5], pinsAcross: 166, yaw: 0.09, pitch: 0.05, screen: [0.5, 0.47]});
  const [pu, pv] = uvAtScreen(board, closePose, 0.735, 0.47, aspect);
  const spinTerm: TermSpec = {board, center: [pu, pv - board.p / board.extH], w: 14, h: 12, lines: [], rows: 0, spinFrom: t6.spinner, burst: t6.noSpinner};
  const spinner: LiveLayer = {fn: termLiveField(spinTerm), from: t6.spinner - 0.1, to: t6.noSpinner + 0.8, fadeS: 0.3, region: [pu - 0.09, pv - 0.08, pu + 0.09, pv + 0.08], speedHint: () => 0.4};
  const spinUv: [number, number] = [pu, pv];
  const px = pinPixie(ctx, ptl, {center: [pu, pv], from: spinUv, formAt: t6.noSpinner + 0.15, exitAt: t6.cool + 0.2});

  const beats: Beat[] = [
    {id: 'c07-vsc-frame', at: t6.place, field: frame, sweep: {...SWEEPS.raster([-1, 0], 1.3), jitterS: 0.03}},
    {id: 'c07-vsc-ladder', at: t6.beta, field: ladder, sweep: {...SWEEPS.raster([0, 1], 1.1, [lu, lv - 0.2]), tintFollowsWave: true}},
    {id: 'c07-vsc-clear', at: t6.spinner - 0.5, field: warmFlat, sweep: SWEEPS.dissolve(0.8)},
    // the warm palette cools: back to the film's bare steel for the next chapter
    {id: 'c07-handoff', at: t6.cool, field: HANDOFF, sweep: {...SWEEPS.from([0.3, 0.5], 0.8, 0.06), tintFollowsWave: true}, tintTauS: 0.6},
  ];
  const camera: CameraKey[] = [
    {at: t6.place - 0.4, dur: 1.5, pose, ease: 'camera'},
    {at: t6.place + 1.1, dur: Math.max(1, t6.spinner - t6.place - 1.1), pose: pushIn(pose, 0.04), ease: 'inOutSine'},
    {at: t6.spinner - 0.4, dur: 1.4, pose: closePose, ease: 'camera'},
    {at: t6.spinner + 1.0, dur: Math.max(1, t6.cool - t6.spinner - 1.0), pose: pushIn(closePose, 0.025), ease: 'inOutSine'},
    {at: t6.cool, dur: Math.max(1.2, T.ch.end - t6.cool - 0.3), pose: base, ease: 'camera'},
  ];
  const light = [
    {at: t6.place, dur: 1.4, poolAt: [0.04, 0.0] as [number, number], spread: 1.25, key: 1.0},
    {at: t6.spinner, dur: 1.2, poolAt: [pu - 0.5, pv * board.extH - board.extH / 2] as [number, number], spread: 1.0, key: 1.04},
    {at: t6.cool, dur: Math.max(1.2, T.ch.end - t6.cool - 0.3), look: [0, 0] as [number, number], key: 1, pool: 1, env: 1, poolAt: [0, 0] as [number, number], spread: 1},
  ];

  // the diagram on its own clock
  const t0 = t6.arch;
  const rel = (s: number) => s - t0;
  const safe = {left: 0.069, right: 0.931, top: 0.26, bottom: 0.73};
  const dcam: DiagramCameraKey[] = [
    {at: 0, target: 'all', zoom: 1.02, pitch: 10, yaw: -4, safe},
    {at: 2.8, target: 'all', zoom: 1, pitch: 4, yaw: -1.5, ease: 'camera', safe},
  ];
  const packets = [{path: ['rust', 'live', 'providers', 'contracts'], at: rel(t6.frozen) - 0.6, speed: 820, dwell: 0.25, chips: ['provider:stdout', 'parseClaudeStreamLine(line)', 'AgentEvent'], trail: 150}];

  const codeX = Math.round(W * 0.53);
  const pages: CodePage[] = [
    {
      at: t6.table - 0.5,
      source: {snippet: snippets['vsc-motion'], lines: [93, 110]},
      rows: 10,
      view: 93,
      zoom: 0.87,
      width: Math.round(W * 0.4),
      header: {label: 'vsclaude', path: 'packages/contracts/src/motion.ts', meta: 'EVENT_TO_STATE'},
      cues: [cue.reveal(t6.table - 0.4, {lines: [93, 102], stagger: 0.035}), cue.highlight(t6.table + 0.1, 99, {until: t6.parser - 0.1})],
    },
    {
      at: t6.parser,
      transitionDur: 0.6,
      source: {snippet: snippets['vsc-stream'], lines: [346, 378]},
      view: 346,
      rows: 10,
      dedent: 4,
      zoom: 0.87,
      width: Math.round(W * 0.42),
      header: {label: 'vsclaude', path: 'packages/providers/src/claude-stream.ts'},
      cues: [
        cue.reveal(t6.parser + 0.1, {stagger: 0.03}),
        cue.scroll(t6.holds - 0.3, [362, 371], {dur: 1.0, align: 'top'}),
        cue.highlight(t6.surfaces - 0.2, [364, 371], {until: t6.beta - 0.1}),
        cue.annotate(t6.surfaces, 370, 'the first match *returns*', {match: "return emit(ctx, 'message'", side: 'below', until: t6.beta - 0.1}),
      ],
    },
  ];

  const overlays: TimedNode[] = [
    {
      id: 'c07-vsc-plate',
      from: t6.plate,
      to: t6.spinner + 0.6,
      render: (t) => (
        <NamePlate
          t={t}
          at={t6.plate}
          out={t6.spinner}
          repo="vsclaude"
          status="BETA DESKTOP APP v0.2.0 · CLAUDE CODE THE ONLY LIVE PROVIDER"
          extra={[{text: "re-enacted by the film's guide · vsclaude draws static symbols", at: t6.plate + 0.6}]}
        />
      ),
    },
    {id: 'c07-vsc-cite-readme', from: t6.idea, to: t6.arch + 1, render: (t) => <Cite t={t} repo="vsclaude" path="README.md" line="9, 39-49" at={t6.idea} out={t6.arch + 0.6} x={W * (1 - layout.marginLeftW)} y={Math.round(0.71 * H)} align="right" />},
    {
      id: 'c07-vsc-arch',
      from: t0,
      to: t6.line + 0.6,
      render: (t) => <ArchDiagram layout={L} time={t - t0} build={{at: 0.15, span: 2.6}} camera={dcam} packets={packets} safe={safe} exit={{at: rel(t6.line), dur: 0.5}} backdrop={0.35} />,
    },
    {id: 'c07-vsc-chain', from: t6.line, to: t6.parser + 0.6, render: (t) => <Chain t={t} T={T} />},
    {id: 'c07-vsc-code', from: t6.table - 0.6, to: t6.beta + 0.6, render: (t) => <CodePanel pages={pages} x={codeX} y={Math.round(0.235 * H)} anchor="top-left" t={t} enter={{at: t6.table - 0.5, dur: 0.5}} exit={{at: t6.beta - 0.1, dur: 0.45}} />},
    {id: 'c07-vsc-parser', from: t6.parser, to: t6.beta + 0.6, render: (t) => <ParserLine t={t} T={T} />},
    {id: 'c07-vsc-ladder-labels', from: t6.beta, to: t6.spinner + 0.4, render: (t) => <LadderLabels t={t} T={T} ctx={ctx} pose={pose} lu={lu} lv={lv} w={ladderW} h={ladderH} />},
    {
      id: 'c07-vsc-closing',
      from: t6.noSpinner - 0.6,
      to: T.ch.end,
      render: (t) => (
        <KineticLine words={ctx.tl.utt('u0722').words} t={t} kind="statement" variant="focus" x={Math.round(W * layout.marginLeftW)} y={Math.round(0.4 * H)} yAnchor="capTop" maxWidth={Math.round(W * 0.42)} exitAt={t6.cool + 0.4} />
      ),
    },
  ];
  return {beats, live: [spinner, px.layer], camera, light, overlays, captionSkip: ['u0722']};
};

const Chain: React.FC<{t: number; T: Times07}> = ({t, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t6} = T;
  const k = riseK(t, t6.line, t6.parser - 0.2);
  if (k <= 0) return null;
  const x = Math.round(W * layout.marginLeftW);
  const json = '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_01","name":"Edit","input":{"file_path":"/repo/src/app.ts","old_string":"a","new_string":"b"}}]}}';
  const slide = easeOutCubic(prog(t, t6.line, 0.8));
  const step = (at: number, label: string, value: React.ReactNode, i: number) => {
    const kk = easeOutCubic(prog(t, at, 0.4));
    return (
      <div key={label} style={{display: 'flex', alignItems: 'baseline', gap: Math.round(0.014 * H), opacity: 0.25 + 0.75 * kk, marginTop: i ? Math.round(0.014 * H) : 0}}>
        <span style={{...mono(H, Ty.monoKicker.size, 500), color: color.accent.mint, width: Math.round(0.03 * H)}}>{kk > 0.5 ? '→' : '·'}</span>
        <span style={{...mono(H, Ty.monoKicker.size, 450), color: color.text.secondary, minWidth: Math.round(0.2 * H)}}>{label}</span>
        <span style={{...mono(H, 0.026, 600), color: color.text.display}}>{value}</span>
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', inset: 0, opacity: k}}>
      <Card t={t} at={t6.line} x={x - (1 - slide) * 0.3 * W} y={Math.round(0.27 * H)} w={Math.round(W * 0.42)} label="a raw stream-json line">
        <div style={{...mono(H, 0.022, 450), color: '#cfc8bd', whiteSpace: 'normal', wordBreak: 'break-all', lineHeight: 1.45}}>{json}</div>
      </Card>
      <div style={{position: 'absolute', left: x, top: Math.round(0.53 * H)}}>
        {step(t6.edit, 'classifyTool("Edit")', 'file_edit', 0)}
        {step(t6.caption, 'caption', '"Editing app.ts"', 1)}
        {step(t6.pose, 'EVENT_TO_STATE', <>{'file_edit → '}<span style={{color: color.pixie.bodyHi}}>{'typing'}</span></>, 2)}
      </div>
      <Cite t={t} repo="vsclaude" path="packages/providers/src/__tests__/providers.test.ts" line="83-106" at={t6.caption + 0.3} out={t6.parser - 0.2} x={W * (1 - layout.marginLeftW)} y={Math.round(0.71 * H)} align="right" />
    </div>
  );
};

const ParserLine: React.FC<{t: number; T: Times07}> = ({t, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t6} = T;
  const k = riseK(t, t6.parser, t6.beta - 0.2);
  if (k <= 0) return null;
  const x = Math.round(W * layout.marginLeftW);
  const lit = easeOutCubic(prog(t, t6.surfaces, 0.4));
  const fall = easeInCubic(prog(t, t6.textOnly - 0.2, 0.9));
  const block = (text: string, tone: string, extra: React.CSSProperties = {}) => (
    <div style={{...mono(H, 0.022, 450), padding: `${Math.round(0.012 * H)}px ${Math.round(0.016 * H)}px`, borderRadius: Math.round(0.01 * H), border: `1px solid ${tone}`, background: 'rgba(16,14,12,0.92)', color: '#d8d1c6', whiteSpace: 'normal', ...extra}}>{text}</div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: Math.round(0.275 * H), width: Math.round(W * 0.42), opacity: k}}>
      <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.text.secondary, marginBottom: Math.round(0.014 * H)}}>{'one line, two blocks · an example'}</div>
      {block('{"type":"text","text":"I will edit the header."}', lit > 0.5 ? color.accent.mint : color.card.ruleStrong, {boxShadow: lit > 0.5 ? `0 0 ${Math.round(0.02 * H)}px rgba(116,201,174,0.25)` : undefined})}
      <div style={{height: Math.round(0.016 * H)}} />
      <div style={{transform: `translateY(${(fall * 0.16 * H).toFixed(1)}px)`, opacity: 1 - 0.75 * fall}}>
        {block('{"type":"tool_use","name":"Edit","input":{"file_path":"/repo/src/app.ts"}}', 'rgba(228,234,231,0.2)', {color: fall > 0.3 ? color.text.tertiary : '#d8d1c6'})}
      </div>
      <div style={{marginTop: Math.round(0.03 * H), display: 'flex', flexDirection: 'column', gap: Math.round(0.012 * H)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H), opacity: lit}}>
          <WinDot H={H} />
          <span style={{...mono(H, 0.024, 500), color: color.text.display}}>{'message: the text surfaces'}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H), opacity: fall}}>
          <MissDot H={H} />
          <span style={{...mono(H, 0.024, 500), color: color.text.secondary}}>{'tool_use: never read (one event per line)'}</span>
        </div>
      </div>
    </div>
  );
};

const LadderLabels: React.FC<{t: number; T: Times07; ctx: FilmCtx; pose: ReturnType<typeof poseOn>; lu: number; lv: number; w: number; h: number}> = ({t, T, ctx, pose, lu, lv, w, h}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t6} = T;
  const k = pullK(t, t6.beta + 0.4, t6.spinner - 0.3);
  if (k <= 0) return null;
  const n = PRIORITY.length;
  const pitch = w / n;
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(0.27 * H), ...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.16em', textTransform: 'uppercase', color: color.accent.mintLabel}}>{'the priority ladder'}</div>
      {PRIORITY.map(([name, val], i) => {
        const u = lu + (-w / 2 + (i + 0.5) * pitch) * ctx.board.p;
        const [x, yb] = screenAtUv(ctx.board, pose, u, lv - (h / 2) * (ctx.board.p / ctx.board.extH), W, H);
        const [, yt] = screenAtUv(ctx.board, pose, u, lv + (-h / 2 + h * Math.max(0.025, val / 100)) * (ctx.board.p / ctx.board.extH), W, H);
        const waiting = name === 'waiting';
        return (
          <React.Fragment key={name}>
            <div style={{position: 'absolute', left: Math.round(x), top: Math.round(yb + (i % 2 ? 0.046 : 0.014) * H), transform: 'translateX(-50%)', ...mono(H, Ty.monoKicker.size, 500), color: waiting ? color.text.secondary : color.text.chipDim, textShadow: '0 1px 6px rgba(5,8,7,0.9)'}}>{name}</div>
            <div style={{position: 'absolute', left: Math.round(x), top: Math.round(yt - 0.05 * H), transform: 'translateX(-50%)', ...mono(H, 0.024, 600), color: waiting ? color.text.secondary : color.text.display}}>{val}</div>
          </React.Fragment>
        );
      })}
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(0.32 * H), width: Math.round(0.36 * W), display: 'flex', flexDirection: 'column', gap: Math.round(0.02 * H)}}>
        <div style={{display: 'flex', gap: Math.round(0.014 * H), alignItems: 'flex-start'}}>
          <span style={{marginTop: Math.round(0.006 * H)}}>
            <MissDot H={H} />
          </span>
          <span style={{...mono(H, 0.024, 500), color: color.text.chipDim, whiteSpace: 'normal', lineHeight: 1.4}}>{'permission requests: in the tests, planned, not live'}</span>
        </div>
        <div style={{display: 'flex', gap: Math.round(0.014 * H), alignItems: 'flex-start', opacity: easeOutCubic(prog(t, t6.demo - 0.2, 0.4))}}>
          <span style={{marginTop: Math.round(0.006 * H)}}>
            <MissDot H={H} />
          </span>
          <span style={{...mono(H, 0.024, 500), color: color.text.chipDim, whiteSpace: 'normal', lineHeight: 1.4}}>{'first-run session: scripted demo data'}</span>
        </div>
      </div>
      <Cite t={t} repo="vsclaude" path="packages/motion/src/priority.ts" line="19-37" at={t6.beta + 0.6} out={t6.spinner - 0.3} x={W * layout.marginLeftW} y={Math.round(0.47 * H)} />
      <Cite t={t} repo="vsclaude" path="packages/motion/src/__tests__/motion.test.ts" line="108-119" at={t6.permission + 0.2} out={t6.spinner - 0.3} x={W * layout.marginLeftW} y={Math.round(0.515 * H)} />
      <Cite t={t} repo="vsclaude" path="README.md" line="127" at={t6.planned + 0.1} out={t6.spinner - 0.3} x={W * layout.marginLeftW} y={Math.round(0.56 * H)} />
      <Cite t={t} repo="vsclaude" path="apps/desktop/src/demo-events.ts" line="5-7" at={t6.demo + 0.1} out={t6.spinner - 0.3} x={W * layout.marginLeftW} y={Math.round(0.605 * H)} />
    </div>
  );
};
