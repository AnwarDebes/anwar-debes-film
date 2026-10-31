import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import type {LiveLayer} from '../../../engine/pins';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {ArchDiagram, asDiagramLayout} from '../../../engine/diagram';
import {GlassCard, Scrim} from '../../../engine/type';
import {color, font} from '../../../engine/tokens';
import {snippets} from '../../../data/ch06/code';
import reinsLayout from '../../../data/ch06/diagrams/reins.layout.json';
import type {Builder} from './kit/builder';
import {Cites, PathKicker, Tag, WallLabels, pull, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, rect, shapesLive, shapesRegion, type Look, type Shape} from './kit/shapes';
import {tile} from './reins';
import type {Times06} from './times';
import {EDITS, type Beats06} from './beats';

// 06.2 reins: the repair search. Five monitors, what the deployment can enact, five priced edits
// simulated on a copy of the monitors, the cheapest safe one kept, and the honest fallback.

const R = 'reins';
const LAYOUT = asDiagramLayout(reinsLayout);
const DIAG_SAFE = {left: 0.05, right: 0.95, top: 0.16, bottom: 0.7};

/** Monitor plates: the five temporal rules of the data-handling policy (experiments/_common.py:41-48). */
const RULES = ['always within_scope', 'never delete_all', '≤ 2 exports / 50 steps', 'audit_log within 3', 'authorize before transfer'];


