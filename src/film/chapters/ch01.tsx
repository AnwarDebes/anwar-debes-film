import React from 'react';
import type {ChapterModule, ChapterSpec, FilmCtx, TimedNode} from '../types';
import {buildOpen} from './ch01/open';
import {buildSite} from './ch01/site';
import {buildProfile} from './ch01/profile';
import {buildMontage} from './ch01/montage';
import {buildXor} from './ch01/xor';
import {LowerThird} from './ch01/guide';
import {RuleLine} from './ch01/ruleLine';
import {ruleTimes} from './ch01/plates';
import {makeStage, mergeParts, type Part} from './ch01/stage';

// Chapter 01, True or false: the black box, the guide, the literal. The website comes first, then
// the profile and its map, the coursework, the first Tsetlin repositories and the XOR page.

const build = (ctx: FilmCtx): ChapterSpec => {
  const st = makeStage(ctx);
  const tl = ctx.tl;
  const ch = tl.chapter('01');
  const open = buildOpen(st);
  const site = buildSite(st, {pose: open.titlePose});
  const profile = buildProfile(st);
  const montage = buildMontage(st);
  const xor = buildXor(st);
  const litAt = ruleTimes(tl);
  const [c0, c1] = site.codeWindow;
  const wFalse = tl.word('u0128', 'false');
  const ruleOpacity = (t: number) => {
    const appear = Math.min(1, Math.max(0, (t - open.ruleAt) / 0.8));
    const underCode = t > c0 && t < c1 ? Math.max(0, 1 - Math.min(t - c0, c1 - t) / 0.4) : 1;
    const out = Math.min(1, Math.max(0, (ch.end - 0.3 - t) / 1.2));
    return appear * underCode * Math.max(0.35, out);
  };
  const rule: TimedNode = {
    id: 'c01-rule',
    from: open.ruleAt,
    to: ch.end,
    render: (t) => (
      <RuleLine t={t} litAt={litAt} opacity={ruleOpacity(t)} numerals={{from: open.ruleAt + 0.1, to: tl.scene('01.3').start + 2.5, text: '0 / 66'}} pulseAt={wFalse.start} />
    ),
  };
  const guide: TimedNode = {
    id: 'c01-guide',
    from: open.guideAt,
    to: ch.end,
    render: () => (
      <LowerThird
        enterAt={st.f(open.guideAt)}
        scurry={[[st.f(open.scurry[0]), st.f(open.scurry[1])]]}
        cardHidden={[[st.f(tl.scene('01.3').start - 0.2), st.f(tl.scene('01.3').end - 0.3)]]}
      />
    ),
  };
  const parts: Part[] = [open, site, profile, montage, xor, {overlays: [rule, guide]}];
  return mergeParts(parts);
};

export const chapter: ChapterModule = {id: '01', build};
