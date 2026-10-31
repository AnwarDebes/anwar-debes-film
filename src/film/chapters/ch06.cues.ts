import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music} from '../../engine/audio/cues';
import {times06} from './ch06/times';
import {beats06} from './ch06/beats';

// Chapter 06 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): one transition sound per cut, tonal event notes on visual beats, soft
// pin ticks on sweeps, blips on citation chips, chimes only on a printed pass, no error buzz
// (none of this chapter's misses is one of the film's four hard truths).

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times06(tl);
  const B = beats06(T);
  const f = (s: number) => Math.round(s * tl.fps);
  const out: SfxCue[] = [];
  const add = (c: SfxCue, id: string) => out.push({...c, id: `c06-${id}`});

  // ---------------------------------------------------------------- 06.0 the gate (sink)
  add(cue.swell(f(T.gate.frame0), 1.4, {toneDegree: 1}), 'gate-swell');
  add(cue.impact(f(T.gate.frame0)), 'gate-impact');
  add(cue.pinBrush(f(T.gate.frame0 + 0.05), {durS: 1.1, shape: 'fall', level: -16}), 'gate-pins');
  add(cue.whoosh(f(T.gate.descentTo - 0.6), {durS: 1.6, level: -14}), 'gate-descent');
  // the alarm pin's blink
  for (let k = 0; k < 4; k++) add(cue.pinTick(f(T.gate.alarmFrom + k * 0.5), {level: -24, tau: 0.08}), `alarm-${k}`);

  // ---------------------------------------------------------------- the rule line: one soft note per arrival
  const lights = [T.s1.plate, T.s5.plate, T.s6.plate, T.s7.plate, T.s8.plate, T.s9.plate];
  lights.forEach((t, k) => add(cue.note(f(t), 5, {velocity: 0.5, level: -20}), `rule-${k}`));

  // ---------------------------------------------------------------- 06.1 blocking
  const s1 = T.s1;
  add(cue.subHit(f(s1.stops), {level: -16}), 'block-thud');
  add(cue.stamp(f(s1.stops + 0.03), {level: -22}), 'block-metal');
  add(cue.pinBrush(f(s1.third - 0.15), {durS: 0.7, shape: 'rise', level: -20}), 'bars-rise');
  add(cue.note(f(s1.third + 0.35), 2, {velocity: 0.55, level: -18}), 'bars-note');

  // ---------------------------------------------------------------- 06.2 the repair search
  const s2 = T.s2;
  add(cue.pinBrush(f(s2.lift), {durS: 0.9, shape: 'bell', level: -18}), 'monitors');
  for (let k = 0; k < 5; k++) add(cue.swish(f(s2.price + k * 0.14), {durS: 0.18, level: -24}), `card-${k}`);
  add(cue.note(f(B.fallAt), 3, {octave: 6, decay: 0.35, velocity: 0.35, level: -22}), 'fall');
  add(cue.note(f(B.chosenAt), 5, {velocity: 0.7, level: -15}), 'chosen');
  add(cue.typing(f(s2.noSafe - 0.2), [0.05, 0.16, 0.24, 0.37, 0.46, 0.6, 0.71, 0.83, 0.95, 1.1], {level: -24}), 'code-keys');
  add(cue.whoosh(f(B.diagFrom), {durS: 1.0, level: -18}), 'diagram');
  add(cue.blip(f(B.diagFrom + 1.9), 3, {level: -20}), 'packet-call');

  // ---------------------------------------------------------------- 06.3 the case studies
  const s3 = T.s3;
  add(cue.whoosh(f(s3.c1 - 0.5), {durS: 0.8, level: -18}), 'slide-down');
  add(cue.tick(f(s3.slid), {level: -18}), 'seat-auth');
  B.steps2.slice(1).forEach((t, k) => add(cue.tick(f(t + 0.05), {level: -20}), `countdown-${k}`));
  add(cue.tick(f(B.auditAt), {level: -18}), 'seat-audit');
  add(cue.swish(f(s3.archive), {durS: 0.5, level: -20}), 'morph-archive');
  add(cue.stamp(f(B.noopAt), {level: -22}), 'suppress-thud');
  add(cue.pinBrush(f(s3.end - 0.45), {durS: 0.8, shape: 'fall', level: -20}), 'stack');

  // ---------------------------------------------------------------- 06.4 numbers, the miss, the check
  const s4 = T.s4;
  B.ladder.forEach((t, k) => add(cue.tick(f(t), {level: -20}), `ladder-${k}`));
  add(cue.note(f(s4.fifty), 1, {octave: 3, velocity: 0.45, level: -18}), 'miss-tone');
  add(cue.typing(f(s4.term), B.term.keys.map((k) => k - s4.term), {level: -22}), 'term-keys');
  B.term.prints.forEach((t, k) => add(cue.tick(f(t), {level: -26}), `term-line-${k}`));
  add(cue.chime(f(B.passAt), {level: -16}), 'term-pass');
  add(cue.pinBrush(f(B.gridAt), {durS: 0.8, shape: 'bell', level: -20}), 'grid');
  add(cue.note(f(s4.ninety), 6, {velocity: 0.5, level: -18}), 'grid-note');

  // ---------------------------------------------------------------- 06.5 THGTM
  const s5 = T.s5;
  for (let k = 0; k < 8; k++) add(cue.pinTick(f(s5.start + 0.6 + k * 0.63), {tau: 0.25, level: -26}), `echo-${k}`);
  add(cue.whoosh(f(B.threadFrom + 0.7), {durS: 1.2, level: -20}), 'thread');
  B.xorAt.forEach((t, k) => add(cue.tick(f(t + 0.1), {level: -20}), `xor-${k}`));
  add(cue.chime(f(B.xorAt[2] + 0.15), {level: -15}), 'xor-solved');
  B.exportPass.slice(0, 3).forEach((t, k) => add(cue.tick(f(t), {level: -18}), `export-${k}`));
  add(cue.note(f(B.tripAt + 0.05), 2, {octave: 4, velocity: 0.55, level: -18}), 'trip');

  // ---------------------------------------------------------------- 06.6-06.9 the plate
  const s6 = T.s6;
  const s7 = T.s7;
  const s8 = T.s8;
  const s9 = T.s9;
  add(cue.whoosh(f(s6.start - 0.5), {durS: 1.4, level: -16}), 'dolly');
  add(cue.pinBrush(f(s6.start - 0.6), {durS: 1.2, shape: 'flat', level: -20}), 'plate-pins');
  [s6.input, s7.start - 0.2, s8.start - 0.2, s9.start - 0.2].forEach((t, k) => add(cue.note(f(t), [1, 2, 3, 5][k], {velocity: 0.6, level: -16}), `socket-${k}`));
  for (let k = 0; k < 3; k++) add(cue.blip(f(s6.graphs + k * 0.12), 3, {level: -22}), `bind-${k}`);
  add(cue.pinBrush(f(s6.seeds - 0.2), {durS: 0.9, shape: 'rise', level: -18}), 'matrix');
  add(cue.tick(f(s7.transcript + 0.6), {level: -20}), 'route-1');
  add(cue.tick(f(B.escAt), {level: -20}), 'route-2');
  add(cue.blip(f(s7.person - 0.05), 3, {level: -18}), 'ask-1');
  add(cue.blip(f(s7.person + 0.12), 5, {level: -18}), 'ask-2');
  for (let k = 0; k < 5; k++) add(cue.pinTick(f(s8.readme - 0.1 + k * 0.1), {level: -22}), `seed-${k}`);
  add(cue.swish(f(s8.adult), {durS: 0.7, level: -20}), 'collapse');
  add(cue.note(f(s9.contradict), 5, {velocity: 0.6, level: -17}), 'contradict');
  add(cue.pinBrush(f(s9.board - 0.25), {durS: 1.0, shape: 'fall', level: -20}), 'to-line');
  add(cue.note(f(s9.repair), 1, {velocity: 0.6, level: -16}), 'repair');
  add(cue.pinBrush(f(B.endAt), {durS: 1.0, shape: 'fall', level: -22}), 'end-pins');

  // ---------------------------------------------------------------- chapter change into 07: a reverse swell into its gate
  const next = tl.scene('07.0').start;
  add(cue.swell(f(next), 1.4, {toneDegree: 1}), 'swell-07');

  // citation chips: a quiet blip as each source types in
  // (the chips' times come from the scenes; one per chip family is enough to carry the grammar)
  [s1.blocking, s2.plates + 0.4, s3.c1 + 0.3, s4.start + 0.4, s5.memory, s6.input + 0.2, s7.transcript + 0.3, s8.start + 0.4, s9.start + 0.3].forEach((t, k) =>
    add(cue.blip(f(t), 6, {level: -26}), `chip-${k}`),
  );

  // ---------------------------------------------------------------- music: Machina, thinning to a pad under the REINS numbers
  const m: MusicCue[] = [
    music('machina', T.gate.frame0 + 0.7, T.ch.end - 0.2, {
      id: 'c06-machina',
      offset: 0,
      fadeIn: 0.6,
      fadeOut: 2.5,
      automation: [
        [s4.start, 0],
        [s4.start + 1.2, -4],
        [s4.end - 1.0, -4],
        [s4.end, 0],
      ],
    }),
  ];
  return {sfx: out, music: m};
};
