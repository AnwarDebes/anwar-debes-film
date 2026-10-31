import React from 'react';
import type {ChapterModule, ChapterSpec, FilmCtx} from '../types';
import {FilmGuide} from '../guide';
import {presetCell} from '../../pixie/presets';
import {makeEnv, restWorld} from './ch09/env';
import {times09} from './ch09/times';
import {sceneA} from './ch09/sceneA';
import {sceneB} from './ch09/sceneB';
import {sceneC} from './ch09/sceneC';
import {sceneD} from './ch09/sceneD';
import {R8Axis, type AxisBracket, type AxisMark} from './ch09/axis';
import {RuleLine} from './ch09/kit/ui';

// Chapter 09, "Graphs a clause can walk": the graph Tsetlin family, read as graphs, with one
// persistent R8 axis, and a deep dive into graphtm-cbr that ends on RDKit's own count.

/** Repositories lit on the rule line before this chapter (chapters 01-08). */
const RULE_BEFORE = 24;

const build = (ctx: FilmCtx): ChapterSpec => {
  const env = makeEnv(ctx);
  const T = times09(ctx.tl);
  const {W, H} = env;

  const marks: AxisMark[] = [
    {id: 'sub', at: T.sub.bar, value: 94.91, whisker: 0.44, label: '94.91 results', row: 0},
    {id: 'readme', at: T.sub.readme, value: 95.05, label: '95.05 README', row: 1, align: 'left', kind: 'steel', strikeAt: T.sub.strike},
  ];
  const brackets: AxisBracket[] = [
    {id: 'zoo', at: T.zoo.bracket, lo: 94.53, hi: 95.05, place: 'above', label: '94.53 – 95.05 · a 0.52-point band (survey: “roughly 1 point”)', exitAt: T.sub.bar - 0.4},
  ];

  const a = sceneA(env, T);
  const b = sceneB(env, T, a, marks, brackets);
  const c = sceneC(env, T, b.reviewField);
  sceneD(env, T, c);

  // the R8 axis: 09.1 to 09.4; its caveat is read in full before it retires
  env.overlays.push({
    id: 'c09-axis',
    from: T.zoo.axis,
    to: T.dec.axisExit + 0.6,
    render: (t) => <R8Axis t={t} at={T.zoo.axis} exitAt={T.dec.axisExit} marks={marks} brackets={brackets} caveatAt={T.zoo.caveat} caveatFull={T.dec.caveatFull} />,
  });

  // the rule line and the guide, across the chapter
  const ch = T.ch;
  restWorld(env, ch.start, ch.end);
  const arrivals = [...env.arrivals].sort((x, y) => x - y);
  env.overlays.push({
    id: 'c09-rule',
    from: ch.start,
    to: ch.end,
    render: (t) => <RuleLine t={t} before={RULE_BEFORE} arrivals={arrivals} hidden={env.ruleHidden} from={ch.start - 1} to={ch.end + 1} />,
  });
  const u = presetCell('corner', H);
  const guideY = Math.round(0.88 * H) - 32 * u;
  const overlays = [
    ...env.overlays,
    ...env.top,
    {
      id: 'c09-guide',
      from: ch.start,
      to: ch.end,
      render: () => <FilmGuide preset="corner" side="right" x={Math.round(0.02 * W)} y={guideY} />,
    },
  ];

  return {
    beats: env.beats,
    camera: env.camera,
    focus: env.focus,
    light: env.light,
    ripples: env.ripples,
    presses: env.presses,
    magnets: env.magnets,
    live: env.live,
    world: env.world,
    overlays,
    captionSkip: env.captionSkip,
    pixie: env.pixie,
  };
};

export const chapter: ChapterModule = {id: '09', build};
