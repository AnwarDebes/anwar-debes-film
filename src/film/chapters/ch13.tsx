import React from 'react';
import {ChapterCard, GlassCard} from '../../engine/type';
import {CodePanel, cue as codeCue, type CodePage} from '../../engine/code';
import {apertureForBlur, frameOn, lowAnglePull, pushIn, type CameraKey, type CameraPose, type FocusKey} from '../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, FILM_RIPPLE, SWEEPS, type Beat, type LightKey, type LiveLayer, type Press, type Ripple} from '../../engine/pins';
import {Sparks} from '../../engine/fx';
import {color, font} from '../../engine/tokens';
import type {PixieCue, PixieWalk} from '../../pixie';
import {HANDOFF} from '../handoff';
import type {ChapterModule, ChapterSpec, FilmCtx, TimedNode} from '../types';
import {cues} from './ch13.cues';
import {times13} from './ch13/times';
import {mergeParts} from './ch10/kit/spec';
import {Chips, Fact, Guide, Mono, Plate, RuleLine, SourceRow, Statement, Strike, Term, project, scurry} from './ch10/kit/ui';
import {MINT} from './ch10/kit/fields';
import * as W13 from './ch13/walls';
import {snippets13} from '../../data/ch13/code';
import {BALLAST_CHECK} from '../../data/ch13/checks';

// Chapter 13, "Real stakes": when numbers touch homes, menus and money, the rules get stricter.
// A client site whose numbers cannot compile without a source, a laser-measured twin of a housing
// field, two small businesses and three trading systems where the model never has the last word.
// Consent first: no client name, contact, login or portal appears; site footage of the client's
// and the businesses' pages is not used (pin re-creations from committed data stand in), and the
// client-gated lines show only while the timeline carries them (see ./ch13/times.ts).

const RULE_BASE = 55; // repositories lit on the rule line before this chapter (chapters 01-12)

