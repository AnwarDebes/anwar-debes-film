import React from 'react';
import type {ChapterModule} from '../types';
import {makeBuilder} from './ch06/kit/builder';
import {LowerThirdGuide} from './ch06/kit/guide';
import {RuleLine66} from './ch06/kit/overlays';
import type {Look} from './ch06/kit/shapes';
import {buildGateAndBlocking} from './ch06/reins';
import {buildRepair} from './ch06/repair';
import {buildCases} from './ch06/cases';
import {buildNumbers} from './ch06/numbers';
import {buildThgtm} from './ch06/thgtm';
import {buildPlate} from './ch06/plate';
import {times06} from './ch06/times';
import {beats06} from './ch06/beats';

// Chapter 06, "After the alarm": what a system does after it detects something. REINS repairs
// the action (06.1-06.4), THGTM remembers the past (06.5), and the clause family fills one gate
// plate socket by socket (06.6-06.9).

/** Repositories lit on the rule line before this chapter (the storyboard's order of first appearance). */
const LIT_BEFORE = 13;

/** The places' ground: a shade under bare steel, so raised plates read against it. */
const GROUND: Look = {h: 0, tint: 0.74};

export const chapter: ChapterModule = {
  id: '06',
  build: (ctx) => {
    const T = times06(ctx.tl);
    const B = beats06(T);
    const b = makeBuilder(ctx, '06');

    buildGateAndBlocking(b, T, GROUND);
    const repair = buildRepair(b, T, GROUND, B);
    buildCases(b, T, GROUND, repair, B);
    buildNumbers(b, T, GROUND, B);
    buildThgtm(b, T, GROUND, B);
    // (ends on the bare wall and the handoff pose)
    buildPlate(b, T, GROUND, B);

    // Pixie scurries on to the plate with the lateral dolly, and back once the scoreboard is up
    const walk = [
      {fromX: 0, toX: 3, startFrame: b.f(T.s6.start - 1.0)},
      {fromX: 3, toX: 0, startFrame: b.f(T.s9.board + 0.4), arriveFacing: 'right' as const},
    ];

    // the rule line: this chapter's six pins light as their name plates appear
    const lights = [T.s1.plate, T.s5.plate, T.s6.plate, T.s7.plate, T.s8.plate, T.s9.plate];
    b.overlay('rule-line', T.ch.start, T.ch.end, (t) => <RuleLine66 t={t} litBefore={LIT_BEFORE} lights={lights} />);
    b.overlay('guide', T.ch.start, T.ch.end, () => <LowerThirdGuide walk={walk} />);
    return b.spec();
  },
};
