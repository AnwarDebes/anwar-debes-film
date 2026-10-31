import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import type {FieldFn} from '../../../engine/pins';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {GlassCard} from '../../../engine/type';
import {color, font} from '../../../engine/tokens';
import {snippets} from '../../../data/ch08/code';
import {LUCID_PYTEST} from '../../../data/ch08/captures/lucidPytest';
import type {Builder} from '../ch06/kit/builder';
import {Cites, PathKicker, Tag, WallLabels, pull, type CiteSpec, type WallText} from '../ch06/kit/overlays';
import {PIN, disc, rect, seg, type Shape} from '../ch06/kit/shapes';
import {Terminal} from '../ch06/kit/Terminal';
import type {Times08} from './times';
import type {Beats08} from './beats';

// 08.4 the scoreboard (one of the film's four hard truths: LUCID scores below random, and the
// paper says so), the README's random row corrected by its own results file; 08.5 the unit test
// run on camera from a fresh clone, and the scoring script's stricter recount.

const LUCID = 'lucid';
/** The 25 public games in the order of results/run_lucid.jsonl. */
const GAMES = ['SP80', 'CD82', 'AR25', 'RE86', 'LP85', 'SC25', 'SB26', 'S5I5', 'TN36', 'SU15', 'CN04', 'TR87', 'R11L', 'WA30', 'LF52', 'VC33', 'SK48', 'LS20', 'DC22', 'BP35', 'M0R0', 'FT09', 'G50T', 'KA59', 'TU93'];

