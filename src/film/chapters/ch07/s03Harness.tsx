import React from 'react';
import {useVideoConfig} from 'remotion';
import {SWEEPS, overField, rectField, type Beat, type FieldFn, type LiveLayer, type PinSample, type Press, type Ripple} from '../../../engine/pins';
import {pushIn, type CameraKey} from '../../../engine/camera';
import {ArchDiagram, asDiagramLayout, type CameraKey as DiagramCameraKey} from '../../../engine/diagram';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {color, layout, type as Ty} from '../../../engine/tokens';
import {easeInCubic, easeOutCubic, prog} from '../../../engine/type/ease';
import type {FilmCtx, TimedNode} from '../../types';
import {snippets} from '../../../data/ch07/code';
import ccimLayout from '../../../data/ch07/ccim.layout.json';
import {poseOn, screenAtUv, uvAtScreen} from './kit/frame';
import type {PartSpec} from './kit/spec';
import {Cite, MissDot, Pill, WinDot, mono, pullK, pullStyle, riseK} from './kit/ui';
import {WARM, warmFlat} from './look';
import type {Times07} from './times';

// 07.3 The model only proposes; the harness decides. The module graph assembles from the code
// (every edge an import or a call), one tool call travels to the safety gate, three real commands
// from the tests drop into allow / ask / deny lanes pressed into the wall, the catastrophic check
// is shown above every escape hatch, each tool names its pose, and the path sandbox closes it.

const L = asDiagramLayout(ccimLayout);

interface Bin {
  id: 'allow' | 'ask' | 'deny';
  /** centre uv */
  u: number;
  v: number;
  /** screen centre px */
  sx: number;
  sy: number;
}

const BIN_W = 16;
const BIN_H = 44;

const binsFor = (ctx: FilmCtx, pose: ReturnType<typeof poseOn>): Bin[] => {
  const aspect = ctx.width / ctx.height;
  const xs = [0.655, 0.772, 0.889];
  return (['allow', 'ask', 'deny'] as const).map((id, k) => {
    const [u, v] = uvAtScreen(ctx.board, pose, xs[k], 0.475, aspect);
    const [sx, sy] = screenAtUv(ctx.board, pose, u, v, ctx.width, ctx.height);
    return {id, u, v, sx, sy};
  });
};

/** Three lanes pressed into the wall: a raised rim, a dark floor. */
const lanesField = (ctx: FilmCtx, bins: Bin[], floors: Partial<Record<Bin['id'], PinSample>>): FieldFn => {
  const {board} = ctx;
  const layers = bins.map((b) => {
    const rim = rectField(board, {u: b.u, v: b.v, w: BIN_W + 2, h: BIN_H + 2, radius: 2.5}, {h: 0.11, tint: [WARM[0] * 1.08, WARM[1] * 1.08, WARM[2] * 1.08]});
    const floor = floors[b.id] ?? {h: 0, tint: [0.3, 0.27, 0.24] as [number, number, number]};
    const inner = rectField(board, {u: b.u, v: b.v, w: BIN_W, h: BIN_H, radius: 1.8}, {h: floor.h, tint: floor.tint, glow: floor.glow ?? 0, ground: rim});
    const halfW = ((BIN_W + 4) * board.p) / 2;
    const halfH = ((BIN_H + 4) * board.p) / 2 / board.extH;
    return (u: number, v: number, i: number) => (Math.abs(u - b.u) < halfW && Math.abs(v - b.v) < halfH ? inner(u, v, i) : null);
  });
  return overField(warmFlat, ...layers);
};