export const buildRepair = (b: Builder, T: Times06, ground: Look, B: Beats06) => {
  const {S} = b;
  const s = T.s2;
  const P2 = frameOn(b.ctx.board, {uv: S.uv(88, S.ext / 2), pinsAcross: 140, yaw: -0.07, pitch: 0.065, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P2, fx, fy);

  // ---------------------------------------------------------------- monitors (left column)
  const [mx0] = at(0.075, 0.3);
  const [mx1] = at(0.375, 0.3);
  const mW = mx1 - mx0;
  const mcx = (mx0 + mx1) / 2;
  const monY = [0.25, 0.34, 0.43, 0.52, 0.61].map((fy) => at(0.2, fy)[1]);
  const plate = (k: number, look: Look) => rect(mcx, monY[k], mW, 5.6, look, {r: 1.6});
  const mLook: Look = {h: 0.13, tint: 0.96};
  const monitors = (looks?: (k: number) => Look) => RULES.map((_, k) => plate(k, looks ? looks(k) : mLook));

  // ---------------------------------------------------------------- the call and its five edits (right)
  const [callX0, callY] = at(0.5, 0.25);
  const callW = 34;
  const call = tile(callX0, callY, callW, 'transfer_funds(to=internal-acct)', LOOK.tile, s.price - 0.2, s.end - 0.5);
  const [ex0, edY] = at(0.455, 0.47);
  const [ex1] = at(0.93, 0.47);
  const eW = (ex1 - ex0 - 4 * 2.2) / 5;
  const edX = EDITS.map((_, k) => ex0 + k * (eW + 2.2));
  const card = (k: number, look: Look, dy = 0) => rect(edX[k] + eW / 2, edY + dy, eW, 7, look, {r: 1.6});
  const cardBase: Look = {h: 0.17, tint: 0.97};

  // simulation: one card at a time through the copy of the monitors (times in beats.ts)
  const {simFrom, simTo, simAt, chosenAt, diagFrom, diagTo} = B;

  const cardsAt = (phase: 'fan' | 'sim' | 'chosen'): Shape[] =>
    EDITS.flatMap((e, k) => {
      if (phase === 'fan') return [card(k, k === 4 ? {h: 0.2, tint: 1.0} : cardBase)];
      if (e.fate === 'unsafe') return [card(k, {h: 0.02, tint: 0.34}, -4.5)];
      if (e.fate === 'none') return [card(k, {h: 0.04, tint: 0.5})];
      if (e.fate === 'chosen' && phase === 'chosen') return [card(k, LOOK.lit)];
      return [card(k, cardBase)];
    });


  // ---------------------------------------------------------------- beats
  const wall = (shapes: Shape[]) => b.field(shapes, ground);
  b.beat('s2-monitors', s.lift, wall(monitors()), {sweep: {origin: S.uv(mcx, (monY[0] + monY[4]) / 2), speed: 0.75, jitterS: 0.06}});
  b.beat('s2-call', s.price - 0.25, wall([...monitors(), call.shape, ...cardsAt('fan')]), {sweep: {origin: S.uv(callX0 + callW / 2, callY), speed: 0.55, jitterS: 0.05}});
  // each card's simulation: the monitors light (the precedence monitor goes red for allow)
  EDITS.forEach((e, k) => {
    if (e.fate !== 'unsafe') return;
    b.beat('s2-fall', B.fallAt, wall([...monitors(), call.shape, ...cardsAt('sim')]), {
      sweep: {kind: 'linear', origin: S.uv(edX[k], edY + 4), direction: [0, -1], speed: 0.4, jitterS: 0.03, tintFollowsWave: true},
    });
  });
  b.beat('s2-chosen', chosenAt, wall([...monitors(), call.shape, ...cardsAt('chosen')]), {sweep: {origin: S.uv(edX[1] + eW / 2, edY), speed: 0.6, jitterS: 0.04, tintFollowsWave: true}});
  b.ripple(chosenAt + 0.05, edX[1] + eW / 2, edY, {amp: 0.3});
  const flat = (x: Shape): Shape => ({...x, look: {h: 0.02, tint: 0.62}} as Shape);
  b.beat('s2-under', diagFrom - 0.35, wall([...monitors(), call.shape, ...cardsAt('chosen')].map(flat)), {sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.5, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s2-kept', diagTo - 0.25, wall([card(1, LOOK.lit)]), {sweep: {origin: S.uv(edX[1] + eW / 2, edY), speed: 0.7, jitterS: 0.03, tintFollowsWave: true}});

  // the copy of the monitors lighting as each candidate passes through it
  const flashShapes = (red: boolean): Shape[] =>
    RULES.map((_, k) => plate(k, red && k === 4 ? {h: 0.16, tint: PIN.redPaint, paint: 0.85} : {h: 0.16, tint: PIN.mint, glow: 0.55}));
  const flashMint = shapesLive(S, flashShapes(false));
  const flashRed = shapesLive(S, flashShapes(true));
  const sim: LiveLayer = {
    fn: (u, v, _i, t) => {
      for (let k = 0; k < EDITS.length; k++) {
        if (EDITS[k].fate === 'none') continue;
        const d = t - simAt[k];
        if (d >= 0 && d < 0.5) return EDITS[k].fate === 'unsafe' ? flashRed(u, v) : flashMint(u, v);
      }
      return null;
    },
    from: simFrom - 0.1,
    to: simTo + 0.4,
    fadeS: 0.08,
    region: shapesRegion(S, flashShapes(false), 1),
  };
  b.live.push(sim);

  // ---------------------------------------------------------------- camera and light
  b.move(s.lift - 0.2, 1.6, P2);
  b.move(s.start + 1.4, Math.max(2, s.noSafe - s.start - 2), pushIn(P2, 0.05), 'inOutSine');
  // the wall steps back behind the code and the diagram
  b.light.push({at: s.noSafe - 0.3, dur: 1.0, key: 0.62});
  b.light.push({at: s.end - 1.0, dur: 1.0, key: 1.0});

  // ---------------------------------------------------------------- overlays
  const ruleLabels: WallText[] = RULES.map((r, k) => ({text: r, X: mcx, Y: monY[k], h: 0.13, at: s.plates - 0.2 + k * 0.12, exitAt: s.noSafe - 0.4}));
  const editLabels: WallText[] = EDITS.flatMap((e, k) => {
    const X = edX[k] + eW / 2;
    const first = s.price + k * 0.14;
    const items: WallText[] = [
      {text: e.kind, X, Y: edY + 1.4, h: 0.17, at: first, exitAt: s.noSafe - 0.4},
      {text: e.cost, X, Y: edY - 1.7, h: 0.17, at: first + 0.1, exitAt: s.noSafe - 0.4, mono: false, weight: 700, sizeH: 0.034, color: k === 4 ? '#FFFFFF' : color.text.display},
    ];
    const verdictAt = simAt[k] + 0.35;
    if (e.fate === 'unsafe') items.push({text: 'unsafe', X, Y: edY - 9.2, at: verdictAt, exitAt: s.noSafe - 0.4, color: color.text.chipDim});
    if (e.fate === 'none') items.push({text: 'not enactable', X, Y: edY - 6, at: simAt[k], exitAt: s.noSafe - 0.4, color: color.text.tertiary});
    if (e.fate === 'safe') items.push({text: 'safe', X, Y: edY - 6, at: verdictAt, exitAt: s.noSafe - 0.4, color: color.text.chipDim});
    if (e.fate === 'chosen') items.push({text: 'safe · cheapest', X, Y: edY - 6, at: chosenAt, exitAt: s.noSafe - 0.4, color: color.accent.mint});
    return items;
  });
  const callLabel: WallText = {...call.label, exitAt: s.noSafe - 0.4};

  const pages: CodePage[] = [
    {
      at: s.noSafe - 0.3,
      source: {snippet: snippets['reins-shield'], lines: [107, 125]},
      view: 107,
      rows: 13,
      zoom: 0.88,
      header: {label: 'reins', path: 'reinskit/shield.py', meta: '6f0cf55'},
      cues: [
        cue.reveal(s.noSafe - 0.2, {stagger: 0.035}),
        cue.scroll(s.noSafe + 0.35, [113, 125], {dur: 0.9, align: 'top'}),
        cue.highlight(s.noSafe + 0.5, 114, {until: s.noSafe + 1.6}),
        cue.highlight(s.noSafe + 1.6, 118, {until: s.failed - 0.35}),
        cue.highlight(s.failed - 0.3, [120, 125]),
        cue.annotate(s.failed - 0.15, 122, 'said, *not hidden*', {match: 'enforcement_failed = True', side: 'end'}),
      ],
    },
  ];

  const cites: CiteSpec[] = [
    {repo: R, path: 'experiments/_common.py', line: '41-48', at: s.plates + 0.4, exitAt: s.plates + 4.6, slot: 0},
    {repo: R, path: 'reinskit/enact.py', line: '1-31', at: s.declares + 0.3, exitAt: s.human + 1.2, slot: 0},
    {repo: R, path: 'reinskit/enact.py', line: '53-57', at: s.price + 0.4, exitAt: s.every - 0.2, slot: 0},
    {repo: R, path: 'reinskit/shield.py', line: '107-125', at: s.simulates + 0.2, exitAt: s.noSafe - 0.5, slot: 0},
    {repo: R, path: 'results/systems.json', line: 8, at: s.simulates + 0.5, exitAt: s.noSafe - 0.5, slot: 1},
  ];

  const capRows: Array<[string, string, number]> = [
    ['insert', 'audit_log(), authorize()', s.insert],
    ['substitute', 'delete_all → archive()', s.swap],
    ['suppress', 'any call becomes noop()', s.suppress],
    ['defer', 'a human decides (escalation)', s.human],
  ];

  b.overlay('s2', s.start - 0.6, s.end + 0.1, (t) => {
    const H = b.H;
    const W = b.W;
    const monK = pull(t, s.plates - 0.2, s.noSafe - 0.4);
    const copyK = pull(t, s.copy - 0.1, s.noSafe - 0.4);
    return (
      <>
        {monK > 0 ? (
          <PathKicker t={t} at={s.plates - 0.2} exitAt={s.noSafe - 0.4} text={copyK > 0.5 ? 'simulate() on a copy of the monitors' : 'the policy · five monitors'} y={b.lens.at(t, mx0, monY[0] + 6.4)[1] - 0.012 * H} x={b.lens.at(t, mx0, monY[0] + 6.4)[0]} />
        ) : null}
        <WallLabels t={t} lens={b.lens} items={[...ruleLabels, callLabel, ...editLabels]} />
        {/* what the deployment can enact */}
        <GlassCard x={Math.round(0.52 * W)} y={Math.round(0.17 * H)} width={Math.round(0.41 * W)} label="capabilities · what this deployment can enact" t={t} at={s.declares - 0.1} exitAt={s.price - 0.45}>
          <div style={{display: 'flex', flexDirection: 'column', gap: Math.round(0.012 * H), marginTop: Math.round(0.02 * H)}}>
            {capRows.map(([k, v, a]) => {
              const kk = pull(t, a - 0.08, undefined, 0.3);
              return (
                <div key={k} style={{display: 'flex', gap: Math.round(0.015 * H), alignItems: 'baseline', opacity: kk, transform: `translateY(${((1 - kk) * 0.01 * H).toFixed(1)}px)`}}>
                  <span style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: color.accent.mint, minWidth: Math.round(0.15 * H)}}>{k}</span>
                  <span style={{fontFamily: font.mono, fontSize: Math.round(0.024 * H), color: color.text.caption}}>{v}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
        <Tag t={t} at={s.price + 0.9} exitAt={s.every - 0.2} text="a human costs the most" x={Math.round(0.93 * W)} y={b.lens.at(t, edX[4] + eW / 2, edY + 5.6)[1] - 0.022 * H} align="right" />
        <CodePanel pages={pages} x={Math.round(0.07 * W)} y={Math.round(0.1 * H)} anchor="top-left" t={t} enter={{at: s.noSafe - 0.3, dur: 0.6}} exit={{at: diagFrom - 0.4, dur: 0.45}} />
        <Tag t={t} at={s.failed + 0.2} exitAt={diagFrom - 0.4} text="no safe edit → enforcement_failed (said, not hidden)" x={Math.round(0.07 * W)} y={Math.round(0.668 * H)} />
        <Tag t={t} at={s.noSafe + 0.6} exitAt={s.failed + 0.1} text="simulate every candidate · keep the safe ones · take the cheapest" x={Math.round(0.07 * W)} y={Math.round(0.668 * H)} />
        {t >= diagFrom - 0.2 && t < diagTo + 0.6 ? (
          <>
            <Scrim from={0} to={1} maxAlpha={0.45 * pull(t, diagFrom - 0.2, diagTo - 0.3, 0.6, 0.6)} edge="top" />
            <ArchDiagram
              layout={LAYOUT}
              time={t}
              build={{at: diagFrom, span: 1.6}}
              packets={[
                {path: LAYOUT.paths?.call ?? [], at: diagFrom + 1.9, speed: 650, dwell: 0.2},
                {path: LAYOUT.paths?.audit ?? [], at: Math.max(diagFrom + 4.4, (diagFrom + diagTo) / 2 - 0.2), speed: 650, dwell: 0.2},
              ]}
              camera={[
                {at: diagFrom, target: 'all', zoom: 1.0, pitch: 6, yaw: -2, safe: DIAG_SAFE},
                {at: diagFrom + 2.3, target: ['engine', 'enact', 'guard', 'shield'], zoom: 0.92, pitch: 3, yaw: -1, ease: 'camera', safe: DIAG_SAFE},
                {at: Math.max(diagFrom + 4.6, (diagFrom + diagTo) / 2), target: ['engine', 'ledger', 'verify', 'shield'], zoom: 0.92, pitch: 2, yaw: 1, ease: 'camera', safe: DIAG_SAFE},
              ]}
              edgeLabels="all"
              exit={{at: diagTo - 0.4, dur: 0.5}}
            />
            <PathKicker t={t} at={diagFrom + 0.2} exitAt={diagTo - 0.4} text="reinskit · every arrow is a call site in the code" y={Math.round(0.1 * H)} />
          </>
        ) : null}
        <Cites t={t} items={cites} />
      </>
    );
  });

  // ---------------------------------------------------------------- Pixie
  b.cue(s.simulates - 0.2, 'thinking', 'Planning the fix… (about 9 candidate edits)');

  return {P2, edX, eW, edY};
};