export const buildScore = (b: Builder, T: Times08, B: Beats08, ground: FieldFn) => {
  const {S} = b;
  const s4 = T.s4;
  const s5 = T.s5;
  const P9 = frameOn(b.ctx.board, {uv: S.uv(88, S.ext / 2), pinsAcross: 150, yaw: 0.08, pitch: 0.06, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P9, fx, fy);
  const wall = (shapes: Shape[]) => b.field(shapes, ground);

  // ---------------------------------------------------------------- 25 games, two levels, no wins
  const [g0, gy] = at(0.08, 0.585);
  const [g1] = at(0.48, 0.585);
  const gp = (g1 - g0) / 24;
  const games = (lit: boolean): Shape[] =>
    GAMES.map((name, k) => {
      const level = name === 'LP85' || name === 'VC33';
      return rect(g0 + k * gp, gy, gp - 0.7, 2.4, level && lit ? {h: 0.26, tint: 1.0} : {h: 0.06, tint: 0.52}, {r: 0.5});
    });

  // ---------------------------------------------------------------- the scoreboard: 0.1 % = 24 pitches
  const [bx0, bBase] = at(0.56, 0.55);
  const [bx1] = at(0.9, 0.55);
  const bw = (bx1 - bx0) / 4;
  const scale = 24 / 0.1;
  const top = at(0.56, 0.02)[1];
  const bar = (k: number, v: number, look: {h: number; tint: number | [number, number, number]; glow?: number; paint?: number}): Shape => {
    const h = Math.min(top - bBase, v * scale);
    return rect(bx0 + (k + 0.5) * bw, bBase + h / 2, bw - 3.2, h, look, {r: 0.8});
  };
  const tracks: Shape[] = [0, 1, 2, 3].map((k) => rect(bx0 + (k + 0.5) * bw, bBase + (top - bBase) / 2, bw - 3.2, top - bBase, {h: 0.02, tint: 0.46}, {r: 0.8}));
  const lucidBar = bar(0, 0.0832, {h: 0.22, tint: 1.0});
  const randomBar = bar(1, 0.0946, {h: 0.22, tint: 0.9});
  const frontierBar = bar(2, 0.37, {h: 0.18, tint: 0.85});
  const peopleBar = bar(3, 100, {h: 0.18, tint: 0.85});
  const lucidTop = bBase + 0.0832 * scale;
  const gapLine = seg(bx0 + 1.4, lucidTop, bx0 + 2 * bw - 1.4, lucidTop, 0.55, {h: 0.26, tint: PIN.redPaint, paint: 0.9});

  // ---------------------------------------------------------------- 89 deaths: 82 at distinct signatures, 7 repeats
  const [dx0, dy0] = at(0.085, 0.26);
  const deaths: Shape[] = [...Array(89).keys()].map((k) => {
    const [x, y] = S.snap(dx0 + (k % 30) * 1.95, dy0 - Math.floor(k / 30) * 2.6);
    return k >= 82 ? disc(x, y, 0.45, {h: 0.16, tint: 0.4}, {soft: 0.2}) : disc(x, y, 0.45, {h: 0.16, tint: 0.95}, {soft: 0.2});
  });

  // ---------------------------------------------------------------- beats
  b.beat('s4-games', B.gamesAt, wall([...games(false)]), {sweep: {kind: 'linear', origin: S.uv(g0 - 2, gy), direction: [1, 0], speed: 0.45, jitterS: 0.015, tintFollowsWave: true}});
  b.beat('s4-levels', s4.two - 0.1, wall([...games(true)]), {sweep: {origin: S.uv(g0 + 4 * gp, gy), speed: 0.5, jitterS: 0.02}});
  b.beat('s4-lucid', B.lucidAt, wall([...games(true), ...tracks, lucidBar]), {sweep: {kind: 'linear', origin: S.uv(bx0, bBase), direction: [0, 1], speed: 0.3, jitterS: 0.015}});
  b.beat('s4-random', B.randomAt, wall([...games(true), ...tracks, lucidBar, randomBar, gapLine]), {sweep: {kind: 'linear', origin: S.uv(bx0 + bw, bBase), direction: [0, 1], speed: 0.28, jitterS: 0.015}});
  b.beat('s4-frontier', B.frontierAt, wall([...games(true), ...tracks, lucidBar, randomBar, gapLine, frontierBar, peopleBar]), {sweep: {kind: 'linear', origin: S.uv(bx0 + 2 * bw, bBase), direction: [0, 1], speed: 0.5, jitterS: 0.015}});
  b.beat('s4-deaths', B.deathsAt, wall([...games(true), ...tracks, lucidBar, randomBar, gapLine, frontierBar, peopleBar, ...deaths]), {sweep: {kind: 'linear', origin: S.uv(dx0, dy0), direction: [1, 0], speed: 0.4, jitterS: 0.015, tintFollowsWave: true}});
  // 08.5: the wall steps back behind the terminal and the code
  b.beat('s5-dim', s5.start - 0.3, wall([...games(true), ...tracks, lucidBar, randomBar, frontierBar, peopleBar].map((x) => ({...x, look: {...x.look, tint: 0.55, glow: 0, paint: 0}}) as Shape)), {tintTauS: 0.5});

  // ---------------------------------------------------------------- camera and light
  b.move(s4.start - 0.4, 1.4, P9);
  b.move(s4.start + 1.0, s4.end - s4.start - 1.4, pushIn(P9, 0.05), 'inOutSine');
  b.move(s5.start - 0.3, 1.0, P9);
  b.light.push({at: s5.start - 0.3, dur: 0.8, key: 0.6});
  b.light.push({at: s5.end - 0.8, dur: 0.8, key: 1.0});

  // ---------------------------------------------------------------- overlays
  const W = b.W;
  const H = b.H;
  const out4 = s4.end - 0.45;
  const gameLabels: WallText[] = [
    {text: 'LP85 L1', X: g0 + 4 * gp, Y: gy + 3.2, h: 0.26, at: s4.two, exitAt: out4, color: color.text.caption},
    {text: 'VC33 L1', X: g0 + 15 * gp, Y: gy + 3.2, h: 0.26, at: s4.two + 0.1, exitAt: out4, color: color.text.caption},
    {text: '25 games · 2 levels · 0 wins', X: g0 - 0.5, Y: gy + 6.6, at: s4.games, exitAt: out4, align: 'left', color: color.text.chipDim},
  ];
  const barNames = ['LUCID', 'random', 'frontier best', 'people'];
  const barLabels: WallText[] = [
    ...barNames.map((n, k): WallText => ({text: n, X: bx0 + (k + 0.5) * bw, Y: bBase - 3.0, at: k === 0 ? B.lucidAt : k === 1 ? B.randomAt : B.frontierAt, exitAt: out4, color: color.text.chipDim})),
    {text: '0.083%', X: bx0 + 0.5 * bw, Y: lucidTop + 3.0, h: 0.22, at: s4.zero83, exitAt: out4, mono: false, weight: 700, sizeH: 0.032},
    {text: '0.095%', X: bx0 + 1.5 * bw, Y: bBase + 0.0946 * scale + 3.0, h: 0.22, at: s4.zero95, exitAt: out4, mono: false, weight: 700, sizeH: 0.032},
    {text: '0.37% ↑', X: bx0 + 2.5 * bw, Y: top - 4, h: 0.18, at: B.frontierAt + 0.3, exitAt: out4, mono: false, weight: 700, sizeH: 0.03},
    {text: '100% ↑', X: bx0 + 3.5 * bw, Y: top - 4, h: 0.18, at: B.frontierAt + 0.5, exitAt: out4, mono: false, weight: 700, sizeH: 0.03},
    {text: '(cited)', X: bx0 + 2.5 * bw, Y: top - 7.6, h: 0.18, at: B.frontierAt + 0.4, exitAt: out4, color: color.text.chipDim, pill: true},
    {text: '(off frame)', X: bx0 + 3.5 * bw, Y: top - 7.6, h: 0.18, at: B.frontierAt + 0.6, exitAt: out4, color: color.text.chipDim, pill: true},
  ];
  const deathLabels: WallText[] = [
    {text: '89 deaths · 82 at distinct signatures · 7 repeats under a drifted hash', X: dx0 - 0.4, Y: dy0 + 3.2, at: B.deathsAt + 0.3, exitAt: out4, align: 'left', color: color.text.caption},
  ];
  const s4Cites: CiteSpec[] = [
    {repo: LUCID, path: 'results/scores.json', line: '6-10', at: s4.games + 0.3, exitAt: s4.random - 0.1, slot: 0},
    {repo: LUCID, path: 'paper/_numbers.tex', line: '2, 8', at: s4.zero83, exitAt: s4.plainly + 0.1, slot: 1},
    {repo: LUCID, path: 'results/scores.json', line: '1417-1421', at: s4.random + 0.2, exitAt: s4.readme - 0.1, slot: 0},
    {repo: LUCID, path: 'paper/_results.tex', line: 2, at: s4.plainly + 0.3, exitAt: s4.readme - 0.1, slot: 1},
    {repo: LUCID, path: 'README.md', line: '87-88 (contradicted)', at: s4.readme + 0.3, exitAt: s4.seven - 0.1, slot: 0},
    {repo: LUCID, path: 'paper/_numbers.tex', line: '11, 16-17', at: s4.seven + 0.3, exitAt: s4.lastWord + 0.3, slot: 0},
    {repo: LUCID, path: 'paper/_results.tex', line: 14, at: s4.different - 0.2, exitAt: out4, slot: 1},
    {repo: LUCID, path: 'paper/_results.tex', line: 13, at: s4.lastWord + 0.4, exitAt: out4, slot: 0},
  ];
  const strike = (t: number, a: number) => {
    const k = Math.max(0, Math.min(1, (t - a) / 0.45));
    return k;
  };
  b.overlay('s4', s4.start - 0.4, s4.end + 0.1, (t) => {
    const red = pull(t, B.randomAt + 0.5, out4);
    const k1 = strike(t, B.strikeAt);
    const k2 = strike(t, B.strikeAt + 0.35);
    return (
      <>
        <PathKicker t={t} at={s4.start - 0.2} exitAt={out4} text="lucid/results/scores.json · the public games" y={Math.round(0.072 * H)} />
        <WallLabels t={t} lens={b.lens} items={[...gameLabels, ...barLabels, ...deathLabels]} />
        {red > 0 ? (
          <div style={{position: 'absolute', left: Math.round(0.07 * W), top: Math.round(0.45 * H), opacity: red, fontFamily: font.mono, fontSize: Math.round(0.026 * H), color: color.signal.verdictRed, whiteSpace: 'nowrap'}}>
            random 0.095% &gt; LUCID 0.083%
          </div>
        ) : null}
        <GlassCard x={Math.round(0.07 * W)} y={Math.round(0.135 * H)} width={Math.round(0.42 * W)} label="lucid/README.md · the random column" t={t} at={s4.readme - 0.1} exitAt={B.deathsAt - 0.2}>
          {[
            ['levels completed', '~0 (defeated by design)', '1 level (FT09)', k1],
            ['public-set RHAE', '~0%', '0.0946%', k2],
          ].map(([a, bad, good, k]) => (
            <div key={a as string} style={{marginTop: Math.round(0.016 * H), fontFamily: font.mono, fontSize: Math.round(0.024 * H), whiteSpace: 'nowrap'}}>
              <div style={{color: color.text.chipDim, fontSize: Math.round(0.022 * H)}}>{a}</div>
              <span style={{position: 'relative', color: color.text.caption}}>
                {bad}
                <span style={{position: 'absolute', left: 0, top: '52%', height: Math.max(2, Math.round(0.003 * H)), width: `${((k as number) * 100).toFixed(1)}%`, background: color.pixie.body}} />
              </span>
              <span style={{color: color.accent.mint, opacity: k as number, marginLeft: Math.round(0.018 * H)}}>→ {good}</span>
            </div>
          ))}
          <div style={{marginTop: Math.round(0.016 * H), fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.tertiary, opacity: k2}}>the results file says otherwise</div>
        </GlassCard>
        <Tag t={t} at={s4.lastWord + 0.4} exitAt={out4} text="random: 200 actions per game · LUCID: 300" x={Math.round(0.07 * W)} y={Math.round(0.4 * H)} />
        <Cites t={t} items={s4Cites} />
      </>
    );
  });

  // 08.5
  const pages: CodePage[] = [
    {
      at: s5.start,
      source: {snippet: snippets['lucid-test'], lines: [23, 32]},
      dedent: true,
      zoom: 0.88,
      header: {label: 'lucid', path: 'tests/test_agent.py', meta: 'the shield'},
      cues: [
        cue.reveal(s5.start + 0.1, {stagger: 0.04}),
        cue.highlight(s5.never - 0.1, [30, 32]),
        cue.annotate(s5.never + 0.1, 30, 'six more act() calls from the *same* frame', {match: 'for _ in range(6):', side: 'end'}),
      ],
    },
    {
      at: s5.script - 0.2,
      source: {snippet: snippets['lucid-scores'], lines: [37, 40]},
      dedent: true,
      zoom: 0.88,
      header: {label: 'lucid', path: 'scripts/compute_scores.py', meta: 'env_score'},
      cues: [cue.highlight(s5.recounts - 0.1, [38, 39])],
    },
  ];
  const s5Cites: CiteSpec[] = [
    {repo: LUCID, path: 'tests/test_agent.py', line: '23-32', at: s5.test, exitAt: s5.script - 0.2, y: Math.round(0.735 * b.H)},
    {repo: LUCID, path: 'scripts/compute_scores.py', line: '27-45', at: s5.script, exitAt: s5.end - 0.4, slot: 0},
    {repo: LUCID, path: 'scripts/compute_scores.py', line: '68-71', at: s5.strictly, exitAt: s5.end - 0.4, slot: 1},
    {repo: LUCID, path: 'results/scores.json', line: '82-88', at: s5.strictly + 0.3, exitAt: s5.end - 0.4, slot: 2},
  ];
  b.overlay('s5', s5.start - 0.3, s5.end + 0.1, (t) => (
    <>
      <Terminal
        t={t}
        at={s5.runs - 0.4}
        exitAt={s5.end - 0.4}
        schedule={B.term}
        title={`lucid · fresh clone @ ${LUCID_PYTEST.short} · 29 Oct 2026 · output as printed`}
        x={Math.round(0.07 * W)}
        y={Math.round(0.075 * H)}
        width={Math.round(0.64 * W)}
        rows={3}
        pass={(l) => /^\d+ passed/.test(l)}
      />
      <CodePanel pages={pages} x={Math.round(0.07 * W)} y={Math.round(0.275 * H)} anchor="top-left" t={t} enter={{at: s5.start, dur: 0.5}} exit={{at: s5.end - 0.4, dur: 0.4}} />
      <Tag t={t} at={s5.recounts} exitAt={s5.end - 0.4} text="s = min(1, human ÷ ai)² · all exploration charged to the level" x={Math.round(0.07 * W)} y={Math.round(0.52 * H)} />
      <Tag t={t} at={s5.strictly + 0.2} exitAt={s5.end - 0.4} text="VC33 level 1: server 25% · own recount 0.012" x={Math.round(0.07 * W)} y={Math.round(0.58 * H)} border="rgba(116,201,174,0.4)" tone={color.accent.mintLabel} />
      <Cites t={t} items={s5Cites} />
    </>
  ));

  // ---------------------------------------------------------------- Pixie
  b.cue(s4.start + 0.1, 'reading', 'Read results/scores.json');
  b.cue(B.randomAt + 0.35, 'error', 'random 0.095% > LUCID 0.083%');
  b.cue(B.strikeAt - 0.15, 'writing', 'Edit README row: Random ~0 → 0.0946%');
  b.cue(s5.runs, 'debugging', 'Run pytest tests/test_agent.py');
  b.cue(B.passAt, 'success', 'as printed by pytest');

  return {P9};
};
