import React from 'react';
import type {ChapterModule, ChapterSpec, FilmCtx} from '../types';
import {FilmGuide} from '../guide';
import {presetCell} from '../../pixie/presets';
import {color} from '../../engine/tokens';
import {makeEnv, restWorld} from './ch09/env';
import {RuleLine, Tag, fade} from './ch09/kit/ui';
import {times12} from './ch12/times';
import {scenes12} from './ch12/scenes';
import {BandRuler, type NoBand, type RulerEntry} from './ch12/ruler';

// Chapter 12, "Models of the everyday": eight simulators of physics and arithmetic on one street,
// each measured on the published-band ruler where it has a band, and labelled where it has none.

/** Repositories lit on the rule line before this chapter (chapters 01-11). */
const RULE_BEFORE = 47;

const build = (ctx: FilmCtx): ChapterSpec => {
  const env = makeEnv(ctx);
  const T = times12(ctx.tl);
  const {W, H} = env;
  const ruler = {entries: [] as RulerEntry[], noBand: [] as NoBand[], hide: [] as Array<[number, number]>};

  scenes12(env, T, ruler);

  // the ruler: from 12.1 to the end, stepping aside while the live capture plays
  const rulerAt = T.street.ruler;
  const rulerExit = T.thermo.out;
  env.overlays.push({
    id: 'c12-ruler',
    from: rulerAt,
    to: rulerExit + 0.6,
    render: (t) => {
      let vis = 1;
      for (const [a, b] of ruler.hide) vis *= 1 - Math.min(fade(t, a, undefined, 0.35), 1 - fade(t, b, undefined, 0.45));
      if (vis <= 0.002) return null;
      return (
        <div style={{position: 'absolute', inset: 0, opacity: vis}}>
          <BandRuler t={t} at={rulerAt} exitAt={rulerExit} entries={ruler.entries} noBand={ruler.noBand} lightAll={T.thermo.arithmetic - 0.6} />
        </div>
      );
    },
  });
  // the film's own framing, standing for the whole chapter
  const chipAt = T.street.chip;
  env.overlays.push({
    id: 'c12-standing',
    from: chipAt,
    to: T.thermo.out + 0.6,
    render: (t) => <Tag x={Math.round(0.931 * W)} y={Math.round(0.072 * H)} text="PROTOTYPE · NOT MEDICAL OR SAFETY ADVICE (the film's label)" sizeH={0.022} align="right" bg colorText={color.text.chipDim} tracking={0.04} opacity={fade(t, chipAt, T.thermo.out, 0.45, 0.5)} />,
  });

  const ch = T.ch;
  restWorld(env, ch.start, ch.end);
  const arrivals = [...env.arrivals].sort((a, b) => a - b);
  env.overlays.push({
    id: 'c12-rule',
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
      id: 'c12-guide',
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

export const chapter: ChapterModule = {id: '12', build};
