import React from 'react';
import type {ChapterModule, ChapterSpec, FilmCtx, TimedNode} from '../types';
import {buildOpening} from './ch02/opening';
import {buildAnchor} from './ch02/anchor';
import {buildLive} from './ch02/live';
import {LowerThird} from './ch01/guide';
import {RuleLine} from './ch01/ruleLine';
import {ruleTimes} from './ch01/plates';
import {makeStage, mergeParts, type Part} from './ch01/stage';

// Chapter 02, Before the runs: glassbox-lm, a language model you can read, and the most honest
// answer in the film. Twenty-four hypotheses registered before the anchor run, the main goal missed
// out loud, sixty-seven more written down after the miss, counting turned out to be a clause vote,
// and the count floor rebuilt in a browser tab whose tests the film runs from a fresh clone.

const build = (ctx: FilmCtx): ChapterSpec => {
  const st = makeStage(ctx);
  const tl = ctx.tl;
  const ch = tl.chapter('02');
  const litAt = ruleTimes(tl);
  const dense: Array<[number, number]> = [
    [tl.utt('u0204').start - 0.7, tl.utt('u0205').start + 0.7],
    [tl.utt('u0217').start - 0.5, tl.utt('u0218').start + 1.1],
  ];
  const ruleOpacity = (t: number) => {
    let k = 1;
    for (const [a, b] of dense) if (t > a && t < b) k = Math.min(k, Math.max(0, 1 - Math.min(t - a, b - t) / 0.4));
    return k;
  };
  const rule: TimedNode = {id: 'c02-rule', from: ch.start, to: ch.end, render: (t) => <RuleLine t={t} litAt={litAt} opacity={ruleOpacity(t)} />};
  const s0 = tl.scene('02.0');
  const guide: TimedNode = {
    id: 'c02-guide',
    from: ch.start,
    to: ch.end,
    render: () => <LowerThird cardHidden={[[st.f(s0.start - 0.2), st.f(s0.end - 0.2)]]} />,
  };
  const parts: Part[] = [buildOpening(st), buildAnchor(st), buildLive(st), {overlays: [rule, guide]}];
  return mergeParts(parts);
};

export const chapter: ChapterModule = {id: '02', build};
