import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music, sfx as sfxCue} from '../../engine/audio/cues';
import {times07} from './ch07/times';
import {REC, sessionMap} from './ch07/session';

// Chapter 07 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): one transition sound per cut, tonal notes on visual beats, soft pin
// ticks on sweeps, blips on chips, the session's own rhythm under 07.4, a chime only where the
// printed output passes. Pixie itself makes no sound.

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times07(tl);
  const {g, t1, t2, t3, t4, t5, t6} = T;
  const f = (s: number) => tl.f(s);
  const m = sessionMap(T);
  const sfx: SfxCue[] = [];
  const add = (...c: SfxCue[]) => sfx.push(...c);

  // 07.0 the gate: the impact on frame 0 (the reverse swell into it closes chapter 06), the well
  add(cue.impact(f(g.at), {id: 'c07-gate-impact'}));
  add(cue.pinBrush(f(g.at), {id: 'c07-well', durS: 1.1, shape: 'rise', level: -16}));
  add(cue.whoosh(f(g.descendTo - 0.6), {id: 'c07-descend', durS: 1.4, level: -18}));

  // 07.1 the spinner ticks on, under the log; keys under the typed commands
  for (let s = T.s1.start, k = 0; s < t1.burst - 0.05; s += 0.5, k++) add(cue.tick(f(s), {id: `c07-spin-${k}`, level: -26}));
  const typed = (at: number, n: number, cps: number, id: string) => add(cue.typing(f(at), Array.from({length: n}, (_, i) => i / cps), {id, level: -24}));
  typed(t1.rm, 14, 17, 'c07-rm-keys');
  add(cue.note(f(t1.rmSpoken), 6, {id: 'c07-rm-note', level: -18, octave: 5}));
  // the spinner bursts into coral pins and Pixie stands up out of them
  add(cue.pinBrush(f(t1.burst), {id: 'c07-burst', durS: 0.9, shape: 'bell', level: -15}));
  add(cue.note(f(t2.form + 0.6), 5, {id: 'c07-pixie-forms', level: -14}));

  // 07.2 the name plate and its rule-line pin, the file opening, the dwell ticks
  add(cue.blip(f(t2.plate), 5, {id: 'c07-ccim-plate', level: -16}));
  add(cue.blip(f(t2.map + 0.25), 3, {id: 'c07-map-chip', level: -20}));
  add(sfxCue('paper', f(t2.codeIn), {id: 'c07-page-turn', level: -18, params: {dur: 0.7}}));
  for (let k = 0; k < 14; k++) add(cue.tick(f(t2.lanes + 0.4 + (k * 5.4) / 18), {id: `c07-dwell-${k}`, level: -24}));
  add(cue.note(f(t2.dwell), 3, {id: 'c07-dwell-note', level: -18}));

  // 07.3 the harness decides
  add(cue.swish(f(t3.diagram + 0.3), {id: 'c07-arch-in', level: -18}));
  add(cue.tick(f(t3.decides), {id: 'c07-packet-gate', level: -18}));
  add(cue.pinBrush(f(t3.lanes), {id: 'c07-lanes-rise', durS: 0.8, shape: 'rise', level: -17}));
  add(cue.pinTick(f(t3.ls), {id: 'c07-drop-allow', level: -16}));
  add(cue.pinTick(f(t3.rm), {id: 'c07-drop-ask', level: -16}));
  add(cue.subHit(f(t3.root), {id: 'c07-drop-deny', level: -14}));
  add(cue.note(f(t3.first), 2, {id: 'c07-first', level: -18}));
  add(cue.note(f(t3.running), 5, {id: 'c07-tool-pose', level: -18}));
  add(cue.pinBrush(f(t3.sandbox - 0.2), {id: 'c07-sandbox', durS: 0.8, shape: 'bell', level: -18}));

  // 07.4 the recorded session: its own rhythm leads
  add(cue.whoosh(f(t4.swingIn + 0.45), {id: 'c07-laptop-in', durS: 0.9, level: -14}));
  const promptKeys = Math.round(76);
  const typeFrom = m.film(REC.typeFrom);
  const typeTo = m.film(REC.send - 0.45);
  if (typeTo > T.s4.start - 0.5) {
    const span = typeTo - typeFrom;
    const keys = Array.from({length: promptKeys}, (_, i) => (i / promptKeys) * span).filter((x) => typeFrom + x >= t4.swingIn);
    if (keys.length) add(cue.typing(f(typeFrom + keys[0]), keys.map((x) => x - keys[0]), {id: 'c07-prompt-keys', level: -24}));
  }
  add(cue.tick(f(m.film(REC.click1)), {id: 'c07-allow-1', level: -14}));
  add(cue.tick(f(m.film(REC.click2)), {id: 'c07-allow-2', level: -14}));
  add(cue.chime(f(m.film(REC.pass)), {id: 'c07-tests-pass', level: -16}));
  add(cue.swish(f(t4.swingOut + 0.3), {id: 'c07-laptop-out', level: -16}));

  // 07.5 the check on camera: keys, the chime because every test passed, counter ticks, the thread
  add(cue.typing(f(t5.typeCmd), Array.from({length: 8}, (_, i) => i / 16), {id: 'c07-npm-keys', level: -22}));
  add(cue.chime(f(t5.tally), {id: 'c07-npm-pass', level: -14}));
  for (let k = 0; k < 6; k++) add(cue.tick(f(t5.cards + 0.25 + k * 0.18), {id: `c07-count-${k}`, level: -24}));
  add(cue.whoosh(f(t5.thread + 1.6), {id: 'c07-thread', durS: 1.8, level: -20}));
  add(cue.blip(f(t5.header), 5, {id: 'c07-copy-check', level: -18}));

  // 07.6 vsclaude: the frame, one tick per mapping step, the ladder, the spinner once more
  add(cue.pinBrush(f(t6.place), {id: 'c07-vsc-frame', durS: 1.2, shape: 'flat', level: -16}));
  add(cue.blip(f(t6.plate), 5, {id: 'c07-vsc-plate', level: -16}));
  [t6.edit, t6.caption, t6.pose, t6.table].forEach((s, k) => add(cue.tick(f(s), {id: `c07-map-${k}`, level: -17})));
  add(cue.pinBrush(f(t6.beta), {id: 'c07-ladder', durS: 0.9, shape: 'rise', level: -17}));
  for (let s = t6.spinner, k = 0; s < t6.noSpinner; s += 0.5, k++) add(cue.tick(f(s), {id: `c07-spin2-${k}`, level: -26}));
  add(cue.pinBrush(f(t6.noSpinner), {id: 'c07-spinner-dissolve', durS: 0.9, shape: 'fall', level: -17}));
  add(cue.note(f(t6.every), 1, {id: 'c07-every-step', level: -12}));
  add(cue.pinBrush(f(t6.cool), {id: 'c07-cool', durS: 1.4, shape: 'fall', level: -18}));
  // reverse swell into the 08 gate (ends on its frame 0)
  add(cue.swell(f(T.next.start), 1.4, {id: 'c07-into-08', toneDegree: 1}));

  // Discovery under the whole chapter, in the warm palette; low under the recorded session
  const musicCues: MusicCue[] = [
    music('discovery', g.at + 0.6, T.next.start, {
      id: 'c07-discovery',
      offset: 0,
      fadeIn: 0.3,
      fadeOut: 2.2,
      automation: [
        [t4.swingIn, 0],
        [t4.swingIn + 0.8, -4],
        [t4.swingOut, -4],
        [t4.swingOut + 1.0, 0],
      ],
    }),
  ];
  return {sfx, music: musicCues};
};
