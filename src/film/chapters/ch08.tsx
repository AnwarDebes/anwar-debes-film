import React from 'react';
import type {ChapterModule} from '../types';
import {makeBuilder} from './ch06/kit/builder';
import {LowerThirdGuide} from './ch06/kit/guide';
import {RuleLine66} from './ch06/kit/overlays';
import {times08} from './ch08/times';
import {beats08} from './ch08/beats';
import {buildLucid} from './ch08/lucid';
import {buildScore} from './ch08/score';
import {buildNexus} from './ch08/nexus';

// Chapter 08, "The rules": two game agents and one empty placeholder. LUCID must discover the
// rules of games it has never seen (08.1-08.5), RL holds only a one-line description (08.6), and
// NEXUS in RL-CCA copies the tournament referee to the letter (08.7). The chapter shares its
// building kit with chapter 06 (src/film/chapters/ch06/kit).

/** Repositories lit on the rule line before this chapter (the storyboard's order of first appearance). */
const LIT_BEFORE = 21;

export const chapter: ChapterModule = {
  id: '08',
  build: (ctx) => {
    const T = times08(ctx.tl);
    const B = beats08(T);
    const b = makeBuilder(ctx, '08');

    const lucid = buildLucid(b, T, B, 0.74);
    buildScore(b, T, B, lucid.ground);
    buildNexus(b, T, B, lucid.ground, {X: lucid.fatalXY[0], Y: lucid.fatalXY[1]});

    // the rule line: this chapter's three pins light as their name plates appear
    const lights = [T.s1.plate, T.s6.plate, T.s7.plate];
    // hidden while the dense code panels and the terminal are up
    const hidden: Array<[number, number]> = [
      [T.s2.ends - 0.2, B.bfsAt],
      [T.s5.start - 0.3, T.s5.end - 0.3],
    ];
    const vis = (t: number) => {
      let k = 1;
      for (const [a, z] of hidden) {
        const into = Math.min(1, Math.max(0, (t - a) / 0.4));
        const out = Math.min(1, Math.max(0, (t - z) / 0.4));
        k = Math.min(k, 1 - into + out);
      }
      return k;
    };
    b.overlay('rule-line', T.ch.start, T.ch.end, (t) => <RuleLine66 t={t} litBefore={LIT_BEFORE} lights={lights} visible={vis(t)} />);
    b.overlay('guide', T.ch.start, T.ch.end, () => <LowerThirdGuide />);
    return b.spec();
  },
};
