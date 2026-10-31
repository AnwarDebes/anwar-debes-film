import React from 'react';
import {OffthreadVideo, Sequence, staticFile} from 'remotion';
import {ChapterCard, GlassCard, KineticLine, Stamp, WindowFrame} from '../../engine/type';
import {CodePanel, cue as codeCue, type CodePage} from '../../engine/code';
import type {CodeSnippet} from '../../engine/code/types';
import {frameOn, pushIn, type CameraKey, type CameraPose, type FocusKey} from '../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, FILM_RIPPLE, SWEEPS, flatField, type Beat, type LightKey, type Press, type Ripple} from '../../engine/pins';
import {REPO_LINKS, type LinkKind} from '../../engine/fx';
import {color, font} from '../../engine/tokens';
import type {PixieCue} from '../../pixie';
import type {ChapterModule, ChapterSpec, FilmCtx, TimedNode} from '../types';
import {cues} from './ch14.cues';
import {NoteCapture} from '../../engine/ledger/sources';
import {times14} from './ch14/times';
import * as W14 from './ch14/walls';
import {mergeParts} from './ch10/kit/spec';
import {Chips, Fact, Guide, Mono, Plate, Statement, Term, env, project} from './ch10/kit/ui';
import {RuleLine} from './ch01/ruleLine';
import {ruleTimes} from './ch01/plates';
import {Em} from './ch01/kit';
import sitePins from '../../data/ch14/code/site-pins.json';
import filmLedger from '../../../film-ledger.json';
import verifyRun from '../../data/ch14/ledger/verify-run.json';
import facts from '../../data/ch14/facts.json';
import qr from '../../data/ch14/qr.json';
import text from '../../data/ch14/text.json';

// 14.5: the film's own ledger (film-ledger.json, scripts/ledger) and a recorded run of its check,
// node verify-ledger.mjs on fresh clones (data/ch14/ledger/verify-run.json).
const ledger = {entries: filmLedger.entries, head: filmLedger.head, scope: 'the whole film', transcript: verifyRun.transcript, cmd: verifyRun.cmd};

// Chapter 14, "Show its work": the last three places complete the line, then the camera leaves
// the wall once. The 66 places become a map ordered by the walk (solid, dotted and dashed lines,
// each defined as it draws), the wall proves to be his website's spring, every chip proves to be a
// typed entry in a hash-chained ledger, and the 66 lit pins prove to be the rule. The black box of
// 01.1 returns as glass, and the film ends on the name and a QR code made of pins.
//
// On-screen lines are read from the storyboard's script (data/ch14/text.json), the 14.2 facts from
// the saved GitHub API responses (data/ch14/facts.json), and the ledger shown in 14.5 is the film's
// own (film-ledger.json, every source on screen, built by scripts/ledger), with a recorded run of
// node verify-ledger.mjs on fresh clones.

const TX = text.scenes as Record<string, string[]>;
const line = (scene: string, k: number) => TX[scene][k];

/** Link styles of the map: solid = shared code or data, dotted = same project or task, dashed = claimed. */
const styleOf = (kind: LinkKind, to: string): 'solid' | 'dotted' | 'dashed' => {
  if (kind === 'unused' || kind === 'claim') return 'dashed';
  if (kind === 'lineage' || kind === 'project') return 'dotted';
  // tsetlin-zoo is a survey of its siblings: the same task, not shared code
  return to === 'tsetlin-zoo' ? 'dotted' : 'solid';
};