/** The sandbox: the working directory as a raised outline; one file inside, four refused outside. */
const sandboxField = (ctx: FilmCtx, centre: [number, number], spots: Array<{u: number; v: number; inside: boolean}>): FieldFn => {
  const {board} = ctx;
  const outer = rectField(board, {u: centre[0], v: centre[1], w: 46, h: 30, radius: 3}, {h: 0.14, tint: [WARM[0] * 1.1, WARM[1] * 1.1, WARM[2] * 1.1]});
  const hole = rectField(board, {u: centre[0], v: centre[1], w: 43, h: 27, radius: 2}, {h: 0, tint: [0.34, 0.31, 0.28], ground: outer});
  const dots = spots.map((s) =>
    s.inside
      ? rectField(board, {u: s.u, v: s.v, w: 5, h: 5, radius: 1.2}, {h: 0.16, tint: [0.62, 1.0, 0.86], glow: 0.8})
      : rectField(board, {u: s.u, v: s.v, w: 2.6, h: 2.6, radius: 1.0}, {h: 0, tint: [0.32, 0.3, 0.28], ground: rectField(board, {u: s.u, v: s.v, w: 6, h: 6, radius: 2.2}, {h: 0.13, tint: [0.7, 0.67, 0.62]})}),
  );
  const near = (s: {u: number; v: number}) => (u: number, v: number) => Math.abs(u - s.u) < 5 * board.p && Math.abs(v - s.v) < (5 * board.p) / board.extH;
  return overField(
    (u, v, i) => {
      const halfW = (25 * board.p) as number;
      const halfH = (17 * board.p) / board.extH;
      return Math.abs(u - centre[0]) < halfW && Math.abs(v - centre[1]) < halfH ? hole(u, v, i) : warmFlat(u, v, i);
    },
    ...dots.map((d, k) => (u: number, v: number, i: number) => (near(spots[k])(u, v) ? d(u, v, i) : null)),
  );
};

const DROP_S = 0.55;

