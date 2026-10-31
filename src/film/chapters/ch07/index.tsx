import React from 'react';
import type {ChapterSpec, FilmCtx, TimedNode} from '../../types';
import {resolveTimeline} from '../../../pixie';
import {mergeParts, type PartSpec} from './kit/spec';
import {times07, type Times07} from './times';
import {pixie07} from './pixie';
import {scene0701} from './s01Terminal';
import {scene0702} from './s02Pixie';
import {scene0703} from './s03Harness';
import {scene0704} from './s04Session';
import {scene0705} from './s05Tests';
import {scene0706} from './s06Vsclaude';
import {WarmGrade} from './look';
import {Footnote} from './kit/ui';
import {RuleLine, repoIndex} from './kit/RuleLine';
import {CornerGuide} from './kit/guide';

// Chapter 07, Every step: Claude-Code-In-Motion and vsclaude. The midpoint turn, where the guide
// turns out to be one of the repositories.

/** Layers that run through the whole chapter: the warm grade, the disclaimer, the rule line, the guide. */
const chapterLayers = (ctx: FilmCtx, T: Times07): PartSpec => {
  const {ch} = T;
  const f = (s: number) => ctx.tl.f(s);
  const overlays: TimedNode[] = [
    {id: 'c07-grade', from: ch.start, to: ch.end, render: (t) => <WarmGrade t={t} from={T.g.at - 0.6} to={T.t6.cool + 1.6} />},
    {id: 'c07-disclaimer', from: T.g.cardOut, to: T.t6.cool + 0.6, render: (t) => <Footnote t={t} at={T.g.cardOut + 0.25} out={T.t6.cool} />},
    {
      id: 'c07-rule',
      from: ch.start,
      to: ch.end,
      render: (t) => (
        <RuleLine
          t={t}
          litBefore={repoIndex('Claude-Code-In-Motion')}
          lights={[
            {repo: 'Claude-Code-In-Motion', at: T.t2.plate},
            {repo: 'vsclaude', at: T.t6.plate},
          ]}
          hide={[
            [T.t2.codeIn, T.t2.codeOut],
            [T.t3.code, T.t3.sandbox],
            [T.t5.term, T.t5.thread],
          ]}
        />
      ),
    },
    // the guide sits in its corner box, except in 07.4, where it acts the session out at featured size
    {id: 'c07-guide-a', from: ch.start, to: T.t4.swingIn + 0.2, render: () => <CornerGuide enterAt={f(T.g.at + 0.4)} exitAt={f(T.t4.swingIn - 0.45)} />},
    {id: 'c07-guide-b', from: T.t4.swingOut + 0.3, to: ch.end, render: () => <CornerGuide enterAt={f(T.t4.swingOut + 0.45)} exitAt={f(T.t6.cool + 0.2)} />},
  ];
  return {overlays};
};

export const build07 = (ctx: FilmCtx): ChapterSpec => {
  const T = times07(ctx.tl);
  const pixie = pixie07(ctx.tl, T);
  const ptl = resolveTimeline(pixie, ctx.fps);
  return mergeParts(
    chapterLayers(ctx, T),
    // the lens starts and ends the chapter sharp (focus keys are film-wide)
    {pixie, focus: [{at: T.ch.start, to: 'target', aperture: 0}]},
    scene0701(ctx, T),
    scene0702(ctx, T, ptl),
    scene0703(ctx, T),
    scene0704(ctx, T),
    scene0705(ctx, T),
    scene0706(ctx, T, ptl),
  );
};
