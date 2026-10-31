import React from 'react';
import {hash01, seedOf, SWEEPS, type Beat, type FieldFn} from '../../../engine/pins';
import {pushIn} from '../../../engine/camera';
import {color} from '../../../engine/tokens';
import {Sparks} from '../../../engine/fx';
import type {Env} from './env';
import type {Times09} from './times';
import {chip, frame, move, plate} from './common';
import {Card, MONO, Row, SERIF, SANS, Tag, fade, mint, screenOf} from './kit/ui';
import {Pic, picField, uvOf, wallPoint, type Look} from './kit/pic';
import type {AxisBracket, AxisMark} from './axis';

const NODE: Look = {h: 0.5, tint: 1.04};
const FAINT: Look = {h: 0.06, tint: 0.76};
const HARD: Look = {h: 0.46, tint: 1.0};
const LIT: Look = {h: 0.62, tint: 1.06, glow: 0.55};

/** Deterministic stand-in weights for the schematic: nearer tokens weigh more, with seeded variation. */
const weight = (i: number, j: number) => Math.exp(-Math.abs(i - j) / 2.6) * (0.45 + hash01(seedOf('c09-attn'), i * 31 + j));
const REACH = 4;
const top5 = (i: number, n: number) =>
  Array.from({length: n}, (_, j) => j)
    .filter((j) => j !== i && Math.abs(i - j) <= REACH)
    .sort((a, b) => weight(i, b) - weight(i, a))
    .slice(0, 5);

