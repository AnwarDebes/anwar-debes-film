import React from 'react';
import {SWEEPS, type Beat, type FieldFn} from '../../../engine/pins';
import {pushIn} from '../../../engine/camera';
import {color} from '../../../engine/tokens';
import {CodePanel, cue, type CodePage, type CodeSnippet} from '../../../engine/code';
import type {Env} from './env';
import type {Times09} from './times';
import {chip, frame, move, plate} from './common';
import {Card, MONO, QuietStamp, Row, SANS, SERIF, Tag, fade, mint, screenOf} from './kit/ui';
import {Pic, picField, uvOf, wallPoint, type Look} from './kit/pic';
import hgtmKernel from '../../../data/ch09/hgtm-kernel.json';

const STEELB: Look = {h: 0.36, tint: 1.0};

/** A hollow bar (the calm miss style in pins): an outline ridge, value v of a full height. */
const hollowBar = (pic: Pic, x: number, w: number, hpins: number, look: Look) => {
  pic.seg(x - w / 2, 0, x - w / 2, hpins, 0.42, look, 0.45, 'max');
  pic.seg(x + w / 2, 0, x + w / 2, hpins, 0.42, look, 0.45, 'max');
  pic.seg(x - w / 2, hpins, x + w / 2, hpins, 0.42, look, 0.45, 'max');
};