const build = (ctx: FilmCtx): ChapterSpec => {
  const {board, tl, width: W, height: H, fps} = ctx;
  const T = times13(tl);
  const {c} = T;
  const aspect = W / H;
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const f = (s: number) => Math.round(s * fps);

  // ------------------------------------------------------------ camera language
  const P0 = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect});
  const place = (cu: number, pins = 146, yaw = 0.15, pitch = 0.06, cv = 0.52): CameraPose => frameOn(board, {uv: [cu, cv], pinsAcross: pins, yaw, pitch, aspect});
  const camera: CameraKey[] = [{at: T.chStart, pose: P0}];
  const move = (at: number, dur: number, pose: CameraPose, ease: CameraKey['ease'] = 'camera') => camera.push({at, dur, pose, ease});
  const dolly = (at: number, sceneEnd: number, cu = 0.5) => {
    move(at, 1.5, place(cu + 0.034, 142, 0.17));
    move(at + 1.55, Math.max(1, sceneEnd - at - 2.2), pushIn(place(cu, 140, 0.15), 0.03), 'inOutSine');
  };

  // ------------------------------------------------------------ wall, light, effects
  const beats: Beat[] = [];
  const beat = (id: string, at: number, field: Beat['field'], sweep?: Beat['sweep']) => beats.push({id: `c13-${id}`, at, field, sweep});
  const fromRight = (speed = 1.25): Beat['sweep'] => ({kind: 'linear', origin: [1.02, 0.5], direction: [-1, 0], speed, jitterS: 0.05, tintFollowsWave: true});
  const light: LightKey[] = [{at: T.chStart, key: 1, look: [0, 0], poolAt: [0, 0], spread: 1, pool: 1, env: 1}];
  const subjWorld: [number, number] = [W13.SUBJ[0] - 0.5, W13.SUBJ[1] * board.extH - board.extH / 2];
  const presses: Press[] = [];
  const ripples: Ripple[] = [];
  const live: LiveLayer[] = [];
  const focus: FocusKey[] = [{at: T.chStart, to: 'target', aperture: 0}];
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
  const ov = (id: string, from: number, to: number, render: TimedNode['render']) => overlays.push({id: `c13-${id}`, from, to, render});
  const plateLights: number[] = [];
  const codeHide: Array<[number, number]> = [];
  const proj = (t: number, uv: [number, number], z = 0) => project(camera, board, t, uv, z, W, H);

  // ============================================================ 13.0 the gate: a page turns
  const G = T.gate;
  const gatePage = W13.closeTerrain(board, {trees: 0.6, houses: true, plot1: true, rays: true});
  beat('page', G.at, gatePage, {kind: 'linear', origin: [1.02, 0.5], direction: [-1, 0], speed: 0.78, jitterS: 0.03, tintFollowsWave: true});
  // the page's turning edge: a ridge that runs right to left with the release front
  const turnS = 1.08 / 0.78;
  const ridge = {h: 0, tint: 1, glow: 0};
  live.push({
    fn: (u, _v, _i, t) => {
      const front = 1.02 - ((t - G.at) / turnS) * 1.08;
      const d = (u - front) / board.p;
      const k = Math.exp(-(d * d) / 18);
      if (k <= 0.02) return null;
      ridge.h = 0.42 * k;
      return ridge;
    },
    from: G.at,
    to: G.at + turnS + 0.25,
    fadeS: 0.15,
    mode: 'add',
    speedHint: () => 2,
  });
  move(G.at - 0.3, 1.6, lowAnglePull(place(0.52, 140, 0.2, 0.06), {pitch: -0.03, pull: 0.02}));
  light.push({at: G.at - 0.3, dur: 0.8, key: 0.9, spread: 1.15, poolAt: [0.1, 0.0], look: [0.12, -0.04]});
  ov('card', G.cardIn, G.cardOut + 0.4, (t) => <ChapterCard index="13" kicker="eight repositories" title="Real stakes." at={G.cardIn} exitAt={G.cardOut} t={t} />);
  say(G.at, 'idle', '');

  // ============================================================ 13.1 the street
  const S = T.street;
  beat('street', S.at, W13.street13Field(board), {origin: [0.5, 0.5], speed: 0.95, jitterS: 0.05, tintFollowsWave: true});
  move(S.at - 0.1, 1.2, frameOn(board, {uv: [0.42, 0.53], pinsAcross: 126, yaw: 0.14, pitch: 0.06, aspect}));
  move(S.dollyFrom + 1.0, S.dollyTo - S.dollyFrom - 1.0, frameOn(board, {uv: [0.62, 0.53], pinsAcross: 118, yaw: 0.18, pitch: 0.06, aspect}), 'inOutSine');
  light.push({at: S.at, dur: 1.2, key: 1, spread: 1.35, poolAt: [0.05, 0.01], look: [0, 0]});
  say(S.search, 'searching', 'Search eight repositories for sources');
  walkStep(S.dollyFrom + 0.9, S.dollyTo - S.dollyFrom - 1.1);

  // ============================================================ 13.2 knotten-web
  const K = T.web;
  const houseU = W13.street13U(board, 5);
  beat('lengde', K.wall, W13.numeralField(board, 'off'), {origin: [houseU, W13.STREET13_V], speed: 0.95, jitterS: 0.05});
  beat('kilde', K.rule, W13.numeralField(board, 'on'), {origin: [W13.PILL.u, W13.PILL.v], speed: 1.6, jitterS: 0.03, tintFollowsWave: true});
  move(K.wall - 0.1, 1.5, place(0.55, 144, 0.15));
  move(K.wall + 1.5, Math.max(1, K.code - K.wall - 1.6), pushIn(place(0.55, 144, 0.15), 0.04), 'inOutSine');
  light.push({at: K.wall, dur: 1, spread: 1.05, poolAt: [0.16, 0.06]});
  presses.push({at: K.kilde, origin: [W13.PILL.u, W13.PILL.v], radius: 0.022, depth: 0.8});
  ripples.push({...FILM_RIPPLE, at: K.kilde, origin: [W13.PILL.u, W13.PILL.v], amp: 0.3});
  // the thread: lit pins run from the chip, over the number, to the quote it opens
  live.push({fn: W13.threadLive(board, W13.THREAD, K.thread, 0.85), from: K.thread, to: K.code + 0.6, fadeS: 0.25, region: [0.45, 0.52, 0.88, 0.8], mode: 'replace'});
  plateLights.push(K.plate);
  ov('web-plate', K.plate, K.end + 0.4, (t) => <Plate t={t} at={K.plate} exitAt={K.end - 0.3} name="knotten-web" status="DESIGN PROTOTYPE · CLIENT PROJECT · FORMS DELIBERATELY NON-FUNCTIONAL" />);
  ov('web-sentence', K.plate + 0.3, K.kilde + 0.4, (t) => {
    const [px, py] = proj(t, [W13.PILL.u, W13.PILL.v], 0.24 * relief);
    return (
      <>
        <Mono t={t} at={K.plate + 0.4} exitAt={K.kilde + 0.1} text="app/page.tsx · in Norwegian, on the site" x={0.069 * W} y={0.235 * H} sizeH={0.022} tone={color.text.tertiary} />
        <Fact t={t} at={K.plate + 0.5} exitAt={K.kilde + 0.1} text="“Lengde **409,5** meter, fra 0 til 60 meter over havet.”" y={0.3} sizeH={0.034} maxWidthW={0.37} />
        <Mono t={t} at={K.rule} exitAt={K.end - 0.3} text="Kilde" x={px} y={py} align="center" sizeH={0.026} tone={color.text.key} weight={700} />
        <Chips t={t} side="left" y0={0.43} chips={[{repo: 'knotten-web', path: 'app/page.tsx', line: 26, at: K.plate + 0.9, exitAt: K.kilde + 0.1}]} />
      </>
    );
  });
  ov('web-rule', K.rule, K.code + 0.4, (t) => (
    <>
      <Fact t={t} at={K.rule} exitAt={K.kilde} text="the rule: a number that is not in this list does not go on the website" y={0.53} sizeH={0.028} maxWidthW={0.37} color={color.text.caption} />
      <Chips t={t} side="left" y0={0.64} chips={[{repo: 'knotten-web', path: 'lib/sources.ts', line: '1-5', at: K.source, exitAt: K.kilde}]} />
    </>
  ));
  ov('web-quote', K.thread + 0.3, K.end + 0.3, (t) => (
    <>
      <GlassCard t={t} at={K.thread + 0.4} exitAt={K.end - 0.3} x={0.069 * W} y={0.25 * H} width={0.37 * W} label="lib/sources.ts · profil">
        <div style={{fontFamily: font.sans, fontSize: 0.027 * H, lineHeight: 1.38, color: color.text.caption}}>
          «Terrengprofil tegnet i Norgeskart fra punkt A ved Spangereidveien til punkt B ved Knotten: <b style={{color: color.text.key}}>409,5 m</b>. Diagrammet er merket 0 moh og 60 moh.»
        </div>
        <div style={{marginTop: 0.012 * H, fontFamily: font.mono, fontSize: 0.022 * H, color: color.text.chipDim}}>doc: Norgeskart, skjermbilde fra prosjekteier</div>
      </GlassCard>
      <Chips t={t} side="left" y0={0.6} chips={[{repo: 'knotten-web', path: 'lib/sources.ts', line: '34-38', at: K.thread + 0.8, exitAt: K.end - 0.3}]} />
    </>
  ));
  ov('web-code', K.code - 0.2, K.end + 0.3, (t) => (
    <GlassCard t={t} at={K.code} exitAt={K.end - 0.4} x={0.5 * W} y={0.18 * H} width={0.43 * W} label="components/Source.tsx:59-60">
      <div style={{fontFamily: font.mono, fontSize: 0.023 * H, lineHeight: 1.5, color: color.text.caption, whiteSpace: 'pre'}}>
        <span style={{color: color.text.tertiary}}>{'/** The chip. Put it right after the number it documents. */\n'}</span>
        {'export function Src({ id, label = "Kilde" }:\n  { '}
        <span style={{color: color.text.key, background: 'rgba(116,201,174,0.18)', boxShadow: `inset 0 -2px 0 ${color.accent.mint}`, padding: '0 0.2em'}}>id: keyof typeof SOURCES</span>
        {'; label?: string }) {'}
      </div>
      <div style={{marginTop: 0.012 * H, fontFamily: font.sans, fontSize: 0.026 * H, color: color.text.display}}>
        a chip without a source does not <span style={{fontFamily: font.serif, fontStyle: 'italic', color: color.accent.mint, fontSize: 0.026 * H * font.emScale}}>compile</span>
      </div>
    </GlassCard>
  ));
  codeHide.push([K.code - 0.1, K.end]);
  ov('web-ghost', K.build - 0.3, K.end + 0.3, (t) => (
    <>
      <Mono t={t} at={K.build - 0.25} exitAt={K.end - 0.3} text="a Kilde chip with no source behind it" x={0.52 * W} y={0.58 * H} sizeH={0.023} tone={color.text.caption} />
      <Mono t={t} at={K.build + 0.15} exitAt={K.end - 0.3} text="Type error: build fails" x={0.52 * W} y={0.635 * H} sizeH={0.024} tone={color.signal.amber} weight={600} />
      <Chips t={t} side="right" y0={0.71} chips={[{repo: 'knotten-web', path: 'components/Source.tsx', line: '59-67', at: K.code + 0.5, exitAt: K.end - 0.3}]} />
    </>
  ));
  beat('kilde-dark', K.build - 0.25, W13.numeralField(board, 'dark'), {origin: [W13.PILL.u, W13.PILL.v], speed: 1.4, jitterS: 0.03, tintFollowsWave: true});
  say(K.plate, 'reading', 'Read lib/sources.ts (28 quotes)');

  // ============================================================ 13.3 knotten-test
  const Te = T.test;
  beat('specs0', Te.wall, W13.specsField(board, 0), fromRight());
  dolly(Te.wall - 0.1, Te.end);
  walkStep(Te.wall, 1.4);
  for (let k = 1; k <= 27; k += 2) beat(`specs${k}`, Te.specs + (k - 1) * 0.06, W13.specsField(board, Math.min(27, k + 1)), {origin: W13.specCell(board, k), speed: 3, jitterS: 0.02});
  light.push({at: Te.wall, dur: 1, spread: 1.1, poolAt: subjWorld});
  plateLights.push(Te.plate);
  ov('test-plate', Te.plate, Te.end + 0.4, (t) => <Plate t={t} at={Te.plate} exitAt={Te.end - 0.3} name="knotten-test" status="CLIENT PROTOTYPE · PRE-LAUNCH · ACCESS-GATED" />);
  ov('test-specs', Te.specs, Te.end + 0.3, (t) => (
    <>
      <Fact t={t} at={Te.notes - 0.1} exitAt={Te.briefShown ? Te.eight - 0.3 : Te.end - 0.3} text="**27** specs (SPEC-00 to SPEC-26) · each with a completion note" y={0.3} sizeH={0.032} maxWidthW={0.36} />
      <Chips t={t} side="left" y0={0.43} chips={[{repo: 'knotten-test', path: 'DELIVERY-REPORT.md', line: 49, at: Te.notes + 0.3, exitAt: Te.briefShown ? Te.eight - 0.3 : Te.end - 0.3}]} />
    </>
  ));
  say(Te.plate, 'reading', 'Read DELIVERY-REPORT.md');
  if (Te.briefShown) {
    beat('eight', Te.eight - 0.3, W13.eightField(board, 'up'), {origin: [W13.EIGHT_AT.u, W13.EIGHT_AT.v], speed: 1.1, jitterS: 0.04});
    beat('eight-flip', Te.flip - 0.15, W13.eightField(board, 'flipped'), {...SWEEPS.booleanFlip([W13.EIGHT_AT.u - 0.12, W13.EIGHT_AT.v + 0.2]), speed: 1.2});
    move(Te.eight - 0.4, 1.4, pushIn(place(0.56, 140, 0.2, 0.05), 0.08));
    ov('test-brief', Te.eight - 0.2, Te.end + 0.3, (t) => (
      <>
        <Strike
          t={t}
          at={Te.eight - 0.2}
          strikeAt={Te.flip - 0.1}
          fixAt={Te.flip + 0.3}
          exitAt={Te.end - 0.3}
          label="the original brief"
          claim={'“8” → homes'}
          fix="“8” → internship positions, not homes"
          x={0.069 * W}
          y={0.25 * H}
          width={0.37 * W}
        />
        <Mono t={t} at={Te.homes} exitAt={Te.end - 0.3} text={'“the “8” from the original brief refers to\nadvertised student-internship positions, not homes”'} x={0.069 * W} y={0.5 * H} sizeH={0.022} tone={color.text.caption} />
        <Chips t={t} side="left" y0={0.585} chips={[{repo: 'knotten-test', path: 'DELIVERY-REPORT.md', line: 33, at: Te.homes + 0.2, exitAt: Te.end - 0.3}]} />
      </>
    ));
    say(Te.flip - 0.1, 'writing', 'Edit the brief: 8 → internship positions');
  }

  // ============================================================ 13.4 knotten-test-2
  const Tw = T.twin;
  beat('twin', Tw.wall, W13.closeTerrain(board, {trees: 1, houses: true}), {...SWEEPS.raster([-1, 0], 0.9, [1.02, 0.5])});
  const twinPose = place(0.52, 138, 0.2, 0.06, 0.52);
  move(Tw.wall - 0.2, 1.6, twinPose);
  move(Tw.wall + 1.5, Math.max(1, Tw.wide - Tw.wall - 1.8), lowAnglePull(twinPose, {pitch: -0.1, pull: 0.04}), 'inOutSine');
  walkStep(Tw.wall, 1.4);
  light.push({at: Tw.wall, dur: 1.2, key: 1.04, spread: 1.25, poolAt: [0.1, 0.0], look: [0.2, 0.05]});
  plateLights.push(Tw.plate);
  say(Tw.plate, 'reading', 'Read data/plots.json');
  ov('twin-plate', Tw.plate, Tw.end + 0.4, (t) => <Plate t={t} at={Tw.plate} exitAt={Tw.end - 0.3} name="knotten-test-2" status="CLIENT WEB APP · PRE-LAUNCH · FIGURES PROVISIONAL" />);
  ov('twin-30', Tw.thirty - 0.2, Tw.wide, (t) => (
    <>
      <Fact t={t} at={Tw.thirty - 0.15} exitAt={Tw.wide - 0.2} text="**30** planned homes · a twin from the national LiDAR" y={0.3} sizeH={0.032} maxWidthW={0.36} />
      <Mono t={t} at={Tw.thirty + 0.3} exitAt={Tw.wide - 0.2} text={'rows A–D: 9, 10, 7 and 4 · trees from the canopy model'} x={0.069 * W} y={0.39 * H} sizeH={0.022} tone={color.text.chipDim} />
      <Chips
        t={t}
        side="left"
        y0={0.46}
        chips={[
          {repo: 'knotten-test-2', path: 'README.md', line: 105, at: Tw.thirty + 0.4, exitAt: Tw.wide - 0.2},
          {repo: 'knotten-test-2', path: 'pipeline/plan_layout_v6.py', line: '19-20, 58', at: Tw.thirty + 0.7, exitAt: Tw.wide - 0.2},
        ]}
      />
    </>
  ));
  // 360 sight lines from plot 1; the water bearings flip mint
  beat('wide', Tw.wide, W13.wideTerrain(board, 'none'), {origin: W13.plot1Wide(board), speed: 0.85, jitterS: 0.04});
  beat('lines', Tw.lines, W13.wideTerrain(board, 'all'), {origin: W13.plot1Wide(board), speed: 0.7, jitterS: 0.02, tintFollowsWave: true});
  move(Tw.wide - 0.2, 1.8, place(0.52, 146, 0.12, 0.08, 0.5));
  light.push({at: Tw.wide, dur: 1.2, spread: 1.4, poolAt: [0.08, 0.04]});
  const fz = place(0.6, 146).distance;
  const [p1u, p1v] = W13.plot1Wide(board);
  focus.push({at: Tw.water, dur: 0.5, to: {uv: [p1u, p1v - 0.04], h: 0.2 * relief}, aperture: apertureForBlur(6, fz, 0.1, 18, 1440)});
  focus.push({at: Tw.water + 0.6, dur: 2.4, to: {uv: [p1u + 0.02, 0.2], h: 0.05 * relief}, ease: 'inOutSine'});
  focus.push({at: Tw.sun - 0.3, dur: 0.6, to: 'target', aperture: 0});
  ov('twin-lines', Tw.lines, Tw.sun + 0.3, (t) => {
    const [px, py] = proj(t, W13.plot1Wide(board), 0.3 * relief);
    return (
      <>
        <Mono t={t} at={Tw.lines + 0.2} exitAt={Tw.sun} text="plot 1" x={px + 0.012 * W} y={py - 0.02 * H} sizeH={0.023} tone={color.accent.mint} weight={600} />
        <Fact t={t} at={Tw.water} exitAt={Tw.sun} text="plot 1: **360** sight lines to 15 km · **23°** of water · open sea" y={0.3} sizeH={0.03} maxWidthW={0.36} />
        <Mono t={t} at={Tw.water + 0.4} exitAt={Tw.sun} text={'checked with the neighbours standing\ndrawn: some land bearings, every other water bearing'} x={0.069 * W} y={0.4 * H} sizeH={0.022} tone={color.text.chipDim} />
        <Chips
          t={t}
          side="left"
          y0={0.49}
          chips={[
            {repo: 'knotten-test-2', path: 'data/plots.json', line: '11-75', at: Tw.water + 0.5, exitAt: Tw.sun},
            {repo: 'knotten-test-2', path: 'pipeline/knotten_terrain.py', line: '233-251, 266-272', at: Tw.water + 0.8, exitAt: Tw.sun},
          ]}
        />
      </>
    );
  });
  say(Tw.lines, 'searching', 'Search 360 bearings for water');
  // the shortest day: three arcs of 5-minute ticks
  beat('sun', Tw.sun, W13.sunDialField(board, 'none'), {origin: [W13.SUN.u, W13.SUN.v], speed: 1.0, jitterS: 0.03});
  const sunTicks = W13.SUN_ROWS.map((r) => Math.round(r.hours * 12));
  const tickS = 0.045;
  const tick0 = Tw.sun + 0.6;
  const litNow = [0, 0, 0];
  live.push({
    fn: W13.sunDialLive(board, (t) => {
      const n = Math.max(0, Math.floor((t - tick0) / tickS));
      for (let k = 0; k < 3; k++) litNow[k] = Math.min(sunTicks[k], n);
      return litNow;
    }),
    from: tick0,
    to: Tw.treesShown ? Tw.trees : Tw.end - 0.4,
    fadeS: 0.3,
    region: [W13.SUN.u - 0.2, W13.SUN.v - 0.02, W13.SUN.u + 0.2, W13.SUN.v + 0.3],
    mode: 'replace',
  });
  move(Tw.sun - 0.2, 1.5, place(0.52, 140, 0.1, 0.05, 0.52));
  light.push({at: Tw.sun, dur: 1, spread: 1.05, poolAt: [0.2, 0.0], key: 0.96});
  ov('twin-sun', Tw.sun, (Tw.treesShown ? Tw.trees : Tw.end) + 0.3, (t) => {
    const out = Tw.treesShown ? Tw.trees - 0.1 : Tw.end - 0.3;
    const nodes = W13.SUN_ROWS.map((r, k) => (
      <Mono
        key={r.label}
        t={t}
        at={tick0 + sunTicks[k] * tickS}
        exitAt={out}
        text={`${['inner', 'middle', 'outer'][k]} arc · ${r.label} · ${r.hours.toFixed(2)} h`}
        x={0.069 * W}
        y={(0.47 + k * 0.042) * H}
        sizeH={0.023}
        tone={k === 0 ? color.accent.mint : color.text.key}
        weight={600}
      />
    ));
    return (
      <>
        {nodes}
        <Fact t={t} at={Tw.darkest} exitAt={out} text="21 December: **2.25 – 4.42 h** of direct sun" y={0.3} sizeH={0.032} maxWidthW={0.36} />
        <Mono t={t} at={Tw.darkest + 0.3} exitAt={out} text={'terrain shading only: no houses, no trees\none pin = 5 minutes'} x={0.069 * W} y={0.39 * H} sizeH={0.022} tone={color.text.chipDim} />
        <Chips
          t={t}
          side="left"
          y0={0.62}
          chips={[
            {repo: 'knotten-test-2', path: 'data/plots.json', line: '3507, 6524', at: Tw.quarter, exitAt: out},
            {repo: 'knotten-test-2', path: 'README.md', line: 121, at: Tw.quarter + 0.3, exitAt: out},
            {repo: 'knotten-test-2', path: 'pipeline/knotten_terrain.py', line: '305-318', at: Tw.quarter + 0.6, exitAt: out},
          ]}
        />
      </>
    );
  });
  say(Tw.sun + 0.2, 'thinking', '5-minute ticks on plot 9');
  // the trees in the sight lines (client consent), and the spreadsheet flag (client consent)
  if (Tw.treesShown) {
    beat('trees', Tw.trees, W13.closeTerrain(board, {trees: 1, houses: true, corridor: 'flag'}), {...SWEEPS.raster([-1, 0], 1.1, [1.02, 0.5])});
    beat('trees-gone', Tw.gone - 0.2, W13.closeTerrain(board, {trees: 1, houses: true, corridor: 'gone'}), {...SWEEPS.dissolve(0.8)});
    move(Tw.trees - 0.2, 1.6, lowAnglePull(place(0.52, 134, 0.22, 0.06, 0.5), {pitch: -0.08, pull: 0.03}));
    light.push({at: Tw.trees, dur: 1, spread: 1.25, poolAt: [0.1, -0.01], key: 1.02});
    ov('twin-trees', Tw.trees, Tw.end + 0.3, (t) => (
      <>
        <Fact t={t} at={Tw.eighty - 0.1} exitAt={Tw.sheetShown ? Tw.sheet - 0.2 : Tw.end - 0.3} text="**1,028** of **101,900** trees cleared in the plan · **84** stand in the sight lines to the water" y={0.29} sizeH={0.03} maxWidthW={0.36} />
        <Mono t={t} at={Tw.gone} exitAt={Tw.sheetShown ? Tw.sheet - 0.2 : Tw.end - 0.3} text="every sea view assumes they are gone" x={0.069 * W} y={0.43 * H} sizeH={0.024} tone={color.signal.amber} />
        <Chips
          t={t}
          side="left"
          y0={0.5}
          chips={[
            {repo: 'knotten-test-2', path: 'site/public/twin/trees.json', line: '2-4', at: Tw.eighty + 0.2, exitAt: Tw.sheetShown ? Tw.sheet - 0.2 : Tw.end - 0.3},
            {repo: 'knotten-test-2', path: 'data/clearing.json', line: '248-252', at: Tw.eighty + 0.5, exitAt: Tw.sheetShown ? Tw.sheet - 0.2 : Tw.end - 0.3},
            {repo: 'knotten-test-2', path: 'pipeline/plan_layout_v6.py', line: '443-446', at: Tw.gone + 0.2, exitAt: Tw.sheetShown ? Tw.sheet - 0.2 : Tw.end - 0.3},
          ]}
        />
      </>
    ));
    say(Tw.trees, 'reading', 'Read data/clearing.json');
  }
  if (Tw.sheetShown) {
    ov('twin-sheet', Tw.sheet, Tw.end + 0.3, (t) => (
      <>
        <GlassCard t={t} at={Tw.sheet} exitAt={Tw.end - 0.3} x={0.069 * W} y={0.25 * H} width={0.37 * W} label="the project's budget spreadsheet">
          <div style={{fontFamily: font.sans, fontSize: 0.027 * H, lineHeight: 1.36, color: color.text.caption}}>
            “The <b style={{color: color.text.key}}>31 %</b> module efficiency in the spreadsheet is set too high; standard modules sit at 20 to 23 %, so the solar figure should come down about 30 %”
          </div>
        </GlassCard>
        <Mono t={t} at={Tw.pvgis} exitAt={Tw.end - 0.3} text="PVGIS 1,007.16 kWh per kWp a year (35°, south)" x={0.069 * W} y={0.52 * H} sizeH={0.024} tone={color.text.key} />
        <Chips
          t={t}
          side="left"
          y0={0.58}
          chips={[
            {repo: 'knotten-test-2', path: 'site/src/lib/facts/energy.ts', line: '31-32', at: Tw.high, exitAt: Tw.end - 0.3},
            {repo: 'knotten-test-2', path: 'site/public/twin/energy.json', line: 1, at: Tw.pvgis + 0.3, exitAt: Tw.end - 0.3},
            {repo: 'knotten-test-2', path: 'site/src/lib/sim/run.ts', line: '69-72', at: Tw.pvgis + 0.6, exitAt: Tw.end - 0.3},
          ]}
        />
      </>
    ));
  } else {
    ov('twin-pvgis', Tw.pvgis, Tw.end + 0.3, (t) => (
      <>
        <Mono t={t} at={Tw.pvgis} exitAt={Tw.end - 0.3} text="PVGIS 1,007.16 kWh per kWp a year (35°, south)" x={0.069 * W} y={0.56 * H} sizeH={0.024} tone={color.text.key} />
        <Chips t={t} side="left" y0={0.62} chips={[{repo: 'knotten-test-2', path: 'site/public/twin/energy.json', line: 1, at: Tw.pvgis + 0.3, exitAt: Tw.end - 0.3}]} />
      </>
    ));
  }

  // ============================================================ 13.5 grimstad-kiosk-grill
  const Gr = T.grill;
  beat('menu', Gr.wall, W13.menuField(board), fromRight());
  dolly(Gr.wall - 0.1, Gr.end);
  walkStep(Gr.wall, 1.4);
  light.push({at: Gr.wall, dur: 1, spread: 1.15, poolAt: [0.18, -0.03], key: 0.95});
  plateLights.push(Gr.plate);
  ov('grill-plate', Gr.plate, Gr.end + 0.4, (t) => <Plate t={t} at={Gr.plate} exitAt={Gr.end - 0.3} name="grimstad-kiosk-grill" status="WORKING RESTAURANT SITE · SCAFFOLDED WITH v0" />);
  const embers = W13.menuBars(board).filter((_, k) => k % 3 === 0).slice(0, 25);
  world.push({
    id: 'c13-embers',
    from: Gr.wall + 0.4,
    to: Gr.end + 0.2,
    premountS: 0.3,
    render: (t) => (
      <Sparks
        sources={embers.map((b) => {
          const [x, y] = [b.u - 0.5, (b.v + ((b.price / W13.MENU_CHART.max) * W13.MENU_CHART.height * board.p) / board.extH) * board.extH - board.extH / 2];
          return {position: [x, y, (0.14 + 0.36) * relief] as [number, number, number]};
        })}
        mode="loop"
        count={25}
        life={[1.6, 2.8]}
        speed={0.03}
        rise={[0, 0.02, 0.012]}
        opacity={Math.min(1, Math.max(0, (t - Gr.wall - 0.4) / 0.8)) * Math.min(1, Math.max(0, (Gr.end - t) / 0.6))}
      />
    ),
  });
  ov('grill-facts', Gr.seventy - 0.1, Gr.end + 0.3, (t) => {
    const [x0, y0] = proj(t, [W13.MENU_CHART.u0, W13.MENU_CHART.v0], 0);
    return (
      <>
        <Fact t={t} at={Gr.seventy} exitAt={Gr.end - 0.3} text="**74** items · **10** categories · one data file" y={0.3} sizeH={0.034} maxWidthW={0.36} />
        <Mono t={t} at={Gr.seventy + 0.4} exitAt={Gr.end - 0.3} text="24 – 217 NOK" x={x0} y={y0 + 0.03 * H} sizeH={0.022} tone={color.text.caption} />
        <Chips
          t={t}
          side="left"
          y0={0.42}
          chips={[
            {repo: 'grimstad-kiosk-grill', path: 'lib/menu-data.ts', line: '17-605', at: Gr.file - 0.2, exitAt: Gr.end - 0.3},
            {repo: 'grimstad-kiosk-grill', path: 'components/fire-animation.tsx', line: 17, at: Gr.file + 0.2, exitAt: Gr.end - 0.3},
            {repo: 'grimstad-kiosk-grill', path: 'app/layout.tsx', line: 96, at: Gr.v0, exitAt: Gr.end - 0.3},
          ]}
        />
        <Mono t={t} at={Gr.v0 + 0.1} exitAt={Gr.end - 0.3} text={'generator: "v0.app"'} x={0.069 * W} y={0.6 * H} sizeH={0.024} tone={color.text.key} bg />
      </>
    );
  });
  say(Gr.plate, 'reading', 'Read lib/menu-data.ts');

  // ============================================================ 13.6 Trondheim-Cookies
  const Ck = T.cookies;
  beat('delivery', Ck.wall, W13.deliveryField(board, false), fromRight());
  beat('cookie', Ck.ten - 0.2, (u, v, i) => {
    const d = W13.deliveryField(board, true)(u, v, i);
    return d.h > 0.01 ? d : W13.cookieField(board, 'in')(u, v, i);
  }, {origin: [W13.COOKIE.u, W13.COOKIE.v], speed: 1.0, jitterS: 0.04});
  beat('cookie-slice', Ck.syria - 0.3, (u, v, i) => {
    const d = W13.deliveryField(board, true)(u, v, i);
    return d.h > 0.01 ? d : W13.cookieField(board, 'out')(u, v, i);
  }, {origin: [W13.COOKIE.u + 0.02, W13.COOKIE.v + 0.03], speed: 1.4, jitterS: 0.03});
  beat('delivery-lit', Ck.free - 0.2, W13.deliveryField(board, true), {origin: [W13.FREE_AT[0], W13.FREE_AT[1]], speed: 1.4, jitterS: 0.03, tintFollowsWave: true});
  dolly(Ck.wall - 0.1, Ck.end);
  walkStep(Ck.wall, 1.4);
  light.push({at: Ck.wall, dur: 1, spread: 1.15, poolAt: [0.18, 0.02], key: 1});
  plateLights.push(Ck.plate);
  ov('ck-plate', Ck.plate, Ck.end + 0.4, (t) => <Plate t={t} at={Ck.plate} exitAt={Ck.end - 0.3} name="Trondheim-Cookies" status="SMALL ORDERING SITE · PAUSED FROM 4 JULY 2026" />);
  ov('ck-langs', Ck.english - 0.1, Ck.end + 0.3, (t) => (
    <>
      <div style={{position: 'absolute', left: 0.069 * W, top: 0.24 * H, display: 'flex', gap: 0.02 * W, fontFamily: font.sans, fontSize: 0.04 * H, fontWeight: 600, color: color.text.display}}>
        {[
          ['English', Ck.english],
          ['Norsk', Ck.norwegian],
          ['العربية', Ck.arabic],
        ].map(([label, at]) => (
          <span key={label as string} dir={label === 'العربية' ? 'rtl' : 'ltr'} style={{opacity: Math.min(1, Math.max(0, (t - (at as number)) / 0.3)) * Math.min(1, Math.max(0, (Ck.end - 0.3 - t) / 0.3))}}>
            {label}
          </span>
        ))}
      </div>
      <Chips t={t} side="left" y0={0.35} chips={[{repo: 'Trondheim-Cookies', path: 'app.js', line: '24-27', at: Ck.arabic + 0.3, exitAt: Ck.end - 0.3}]} />
    </>
  ));
  ov('ck-rule', Ck.free - 0.2, Ck.end + 0.3, (t) => {
    const labels: Array<[number, string]> = [
      [0, '> 9 cookies'],
      [1, 'a free area'],
      [2, '≤ 2 km'],
    ];
    const [fx, fy] = proj(t, W13.FREE_AT, 0.26 * relief);
    const [ex, ey] = proj(t, W13.FEE_AT, 0.2 * relief);
    const [cx, cy] = proj(t, [W13.COOKIE.u, W13.COOKIE.v - (W13.COOKIE.r + 2) * board.p / board.extH], 0);
    return (
      <>
        {labels.map(([k, s]) => {
          const [x, y] = proj(t, W13.ruleTile(board, k), 0.22 * relief);
          return <Mono key={s} t={t} at={Ck.free + k * 0.12} exitAt={Ck.end - 0.3} text={s} x={x} y={y} align="center" sizeH={0.022} tone={color.text.key} weight={600} />;
        })}
        <Mono t={t} at={Ck.free + 0.4} exitAt={Ck.end - 0.3} text="free" x={fx} y={fy} align="center" sizeH={0.024} tone={color.wall.void} weight={700} />
        <Mono t={t} at={Ck.free + 0.5} exitAt={Ck.end - 0.3} text="otherwise 39 kr" x={ex} y={ey} align="center" sizeH={0.022} tone={color.text.key} weight={600} />
        <Mono t={t} at={Ck.ten} exitAt={Ck.end - 0.3} text={"59 kr · 10% to children in Syria\nthe site's own statement"} x={cx} y={cy + 0.02 * H} align="center" sizeH={0.022} tone={color.text.caption} />
        <Chips
          t={t}
          side="left"
          y0={0.44}
          chips={[
            {repo: 'Trondheim-Cookies', path: 'app.js', line: '19-21, 666-671', at: Ck.free + 0.5, exitAt: Ck.end - 0.3},
            {repo: 'Trondheim-Cookies', path: 'app.js', line: '12-13', at: Ck.ten + 0.3, exitAt: Ck.end - 0.3},
            {repo: 'Trondheim-Cookies', path: 'app.js', line: 126, at: Ck.plate + 0.6, exitAt: Ck.end - 0.3},
          ]}
        />
      </>
    );
  });
  say(Ck.plate, 'thinking', 'Planning the delivery fee · app.js:666-671');

  // ============================================================ 13.7 ballast
  const B = T.ballast;
  beat('layers', B.wall, W13.layersField(board, 'on', false), fromRight());
  dolly(B.wall - 0.1, B.end);
  walkStep(B.wall, 1.4);
  light.push({at: B.wall, dur: 1, spread: 1.05, poolAt: [0.12, 0.05], key: 0.94});
  plateLights.push(B.plate);
  say(B.plate, 'reading', 'Read README.md');
  ov('ba-plate', B.plate, B.end + 0.4, (t) => <Plate t={t} at={B.plate} exitAt={B.end - 0.3} name="ballast" status="PAPER TRADING BY DEFAULT · v0.1.0 · DATA PACKAGE MISSING" />);
  for (let k = 1; k < W13.PRICE_STEPS.length; k++) {
    beat(`price${k}`, B.falling - 0.1 + (k - 1) * 0.42, (u, v, i) => {
      const l = W13.layersField(board, 'on', false)(u, v, i);
      return l.h > 0.01 ? l : W13.priceField(board, k, false)(u, v, i);
    }, {kind: 'linear', origin: [W13.PRICE.u0, 0.5], direction: [1, 0], speed: 2.5, jitterS: 0.01});
  }
  beat('exit', B.stop, (u, v, i) => {
    const l = W13.layersField(board, 'grey', true)(u, v, i);
    return l.h > 0.01 ? l : W13.priceField(board, W13.PRICE_STEPS.length, true)(u, v, i);
  }, {...SWEEPS.booleanFlip([W13.LAYERS.u, W13.LAYERS.v[2]]), speed: 1.5});
  ov('ba-layers', B.proposes - 0.2, B.end + 0.3, (t) => {
    const names = ['LLM proposes', 'strategy disposes', 'risk has the last word'];
    const nodes = names.map((n, k) => {
      const [x, y] = proj(t, [W13.LAYERS.u, W13.LAYERS.v[k]], 0.3 * relief);
      const greyed = k === 1 && t >= B.stop;
      return <Mono key={n} t={t} at={B.proposes - 0.15 + k * 0.5} exitAt={B.end - 0.3} text={k === 1 && t >= B.stop ? 'strategy: HOLD (overruled)' : n} x={x} y={y} align="center" sizeH={0.023} tone={greyed ? color.text.caption : k === 2 && t >= B.stop ? color.accent.mint : color.text.key} weight={600} bg />;
    });
    const vy = (p: number) => W13.PRICE.v0 + ((p - W13.PRICE.lo) / (W13.PRICE.hi - W13.PRICE.lo)) * (W13.PRICE.v1 - W13.PRICE.v0);
    const [sx, sy] = proj(t, [W13.PRICE.u0, vy(95)], 0.1 * relief);
    const [ex, ey] = proj(t, [W13.PRICE.u1, vy(94)], 0.26 * relief);
    const [ax, ay] = proj(t, [W13.PRICE.u0, W13.PRICE.v1 + 0.03], 0);
    return (
      <>
        {nodes}
        <Mono t={t} at={B.falling} exitAt={B.end - 0.3} text="price 100 → 94" x={ax} y={ay} sizeH={0.022} tone={color.text.caption} />
        <Mono t={t} at={B.falling + 0.2} exitAt={B.end - 0.3} text="stop 95" x={sx} y={sy + 0.036 * H} sizeH={0.022} tone={t >= B.stop ? color.accent.mint : color.text.caption} weight={600} bg />
        <Mono t={t} at={B.stop + 0.1} exitAt={B.end - 0.3} text="EXIT · stop_loss" x={ex} y={ey + 0.065 * H} align="right" sizeH={0.03} tone={color.accent.mint} weight={700} bg />
      </>
    );
  });
  ov('ba-text', B.proposes, B.run - 0.1, (t) => (
    <>
      <Fact t={t} at={B.never - 0.1} exitAt={B.tests - 0.2} text="the model may propose a thesis; it never places, sizes or approves an order" y={0.3} sizeH={0.03} maxWidthW={0.36} />
      <Chips t={t} side="left" y0={0.44} chips={[{repo: 'ballast', path: 'README.md', line: '15-16, 32', at: B.never + 0.3, exitAt: B.tests - 0.2}]} />
    </>
  ));
  ov('ba-test', B.tests, B.run + 0.2, (t) => (
    <>
      <Mono t={t} at={B.tests + 0.1} exitAt={B.run - 0.3} text={'tests/test_risk.py · test_stop_loss_flattens_\nregardless_of_proposal: holding at 100, stop 95,\nthe price at 94, the strategy says HOLD'} x={0.069 * W} y={0.3 * H} sizeH={0.023} tone={color.text.caption} />
      <Fact t={t} at={B.whatever - 0.1} exitAt={B.run - 0.3} text="EXIT · stop_loss, *whatever* the strategy wanted" y={0.43} sizeH={0.03} maxWidthW={0.36} />
    </>
  ));
  ov('ba-test-chips', B.tests, B.run, (t) => (
    <Chips
      t={t}
      side="left"
      y0={0.53}
      chips={[
        {repo: 'ballast', path: 'tests/test_risk.py', line: '32-35', at: B.tests + 0.4, exitAt: B.run - 0.3},
        {repo: 'ballast', path: 'src/ballast/risk/limits.py', line: '10-15', at: B.stop + 0.2, exitAt: B.run - 0.3},
      ]}
    />
  ));
  // the check, run for real from a clean export of the clone (data/ch13/checks.ts)
  const run0 = B.run;
  ov('ba-run', run0, B.end + 0.3, (t) => (
    <>
      <Term
        t={t}
        at={run0}
        exitAt={B.end - 0.3}
        x={0.069 * W}
        y={0.25 * H}
        width={0.36 * W}
        sizeH={0.022}
        title={`ballast @ ${BALLAST_CHECK.commit} · ${BALLAST_CHECK.date}`}
        titleCaps={false}
        lines={[
          {at: run0, text: BALLAST_CHECK.env, kind: 'out'},
          {at: run0 + 0.2, text: BALLAST_CHECK.risk.cmd, kind: 'cmd'},
          {at: run0 + 1.3, text: BALLAST_CHECK.risk.out[0].split(' ')[0], kind: 'out'},
          {at: run0 + 1.5, text: BALLAST_CHECK.risk.out[1], kind: 'out'},
          {at: run0 + 2.3, text: BALLAST_CHECK.full.cmd, kind: 'cmd'},
          {at: run0 + 3.0, text: BALLAST_CHECK.full.out[0].replace(/^E\s+/, 'E  '), kind: 'out'},
          {at: run0 + 3.1, text: `… ${BALLAST_CHECK.full.out[1].replace(/!+/g, '').trim()} …`, kind: 'out'},
        ]}
      />
      <Mono t={t} at={run0 + 3.4} exitAt={B.end - 0.3} text={'the full suite stops at collection: ballast.data is not in the repo'} x={0.069 * W} y={0.57 * H} sizeH={0.022} tone={color.text.caption} />
      <Chips t={t} side="left" y0={0.63} chips={[{repo: 'ballast', path: 'README.md', line: '8, 125', at: run0 + 3.6, exitAt: B.end - 0.3}]} />
    </>
  ));
  say(B.tests, 'reading', 'Read tests/test_risk.py');
  say(run0 + 0.2, 'running', 'Run pytest tests/test_risk.py');
  say(run0 + 1.5, 'success', '11 passed in 1.36s');

  // ============================================================ 13.8 hugin
  const Hu = T.hugin;
  beat('ladder0', Hu.wall, W13.ladderField(board, 0), fromRight());
  beat('ladder1', Hu.earn, W13.ladderField(board, 1), {origin: [W13.LADDER.u, W13.LADDER.v[0]], speed: 1.5, jitterS: 0.03, tintFollowsWave: true});
  beat('ladder2', Hu.ninety - 0.2, W13.ladderField(board, 2), {origin: [W13.LADDER.u, W13.LADDER.v[1]], speed: 1.5, jitterS: 0.03, tintFollowsWave: true});
  beat('ladder3', Hu.today - 0.2, W13.ladderField(board, 3), {origin: [W13.LADDER.u, W13.LADDER.v[2]], speed: 1.5, jitterS: 0.03, tintFollowsWave: true});
  dolly(Hu.wall - 0.1, Hu.end);
  walkStep(Hu.wall, 1.4);
  light.push({at: Hu.wall, dur: 1, spread: 1.1, poolAt: [0.12, 0.04], key: 0.96});
  plateLights.push(Hu.plate);
  ov('hu-plate', Hu.plate, Hu.end + 0.4, (t) => <Plate t={t} at={Hu.plate} exitAt={Hu.end - 0.3} name="hugin" status="PAPER TRADING FIRST · v0.1.0 · BACKTESTS ONLY" />);
  ov('hu-gates', Hu.earn - 0.2, Hu.end + 0.3, (t) => {
    const rungs: Array<[string, string, number]> = [
      ['research', '', Hu.earn],
      ['paper', '≥ 5 years of backtest\nSharpe ≥ 0.8 · ≥ 200 trades', Hu.ninety - 0.1],
      ['live', '≥ 90 paper days · ≥ 50 trades\na confirmation with today’s date', Hu.today - 0.1],
    ];
    const [bx, by] = proj(t, [W13.BREAKERS.u, W13.BREAKERS.v0 + 7 * ((W13.BREAKERS.step * board.p) / board.extH)], 0.3 * relief);
    return (
      <>
        {rungs.map(([n, gate, at], k) => {
          const [x, y] = proj(t, [W13.LADDER.u, W13.LADDER.v[k]], 0.3 * relief);
          const [gx, gy] = proj(t, [W13.LADDER.u, k > 0 ? (W13.LADDER.v[k] + W13.LADDER.v[k - 1]) / 2 : W13.LADDER.v[0]], 0.1 * relief);
          return (
            <React.Fragment key={n}>
              <Mono t={t} at={at} exitAt={Hu.end - 0.3} text={n} x={x} y={y} align="center" sizeH={0.026} tone={k === 2 ? color.accent.mint : color.text.key} weight={700} bg />
              {gate ? <Mono t={t} at={at + 0.2} exitAt={Hu.end - 0.3} text={gate} x={gx} y={gy} align="center" sizeH={0.022} tone={color.text.caption} bg /> : null}
            </React.Fragment>
          );
        })}
        <Mono t={t} at={Hu.ninety + 0.4} exitAt={Hu.end - 0.3} text={'8 circuit\nbreakers'} x={bx} y={by - 0.055 * H} align="center" sizeH={0.022} tone={color.text.caption} />
        <Chips
          t={t}
          side="left"
          y0={0.3}
          chips={[
            {repo: 'hugin', path: 'src/hugin/orchestration/promoter.py', line: '25-110', at: Hu.ninety, exitAt: Hu.end - 0.3},
            {repo: 'hugin', path: 'src/hugin/orchestration/promoter.py', line: '36, 93', at: Hu.today, exitAt: Hu.end - 0.3},
            {repo: 'hugin', path: 'src/hugin/risk/circuit_breakers.py', line: '18-27', at: Hu.today + 0.4, exitAt: Hu.end - 0.3},
          ]}
        />
      </>
    );
  });
  ov('hu-warn', Hu.warns, Hu.end + 0.3, (t) => (
    <>
      <Fact t={t} at={Hu.warns} exitAt={Hu.end - 0.3} text="“If anyone tells you they have a strategy that does much better than that at this capital scale, they are either overfitting, ignoring costs, or selling *something*.”" y={0.48} sizeH={0.026} maxWidthW={0.37} color={color.text.caption} />
      <Chips t={t} side="left" y0={0.68} chips={[{repo: 'hugin', path: 'README.md', line: '54-55', at: Hu.something - 0.2, exitAt: Hu.end - 0.3}]} />
    </>
  ));
  say(Hu.plate, 'reading', 'Read src/hugin/orchestration/promoter.py');

  // ============================================================ 13.9 Goblin
  const Go = T.goblin;
  dolly(Go.wall - 0.1, Go.end);
  walkStep(Go.wall, 1.4);
  plateLights.push(Go.plate);
  ov('go-plate', Go.plate, Go.end + 0.4, (t) => <Plate t={t} at={Go.plate} exitAt={Go.end - 0.3} name="Goblin" status="PERSONAL LIVE-TRADING PROTOTYPE · PROPRIETARY LICENCE" />);
  if (Go.approved) {
    beat('bus', Go.wall, W13.goblinField(board, 'bus'), fromRight());
    beat('hit', Go.comment, W13.goblinField(board, 'hit'), {kind: 'linear', origin: [W13.HIT.u0, W13.HIT.v], direction: [1, 0], speed: 0.9, jitterS: 0.02, tintFollowsWave: true});
    light.push({at: Go.wall, dur: 1, spread: 1.2, poolAt: [0.2, 0.0], key: 0.93});
    // fourteen services on one bus; the names stagger over three heights so the long ones fit
    ov('go-bus', Go.services - 0.2, Go.comment + 0.4, (t) => {
      const [bx, by] = proj(t, [W13.BUS.u0, W13.BUS.v], 0.12 * relief);
      return (
        <>
          {W13.SERVICES.map((s, k) => {
            const [nu, nv] = W13.serviceAt(board, k);
            const [x, y] = proj(t, [nu, nv], 0.26 * relief);
            const col = k % 7;
            const up = k < 7;
            const off = (0.112 - (col % 3) * 0.03) * (up ? -1 : 1);
            const edge = col === 0 ? -1 : col === 6 ? 1 : 0;
            const ex = edge === 0 ? x : proj(t, [nu + edge * (W13.SERVICE_BOX.w / 2) * board.p, nv], 0.26 * relief)[0];
            return <Mono key={s} t={t} at={Go.services + col * 0.05} exitAt={Go.comment - 0.1} text={s} x={ex} y={y + off * H} align={edge < 0 ? 'left' : edge > 0 ? 'right' : 'center'} sizeH={0.022} tone={color.text.caption} />;
          })}
          <Mono t={t} at={Go.bus} exitAt={Go.comment - 0.1} text="Redis pub/sub" x={bx - 0.012 * W} y={by} align="right" sizeH={0.022} tone={color.accent.mintLabel} />
        </>
      );
    });
    // once the comment is read, the bus gives way to the hit rate against a coin flip
    ov('go-hit', Go.comment, Go.end + 0.3, (t) => {
      const at = (x: number) => W13.HIT.u0 + (W13.HIT.u1 - W13.HIT.u0) * x;
      const [hx, hy] = proj(t, [at(0.452), W13.HIT.v - (2.25 * board.p) / board.extH], 0.2 * relief);
      const [cx, cy] = proj(t, [at(0.5), W13.HIT.v + (6.5 * board.p) / board.extH], 0.18 * relief);
      return (
        <>
          <Mono t={t} at={Go.fortyFive} exitAt={Go.end - 0.3} text="45.2%" x={hx} y={hy + 0.04 * H} align="center" sizeH={0.03} tone={color.text.key} weight={700} />
          <Mono t={t} at={Go.coin - 0.1} exitAt={Go.end - 0.3} text="coin flip · 50%" x={cx} y={cy - 0.03 * H} align="center" sizeH={0.022} tone={color.text.caption} />
        </>
      );
    });
    ov('go-src', Go.plate + 0.4, Go.edge + 0.2, (t) => (
      <Chips
        t={t}
        side="left"
        y0={0.3}
        chips={[
          {repo: 'Goblin', path: 'LICENSE', line: '1-3', at: Go.plate + 0.6, exitAt: Go.edge - 0.3},
          {repo: 'Goblin', path: 'services/', at: Go.services + 0.15, exitAt: Go.edge - 0.3},
          {repo: 'Goblin', path: 'STRATEGY.md', line: 40, at: Go.bus + 0.15, exitAt: Go.edge - 0.3},
        ]}
      />
    ));
    ov('go-text', Go.strategy, Go.end + 0.3, (t) => (
      <>
        <Fact t={t} at={Go.strategy + 0.1} exitAt={Go.end - 0.3} text="“coin-flip-or-worse”" y={0.25} sizeH={0.04} maxWidthW={0.36} />
        <Chips t={t} side="left" y0={0.36} chips={[{repo: 'Goblin', path: 'STRATEGY.md', line: '17-20', at: Go.edge, exitAt: Go.end - 0.3}]} />
        <Mono t={t} at={Go.fortyFive - 0.2} exitAt={Go.end - 0.3} text={'raw model, forward: 45.2% hit rate · n = 857\nfrom a code comment · no committed counters'} x={0.069 * W} y={0.45 * H} sizeH={0.022} tone={color.text.caption} />
        <Chips t={t} side="left" y0={0.53} chips={[{repo: 'Goblin', path: 'services/signal/main.py', line: '299-301', at: Go.fortyFive + 0.2, exitAt: Go.end - 0.3}]} />
        <Mono t={t} at={Go.coin + 0.9} exitAt={Go.end - 0.3} text={'commit 8c00dec: a global kill switch that blocks all trading\nlast commit e77a739: a script that stops the whole stack'} x={0.069 * W} y={0.62 * H} sizeH={0.022} tone={color.text.chipDim} />
      </>
    ));
    say(Go.plate, 'reading', 'Read STRATEGY.md');
    say(Go.comment, 'reading', 'Read services/signal/main.py');
  } else {
    beat('bus', Go.wall, W13.goblinField(board, 'bus'), fromRight());
  }

  // ============================================================ 13.10 here a number is only as good as its source
  const Cl = T.close;
  const closeV = 0.42;
  const ruleAt = c.w('u1323', 'good') - 0.3;
  beat('street-again', Cl.glow, W13.street13Field(board, closeV), {origin: [0.5, closeV], speed: 1.1, jitterS: 0.05, tintFollowsWave: true});
  move(Cl.glow - 0.2, 1.6, frameOn(board, {uv: [0.5, 0.5], pinsAcross: 156, yaw: 0.08, pitch: 0.05, aspect}));
  light.push({at: Cl.glow, dur: 1.2, key: 1.02, spread: 1.45, poolAt: [0, 0.0]});
  const numbers: Array<[number, string, string]> = [
    [5, '409,5 m', 'knotten-web/app/page.tsx:26'],
    [5, '27 specs', 'knotten-test/DELIVERY-REPORT.md:49'],
    [5, '2.25 h', 'knotten-test-2/data/plots.json:3507'],
    [4, '74 items', 'grimstad-kiosk-grill/lib/menu-data.ts'],
    [3, '39 kr', 'Trondheim-Cookies/app.js:19'],
    [2, 'stop 95', 'ballast/tests/test_risk.py:33'],
    [1, '90 days', 'hugin/src/hugin/orchestration/promoter.py:36'],
    [0, '45.2% · a code comment', 'Goblin/services/signal/main.py:300'],
  ];
  ov('close-numbers', Cl.glow + 0.3, ruleAt + 0.4, (t) => (
    <>
      {numbers.map(([, n, src], j) => (
        <SourceRow key={n} t={t} at={Cl.glow + 0.4 + j * 0.16} exitAt={ruleAt} value={n} source={src} x={0.931 * W} y={(0.1 + j * 0.055) * H} />
      ))}
    </>
  ));
  for (let j = 0; j < 6; j++) {
    const lit = [5, 4, 3, 2, 1, 0].slice(0, j + 1);
    beat(`street-lit${j}`, Cl.glow + 0.4 + [0, 3, 4, 5, 6, 7][j] * 0.16, W13.street13Field(board, closeV, lit), {origin: [W13.street13U(board, 5 - j), closeV], speed: 2.2, jitterS: 0.02, tintFollowsWave: true});
  }
  beat('closing-rule', ruleAt, W13.closingRule(board, 0.535, 0.11, 0.43), {...SWEEPS.dissolve(0.6)});
  const sourceWords = c.u('u1323').words;
  ov('close-statement', Cl.line - 0.2, T.chEnd, (t) => <Statement t={t} words={sourceWords} exitAt={Cl.release - 0.1} y={0.12} sizeH={0.058} maxWidthW={0.38} maxLines={5} />);
  say(Cl.start, 'idle', '');

  // ============================================================ the handoff
  beat('handoff', Cl.release, HANDOFF, SWEEPS.dissolve(0.7));
  move(Cl.release - 0.1, T.chEnd - Cl.release - 0.1, P0);
  light.push({at: Cl.release, dur: T.chEnd - Cl.release - 0.15, key: 1, look: [0, 0], poolAt: [0, 0], spread: 1, pool: 1, env: 1});

  // ============================================================ always on: guide and rule line
  if (walkX > 0) walks.push({fromX: walkX, toX: 0, startFrame: f(Cl.release + 0.2), speed: 3, gait: 'scurry', arriveFacing: 'right'});
  ov('guide', T.chStart, T.chEnd, () => <Guide walk={walks} />);
  ov('rule', T.chStart, T.chEnd, (t) => <RuleLine t={t} base={RULE_BASE} lights={plateLights} hide={codeHide} from={T.chStart - 1} to={T.chEnd + 1} />);

  const sound = cues(tl);
  return mergeParts({beats, camera, focus, light, presses, ripples, live, world, overlays, pixie, captionSkip: ['u1323'], sfx: sound.sfx, music: sound.music});
};

export const chapter: ChapterModule = {id: '13', build};
