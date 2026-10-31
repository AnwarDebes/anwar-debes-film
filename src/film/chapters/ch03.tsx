import React from 'react';
import type {ChapterModule, FilmCtx} from '../types';
import {clock} from './ch03/kit/time';
import {SpecAcc} from './ch03/kit/spec';
import {handoffPose} from './ch03/kit/camera';
import {RuleLine} from './ch03/kit/RuleLine';
import {guideNodes} from './ch03/kit/guide';
import {buildGateAndSession} from './ch03/s01';
import {buildGuard} from './ch03/s02';
import {buildMonitors} from './ch03/s03';
import {buildBlockedAndLedger} from './ch03/s04';
import {buildCheck} from './ch03/s06';
import {buildPayoff} from './ch03/s07';
import {RULE_INDEX} from './ch03/common';
import type {SceneKit} from './ch03/scene';
import {cues} from './ch03.cues';

// Chapter 03 · trace · "The session wasn't." Every call looks normal and the session is not.
// TRACE reads text with clauses, watches tool calls with monitors bounded in memory, and writes a
// hash-chained ledger the film re-checks itself; its main failure is said out loud.

const build = (ctx: FilmCtx) => {
  const c = clock(ctx.tl);
  const acc = new SpecAcc('c03-');
  const aspect = ctx.width / ctx.height;
  const home = handoffPose(ctx.board, aspect);
  const k: SceneKit = {ctx, board: ctx.board, aspect, c, acc, home};
  const ch = c.tl.chapter('03');

  buildGateAndSession(k);
  buildGuard(k);
  buildMonitors(k);
  buildBlockedAndLedger(k);
  buildCheck(k);
  buildPayoff(k);

  // the chapter hands chapter 04 the mint thread from the website's guard (03.7), on the default pose
  acc.camera.push({at: ch.end - 2.3, dur: 2.3, pose: home, ease: 'camera'});
  acc.light.push({at: ch.end - 2.0, dur: 1.9, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1});

  // the guide and the rule line run under the whole chapter; the line steps aside for dense code
  const S = (id: string) => c.sc(id);
  const plateAt = S('03.1').start + 0.25;
  const hidden: Array<[number, number]> = [
    [c.w('u0305', 'monitors'), c.u('u0306').start],
    [c.w('u0308', 'monitor'), c.u('u0309').start],
    [c.w('u0310', 'stopped'), S('03.5').start],
    [c.u('u0315').start - 0.2, S('03.6').start - 0.4],
    [S('03.6').start, c.u('u0318').start - 0.3],
  ];
  acc.overlay({id: 'rule', from: ch.start, to: ch.end, render: (t) => <RuleLine t={t} litBefore={RULE_INDEX} arrivals={[{index: RULE_INDEX, at: plateAt}]} hidden={hidden} from={ch.start} to={ch.end + 1} />});
  // the guide's card steps aside while the chapter card is up
  acc.overlays.push(...guideNodes(acc.prefix, ch.start, ch.end, c.sc('03.0').start, c.sc('03.0').end - 0.15, c.f));

  const sound = cues(ctx.tl);
  return {...acc.spec(), sfx: sound.sfx, music: sound.music};
};

export const chapter: ChapterModule = {id: '03', build};
