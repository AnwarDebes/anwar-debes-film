import React from 'react';
import {ChapterCard, Stamp, GlassCard, Numeral} from '../../engine/type';
import {CodePanel, cue as codeCue, panelWidthFor, type CodePage} from '../../engine/code';
import {apertureForBlur, frameOn, lowAnglePull, pushIn, type CameraKey, type CameraPose, type FocusKey} from '../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, FILM_RIPPLE, SWEEPS, type Beat, type LightKey, type Press, type Ripple} from '../../engine/pins';
import {color, font} from '../../engine/tokens';
import type {PixieCue, PixieWalk} from '../../pixie';
import {HANDOFF} from '../handoff';
import type {ChapterModule, ChapterSpec, FilmCtx, TimedNode} from '../types';
import {cues} from './ch10.cues';
import {times10, POCKET_REC} from './ch10/times';
import {mergeParts} from './ch10/kit/spec';
import {Chips, Fact, Guide, Mono, Plate, RuleLine, Statement, Strike, Term, env, project, scurry, type ChipSpec} from './ch10/kit/ui';
import {deviceNode, dustNode} from './ch10/scene';
import * as W10 from './ch10/walls';
import {snippets10} from '../../data/ch10/code';
import {REC10} from '../../data/ch10/recordings';

// Chapter 10, "Built for people": software that runs where you can see it. Eight places on one
// street of the wall: a desktop simulated in a phone's browser, a textbook turned into cards by a
// local model, one dataset in three databases, a drone catalogue that names the model and never
// the owner, a job matcher, a music-prompt builder, a one-GPU studio and a storefront for a brand
// that does not exist. Every time comes from the timeline (./ch10/times.ts).

const RULE_BASE = 33; // repositories lit on the rule line before this chapter (chapters 01-09)


