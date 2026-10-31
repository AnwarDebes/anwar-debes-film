import React from 'react';
import {FILM_RIPPLE, hash01, seedOf, SWEEPS, type Beat, type FieldFn} from '../../../engine/pins';
import {apertureForBlur, pushIn} from '../../../engine/camera';
import {color} from '../../../engine/tokens';
import {KineticLine, Numeral, StepPill} from '../../../engine/type';
import {CodePanel, cue, type CodePage, type CodeSnippet} from '../../../engine/code';
import {HANDOFF} from '../../handoff';
import type {Env} from './env';
import type {Times09} from './times';
import {chip, frame, move, plate} from './common';
import {Card, MONO, Row, SANS, SERIF, Tag, Terminal, fade, mint, screenOf} from './kit/ui';
import {Pic, picField, treadmill, uvOf, wallPoint, type Look} from './kit/pic';
import {bondKey, hopsFrom, molCentre, molField, molMorphLayer, mol22, mol31} from './molecule';
import cbrEncoder from '../../../data/ch09/cbr-encoder.json';
import rdkit from '../../../data/ch09/rdkit-check.json';

const RED = color.signal.verdictRed;
const AMBER = color.signal.amber;

export const sceneD = (env: Env, T: Times09, prev: {missF: FieldFn}) => {
  const {board: b, base, W, H} = env;
  const {cbr: C, steps: P, flip: F, close: Z} = T;
  const beat = (x: Beat) => env.beats.push(x);
  const scratch = {target: [0, 0, 0] as [number, number, number], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};
  const sp = (u: number, v: number, x: number, y: number, h: number, t: number) => {
    const [uu, vv] = uvOf(b, u, v, x, y);
    return screenOf(env.camera, t, wallPoint(b, uu, vv, h), W, H, scratch);
  };

  // ------------------------------------------------------------------ 09.9 mol_31 assembles
  const S = 7;
  const [ou, ov] = env.at(0.655, 0.44);
  const c31 = molCentre(mol31.molBefore);
  const c31a = molCentre(mol31.molAfter);
  const molPlot = new Pic().rect(0, 0, 64, 50, {h: 0.05, tint: 0.6}, 2, 0.8);
  const plotF = picField(b, molPlot, ou, ov);
  const m31 = molField(b, mol31.molBefore, {scale: S}, ou, ov, c31);
  beat({id: 'c09-cbr-plot', at: C.dolly, field: plotF});
  env.live.push(treadmill(b, prev.missF, plotF, C.dolly, C.dollyDur));
  const first = mol31.molBefore.atoms[0];
  beat({id: 'c09-cbr-mol', at: C.mol, field: m31, sweep: {origin: uvOf(b, ou, ov, (first.x - c31[0]) * S, (first.y - c31[1]) * S), speed: 0.3, jitterS: 0.05}});
  move(env, C.dolly, C.dollyDur, base);
  move(env, C.dolly + C.dollyDur + 0.1, C.press - C.dolly - C.dollyDur - 0.2, pushIn(frame(env, [ou, ov], 150, [0.655, 0.44]), 0.05), 'inOutSine');

  plate(env, 'c09-cbr-plate', 'graphtm-cbr', 'COURSEWORK RESEARCH PROTOTYPE · UiA IKT469 · SPRING 2026', C.plate, T.S12.start + 0.4);
  env.cue(C.plate - 0.2, 'reading', 'Read graphtm-cbr/paper/case_studies.md');
  env.cue(C.question, 'reading', 'Read mol_31 SMILES');
  // the press at Pixie's reading position, then the two-hop ripple out of one atom
  const N14 = mol31.molBefore.atoms.findIndex((a) => a.el === 'N');
  const nAt = mol31.molBefore.atoms[N14];
  const nUV = uvOf(b, ou, ov, (nAt.x - c31[0]) * S, (nAt.y - c31[1]) * S);
  env.presses.push({at: C.press, origin: nUV, radius: 0.016, depth: 0.6});
  env.ripples.push({...FILM_RIPPLE, at: C.press, origin: nUV, amp: 0.45});
  env.overlays.push({
    id: 'c09-cbr-q',
    from: C.mol,
    to: P.s1 + 0.3,
    render: (t) => {
      const [x, y] = sp(ou, ov, 0, 26, 0.5, t);
      return (
        <>
          <Tag x={x} y={y} text="MUTAGENIC?" sizeH={0.06} weight={600} anchor="bottom" opacity={fade(t, C.question, P.s1 - 0.3, 0.45, 0.35)} blur={0} />
          <Tag x={0.069 * W} y={0.255 * H} text="ICH M7(R2): motivation, not compliance" sizeH={0.023} align="left" bg opacity={fade(t, C.plate + 1.2, P.s1 - 0.3, 0.4, 0.35)} />
          <Tag x={0.069 * W} y={0.31 * H} text="TDC AMES · 7,278 molecules" sizeH={0.023} align="left" colorText={color.text.chipDim} opacity={fade(t, C.plate + 1.6, P.s1 - 0.3, 0.4, 0.35)} />
        </>
      );
    },
  });
  chip(env, 'c09-chip-cbr-pdf', 'graphtm-cbr', 'graph^2tm-cbr.pdf', 'title page', C.plate + 0.3, C.question + 1.6, 0);
  chip(env, 'c09-chip-cbr-ich', 'graphtm-cbr', 'paper/paper.md', '24-25', C.plate + 1.3, C.edit + 1.0, 1);
  chip(env, 'c09-chip-cbr-readme', 'graphtm-cbr', 'README.md', '116-121', C.question + 1.7, P.s1 - 0.2, 0);
  chip(env, 'c09-chip-cbr-fig', 'graphtm-cbr', 'paper/figures/case_2_mol_31.png', undefined, C.edit + 1.1, P.s1 - 0.2, 1);

  // ------------------------------------------------------------------ 09.10 five steps
  const [du, dv] = env.at(0.64, 0.42);
  const datasetPic = (split: boolean) => {
    const pic = new Pic();
    const L = 80;
    const segs = split ? [5822, 727, 729] : [7278];
    const tot = 7278;
    let x = -L / 2;
    segs.forEach((n, k) => {
      const w = (n / tot) * L - (split ? 1.6 : 0);
      pic.rect(x + w / 2, 0, w, 5, {h: 0.5, tint: k === 0 ? 1.02 : 0.9}, 1, 0.5);
      x += w + (split ? 1.6 : 0);
    });
    return pic;
  };
  beat({id: 'c09-steps-data', at: P.s1, field: picField(b, datasetPic(false), du, dv), sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [uvOf(b, du, dv, -42, 0)[0], dv]}});
  beat({id: 'c09-steps-split', at: P.split, field: picField(b, datasetPic(true), du, dv), sweep: {origin: uvOf(b, du, dv, 24, 0), speed: 0.35, jitterS: 0.03}});
  // step 2: back to the molecule; hop 1 and hop 2 around the nitrogen light; its 512-bit column
  const hops = hopsFrom(mol31.molBefore, N14);
  const [mu2, mv2] = env.at(0.7, 0.42);
  const S1 = 5.6;
  // the atom's 512-bit column (16 x 32): empty at first, then filled as hop 1 and hop 2 are bundled in
  const bitCol = (fill: 0 | 1 | 2) => {
    const pic = new Pic();
    for (let r = 0; r < 32; r++)
      for (let c = 0; c < 16; c++) {
        const q = hash01(seedOf('c09-bits'), r * 16 + c);
        const on = (fill >= 1 && q < 0.16) || (fill >= 2 && q < 0.3);
        pic.disc(21 + c * 0.95, 15 - r * 0.95, 0.34, on ? {h: 0.5, tint: 1.04, glow: 0.5} : {h: 0.14, tint: 0.72}, 0.3);
      }
    return pic;
  };
  const molGlow = (level: number, bits: 0 | 1 | 2): FieldFn => {
    const g = (i: number) => (hops[i] === 0 ? 1 : hops[i] === 1 && level >= 1 ? 0.85 : hops[i] === 2 && level >= 2 ? 0.45 : 0);
    const mf = molField(b, mol31.molBefore, {scale: S1, glow: g}, mu2, mv2, c31);
    const bf = picField(b, bitCol(bits), mu2, mv2);
    return (u, v, i) => {
      const s = bf(u, v, i);
      return s.h > 0.001 ? s : mf(u, v, i);
    };
  };
  const nUV2 = uvOf(b, mu2, mv2, (nAt.x - c31[0]) * S1, (nAt.y - c31[1]) * S1);
  beat({id: 'c09-steps-mol', at: P.s2, field: molGlow(0, 0), sweep: {origin: [du, dv], speed: 0.6, jitterS: 0.05, tintFollowsWave: true}});
  beat({id: 'c09-steps-hop1', at: P.hop1, field: molGlow(1, 1), sweep: {origin: nUV2, speed: 0.12, jitterS: 0.02, tintFollowsWave: true}});
  env.ripples.push({...FILM_RIPPLE, at: P.hop1, origin: nUV2, amp: 0.4});
  beat({id: 'c09-steps-hop2', at: P.hop2, field: molGlow(2, 2), sweep: {origin: nUV2, speed: 0.12, jitterS: 0.02, tintFollowsWave: true}});
  // step 3: the clause tree, AND-OR-AND-OR-AND, one path lit from a leaf to the root
  const [tu, tv] = env.at(0.7, 0.47);
  const treePic = (lit: boolean, atoms: boolean) => {
    const pic = new Pic();
    const lv = [14, 7, 0, -7, -14];
    const counts = [1, 2, 4, 8, 12];
    const xs = counts.map((n) => Array.from({length: n}, (_, k) => (k - (n - 1) / 2) * (n === 1 ? 0 : 46 / Math.max(1, n - 1))));
    const path = [0, 1, 2, 5, 9];
    for (let l = 1; l < 5; l++)
      xs[l].forEach((x, k) => {
        const parent = Math.min(xs[l - 1].length - 1, Math.floor((k / xs[l].length) * xs[l - 1].length));
        const on = lit && path[l] === k && path[l - 1] === parent;
        pic.seg(xs[l - 1][parent], lv[l - 1], x, lv[l], on ? 0.55 : 0.38, on ? {h: 0.5, tint: 1.04, glow: 1} : {h: 0.2, tint: 0.82}, 0.45, 'max');
      });
    for (let l = 0; l < 5; l++)
      xs[l].forEach((x, k) => {
        const on = lit && path[l] === k;
        pic.disc(x, lv[l], l === 0 ? 2.3 : 1.5, on ? {h: 0.8, tint: 1.04, glow: 1} : {h: 0.55, tint: 0.98}, 0.5, 'max');
      });
    if (atoms) for (let k = 0; k < 14; k++) pic.disc((k - 6.5) * 3.5, -19.5, 1.0, k === 9 ? {h: 0.7, tint: 1.04, glow: 1} : {h: 0.35, tint: 0.82}, 0.45);
    return pic;
  };
  beat({id: 'c09-steps-tree', at: P.s3, field: picField(b, treePic(false, false), tu, tv), sweep: {...SWEEPS.raster([0, -1], 0.5), origin: [0.5, uvOf(b, tu, tv, 0, 17)[1]]}});
  beat({id: 'c09-steps-path', at: P.path, field: picField(b, treePic(true, false), tu, tv), sweep: {origin: uvOf(b, tu, tv, 0, -14), speed: 0.2, jitterS: 0.02, tintFollowsWave: true}});
  beat({id: 'c09-steps-any', at: P.any, field: picField(b, treePic(true, true), tu, tv), sweep: {...SWEEPS.raster([1, 0], 0.6), origin: [uvOf(b, tu, tv, -32, 0)[0], tv]}});
  // step 4: five machines taught by the GIN; their integer votes add
  const towersPic = () => {
    const pic = new Pic();
    for (let k = 0; k < 5; k++) {
      const x = (k - 2) * 9;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) pic.disc(x + (c - 1) * 1.6, -6 + r * 1.6, 0.6, {h: 0.5 + 0.06 * r, tint: 1.0}, 0.35);
      pic.seg(x, -8.5, x, -12, 0.4, {h: 0.2, tint: 0.85});
    }
    pic.seg(-18, -12, 22, -12, 0.4, {h: 0.2, tint: 0.85});
    pic.rect(28, -6, 4, 14, {h: 0.7, tint: 1.04, glow: 0.4}, 0.6, 0.45);
    pic.seg(22, -12, 28, -12, 0.4, {h: 0.2, tint: 0.85});
    pic.rect(0, 13, 18, 5, {h: 0.5, tint: 0.5}, 1, 0.5);
    return pic;
  };
  beat({id: 'c09-steps-towers', at: P.towers, field: picField(b, towersPic(), tu, tv), sweep: {...SWEEPS.raster([1, 0], 0.6), origin: [uvOf(b, tu, tv, -26, 0)[0], tv]}});
  // step 5: fired clauses propose edits; three gates; the biggest margin drop is kept
  const [eu, ev] = env.at(0.47, 0.44);
  const editsPic = (stage: 0 | 1 | 2) => {
    const p = new Pic();
    for (let k = 0; k < 12; k++) {
      const y = 15 - k * 2.7;
      const pass1 = hash01(seedOf('c09-g1'), k) > 0.15;
      const pass2 = pass1 && hash01(seedOf('c09-g2'), k) > 0.2;
      const pass3 = pass2 && hash01(seedOf('c09-g3'), k) > 0.15;
      const keep = k === 4;
      const x0 = 22;
      p.rect(x0, y, 3.2, 1.8, {h: 0.4, tint: 0.95}, 0.4, 0.35);
      if (stage >= 1) {
        p.seg(x0 + 2, y, x0 + 8, y, 0.25, {h: 0.12, tint: 0.8});
        const ok: Look = {h: 0.62, tint: 1.04, glow: 0.45};
        const no: Look = {h: 0.02, tint: 0.42};
        p.disc(x0 + 10, y, 1.05, pass1 ? ok : no, 0.35);
        if (pass1) p.disc(x0 + 14, y, 1.05, pass2 ? ok : no, 0.35);
        if (pass2) p.disc(x0 + 18, y, 1.05, pass3 ? ok : no, 0.35);
      }
      if (stage >= 2 && keep) p.rect(x0 + 23, y, 3.2, 1.8, {h: 0.7, tint: 1.04, glow: 1}, 0.4, 0.35);
    }
    return p;
  };
  const editFields = (stage: 0 | 1 | 2): FieldFn => {
    const mf = molField(b, mol31.molBefore, {scale: S * 0.78, glow: (i) => (i === 3 || i === 4 ? (stage >= 2 ? 1 : 0.6) : 0)}, eu, ev, c31);
    const ef = picField(b, editsPic(stage), eu, ev);
    return (u, v, i) => {
      const s = ef(u, v, i);
      return s.h > 0.001 ? s : mf(u, v, i);
    };
  };
  beat({id: 'c09-steps-edits', at: P.edits, field: editFields(0), sweep: {origin: uvOf(b, eu, ev, 0, 0), speed: 0.5, jitterS: 0.05, tintFollowsWave: true}});
  beat({id: 'c09-steps-gates', at: P.gates, field: editFields(1), sweep: {...SWEEPS.raster([1, 0], 0.5), origin: [uvOf(b, eu, ev, 26, 0)[0], ev]}});
  beat({id: 'c09-steps-keep', at: P.keep, field: editFields(2), sweep: {origin: uvOf(b, eu, ev, 45, 4.2), speed: 0.4, jitterS: 0.02}});
  move(env, P.s1 - 0.4, 1.8, base);
  move(env, P.s1 + 1.5, P.collapse - P.s1 - 1.6, pushIn(base, 0.05), 'inOutSine');

  env.cue(P.towers - 0.2, 'reading', 'Read scripts/distill_ensemble_ames.py');
  env.cue(P.edits, 'searching', 'Search 46 candidate edits');
  const encoder = cbrEncoder as unknown as CodeSnippet;
  const pages: CodePage[] = [
    {
      at: P.code,
      source: {snippet: encoder, lines: [271, 290]},
      dedent: 4,
      view: 282,
      rows: 9,
      zoom: 0.88,
      width: Math.round(0.47 * W),
      header: {label: 'graphtm-cbr', path: 'graphtm/encoding/graph_features.py', meta: '7e85d23'},
      cues: [cue.reveal(P.code + 0.1, {stagger: 0.035}), cue.highlight(P.code + 0.9, [284, 290]), cue.annotate(P.code + 1.1, 290, 'majority-bundled into *one column*', {match: 'majority_bundle(stack)', side: 'below'})],
    },
  ];
  env.ruleHidden.push([P.code, P.codeExit]);
  env.overlays.push({
    id: 'c09-steps-code',
    from: P.code,
    to: P.codeExit + 0.6,
    render: (t) => <CodePanel pages={pages} x={0.069 * W} y={0.26 * H} anchor="top-left" t={t} enter={{at: P.code, dur: 0.45}} exit={{at: P.codeExit, dur: 0.4}} />,
  });
  const pillY = Math.round(0.215 * H);
  const pills: Array<[number, number, string]> = [
    [P.s1, P.s2 - 0.35, '7,278 molecules · scaffold split *5,822 / 727 / 729*'],
    [P.s2, P.s3 - 0.35, 'each atom: its own *512 bits*, from neighbours up to 2 bonds away'],
    [P.s3, P.s4 - 0.35, 'a five-level tree of ands and ors, *checked at every atom*'],
    [P.s4, P.s5 - 0.35, 'five machines taught by a GIN’s answers · *votes added*'],
    [P.s5, P.collapse - 0.1, 'fired clauses propose edits · *three checks* · biggest margin drop'],
  ];
  pills.forEach(([at, exit, text], k) =>
    env.overlays.push({id: `c09-pill-${k}`, from: at, to: exit + 0.5, render: (t) => <StepPill n={k + 1} text={text} at={at} exitAt={exit} t={t} x={Math.round(0.069 * W)} y={pillY} align="left" sizeH={0.03} />}),
  );
  env.overlays.push({
    id: 'c09-steps-labels',
    from: P.s1,
    to: P.collapse + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const k1 = fade(t, P.s1 + 0.4, P.s2 - 0.3, 0.4, 0.3);
      const [ax, ay] = sp(du, dv, 0, 5.5, 0.5, t);
      out.push(<Tag key="d" x={ax} y={ay} text={t < P.split + 0.4 ? '7,278 molecules' : 'scaffold split'} sizeH={0.026} anchor="bottom" opacity={k1} />);
      const segX = [-8.8, 31.2];
      ['5,822 train', '727 valid · 729 test'].forEach((lab, k) => {
        const [x, y] = sp(du, dv, segX[k], -4.8, 0.3, t);
        out.push(<Tag key={lab} x={x} y={y} text={lab} sizeH={0.023} align={k === 0 ? 'center' : 'right'} colorText={k === 0 ? color.text.display : color.text.chipDim} opacity={fade(t, P.split + 0.3 + k * 0.12, P.s2 - 0.3, 0.35, 0.3)} />);
      });
      const [bx, by] = sp(mu2, mv2, 28.1, -17.5, 0.3, t);
      out.push(<Tag key="b" x={bx} y={by} text="512 bits · one atom" sizeH={0.022} colorText={mint} opacity={fade(t, P.s2 + 0.6, P.s3 - 0.3, 0.4, 0.3)} />);
      const [hx, hy] = sp(mu2, mv2, (nAt.x - c31[0]) * S1, (nAt.y - c31[1]) * S1 - 3.4, 0.9, t);
      out.push(<Tag key="h" x={hx} y={hy} text="hop 1 · hop 2" sizeH={0.022} colorText={mint} opacity={fade(t, P.hop1 + 0.3, P.code, 0.35, 0.3)} />);
      const lvl = ['AND', 'OR', 'AND', 'OR', 'AND of literals'];
      const lv = [14, 7, 0, -7, -14];
      lvl.forEach((lab, k) => {
        const [x, y] = sp(tu, tv, -27.5, lv[k], 0.4, t);
        out.push(<Tag key={`l${k}`} x={x} y={y} text={lab} sizeH={0.022} align="right" colorText={color.text.chipDim} opacity={fade(t, P.s3 + 0.4 + 0.1 * k, P.s4 - 0.3, 0.35, 0.3)} />);
      });
      const [ox, oy] = sp(tu, tv, 0, -23, 0.4, t);
      out.push(<Tag key="or" x={ox} y={oy} text="OR across atoms" sizeH={0.022} colorText={mint} opacity={fade(t, P.any + 0.4, P.s4 - 0.3, 0.35, 0.3)} />);
      const [gx, gy] = sp(tu, tv, 0, 13, 0.6, t);
      out.push(<Tag key="gin" x={gx} y={gy} text="GIN teacher" sizeH={0.024} weight={600} family={SANS} opacity={fade(t, P.towers + 0.3, P.s5 - 0.3, 0.35, 0.3)} />);
      const [vx, vy] = sp(tu, tv, 28, 3.2, 0.8, t);
      out.push(<Tag key="v" x={vx} y={vy} text="votes added" sizeH={0.022} anchor="bottom" colorText={mint} opacity={fade(t, P.towers + 0.6, P.s5 - 0.3, 0.35, 0.3)} />);
      ['1', '2', '3'].forEach((g, k) => {
        const [x, y] = sp(eu, ev, 32 + k * 4, 17.6, 0.5, t);
        out.push(<Tag key={g} x={x} y={y} text={g} sizeH={0.024} anchor="bottom" colorText={color.text.chipDim} opacity={fade(t, P.gates + 0.2 * k, P.collapse - 0.2, 0.35, 0.3)} />);
      });
      out.push(<Tag key="leg" x={0.069 * W} y={0.3 * H} text={'checks: 1 RDKit sanitize · 2 Lipinski · 3 SAscore ≤ 6'} sizeH={0.023} align="left" bg opacity={fade(t, P.gates, P.collapse - 0.2, 0.35, 0.3)} />);
      const [cx, cy] = sp(eu, ev, -2, -19.5, 0.4, t);
      out.push(<Tag key="cand" x={cx} y={cy} text="46 candidates (at most 50) · schematic" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, P.edits + 0.4, P.collapse - 0.2, 0.35, 0.3)} />);
      const [kx, ky] = sp(eu, ev, 45, -18.5, 0.6, t);
      out.push(<Tag key="keep" x={kx} y={ky} text="kept: remove_bond (3, 4)" sizeH={0.022} colorText={mint} opacity={fade(t, P.keep + 0.4, P.collapse - 0.2, 0.35, 0.3)} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c09-steps-card',
    from: P.s3 + 0.4,
    to: P.s4 + 0.2,
    render: (t) => (
      <Card t={t} at={P.s3 + 0.4} exitAt={P.s4 - 0.35} x={0.069 * W} y={0.3 * H} width={0.3 * W} kicker="the clause, as the code sizes it">
        <div style={{fontFamily: MONO, fontSize: Math.round(0.024 * H), color: color.text.display, lineHeight: 1.45}}>
          {'FEATURES = R·IF·LF'}
          <br />
          {'         = 2·8·2 = 32'}
          <br />
          <span style={{opacity: fade(t, P.s3 + 1.6, undefined, 0.4)}}>
            {'literals per clause'}
            <br />
            {'= R·IA·IF·LA·2·LF'}
            <br />
            {'= 2·2·8·15·2·2 = 1,920'}
          </span>
        </div>
      </Card>
    ),
  });
  chip(env, 'c09-chip-steps-n', 'graphtm-cbr', 'paper/paper.md', 121, P.s1 + 0.2, P.split + 1.2, 0);
  chip(env, 'c09-chip-steps-split', 'graphtm-cbr', 'results/distill_ensemble_ames_1778913284.json', '69-71', P.split + 0.2, P.s2 - 0.2, 1);
  chip(env, 'c09-chip-steps-enc', 'graphtm-cbr', 'graphtm/encoding/graph_features.py', '271-290', P.code + 0.5, P.codeExit, 0);
  chip(env, 'c09-chip-steps-feat', 'graphtm-cbr', 'graphtm/cuda/kernels.cu', 58, P.s3 + 0.6, P.path - 0.15, 0);
  chip(env, 'c09-chip-steps-lits', 'graphtm-cbr', 'graphtm/core/hierarchical_graph_tm.py', '112-113', P.s3 + 1.7, P.s4 - 0.3, 1);
  chip(env, 'c09-chip-steps-tree', 'graphtm-cbr', 'graphtm/cuda/kernels.cu', '216-245', P.path + 0.3, P.s4 - 0.3, 0);
  chip(env, 'c09-chip-steps-dist', 'graphtm-cbr', 'scripts/distill_ensemble_ames.py', '1-7', P.s4, P.s5 - 0.2, 0);
  chip(env, 'c09-chip-steps-ens', 'graphtm-cbr', 'scripts/eval_recourse_ensemble_distilled.py', '40-63', P.towers + 0.4, P.s5 - 0.2, 1);
  chip(env, 'c09-chip-steps-cand', 'graphtm-cbr', 'graphtm/recourse/candidates.py', '342-410', P.edits + 0.2, P.keep - 0.15, 0);
  chip(env, 'c09-chip-steps-valid', 'graphtm-cbr', 'graphtm/recourse/validity.py', '62-68, 136-146', P.gates + 0.2, P.collapse - 0.2, 1);
  chip(env, 'c09-chip-steps-search', 'graphtm-cbr', 'graphtm/recourse/search.py', '259-287', P.keep + 0.35, P.collapse - 0.2, 0);

  // ------------------------------------------------------------------ 09.11 the flip, and 'C.'
  const S2 = 6.9;
  const [fu, fv] = env.at(0.63, 0.44);
  const m31f = molField(b, mol31.molBefore, {scale: S2}, fu, fv, c31);
  const cut = new Set([bondKey(3, 4)]);
  const m31cut = molField(b, mol31.molBefore, {scale: S2, without: cut, glow: (i) => (i === 3 || i === 4 ? 0.7 : 0)}, fu, fv, c31);
  const m31after = molField(b, mol31.molAfter, {scale: S2}, fu, fv, c31a);
  beat({id: 'c09-flip-mol', at: F.close, field: m31f, sweep: {origin: [eu, ev], speed: 0.5, jitterS: 0.05}});
  beat({id: 'c09-flip-cut', at: F.remove, field: m31cut, sweep: {origin: uvOf(b, fu, fv, ((mol31.molBefore.atoms[3].x + mol31.molBefore.atoms[4].x) / 2 - c31[0]) * S2, ((mol31.molBefore.atoms[3].y + mol31.molBefore.atoms[4].y) / 2 - c31[1]) * S2), speed: 0.12, jitterS: 0.02}});
  const morphAt = F.remove + 0.75;
  const morphDur = 1.7;
  env.live.push(molMorphLayer(b, mol31, S2, fu, fv, c31, c31a, morphAt, morphDur));
  beat({id: 'c09-flip-after', at: morphAt + 0.05, field: m31after});
  // mol_22: the edit that detached a methyl carbon
  const c22 = molCentre(mol22.molBefore);
  const [gu, gv] = env.at(0.66, 0.46);
  const m22after = molField(b, mol22.molAfter, {scale: S2, glow: (i) => (i === 0 ? 0.6 : 0)}, gu, gv, c22);
  beat({id: 'c09-flip-mol22', at: F.mol22, field: m22after, sweep: {origin: [fu, fv], speed: 0.6, jitterS: 0.05, tintFollowsWave: true}});
  const methyl = mol22.molAfter.atoms[0];
  const mUV = uvOf(b, gu, gv, (methyl.x - c22[0]) * S2, (methyl.y - c22[1]) * S2);
  move(env, F.close, 2.2, pushIn(frame(env, [fu, fv], 150, [0.63, 0.45]), 0.1));
  move(env, F.remove - 0.2, F.mol22 - F.remove, pushIn(frame(env, [fu, fv], 150, [0.63, 0.45]), 0.14), 'inOutSine');
  move(env, F.mol22, 1.6, frame(env, [gu, gv], 150, [0.66, 0.46]));
  // the camera finds the methyl carbon floating free of the ring system
  const closePose = frame(env, mUV, 104, [0.62, 0.42], 0.2, 0.1);
  move(env, F.split - 0.4, 1.8, closePose);
  move(env, F.rdkit - 0.2, 1.6, frame(env, mUV, 104, [0.84, 0.44], 0.16, 0.08));
  move(env, F.closing, F.end - F.closing, frame(env, [gu, gv], 150, [0.66, 0.46]));
  const apert = apertureForBlur(5, closePose.distance, 0.04);
  env.focus.push(
    {at: F.close, to: 'target', aperture: 0},
    {at: F.split - 0.4, dur: 1.4, to: {uv: mUV, h: 0.7 * 22 * b.p}, aperture: apert},
    {at: F.rdkit + 0.2, dur: 1.0, to: {uv: mUV, h: 0.7 * 22 * b.p}, aperture: apert * 0.5},
    {at: F.closing, dur: 1.0, to: 'target', aperture: 0},
  );

  env.cue(F.close, 'reading', 'Read paper/case_studies.md');
  env.cue(F.safe + 0.1, 'success', 'margin +646 → −918');
  env.cue(F.cdot + 0.05, 'error', 'C. split the molecule');
  env.cue(F.rdkit + 0.2, 'debugging', 'Run RDKit GetMolFrags on mol_22');
  env.cue(F.frags + 0.15, 'success', 'as printed by RDKit');
  const verdictAt = F.safe;
  env.overlays.push({
    id: 'c09-flip-card',
    from: F.close,
    to: F.mol22 + 0.4,
    render: (t) => (
      <Card t={t} at={F.close + 0.2} exitAt={F.mol22 - 0.3} x={0.069 * W} y={0.25 * H} width={0.3 * W} kicker="paper/case_studies.md · case 2">
        <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'mol_31'}</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: Math.round(0.012 * H), marginTop: Math.round(0.012 * H)}}>
          <span style={{fontFamily: MONO, fontSize: Math.round(0.024 * H), color: color.text.chipDim}}>margin</span>
        </div>
        <div style={{position: 'relative', height: Math.round(0.1 * H)}}>
          <Numeral value={-918} keys={[[F.margin, 646], [F.below + 0.2, 646], [F.below + 1.3, -918]]} prefix={t < F.below + 0.75 ? '+' : ''} t={t} x={0} baseline={Math.round(0.085 * H)} sizeH={0.085} weight={650} enterAt={F.margin - 0.2} color={t < F.below + 0.75 ? color.text.display : mint} />
        </div>
        <div style={{fontFamily: MONO, fontSize: Math.round(0.034 * H), fontWeight: 600, marginTop: Math.round(0.008 * H), color: t < verdictAt ? color.text.display : mint}}>
          {t < verdictAt ? 'MUTAGENIC' : 'SAFE'}
        </div>
        <div style={{marginTop: Math.round(0.012 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, lineHeight: 1.45, opacity: fade(t, F.margin + 0.6, undefined, 0.4)}}>
          {'1,407 firing clauses · 46 candidates'}
          <br />
          <span style={{color: t < F.remove ? color.text.chipDim : color.text.display}}>{'remove_bond (3, 4)'}</span>
        </div>
        <div style={{marginTop: Math.round(0.012 * H), opacity: fade(t, F.alert, undefined, 0.4)}}>
          <span style={{display: 'inline-block', padding: `${Math.round(0.006 * H)}px ${Math.round(0.014 * H)}px`, borderRadius: 999, border: `${Math.max(1, Math.round(H / 1080))}px solid ${AMBER}`, color: AMBER, fontFamily: MONO, fontSize: Math.round(0.022 * H)}}>
            aziridine alert still present
          </span>
        </div>
      </Card>
    ),
  });
  // the after-SMILES types in mono; 'C.' is the hard truth
  const smi = mol22.after;
  const typeAt = F.mol22 + 0.5;
  const cps = Math.max(14, smi.length / Math.max(0.8, F.cdot - typeAt - 0.15));
  env.overlays.push({
    id: 'c09-flip-smiles',
    from: F.mol22,
    to: F.end + 0.4,
    render: (t) => {
      const n = Math.max(0, Math.min(smi.length, Math.floor((t - typeAt) * cps)));
      const hot = t >= F.cdot;
      const fs = Math.round(0.03 * H);
      const k = fade(t, F.mol22 + 0.2, F.rdkit - 0.4, 0.4, 0.35);
      const [mx, my] = sp(gu, gv, (methyl.x - c22[0]) * S2, (methyl.y - c22[1]) * S2 + 3.2, 0.9, t);
      return (
        <>
          <div style={{position: 'absolute', left: Math.round(0.069 * W), top: Math.round(0.25 * H), opacity: k}}>
            <div style={{fontFamily: MONO, fontSize: Math.round(0.022 * H), letterSpacing: '0.12em', color: color.accent.mintLabel, textTransform: 'uppercase'}}>{'mol_22 · after the edit'}</div>
            <div style={{marginTop: Math.round(0.014 * H), fontFamily: MONO, fontSize: fs, color: color.text.display, whiteSpace: 'pre'}}>
              <span style={{color: hot ? RED : color.text.display, textShadow: hot ? '0 0 14px rgba(246,115,116,0.55)' : undefined, fontWeight: hot ? 700 : 500}}>{smi.slice(0, Math.min(2, n))}</span>
              {smi.slice(2, n)}
            </div>
            <div style={{marginTop: Math.round(0.02 * H), fontFamily: SANS, fontSize: Math.round(0.032 * H), color: color.text.display, opacity: fade(t, F.split, undefined, 0.4)}}>
              passed every check · <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.036 * H)}}>split the molecule in two</span>
            </div>
          </div>
          <Tag x={mx} y={my} text="C" sizeH={0.04} weight={700} anchor="bottom" colorText={RED} opacity={fade(t, F.cdot, F.closing, 0.3, 0.4)} />
        </>
      );
    },
  });
  const tr = rdkit.transcript as Array<{in: string; out: string}>;
  const termLines = [
    {at: F.rdkit + 0.3, text: tr[0].in, kind: 'cmd' as const, cps: 60},
    {at: F.rdkit + 0.9, text: tr[1].in, kind: 'cmd' as const, cps: 70},
    {at: F.frags - 0.7, text: tr[1].out, kind: 'out' as const},
    {at: F.frags - 0.45, text: tr[2].in, kind: 'cmd' as const, cps: 30},
    {at: F.frags, text: tr[2].out, kind: 'out' as const},
  ];
  env.ruleHidden.push([F.rdkit, F.end]);
  env.overlays.push({
    id: 'c09-flip-term',
    from: F.rdkit,
    to: F.end + 0.4,
    render: (t) => (
      <Terminal t={t} at={F.rdkit} exitAt={F.end - 0.2} x={0.069 * W} y={0.215 * H} width={0.7 * W} title={`python -i · rdkit ${rdkit.rdkit} · graphtm-cbr@7e85d23 · 2026-10-29`} lines={termLines} sizeH={0.0225} />
    ),
  });
  env.overlays.push({
    id: 'c09-flip-closing',
    from: F.closing,
    to: F.end + 0.4,
    render: (t) => (
      <Card t={t} at={F.closing} exitAt={F.end - 0.2} x={0.069 * W} y={0.52 * H} width={0.5 * W}>
        <div style={{fontFamily: SANS, fontSize: Math.round(0.034 * H), color: color.text.display}}>
          flips the model’s prediction · <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.038 * H)}}>not the chemistry</span>
        </div>
      </Card>
    ),
  });
  chip(env, 'c09-chip-flip-case2', 'graphtm-cbr', 'paper/case_studies.md', '21-33', F.close + 0.4, F.remove - 0.1, 0);
  chip(env, 'c09-chip-flip-fig', 'graphtm-cbr', 'paper/figures/case_2_mol_31.png', undefined, F.remove, F.mol22 - 0.3, 0);
  chip(env, 'c09-chip-flip-case1', 'graphtm-cbr', 'paper/case_studies.md', '6-18', F.mol22 + 0.3, F.rdkit - 0.3, 0);
  chip(env, 'c09-chip-flip-json', 'graphtm-cbr', 'results/case_studies_1778918915.json', 5, F.mol22 + 0.6, F.rdkit - 0.3, 1);
  chip(env, 'c09-chip-flip-capture', 'capture', 'rdkit-getmolfrags-mol_22.txt', `sha256 ${rdkit.sha256.slice(0, 12)}`, F.frags + 0.3, F.end - 0.2, 0);
  chip(env, 'c09-chip-flip-log', 'graphtm-cbr', 'results/eval_recourse_distilled_1778913638.log', 18, F.closing + 0.2, F.end - 0.2, 1);

  // ------------------------------------------------------------------ 09.12 the numbers card
  const [qu, qv] = env.at(0.655, 0.42);
  const ticks = [23, 47, 72, 95, 119, 143, 166, 191];
  const failsPerBlock = ticks.map((s, k) => 25 - (s - (k ? ticks[k - 1] : 0)));
  // which positions inside a block of 25 failed is not logged; the count per block is
  const down = new Set<number>();
  failsPerBlock.forEach((f, k) => {
    const picks = Array.from({length: 25}, (_, j) => j).sort((a, c) => hash01(seedOf('c09-fail'), k * 25 + a) - hash01(seedOf('c09-fail'), k * 25 + c));
    for (let j = 0; j < f; j++) down.add(k * 25 + picks[j]);
  });
  const CELL = 3.3;
  const gridPic = (upTo: number, ghost: boolean) => {
    const p = new Pic();
    for (let k = 0; k < 200; k++) {
      const r = Math.floor(k / 20);
      const c = k % 20;
      const x = (c - 9.5) * CELL;
      const y = (4.5 - r) * CELL;
      const up = k < upTo && !down.has(k) && (!ghost || hash01(seedOf('c09-ghost'), k) < 109 / 200);
      p.rect(x, y, CELL - 0.9, CELL - 0.9, up ? {h: ghost ? 0.36 : 0.55, tint: ghost ? 0.78 : 1.03, glow: ghost ? 0 : 0.25} : {h: 0.06, tint: 0.6}, 0.5, 0.4);
    }
    return p;
  };
  const gridAt = (n: number, ghost = false) => picField(b, gridPic(n, ghost), qu, qv);
  beat({id: 'c09-num-grid', at: Z.grid, field: gridAt(0), sweep: {...SWEEPS.raster([0, -1], 0.6), origin: [0.5, uvOf(b, qu, qv, 0, 18)[1]]}});
  const tickT = (k: number) => Z.counter + ((Z.counterEnd - Z.counter) * k) / 7;
  ticks.forEach((_, k) => beat({id: `c09-num-tick${k}`, at: tickT(k), field: gridAt((k + 1) * 25), sweep: {...SWEEPS.raster([1, 0], 1.2), origin: [uvOf(b, qu, qv, -34, 0)[0], qv]}}));
  beat({id: 'c09-num-ghost', at: Z.ghost, field: gridAt(200, true), sweep: {...SWEEPS.dissolve(0.5)}});
  beat({id: 'c09-num-back', at: Z.auroc - 0.2, field: gridAt(200), sweep: {...SWEEPS.dissolve(0.5)}});
  // AUROC: four bars in pins, the fingerprint line
  const [ru, rv] = env.at(0.66, 0.42);
  const aurocPic = () => {
    const p = new Pic();
    const vals = [0.669, 0.685, 0.79, 0.796];
    const L = (v: number) => ((v - 0.5) / 0.35) * 60;
    vals.forEach((v, k) => p.rect(-30 + L(v) / 2, 9 - k * 6, L(v), 3.6, k === 1 ? {h: 0.5, tint: 0.96} : {h: 0.42, tint: 0.86}, 0.7, 0.45));
    for (let y = -11; y < 13; y += 2.4) p.seg(-30 + L(0.79), y, -30 + L(0.79), y + 1.2, 0.3, {h: 0.2, tint: 0.92});
    return p;
  };
  beat({id: 'c09-num-auroc', at: Z.auroc, field: picField(b, aurocPic(), ru, rv), sweep: {...SWEEPS.raster([1, 0], 0.8), origin: [uvOf(b, ru, rv, -32, 0)[0], rv]}});
  // Kazius: 729 test molecules; clause 3 fires on every one of them
  const kazPic = (lit: number) => {
    const p = new Pic();
    for (let k = 0; k < 729; k++) {
      const r = Math.floor(k / 27);
      const c = k % 27;
      const on = lit > 0 && c + r * 0.4 <= lit * 38;
      p.disc((c - 13) * 1.2, (13 - r) * 1.2, 0.42, on ? {h: 0.4, tint: 1.04, glow: 0.8} : {h: 0.2, tint: 0.8}, 0.3);
    }
    return p;
  };
  beat({id: 'c09-num-kaz', at: Z.kazius, field: picField(b, kazPic(0), qu, qv), sweep: {origin: [qu, qv], speed: 0.5, jitterS: 0.05}});
  beat({id: 'c09-num-clause3', at: Z.clause3, field: picField(b, kazPic(1), qu, qv), sweep: {...SWEEPS.raster([1, 0], 0.35), origin: [uvOf(b, qu, qv, -17, 0)[0], qv], tintLeadS: 0}});
  // the closing line: the pins re-target into one ruled line of lit pins
  const [lu, lv] = env.at(0.5, 0.64);
  const lineF = picField(b, new Pic().seg(-72, 0, 72, 0, 0.45, {h: 0.12, tint: 1.0, glow: 1}, 0.4), lu, lv);
  beat({id: 'c09-num-line', at: Z.line, field: lineF, sweep: {...SWEEPS.raster([1, 0], 0.9), origin: [uvOf(b, lu, lv, -74, 0)[0], lv]}});
  beat({id: 'c09-end', at: Z.out, field: HANDOFF, sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [uvOf(b, lu, lv, -74, 0)[0], lv]}});
  move(env, Z.grid - 0.3, 2.0, base);
  move(env, Z.grid + 1.8, Z.line - Z.grid - 2.0, pushIn(base, 0.05), 'inOutSine');
  move(env, Z.line - 0.2, 1.8, base);
  env.camera.push({at: Z.out, dur: 1.6, pose: base, ease: 'camera'});

  env.cue(Z.grid, 'reading', 'Read results/eval_recourse_distilled_1778913638.log');
  env.cue(Z.counterEnd + 0.1, 'success', 'success = 191/200');
  env.cue(Z.kazius - 0.1, 'reading', 'Read results/kazius_coverage_1778913638.log');
  env.cue(Z.line, 'idle', '');
  env.captionSkip.push('u0943');
  env.overlays.push({
    id: 'c09-num-card',
    from: Z.grid,
    to: Z.line + 0.4,
    render: (t) => {
      const n = t < Z.counter ? 0 : ticks[Math.min(7, Math.floor(((t - Z.counter) / Math.max(0.1, Z.counterEnd - Z.counter)) * 7 + 1e-6))];
      return (
        <>
          <Card t={t} at={Z.grid + 0.2} exitAt={Z.auroc - 0.4} x={0.069 * W} y={0.225 * H} width={0.29 * W} kicker="results/eval_recourse_distilled_….log">
            <div style={{fontFamily: MONO, fontSize: Math.round(0.024 * H), color: color.text.chipDim}}>{'success ='}</div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: Math.round(0.09 * H), color: t > Z.counterEnd ? mint : color.text.display, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums'}}>
              {n}
              <span style={{fontSize: Math.round(0.045 * H), color: color.text.chipDim}}>{' / 200'}</span>
            </div>
            <div style={{marginTop: Math.round(0.01 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, lineHeight: 1.45, opacity: fade(t, Z.counterEnd + 0.2, undefined, 0.4)}}>
              {'within 3 valid edits'}
              <br />
              {'mean 1.30 · median 1'}
              <br />
              {'capped at 200 predicted positives'}
            </div>
            <div style={{marginTop: Math.round(0.014 * H), opacity: fade(t, Z.ghost + 0.2, undefined, 0.4)}}>
              <Row t={t} at={Z.ghost + 0.2} kind="miss" sizeH={0.024}>{'without the GIN teacher: 109 / 200'}</Row>
            </div>
          </Card>
          <Tag x={0.069 * W} y={0.6 * H} text={'the log counts successes per 25;\nwhich nine failed is not logged:\ntheir places in the grid are illustrative'} sizeH={0.022} align="left" anchor="top" colorText={color.text.tertiary} opacity={fade(t, Z.counterEnd + 0.4, Z.auroc - 0.4, 0.4, 0.3)} />
        </>
      );
    },
  });
  env.overlays.push({
    id: 'c09-num-auroc',
    from: Z.auroc,
    to: Z.kazius + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const k = fade(t, Z.auroc + 0.3, Z.kazius - 0.3, 0.4, 0.3);
      const labs = [
        ['HGTM ensemble', '0.669'],
        ['distilled ensemble', '0.685'],
        ['Morgan-fingerprint random forest', '0.790'],
        ['GIN teacher', '0.796'],
      ];
      const L = (v: number) => ((v - 0.5) / 0.35) * 60;
      labs.forEach(([lab, v], j) => {
        const [x, y] = sp(ru, rv, -31.5, 9 - j * 6, 0.4, t);
        out.push(<Tag key={lab} x={x} y={y} text={lab} sizeH={0.023} align="right" family={SANS} weight={j === 1 ? 600 : 500} opacity={k} />);
        const [vx, vy] = sp(ru, rv, -30 + L(Number(v)) + 1.4, 9 - j * 6, 0.4, t);
        out.push(<Tag key={`v${lab}`} x={vx} y={vy} text={v} sizeH={0.023} align="left" opacity={k} />);
      });
      const [fx, fy] = sp(ru, rv, -30 + L(0.79), 14.5, 0.3, t);
      out.push(<Tag key="fp" x={fx} y={fy} text="test AUROC · the fingerprint line" sizeH={0.022} anchor="bottom" colorText={color.text.chipDim} opacity={fade(t, Z.rf, Z.kazius - 0.3, 0.4, 0.3)} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c09-num-kaz',
    from: Z.kazius,
    to: Z.line + 0.4,
    render: (t) => (
      <>
        <Card t={t} at={Z.kazius + 0.1} exitAt={Z.line - 0.3} x={0.069 * W} y={0.24 * H} width={0.3 * W} kicker="results/kazius_coverage_….log">
          <div style={{fontFamily: SANS, fontWeight: 700, fontSize: Math.round(0.06 * H), color: color.text.display}}>{'21 / 21'}</div>
          <div style={{fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim}}>{'alerts covered'}</div>
          <div style={{marginTop: Math.round(0.014 * H), opacity: fade(t, Z.clause3 + 0.3, undefined, 0.4)}}>
            <Row t={t} at={Z.clause3 + 0.3} kind="miss" sizeH={0.024}>{'clause 3 fires on 729 / 729'}</Row>
          </div>
          <div style={{marginTop: Math.round(0.01 * H), fontFamily: SANS, fontSize: Math.round(0.027 * H), color: color.text.chipDim, lineHeight: 1.3, opacity: fade(t, Z.warn - 0.2, undefined, 0.4)}}>
            coverage partly from saturation, as the paper <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.03 * H)}}>warns</span>
          </div>
        </Card>
        <Tag x={0.069 * W} y={0.648 * H} text="CUDA kernels: a CPU-reference test · no test run committed · skips without CUDA" sizeH={0.022} align="left" bg opacity={fade(t, Z.warn + 0.4, Z.line - 0.3, 0.4, 0.3)} />
      </>
    ),
  });
  const u43 = env.ctx.tl.utt('u0943');
  env.overlays.push({
    id: 'c09-closing',
    from: Z.line,
    to: Z.out + 0.8,
    render: (t) => <KineticLine words={u43.words} t={t} kind="statement" variant="rise" x={Math.round(0.069 * W)} y={Math.round(0.4 * H)} yAnchor="capTop" maxWidth={0.62 * W} exitAt={Z.out + 0.2} />,
  });
  chip(env, 'c09-chip-num-log', 'graphtm-cbr', 'results/eval_recourse_distilled_1778913638.log', '8-21', Z.grid + 0.4, Z.ghost - 0.2, 0);
  chip(env, 'c09-chip-num-ghost', 'graphtm-cbr', 'results/eval_recourse_ensemble_1778898137.json', 5, Z.ghost + 0.2, Z.auroc - 0.3, 0);
  chip(env, 'c09-chip-num-auroc1', 'graphtm-cbr', 'results/eval_recourse_ensemble_1778898137.json', '3-4', Z.auroc + 0.3, Z.rf - 0.15, 0);
  chip(env, 'c09-chip-num-auroc2', 'graphtm-cbr', 'results/eval_recourse_distilled_1778914339.json', 4, Z.auroc + 0.6, Z.rf - 0.15, 1);
  chip(env, 'c09-chip-num-rf', 'graphtm-cbr', 'results/train_full_ames_1778877871.log', 76, Z.rf + 0.2, Z.kazius - 0.3, 0);
  chip(env, 'c09-chip-num-gin', 'graphtm-cbr', 'results/distill_ensemble_ames_1778913284.json', '18-22', Z.rf + 0.5, Z.kazius - 0.3, 1);
  chip(env, 'c09-chip-num-kaz', 'graphtm-cbr', 'results/kazius_coverage_1778913638.log', '19-24', Z.kazius + 0.3, Z.warn + 0.1, 0);
  chip(env, 'c09-chip-num-paper', 'graphtm-cbr', 'paper/paper.md', 184, Z.warn - 0.2, Z.line - 0.3, 1);
  chip(env, 'c09-chip-num-cuda', 'graphtm-cbr', 'README.md', 47, Z.warn + 0.45, Z.line - 0.3, 0);
};