export const sceneB = (env: Env, T: Times09, prev: {subDeps: FieldFn; su: number; sv: number}, marks: AxisMark[], brackets: AxisBracket[]) => {
  const {board: b, base, W, H} = env;
  const {attn: A, dec: D, rob: R} = T;
  const beat = (x: Beat) => env.beats.push(x);
  const relief = 22 * b.p;
  const scratch = {target: [0, 0, 0] as [number, number, number], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};

  // ------------------------------------------------------------------ 09.3 attention arcs
  const N = 10;
  const SP = 8;
  const [au, av] = env.at(0.665, 0.4);
  const tx = (k: number) => (k - (N - 1) / 2) * SP;
  const arc = (pic: Pic, i: number, j: number, look: Look, hw: number) => {
    const a = Math.min(i, j);
    const c = Math.max(i, j);
    pic.arc(tx(a), 2.4, tx(c), 2.4, (tx(c) - tx(a)) * 0.3, hw, look, 0.5, 'max');
  };
  const FOCUS = 4;
  const picOf = (mode: 'faint' | 'focus' | 'all', bert: boolean) => {
    const pic = new Pic();
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        if (j - i > REACH) continue;
        const inFocus = i === FOCUS || j === FOCUS;
        const hard = top5(i, N).includes(j) || top5(j, N).includes(i);
        if (mode === 'faint' || (mode === 'focus' && !inFocus)) arc(pic, i, j, FAINT, 0.3);
        else if (mode === 'focus') {
          const other = i === FOCUS ? j : i;
          if (top5(FOCUS, N).includes(other)) arc(pic, i, j, LIT, 0.6);
        } else if (hard) arc(pic, i, j, HARD, 0.5);
      }
    for (let k = 0; k < N; k++) pic.seg(tx(k), 0, tx(k + 1 < N ? k + 1 : k), 0, 0.4, {h: 0.16, tint: 0.84});
    for (let k = 0; k < N; k++) pic.disc(tx(k), 0, 2.1, NODE, 0.5);
    if (bert) pic.rect(0, 18.5, 48, 9, {h: 0.78, tint: 0.34}, 1.4, 0.5);
    return pic;
  };
  const attnFaint = picField(b, picOf('faint', true), au, av);
  const attnFocus = picField(b, picOf('focus', true), au, av);
  const attnAll = picField(b, picOf('all', true), au, av);
  const attnStudent = picField(b, picOf('all', false), au, av);
  // on the beat, the dependency arcs morph into attention arcs (in place)
  beat({id: 'c09-attn-faint', at: A.morph, field: attnFaint, sweep: {origin: [prev.su, prev.sv], speed: 0.7, jitterS: 0.06, tintFollowsWave: true}});
  beat({id: 'c09-attn-focus', at: A.focus, field: attnFocus, sweep: {origin: uvOf(b, au, av, tx(FOCUS), 0), speed: 0.45, jitterS: 0.03}});
  beat({id: 'c09-attn-all', at: A.all, field: attnAll, sweep: {...SWEEPS.raster([1, 0], 0.55), origin: [uvOf(b, au, av, tx(0), 0)[0], av]}});
  // BERT itself is thrown away: the block dissolves and leaves only the Boolean graph
  beat({id: 'c09-attn-student', at: A.dissolve, field: attnStudent, sweep: {...SWEEPS.dissolve(0.8)}});
  const blockCentre = uvOf(b, au, av, 0, 18.5);
  const sparkSrc = Array.from({length: 18}, (_, k) => {
    const [u, v] = uvOf(b, au, av, -20 + (k % 6) * 8, 15.5 + Math.floor(k / 6) * 3);
    return {position: wallPoint(b, u, v, 0.8), from: A.dissolve, to: A.dissolve + 0.9};
  });
  env.world.push({
    id: 'c09-attn-sparks',
    from: A.dissolve - 0.1,
    to: A.dissolve + 3.2,
    render: () => (
      <Sparks sources={sparkSrc} mode="burst" count={220} life={[0.9, 2.0]} speed={0.05} spread={0.9} rise={[0, 0.02, 0.012]} drag={1.2} flutter={0.004} size={[0.0012, 0.0024]} colors={['#E4EAE7', '#9FD9C6']} intensity={1.6} seed={9} />
    ),
  });
  move(env, A.morph, A.dissolve - A.morph, pushIn(frame(env, [au, av], 150, [0.665, 0.4]), 0.04), 'inOutSine');
  move(env, A.dissolve, 2.0, frame(env, [au, av], 150, [0.665, 0.4]));

  plate(env, 'c09-attn-plate', 'attention-distilled-graphtm', 'RESEARCH PROTOTYPE · PAPER IN PREPARATION', A.plate, T.S4.start + 0.2);
  env.cue(A.plate - 0.2, 'reading', 'Read experiments/train_paper_b_attention_distill.py');
  env.cue(A.bar - 0.3, 'reading', 'Read results/paper_b_R8_5seeds.json');
  env.overlays.push({
    id: 'c09-attn-labels',
    from: A.morph,
    to: T.S4.start,
    render: (t) => {
      const [bu, bv] = blockCentre;
      const [x, y] = screenOf(env.camera, t, wallPoint(b, bu, bv, 0.8), W, H, scratch);
      const gone = 1 - fade(t, A.dissolve - 0.05, undefined, 0.35);
      const [fu, fv] = uvOf(b, au, av, tx(FOCUS), -4.6);
      const [fx, fy] = screenOf(env.camera, t, wallPoint(b, fu, fv, 0.1), W, H, scratch);
      const [ru, rv] = uvOf(b, au, av, tx(N - 1) + 3, -9.8);
      const [rx, ry] = screenOf(env.camera, t, wallPoint(b, ru, rv, 0.1), W, H, scratch);
      return (
        <>
          <Tag x={x} y={y} text="BERT" sizeH={0.036} family={SANS} weight={700} opacity={fade(t, A.bert, undefined, 0.4) * gone} colorText={color.text.display} />
          <Tag x={fx} y={fy} text="top 5 for this token" sizeH={0.022} colorText={mint} opacity={fade(t, A.focus + 0.2, A.all - 0.1, 0.3, 0.3)} />
          <Tag x={rx} y={ry} text="illustration · the rule, not BERT's weights" sizeH={0.022} colorText={color.text.tertiary} align="right" opacity={fade(t, A.morph + 0.6, T.S4.start - 0.5, 0.4, 0.4)} />
        </>
      );
    },
  });
  env.overlays.push({
    id: 'c09-attn-card',
    from: A.focus - 0.2,
    to: T.S4.start + 0.2,
    render: (t) => (
      <Card t={t} at={A.focus - 0.2} exitAt={T.S4.start - 0.4} x={0.069 * W} y={0.24 * H} width={0.31 * W} kicker="the graph, as the code builds it">
        <div style={{fontFamily: SANS, fontSize: Math.round(0.03 * H), color: color.text.display, lineHeight: 1.3}}>
          top-5 attention links per token <span style={{color: mint}}>→</span> edges
        </div>
        <div style={{fontFamily: SANS, fontSize: Math.round(0.03 * H), color: color.text.display, lineHeight: 1.3, opacity: fade(t, A.dissolve, undefined, 0.4)}}>
          then BERT is <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.034 * H)}}>discarded</span>
        </div>
        <div style={{marginTop: Math.round(0.016 * H), opacity: fade(t, A.bar + 0.1, undefined, 0.4)}}>
          <Row t={t} at={A.bar + 0.1} kind="win" sizeH={0.025}>
            {'R8 94.77 ± 0.23 · 5 seeds'}
          </Row>
          <Row t={t} at={A.note} kind="steel" sizeH={0.025}>
            {'final-epoch mean 93.22 (derived)'}
          </Row>
        </div>
      </Card>
    ),
  });
  marks.push({id: 'paperB', at: A.bar, value: 94.77, whisker: 0.23, label: '94.77 paper B', row: 1});
  chip(env, 'c09-chip-attn-code', 'attention-distilled-graphtm', 'experiments/train_paper_b_attention_distill.py', '91-113', A.focus, A.dissolve + 0.4, 0);
  chip(env, 'c09-chip-attn-k', 'attention-distilled-graphtm', 'experiments/paper_b_attn_R8/seed_42/results.json', '4, 321-325', A.all + 0.2, A.bar - 0.2, 1);
  chip(env, 'c09-chip-attn-res', 'attention-distilled-graphtm', 'results/paper_b_R8_5seeds.json', '24-25', A.bar + 0.1, T.S4.start - 0.3, 0);
  chip(env, 'c09-chip-attn-hist', 'attention-distilled-graphtm', 'experiments/paper_b_attn_R8/seed_*/results.json', 'history', A.note, T.S4.start - 0.3, 1);

  // ------------------------------------------------------------------ 09.4 dense web vs backward chain
  const [wu, wv] = env.at(0.535, 0.37);
  const [cu, cv] = env.at(0.775, 0.37);
  const webPic = () => {
    const pic = new Pic();
    const n = 10;
    const R0 = 10.5;
    const p = Array.from({length: n}, (_, k) => [Math.cos((k / n) * Math.PI * 2 + 0.3) * R0, Math.sin((k / n) * Math.PI * 2 + 0.3) * R0 * 0.92] as [number, number]);
    // about 7 neighbours each, mostly symmetric: the dense web
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.min(j - i, n - (j - i));
        if (d <= 3 || hash01(seedOf('c09-web'), i * 17 + j) < 0.25) pic.seg(p[i][0], p[i][1], p[j][0], p[j][1], 0.34, {h: 0.3, tint: 0.92}, 0.45, 'max');
      }
    for (const [x, y] of p) pic.disc(x, y, 1.9, NODE, 0.5);
    return pic;
  };
  const chainPic = (lit: boolean) => {
    const pic = new Pic();
    const n = 9;
    const sp = 5.4;
    const x = (k: number) => (k - (n - 1) / 2) * sp;
    if (lit) {
      for (let k = 1; k < n; k++) pic.seg(x(k), 0, x(k - 1), 0, 0.42, {h: 0.34, tint: 1.0}, 0.45, 'max');
      // a few second links back two places: average in-degree just under two
      for (let k = 2; k < n; k++) if (k % 2 === 0 || k === n - 1) pic.arc(x(k), -1.6, x(k - 2), -1.6, sp * 0.55, 0.34, {h: 0.26, tint: 0.9}, 0.45, 'max');
    }
    for (let k = 0; k < n; k++) pic.disc(x(k), 0, 1.9, NODE, 0.5);
    return pic;
  };
  const webField = picField(b, webPic(), wu, wv);
  const chainBare = picField(b, chainPic(false), cu, cv);
  const chainLit = picField(b, chainPic(true), cu, cv);
  const both = (x: FieldFn, y: FieldFn): FieldFn => (u, v, i) => (u < (wu + cu) / 2 ? x(u, v, i) : y(u, v, i));
  beat({id: 'c09-dec-split', at: D.split, field: both(webField, chainBare), sweep: {origin: [au, av], speed: 0.75, jitterS: 0.06, tintFollowsWave: true}});
  beat({id: 'c09-dec-chain', at: D.chain, field: both(webField, chainLit), sweep: {...SWEEPS.raster([-1, 0], 0.4), origin: [uvOf(b, cu, cv, 24, 0)[0], cv]}});
  move(env, D.split, 2.2, frame(env, [(wu + cu) / 2, wv], 150, [0.655, 0.385]));
  move(env, D.split + 2.3, T.S5.start - D.split - 2.6, pushIn(frame(env, [(wu + cu) / 2, wv], 150, [0.655, 0.385]), 0.035), 'inOutSine');

  plate(env, 'c09-dec-plate', 'decoder-attention-distill-graphtm', 'WORK IN PROGRESS', D.plate, T.S5.start - 0.2);
  env.cue(D.plate - 0.2, 'reading', 'Read results/master_summary.json');
  env.cue(D.bars - 0.2, 'thinking', 'Planning a significance test…');
  env.overlays.push({
    id: 'c09-dec-labels',
    from: D.split,
    to: T.S5.start,
    render: (t) => {
      const [lu, lv] = uvOf(b, wu, wv, 0, 14.4);
      const [lx, ly] = screenOf(env.camera, t, wallPoint(b, lu, lv, 0.1), W, H, scratch);
      const [ru, rv] = uvOf(b, cu, cv, 0, 14.4);
      const [rx, ry] = screenOf(env.camera, t, wallPoint(b, ru, rv, 0.1), W, H, scratch);
      const out = T.S5.start - 0.5;
      return (
        <>
          <Tag x={lx} y={ly - 0.034 * H} text="BERT · bidirectional" sizeH={0.026} family={SANS} weight={600} opacity={fade(t, D.split + 0.6, out)} />
          <Tag x={lx} y={ly} text="avg degree 6.95 · symmetry 0.46" sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, D.stats, out)} />
          <Tag x={rx} y={ry - 0.034 * H} text="Qwen2.5-1.5B · causal" sizeH={0.026} family={SANS} weight={600} opacity={fade(t, D.split + 0.8, out)} />
          <Tag x={rx} y={ry} text="avg in-degree 1.95 · symmetry 0" sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, D.stats + 0.15, out)} />
          <Tag x={(lx + rx) / 2} y={ly + 0.33 * H} text="graph statistics · the first 1,000 R8 documents" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, D.stats + 0.3, out)} />
        </>
      );
    },
  });
  env.overlays.push({
    id: 'c09-dec-card',
    from: D.bars - 0.2,
    to: T.S5.start + 0.2,
    render: (t) => (
      <Card t={t} at={D.bars - 0.2} exitAt={T.S5.start - 0.5} x={0.069 * W} y={0.225 * H} width={0.3 * W} kicker="phase-4 students · R8 · 5 seeds">
        <Row t={t} at={D.bars} kind="win" sizeH={0.025}>{'Qwen (causal)  94.53'}</Row>
        <Row t={t} at={D.bars + 0.28} kind="win" sizeH={0.025}>{'BERT           94.30'}</Row>
        <Row t={t} at={D.bars + 0.56} kind="win" sizeH={0.025}>{'DeBERTa        93.82'}</Row>
        <div style={{marginTop: Math.round(0.014 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, lineHeight: 1.4, opacity: fade(t, D.sig, undefined, 0.4)}}>
          {'Wilcoxon, Bonferroni:'}
          <br />
          {'p = 0.94 · 0.38 · 0.56'}
        </div>
        <div style={{marginTop: Math.round(0.008 * H), fontFamily: SERIF, fontStyle: 'italic', fontSize: Math.round(0.032 * H), color: mint, opacity: fade(t, D.sig + 0.25, undefined, 0.4)}}>not significant</div>
        <div style={{marginTop: Math.round(0.012 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.tertiary, lineHeight: 1.35, opacity: fade(t, D.sig + 0.8, undefined, 0.4)}}>
          {'two BERT bars, two setups:'}
          <br />
          {'94.77 (paper B) · 94.30 (phase 4)'}
        </div>
      </Card>
    ),
  });
  marks.push(
    {id: 'qwen', at: D.bars, value: 94.53, label: '94.53 Qwen', row: 0},
    {id: 'bert4', at: D.bars + 0.28, value: 94.3, label: '94.30 BERT', row: 1},
    {id: 'deberta', at: D.bars + 0.56, value: 93.82, label: '93.82 DeBERTa', row: 0},
  );
  brackets.push({id: 'p4', at: D.sig, lo: 93.82, hi: 94.53, place: 'none', label: 'not significant'});
  chip(env, 'c09-chip-dec-readme', 'decoder-attention-distill-graphtm', 'README.md', '3-8, 88', D.plate + 0.4, D.stats - 0.2, 0);
  chip(env, 'c09-chip-dec-stats', 'decoder-attention-distill-graphtm', 'results/master_summary.json', '106-121', D.stats, D.bars - 0.15, 0);
  chip(env, 'c09-chip-dec-p4', 'decoder-attention-distill-graphtm', 'results/master_summary.json', '31-45', D.bars + 0.1, D.caveatFull[0], 0);
  chip(env, 'c09-chip-dec-pv', 'decoder-attention-distill-graphtm', 'results/master_summary.json', '65, 84, 103', D.sig + 0.2, D.caveatFull[0], 1);
  chip(env, 'c09-chip-dec-ns', 'decoder-attention-distill-graphtm', 'README.md', '126-128', D.stats + 0.2, D.bars - 0.1, 1);
  chip(env, 'c09-chip-be-b', 'attention-distilled-graphtm', 'experiments/train_paper_b_attention_distill.py', '264-273', D.caveatFull[0] + 0.35, D.axisExit, 0);
  chip(env, 'c09-chip-be-c', 'decoder-attention-distill-graphtm', 'experiments/ablation_phase4_causal_vs_bi.py', 90, D.caveatFull[0] + 0.6, D.axisExit, 1);

  // ------------------------------------------------------------------ 09.5 one edited review
  const review = "I rated this a 5. The dubbing was as good as I have seen. The plot - wow. I'm not sure which made the movie more great. Jet Li is definitely a great martial artist, as good as Jackie Chan.";
  const words = review.split(' ');
  const lineMax = 46;
  const lines: string[][] = [[]];
  for (const wd of words) {
    const cur = lines[lines.length - 1];
    const len = cur.join(' ').length;
    if (len + wd.length + 1 > lineMax && cur.length) lines.push([wd]);
    else cur.push(wd);
  }
  const CH = 1.32; // pins per character
  const LP = 4.2; // pins per line
  const [ru0, rv0] = env.at(0.33, 0.215);
  const placed: Array<{w: string; x: number; y: number; len: number}> = [];
  lines.forEach((ln, r) => {
    let x = 0;
    for (const wd of ln) {
      placed.push({w: wd, x, y: -r * LP, len: wd.length * CH});
      x += (wd.length + 1) * CH;
    }
  });
  const reviewPic = new Pic().rect(lineMax * CH * 0.5, -((lines.length - 1) * LP) / 2, lineMax * CH + 5, lines.length * LP + 3, {h: 0.05, tint: 0.46}, 1.6, 0.8);
  for (const p of placed) reviewPic.seg(p.x + 0.35, p.y, p.x + p.len - 0.35, p.y, 1.05, {h: 0.12, tint: 0.6}, 0.45);
  // two bars: the TM and BERT, clean (outline) and counterfactual (solid); 50 % at the base, 100 % at the top
  const [bu, bv] = env.at(0.835, 0.6);
  const BH = 30;
  const barH = (acc: number) => ((acc - 50) / 50) * BH;
  const barsPic = (tm: number, bert: number) => {
    const pic = new Pic();
    const col = (x: number, clean: number, now: number, tint: number) => {
      pic.rect(x, barH(clean) / 2, 9, barH(clean), {h: 0.08, tint: 0.7}, 0.8, 0.5);
      pic.rect(x, barH(now) / 2, 8, barH(now), {h: 0.62, tint}, 0.8, 0.5);
    };
    col(-8, 89.98, tm, 1.02);
    col(8, 90.4, bert, 1.02);
    pic.seg(-15, -0.9, 15, -0.9, 0.35, {h: 0.12, tint: 0.85});
    return pic;
  };
  const reviewField = picField(b, reviewPic, ru0, rv0);
  const both2 = (bars: Pic): FieldFn => {
    const f = picField(b, bars, bu, bv);
    return (u, v, i) => (u > bu - 17 * b.p && v < rv0 - (lines.length * LP * b.p) / b.extH ? f(u, v, i) : reviewField(u, v, i));
  };
  beat({id: 'c09-rob-review', at: R.raster, field: reviewField, sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [ru0 - 2 * b.p, rv0]}});
  beat({id: 'c09-rob-bars', at: R.bars, field: both2(barsPic(89.98, 90.4)), sweep: {...SWEEPS.raster([0, 1], 0.55), origin: [bu, bv - 2 * b.p / b.extH]}});
  beat({id: 'c09-rob-tm', at: R.tm, field: both2(barsPic(62.91, 90.4)), sweep: {...SWEEPS.raster([0, -1], 0.2), origin: [bu, bv + (BH * b.p) / b.extH]}});
  beat({id: 'c09-rob-bert', at: R.bert, field: both2(barsPic(62.91, 88.11)), sweep: {...SWEEPS.raster([0, -1], 0.2), origin: [bu, bv + (BH * b.p) / b.extH]}});
  move(env, T.S5.start - 0.5, 2.0, base);
  move(env, T.S5.start + 1.6, R.end - T.S5.start - 1.6, pushIn(base, 0.045), 'inOutSine');

  plate(env, 'c09-rob-plate', 'tm-llm-robustness-benchmark', 'RESEARCH HARNESS · ONE WORKED EXAMPLE', R.plate, T.S6.start + 0.1);
  env.cue(R.plate - 0.2, 'reading', 'Read data/robustness/counterfactual_imdb.json');
  env.cue(R.tm - 0.3, 'reading', 'Read results/paper_c_imdb_robustness.json');
  env.overlays.push({
    id: 'c09-rob-words',
    from: R.raster,
    to: R.end + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, R.end - 0.4, undefined, 0.4);
      placed.forEach((p, k) => {
        const [u, v] = uvOf(b, ru0, rv0, p.x + p.len / 2, p.y);
        const [x, y] = screenOf(env.camera, t, wallPoint(b, u, v, 0.3), W, H, scratch);
        const at = R.raster + 0.25 + (p.x / (lineMax * CH)) * 0.55 + k * 0.004;
        out.push(<Tag key={k} x={x} y={y} text={p.w} sizeH={0.027} family={SANS} weight={500} colorText={color.text.display} opacity={fade(t, at, undefined, 0.3) * gone} />);
      });
      const [lu, lv] = uvOf(b, ru0, rv0, -2.5, -lines.length * LP - 0.2);
      const [lx, ly] = screenOf(env.camera, t, wallPoint(b, lu, lv, 0.05), W, H, scratch);
      out.push(<Tag key="lab" x={lx} y={ly} text="label: Positive · a human-edited counterfactual" sizeH={0.022} colorText={color.text.chipDim} align="left" opacity={fade(t, R.plate + 0.8, undefined, 0.4) * gone} />);
      const [tu, tv] = uvOf(b, bu, bv, -8, -3.4);
      const [tx0, ty0] = screenOf(env.camera, t, wallPoint(b, tu, tv, 0.1), W, H, scratch);
      const [bu1, bv1] = uvOf(b, bu, bv, 8, -3.4);
      const [bx1, by1] = screenOf(env.camera, t, wallPoint(b, bu1, bv1, 0.1), W, H, scratch);
      out.push(<Tag key="tm" x={tx0} y={ty0} text="TM" sizeH={0.026} family={SANS} weight={600} opacity={fade(t, R.bars + 0.3, undefined, 0.4) * gone} />);
      out.push(<Tag key="tmv" x={tx0} y={ty0 + 0.034 * H} text={t < R.tm + 0.3 ? '89.98' : '89.98 → 62.91'} sizeH={0.022} colorText={t < R.tm + 0.3 ? color.text.display : '#CFEFE4'} opacity={fade(t, R.bars + 0.45, undefined, 0.4) * gone} />);
      out.push(<Tag key="bt" x={bx1} y={by1} text="BERT" sizeH={0.026} family={SANS} weight={600} opacity={fade(t, R.bars + 0.3, undefined, 0.4) * gone} />);
      out.push(<Tag key="btv" x={bx1} y={by1 + 0.034 * H} text={t < R.bert + 0.3 ? '90.40' : '90.40 → 88.11'} sizeH={0.022} colorText={t < R.bert + 0.3 ? color.text.display : '#CFEFE4'} opacity={fade(t, R.bars + 0.45, undefined, 0.4) * gone} />);
      out.push(<Tag key="n" x={(tx0 + bx1) / 2} y={by1 + 0.074 * H} text="488 counterfactual IMDb reviews" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, R.tm, undefined, 0.4) * gone} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c09-rob-quote',
    from: R.quote,
    to: R.end + 0.4,
    render: (t) => (
      <Card t={t} at={R.quote} exitAt={R.end} x={0.069 * W} y={0.52 * H} width={0.45 * W} kicker="results/paper_c_imdb_robustness.json · finding">
        <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: Math.round(0.034 * H), color: color.text.display, lineHeight: 1.2}}>
          “This contradicts the hypothesis that TMs are more robust to counterfactual edits.”
        </div>
        <div style={{marginTop: Math.round(0.016 * H), display: 'flex', flexDirection: 'column', gap: Math.round(0.008 * H)}}>
          <Row t={t} at={R.caveats} kind="steel" sizeH={0.022}>{'single seed · best test epoch'}</Row>
          <Row t={t} at={R.caveats + 0.35} kind="steel" sizeH={0.022}>{'clean accuracy: BERT on 1,000 reviews, TM on the full test set'}</Row>
        </div>
      </Card>
    ),
  });
  chip(env, 'c09-chip-rob-readme', 'tm-llm-robustness-benchmark', 'README.md', '5-9, 18-19', R.plate + 0.4, R.bars + 2.4, 0);
  chip(env, 'c09-chip-rob-data', 'tm-llm-robustness-benchmark', 'data/robustness/counterfactual_imdb.json', '7814-7817', R.plate + 1.1, R.tm - 0.3, 1);
  chip(env, 'c09-chip-rob-res', 'tm-llm-robustness-benchmark', 'results/paper_c_imdb_robustness.json', '5-18', R.tm + 0.1, R.end, 0);
  chip(env, 'c09-chip-rob-log', 'tm-llm-robustness-benchmark', 'experiments/paper_c_imdb_tm/seed_42/run.log', '16-18', R.caveats, R.end, 1);

  return {chainLit, webField, bu, bv, reviewField};
};
