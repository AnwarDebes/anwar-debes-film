import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music} from '../../engine/audio/cues';
import {times08} from './ch08/times';
import {beats08} from './ch08/beats';

// Chapter 08 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): the gate's impact on frame 0 (chapter 07 places the reverse swell into
// it), near-silent pin brushes under LUCID, the chapter's one bright sound on LEVEL UP, a dry card
// for the scoreboard with the polite error buzz (one of the film's four), keyboard foley and a
// chime only on the printed pass, and the 0.45 s clock tick under NEXUS.

/**
 * The storyboard's score for this chapter, Scott Buckley's "Shadows and Dust", is not in
 * audio/music-manifest.json yet, and the mixer stops on a track it does not know. The cue is kept
 * here, timed, for when the track is added; `cues` returns no music until then.
 */
export const PLANNED_MUSIC = (tl: FilmTimeline): MusicCue[] => {
  const T = times08(tl);
  return [
    music('shadows-and-dust', T.gate.frame0 + 0.2, T.s4.start - 0.4, {id: 'c08-shadows', offset: 0, fadeIn: 4.0, fadeOut: 1.2}),
    // dry for the scoreboard, back softly with the drone after the test
    music('shadows-and-dust', T.s5.start + 1.0, T.ch.end - 0.2, {id: 'c08-shadows-2', offset: 60, fadeIn: 3.0, fadeOut: 3.0, level: -9}),
  ];
};

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times08(tl);
  const B = beats08(T);
  const f = (s: number) => Math.round(s * tl.fps);
  const out: SfxCue[] = [];
  const add = (c: SfxCue, id: string) => out.push({...c, id: `c08-${id}`});

  // ---------------------------------------------------------------- 08.0 the gate (unfold)
  add(cue.impact(f(T.gate.frame0)), 'gate-impact');
  add(cue.pinBrush(f(B.cubeAt + 0.05), {durS: 0.8, shape: 'rise', level: -18}), 'cube');
  add(cue.pinBrush(f(B.unfoldAt), {durS: 0.9, shape: 'bell', level: -18}), 'unfold');
  add(cue.pinBrush(f(B.settleAt), {durS: 0.9, shape: 'fall', level: -22}), 'settle');

  // ---------------------------------------------------------------- the rule line: one soft note per arrival
  [T.s1.plate, T.s6.plate, T.s7.plate].forEach((t, k) => add(cue.note(f(t), 5, {velocity: 0.5, level: -20}), `rule-${k}`));

  // ---------------------------------------------------------------- 08.1-08.2 LUCID (no ticks under 08.1)
  const s2 = T.s2;
  for (let k = 0; k < 7; k++) add(cue.pinTick(f(B.liftAt + 0.15 + k * 0.09), {level: -24, tau: 0.12}), `lift-${k}`);
  add(cue.pinBrush(f(B.maskAt), {durS: 0.6, shape: 'flat', level: -26}), 'mask');
  B.modelRows.forEach((t, k) => add(cue.tick(f(t), {level: -26}), `model-${k}`));
  add(cue.subHit(f(B.fatalAt + 0.05), {level: -18}), 'fatal-clunk');
  add(cue.stamp(f(B.fatalAt + 0.08), {level: -24}), 'fatal-metal');
  add(cue.typing(f(s2.ends), [0.04, 0.13, 0.22, 0.34, 0.41, 0.55, 0.63], {level: -26}), 'code-keys');
  for (let k = 0; k < 8; k++) add(cue.pinTick(f(B.bfsAt + k * 0.16), {level: -24, tau: 0.1, f1: 900 + k * 140}), `bfs-${k}`);
  add(cue.whoosh(f(B.diagFrom), {durS: 0.9, level: -20}), 'diagram');

  // ---------------------------------------------------------------- 08.3 LP85: one click per trace line, the bright LEVEL UP
  B.clickAt.forEach((t, k) => add(cue.tick(f(t), {level: -18}), `click-${k}`));
  add(cue.chime(f(B.levelAt), {level: -12}), 'level-up');

  // ---------------------------------------------------------------- 08.4 the scoreboard: dry, counter ticks, the error buzz
  const s4 = T.s4;
  add(cue.pinBrush(f(B.gamesAt), {durS: 1.0, shape: 'flat', level: -24}), 'games');
  for (let k = 0; k < 2; k++) add(cue.tick(f(s4.two + k * 0.1), {level: -20}), `levels-${k}`);
  for (let k = 0; k < 6; k++) add(cue.tick(f(B.lucidAt + k * 0.12), {level: -24}), `lucid-count-${k}`);
  for (let k = 0; k < 6; k++) add(cue.tick(f(B.randomAt + k * 0.12), {level: -24}), `random-count-${k}`);
  add(cue.error(f(B.randomAt + 0.35)), 'random-passes');
  add(cue.tick(f(B.frontierAt), {level: -22}), 'frontier');
  add({type: 'paper', frame: f(B.strikeAt), level: -18, params: {}}, 'pencil');
  add({type: 'paper', frame: f(B.strikeAt + 0.35), level: -20, params: {}}, 'pencil-2');
  for (let k = 0; k < 7; k++) add(cue.tick(f(B.deathsAt + 0.6 + k * 0.1), {level: -26}), `repeat-${k}`);

  // ---------------------------------------------------------------- 08.5 the test, on camera
  const s5 = T.s5;
  add(cue.typing(f(s5.runs), B.term.keys.map((k) => k - s5.runs), {level: -22}), 'term-keys');
  B.term.prints.forEach((t, k) => add(cue.tick(f(t), {level: -24}), `term-line-${k}`));
  add(cue.chime(f(B.passAt), {level: -16}), 'test-pass');
  add(cue.swish(f(s5.script - 0.2), {durS: 0.4, level: -24}), 'page');

  // ---------------------------------------------------------------- 08.6 RL: near silence, one tick
  add(cue.tick(f(T.s6.start), {level: -20}), 'rl-plot');

  // ---------------------------------------------------------------- 08.7 NEXUS: the 0.45 s clock carries the scene
  const s7 = T.s7;
  add(cue.whoosh(f(s7.start - 0.1), {durS: 1.4, level: -18}), 'dolly');
  for (let t = s7.start, k = 0; t < B.lineAt; t += 0.45, k++) add(cue.tick(f(t), {level: -30}), `clock-${k}`);
  for (let k = 0; k < 3; k++) add(cue.pinTick(f(s7.nexus + 0.2 + (k + 0.5) * 0.45), {level: -18, tau: 0.05}), `marble-${k}`);
  B.matchAt.forEach((t, k) => add(cue.note(f(t), 5, {velocity: 0.45, level: -22}), `match-${k}`));
  B.stampAt.forEach((t, k) => add(cue.stamp(f(t), {level: -22}), `test-stamp-${k}`));
  add(cue.pinBrush(f(B.columnsAt), {durS: 0.8, shape: 'rise', level: -20}), 'columns');
  add(cue.note(f(B.histAt + 0.3), 1, {octave: 3, velocity: 0.45, level: -18}), 'miss-tone');
  add(cue.pinBrush(f(B.fixAt), {durS: 0.7, shape: 'rise', level: -22}), 'fix');
  add(cue.pinBrush(f(B.lineAt), {durS: 1.0, shape: 'fall', level: -20}), 'to-line');
  add(cue.note(f(s7.rulesWord), 1, {velocity: 0.65, level: -15}), 'the-rules');
  add(cue.pinBrush(f(B.endAt), {durS: 1.0, shape: 'fall', level: -22}), 'end-pins');

  // citation chips: a quiet blip as each scene's first source types in
  [T.s1.instructions, s2.cpu + 0.4, B.clickAt[0] + 0.2, s4.games + 0.3, s5.test, s7.plate + 0.4].forEach((t, k) => add(cue.blip(f(t), 6, {level: -26}), `chip-${k}`));

  // ---------------------------------------------------------------- chapter change into 09: a reverse swell into its gate
  add(cue.swell(f(tl.scene('09.0').start), 1.4, {toneDegree: 1}), 'swell-09');

  return {sfx: out, music: []};
};