const build = (ctx: FilmCtx): ChapterSpec => {
  const {board, tl, width: W, height: H, fps, assets} = ctx;
  const T = times14(tl);
  const aspect = W / H;
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const f = (s: number) => Math.round(s * fps);

  // ------------------------------------------------------------ camera language
  const P0 = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});
  const place = (cu: number, pins = 146, yaw = 0.15, pitch = 0.06, cv = 0.5): CameraPose => frameOn(board, {uv: [cu, cv], pinsAcross: pins, yaw, pitch, aspect});
  const camera: CameraKey[] = [{at: T.chStart, pose: P0}];
  const move = (at: number, dur: number, pose: CameraPose, ease: CameraKey['ease'] = 'camera') => camera.push({at, dur, pose, ease});

  const beats: Beat[] = [];
  const beat = (id: string, at: number, field: Beat['field'], sweep?: Beat['sweep']) => beats.push({id: `c14-${id}`, at, field, sweep});
  const fromRight = (speed = 1.25): Beat['sweep'] => ({kind: 'linear', origin: [1.02, 0.5], direction: [-1, 0], speed, jitterS: 0.05, tintFollowsWave: true});
  const light: LightKey[] = [{at: T.chStart, key: 1, look: [0, 0], poolAt: [0, 0], spread: 1, pool: 1, env: 1}];
  const focus: FocusKey[] = [{at: T.chStart, to: 'target', aperture: 0}];
  const presses: Press[] = [];
  const ripples: Ripple[] = [];
  const overlays: TimedNode[] = [];
  const pixie: PixieCue[] = [];
  const say = (at: number, activity: PixieCue['activity'], detail: string) => pixie.push({frame: f(at), activity, detail});
  const ov = (id: string, from: number, to: number, render: TimedNode['render'], premountS?: number) => overlays.push({id: `c14-${id}`, from, to, render, premountS});
  const proj = (t: number, uv: [number, number], z = 0) => project(camera, board, t, uv, z, W, H);
  const ruleHide: Array<[number, number]> = [];

  // ============================================================ 14.0 the black box, closed
  const G = T.gate;
  const boxPose = frameOn(board, {uv: W14.BOX_UV, pinsAcross: 110, screen: [0.62, 0.55], yaw: -0.1, pitch: -0.07, aspect});
  move(G.start - 0.6, 1.4, boxPose);
  move(G.start + 0.9, Math.max(1, G.end - G.start - 1.4), pushIn(boxPose, 0.04), 'inOutSine');
  beat('box', G.rise, W14.boxField(board), {origin: W14.BOX_UV, speed: 0.3, jitterS: 0.12});
  // the clearing starts, flickers and stops: the tint lifts twice and falls back
  beat('box-clear', G.clear, W14.boxField(board, 0.7, 0.36), {...SWEEPS.from(W14.BOX_UV, 0.9), tintFollowsWave: true});
  beat('box-flicker', G.flicker, W14.boxField(board, 0.3), {origin: W14.BOX_UV, speed: 3, jitterS: 0.04});
  beat('box-flicker2', G.flicker + 0.25, W14.boxField(board, 0.6, 0.38), {origin: W14.BOX_UV, speed: 3, jitterS: 0.04});
  beat('box-stop', G.stop, W14.boxField(board), {origin: W14.BOX_UV, speed: 2, jitterS: 0.03});
  light.push({at: G.start - 0.5, dur: 1, key: 0.8, spread: 0.75, poolAt: [W14.BOX_UV[0] - 0.5, 0], look: [-0.15, -0.05]});
  ov('card', G.cardIn, G.cardOut + 0.4, (t) => {
    const rest = line('14.0', 0).split(' · ').slice(1).join(' · ');
    const title = line('14.0', 1).replace(/work\.$/, '*work.*');
    return <ChapterCard index="14" kicker={rest} title={title} at={G.cardIn} exitAt={G.cardOut} t={t} />;
  });
  say(G.start, 'idle', '');

  // ============================================================ 14.1 video-editing-skill
  const V = T.video;
  move(V.wall - 0.2, 1.6, place(0.5, 150, 0.14));
  move(V.wall + 1.5, Math.max(1, V.end - V.wall - 2.2), pushIn(place(0.52, 148, 0.14), 0.03), 'inOutSine');
  beat('video0', V.wall, W14.videoField(board, 0), fromRight());
  beat('video1', V.done, W14.videoField(board, 1), {origin: [W14.FRAME.u, W14.FRAME.v], speed: 1.2, jitterS: 0.04, tintFollowsWave: true});
  light.push({at: V.wall, dur: 1.2, key: 1, spread: 1.2, poolAt: [0.08, 0], look: [0, 0], env: 1});
  ov('ve-plate', V.plate, V.end + 0.4, (t) => <Plate t={t} at={V.plate} exitAt={V.end - 0.3} name={line('14.1', 0)} status={line('14.1', 1)} />);
  ov('ve-qa', V.done - 0.2, V.end + 0.3, (t) => (
    <>
      <Fact t={t} at={V.done} exitAt={V.end - 0.3} text={line('14.1', 2).replace('PASS', '**PASS**')} y={0.27} sizeH={0.03} maxWidthW={0.34} />
      <Chips
        t={t}
        side="left"
        y0={0.42}
        chips={[
          {repo: 'video-editing-skill', path: 'VIDEO_STUDIO.md', line: 261, at: V.done + 0.4, exitAt: V.never - 0.2},
          {repo: 'video-editing-skill', path: 'VIDEO_STUDIO.md', line: '357-372', at: V.done + 0.7, exitAt: V.never - 0.2},
          {repo: 'video-editing-skill', path: 'VIDEO_STUDIO.md', line: '774-775', at: V.person, exitAt: V.never - 0.2},
        ]}
      />
      <Fact t={t} at={V.never} exitAt={V.end - 0.3} text={line('14.1', 3)} y={0.44} sizeH={0.028} maxWidthW={0.34} color={color.text.caption} />
      <Chips
        t={t}
        side="left"
        y0={0.53}
        chips={[
          {repo: 'video-editing-skill', path: 'VIDEO_STUDIO.md', line: 245, at: V.tested, exitAt: V.end - 0.3},
          {repo: 'video-editing-skill', path: 'editor-research/README.md', line: 40, at: V.tested + 0.3, exitAt: V.end - 0.3},
        ]}
      />
    </>
  ));
  ov('ve-frame', V.done, V.end + 0.3, (t) => {
    const [x, y] = proj(t, [W14.FRAME.u, W14.FRAME.v + (W14.FRAME.hPins * 0.5 * board.p) / board.extH], 0.45 * relief);
    return <Mono t={t} at={V.done + 0.2} exitAt={V.end - 0.3} text="1080 × 1920 · text safe zone" x={x} y={y - 0.03 * H} align="center" sizeH={0.022} tone={color.text.caption} bg />;
  });
  say(V.plate, 'reading', 'Read VIDEO_STUDIO.md (qa.mjs)');

  // ============================================================ 14.2 the empty board and the fork
  const Pa = T.pair;
  move(Pa.start - 0.5, 1.5, place(0.56, 150, 0.16));
  beat('empty', Pa.empty - 0.4, W14.emptyField(board), fromRight(1.4));
  beat('fork0', Pa.fork - 0.2, W14.forkField(board, 0), {...SWEEPS.dissolve(0.8)});
  beat('fork1', Pa.logo - 0.1, W14.forkField(board, 1), {origin: W14.forkPinUv(board, 0), speed: 2, jitterS: 0.02});
  beat('fork2', Pa.metadata - 0.1, W14.forkField(board, 2), {origin: W14.forkPinUv(board, 1), speed: 2, jitterS: 0.02});
  move(Pa.fork - 0.2, Math.max(1, Pa.end - Pa.fork), frameOn(board, {uv: [0.5, 0.5], pinsAcross: 178, yaw: 0.1, pitch: 0.05, aspect}), 'inOutSine');
  const created = new Date(facts.medical.createdAt);
  ov('med-plate', Pa.empty, Pa.fork + 0.3, (t) => <Plate t={t} at={Pa.empty} exitAt={Pa.fork - 0.2} name={facts.medical.name} status={line('14.2', 1)} />);
  ov('med-src', Pa.empty + 0.3, Pa.fork + 0.3, (t) => (
    <Mono
      t={t}
      at={Pa.empty + 0.6}
      exitAt={Pa.fork - 0.2}
      text={`api-snapshot · GET /repos/AnwarDebes/${facts.medical.name}\ncreated_at ${created.toISOString().slice(0, 10)} · size ${facts.medical.size}`}
      x={0.069 * W}
      y={0.25 * H}
      sizeH={0.022}
      tone={color.text.chipDim}
    />
  ));
  ov('fork-plate', Pa.fork, Pa.end + 0.4, (t) => <Plate t={t} at={Pa.fork} exitAt={Pa.end - 0.3} name={facts.assets.name} status={line('14.2', 3)} />);
  ov('fork-pins', Pa.logo - 0.2, Pa.end + 0.3, (t) => (
    <>
      {facts.assets.ownCommits
        .slice()
        .reverse()
        .map((c, k) => {
          const at = k === 0 ? Pa.logo : Pa.metadata;
          const [x, y] = proj(t, W14.forkPinUv(board, k), 0.9 * relief);
          return <Mono key={c.sha} t={t} at={at} exitAt={Pa.end - 0.3} text={`${c.short} · ${c.date}`} x={x + 0.012 * W} y={y + (k === 0 ? -0.025 : 0.025) * H} sizeH={0.022} tone={color.text.key} bg />;
        })}
      <Mono t={t} at={Pa.two} exitAt={Pa.end - 0.3} text={`${W14.FORK_PINS.toLocaleString('en-US')} commits on GitHub · all but two upstream`} x={0.069 * W} y={0.25 * H} sizeH={0.022} tone={color.text.caption} />
    </>
  ));
  say(Pa.empty, 'reading', 'Read the name (no files)');
  say(Pa.full, 'success', '66 of 66');

  // ============================================================ 14.3 the map, pulled back
  const M = T.map;
  const wide = frameOn(board, {uv: [0.5, 0.545], pinsAcross: 168, yaw: 0.05, pitch: 0.08, aspect});
  move(M.pull, 3.2, wide);
  move(M.pull + 3.3, Math.max(1, M.end - M.pull - 4.2), pushIn(wide, 0.035), 'inOutSine');
  beat('map', M.pull + 0.2, W14.mapLit(board), {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 1.6, jitterS: 0.05});
  light.push({at: M.pull, dur: 2.4, key: 0.85, spread: 1.6, poolAt: [0, 0], look: [0, 0], env: 0.85});
  const places = W14.mapPlaces(board);
  const byRepo = new Map(places.map((p) => [p.repo, p]));
  const links = REPO_LINKS.filter((l) => byRepo.has(l.from) && byRepo.has(l.to)).map((l) => ({...l, style: styleOf(l.kind, l.to)}));
  const drawAt = {solid: M.solid, dotted: M.dotted, dashed: M.dashed};
  ov('map-lines', M.pull + 1, M.end + 0.4, (t) => {
    const out = 1 - env(t, M.end - 0.5, undefined, 0.4);
    const k = env(t, M.places, M.end - 0.4, 0.8, 0.4);
    const pts = places.map((p) => proj(t, [p.u, p.v], 0.55 * relief));
    return (
      <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: Math.min(k, out + 1)}}>
        {links.map((l, j) => {
          const a = pts[byRepo.get(l.from)!.n - 1];
          const b = pts[byRepo.get(l.to)!.n - 1];
          const d = Math.min(1, Math.max(0, (t - drawAt[l.style] - (j % 8) * 0.12) / 0.7));
          if (d <= 0) return null;
          const x2 = a[0] + (b[0] - a[0]) * d;
          const y2 = a[1] + (b[1] - a[1]) * d;
          const dash = l.style === 'dotted' ? '2 7' : l.style === 'dashed' ? '14 9' : undefined;
          const stroke = l.style === 'solid' ? color.accent.mint : l.style === 'dotted' ? color.text.key : color.signal.amber;
          return <line key={`${l.from}-${l.to}`} x1={a[0]} y1={a[1]} x2={x2} y2={y2} stroke={stroke} strokeWidth={Math.max(2, 0.0028 * H)} strokeDasharray={dash} strokeLinecap="round" opacity={0.9} />;
        })}
      </svg>
    );
  });
  ov('map-names', M.places - 0.2, M.end + 0.4, (t) => (
    <>
      {places.map((p) => {
        const [x, y] = proj(t, [p.u, p.v], 0.55 * relief);
        return <Mono key={p.repo} t={t} at={M.places + (p.n % 11) * 0.05} exitAt={M.end - 0.4} text={p.repo} x={x} y={y + 0.016 * H} align="center" sizeH={0.014} tone={color.text.caption} />;
      })}
    </>
  ));
  ov('map-text', M.places - 0.1, M.end + 0.4, (t) => (
    <>
      <Mono t={t} at={M.places} exitAt={M.end - 0.4} text={line('14.3', 0)} x={0.069 * W} y={0.075 * H} sizeH={0.026} tone={color.text.key} weight={600} />
      <Mono t={t} at={M.places + 0.4} exitAt={M.end - 0.4} text={line('14.3', 1)} x={0.069 * W} y={0.115 * H} sizeH={0.022} tone={color.text.caption} />
      <Mono t={t} at={M.solid} exitAt={M.end - 0.4} text={`━━  ${line('14.3', 2)}`} x={0.069 * W} y={0.17 * H} sizeH={0.022} tone={color.accent.mint} bg />
      <Mono t={t} at={M.guard} exitAt={M.end - 0.4} text={line('14.3', 5)} x={0.069 * W} y={0.215 * H} sizeH={0.022} tone={color.text.chipDim} />
      <Mono t={t} at={M.dotted} exitAt={M.end - 0.4} text={`┅┅  ${line('14.3', 3)}`} x={0.38 * W} y={0.17 * H} sizeH={0.022} tone={color.text.key} bg />
      <Mono t={t} at={M.dashed} exitAt={M.end - 0.4} text={`╍╍  ${line('14.3', 4)}`} x={0.66 * W} y={0.17 * H} sizeH={0.022} tone={color.signal.amber} bg />
      <Chips t={t} side="right" y0={0.215} chips={[{repo: 'AnwarDebes', path: 'README.md', line: 185, at: M.dashed + 0.4, exitAt: M.end - 0.4}]} />
    </>
  ));
  ruleHide.push([M.pull + 0.5, M.end - 0.2]);
  say(M.places, 'idle', '');

  // ============================================================ 14.4 the wall is one of the 66
  const S = T.spring;
  const pressUv: [number, number] = [0.62, 0.5];
  const macro = frameOn(board, {uv: pressUv, pinsAcross: 60, screen: [0.5, 0.58], yaw: 0.2, pitch: -0.02, aspect});
  const half = frameOn(board, {uv: pressUv, pinsAcross: 90, screen: [0.8, 0.45], yaw: 0.1, pitch: 0.04, aspect});
  move(S.dive, 2.2, macro);
  move(S.dive + 2.3, Math.max(1, S.side - S.dive - 2.6), pushIn(macro, 0.04), 'inOutSine');
  move(S.side - 0.3, 1.1, half);
  beat('flat', S.dive + 0.2, flatField(0.86), {...SWEEPS.dissolve(1.0)});
  presses.push({at: S.press, origin: pressUv, radius: 0.02, depth: 0.8});
  ripples.push({...FILM_RIPPLE, at: S.press, origin: pressUv});
  // the same press on the film's wall as the site's click lands in its capture (left)
  const press2 = S.side + 1.0;
  presses.push({at: press2, origin: pressUv, radius: 0.02, depth: 0.8});
  ripples.push({...FILM_RIPPLE, at: press2, origin: pressUv});
  light.push({at: S.dive, dur: 1.6, key: 1, spread: 0.9, poolAt: [pressUv[0] - 0.5, 0], look: [0.05, 0]});
  const snippet = sitePins as unknown as CodeSnippet;
  const codeW = Math.round(0.5 * W);
  const codePages: CodePage[] = [
    {
      at: S.code,
      source: {snippet, lines: [255, 290]},
      dedent: 4,
      rows: 9,
      view: 255,
      width: codeW,
      header: {path: 'assets/js/pins.js'},
      cues: [
        codeCue.reveal(S.code + 0.05, {stagger: 0.03, style: 'fade'}),
        codeCue.highlight(S.code + 0.4, [255, 255], {until: S.damped + 0.9}),
        codeCue.scroll(S.damped + 0.8, [278, 286], {dur: 0.45, align: 'top'}),
        codeCue.highlight(S.damped + 1.2, [284, 286], {until: S.side - 0.4}),
      ],
    },
  ];
  ov('sp-code', S.code - 0.2, S.side, (t) => <CodePanel pages={codePages} x={0.5 * W - codeW / 2} y={0.05 * H} anchor="top-left" t={t} enter={{at: S.code, dur: 0.45}} exit={{at: S.side - 0.45, dur: 0.35}} />);
  ov('sp-k', S.damped - 0.1, S.side, (t) => (
    <>
      <Mono t={t} at={S.damped} exitAt={S.side - 0.4} text={line('14.4', 1)} x={0.5 * W} y={0.37 * H} align="center" sizeH={0.03} tone={color.text.key} weight={700} bg />
      <Chips t={t} side="right" y0={0.45} chips={[{repo: 'AnwarDebes.github.io', path: 'assets/js/pins.js', line: 255, at: S.damped + 0.2, exitAt: S.side - 0.4}]} />
    </>
  ));
  ruleHide.push([S.code - 0.1, S.side]);
  const winW = Math.round(0.42 * W);
  const winH = Math.round(0.5 * H);
  const clickS = 3.35; // the click in the capture (scripts/record/shots/live.json, "home")
  const capStart = press2 - clickS; // film time of the capture's first frame
  ov(
    'sp-site',
    S.side,
    S.end + 0.4,
    (t) => {
      const vw = winW * 2.2;
      const vh = vw / 1.6;
      return (
        <>
          <WindowFrame x={Math.round(0.2 * W)} y={Math.round(0.17 * H)} width={winW} height={winH} product="anwardebes.github.io" descriptor="live capture · one click on the hero board" t={t} at={S.side} exitAt={S.end - 0.4}>
            <Sequence from={f(capStart)} layout="none">
              <NoteCapture t={t} src="recordings/home.mp4" />
            <OffthreadVideo src={staticFile('recordings/home.mp4')} muted style={{position: 'absolute', width: vw, height: vh, left: winW / 2 - 0.753 * vw, top: winH / 2 - 0.41 * vh}} />
            </Sequence>
          </WindowFrame>
          <Mono t={t} at={S.side + 0.3} exitAt={S.end - 0.4} text="site ripple" x={0.2 * W + winW / 2} y={0.73 * H} align="center" sizeH={0.024} tone={color.text.key} bg />
          <Mono t={t} at={S.side + 0.5} exitAt={S.end - 0.4} text="film ripple" x={0.8 * W} y={0.73 * H} align="center" sizeH={0.024} tone={color.text.key} bg />
          <Mono t={t} at={S.same} exitAt={S.end - 0.4} text={line('14.4', 3)} x={0.5 * W} y={0.12 * H} align="center" sizeH={0.026} tone={color.text.caption} />
        </>
      );
    },
    Math.max(0.5, S.side - capStart),
  );
  say(S.press - 0.2, 'running', '');
  say(S.side, 'reading', 'Read assets/js/pins.js');

  // ============================================================ 14.5 the film's own ledger
  const L = T.ledger;
  const total = text.ledgerEntries as number;
  move(L.chain - 0.4, 1.8, frameOn(board, {uv: [0.5, 0.5], pinsAcross: 178, yaw: 0.06, pitch: 0.06, aspect}));
  beat('chain0', L.chain, W14.chainField(board, 0), {...SWEEPS.dissolve(0.6)});
  const rowsN = W14.CHAIN.rows;
  for (let r = 1; r <= rowsN; r++) {
    const n = Math.min(total, r * W14.CHAIN.cols);
    beat(`chain${r}`, L.chain + 0.3 + (r - 1) * ((L.hashed - L.chain - 0.3) / rowsN), W14.chainField(board, n), {kind: 'linear', origin: [r % 2 ? 0 : 1, 0.5], direction: [r % 2 ? 1 : -1, 0], speed: 2.4, jitterS: 0.01, tintFollowsWave: true});
  }
  light.push({at: L.chain, dur: 1.2, key: 0.95, spread: 1.3, poolAt: [0, 0], look: [0, 0]});
  const types = text.ledgerEntryTypes as Record<string, number>;
  const typeLine = Object.entries(types)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
  const headShort = `${ledger.head.slice(0, 16)}…`;
  const printed = ledger.transcript[ledger.transcript.length - 1];
  const matches = printed.endsWith(ledger.head);
  ov('lg-count', L.chain, L.clones + 0.3, (t) => (
    <>
      <Mono t={t} at={L.own - 0.3} exitAt={L.clones} text={line('14.5', 0)} x={0.069 * W} y={0.075 * H} sizeH={0.03} tone={color.text.key} weight={700} />
      <Mono t={t} at={L.own} exitAt={L.clones} text={typeLine} x={0.069 * W} y={0.12 * H} sizeH={0.022} tone={color.text.caption} />
      <Mono t={t} at={L.hashed} exitAt={L.clones} text={line('14.5', 5)} x={0.069 * W} y={0.16 * H} sizeH={0.022} tone={color.text.chipDim} />
    </>
  ));
  ov('lg-run', L.clones - 0.3, L.end + 0.4, (t) => {
    const lines = ledger.transcript.map((s, k) => ({at: L.clones + 0.6 + k * 0.28, text: s.length > 66 ? `${s.slice(0, 63)}…` : s, kind: 'out' as const}));
    return (
      <>
        <Term t={t} at={L.clones - 0.2} exitAt={L.end - 0.3} x={0.069 * W} y={0.06 * H} width={0.5 * W} sizeH={0.02} title={line('14.5', 2)} titleCaps={false} lines={[{at: L.clones, text: ledger.cmd, kind: 'cmd'}, ...lines]} />
        <GlassCard t={t} at={L.hash} exitAt={L.end - 0.3} x={0.6 * W} y={0.06 * H} width={0.33 * W} label="head hash (computed at build)">
          <div style={{fontFamily: font.mono, fontSize: 0.026 * H, color: color.text.key}}>{headShort}</div>
          <div style={{marginTop: 0.01 * H, fontFamily: font.mono, fontSize: 0.02 * H, color: color.text.chipDim}}>{`${ledger.entries.length} entries · ${ledger.scope} · hash-chained, not signed`}</div>
        </GlassCard>
        {matches ? <Stamp kind="VERIFIED" at={L.match} t={t} exitAt={L.end - 0.3} x={0.765 * W} y={0.3 * H} /> : null}
        <Mono t={t} at={L.published} exitAt={L.end - 0.3} text={line('14.5', 4)} x={0.069 * W} y={0.5 * H} sizeH={0.022} tone={color.text.key} bg />
        <Chips t={t} side="right" y0={0.5} chips={[{repo: 'trace', path: 'tracekit/ledger.py', line: '208-236', at: L.hashed + 0.3, exitAt: L.end - 0.3}]} />
      </>
    );
  });
  ruleHide.push([L.clones - 0.2, L.end]);
  say(L.chain, 'running', 'Run node verify-ledger.mjs');
  if (matches) say(L.match, 'success', 'head hash matches');

  // ============================================================ 14.6 one rule
  const R = T.rule;
  beat('rule', R.gather, W14.ruleField(board), {...SWEEPS.raster([1, 0], 0.9)});
  move(R.gather - 0.2, 1.6, frameOn(board, {uv: [0.5, 0.48], pinsAcross: 170, yaw: 0.05, pitch: 0.06, aspect}));
  light.push({at: R.gather, dur: 1.2, key: 1.0, spread: 1.5, poolAt: [0, W14.RULE_V * board.extH - board.extH / 2], look: [0, 0]});
  const ruleWords = [...tl.utt('u1415').words, ...tl.utt('u1416').words];
  ov('rule-statement', R.start - 0.2, R.end + 0.4, (t) => <Statement t={t} words={ruleWords} exitAt={R.end - 0.3} y={0.14} sizeH={0.06} maxWidthW={0.5} maxLines={4} />);
  say(R.start, 'success', '66 of 66');

  // ============================================================ 14.7 the glass box
  const Gl = T.glass;
  const glassPose = frameOn(board, {uv: W14.BOX_UV, pinsAcross: 100, screen: [0.6, 0.5], yaw: -0.08, pitch: -0.05, aspect});
  move(Gl.rise - 0.4, 1.6, glassPose);
  move(Gl.rise + 1.3, Math.max(1, Gl.end - Gl.rise - 1.3), pushIn(glassPose, 0.03), 'inOutSine');
  beat('glass-box', Gl.rise, W14.boxField(board), {origin: W14.BOX_UV, speed: 0.6, jitterS: 0.08});
  beat('glass-clear', Gl.clear, W14.glassBoxField(board, assets.face, {portrait: false}), {...SWEEPS.from(W14.BOX_UV, 0.5, 0.08), tintFollowsWave: true});
  beat('glass-face', Gl.portrait, W14.glassBoxField(board, assets.face, {portrait: true}), {origin: [W14.BOX_UV[0], W14.BOX_UV[1] - 0.2], speed: 0.6, jitterS: 0.06});
  light.push({at: Gl.rise, dur: 2, key: 1.15, spread: 2.2, pool: 1.2, poolAt: [W14.BOX_UV[0] - 0.5, 0], look: [0, 0], env: 1.1});
  const nameWords = tl.utt('u1417').words;
  ov('glass-name', Gl.name - 0.3, T.card.start + 0.3, (t) => (
    <KineticLine words={nameWords} t={t} kind="headline" variant="focus" align="left" x={Math.round(0.069 * W)} y={Math.round(0.45 * H)} yAnchor="capTop" maxWidth={0.4 * W} exitAt={T.card.start - 0.2} />
  ));
  ov('glass-src', Gl.portrait, T.card.start + 0.3, (t) => <Chips t={t} side="left" y0={0.6} chips={[{repo: 'AnwarDebes.github.io', path: 'assets/data/face.png', at: Gl.portrait + 0.3, exitAt: T.card.start - 0.2}]} />);
  ruleHide.push([Gl.start, T.credits.end + 1]);
  say(Gl.start, 'idle', '');

  // ============================================================ 14.8 the end card and the QR
  const C = T.card;
  const qrAt = {u: 0.7, v: 0.56, module: 1.5};
  beat('qr', C.qr, W14.qrField(board, qr.rows, qrAt, flatField(0.62)), fromRight(0.9));
  move(C.start - 0.3, 1.8, frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0, pitch: 0, aspect}));
  const [disc] = TX['14.8'].slice(-1);
  ov('end-card', C.start - 0.2, C.end + 0.2, (t) => {
    const k = env(t, C.start, C.fade, 0.5, 0.6);
    const [qx, qy] = proj(t, [qrAt.u, qrAt.v - ((qr.size / 2 + 4) * qrAt.module * board.p) / board.extH], 0.4 * relief);
    return (
      <div style={{position: 'absolute', inset: 0, opacity: k}}>
        <div style={{position: 'absolute', left: 0.069 * W, top: 0.3 * H, fontFamily: font.sans, fontWeight: 700, fontSize: 0.075 * H, letterSpacing: '-0.02em', color: color.text.display, whiteSpace: 'pre'}}>{line('14.8', 0)}</div>
        <div style={{position: 'absolute', left: 0.069 * W, top: 0.41 * H, fontFamily: font.sans, fontWeight: 500, fontSize: 0.05 * H, letterSpacing: '-0.02em', color: color.text.display, whiteSpace: 'pre'}}>
          {line('14.8', 1).replace(/shows its work\.$/, '')}
          <Em>shows its work.</Em>
        </div>
        <Mono t={t} at={C.start + 0.8} exitAt={C.fade} text={line('14.8', 2)} x={0.069 * W} y={0.53 * H} sizeH={0.024} tone={color.text.key} bg />
        <Mono t={t} at={C.start + 1.0} exitAt={C.fade} text={line('14.8', 3)} x={0.069 * W} y={0.585 * H} sizeH={0.024} tone={color.text.key} bg />
        <Mono t={t} at={C.qr + 0.8} exitAt={C.fade} text={line('14.8', 4)} x={qx} y={qy + 0.02 * H} align="center" sizeH={0.022} tone={color.text.key} caps />
        <Mono t={t} at={C.qr + 1.1} exitAt={C.fade} text={line('14.8', 5)} x={qx} y={qy + 0.06 * H} align="center" sizeH={0.022} tone={color.text.caption} />
        <Mono t={t} at={C.start + 1.4} exitAt={C.fade} text={disc} x={0.5 * W} y={0.955 * H} align="center" sizeH={0.019} tone={color.text.chipDim} bg />
      </div>
    );
  });
  say(C.start + 0.6, 'waiting', 'Your turn');

  // the fade to black, then the credits on black
  ov('fade', C.fade, T.credits.end + 0.5, (t) => <div style={{position: 'absolute', inset: 0, background: '#000', opacity: Math.min(1, Math.max(0, (t - C.fade) / 1.0))}} />);
  const Cr = T.credits;
  const credits = TX['14.9'];
  ov('credits', Cr.start - 0.1, Cr.end + 0.2, (t) => {
    const dur = Cr.end - Cr.start;
    const y0 = 0.62 - 0.32 * ((t - Cr.start) / dur);
    const k = env(t, Cr.start, Cr.end - 3, 0.8, 2.8);
    return (
      <div style={{position: 'absolute', inset: 0, opacity: k}}>
        {credits.map((s, j) => {
          const [head, ...rest] = s.split(': ');
          return (
            <div key={s} style={{position: 'absolute', left: 0, right: 0, top: (y0 + j * 0.075) * H, textAlign: 'center', whiteSpace: 'pre'}}>
              <span style={{fontFamily: font.mono, fontSize: 0.022 * H, letterSpacing: '0.12em', textTransform: 'uppercase', color: color.accent.mintLabel}}>{head}</span>
              <span style={{fontFamily: font.sans, fontSize: 0.03 * H, color: color.text.display, marginLeft: 0.012 * H}}>{rest.join(': ')}</span>
            </div>
          );
        })}
      </div>
    );
  });
  say(Cr.start, 'idle', '');

  // ============================================================ always on: guide and rule line
  const litAt = ruleTimes(tl);
  ov('guide', T.chStart, C.fade + 0.6, () => <Guide />);
  ov('rule', T.chStart, Gl.start + 0.5, (t) => {
    let vis = 1;
    for (const [a, b] of ruleHide) vis = Math.min(vis, 1 - Math.min(env(t, a, undefined, 0.3), 1 - env(t, b, undefined, 0.4)));
    const lift = env(t, R.gather, R.end - 0.4, 0.8, 0.5);
    const y = 0.97 - (0.97 - 0.58) * lift;
    const out = 1 - env(t, Gl.start - 0.3, undefined, 0.5);
    return <RuleLine t={t} litAt={litAt} opacity={vis * out} y={y} d={0.0098 + 0.006 * lift} numerals={{from: Pa.full - 0.4, to: Pa.end, text: line('14.2', 4)}} sweep={{at: R.rule, dur: 0.75}} />;
  });

  const sound = cues(tl);
  return mergeParts({beats, camera, focus, light, presses, ripples, overlays, pixie, captionSkip: ['u1415', 'u1416', 'u1417'], sfx: sound.sfx, music: sound.music});
};

export const chapter: ChapterModule = {id: '14', build};