const build = (ctx: FilmCtx): ChapterSpec => {
  const {board, tl, width: W, height: H, fps} = ctx;
  const T = times10(tl);
  const {c} = T;
  const aspect = W / H;
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const f = (s: number) => Math.round(s * fps);

  // ------------------------------------------------------------ camera language
  const P0 = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});
  const place = (cu: number, pins = 146, yaw = 0.15, pitch = 0.06, cv = 0.52): CameraPose => frameOn(board, {uv: [cu, cv], pinsAcross: pins, yaw, pitch, aspect});
  const PP = place(0.5);
  const camera: CameraKey[] = [{at: T.chStart, pose: P0}];
  const move = (at: number, dur: number, pose: CameraPose, ease: CameraKey['ease'] = 'camera') => camera.push({at, dur, pose, ease});
  /** the treadmill: dolly right with the re-target, then creep back while the place holds */
  const dolly = (at: number, sceneEnd: number, cu = 0.5) => {
    move(at, 1.5, place(cu + 0.034, 142, 0.17));
    move(at + 1.55, Math.max(1, sceneEnd - at - 2.2), pushIn(place(cu, 140, 0.15), 0.03), 'inOutSine');
  };

  // ------------------------------------------------------------ wall, light, effects
  const beats: Beat[] = [];
  const beat = (id: string, at: number, field: Beat['field'], sweep?: Beat['sweep']) => beats.push({id: `c10-${id}`, at, field, sweep});
  const fromRight = (speed = 1.25): Beat['sweep'] => ({kind: 'linear', origin: [1.02, 0.5], direction: [-1, 0], speed, jitterS: 0.05, tintFollowsWave: true});
  const light: LightKey[] = [{at: T.chStart, key: 1, look: [0, 0], poolAt: [0, 0], spread: 1, pool: 1, env: 1}];
  const subjWorld: [number, number] = [W10.SUBJ[0] - 0.5, W10.SUBJ[1] * board.extH - board.extH / 2];
  const presses: Press[] = [];
  const ripples: Ripple[] = [];
  const focus: FocusKey[] = [];

  const world: TimedNode[] = [];
  const overlays: TimedNode[] = [];
  const pixie: PixieCue[] = [];
  const walks: PixieWalk[] = [];
  let walkX = 0;
  const walkStep = (at: number, dur: number) => {
    walks.push(scurry(f(at), dur, walkX, 0.22));
    walkX += 0.22;
  };
  const say = (at: number, activity: PixieCue['activity'], detail: string) => pixie.push({frame: f(at), activity, detail});
  const ov = (id: string, from: number, to: number, render: TimedNode['render']) => overlays.push({id: `c10-${id}`, from, to, render});
  const plateLights: number[] = [];
  const codeHide: Array<[number, number]> = [];

  // ============================================================ 10.0 the gate: a cube unfolds
  const G = T.gate;
  beat('cube', G.at, W10.cubeField(board), {origin: W10.GATE, speed: 0.95, jitterS: 0.06});
  beat('net', G.unfold, W10.netField(board), {origin: W10.GATE, speed: 0.62, jitterS: 0.05, tintFollowsWave: true});
  beat('street', G.street, W10.streetField(board), {origin: W10.GATE, speed: 0.9, jitterS: 0.05, tintFollowsWave: true});
  const PG1 = frameOn(board, {uv: W10.GATE, z: 0.46 * relief, pinsAcross: 118, screen: [0.68, 0.5], yaw: 0.24, pitch: -0.05, aspect});
  const PG2 = frameOn(board, {uv: [0.5, 0.53], pinsAcross: 158, yaw: 0.1, pitch: 0.05, aspect});
  move(G.at - 0.25, 1.25, PG1);
  move(G.unfold, 1.9, PG2);
  light.push({at: G.at - 0.3, dur: 0.6, key: 0.84, spread: 0.72, poolAt: [W10.GATE[0] - 0.5, W10.GATE[1] * board.extH - board.extH / 2], look: [-0.18, -0.06]});
  light.push({at: G.unfold, dur: 1.4, key: 1.04, spread: 1.4, poolAt: [0, 0.01], look: [0, 0]});
  ov('card', G.cardIn, G.cardOut + 0.4, (t) => <ChapterCard index="10" kicker="eight repositories" title="Built for people." at={G.cardIn} exitAt={G.cardOut} t={t} />);
  say(G.at, 'idle', '');

  // ============================================================ 10.1 the street
  const S = T.street;
  const PS = frameOn(board, {uv: [0.6, 0.53], pinsAcross: 122, yaw: 0.17, pitch: 0.06, aspect});
  move(S.dollyFrom, S.dollyTo - S.dollyFrom, PS, 'inOutSine');
  say(S.search, 'searching', 'Search eight front pages');
  walkStep(S.dollyFrom + 0.4, S.dollyTo - S.dollyFrom - 0.6);
  light.push({at: S.dollyFrom, dur: 6, spread: 1.3, poolAt: [0.1, 0.012]});

  // ============================================================ 10.2 PocketOS
  const Pk = T.pocket;
  const phoneU = W10.streetU(board, 7);
  beat('pocket', Pk.wall, W10.pocketField(board), {origin: [phoneU, W10.STREET_V], speed: 0.85, jitterS: 0.05});
  move(Pk.wall - 0.1, 1.5, PP);
  move(Pk.wall + 1.5, Math.max(1, Pk.laptopIn - Pk.wall - 1.6), pushIn(PP, 0.035), 'inOutSine');
  light.push({at: Pk.wall, dur: 1.2, spread: 1.05, poolAt: subjWorld, key: 1});
  plateLights.push(Pk.plate);
  ov('pk-plate', Pk.plate, T.mneme.wall + 0.3, (t) => <Plate t={t} at={Pk.plate} exitAt={T.mneme.wall - 0.1} name="PocketOS" status="WORKING WEB APP v0.1.0 · LIVE PWA" tone="mint" />);
  // the phone: live capture of anwardebes.github.io/PocketOS/ (frame-stepped, 390 x 844 CSS at 2x)
  const ruleU = 0.5;
  const PHONE_HOLD = {sx: 0.7, sy: 0.45, h: 0.74, yaw: -0.12};
  world.push(
    deviceNode(
      'c10-phone',
      {
        kind: 'phone',
        from: Pk.recAt,
        to: Pk.devicesOut + 0.7,
        rec: {...REC10.phone, startAt: Pk.recAt},
        // from the 768 px switch on, the phone holds the session's last screen (a frame of the
        // same capture), so only one video screen plays at a time
        swapToStill: {at: Pk.laptopIn - 0.2, src: 'ch10/pocketos-phone-terminal.png', size: [780, 1688]},
        holds: [
          {at: Pk.recAt, hold: PHONE_HOLD},
          {at: Pk.laptopIn, dur: 1.2, hold: {sx: 0.33, sy: 0.45, h: 0.52, yaw: 0.1}},
        ],
        inS: 0.75,
        outS: 0.65,
      },
      camera,
      fps,
      aspect,
    ),
  );
  // the laptop: desktop mode of the same app (1440 x 900 CSS at 1.5x), windows floating
  world.push(
    deviceNode(
      'c10-laptop-pocket',
      {
        kind: 'laptop',
        from: Pk.laptopIn,
        to: Pk.devicesOut + 0.6,
        rec: {...REC10.desktop, startAt: Pk.laptopIn},
        holds: [{at: Pk.laptopIn, hold: {sx: 0.74, sy: 0.42, h: 0.36, yaw: -0.05}}],
        look: {reflections: 0.1, glare: 0.08},
        inS: 0.8,
        outS: 0.6,
      },
      camera,
      fps,
      aspect,
    ),
  );
  const R = Pk.rec;
  ov('pk-apps', Pk.apps, Pk.laptopIn - 0.2, (t) => (
    <>
      <Fact t={t} at={Pk.apps} exitAt={Pk.kernelQuote - 0.3} text="**9** apps · **14** terminal commands · installable · works offline" y={0.25} />
      <Chips
        t={t}
        side="left"
        y0={0.35}
        dy={0.048}
        chips={[
          {repo: 'PocketOS', path: 'src/apps/registry.ts', line: '60-152', at: Pk.apps + 0.4, exitAt: Pk.kernelQuote - 0.3},
          {repo: 'PocketOS', path: 'src/apps/terminal/commands.ts', line: '38-206', at: Pk.apps + 0.7, exitAt: Pk.kernelQuote - 0.3},
          {repo: 'PocketOS', path: 'vite.config.ts', line: '18-69', at: Pk.apps + 1.0, exitAt: Pk.kernelQuote - 0.3},
        ]}
      />
    </>
  ));
  ov('pk-term', R.ls - 0.2, Pk.laptopIn, (t) => (
    <>
      <Term
        t={t}
        at={R.ls - 0.2}
        exitAt={Pk.laptopIn - 0.5}
        x={0.069 * W}
        y={0.47 * H}
        width={0.35 * W}
        sizeH={0.022}
        lines={[
          {at: R.ls, text: 'ls', kind: 'cmd', prompt: '/home/user $ '},
          {at: R.lsEnter + 0.1, text: 'Documents/  Pictures/  Projects/  readme.md', kind: 'out'},
          {at: R.frob, text: 'frobnicate', kind: 'cmd', prompt: '/home/user/Documents $ '},
          {at: R.frobEnter + 0.1, text: 'command not found: frobnicate', kind: 'err'},
        ]}
      />
      <Chips t={t} side="left" y0={0.68} chips={[{repo: 'PocketOS', path: 'src/fs/seed.ts', line: '5-19, 79-91', at: R.lsEnter + 0.3, exitAt: R.frob - 0.2}]} />
      <Chips t={t} side="left" y0={0.68} chips={[{repo: 'PocketOS', path: 'src/apps/terminal/commands.ts', line: 182, at: R.frobEnter + 0.3, exitAt: Pk.laptopIn - 0.5}]} />
    </>
  ));
  ov('pk-kernel', Pk.kernelQuote, Pk.laptopIn, (t) => (
    <>
      <Fact t={t} at={Pk.kernelQuote} exitAt={Pk.laptopIn - 0.4} text="“It is not a kernel and it does not boot on hardware.”" y={0.25} sizeH={0.032} color={color.text.caption} />
      <Chips t={t} side="left" y0={0.36} chips={[{repo: 'PocketOS', path: 'README.md', line: 21, at: Pk.kernelQuote + 0.5, exitAt: Pk.laptopIn - 0.4}]} />
    </>
  ));
  say(Pk.recAt, 'running', 'Open anwardebes.github.io/PocketOS/');
  say(R.ls, 'typing', 'ls, cd Documents, cat welcome.md');
  say(R.frobEnter, 'running', 'frobnicate → command not found');
  // beat 2: the 768 px switch
  move(Pk.laptopIn - 0.3, 1.4, place(0.5, 150, 0.06, 0.05));
  beat('bp-off', Pk.laptopIn - 0.2, W10.breakpointField(board, ruleU, false), {origin: [0.5, 0.5], speed: 1.2, jitterS: 0.05});
  beat('bp-rule', Pk.rule - 0.15, W10.breakpointField(board, ruleU, true), {kind: 'linear', origin: [ruleU, 0.78], direction: [0, -1], speed: 0.5, jitterS: 0.02, tintFollowsWave: true});
  light.push({at: Pk.laptopIn, dur: 1.2, spread: 1.35, poolAt: [0, 0.01]});
  ov('pk-bp', Pk.rule - 0.1, Pk.devicesOut + 0.2, (t) => {
    // the constant flies from the top of the rule like a flag, its source right under it
    const [x] = project(camera, board, t, [ruleU, 0.78], 0.02, W, H);
    const lx = Math.round(x + 0.012 * W);
    return (
      <>
        <Mono t={t} at={Pk.rule} exitAt={Pk.devicesOut - 0.2} text="MOBILE_BREAKPOINT = 768" x={lx} y={0.105 * H} sizeH={0.027} tone={color.accent.mint} weight={600} bg />
        <Chips t={t} side="left" x={lx} y0={0.165} chips={[{repo: 'PocketOS', path: 'src/hooks/useViewportMode.ts', line: '5-9', at: Pk.rule + 0.3, exitAt: Pk.devicesOut - 0.2}]} />
      </>
    );
  });
  // beat 3: the README's kernel/ and the code's kernel/
  move(Pk.tree - 0.2, 1.6, place(0.52, 142, 0.18));
  beat('tree', Pk.tree, W10.treeField(board, false), {origin: [0.55, 0.85], speed: 0.9, jitterS: 0.05});
  beat('tree-k', Pk.strike, W10.treeField(board, true), {...SWEEPS.booleanFlip([0.55, 0.85]), speed: 1.6});
  light.push({at: Pk.tree, dur: 1, spread: 1.1, poolAt: [0.08, 0.04]});
  ov('pk-tree-labels', Pk.tree + 0.3, T.mneme.wall, (t) => (
    <>
      {W10.POCKET_SRC.map((name, k) => {
        const p = W10.treeTile(board, k);
        const [x, y] = project(camera, board, t, [p.u, p.v], 0.15 * relief, W, H);
        return <Mono key={name} t={t} at={Pk.tree + 0.35 + k * 0.05} exitAt={T.mneme.wall - 0.15} text={`${name}/`} x={x} y={y} align="center" sizeH={0.022} tone={color.text.key} weight={name === 'kernel' && t > Pk.strike ? 700 : 500} />;
      })}
      {(() => {
        const p = W10.TREE_FILE(board);
        const [x, y] = project(camera, board, t, [p.u, p.v], 0.2 * relief, W, H);
        return <Mono t={t} at={Pk.strike + 0.2} exitAt={T.mneme.wall - 0.15} text="types.ts" x={x} y={y} align="center" sizeH={0.022} tone={color.text.key} weight={600} />;
      })()}
      {(() => {
        const p = W10.treeTile(board, 0);
        const [x, y] = project(camera, board, t, [p.u - 7.5 * board.p, p.v + (5.2 * board.p) / board.extH], 0, W, H);
        return <Mono t={t} at={Pk.tree + 0.3} exitAt={T.mneme.wall - 0.15} text="PocketOS/src/" x={x} y={y} sizeH={0.024} tone={color.accent.mintLabel} weight={600} />;
      })()}
    </>
  ));
  ov('pk-claim', Pk.claim - 0.3, T.mneme.wall, (t) => (
    <>
      <Strike
        t={t}
        at={Pk.claim - 0.3}
        strikeAt={Pk.strike}
        fixAt={Pk.fix - 0.25}
        exitAt={T.mneme.wall - 0.15}
        label="README.md:97"
        claim={'kernel/   window manager, process registry,\n          focus and z-order, event bus'}
        fix="code: src/kernel/types.ts only"
        x={0.069 * W}
        y={0.25 * H}
        width={0.4 * W}
      />
      <Chips
        t={t}
        side="left"
        y0={0.63}
        chips={[
          {repo: 'PocketOS', path: 'README.md', line: '97-99', at: Pk.claim + 0.2, exitAt: T.mneme.wall - 0.15},
          {repo: 'PocketOS', path: 'src/kernel/types.ts', line: '1-64', at: Pk.fix, exitAt: T.mneme.wall - 0.15},
        ]}
      />
    </>
  ));
  say(Pk.strike, 'writing', 'Edit README claim: kernel/ → src/kernel/types.ts');

  // ============================================================ 10.3 Mneme-Education-Ecosystem
  const M = T.mneme;
  beat('mneme', M.wall, W10.mnemeField(board), {kind: 'linear', origin: [0.4, 0.5], direction: [1, 0], speed: 0.8, jitterS: 0.05, tintFollowsWave: true});
  move(M.wall - 0.1, 1.6, place(0.5, 146, 0.14, 0.07));
  move(M.wall + 1.6, Math.max(1, M.funnel - M.wall - 1.8), pushIn(place(0.5, 146, 0.14, 0.07), 0.04), 'inOutSine');
  light.push({at: M.wall, dur: 1, spread: 1.05, poolAt: subjWorld});
  plateLights.push(M.plate);
  ov('mn-plate', M.plate, M.end + 0.4, (t) => (
    <Plate t={t} at={M.plate} exitAt={M.end - 0.3} name="Mneme-Education-Ecosystem" status="ALPHA v0.2.0 · LIBRARY + CLI · QUALITY BENCHMARK NOT YET RUN" tone="amber" />
  ));
  ov('mn-anki', M.anki, M.funnel, (t) => (
    <>
      <Fact t={t} at={M.anki} exitAt={M.funnel - 0.1} text="a textbook in, an **Anki** deck out · the model runs on your machine (Ollama)" y={0.3} />
      <Chips t={t} side="left" y0={0.46} chips={[{repo: 'Mneme-Education-Ecosystem', path: 'README.md', line: '15-18', at: M.anki + 0.4, exitAt: M.funnel - 0.1}]} />
    </>
  ));
  // the funnel: one bar per stage, rising in order as the run is read
  for (let k = 1; k <= 5; k++) beat(`funnel${k}`, M.funnel + (k - 1) * 0.42, W10.funnelField(board, k), {kind: 'linear', origin: [0.4, 0.3], direction: [0, 1], speed: 1.4, jitterS: 0.03});
  move(M.funnel - 0.2, 1.4, place(0.52, 140, 0.2, 0.03));
  ov('mn-funnel', M.funnel, M.flip, (t) => {
    const ch = W10.funnelChart(board);
    const pitch = ch.width / 5;
    return (
      <>
        {W10.FUNNEL.map((n, k) => {
          const u = ch.u + (-ch.width / 2 + (k + 0.5) * pitch) * board.p;
          const top = ch.v + ((-ch.height / 2 + (n / 19) * ch.height) * board.p) / board.extH;
          const bot = ch.v - ((ch.height / 2) * board.p) / board.extH;
          const [x, y] = project(camera, board, t, [u, top], (0.2 + 0.45 * (n / 19)) * relief, W, H);
          const [xb, yb] = project(camera, board, t, [u, bot], 0, W, H);
          const at = M.funnel + k * 0.42 + 0.25;
          const last = k === 4;
          return (
            <React.Fragment key={k}>
              <Mono t={t} at={last ? M.seventeen - 0.05 : at} exitAt={M.flip - 0.2} text={String(n)} x={x} y={y - 0.04 * H} align="center" sizeH={last ? 0.05 : 0.036} weight={700} tone={last ? color.accent.mint : color.text.key} />
              <Mono t={t} at={at} exitAt={M.flip - 0.2} text={W10.FUNNEL_LABELS[k]} x={xb} y={yb + 0.026 * H} align="center" sizeH={0.023} tone={color.text.caption} />
            </React.Fragment>
          );
        })}
        <Fact t={t} at={M.funnel + 0.3} exitAt={M.flip - 0.2} text="one source text → **17** cards" y={0.3} />
        <Chips
          t={t}
          side="left"
          y0={0.46}
          chips={[{repo: 'Mneme-Education-Ecosystem', path: 'results/photosynthesis.summary.json', line: '75-112', at: M.funnel + 0.6, exitAt: M.flip - 0.2}]}
        />
      </>
    );
  });
  say(M.funnel, 'reading', 'Read results/photosynthesis.summary.json');
  // one card flips: its rating comes with the rules that produced it
  beat('card', M.flip, W10.cardField(board, 'front'), {origin: [W10.SUBJ[0], W10.SUBJ[1]], speed: 1.2, jitterS: 0.04});
  beat('card-back', M.hard - 0.35, W10.cardField(board, 'back'), {kind: 'linear', origin: [W10.SUBJ[0] - 0.12, 0.5], direction: [1, 0], speed: 0.9, jitterS: 0.02, tintFollowsWave: true, tintLeadS: 0.12});
  ov('mn-rating', M.hard - 0.3, M.receipt, (t) => (
    <GlassCard t={t} at={M.hard - 0.3} exitAt={M.receipt - 0.3} x={0.069 * W} y={0.24 * H} width={0.36 * W} label="difficulty · heuristic">
      <div style={{fontFamily: font.sans, fontWeight: 700, fontSize: 0.07 * H, color: color.signal.amber, letterSpacing: '-0.02em', lineHeight: 1}}>
        HARD <span style={{fontSize: 0.034 * H, color: color.text.secondary, fontWeight: 500}}>score 4</span>
      </div>
      <div style={{marginTop: 0.018 * H, fontFamily: font.mono, fontSize: 0.024 * H, lineHeight: 1.45, color: color.text.caption, whiteSpace: 'pre'}}>
        {'+2  sentence-length answer\n+1  contains negation\n+1  long question'}
      </div>
    </GlassCard>
  ));
  ov('mn-rating-chips', M.hard, M.receipt, (t) => (
    <Chips
      t={t}
      side="left"
      y0={0.57}
      chips={[
        {repo: 'Mneme-Education-Ecosystem', path: 'README.md', line: '223-227', at: M.hard + 0.3, exitAt: M.receipt - 0.3},
        {repo: 'Mneme-Education-Ecosystem', path: 'src/mneme/difficulty/heuristic.py', line: '44-53', at: M.hard + 0.6, exitAt: M.receipt - 0.3},
        {repo: 'Mneme-Education-Ecosystem', path: 'src/mneme/difficulty/heuristic.py', line: '79-92', at: M.rules + 0.3, exitAt: M.receipt - 0.3},
      ]}
    />
  ));
  // 44 columns at 0.9 zoom (a 0.023 H code font), right-aligned on the 7% margin
  const CODE_ZOOM = 0.9;
  const codeW = panelWidthFor(H, 44, 2, false, CODE_ZOOM);
  const codeIn = M.hard + 0.75;
  const codePages: CodePage[] = [
    {
      at: codeIn,
      source: {snippet: snippets10['mneme-heuristic'], lines: [79, 92]},
      dedent: 8,
      zoom: CODE_ZOOM,
      rows: 8,
      view: 79,
      width: codeW,
      header: {path: 'src/mneme/difficulty/heuristic.py'},
      cues: [
        codeCue.reveal(codeIn + 0.05, {stagger: 0.03, style: 'fade'}),
        codeCue.highlight(M.rules, [79, 81], {until: M.rules + 0.65}),
        codeCue.highlight(M.rules + 0.65, [83, 85], {until: M.rules + 1.3}),
        codeCue.scroll(M.rules + 1.1, [85, 92], {dur: 0.4, align: 'top'}),
        codeCue.highlight(M.rules + 1.45, [90, 92], {until: M.receipt - 0.4}),
      ],
    },
  ];
  ov('mn-code', codeIn - 0.2, M.receipt, (t) => (
    <>
      <CodePanel pages={codePages} x={0.93 * W - codeW} y={0.175 * H} anchor="top-left" t={t} enter={{at: codeIn, dur: 0.45}} exit={{at: M.receipt - 0.45, dur: 0.35}} />
    </>
  ));
  codeHide.push([codeIn - 0.1, M.receipt]);
  // every run leaves a receipt
  beat('receipt', M.receipt - 0.2, W10.receiptField(board), {kind: 'linear', origin: [0.4, 0.3], direction: [1, 0], speed: 1.1, jitterS: 0.03, tintFollowsWave: true});
  move(M.receipt - 0.3, 1.5, place(0.5, 144, 0.13, 0.06, 0.53));
  ov('mn-receipt', M.receipt, M.notRun, (t) => (
    <>
      <GlassCard t={t} at={M.receipt} exitAt={M.notRun - 0.35} x={0.069 * W} y={0.24 * H} width={0.38 * W} label="every run leaves a receipt">
        <div style={{fontFamily: font.mono, fontSize: 0.024 * H, lineHeight: 1.55, color: color.text.caption, whiteSpace: 'pre'}}>
          {'config snapshot   llm: ollama\nprompt_version    1\nlibrary_version   0.1.0\ncounts per stage  in → out, 8 stages'}
        </div>
      </GlassCard>
      <Chips
        t={t}
        side="left"
        y0={0.56}
        chips={[
          {repo: 'Mneme-Education-Ecosystem', path: 'results/photosynthesis.summary.json', line: '11-135', at: M.receipt + 0.5, exitAt: M.notRun - 0.35},
          {repo: 'Mneme-Education-Ecosystem', path: 'src/mneme/pipeline.py', line: '130-210', at: M.receipt + 0.8, exitAt: M.notRun - 0.35},
        ]}
      />
      {W10.RECEIPT.map((r, k) => {
        const u = W10.SUBJ[0] + (-32 + (k + 0.5) * 8) * board.p;
        const [x, y] = project(camera, board, t, [u, W10.RECEIPT_V - (15 * board.p) / board.extH], 0, W, H);
        return <Mono key={r[0]} t={t} at={M.receipt + 0.2 + k * 0.08} exitAt={M.notRun - 0.35} text={String(r[2])} x={x} y={y + 0.03 * H} align="center" sizeH={0.024} tone={color.text.key} weight={600} />;
      })}
    </>
  ));
  // its README marks the quality benchmark NOT YET RUN
  beat('miss', M.notRun - 0.2, W10.missField(board), {origin: [W10.SUBJ[0], W10.SUBJ[1]], speed: 1.1, jitterS: 0.05});
  light.push({at: M.notRun - 0.2, dur: 0.8, key: 0.94, spread: 0.95, poolAt: subjWorld});
  ov('mn-notrun', M.notRun - 0.1, M.end + 0.3, (t) => (
    <>
      <Stamp label="NOT YET RUN" tone={color.signal.amber} filled={false} at={M.notRun} exitAt={M.end - 0.35} t={t} x={0.5 * W} y={0.43 * H} sizeH={0.075} rotate={-3} />
      <Chips
        t={t}
        side="right"
        y0={0.6}
        chips={[
          {repo: 'Mneme-Education-Ecosystem', path: 'README.md', line: 52, at: M.notRun + 0.5, exitAt: M.end - 0.35},
          {repo: 'Mneme-Education-Ecosystem', path: 'docs/BENCHMARK.md', line: '3-6', at: M.capitals, exitAt: M.end - 0.35},
        ]}
      />
    </>
  ));
  say(M.notRun - 0.1, 'reading', 'Read docs/BENCHMARK.md');

  // ============================================================ 10.4 IDM
  const I = T.idm;
  beat('idm', I.wall, W10.idmField(board), fromRight());
  dolly(I.wall - 0.1, I.seed);
  walkStep(I.wall, 1.4);
  light.push({at: I.wall, dur: 1, key: 1, spread: 1.05, poolAt: subjWorld});
  plateLights.push(I.plate);
  ov('idm-plate', I.plate, I.end + 0.4, (t) => <Plate t={t} at={I.plate} exitAt={I.end - 0.3} name="IDM" status="COURSEWORK · UiA IKT453 · LOCAL DOCKER STACK" />);
  ov('idm-chip0', I.plate + 0.5, I.seed, (t) => <Chips t={t} side="left" y0={0.27} chips={[{repo: 'IDM', path: 'report.tex', line: '93, 97, 100', at: I.plate + 0.6, exitAt: I.seed - 0.2}, {repo: 'IDM', path: 'README.md', line: 3, at: I.three, exitAt: I.seed - 0.2}]} />);
  beat('seed', I.seed, W10.seedField(board), {origin: [W10.SPLIT_U[0], W10.SUBJ[1]], speed: 1.5, jitterS: 0.04});
  beat('split', I.split, W10.splitField(board), {origin: [W10.SPLIT_U[0], W10.SUBJ[1]], speed: 0.75, jitterS: 0.05, tintFollowsWave: true});
  ov('idm-split', I.seed, I.monitorIn + 0.3, (t) => (
    <>
      {[
        ['PostgreSQL · star schema', 0],
        ['MongoDB · month buckets', 1],
        ['Neo4j · graph', 2],
      ].map(([label, k]) => {
        const [x, y] = project(camera, board, t, [W10.SPLIT_U[k as number], W10.SUBJ[1] - (19 * board.p) / board.extH], 0, W, H);
        return <Mono key={label as string} t={t} at={I.split + 0.4 + (k as number) * 0.25} exitAt={I.monitorIn} text={label as string} x={x} y={y} align="center" sizeH={0.022} tone={color.text.caption} />;
      })}
      <Fact t={t} at={I.split + 0.2} exitAt={I.monitorIn} text="**473,189** rows · **155,063** documents · **619,646** nodes" y={0.27} />
      <Chips
        t={t}
        side="left"
        y0={0.43}
        chips={[
          {repo: 'IDM', path: 'report.tex', line: 583, at: I.split + 0.5, exitAt: I.monitorIn},
          {repo: 'IDM', path: 'results/bench.json', line: '899', at: I.split + 0.8, exitAt: I.monitorIn},
          {repo: 'IDM', path: 'report.tex', line: 974, at: I.split + 1.1, exitAt: I.monitorIn},
        ]}
      />
    </>
  ));
  // the committed screenshots on a monitor (the deployed shell has no backend)
  world.push(
    deviceNode('c10-monitor-a', {kind: 'monitor', from: I.monitorIn, to: I.compare + 0.05, still: {src: 'ch10/idm-overview.png', size: [1355, 881]}, holds: [{at: I.monitorIn, hold: {sx: 0.66, sy: 0.44, h: 0.48, yaw: -0.12}}], inS: 0.6, outS: 0.01}, camera, fps, aspect),
  );
  world.push(
    deviceNode('c10-monitor-b', {kind: 'monitor', from: I.compare, to: I.monitorOut + 0.6, still: {src: 'ch10/idm-compare.png', size: [1919, 1079]}, holds: [{at: I.compare, hold: {sx: 0.66, sy: 0.44, h: 0.48, yaw: -0.12}}], inS: 0.01, outS: 0.6}, camera, fps, aspect),
  );
  ov('idm-shots', I.monitorIn + 0.3, I.monitorOut + 0.4, (t) => (
    <>
      <Mono t={t} at={I.monitorIn + 0.35} exitAt={I.monitorOut} text={'screenshots from the repo\nthe deployed shell has no backend'} x={0.069 * W} y={0.3 * H} sizeH={0.023} tone={color.text.caption} />
      <Chips t={t} side="left" y0={0.37} chips={[{repo: 'IDM', path: 'docs/screenshots', at: I.monitorIn + 0.6, exitAt: I.monitorOut}]} />
    </>
  ));
  // three lanes race for Q2, then Q11 runs graph-only off the edge of the wall
  const lanes = (a: boolean, b: boolean, d: boolean) => W10.lanesField(board, [a, b, d]);
  beat('lanes', I.monitorOut - 0.1, lanes(false, false, false), fromRight(1.6));
  const laneSweep = (dur: number, k: number): Beat['sweep'] => ({kind: 'linear', origin: [W10.LANE_U0, W10.laneV(k)], direction: [1, 0], speed: (W10.LANE_U1 - W10.LANE_U0) / dur, jitterS: 0.01, tintFollowsWave: true});
  beat('lane-mongo', I.race, lanes(true, false, false), laneSweep(I.mongoDone - I.race, 0));
  beat('lane-neo', I.race + 0.001, lanes(true, true, false), laneSweep(I.neoDone - I.race, 1));
  beat('lane-pg', I.race + 0.002, lanes(true, true, true), laneSweep(I.pgDone - I.race, 2));
  beat('lane-q11', I.q11, W10.lanesField(board, [true, true, true], true), {kind: 'linear', origin: [W10.LANE_U0, W10.laneV(3)], direction: [1, 0], speed: 0.32, jitterS: 0.01, tintFollowsWave: true});
  move(I.monitorOut - 0.2, 1.4, place(0.55, 142, 0.18, 0.08, 0.5));
  move(I.q11, I.twenty - I.q11 + 1.2, place(0.58, 148, 0.22, 0.06, 0.48), 'inOutSine');
  light.push({at: I.monitorOut, dur: 1, spread: 1.3, poolAt: [0.17, 0.0]});
  ov('idm-race', I.monitorOut, I.end + 0.3, (t) => {
    const names = ['MongoDB', 'Neo4j', 'PostgreSQL'];
    const done = [I.mongoDone, I.neoDone, I.pgDone];
    const ms = ['5.63 ms', '11.38 ms', '17.79 ms'];
    const nodes: React.ReactNode[] = [];
    for (let k = 0; k < 3; k++) {
      const [x0, y0] = project(camera, board, t, [W10.LANE_U0, W10.laneV(k)], 0, W, H);
      const [x1, y1] = project(camera, board, t, [W10.LANE_U1, W10.laneV(k)], 0.2 * relief, W, H);
      nodes.push(<Mono key={`n${k}`} t={t} at={I.monitorOut + 0.3 + k * 0.1} exitAt={I.end - 0.3} text={names[k]} x={x0 - 0.012 * W} y={y0} align="right" sizeH={0.023} tone={k === 0 ? color.accent.mint : color.text.caption} />);
      nodes.push(<Mono key={`m${k}`} t={t} at={done[k]} exitAt={I.end - 0.3} text={ms[k]} x={x1 + 0.012 * W} y={y1} sizeH={0.026} tone={k === 0 ? color.accent.mint : color.text.key} weight={600} />);
    }
    const [qx, qy] = project(camera, board, t, [W10.LANE_U0, W10.laneV(3)], 0, W, H);
    nodes.push(<Mono key="q" t={t} at={I.q11} exitAt={I.end - 0.3} text="Q11 · border spread" x={qx - 0.012 * W} y={qy} align="right" sizeH={0.023} tone={color.signal.amber} />);
    return (
      <>
        <Mono t={t} at={I.monitorOut + 0.2} exitAt={I.end - 0.3} text={'Q2 · measles by state, 1960\nmedian of the kept runs'} x={0.069 * W} y={0.225 * H} sizeH={0.023} tone={color.text.chipDim} />
        {nodes}
        <Fact t={t} at={I.twenty - 0.1} exitAt={I.end - 0.3} text="graph only · **19.8 s** median" x={0.93 * W} y={0.82 * H - 0.08 * H} align="right" maxWidthW={0.4} sizeH={0.036} color={color.signal.amber} />
        <Chips
          t={t}
          side="right"
          y0={0.075}
          dy={0.048}
          chips={[
            {repo: 'IDM', path: 'results/bench_summary.csv', line: '5-7', at: I.mongoDone + 0.2, exitAt: I.end - 0.3},
            {repo: 'IDM', path: 'backend/app/routers/compare_router.py', line: '60-89', at: I.mongoDone + 0.5, exitAt: I.end - 0.3},
            {repo: 'IDM', path: 'results/bench_summary.csv', line: 32, at: I.twenty + 0.3, exitAt: I.end - 0.3},
            {repo: 'IDM', path: 'backend/app/services/neo4j_service.py', line: '203-223', at: I.border, exitAt: I.end - 0.3},
          ]}
        />
      </>
    );
  });
  ov('idm-vaccine', I.vaccine, I.end + 0.3, (t) => (
    <>
      <Fact t={t} at={I.vaccine} exitAt={I.end - 0.3} text="decade after the vaccine: polio **−86.83%** · measles **−77.02%** (reported cases)" y={0.535} sizeH={0.03} maxWidthW={0.36} />
      <Chips t={t} side="left" y0={0.66} chips={[{repo: 'IDM', path: 'report.tex', line: 827, at: I.vaccine + 0.4, exitAt: I.end - 0.3}]} />
    </>
  ));
  say(I.race, 'reading', 'Read results/bench_summary.csv');
  say(I.q11, 'reading', 'Read backend/app/services/neo4j_service.py');

  // ============================================================ 10.5 drone-id
  const D = T.drone;
  beat('drone', D.press, W10.droneField(board), fromRight());
  presses.push({at: D.press + 0.75, origin: [W10.SUBJ[0], W10.SUBJ[1]], radius: 0.05, depth: 0.7});
  ripples.push({...FILM_RIPPLE, at: D.press + 0.75, origin: [W10.SUBJ[0], W10.SUBJ[1]], amp: 0.35});
  dolly(D.press - 0.1, D.end);
  walkStep(D.press, 1.4);
  plateLights.push(D.plate);
  ov('dr-plate', D.plate, D.end + 0.4, (t) => <Plate t={t} at={D.plate} exitAt={D.end - 0.3} name="drone-id" status="WORKING API v0.1.0 · CURATED DATASET · LOCAL ONLY" tone="mint" />);
  beat('tiles', D.tiles, W10.droneTilesField(board, 'none'), {origin: [W10.TILES.u, W10.TILES.v], speed: 1.0, jitterS: 0.05});
  beat('scores', D.scores, W10.droneTilesField(board, 'all'), {kind: 'linear', origin: [0.4, 0.3], direction: [0, 1], speed: 1.2, jitterS: 0.03});
  beat('renorm', D.dropOut, W10.droneTilesField(board, 'renorm'), {origin: [W10.scoreChart.u0, W10.scoreRowV(board, 4)], speed: 0.9, jitterS: 0.02});
  // the focus pull follows Pixie's magnifier across the 56 tiles
  const tileZ = 0.2 * relief;
  const fz = PP.distance;
  const ap = apertureForBlur(7, fz, 0.12, PP.fov, 1440);
  focus.push({at: T.chStart, to: 'target', aperture: 0});
  focus.push({at: D.tiles - 0.1, dur: 0.6, to: {uv: [W10.TILES.u - 0.07, W10.TILES.v + 0.08], h: tileZ}, aperture: ap});
  focus.push({at: D.tiles + 0.8, dur: 2.2, to: {uv: [W10.TILES.u + 0.07, W10.TILES.v - 0.08], h: tileZ}, ease: 'inOutSine'});
  focus.push({at: D.renorm, dur: 0.8, to: {uv: [W10.scoreChart.u0 + 0.1, W10.scoreRowV(board, 2)], h: 0.22 * relief}});
  focus.push({at: D.whose + 1.2, dur: 0.8, to: 'target', aperture: 0});
  ov('dr-data', D.tiles, D.end + 0.3, (t) => {
    const [tx, ty] = project(camera, board, t, [W10.TILES.u - ((W10.TILES.cols * W10.TILES.cell) / 2 + 2) * board.p, W10.TILES.v], 0.2 * relief, W, H);
    const renormed = t >= D.renorm;
    return (
      <>
        <Mono t={t} at={D.tiles + 0.2} exitAt={D.end - 0.3} text={'56 cited\nmodels'} x={tx} y={ty} align="right" sizeH={0.026} tone={color.text.key} weight={600} />
        {W10.SCORES.map((sc, k) => {
          const [x, y] = project(camera, board, t, [W10.scoreChart.u0, W10.scoreRowV(board, k)], 0.2 * relief, W, H);
          const w = renormed ? (k === 4 ? null : sc[1] / 0.85) : sc[1];
          const len = w === null ? 0 : (w / 0.353) * W10.scoreChart.len035;
          const [xe, ye] = project(camera, board, t, [W10.scoreChart.u0 + (len + 2) * board.p, W10.scoreRowV(board, k)], 0.2 * relief, W, H);
          return (
            <React.Fragment key={sc[0]}>
              <Mono t={t} at={D.scores + k * 0.08} exitAt={D.end - 0.3} text={sc[0]} x={x - 0.01 * W} y={y} align="right" sizeH={0.022} tone={k === 4 && renormed ? color.text.tertiary : color.text.caption} />
              <Mono t={t} at={D.scores + 0.25 + k * 0.08} exitAt={D.end - 0.3} text={w === null ? 'not observed' : w.toFixed(2)} x={w === null ? x + 0.012 * W : xe} y={w === null ? y : ye} sizeH={0.022} tone={w === null ? color.text.tertiary : color.text.key} weight={600} />
            </React.Fragment>
          );
        })}
        <Mono t={t} at={D.signature} exitAt={D.whose - 0.55} text={'observed:  2.4 / 5.8 GHz · Remote ID ASTM F3411\n           foldable quadcopter · about 245 g'} x={0.069 * W} y={0.29 * H} sizeH={0.023} tone={color.text.caption} />
        <Chips
          t={t}
          side="left"
          y0={0.41}
          chips={[
            {repo: 'drone-id', path: 'README.md', line: '159-167', at: D.signature + 0.4, exitAt: D.whose - 0.55},
            {repo: 'drone-id', path: 'data/catalog', line: '56 files', at: D.tiles + 0.4, exitAt: D.end - 0.3},
            {repo: 'drone-id', path: 'app/scoring.py', line: '25-31', at: D.scores + 0.4, exitAt: D.end - 0.3},
            {repo: 'drone-id', path: 'app/scoring.py', line: '234-239', at: D.renorm, exitAt: D.end - 0.3},
          ]}
        />
      </>
    );
  });
  ov('dr-whose', D.whose, D.end + 0.3, (t) => (
    <>
      <Fact t={t} at={D.whose} exitAt={D.end - 0.3} text="what, not *whose*" y={0.31} sizeH={0.058} weight={600} />
      <Chips t={t} side="left" y0={0.36} chips={[{repo: 'drone-id', path: 'README.md', line: '24-28', at: D.whose + 0.4, exitAt: D.end - 0.3}]} />
    </>
  ));
  say(D.plate, 'searching', 'Search 56 cited models');

  // ============================================================ 10.6 SkillBridgeNorway
  const K = T.skill;
  beat('cv', K.wall, W10.cvField(board), fromRight());
  dolly(K.wall - 0.1, K.end);
  walkStep(K.wall, 1.4);
  plateLights.push(K.plate);
  ov('sk-plate', K.plate, K.end + 0.4, (t) => <Plate t={t} at={K.plate} exitAt={K.end - 0.3} name="SkillBridgeNorway" status="PROTOTYPE · 1 COMMIT · FRONT END LIVE · BACKEND NOT DEPLOYED" />);
  world.push(
    deviceNode(
      'c10-laptop-skill',
      {kind: 'laptop', from: K.recAt, to: K.formula + 0.45, rec: {...REC10.skill, startAt: K.recAt}, holds: [{at: K.recAt, hold: {sx: 0.71, sy: 0.5, h: 0.37, yaw: -0.14}}], inS: 0.7, outS: 0.55},
      camera,
      fps,
      aspect,
    ),
  );
  ov('sk-front', K.recAt + 0.5, K.formula + 0.4, (t) => <Mono t={t} at={K.recAt + 0.6} exitAt={K.formula} text={'skill-bridge-norway.vercel.app\nfront end only · no real CVs'} x={0.069 * W} y={0.3 * H} sizeH={0.023} tone={color.text.caption} />);
  const fWords = ['meaning', 'skills', 'place', 'freshness'];
  for (let k = 1; k <= 4; k++) beat(`formula${k}`, k === 1 ? K.formula : c.w('u1017', fWords[k - 1]) - 0.12, W10.formulaField(board, k), {kind: 'linear', origin: [0.4, 0.3], direction: [0, 1], speed: 1.3, jitterS: 0.03});
  ov('sk-formula', K.formula, K.test + 0.3, (t) => {
    const pitch = W10.formulaChart.width / 4;
    return (
      <>
        {W10.FORMULA.map((fm, k) => {
          const u = W10.formulaChart.u + (-W10.formulaChart.width / 2 + (k + 0.5) * pitch) * board.p;
          const [x, y] = project(camera, board, t, [u, W10.formulaChart.v - ((W10.formulaChart.height / 2) * board.p) / board.extH], 0, W, H);
          const at = k === 0 ? K.formula + 0.2 : c.w('u1017', fWords[k]) + 0.05;
          return (
            <React.Fragment key={fm[0]}>
              <Mono t={t} at={at} exitAt={K.test - 0.1} text={fm[0]} x={x} y={y + 0.028 * H} align="center" sizeH={0.022} tone={color.text.caption} />
              <Mono t={t} at={at + 0.1} exitAt={K.test - 0.1} text={fm[1].toFixed(2)} x={x} y={y + 0.06 * H} align="center" sizeH={0.024} tone={k === 0 ? color.accent.mint : color.text.key} weight={600} />
            </React.Fragment>
          );
        })}
        <Fact t={t} at={K.formula + 0.3} exitAt={K.test - 0.1} text="match = 0.55 meaning + 0.20 skills + 0.15 place + 0.10 freshness" y={0.3} sizeH={0.03} />
        <Chips t={t} side="left" y0={0.44} chips={[{repo: 'SkillBridgeNorway', path: 'backend/app/services/matching.py', line: '81-87', at: K.formula + 0.6, exitAt: K.test - 0.1}]} />
      </>
    );
  });
  beat('gauge0', K.test, W10.gaugeField(board, 0), {origin: [0.47, 0.5], speed: 1.2, jitterS: 0.04});
  beat('gauge40', K.forty - 0.3, W10.gaugeField(board, 40), {kind: 'linear', origin: [W10.gaugeChart.u0, 0.5], direction: [1, 0], speed: 0.65, jitterS: 0.01, tintFollowsWave: true});
  ov('sk-test', K.test, K.end + 0.3, (t) => {
    const at = (x: number) => W10.gaugeChart.u0 + (W10.gaugeChart.u1 - W10.gaugeChart.u0) * (x / 100);
    const [fx, fy] = project(camera, board, t, [at(40), W10.gaugeChart.v + (9 * board.p) / board.extH], 0.2 * relief, W, H);
    const [x0, y0] = project(camera, board, t, [at(0), W10.gaugeChart.v - (6 * board.p) / board.extH], 0, W, H);
    const [x1, y1] = project(camera, board, t, [at(100), W10.gaugeChart.v - (6 * board.p) / board.extH], 0, W, H);
    return (
      <>
        <Mono t={t} at={K.test + 0.2} exitAt={K.end - 0.3} text={"skills ['Rust', 'Go']  →  'Nurse · Sykepleier søkes'"} x={0.069 * W} y={0.3 * H} sizeH={0.024} tone={color.text.caption} />
        <Fact t={t} at={K.forty - 0.05} exitAt={K.end - 0.3} text="score **40.0** · the simple score *starts* at 40" y={0.38} sizeH={0.036} maxWidthW={0.36} />
        <Mono t={t} at={K.forty} exitAt={K.end - 0.3} text="40" x={fx} y={fy - 0.03 * H} align="center" sizeH={0.03} tone={color.accent.mint} weight={700} />
        <Mono t={t} at={K.test + 0.4} exitAt={K.end - 0.3} text="0" x={x0} y={y0 + 0.02 * H} align="center" sizeH={0.022} />
        <Mono t={t} at={K.test + 0.4} exitAt={K.end - 0.3} text="100" x={x1} y={y1 + 0.02 * H} align="center" sizeH={0.022} />
        <Chips
          t={t}
          side="left"
          y0={0.52}
          chips={[
            {repo: 'SkillBridgeNorway', path: 'backend/tests/test_phase5.py', line: '62-66', at: K.test + 0.5, exitAt: K.end - 0.3},
            {repo: 'SkillBridgeNorway', path: 'backend/app/services/application_agent.py', line: '158-159', at: K.starts, exitAt: K.end - 0.3},
          ]}
        />
      </>
    );
  });
  say(K.recAt, 'running', 'Open skill-bridge-norway.vercel.app');
  say(K.test, 'reading', 'Read backend/tests/test_phase5.py');

  // ============================================================ 10.7 CYFS
  const Y = T.cyfs;
  beat('wave', Y.wall, W10.waveField(board), fromRight());
  dolly(Y.wall - 0.1, Y.end);
  walkStep(Y.wall, 1.4);
  plateLights.push(Y.plate);
  ov('cy-plate', Y.plate, Y.end + 0.4, (t) => <Plate t={t} at={Y.plate} exitAt={Y.end - 0.3} name="CYFS" status="PROTOTYPE · 1 COMMIT · FRONT END ONLY" sub="Clone Your Favourite Song" />);
  beat('measures', Y.tempo - 0.25, W10.measureField(board, false), {kind: 'linear', origin: [0.4, 0.3], direction: [1, 0.4], speed: 0.9, jitterS: 0.03});
  ov('cy-measures', Y.tempo - 0.2, Y.laptopIn + 0.3, (t) => {
    const pitch = W10.measureChart.width / 5;
    return (
      <>
        {W10.MEASURES.map((m, k) => {
          const u = W10.measureChart.u + (-W10.measureChart.width / 2 + (k + 0.5) * pitch) * board.p;
          const [x, y] = project(camera, board, t, [u, W10.measureChart.v - ((W10.measureChart.height / 2) * board.p) / board.extH], 0, W, H);
          return <Mono key={m[0]} t={t} at={Y.tempo + k * 0.12} exitAt={Y.laptopIn} text={m[0]} x={x} y={y + 0.028 * H} align="center" sizeH={0.022} tone={color.text.caption} />;
        })}
        <Mono t={t} at={Y.prompt} exitAt={Y.laptopIn} text="example input · no audio, no song titles" x={0.069 * W} y={0.255 * H} sizeH={0.022} tone={color.text.tertiary} />
        <Fact t={t} at={Y.prompt + 0.1} exitAt={Y.laptopIn} text="“… at 120 BPM (upbeat) … high energy and dynamic …”" y={0.33} sizeH={0.036} maxWidthW={0.36} color={color.text.key} />
        <Chips
          t={t}
          side="left"
          y0={0.47}
          chips={[
            {repo: 'CYFS', path: 'backend/services/analyzer.py', line: '90-131', at: Y.tempo + 0.3, exitAt: Y.laptopIn},
            {repo: 'CYFS', path: 'backend/services/prompt_builder.py', line: '8-52', at: Y.prompt + 0.5, exitAt: Y.laptopIn},
            {repo: 'CYFS', path: 'backend/services/prompt_builder.py', line: '55-80', at: Y.prompt + 0.8, exitAt: Y.laptopIn},
          ]}
        />
      </>
    );
  });
  say(Y.prompt, 'typing', 'Write the music prompt');
  world.push(
    deviceNode(
      'c10-laptop-cyfs',
      {kind: 'laptop', from: Y.laptopIn, to: Y.end - 0.05, rec: {...REC10.cyfs, startAt: Y.recAt}, holds: [{at: Y.laptopIn, hold: {sx: 0.71, sy: 0.56, h: 0.35, yaw: -0.15}}], inS: 0.7, outS: 0.55},
      camera,
      fps,
      aspect,
    ),
  );
  beat('slots', Y.gpu - 0.2, W10.measureField(board, true), {origin: [0.7, 0.8], speed: 1.0, jitterS: 0.04});
  ov('cy-gpu', Y.laptopIn + 0.4, Y.end + 0.3, (t) => (
    <>
      <Mono t={t} at={Y.laptopIn + 0.5} exitAt={Y.end - 0.3} text="cyfs.vercel.app · front end only" x={0.069 * W} y={0.3 * H} sizeH={0.023} tone={color.text.caption} />
      <Fact t={t} at={Y.gpu} exitAt={Y.end - 0.3} text="**3** variations · needs a self-hosted **32 GB** GPU" y={0.38} sizeH={0.034} maxWidthW={0.36} />
      <Chips
        t={t}
        side="left"
        y0={0.51}
        chips={[
          {repo: 'CYFS', path: 'backend/config.py', line: 30, at: Y.gpu + 0.3, exitAt: Y.end - 0.3},
          {repo: 'CYFS', path: 'README.md', line: 44, at: Y.gpu + 0.6, exitAt: Y.end - 0.3},
        ]}
      />
    </>
  ));
  say(Y.laptopIn, 'running', 'Open cyfs.vercel.app');

  // ============================================================ 10.8 Kaleido
  const Ka = T.kaleido;
  beat('gpu', Ka.wall, W10.gpuField(board), fromRight());
  dolly(Ka.wall - 0.1, Ka.end);
  walkStep(Ka.wall, 1.4);
  plateLights.push(Ka.plate);
  ov('ka-plate', Ka.plate, Ka.end + 0.4, (t) => <Plate t={t} at={Ka.plate} exitAt={Ka.end - 0.3} name="Kaleido" status="SELF-HOSTED PROTOTYPE · PROPRIETARY LICENCE · NO PUBLIC DEPLOYMENT" />);
  if (Ka.approved) {
    const models = ['text', 'image', 'video'];
    beat('plate', Ka.text - 0.7, W10.plateField(board, -1, 'none'), {origin: [W10.PLATE.u, W10.PLATE.v], speed: 1.0, jitterS: 0.05});
    [Ka.text, Ka.image, Ka.video].forEach((at, k) => beat(`model${k}`, at - 0.15, W10.plateField(board, k, 'none'), {origin: [W10.PLATE.u - 0.07 + k * 0.07, W10.PLATE.v], speed: 1.6, jitterS: 0.03}));
    beat('vbars', Ka.bars, W10.plateField(board, 2, 'both'), {kind: 'linear', origin: [W10.VBARS.u0, 0.45], direction: [1, 0], speed: 0.6, jitterS: 0.01, tintFollowsWave: true});
    beat('vreject', Ka.rejected - 0.1, W10.plateField(board, 2, 'rejected'), {...SWEEPS.booleanFlip([W10.VBARS.u0, W10.VBARS.vB]), speed: 1.4});
    move(Ka.text - 0.6, 1.6, lowAnglePull(place(0.52, 138, 0.18, 0.06), {pitch: -0.12, pull: 0.04}));
    ov('ka-models', Ka.text - 0.3, Ka.end + 0.3, (t) => {
      const cur = t >= Ka.video ? 2 : t >= Ka.image ? 1 : 0;
      const nodes: React.ReactNode[] = [];
      const [px, py] = project(camera, board, t, [W10.PLATE.u, W10.PLATE.v - ((W10.PLATE.h / 2 + 2) * board.p) / board.extH], 0.1 * relief, W, H);
      nodes.push(<Mono key="card" t={t} at={Ka.text - 0.2} exitAt={Ka.end - 0.3} text="one 32 GB card" x={px} y={py + 0.02 * H} align="center" sizeH={0.023} tone={color.text.caption} />);
      models.forEach((m, k) => {
        const u = W10.PLATE.u - 0.068 + k * 0.068;
        const [x, y] = project(camera, board, t, [u, W10.PLATE.v + (8 * board.p) / board.extH], 0.62 * relief, W, H);
        nodes.push(<Mono key={m} t={t} at={[Ka.text, Ka.image, Ka.video][k] - 0.05} exitAt={k < 2 ? [Ka.image, Ka.video][k] - 0.1 : Ka.end - 0.3} text={m} x={x} y={y - 0.02 * H} align="center" sizeH={0.026} tone={color.text.key} weight={600} />);
      });
      void cur;
      const [ax, ay] = project(camera, board, t, [W10.VBARS.u0, W10.VBARS.vA + (3.4 * board.p) / board.extH], 0.22 * relief, W, H);
      const [bx, by] = project(camera, board, t, [W10.VBARS.u0, W10.VBARS.vB + (3.4 * board.p) / board.extH], 0.2 * relief, W, H);
      nodes.push(<Mono key="va" t={t} at={Ka.bars + 0.2} exitAt={Ka.end - 0.3} text="1.3B · 5 s clip in ~90 s · kept" x={ax} y={ay - 0.012 * H} sizeH={0.023} tone={color.accent.mint} bg />);
      nodes.push(<Mono key="vb" t={t} at={Ka.bars + 0.45} exitAt={Ka.end - 0.3} text={t >= Ka.rejected ? '5B · 4 s clip in ~249 s · rejected as too slow' : '5B · 4 s clip in ~249 s'} x={bx} y={by - 0.012 * H} sizeH={0.023} tone={t >= Ka.rejected ? color.text.secondary : color.text.caption} bg />);
      return (
        <>
          {nodes}
          <Fact t={t} at={Ka.turns - 0.1} exitAt={Ka.end - 0.3} text="text, image and video models take *turns* on one card" y={0.26} sizeH={0.032} maxWidthW={0.3} />
          <Mono t={t} at={Ka.turns + 0.3} exitAt={Ka.end - 0.3} text="video 3 steps · image 4 steps" x={0.069 * W} y={0.4 * H} sizeH={0.023} tone={color.text.caption} />
          <Chips
            t={t}
            side="left"
            y0={0.47}
            chips={[
              {repo: 'Kaleido', path: 'kaleido-backend/ai/gpu_models.py', line: '1-3', at: Ka.text + 0.3, exitAt: Ka.end - 0.3},
              {repo: 'Kaleido', path: 'kaleido-backend/ai/gpu_models.py', line: '69, 111', at: Ka.turns + 0.5, exitAt: Ka.end - 0.3},
              {repo: 'Kaleido', path: 'kaleido-backend/ai/gpu_models.py', line: '112-114', at: Ka.bars + 0.4, exitAt: Ka.end - 0.3},
              {repo: 'Kaleido', path: 'README.md', line: 150, at: Ka.plate + 0.5, exitAt: Ka.end - 0.3},
            ]}
          />
        </>
      );
    });
    say(Ka.plate, 'reading', 'Read kaleido-backend/ai/gpu_models.py');
  }

  // ============================================================ 10.9 cookie-galaxy
  const Co = T.cookie;
  beat('cookie', Co.wall, W10.starsField(board), fromRight(1.1));
  const planet = W10.cookieField(board);
  const stars = W10.starsField(board);
  beat('cookie-planet', Co.recAt + 0.3, (u, v, i) => {
    const s = planet(u, v, i);
    return s.h > 0.02 ? s : stars(u, v, i);
  }, {origin: [W10.SUBJ[0], W10.SUBJ[1]], speed: 0.7, jitterS: 0.05});
  dolly(Co.wall - 0.1, Co.street);
  walkStep(Co.wall, 1.4);
  light.push({at: Co.wall, dur: 1.2, key: 0.9, spread: 1.2, poolAt: subjWorld});
  plateLights.push(Co.plate);
  ov('co-plate', Co.plate, Co.end + 0.4, (t) => <Plate t={t} at={Co.plate} exitAt={Co.street - 0.1} name="cookie-galaxy" status="DESIGN DEMO v0.1.0 · FICTIONAL BRAND" />);
  world.push(
    deviceNode(
      'c10-laptop-cookie',
      {kind: 'laptop', from: Co.recAt, to: Co.laptopOut + 0.6, rec: {...REC10.cookie, startAt: Co.recAt}, holds: [{at: Co.recAt, hold: {sx: 0.66, sy: 0.44, h: 0.44, yaw: -0.14}}], inS: 0.75, outS: 0.6},
      camera,
      fps,
      aspect,
    ),
  );
  world.push(dustNode('c10-dust', Co.recAt, Co.street + 0.4, board, [0.12, 0.03, 0.18]));
  ov('co-facts', Co.recAt + 0.5, Co.street, (t) => (
    <>
      <Mono t={t} at={Co.recAt + 0.6} exitAt={Co.street - 0.2} text={'cookie-galaxy-two.vercel.app\none scroll, top to bottom'} x={0.069 * W} y={0.29 * H} sizeH={0.023} tone={color.text.caption} />
      <Fact t={t} at={Co.particles} exitAt={Co.street - 0.2} text="**6** acts · **9** keyframes · about **5,200** particles" y={0.38} sizeH={0.034} maxWidthW={0.36} />
      <Mono t={t} at={Co.exist - 0.1} exitAt={Co.street - 0.2} text="fictional brand" x={0.069 * W} y={0.48 * H} sizeH={0.024} tone={color.signal.amber} caps bg />
      <Chips
        t={t}
        side="left"
        y0={0.56}
        chips={[
          {repo: 'cookie-galaxy', path: 'README.md', line: '17-20, 27', at: Co.particles + 0.3, exitAt: Co.street - 0.2},
          {repo: 'cookie-galaxy', path: 'scene3d.js', line: '92, 166-168', at: Co.particles + 0.6, exitAt: Co.street - 0.2},
          {repo: 'cookie-galaxy', path: 'scene3d.js', line: '203-213', at: Co.particles + 0.9, exitAt: Co.street - 0.2},
        ]}
      />
    </>
  ));
  say(Co.recAt, 'running', 'Scroll cookie-galaxy-two.vercel.app, top to bottom');
  // the street once more: the plots that run on hardware you own light up
  const ownIdx = [7, 6, 5, 4, 1]; // PocketOS, Mneme, IDM, drone-id, Kaleido (street order)
  const END_V = 0.45;
  const HOW: Record<string, string> = {PocketOS: 'your browser', 'Mneme-Education-Ecosystem': 'Ollama', IDM: 'Docker Compose', 'drone-id': 'a local API', Kaleido: 'a local GPU'};
  beat('street-again', Co.street, W10.streetField(board, {v: END_V}), {origin: [0.5, END_V], speed: 1.0, jitterS: 0.05});
  beat('street-own', Co.machine - 0.25, W10.streetField(board, {lit: ownIdx, dimOthers: true, v: END_V}), {...SWEEPS.booleanFlip([1, END_V]), speed: 1.3});
  move(Co.street - 0.2, 1.7, frameOn(board, {uv: [0.5, 0.5], pinsAcross: 168, yaw: 0.08, pitch: 0.05, aspect}));
  light.push({at: Co.street, dur: 1.2, key: 1.02, spread: 1.45, poolAt: [0, 0.01]});
  ov('co-own', Co.machine - 0.2, T.chEnd, (t) => (
    <>
      {W10.STREET_REPOS.map((r, k) => {
        const [x, y] = project(camera, board, t, [W10.streetU(board, k), END_V + ((W10.PLOT / 2 + 1.5) * board.p) / board.extH], 0, W, H);
        const own = ownIdx.includes(k);
        const name = r === 'Mneme-Education-Ecosystem' ? 'Mneme' : r === 'SkillBridgeNorway' ? 'SkillBridge…' : r;
        return <Mono key={r} t={t} at={Co.machine + 0.1 + (own ? 0 : 0.3)} exitAt={Co.release - 0.1} text={own ? `${name}\n${HOW[r]}` : name} x={x} y={y - (own ? 0.04 : 0.025) * H} align="center" sizeH={0.022} tone={own ? color.accent.mint : color.text.tertiary} />;
      })}
      <Mono t={t} at={Co.machine} exitAt={Co.release - 0.1} text="runs on your own device or machine" x={0.93 * W} y={0.075 * H} align="right" sizeH={0.023} tone={color.accent.mintLabel} caps />
      <Chips
        t={t}
        side="right"
        y0={0.135}
        dy={0.05}
        chips={[
          {repo: 'PocketOS', path: 'README.md', line: 19, at: Co.machine + 0.3, exitAt: Co.release - 0.1},
          {repo: 'Mneme-Education-Ecosystem', path: 'README.md', line: '15-18', at: Co.machine + 0.45, exitAt: Co.release - 0.1},
          {repo: 'IDM', path: 'README.md', line: '722-739', at: Co.machine + 0.6, exitAt: Co.release - 0.1},
          {repo: 'drone-id', path: 'README.md', line: 90, at: Co.machine + 0.75, exitAt: Co.release - 0.1},
          {repo: 'Kaleido', path: 'README.md', line: 30, at: Co.machine + 0.9, exitAt: Co.release - 0.1},
        ]}
      />
    </>
  ));
  const yoursWords = c.u('u1024').words;
  ov('co-statement', c.u('u1024').start - 0.2, T.chEnd, (t) => <Statement t={t} words={yoursWords} exitAt={Co.release - 0.1} y={0.12} />);
  say(c.u('u1024').start, 'idle', '');

  // ============================================================ the handoff
  beat('handoff', Co.release, HANDOFF, SWEEPS.dissolve(0.7));
  move(Co.release - 0.1, T.chEnd - Co.release - 0.1, P0);
  light.push({at: Co.release, dur: T.chEnd - Co.release - 0.15, key: 1, look: [0, 0], poolAt: [0, 0], spread: 1, pool: 1, env: 1});
  focus.push({at: T.chEnd - 0.2, to: 'target', aperture: 0});

  // ============================================================ always on: guide and rule line
  if (walkX > 0) walks.push({fromX: walkX, toX: 0, startFrame: f(Co.release + 0.2), speed: 3, gait: 'scurry', arriveFacing: 'right'});
  ov('guide', T.chStart, T.chEnd, () => <Guide walk={walks} />);
  ov('rule', T.chStart, T.chEnd, (t) => <RuleLine t={t} base={RULE_BASE} lights={plateLights} hide={codeHide} from={T.chStart - 1} to={T.chEnd + 1} />);

  const sound = cues(tl);
  return mergeParts({
    beats,
    camera,
    focus,
    light,
    presses,
    ripples,
    world,
    overlays,
    pixie,
    captionSkip: ['u1024'],
    sfx: sound.sfx,
    music: sound.music,
  });
};

export const chapter: ChapterModule = {id: '10', build};

void env;
void Numeral;
void POCKET_REC;
