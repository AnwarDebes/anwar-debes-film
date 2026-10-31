import React from 'react';
import type {ChapterModule, FilmCtx} from '../types';
import {HANDOFF} from '../handoff';
import {clock} from './ch03/kit/time';
import {SpecAcc} from './ch03/kit/spec';
import {handoffPose} from './ch03/kit/camera';
import {RuleLine} from './ch03/kit/RuleLine';
import {guideNodes} from './ch03/kit/guide';
import type {SceneKit} from './ch03/scene';
import {buildGateAndProbes} from './ch04/s01';
import {buildPlace} from './ch04/s02';
import {buildCounterexampleAndRepair} from './ch04/s03';
import {buildFalseAlarmAndHardening} from './ch04/s05';
import {RULE_INDEX} from './ch04/common';
import {cues} from './ch04.cues';

// Chapter 04 · veritas · "Prove it." Testing samples; a proof covers every input. VERITAS compiles
// the same shipped guard into exact logic, finds a bypass his website's guard also lets through,
// repairs it with one weighted rule, re-checks the proof without the solver, and shows its own
// false alarm.

const build = (ctx: FilmCtx) => {
  const c = clock(ctx.tl);
  const acc = new SpecAcc('c04-');
  const aspect = ctx.width / ctx.height;
  const home = handoffPose(ctx.board, aspect);
  const k: SceneKit = {ctx, board: ctx.board, aspect, c, acc, home};
  const ch = c.tl.chapter('04');

  buildGateAndProbes(k);
  buildPlace(k);
  const cx = buildCounterexampleAndRepair(k);
  buildFalseAlarmAndHardening(k);

  // hand the next chapter a bare wall on the default pose
  acc.beat({id: 'end', at: ch.end - 1.0, field: HANDOFF, sweep: {kind: 'linear', origin: [0.5, 1], direction: [0, -1], speed: 1.0, jitterS: 0.04, tintFollowsWave: true}});
  acc.camera.push({at: ch.end - 1.6, dur: 1.6, pose: home, ease: 'camera'});
  acc.light.push({at: ch.end - 2.0, dur: 1.9, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1});

  const S = (id: string) => c.sc(id);
  const plateAt = S('04.2').start + 0.25;
  const hidden: Array<[number, number]> = [
    [c.w('u0407', 'solver') - 0.2, S('04.3').start],
    [cx.termAt, S('04.5').start - 0.2],
    [c.w('u0413', 'repair'), c.u('u0414').end],
  ];
  acc.overlay({id: 'rule', from: ch.start, to: ch.end, render: (t) => <RuleLine t={t} litBefore={RULE_INDEX} arrivals={[{index: RULE_INDEX, at: plateAt}]} hidden={hidden} from={ch.start} to={ch.end + 1} />});
  // the guide's card steps aside while the chapter card is up
  acc.overlays.push(...guideNodes(acc.prefix, ch.start, ch.end, c.sc('04.0').start, c.sc('04.0').end - 0.15, c.f));

  const sound = cues(ctx.tl);
  return {...acc.spec(), sfx: sound.sfx, music: sound.music};
};

export const chapter: ChapterModule = {id: '04', build};
