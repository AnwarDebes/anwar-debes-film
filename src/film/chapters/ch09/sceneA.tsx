import React from 'react';
import {SWEEPS, type Beat} from '../../../engine/pins';
import {pushIn} from '../../../engine/camera';
import {ChapterCard} from '../../../engine/type';
import {color} from '../../../engine/tokens';
import {HANDOFF} from '../../handoff';
import type {Env} from './env';
import type {Times09} from './times';
import {chip, frame, move, plate} from './common';
import {Card, MONO, Row, Tag, fade, mint, screenOf} from './kit/ui';
import {picField, uvOf, wallPoint} from './kit/pic';
import {cubeField, netField, subNodeX, subPic, SUB_ARC_BULGE, SUB_TOKENS, treeField, unfoldLayer, zooField, zooPics, type GateGeom, type TreeGeom} from './places';
import {treadmill} from './kit/pic';

/** 09.0 the gate, 09.1 tsetlin-zoo, 09.2 subword-dep-graphtm. Returns the fields later scenes start from. */
export const sceneA = (env: Env, T: Times09) => {
  const {board: b, base, W, H} = env;
  const {gate: G, zoo: Z, sub: B} = T;
  const beat = (x: Beat) => env.beats.push(x);

  // ------------------------------------------------------------------ 09.0 gate (Act III: unfold)
  beat({id: 'c09-bare', at: T.ch.start, field: HANDOFF});
  env.camera.push({at: T.ch.start, pose: base});

  const [cu, cv] = env.at(0.705, 0.43);
  const gg: GateGeom = {u: cu, v: cv, side: 20, hc: 0.62};
  beat({id: 'c09-gate-cube', at: G.cube, field: cubeField(b, gg), sweep: {origin: [cu, cv], speed: 0.85, jitterS: 0.06}});
  beat({id: 'c09-gate-net', at: G.unfold + 0.02, field: netField(b, gg)});
  env.live.push(unfoldLayer(b, gg, G.unfold, G.unfoldDur));

  // the family tree: nine plots, film order, alternating above and below one trunk
  const trunkSy = 0.45;
  const plots: Array<[number, number]> = [];
  for (let k = 0; k < 9; k++) {
    const sx = 0.155 + k * 0.0885;
    plots.push(env.at(sx, k % 2 === 0 ? 0.285 : 0.615));
  }
  const tg: TreeGeom = {plots, trunkV: env.at(0.5, trunkSy)[1], trunkU0: env.at(0.11, trunkSy)[0], trunkU1: env.at(0.9, trunkSy)[0], plot: 11};
  const tree = treeField(b, tg);
  beat({id: 'c09-tree', at: G.tree, field: tree, sweep: {origin: [cu, cv], speed: 0.95, jitterS: 0.07, tintFollowsWave: true}});

  move(env, G.cube, G.unfold - G.cube, pushIn(base, 0.035), 'inOutSine');
  move(env, G.unfold, 1.7, frame(env, env.at(0.5, 0.5), 152, [0.5, 0.5]));
  move(env, G.tree - 0.1, 2.0, frame(env, env.at(0.5, 0.5), 157, [0.5, 0.5]));

  env.overlays.push({
    id: 'c09-card',
    from: G.cardAt,
    to: G.cardExit + 0.6,
    render: (t) => <ChapterCard index="09" kicker="nine repositories" title="Graphs a clause can walk." at={G.cardAt} exitAt={G.cardExit} t={t} kind="headline" maxWidth={0.4 * W} />,
  });
  env.cue(T.ch.start, 'idle', '');

  // ------------------------------------------------------------------ 09.1 tsetlin-zoo
  const zp = zooPics();
  const zooTL = env.at(0.405, 0.205);
  const zoo = zooField(b, {u: zooTL[0], v: zooTL[1]}, zp, false);
  const zooLit = zooField(b, {u: zooTL[0], v: zooTL[1]}, zp, true);
  // the first plot opens into the survey: a page of PAPER.md lines and the headline table
  beat({id: 'c09-zoo', at: Z.doc, field: zoo, sweep: {origin: plots[0], speed: 0.8, jitterS: 0.05, tintFollowsWave: true}});
  beat({id: 'c09-zoo-lit', at: Z.rows, field: zooLit, sweep: {...SWEEPS.raster([0, -1], 1.4), origin: [0.5, zooTL[1]]}});

  move(env, G.cardExit + 0.1, Z.doc - G.cardExit - 0.1, frame(env, plots[0], 118, [0.34, 0.42]));
  move(env, Z.doc + 0.05, 2.4, base);
  move(env, Z.doc + 2.6, Z.dolly - Z.doc - 2.6, pushIn(base, 0.04), 'inOutSine');
  move(env, Z.dolly, Z.dollyDur, base);

  plate(env, 'c09-zoo-plate', 'tsetlin-zoo', 'SURVEY DRAFT · DOCUMENTATION ONLY · NO CODE', Z.plate, Z.dolly + 0.2);
  env.cue(Z.plate, 'reading', 'Read tsetlin-zoo/PAPER.md');

  // the survey's own source paths, typed as its table gives them
  const srcRows: Array<[string, string]> = [
    ['95.05', 'paper-a-subword-dep-graphtm/experiments/paper_a_r8/seed_{42,123,456,789,1337}/summary.json'],
    ['94.77', 'paper-b-attention-distill-graphtm/results/paper_b_R8_5seeds.json'],
    ['94.53', 'decoder-attention-distill-graphtm/results/master_summary.json (phase1_qwen_r8)'],
  ];
  const srcAt = Z.paths;
  const srcExit = Z.axis + 4.2;
  env.overlays.push({
    id: 'c09-zoo-src',
    from: srcAt,
    to: srcExit + 0.5,
    render: (t) => (
      <Card t={t} at={srcAt} exitAt={srcExit} x={0.069 * W} y={0.215 * H} width={0.3 * W} kicker="source_file, as the table gives it">
        {srcRows.map(([v, p], i) => {
          const at = srcAt + 0.35 + i * 0.42;
          const n = Math.floor(Math.max(0, t - at) * 70);
          return (
            <div key={v} style={{marginTop: i ? Math.round(0.014 * H) : 0, opacity: fade(t, at, undefined, 0.3)}}>
              <div style={{fontFamily: MONO, fontWeight: 600, fontSize: Math.round(0.026 * H), color: color.text.display}}>{v}</div>
              <div style={{fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, wordBreak: 'break-all', lineHeight: 1.3}}>{p.slice(0, n)}</div>
            </div>
          );
        })}
      </Card>
    ),
  });
  chip(env, 'c09-chip-zoo-readme', 'tsetlin-zoo', 'README.md', '3-5', Z.plate + 0.5, Z.paths + 2.6, 0);
  chip(env, 'c09-chip-zoo-table', 'tsetlin-zoo', 'data/headline_table.json', '14, 43, 82', Z.paths + 0.2, Z.axis + 3.6, 1);
  chip(env, 'c09-chip-zoo-band', 'tsetlin-zoo', 'PAPER.md', '23-24', Z.bracket + 0.1, Z.caveat - 0.2, 0);
  chip(env, 'c09-chip-zoo-r8', 'tsetlin-zoo', 'data/headline_table.json', '160-163', Z.rows + 0.2, Z.caveat - 0.2, 1);
  chip(env, 'c09-chip-be-a', 'subword-dep-graphtm', 'experiments/train_paper_a_fast_from_precomputed.py', '168-178', Z.caveat + 0.1, Z.dolly + 1.0, 0);

  // ------------------------------------------------------------------ 09.2 subword-dep-graphtm
  const [su, sv] = env.at(0.668, 0.43);
  const subBare = picField(b, subPic({nodes: false, seq: false, deps: false}), su, sv);
  const subNodes = picField(b, subPic({nodes: true, seq: false, deps: false}), su, sv);
  const subSeq = picField(b, subPic({nodes: true, seq: true, deps: false}), su, sv);
  const subDeps = picField(b, subPic({nodes: true, seq: true, deps: true}), su, sv);
  // the walk along the wall: the survey slides out left, the next plot slides in from the right
  beat({id: 'c09-sub-plot', at: Z.dolly, field: subBare});
  env.live.push(treadmill(b, zooLit, subBare, Z.dolly, Z.dollyDur));
  const nodeU = (k: number) => uvOf(b, su, sv, subNodeX(k), 0);
  beat({id: 'c09-sub-nodes', at: B.nodes, field: subNodes, sweep: {...SWEEPS.raster([1, 0], 0.5), origin: [nodeU(0)[0] - 4 * b.p, sv]}});
  beat({id: 'c09-sub-seq', at: B.seq, field: subSeq, sweep: {...SWEEPS.raster([1, 0], 0.42), origin: [nodeU(0)[0], sv]}});
  beat({id: 'c09-sub-deps', at: B.deps, field: subDeps, sweep: {origin: nodeU(2), speed: 0.32, jitterS: 0.04}});
  move(env, Z.dolly + Z.dollyDur + 0.05, T.S3.start - Z.dolly - Z.dollyDur - 1.2, pushIn(frame(env, [su, sv], 150, [0.668, 0.43]), 0.04), 'inOutSine');

  plate(env, 'c09-sub-plate', 'subword-dep-graphtm', 'RESEARCH PROTOTYPE · 1 COMMIT · LOGS PARTLY INCOMPLETE', B.plate, T.S3.start + 0.3);
  env.cue(B.plate - 0.2, 'reading', 'Read subword-dep-graphtm/README.md');
  env.cue(B.strike - 0.25, 'writing', 'Edit README value: 95.05 → 94.91 (results file)');
  env.cue(B.misses + 0.2, 'reading', 'Read results/paper_a_subword_graphtm.json');

  // labels on the graph, pinned to the wall through the camera
  const relief = 22 * b.p;
  const scratch = {target: [0, 0, 0] as [number, number, number], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};
  const labelsTo = T.S3.start + 0.2;
  env.overlays.push({
    id: 'c09-sub-labels',
    from: B.nodes,
    to: labelsTo + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, labelsTo - 0.6, undefined, 0.5);
      SUB_TOKENS.forEach((tok, k) => {
        const [u, v] = uvOf(b, su, sv, subNodeX(k), -6.2);
        const [x, y] = screenOf(env.camera, t, [wallPoint(b, u, v)[0], wallPoint(b, u, v)[1], 0.1 * relief], W, H, scratch);
        out.push(<Tag key={tok} x={x} y={y} text={tok} sizeH={0.03} opacity={fade(t, B.nodes + 0.12 * k, undefined, 0.3) * gone} weight={500} />);
      });
      for (let k = 0; k < 4; k++) {
        const [u, v] = uvOf(b, su, sv, (subNodeX(k) + subNodeX(k + 1)) / 2, -3.4);
        const [x, y] = screenOf(env.camera, t, wallPoint(b, u, v, 0.05), W, H, scratch);
        out.push(<Tag key={`s${k}`} x={x} y={y} text="seq_next" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, B.seq + 0.1 * k, undefined, 0.3) * gone} />);
      }
      const arcTop = 3.5 + SUB_ARC_BULGE + 1.6;
      ([[1, 'dep:nsubj'], [3, 'dep:advmod']] as Array<[number, string]>).forEach(([kk, lab]) => {
        const [u, v] = uvOf(b, su, sv, (subNodeX(kk) + subNodeX(2)) / 2, arcTop);
        const [x, y] = screenOf(env.camera, t, wallPoint(b, u, v, 0.5), W, H, scratch);
        out.push(<Tag key={lab} x={x} y={y} text={lab} sizeH={0.024} colorText={mint} anchor="bottom" opacity={fade(t, B.deps + 0.3, undefined, 0.35) * gone} />);
      });
      return <>{out}</>;
    },
  });

  // the results file's own rows, the misses at the same size as the win
  const cardAt = B.misses - 0.1;
  const cardExit = T.S3.start - 0.4;
  env.overlays.push({
    id: 'c09-sub-card',
    from: cardAt,
    to: cardExit + 0.5,
    render: (t) => (
      <Card t={t} at={cardAt} exitAt={cardExit} x={0.069 * W} y={0.255 * H} kicker="results/paper_a_subword_graphtm.json">
        <Row t={t} at={cardAt + 0.15} kind="win" sizeH={0.026}>{'R8             94.91 ± 0.44'}</Row>
        <Row t={t} at={cardAt + 0.45} kind="miss" sizeH={0.026}>{'MR             50.0 · failed'}</Row>
        <Row t={t} at={cardAt + 0.7} kind="miss" sizeH={0.026}>{'20 Newsgroups  3.33 · failed'}</Row>
      </Card>
    ),
  });
  chip(env, 'c09-chip-sub-graph', 'subword-dep-graphtm', 'README.md', '50-60', B.plate + 0.4, B.deps + 2.0, 0);
  chip(env, 'c09-chip-sub-code', 'subword-dep-graphtm', 'src/graphtm/subword_dep_graph.py', '122-154', B.seq + 0.2, B.bar - 0.3, 1);
  chip(env, 'c09-chip-sub-res', 'subword-dep-graphtm', 'results/paper_a_subword_graphtm.json', '5-13', B.bar + 0.1, B.misses + 3.4, 0);
  chip(env, 'c09-chip-sub-readme', 'subword-dep-graphtm', 'README.md', 11, B.readme, B.misses + 3.4, 1);

  return {zooLit, subDeps, su, sv, tree, plots, cu, cv};
};
