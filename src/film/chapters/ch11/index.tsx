import React from 'react';
import type {ChapterSpec, FilmCtx, TimedNode} from '../../types';
import type {PixieCue} from '../../../pixie';
import {mergeParts, type PartSpec} from '../ch07/kit/spec';
import {RuleLine, repoIndex} from '../ch07/kit/RuleLine';
import {CornerGuide} from '../ch07/kit/guide';
import {times11, type Times11} from './times';
import {scene1100} from './s0Plate';
import {scene1102} from './s2DiTM';
import {scene1103, scene1104, scene1105, scene1106} from './s3Promises';
import {scene1107} from './s7Remember';

// Chapter 11, Promises: DiTM, ConfTM, RobTM, CCTM, FedTM and lifelong-tm. One learner, six
// promises, one plate; all six are prototypes tested on synthetic data only.

export const pixie11 = (ctx: FilmCtx, T: Times11): PixieCue[] => {
  const f = (s: number) => ctx.tl.f(s);
  const {g, t1, t2, t3, t4, t5, t6, t7} = T;
  return [
    {frame: f(g.cardIn), activity: 'idle', detail: ''},
    {frame: f(t1.chips), activity: 'reading', detail: 'Read six READMEs (data sections)'},
    {frame: f(t2.flips), activity: 'reading', detail: 'Read ditm/forward.py'},
    {frame: f(t2.stepsEnd + 0.1), activity: 'success', detail: '8 steps: noise → sample'},
    {frame: f(t2.readme), activity: 'reading', detail: 'Read results/generation.json'},
    {frame: f(t3.plate), activity: 'thinking', detail: 'Planning a 90% label set…'},
    {frame: f(t4.plate), activity: 'reading', detail: 'Read results/certified_radius.json'},
    {frame: f(t5.plate), activity: 'reading', detail: 'Read cctm/causal.py'},
    {frame: f(t6.plate), activity: 'reading', detail: 'Read results/privacy_accuracy.json'},
    {frame: f(t6.twenty - 0.3), activity: 'writing', detail: 'Edit README: ε 13.7 → 20 at 4 per round'},
    {frame: f(t7.plate), activity: 'reading', detail: 'Read results/synthetic_drift_5seed.json'},
    {frame: f(t7.measured - 0.3), activity: 'idle', detail: ''},
  ];
};

const layers = (ctx: FilmCtx, T: Times11): PartSpec => {
  const {ch} = T;
  const f = (s: number) => ctx.tl.f(s);
  const overlays: TimedNode[] = [
    {
      id: 'c11-rule',
      from: ch.start,
      to: ch.end,
      render: (t) => (
        <RuleLine
          t={t}
          litBefore={repoIndex('DiTM')}
          lights={[
            {repo: 'DiTM', at: T.t2.plate},
            {repo: 'ConfTM', at: T.t3.plate},
            {repo: 'RobTM', at: T.t4.plate},
            {repo: 'CCTM', at: T.t5.plate},
            {repo: 'FedTM', at: T.t6.plate},
            {repo: 'lifelong-tm', at: T.t7.plate},
          ]}
          hide={[[T.t2.perFeature - 0.3, T.t2.noise]]}
        />
      ),
    },
    {id: 'c11-guide', from: ch.start, to: ch.end, render: () => <CornerGuide enterAt={f(T.g.at + 0.4)} exitAt={f(T.t7.clear + 0.3)} />},
  ];
  return {overlays};
};

export const build11 = (ctx: FilmCtx): ChapterSpec => {
  const T = times11(ctx.tl);
  return mergeParts(
    layers(ctx, T),
    {pixie: pixie11(ctx, T), focus: [{at: T.ch.start, to: 'target', aperture: 0}]},
    scene1100(ctx, T),
    scene1102(ctx, T),
    scene1103(ctx, T),
    scene1104(ctx, T),
    scene1105(ctx, T),
    scene1106(ctx, T),
    scene1107(ctx, T),
  );
};
