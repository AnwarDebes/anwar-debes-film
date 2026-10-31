import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {chapterTurn, cue, music, sfx as sfxCue} from '../../engine/audio/cues';
import {times03} from './ch03/times';

// Chapter 03 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): one transition sound per move, tonal notes on visual beats, ticks for
// steps, a chime only when a printed check passes, and the film's one red drop as a sub drop.

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times03(tl);
  const f = (s: number) => tl.f(s);
  const sfx: SfxCue[] = [];
  const add = (...c: SfxCue[]) => sfx.push(...c);

  // 03.0 the gate: a reverse swell into frame 0 of the cube, an impact on it, then air
  add(...chapterTurn(f(T.gate), {lead: 'swell', durS: 1.4, toneDegree: 1, id: 'c03-turn'}));
  add(cue.pinBrush(f(T.gate), {id: 'c03-gate-rise', durS: 0.9, shape: 'rise', level: -14}));
  add(cue.note(f(T.gateClear + 0.3), 5, {id: 'c03-gate-clear', octave: 5, level: -16}));
  add(cue.pinBrush(f(T.gateOpen), {id: 'c03-gate-open', durS: 0.8, shape: 'fall', level: -15}));
  add(cue.whoosh(f(T.lapIn1 + 0.45), {id: 'c03-laptop-in', durS: 0.9, level: -16}));

  // 03.1 one soft UI tick per step (no "allowed" chirp: the silence is the point)
  add(cue.blip(f(T.plate), 5, {id: 'c03-plate', level: -17}));
  add(cue.note(f(T.plate + 0.05), 1, {id: 'c03-rule-pin', octave: 6, level: -18}));
  T.steps.forEach((s, i) => add(cue.tick(f(s), {id: `c03-step-${i}`, level: -19})));
  add(cue.blip(f(T.filter + 0.45), 6, {id: 'c03-filter-chip', level: -19}));

  // 03.2 the page is read: a soft data glitch, a tick per term that rises, a note on 512 literals
  add(cue.whoosh(f(T.lapOut1 + 0.4), {id: 'c03-laptop-out', durS: 0.8, level: -17}));
  add(cue.pinBrush(f(T.vocab), {id: 'c03-vocab', durS: 0.7, shape: 'bell', level: -16}));
  add(sfxCue('glitch', f(T.readFrom), {id: 'c03-read', level: -20}));
  T.terms.forEach((s, i) => add(cue.pinTick(f(s), {id: `c03-term-${i}`, level: -19})));
  add(cue.note(f(T.literals), 3, {id: 'c03-literals', octave: 5, level: -16}));
  add(cue.tick(f(T.code1 + 0.7), {id: 'c03-hl-1', level: -20}), cue.tick(f(T.code1 + 2.05), {id: 'c03-hl-2', level: -20}));
  add(cue.blip(f(T.rule1), 5, {id: 'c03-rule-a', level: -17}), cue.blip(f(T.rule2), 6, {id: 'c03-rule-b', level: -17}));
  add(cue.blip(f(T.sha), 3, {id: 'c03-sha', level: -18}));

  // 03.3 one whoosh as the three dialects merge; a tick per ring step; the 10,000-step roll
  add(cue.whoosh(f(T.merge), {id: 'c03-merge', durS: 0.7, level: -16}));
  add(cue.note(f(T.diagram + 0.2), 5, {id: 'c03-diagram', octave: 4, level: -17}));
  add(cue.pinBrush(f(T.ring - 0.35), {id: 'c03-ring', durS: 0.7, shape: 'bell', level: -17}));
  T.ringSteps.forEach((s, i) => add(cue.tick(f(s), {id: `c03-ring-${i}`, level: -19})));
  add(cue.note(f(T.bin), 1, {id: 'c03-bin', octave: 5, level: -16}));
  const roll = 26;
  for (let i = 0; i < roll; i++) {
    const x = i / (roll - 1);
    add(cue.tick(f(T.raceFrom + (T.raceTo - T.raceFrom) * Math.pow(x, 0.62)), {id: `c03-roll-${i}`, level: -22}));
  }

  // 03.4 the third email arrives, the session is blocked: the one red drop, then silence
  add(cue.whoosh(f(T.s4 - 0.35), {id: 'c03-laptop-back', durS: 0.8, level: -17}));
  add(cue.tick(f(T.third), {id: 'c03-third-email', level: -19}));
  add(sfxCue('sub_drop', f(T.stopped), {id: 'c03-red-drop', level: -10}));
  add(cue.whoosh(f(T.lapOut2 + 0.4), {id: 'c03-laptop-away', durS: 0.7, level: -20}));

  // 03.5 a tick per chained block, a note on the seal, a glitch on the flipped bit, a dry low
  // tick (not a buzz) where verification stops, a chime on "Verified"
  T.chain.forEach((s, i) => add(cue.pinTick(f(s), {id: `c03-chain-${i}`, level: -19})));
  add(cue.note(f(T.seal), 5, {id: 'c03-seal', octave: 5, level: -16}));
  add(cue.whoosh(f(T.lapIn3 + 0.45), {id: 'c03-laptop-ledger', durS: 0.8, level: -17}));
  add(sfxCue('glitch', f(T.flip + 0.15), {id: 'c03-flip', level: -18}));
  add(cue.pinTick(f(T.fail + 0.1), {id: 'c03-caught', level: -15, f1: 180}));
  add(cue.tick(f(T.codeLedger + 0.1), {id: 'c03-code-ledger', level: -21}));
  add(cue.chime(f(T.verified), {id: 'c03-verified', level: -15}));

  // 03.6 keyboard foley on the terminal, a chime because it printed a pass, ticks as bars rise,
  // and the miss on a single soft low tone (no buzz)
  add(cue.typing(f(T.typeAt), T.keys1, {id: 'c03-type-1', level: -21}));
  add(cue.typing(f(T.run2Type), T.keys2, {id: 'c03-type-2', level: -21}));
  add(cue.chime(f(T.pass), {id: 'c03-pass', level: -15}));
  add(cue.pinBrush(f(T.numbers + 0.2), {id: 'c03-bars-1', durS: 0.8, shape: 'rise', level: -17}));
  add(cue.pinBrush(f(T.asr), {id: 'c03-bars-2', durS: 0.8, shape: 'rise', level: -17}));
  add(cue.pinBrush(f(T.miss + 0.2), {id: 'c03-bars-3', durS: 0.8, shape: 'rise', level: -17}));
  add(cue.note(f(T.fall), 1, {id: 'c03-miss', octave: 3, level: -15}));
  add(cue.blip(f(T.quote + 0.4), 3, {id: 'c03-quote', level: -19}));

  // 03.7 three notes for the three real parts, the press on "real", the thread
  add(cue.note(f(T.guard), 1, {id: 'c03-guard', octave: 5, level: -17}));
  add(cue.note(f(T.monitors), 3, {id: 'c03-monitors', octave: 5, level: -17}));
  add(cue.note(f(T.ledger), 5, {id: 'c03-ledger', octave: 5, level: -17}));
  add(cue.pinTick(f(T.real), {id: 'c03-press', level: -14, f1: 240}));
  add(cue.pinBrush(f(T.thread), {id: 'c03-thread', durS: 1.4, shape: 'flat', level: -18}));

  // music: Nightfall without the solo strings under the first half; it stops dead 3 s before
  // "Every call looked innocent"; the main mix (strings back) runs from the ledger to the end
  const m: MusicCue[] = [
    music('nightfall-nosolo', T.gate + 0.7, T.musicCut, {id: 'c03-nightfall-alt', offset: 0, fadeIn: 0.6, fadeOut: 0.05, level: -5}),
    music('nightfall', T.s5 - 0.4, T.end, {id: 'c03-nightfall', offset: 92, fadeIn: 1.6, fadeOut: 2.2, level: -5}),
  ];
  return {sfx, music: m};
};
