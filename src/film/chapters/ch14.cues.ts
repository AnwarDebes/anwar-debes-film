import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music} from '../../engine/audio/cues';
import {times14} from './ch14/times';

// Chapter 14 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Catalyst (from 1:50) builds under the box, the map and the ledger and lands on the rule and the
// glass box; Stars In Her Skies (0:00-0:24) plays under the credits.

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times14(tl);
  const f = (s: number) => Math.round(s * tl.fps);
  const out: SfxCue[] = [];
  const add = (c: SfxCue) => out.push({...c, id: `c14-${c.id ?? `${c.type}@${c.frame}`}`});

  // 14.0 the closed box: a soft impact on frame 0, a brush as it rises
  add(cue.impact(f(T.gate.start), {id: 'gate-impact'}));
  add(cue.pinBrush(f(T.gate.rise), {id: 'box-rise', durS: 1.2, shape: 'rise', level: -17}));
  add(cue.note(f(T.gate.cardIn + 0.2), 1, {id: 'card', octave: 4, level: -18}));

  // 14.1 a tick per QA gate that passes
  for (let k = 0; k < 4; k++) add(cue.tick(f(T.video.done + 0.25 + k * 0.3), {id: `qa${k}`, level: -21}));

  // 14.2 silence on the empty board; two tinks; a bright D on 66 / 66
  add(cue.pinTick(f(T.pair.logo), {id: 'fork1', level: -18}));
  add(cue.pinTick(f(T.pair.metadata), {id: 'fork2', level: -18}));
  add(cue.note(f(T.pair.full), 'D5', {id: 'sixty-six', level: -15}));

  // 14.3 one note per line style as it first draws
  add(cue.whoosh(f(T.map.pull + 0.4), {id: 'pull-back', durS: 2.4, level: -22}));
  add(cue.note(f(T.map.solid), 1, {id: 'solid', level: -18}));
  add(cue.tick(f(T.map.dotted), {id: 'dotted', level: -19}));
  add(cue.tick(f(T.map.dashed), {id: 'dashed', level: -17}));

  // 14.4 the press thud and the ripple's cascade
  add(cue.subHit(f(T.spring.press), {id: 'press', level: -18}));
  add(cue.pinBrush(f(T.spring.press + 0.05), {id: 'ripple1', durS: 1.6, shape: 'fall', level: -18}));
  add(cue.pinBrush(f(T.spring.side + 1.05), {id: 'ripple2', durS: 1.6, shape: 'fall', level: -18}));

  // 14.5 a quiet tick roll as the chain fills, keys on the terminal, a chime on the head hash
  for (let k = 0; k < 12; k++) add(cue.tick(f(T.ledger.chain + 0.3 + k * ((T.ledger.hashed - T.ledger.chain - 0.3) / 12)), {id: `chain${k}`, level: -26}));
  add(cue.typing(f(T.ledger.clones), [0, 0.08, 0.17, 0.24, 0.33, 0.41, 0.5], {id: 'keys', level: -22}));
  add(cue.chime(f(T.ledger.match), {id: 'match', level: -16}));

  // 14.6 a bright cascade along the line on "rule"
  add(cue.pinBrush(f(T.rule.rule), {id: 'rule', durS: 0.8, shape: 'rise', level: -15}));

  // 14.7 a rising sweep at the glass reveal
  add(cue.riser(f(T.glass.clear + 0.6), 1.6, {id: 'glass', level: -17}));

  const m: MusicCue[] = [
    music('catalyst', T.gate.start, T.card.end, {id: 'c14-music-catalyst', offset: 110, fadeIn: 0.8, fadeOut: 1.0, level: -8}),
    music('stars-in-her-skies', T.credits.start, T.credits.end, {id: 'c14-music-stars', offset: 0, fadeIn: 0.3, fadeOut: 3, level: -8}),
  ];
  return {sfx: out, music: m};
};
