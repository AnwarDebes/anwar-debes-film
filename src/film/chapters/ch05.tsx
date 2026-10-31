import React from 'react';
import type {ChapterModule, FilmCtx} from '../types';
import {HANDOFF} from '../handoff';
import type {FieldFn} from '../../engine/pins';
import {paper} from './ch05/s01';

const PAPER_GROUND = paper();
import {clock} from './ch03/kit/time';
import {SpecAcc} from './ch03/kit/spec';
import {handoffPose} from './ch03/kit/camera';
import {RuleLine} from './ch03/kit/RuleLine';
import {guideNodes} from './ch03/kit/guide';
import type {SceneKit} from './ch03/scene';
import {buildGateAndBox} from './ch05/s01';
import {buildRows} from './ch05/s02';
import {buildGlassBox} from './ch05/s03';
import {buildNumbers} from './ch05/s04';
import {buildCheckAndPayoff} from './ch05/s05';
import {RULE_INDEX} from './ch05/common';
import {GuideShade} from './ch05/ink';
import {env} from './ch03/kit/ui';
import {cues} from './ch05.cues';

// Chapter 05 · candor · "The forward pass." Explanations are usually written afterwards; CANDOR
// builds the explanation into the network: named concepts, a measured leak, a legible twin, and a
// per-input certificate that cannot under-report. The misses get equal screen time.

const build = (ctx: FilmCtx) => {
  const c = clock(ctx.tl);
  const acc = new SpecAcc('c05-');
  const aspect = ctx.width / ctx.height;
  const home = handoffPose(ctx.board, aspect);
  const k: SceneKit = {ctx, board: ctx.board, aspect, c, acc, home};
  const ch = c.tl.chapter('05');

  // on the pale wall the guide's white card sits on a soft dark corner (under every scene layer)
  const pale = c.sc('05.0').start + 1.2;
  acc.overlay({id: 'guide-shade', from: pale - 0.2, to: ch.end, render: (t) => <GuideShade k={env(t, pale, 1.0, ch.end - 1.6, 1.0)} />});

  buildGateAndBox(k);
  buildRows(k);
  buildGlassBox(k);
  buildNumbers(k);
  buildCheckAndPayoff(k);

  // the paper palette drains back to charcoal from the edges in, and the light comes down
  const edges: FieldFn = (u, v, i) => (Math.abs(u - 0.5) > 0.27 || Math.abs(v - 0.5) > 0.27 ? HANDOFF(u, v, i) : PAPER_GROUND(u, v, i));
  acc.beat({id: 'drain-edges', at: ch.end - 2.2, field: edges, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.8, jitterS: 0.04, tintFollowsWave: true}, tintTauS: 0.35});
  acc.beat({id: 'end', at: ch.end - 1.3, field: HANDOFF, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.8, jitterS: 0.04, tintFollowsWave: true}, tintTauS: 0.35});
  acc.camera.push({at: ch.end - 1.6, dur: 1.6, pose: home, ease: 'camera'});
  acc.light.push({at: ch.end - 1.9, dur: 1.8, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1});

  const S = (id: string) => c.sc(id);
  const plateAt = c.u('u0502').start - 0.1;
  const hidden: Array<[number, number]> = [
    [c.w('u0503', 'reads'), c.u('u0504').start - 0.3],
    [c.w('u0505', 'delta'), S('05.3').start - 0.3],
    [S('05.5').start - 0.1, c.w('u0518', 'script') - 0.2],
  ];
  acc.overlay({id: 'rule', from: ch.start, to: ch.end, render: (t) => <RuleLine t={t} litBefore={RULE_INDEX} arrivals={[{index: RULE_INDEX, at: plateAt}]} hidden={hidden} from={ch.start} to={ch.end + 1} />});
  // the guide's card steps aside while the chapter card is up
  acc.overlays.push(...guideNodes(acc.prefix, ch.start, ch.end, c.sc('05.0').start, c.sc('05.0').end - 0.15, c.f));

  const sound = cues(ctx.tl);
  return {...acc.spec(), sfx: sound.sfx, music: sound.music};
};

export const chapter: ChapterModule = {id: '05', build};