export const sceneC = (env: Env, T: Times09, prevField: FieldFn) => {
  const {board: b, base, W, H} = env;
  const {hgtm: G, rgtm: R, multi: M} = T;
  const beat = (x: Beat) => env.beats.push(x);
  const scratch = {target: [0, 0, 0] as [number, number, number], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};
  const sp = (u: number, v: number, x: number, y: number, h: number, t: number) => {
    const [uu, vv] = uvOf(b, u, v, x, y);
    return screenOf(env.camera, t, wallPoint(b, uu, vv, h), W, H, scratch);
  };
  void prevField;

  // ------------------------------------------------------------------ 09.6 HGTM: two stacked layers
  const [hu, hv] = env.at(0.78, 0.4);
  const CL = 12;
  const cellW = 3.0;
  const layerPic = (l2: 'up' | 'low', feed: 'on' | 'off' | 'none') => {
    const pic = new Pic();
    for (let k = 0; k < CL; k++) {
      const x = (k - (CL - 1) / 2) * (cellW + 0.9);
      pic.rect(x, -8, cellW, 4.2, {h: 0.38, tint: 1.0}, 0.6, 0.45);
      pic.rect(x, 8, cellW, 4.2, l2 === 'up' ? {h: 0.38, tint: 1.0} : {h: 0.05, tint: 0.52}, 0.6, 0.45);
    }
    if (feed !== 'none') pic.seg(24.5, 8, 24.5, -8, 0.55, feed === 'on' ? {h: 0.3, tint: 0.95} : {h: 0.0, tint: 0.5}, 0.5);
    if (feed !== 'none') pic.seg(22.6, 8, 24.5, 8, 0.55, feed === 'on' ? {h: 0.3, tint: 0.95} : {h: 0.0, tint: 0.5}, 0.5);
    return pic;
  };
  const barsPic = () => {
    const pic = new Pic();
    const full = 24;
    for (let k = 0; k < 3; k++) hollowBar(pic, (k - 1) * 11, 6.5, 0.516 * full, {h: 0.4, tint: 0.92});
    // the majority-class line, dashed
    for (let d = -18; d < 18; d += 3) pic.seg(d, 0.516 * full, d + 1.6, 0.516 * full, 0.36, {h: 0.22, tint: 0.8});
    pic.seg(-19, -0.9, 19, -0.9, 0.35, {h: 0.12, tint: 0.85});
    return pic;
  };
  const l1 = picField(b, layerPic('up', 'none'), hu, hv);
  const l2 = picField(b, layerPic('up', 'on'), hu, hv);
  const l3 = picField(b, layerPic('low', 'on'), hu, hv);
  const l4 = picField(b, layerPic('low', 'off'), hu, hv);
  const [gu, gv] = env.at(0.62, 0.6);
  const bars = picField(b, barsPic(), gu, gv);
  beat({id: 'c09-hgtm-layers', at: G.layers, field: l1, sweep: {...SWEEPS.raster([-1, 0], 0.6), origin: [0.97, hv]}});
  beat({id: 'c09-hgtm-both', at: G.both, field: l2, sweep: {origin: uvOf(b, hu, hv, 24.5, 0), speed: 0.4, jitterS: 0.03}});
  beat({id: 'c09-hgtm-low', at: G.lowered, field: l3, sweep: {...SWEEPS.raster([1, 0], 0.45), origin: [uvOf(b, hu, hv, -24, 0)[0], hv]}});
  beat({id: 'c09-hgtm-nothing', at: G.nothing, field: l4, sweep: {origin: uvOf(b, hu, hv, 24.5, 8), speed: 0.3, jitterS: 0.02}});
  beat({id: 'c09-hgtm-bars', at: G.bars, field: bars, sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [uvOf(b, gu, gv, -20, 0)[0], gv]}});
  move(env, G.layers, 2.0, base);
  move(env, G.layers + 2.1, G.bars - G.layers - 2.3, pushIn(base, 0.04), 'inOutSine');
  move(env, G.bars - 0.1, 1.8, frame(env, [gu, gv + 0.02], 150, [0.62, 0.56]));

  plate(env, 'c09-hgtm-plate', 'HGTM', 'ALPHA v0.1.5 · JOINT TRAINING FAILS (DOCUMENTED)', G.plate, G.end);
  env.cue(G.plate - 0.2, 'reading', 'Read HierarchicalGraphTsetlinMachine/kernels.py');
  env.cue(G.bars, 'reading', 'Read docs/parity_sweep_v015_fixed_kernel.jsonl');
  const snippet = hgtmKernel as unknown as CodeSnippet;
  const pages: CodePage[] = [
    {
      at: G.code,
      source: {snippet, lines: [846, 870]},
      dedent: 12,
      view: 859,
      rows: 11,
      zoom: 0.88,
      width: Math.round(0.5 * W),
      header: {label: 'HGTM', path: 'HierarchicalGraphTsetlinMachine/kernels.py', meta: '9ba2450'},
      cues: [cue.reveal(G.code + 0.1, {stagger: 0.04}), cue.highlight(G.code + 1.0, 868), cue.annotate(G.code + 1.2, 868, 'no dependents: *no feedback*', {match: 'n_dependents > 0', side: 'below'})],
    },
  ];
  env.ruleHidden.push([G.code, G.codeExit]);
  env.overlays.push({
    id: 'c09-hgtm-code',
    from: G.code,
    to: G.codeExit + 0.6,
    render: (t) => <CodePanel pages={pages} x={0.069 * W} y={0.215 * H} anchor="top-left" t={t} enter={{at: G.code, dur: 0.5}} exit={{at: G.codeExit, dur: 0.45}} />,
  });
  env.overlays.push({
    id: 'c09-hgtm-labels',
    from: G.layers,
    to: G.end + 0.4,
    render: (t) => {
      const lay = 1 - fade(t, G.bars - 0.4, undefined, 0.35);
      const [ax, ay] = sp(hu, hv, -26, 8, 0.4, t);
      const [bx, by] = sp(hu, hv, -26, -8, 0.4, t);
      const [fx, fy] = sp(hu, hv, 27.5, 0, 0.3, t);
      const out: React.ReactNode[] = [
        <Tag key="l2" x={ax} y={ay} text="layer 2" sizeH={0.024} align="right" opacity={fade(t, G.layers + 0.5, undefined, 0.4) * lay} />,
        <Tag key="l1" x={bx} y={by} text="layer 1" sizeH={0.024} align="right" opacity={fade(t, G.layers + 0.6, undefined, 0.4) * lay} />,
        <Tag key="fb" x={fx} y={fy} text="feedback" sizeH={0.022} align="left" colorText={t < G.nothing + 0.3 ? color.text.chipDim : color.text.tertiary} opacity={fade(t, G.both + 0.3, undefined, 0.4) * lay} />,
        <Tag key="fb0" x={fx} y={fy + 0.03 * H} text="carries nothing" sizeH={0.022} align="left" colorText={color.text.tertiary} opacity={fade(t, G.nothing + 0.3, undefined, 0.4) * lay} />,
      ];
      const ep = ['50', '100', '200'];
      for (let k = 0; k < 3; k++) {
        const [x, y] = sp(gu, gv, (k - 1) * 11, -3.2, 0.1, t);
        out.push(<Tag key={`e${k}`} x={x} y={y} text={`${ep[k]} ep`} sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, G.bars + 0.3 + k * 0.15, undefined, 0.4)} />);
        const [vx, vy] = sp(gu, gv, (k - 1) * 11, 0.516 * 24 + 2.6, 0.4, t);
        out.push(<Tag key={`v${k}`} x={vx} y={vy} text="0.516" sizeH={0.024} opacity={fade(t, G.bars + 0.45 + k * 0.15, undefined, 0.4)} />);
      }
      const [mx, my] = sp(gu, gv, 20, 0.516 * 24, 0.2, t);
      out.push(<Tag key="maj" x={mx} y={my} text="majority class" sizeH={0.022} align="left" colorText={color.text.chipDim} opacity={fade(t, G.bars + 1.0, undefined, 0.4)} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c09-hgtm-card',
    from: G.bars + 0.4,
    to: G.end + 0.4,
    render: (t) => (
      <Card t={t} at={G.bars + 0.4} exitAt={G.end - 0.2} x={0.069 * W} y={0.27 * H} width={0.29 * W} kicker="parity · path 4 · v0.1.5 kernel">
        <Row t={t} at={G.bars + 0.55} kind="miss" sizeH={0.025}>{'stacked   0.516 · 0.516 · 0.516'}</Row>
        <div style={{marginTop: Math.round(0.01 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, opacity: fade(t, G.bars + 0.9, undefined, 0.4)}}>
          {'= the majority class'}
        </div>
      </Card>
    ),
  });
  chip(env, 'c09-chip-hgtm-readme', 'HGTM', 'README.md', '3-7, 22-31', G.plate + 0.4, G.code - 0.1, 0);
  chip(env, 'c09-chip-hgtm-kernel', 'HGTM', 'HierarchicalGraphTsetlinMachine/kernels.py', '846-870', G.code + 0.6, G.codeExit, 0);
  chip(env, 'c09-chip-hgtm-diag', 'HGTM', 'docs/benchmarks.md', '82-88', G.nothing, G.codeExit, 1);
  chip(env, 'c09-chip-hgtm-sweep', 'HGTM', 'docs/parity_sweep_v015_fixed_kernel.jsonl', '3, 6, 9', G.bars + 0.3, G.end - 0.2, 0);

  // ------------------------------------------------------------------ 09.7 RGTM: one tied bank
  const [ru, rv] = env.at(0.7, 0.36);
  const bankPat = (x0: number, y0: number, pic: Pic, look: Look) => {
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) if ((r * 4 + c) % 3 !== 1) pic.rect(x0 + (c - 1.5) * 1.9, y0 + (r - 1.5) * 1.9, 1.5, 1.5, look, 0.3, 0.35);
  };
  const slotX = (k: number) => -2 + k * 13;
  const graph = (pic: Pic) => {
    const pts: Array<[number, number]> = [
      [-30, 4],
      [-22, 9],
      [-17, 1],
      [-24, -5],
      [-33, -4],
    ];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [1, 3],
    ];
    for (const [a, c] of edges) pic.seg(pts[a][0], pts[a][1], pts[c][0], pts[c][1], 0.42, {h: 0.2, tint: 0.85});
    for (const [x, y] of pts) pic.disc(x, y, 1.7, {h: 0.5, tint: 1.02}, 0.5);
  };
  const rgPic = (stamped: number, bank: boolean) => {
    const pic = new Pic();
    graph(pic);
    for (let k = 0; k < 3; k++) {
      pic.rect(slotX(k), 0, 9.6, 9.6, {h: 0.06, tint: 0.62}, 1, 0.6);
      if (k < stamped) bankPat(slotX(k), 0, pic, {h: 0.5, tint: 1.02});
    }
    if (bank) bankPat(slotX(1), 13, pic, {h: 0.62, tint: 1.04});
    return pic;
  };
  const [qu, qv] = env.at(0.655, 0.585);
  const QH = 12;
  const seedsPic = (hop2: boolean, banks: boolean) => {
    const pic = new Pic();
    const vals1 = [1, 1, 1, 1, 1];
    const vals2 = [0.52, 0.765, 0.46, 0.94, 0.925];
    const group = (x0: number, vals: number[], look: Look) => vals.forEach((v, k) => pic.rect(x0 + k * 2.6, (v * QH) / 2, 1.9, v * QH, look, 0.4, 0.4));
    group(-35, vals1, {h: 0.5, tint: 1.02});
    if (hop2) group(-6.5, vals2, {h: 0.5, tint: 0.95});
    if (banks) group(22, vals1, {h: 0.5, tint: 1.02});
    pic.seg(-37, -0.8, 35, -0.8, 0.32, {h: 0.1, tint: 0.85});
    return pic;
  };
  const withSeeds = (top: Pic, seeds: Pic | null): FieldFn => {
    const a = picField(b, top, ru, rv);
    const s = seeds ? picField(b, seeds, qu, qv) : null;
    return s ? (u, v, i) => (v < (rv + qv) / 2 ? s(u, v, i) : a(u, v, i)) : a;
  };
  beat({id: 'c09-rgtm-block', at: R.block, field: withSeeds(rgPic(0, true), null), sweep: {origin: uvOf(b, ru, rv, slotX(1), 13), speed: 0.6, jitterS: 0.05}});
  R.stamps.forEach((at, k) => {
    const last = k === 2;
    beat({id: `c09-rgtm-stamp${k}`, at, field: withSeeds(rgPic(k + 1, !last), null), sweep: {origin: uvOf(b, ru, rv, slotX(k), 0), speed: 0.35, jitterS: 0.02}});
    env.presses.push({at, origin: uvOf(b, ru, rv, slotX(k), 0), radius: 0.02, depth: 0.5});
  });
  beat({id: 'c09-rgtm-hop1', at: R.hop1, field: withSeeds(rgPic(3, false), seedsPic(false, false)), sweep: {...SWEEPS.raster([0, 1], 0.5), origin: [qu, qv - (2 * b.p) / b.extH]}});
  beat({id: 'c09-rgtm-hop2', at: R.hop2, field: withSeeds(rgPic(3, false), seedsPic(true, false)), sweep: {...SWEEPS.raster([0, 1], 0.5), origin: [qu, qv - (2 * b.p) / b.extH]}});
  beat({id: 'c09-rgtm-banks', at: R.banks, field: withSeeds(rgPic(3, false), seedsPic(true, true)), sweep: {...SWEEPS.raster([0, 1], 0.5), origin: [qu, qv - (2 * b.p) / b.extH]}});
  move(env, R.block, 1.8, base);
  move(env, R.block + 1.9, R.end - R.block - 2.0, pushIn(base, 0.045), 'inOutSine');

  plate(env, 'c09-rgtm-plate', 'RGTM', 'ALPHA · CHARACTERIZATION STUDY · NEGATIVE RESULTS', R.plate, R.end + 0.3);
  env.cue(R.plate - 0.2, 'reading', 'Read rgtm/recurrent_tm.py');
  env.cue(R.hop2 - 0.3, 'reading', 'Read results/depth_efficiency_k2.jsonl');
  env.overlays.push({
    id: 'c09-rgtm-labels',
    from: R.block,
    to: R.end + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, R.end - 0.3, undefined, 0.35);
      const [bx, by] = sp(ru, rv, slotX(1) + 6.2, 13, 0.6, t);
      out.push(<Tag key="bank" x={bx} y={by} text="one shared bank" sizeH={0.023} align="left" colorText={mint} opacity={fade(t, R.block + 0.5, R.stamps[2] + 0.4) * gone} />);
      for (let k = 0; k < 3; k++) {
        const [x, y] = sp(ru, rv, slotX(k), -6.6, 0.1, t);
        out.push(<Tag key={`r${k}`} x={x} y={y} text={`round ${k + 1}`} sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, R.block + 0.3 + k * 0.1, undefined, 0.4) * gone} />);
      }
      const groups: Array<[number, string, string, number]> = [
        [-35 + 5.2, '1 hop', '1.000 on 5 of 5', R.hop1 + 0.3],
        [-6.5 + 5.2, '2 hops · one tied bank', 'mean 0.722', R.hop2 + 0.3],
        [22 + 5.2, '2 hops · separate banks', '1.000 on 5 of 5', R.banks + 0.3],
      ];
      for (const [x0, lab, val, at] of groups) {
        const [x, y] = sp(qu, qv, x0, -3.2, 0.1, t);
        out.push(<Tag key={lab} x={x} y={y} text={lab} sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, at, undefined, 0.4) * gone} />);
        out.push(<Tag key={`${lab}v`} x={x} y={y + 0.032 * H} text={val} sizeH={0.023} opacity={fade(t, at + 0.15, undefined, 0.4) * gone} />);
      }
      return <>{out}</>;
    },
  });
  chip(env, 'c09-chip-rgtm-code', 'RGTM', 'rgtm/recurrent_tm.py', '1-7, 63-64', R.plate + 0.4, R.hop1 - 0.2, 0);
  chip(env, 'c09-chip-rgtm-adj', 'RGTM', 'results/adjacency_5seed.jsonl', '6-10', R.hop1, R.banks - 0.1, 1);
  chip(env, 'c09-chip-rgtm-k2', 'RGTM', 'results/depth_efficiency_k2.jsonl', undefined, R.hop2 + 0.2, R.end, 0);
  chip(env, 'c09-chip-rgtm-paper', 'RGTM', 'PAPER.md', '211-220', R.banks + 0.3, R.end, 1);

  // ------------------------------------------------------------------ 09.8 Multi-HGTM
  const [mu, mv] = env.at(0.68, 0.47);
  const [tu, tv] = env.at(0.72, 0.31);
  const towerPic = (firing: boolean, head: boolean) => {
    const pic = new Pic();
    // two towers of 80 clause pins each (8 x 10), firing pins raised
    const tower = (x0: number, seed: number) => {
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 8; c++) {
          const fire = firing && ((r * 8 + c) * 7 + seed) % 5 === 0;
          pic.disc(x0 + (c - 3.5) * 1.6, 12.5 + r * 1.25, 0.55, fire ? {h: 0.95, tint: 1.04} : {h: 0.45, tint: 0.82}, 0.35);
        }
    };
    tower(-15, 1);
    tower(15, 3);
    // the shared row of 160 literals (4 x 40)
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 40; c++) {
        const lit = firing && ((r * 40 + c) * 7 + (c < 20 ? 1 : 3)) % 5 === 0;
        pic.disc((c - 19.5) * 1.42, 3 - r * 1.3, 0.45, lit ? {h: 0.5, tint: 1.04} : {h: 0.12, tint: 0.74}, 0.3);
      }
    if (head) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) pic.disc((c - 2.5) * 1.6, -8 - r * 1.45, 0.55, r === 1 && c === 2 ? {h: 0.95, tint: 1.04, glow: 1} : {h: 0.4, tint: 0.8}, 0.35);
    }
    return pic;
  };
  const tablePic = (lit: boolean) => {
    const pic = new Pic();
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++) {
        const y1 = r === c;
        pic.rect((c - 0.5) * 12.5, (0.5 - r) * 12.5, 11, 11, lit && y1 ? {h: 0.6, tint: 1.04, glow: 0.8} : {h: 0.3, tint: 0.7}, 1.2, 0.5);
      }
    return pic;
  };
  const seedBars = (late: boolean, clause: boolean) => {
    const pic = new Pic();
    const lateV = [0.602, 0.782, 0.746, 0.822, 0.684];
    const clauseV = [1.0, 0.904, 1.0, 1.0, 0.938];
    const HH = 15;
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * 9;
      if (late) pic.rect(x - 1.8, (lateV[k] * HH) / 2, 2.8, lateV[k] * HH, {h: 0.4, tint: 0.86}, 0.4, 0.4);
      if (clause) pic.rect(x + 1.8, (clauseV[k] * HH) / 2, 2.8, clauseV[k] * HH, {h: 0.62, tint: 1.04, glow: 0.35}, 0.4, 0.4);
    }
    pic.seg(-23, -0.8, 23, -0.8, 0.32, {h: 0.1, tint: 0.85});
    return pic;
  };
  const bcwBars = () => {
    const pic = new Pic();
    const v = [0.908, 0.925, 0.928];
    const HH = 22;
    for (let k = 0; k < 3; k++) pic.rect((k - 1) * 11, (v[k] * HH) / 2, 5, v[k] * HH, {h: 0.5, tint: k === 2 ? 1.02 : 0.9}, 0.4, 0.4);
    pic.seg(-17, -0.8, 17, -0.8, 0.32, {h: 0.1, tint: 0.85});
    return pic;
  };
  const missBars = () => {
    const pic = new Pic();
    const HH = 22;
    pic.rect(-7, (0.968 * HH) / 2, 6, 0.968 * HH, {h: 0.55, tint: 1.02}, 0.4, 0.4);
    pic.rect(7, (0.67 * HH) / 2, 6, 0.67 * HH, {h: 0.45, tint: 0.86}, 0.4, 0.4);
    pic.seg(-13, -0.8, 13, -0.8, 0.32, {h: 0.1, tint: 0.85});
    return pic;
  };
  const [su2, sv2] = env.at(0.66, 0.665);
  const [bu3, bv3] = env.at(0.66, 0.62);
  const towers0 = picField(b, towerPic(false, false), mu, mv);
  const towersFire = picField(b, towerPic(true, false), mu, mv);
  const towersHead = picField(b, towerPic(true, true), mu, mv);
  const table = picField(b, tablePic(true), tu, tv);
  const lateF = picField(b, seedBars(true, false), su2, sv2);
  const clauseF = picField(b, seedBars(true, true), su2, sv2);
  const bcwF = picField(b, bcwBars(), bu3, bv3);
  const missF = picField(b, missBars(), bu3, bv3);
  const splitV = (tv - (13 * b.p) / b.extH + sv2 + (16 * b.p) / b.extH) / 2;
  const top = (a: FieldFn, c: FieldFn): FieldFn => (u, v, i) => (v > splitV ? a(u, v, i) : c(u, v, i));
  beat({id: 'c09-multi-towers', at: M.towers, field: towers0, sweep: {...SWEEPS.raster([0, 1], 0.6), origin: [mu, mv - 0.05]}});
  beat({id: 'c09-multi-fire', at: M.fire, field: towersFire, sweep: {...SWEEPS.raster([0, -1], 0.45), origin: [mu, mv + 0.2]}});
  beat({id: 'c09-multi-head', at: M.head, field: towersHead, sweep: {origin: uvOf(b, mu, mv, 0, -8), speed: 0.4, jitterS: 0.03}});
  beat({id: 'c09-multi-table', at: M.rule, field: table, sweep: {origin: [tu, tv], speed: 0.7, jitterS: 0.05, tintFollowsWave: true}});
  beat({id: 'c09-multi-late', at: M.late, field: top(table, lateF), sweep: {...SWEEPS.raster([0, 1], 0.5), origin: [su2, sv2 - 0.01]}});
  beat({id: 'c09-multi-clause', at: M.clause, field: top(table, clauseF), sweep: {...SWEEPS.raster([0, 1], 0.5), origin: [su2, sv2 - 0.01]}});
  beat({id: 'c09-multi-bcw', at: M.bcw, field: bcwF, sweep: {origin: [bu3, bv3], speed: 0.7, jitterS: 0.05}});
  beat({id: 'c09-multi-miss', at: M.missing, field: missF, sweep: {origin: [bu3, bv3], speed: 0.7, jitterS: 0.05}});
  move(env, M.towers, 2.0, base);
  move(env, M.towers + 2.1, M.late - M.towers - 2.3, pushIn(base, 0.04), 'inOutSine');
  move(env, M.rule - 0.2, 1.8, base);
  move(env, M.bcw - 0.2, 1.8, base);
  move(env, M.bcw + 1.7, M.end - M.bcw - 1.8, pushIn(base, 0.04), 'inOutSine');

  plate(env, 'c09-multi-plate', 'Multi-HGTM', 'RESEARCH PROTOTYPE v0.1.0 · PAPER DRAFT', M.plate, M.end + 0.2);
  env.cue(M.plate - 0.2, 'reading', 'Read MultiHGTM/model.py');
  env.cue(M.rule - 0.1, 'thinking', 'Planning the four-case proof…');
  env.cue(M.done, 'success', 'clause fusion wins 5 of 5');
  env.cue(w924(T), 'reading', 'Read experiments/results/RESULTS.md');

  const formulaAt = M.rule + 0.3;
  env.overlays.push({
    id: 'c09-multi-labels',
    from: M.towers,
    to: M.end + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const towersK = 1 - fade(t, M.rule - 0.3, undefined, 0.35);
      const [ax, ay] = sp(mu, mv, -15, 26.5, 0.6, t);
      const [bx, by] = sp(mu, mv, 15, 26.5, 0.6, t);
      out.push(<Tag key="a" x={ax} y={ay} text="view A · 80 clauses" sizeH={0.023} opacity={fade(t, M.towers + 0.5, undefined, 0.4) * towersK} />);
      out.push(<Tag key="b" x={bx} y={by} text="view B · 80 clauses" sizeH={0.023} opacity={fade(t, M.towers + 0.6, undefined, 0.4) * towersK} />);
      const [lx, ly] = sp(mu, mv, 30, 1, 0.3, t);
      out.push(<Tag key="lit" x={lx} y={ly} text="160 literals" sizeH={0.022} align="left" colorText={color.text.chipDim} opacity={fade(t, M.fire + 0.4, undefined, 0.4) * towersK} />);
      const [hx, hy] = sp(mu, mv, 6.5, -10, 0.5, t);
      out.push(<Tag key="h" x={hx} y={hy} text="clause head" sizeH={0.023} align="left" colorText={mint} opacity={fade(t, M.head + 0.3, undefined, 0.4) * towersK} />);
      // the one clause takes one pin from each tower
      if (t > M.head && t < M.rule) {
        const k = fade(t, M.head + 0.15, M.rule - 0.4, 0.35, 0.3);
        const [p0x, p0y] = sp(mu, mv, -1.6, -9.45, 0.95, t);
        const [qax, qay] = sp(mu, mv, (6 - 19.5) * 1.42, 3 - 1.3, 0.5, t);
        const [qbx, qby] = sp(mu, mv, (27 - 19.5) * 1.42, 3 - 2.6, 0.5, t);
        out.push(
          <svg key="wire" width={W} height={H} style={{position: 'absolute', inset: 0, opacity: k}}>
            <path d={`M${p0x},${p0y} Q${(p0x + qax) / 2},${p0y + 0.06 * H} ${qax},${qay}`} stroke={mint} strokeWidth={Math.max(2, H / 540)} fill="none" />
            <path d={`M${p0x},${p0y} Q${(p0x + qbx) / 2},${p0y + 0.06 * H} ${qbx},${qby}`} stroke={mint} strokeWidth={Math.max(2, H / 540)} fill="none" />
            <circle cx={qax} cy={qay} r={H / 160} fill="none" stroke={mint} strokeWidth={Math.max(2, H / 720)} />
            <circle cx={qbx} cy={qby} r={H / 160} fill="none" stroke={mint} strokeWidth={Math.max(2, H / 720)} />
          </svg>,
        );
      }
      // the four cases and the plane that cannot separate them
      const tableK = fade(t, M.rule + 0.2, M.bcw - 0.3, 0.4, 0.35);
      if (tableK > 0.002) {
        for (let r = 0; r < 2; r++)
          for (let c = 0; c < 2; c++) {
            const y1 = r === c;
            const [x, y] = sp(tu, tv, (c - 0.5) * 12.5, (0.5 - r) * 12.5, 0.6, t);
            out.push(<Tag key={`c${r}${c}`} x={x} y={y} text={y1 ? 'y = 1' : 'y = 0'} sizeH={0.03} family={SANS} colorText={y1 ? '#0B0F0E' : color.text.chipDim} weight={700} opacity={tableK} />);
          }
        for (let k = 0; k < 2; k++) {
          const [rx0, ry0] = sp(tu, tv, -13.8, (0.5 - k) * 12.5, 0.3, t);
          out.push(<Tag key={`ra${k}`} x={rx0} y={ry0} text={k ? 'A = (0,1)' : 'A = (1,0)'} sizeH={0.023} align="right" opacity={tableK} />);
          const [cx0, cy0] = sp(tu, tv, (k - 0.5) * 12.5, 13.4, 0.3, t);
          out.push(<Tag key={`cb${k}`} x={cx0} y={cy0} text={k ? 'B = (0,1)' : 'B = (1,0)'} sizeH={0.023} anchor="bottom" opacity={tableK} />);
        }
        // a straight cut (a sum of two scores) sweeps across and always leaves a case on the wrong side
        const pk = fade(t, M.plane, M.late - 0.3, 0.4, 0.35);
        if (pk > 0.002) {
          const ang = -0.9 + 1.8 * Math.min(1, Math.max(0, (t - M.plane) / Math.max(0.5, M.planeFail - M.plane + 0.8)));
          const [cx, cy] = sp(tu, tv, 0, 0, 0.7, t);
          const L = 0.22 * H;
          const dx = Math.cos(ang) * L;
          const dy = Math.sin(ang) * L;
          out.push(
            <svg key="plane" width={W} height={H} style={{position: 'absolute', inset: 0, opacity: pk}}>
              <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke="rgba(228,234,231,0.75)" strokeWidth={Math.max(3, H / 400)} strokeDasharray={`${H / 90} ${H / 140}`} />
            </svg>,
          );
          const [px, py] = sp(tu, tv, 0, -14.5, 0.4, t);
          out.push(<Tag key="pl" x={px} y={py} text="a sum of two scores: no straight cut works" sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, M.planeFail, M.late - 0.3, 0.4, 0.3)} />);
        }
      }
      // seeds, then real data, then the missing view
      const seedK = 1 - fade(t, M.bcw - 0.3, undefined, 0.3);
      for (let k = 0; k < 5; k++) {
        const [x, y] = sp(su2, sv2, (k - 2) * 9, -3.0, 0.1, t);
        out.push(<Tag key={`s${k}`} x={x} y={y} text={`seed ${k + 1}`} sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, M.late + 0.3, undefined, 0.4) * seedK} />);
      }
      const bcwK = 1 - fade(t, M.missing - 0.3, undefined, 0.3);
      const bl = ['single', 'late', 'clause'];
      const bv = ['0.908', '0.925', '0.928'];
      for (let k = 0; k < 3; k++) {
        const [x, y] = sp(bu3, bv3, (k - 1) * 11, -3.0, 0.1, t);
        out.push(<Tag key={`bl${k}`} x={x} y={y} text={bl[k]} sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, M.bcw + 0.3, undefined, 0.4) * bcwK} />);
        const [vx, vy] = sp(bu3, bv3, (k - 1) * 11, [0.908, 0.925, 0.928][k] * 22 + 2.4, 0.5, t);
        out.push(<Tag key={`bv${k}`} x={vx} y={vy} text={bv[k]} sizeH={0.024} opacity={fade(t, M.bcw + 0.45, undefined, 0.4) * bcwK} />);
      }
      const ml = ['both views', 'one dropped'];
      const mvv = ['0.97', '≈ 0.67'];
      for (let k = 0; k < 2; k++) {
        const [x, y] = sp(bu3, bv3, k ? 7 : -7, -3.0, 0.1, t);
        out.push(<Tag key={`ml${k}`} x={x} y={y} text={ml[k]} sizeH={0.022} colorText={color.text.chipDim} opacity={fade(t, M.missing + 0.3, undefined, 0.4)} />);
        const [vx, vy] = sp(bu3, bv3, k ? 7 : -7, (k ? 0.67 : 0.968) * 22 + 2.4, 0.5, t);
        out.push(<Tag key={`mv${k}`} x={vx} y={vy} text={mvv[k]} sizeH={0.024} opacity={fade(t, M.missing + 0.45 + k * 0.6, undefined, 0.4)} />);
      }
      const [rx, ry] = sp(bu3, bv3, 0, -6.4, 0.1, t);
      out.push(<Tag key="rff" x={rx} y={ry} text="read from figure · paper/figures/missing_view.png" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, M.thirds, undefined, 0.4)} />);
      return <>{out}</>;
    },
  });
  // the rule, the fusion numbers, the honest real-data result
  env.overlays.push({
    id: 'c09-multi-card',
    from: formulaAt,
    to: M.end + 0.4,
    render: (t) => (
      <>
        <Card t={t} at={formulaAt} exitAt={M.bcw - 0.4} x={0.069 * W} y={0.24 * H} width={0.31 * W} kicker="the built task">
          <div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: Math.round(0.042 * H), color: color.text.display}}>
            y = (a₁ ∧ b₁) ∨ (a₂ ∧ b₂)
          </div>
          <div style={{marginTop: Math.round(0.016 * H)}}>
            <Row t={t} at={M.late + 0.2} kind="steel" sizeH={0.025}>{'late fusion    0.727'}</Row>
            <Row t={t} at={M.clause + 0.2} kind="win" sizeH={0.025}>{'clause fusion  0.968'}</Row>
          </div>
          <div style={{marginTop: Math.round(0.012 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, lineHeight: 1.4, opacity: fade(t, M.done + 0.2, undefined, 0.4)}}>
            {'5 seeds · Wilcoxon p = 0.03125'}
            <br />
            {'one-sided · the minimum at n = 5'}
          </div>
        </Card>
        <Card t={t} at={M.bcw} exitAt={M.missing - 0.3} x={0.069 * W} y={0.27 * H} width={0.31 * W} kicker="breast cancer · 3 views · real data">
          <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'0.908 / 0.925 / 0.928'}</div>
          <div style={{marginTop: Math.round(0.01 * H), fontFamily: SANS, fontSize: Math.round(0.028 * H), color: color.text.chipDim}}>
            a task built for it · real data: no significant gain
          </div>
        </Card>
        <QuietStamp text="p = 0.233 · not significant" at={M.ns} exitAt={M.missing - 0.3} t={t} x={Math.round(0.2 * W)} y={Math.round(0.5 * H)} />
        <Card t={t} at={M.missing} exitAt={M.end} x={0.069 * W} y={0.3 * H} width={0.3 * W} kicker="missing view · the built task">
          <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'head 0.97 → about 0.67'}</div>
          <div style={{marginTop: Math.round(0.01 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.tertiary}}>{'read from figure'}</div>
        </Card>
      </>
    ),
  });
  chip(env, 'c09-chip-multi-model', 'Multi-HGTM', 'MultiHGTM/model.py', '89-110', M.plate + 0.4, M.head + 1.0, 0);
  chip(env, 'c09-chip-multi-clauses', 'Multi-HGTM', 'experiments/run_experiments.py', '159-163', M.fire, M.rule, 1);
  chip(env, 'c09-chip-multi-task', 'Multi-HGTM', 'MultiHGTM/datasets.py', '133-145', M.rule, M.late - 0.2, 0);
  chip(env, 'c09-chip-multi-proof', 'Multi-HGTM', 'paper/multihgtm.tex', '234-244', M.plane, M.late - 0.2, 1);
  chip(env, 'c09-chip-multi-sum', 'Multi-HGTM', 'experiments/results/cross_view_summary.json', '20-44, 68-69', M.late + 0.2, M.bcw - 0.4, 0);
  chip(env, 'c09-chip-multi-proto', 'Multi-HGTM', 'experiments/protocol.py', '5, 34', M.done, M.bcw - 0.4, 1);
  chip(env, 'c09-chip-multi-bcw', 'Multi-HGTM', 'experiments/results/RESULTS.md', 7, M.bcw + 0.2, M.missing - 0.3, 0);
  chip(env, 'c09-chip-multi-bcwp', 'Multi-HGTM', 'experiments/results/bcw_summary.json', '61-69', M.ns, M.missing - 0.3, 1);
  chip(env, 'c09-chip-multi-fig', 'Multi-HGTM', 'paper/figures/missing_view.png', undefined, M.missing + 0.3, M.end, 0);
  chip(env, 'c09-chip-multi-hgtm', 'Multi-HGTM', 'MultiHGTM/datasets.py', '53 (uses the HGTM library)', M.missing + 0.6, M.end, 1);

  return {missF, su2: bu3, sv2: bv3};
};

/** Pixie reads RESULTS.md as the real-data line starts. */
const w924 = (T: Times09) => T.multi.built;