/** A command chip falling into its lane. */
const Drop: React.FC<{t: number; at: number; text: string; bin: Bin; out: number; verdict: 'allow' | 'ask' | 'deny'}> = ({t, at, text, bin, out, verdict}) => {
  const {height: H} = useVideoConfig();
  const t0 = at - DROP_S;
  if (t < t0) return null;
  const k = prog(t, t0, DROP_S);
  const fall = easeInCubic(k);
  const y0 = H * 0.1;
  const y = y0 + (bin.sy - y0) * fall;
  const settle = easeOutCubic(prog(t, at, 0.3));
  const a = Math.min(easeOutCubic(prog(t, t0, 0.2)), 1 - easeInCubic(prog(t, out, 0.35)));
  if (a <= 0) return null;
  const dim = verdict === 'deny' ? settle : 0;
  return (
    <div style={{position: 'absolute', left: Math.round(bin.sx), top: Math.round(y), transform: `translate(-50%, -50%) scale(${(1 - 0.06 * (1 - settle) * (k >= 1 ? 1 : 0)).toFixed(3)})`, opacity: a}}>
      <div
        style={{
          ...mono(H, 0.024, 600),
          padding: `${Math.round(0.008 * H)}px ${Math.round(0.014 * H)}px`,
          borderRadius: Math.round(0.008 * H),
          background: verdict === 'allow' && settle > 0 ? 'rgba(18,40,33,0.95)' : 'rgba(20,18,16,0.95)',
          border: `1px solid ${verdict === 'allow' && settle > 0 ? color.accent.mint : verdict === 'deny' && settle > 0 ? 'rgba(228,234,231,0.2)' : color.card.ruleStrong}`,
          color: dim > 0 ? `rgba(226,229,228,${1 - 0.5 * dim})` : color.text.display,
          textDecoration: dim > 0.5 ? 'line-through' : undefined,
          boxShadow: `0 ${Math.round(0.01 * H)}px ${Math.round(0.03 * H)}px rgba(0,0,0,0.5)`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const LaneLabels: React.FC<{t: number; at: number; out: number; bins: Bin[]; H: number}> = ({t, at, out, bins, H}) => {
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  const top = Math.round(0.155 * H);
  const tones = {allow: color.accent.mint, ask: color.text.display, deny: color.text.secondary};
  return (
    <>
      {bins.map((b) => (
        <div key={b.id} style={{position: 'absolute', left: Math.round(b.sx), top, transform: 'translateX(-50%)', ...pullStyle(k, H), ...mono(H, 0.024, 600), letterSpacing: '0.2em', textTransform: 'uppercase', color: tones[b.id]}}>
          {b.id}
        </div>
      ))}
    </>
  );
};

export const scene0703 = (ctx: FilmCtx, T: Times07): PartSpec => {
  const {width: W, height: H, board, fps} = ctx;
  const {t3} = T;
  const pose = poseOn(ctx, {uv: [0.5, 0.5], pinsAcross: 156, yaw: 0.08, pitch: 0.05});
  const bins = binsFor(ctx, pose);
  const [allow, ask, deny] = bins;

  // sandbox: the outline sits right of centre; one file inside, four outside it
  const [scu, scv] = uvAtScreen(board, pose, 0.7, 0.42, W / H);
  const p = board.p;
  const pv = p / board.extH;
  const spots = [
    {name: 'src/agent.js', u: scu + 8 * p, v: scv - 4 * pv, inside: true},
    {name: '../secret.txt', u: scu - 33 * p, v: scv + 13 * pv, inside: false},
    {name: '/etc/passwd', u: scu + 33 * p, v: scv + 13 * pv, inside: false},
    {name: '.env', u: scu - 33 * p, v: scv - 12 * pv, inside: false},
    {name: '.ssh/id_rsa', u: scu + 33 * p, v: scv - 12 * pv, inside: false},
  ];

  const mintFloor: PinSample = {h: 0.03, tint: [0.5, 0.86, 0.74], glow: 0.55};
  const denyFloor: PinSample = {h: 0, tint: [0.12, 0.11, 0.1]};
  const beats: Beat[] = [
    {id: 'c07-lanes', at: t3.lanes, field: lanesField(ctx, bins, {}), sweep: {...SWEEPS.raster([0, -1], 1.0, [0.5, 0.85]), tintFollowsWave: true}},
    {id: 'c07-lane-allow', at: t3.ls + 0.05, field: lanesField(ctx, bins, {allow: mintFloor}), sweep: SWEEPS.from([allow.u, allow.v], 1.2, 0.04)},
    {id: 'c07-lane-deny', at: t3.root + 0.05, field: lanesField(ctx, bins, {allow: mintFloor, deny: denyFloor}), sweep: SWEEPS.from([deny.u, deny.v], 1.0, 0.04)},
    {id: 'c07-lanes-off', at: t3.tool, field: warmFlat, sweep: SWEEPS.dissolve(0.8)},
    {id: 'c07-sandbox', at: t3.sandbox - 0.2, field: sandboxField(ctx, [scu, scv], spots), sweep: SWEEPS.from([scu, scv], 1.1, 0.05)},
    {id: 'c07-sandbox-off', at: t3.out - 0.1, field: warmFlat, sweep: SWEEPS.from([scu, scv], 1.3, 0.05)},
  ];
  // the ask lane waits: its floor breathes like a held breath, not a spinner
  const askPin = {h: 0, tint: [0, 0, 0] as [number, number, number], glow: 0};
  const askLayer: LiveLayer = {
    fn: (u, v, _i, t) => {
      const dx = (u - ask.u) / p;
      const dy = ((v - ask.v) * board.extH) / p;
      if (Math.abs(dx) > BIN_W / 2 - 0.6 || Math.abs(dy) > BIN_H / 2 - 0.6) return null;
      const breath = 0.5 - 0.5 * Math.cos(((t - t3.rm) / 1.6) * Math.PI * 2);
      askPin.h = 0.015 + 0.03 * breath;
      askPin.tint[0] = 0.42 + 0.35 * breath;
      askPin.tint[1] = 0.4 + 0.33 * breath;
      askPin.tint[2] = 0.37 + 0.3 * breath;
      return askPin;
    },
    from: t3.rm + 0.05,
    to: t3.tool + 0.2,
    fadeS: 0.4,
    region: [ask.u - (BIN_W / 2) * p, ask.v - (BIN_H / 2) * pv, ask.u + (BIN_W / 2) * p, ask.v + (BIN_H / 2) * pv],
  };
  const presses: Press[] = [
    {at: t3.ls, origin: [allow.u, allow.v], radius: 0.018, depth: 0.5},
    {at: t3.rm, origin: [ask.u, ask.v], radius: 0.018, depth: 0.5},
    {at: t3.root, origin: [deny.u, deny.v], radius: 0.022, depth: 0.9},
  ];
  const ripples: Ripple[] = [{at: t3.root, origin: [deny.u, deny.v], amp: 0.3, speed: 0.22, width: 0.03, decayPerS: 1.6, lifeS: 2.2}];

  const camera: CameraKey[] = [
    {at: t3.diagram - 0.2, dur: 1.4, pose, ease: 'camera'},
    {at: t3.diagram + 1.2, dur: Math.max(1, t3.out - t3.diagram - 1.2), pose: pushIn(pose, 0.05), ease: 'inOutSine'},
  ];
  const light = [{at: t3.diagram, dur: 1.4, poolAt: [0.05, 0.0] as [number, number], spread: 1.25, key: 1.0, look: [0, 0] as [number, number]}];

  // the diagram, on its own clock (seconds from t0)
  const t0 = t3.diagram;
  const rel = (s: number) => s - t0;
  const safe = {left: 0.069, right: 0.931, top: 0.22, bottom: 0.655};
  const dcam: DiagramCameraKey[] = [
    {at: 0, target: 'all', zoom: 1.02, pitch: 12, yaw: -5, safe},
    {at: Math.max(3.2, rel(t3.six)), target: 'all', zoom: 1, pitch: 5, yaw: -2, ease: 'camera', safe},
    {at: rel(t3.proposes) - 0.2, target: 'all', zoom: 1.0, pitch: 2, yaw: -0.6, ease: 'camera', safe},
  ];
  const packets = [
    {
      path: ['providers', 'agent', 'safety'],
      at: rel(t3.proposes) - 0.35,
      speed: 900,
      dwell: 0.3,
      chips: ['tool_use run_bash {"command":"rm -rf build"}', 'decide({toolName: "run_bash", …})'],
      result: {label: 'decide()', text: '{ decision: "ask" }', cite: 'safety.js:190'},
    },
  ];
  const highlights = [{paths: [['agent', 'safety'], ['tools', 'safety']], from: rel(t3.decides), to: rel(t3.diagramOut), fade: 0.4}];

  const codeX = Math.round(W * layout.marginLeftW);
  const pages: CodePage[] = [
    {
      at: t3.code,
      source: {snippet: snippets['ccim-safety'], lines: [178, 196]},
      dedent: 2,
      rows: 12,
      zoom: 0.87,
      width: Math.round(W * 0.505),
      header: {label: 'Claude-Code-In-Motion', path: 'src/safety.js', meta: '178-196'},
      cues: [
        cue.reveal(t3.code + 0.1, {stagger: 0.04}),
        cue.highlight(t3.first - 0.5, [182, 186], {until: t3.tool - 0.1}),
        cue.annotate(t3.first - 0.3, 184, 'checked first: holds in *--yolo*', {match: 'if (catastrophic)', until: t3.tool - 0.1}),
      ],
    },
    {
      at: t3.tool,
      transitionDur: 0.6,
      source: {snippet: snippets['ccim-bash'], lines: [28, 33]},
      dedent: 2,
      zoom: 0.87,
      width: Math.round(W * 0.77),
      header: {label: 'Claude-Code-In-Motion', path: 'src/tools/bash-tool.js', meta: 'run_bash · 28-33'},
      cues: [cue.reveal(t3.tool + 0.15, {stagger: 0.05}), cue.highlight(t3.running - 0.1, 32, {until: t3.sandbox - 0.2})],
    },
  ];

  const overlays: TimedNode[] = [
    {
      id: 'c07-arch',
      from: t0,
      to: t3.diagramOut + 0.7,
      render: (t) => (
        <ArchDiagram
          layout={L}
          time={t - t0}
          build={{at: 0.2, span: 3.2}}
          camera={dcam}
          packets={packets}
          highlights={highlights}
          safe={safe}
          packetLog={{x: 0.069, y: 0.695, lines: 1}}
          exit={{at: rel(t3.diagramOut), dur: 0.5}}
        />
      ),
    },
    {id: 'c07-arch-chips', from: t3.deps - 0.2, to: t3.diagramOut + 0.5, render: (t) => <ArchChips t={t} T={T} />},
    {id: 'c07-lane-labels', from: t3.lanes, to: t3.tool + 0.6, render: (t) => <LaneLabels t={t} at={t3.lanes + 0.3} out={t3.tool} bins={bins} H={H} />},
    {
      id: 'c07-drops',
      from: t3.ls - DROP_S - 0.1,
      to: t3.tool + 0.5,
      render: (t) => (
        <>
          <Drop t={t} at={t3.ls} text="ls -la" bin={allow} out={t3.tool} verdict="allow" />
          <Drop t={t} at={t3.rm} text="rm -rf build" bin={ask} out={t3.tool} verdict="ask" />
          <Drop t={t} at={t3.root} text="rm -rf /" bin={deny} out={t3.tool} verdict="deny" />
          <LaneNotes t={t} T={T} bins={bins} />
        </>
      ),
    },
    {id: 'c07-safety-code', from: t3.code, to: t3.sandbox + 0.6, render: (t) => <CodePanel pages={pages} x={codeX} y={Math.round(0.2 * H)} anchor="top-left" t={t} enter={{at: t3.code, dur: 0.5}} exit={{at: t3.sandbox - 0.2, dur: 0.45}} />},
    {id: 'c07-tool-row', from: t3.running - 0.2, to: t3.sandbox + 0.4, render: (t) => <ToolRow t={t} at={t3.running} out={t3.sandbox - 0.2} />},
    {id: 'c07-sandbox-labels', from: t3.sandbox, to: t3.out + 0.4, render: (t) => <SandboxLabels t={t} at={t3.sandbox + 0.25} out={t3.out - 0.25} spots={spots} ctx={ctx} pose={pose} />},
  ];
  void fps;
  return {beats, live: [askLayer], presses, ripples, camera, light, overlays};
};

const ArchChips: React.FC<{t: number; T: Times07}> = ({t, T}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t3} = T;
  const x = Math.round(W * layout.marginLeftW);
  const out = t3.diagramOut;
  const k1 = pullK(t, t3.deps, out);
  const k2 = pullK(t, t3.six, out);
  const k3 = pullK(t, t3.proposes - 0.1, out);
  const y1 = Math.round(0.085 * H);
  const y2 = Math.round(0.135 * H);
  return (
    <>
      {k1 > 0 ? (
        <div style={{position: 'absolute', left: x, top: y1, ...pullStyle(k1, H), display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H)}}>
          <Pill text={'"dependencies": {} · plain fetch, no SDKs'} H={H} caps={false} tone={color.text.display} dot={color.accent.mint} />
        </div>
      ) : null}
      <Cite t={t} repo="Claude-Code-In-Motion" path="package.json" line={48} at={t3.deps + 0.3} out={out} x={x + Math.round(0.36 * W)} y={y1 + Math.round(0.019 * H)} />
      {k2 > 0 ? (
        <div style={{position: 'absolute', left: x, top: y2, ...pullStyle(k2, H)}}>
          <Pill text="6 provider setups · 3 wire formats · 7 tools" H={H} caps={false} tone={color.text.display} />
        </div>
      ) : null}
      <Cite t={t} repo="Claude-Code-In-Motion" path="src/providers/index.js" line="9-16" at={t3.six + 0.35} out={Math.min(out, t3.six + 3.6)} x={x + Math.round(0.36 * W)} y={y2 + Math.round(0.019 * H)} />
      <Cite t={t} repo="Claude-Code-In-Motion" path="src/prompt.js" line="13-19" at={Math.min(out - 3.2, t3.six + 4.0)} out={out} x={x + Math.round(0.36 * W)} y={y2 + Math.round(0.019 * H)} />
      {k3 > 0 ? (
        <div style={{position: 'absolute', left: x, top: Math.round(0.185 * H), ...pullStyle(k3, H), ...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.16em', textTransform: 'uppercase', color: color.accent.mintLabel}}>
          {'the model proposes · the harness decides'}
        </div>
      ) : null}
    </>
  );
};

const LaneNotes: React.FC<{t: number; T: Times07; bins: Bin[]}> = ({t, T, bins}) => {
  const {width: W, height: H} = useVideoConfig();
  const {t3} = T;
  const [, ask, deny] = bins;
  const kAsk = pullK(t, t3.yes - 0.2, t3.tool);
  const kDeny = pullK(t, t3.root + 0.35, t3.tool);
  const note = (b: Bin, k: number, text: string) =>
    k > 0 ? (
      <div style={{position: 'absolute', left: Math.round(b.sx), top: Math.round(b.sy + 0.06 * H), transform: 'translateX(-50%)', ...pullStyle(k, H), ...mono(H, Ty.monoKicker.size, 450), color: color.text.secondary, textAlign: 'center', whiteSpace: 'pre'}}>
        {text}
      </div>
    ) : null;
  return (
    <>
      {note(ask, kAsk, 'waits for\nyour yes')}
      {note(deny, kDeny, 'even in\n--yolo')}
      <Cite t={t} repo="Claude-Code-In-Motion" path="test/safety.test.js" line="13, 21, 56" at={t3.root + 0.6} out={t3.tool} x={Math.round(W * (1 - layout.marginLeftW))} y={Math.round(0.715 * H)} align="right" />
    </>
  );
};

const ToolRow: React.FC<{t: number; at: number; out: number}> = ({t, at, out}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(W * layout.marginLeftW),
        top: Math.round(0.56 * H),
        opacity: k,
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(0.016 * H),
        ...mono(H, 0.026, 500),
        color: color.text.display,
      }}
    >
      <span style={{color: color.text.secondary}}>{'run_bash'}</span>
      <span>{'a test command'}</span>
      <span style={{color: color.accent.mint}}>{'→'}</span>
      <span style={{fontFamily: 'inherit', color: color.pixie.bodyHi}}>{'Debugging'}</span>
      <span style={{color: color.text.secondary}}>{'(chases a bug)'}</span>
    </div>
  );
};

const SandboxLabels: React.FC<{t: number; at: number; out: number; spots: Array<{name: string; u: number; v: number; inside: boolean}>; ctx: FilmCtx; pose: ReturnType<typeof poseOn>}> = ({t, at, out, spots, ctx, pose}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  const [cx, cy] = screenAtUv(ctx.board, pose, spots[0].u, spots[0].v, W, H);
  return (
    <div style={{position: 'absolute', inset: 0, ...pullStyle(k, H)}}>
      <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(0.3 * H), width: Math.round(0.4 * W)}}>
        <div style={{...mono(H, Ty.monoKicker.size, 500), letterSpacing: '0.16em', textTransform: 'uppercase', color: color.accent.mintLabel}}>{'path sandbox'}</div>
        <div style={{...mono(H, 0.028, 500), color: color.text.display, marginTop: Math.round(0.02 * H), lineHeight: 1.55}}>
          {spots
            .filter((s) => !s.inside)
            .map((s) => (
              <div key={s.name} style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H)}}>
                <MissDot H={H} />
                <span style={{color: color.text.chipDim}}>{s.name}</span>
                <span style={{color: color.text.tertiary}}>{'refused'}</span>
              </div>
            ))}
          <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H)}}>
            <WinDot H={H} />
            <span>{spots[0].name}</span>
            <span style={{color: color.accent.mint}}>{'allowed'}</span>
          </div>
        </div>
      </div>
      {spots.map((s) => {
        const [x, y] = screenAtUv(ctx.board, pose, s.u, s.v, W, H);
        return (
          <div key={s.name} style={{position: 'absolute', left: Math.round(x), top: Math.round(y + 0.03 * H), transform: 'translateX(-50%)', ...mono(H, Ty.monoKicker.size, 500), color: s.inside ? color.accent.mint : color.text.secondary}}>
            {s.name}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: Math.round(cx), top: Math.round(cy - 0.16 * H), transform: 'translateX(-50%)', ...mono(H, Ty.monoKicker.size, 450), color: color.text.tertiary}}>{'the working directory'}</div>
      <Cite t={t} repo="Claude-Code-In-Motion" path="test/safety.test.js" line="83-90" at={at + 0.4} out={out} x={Math.round(W * layout.marginLeftW)} y={Math.round(0.65 * H)} />
    </div>
  );
};
