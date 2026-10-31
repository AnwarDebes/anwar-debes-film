import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {chapterTurn, cue, music, sfx as sfxCue} from '../../engine/audio/cues';
import {veritasRepair} from '../../data/ch04/veritas-repair';
import {veritasCheck as check} from '../../data/ch04/veritas-check';
import {clock} from './ch03/kit/time';
import {PROVER_PROBES} from './ch04/common';

// Chapter 04 sound: pure data from the timeline. The same expressions place the pictures.
// One polite error buzz (the counterexample, one of the film's four hard truths), a chime only on
// PROVED and on a printed pass, ticks per probe, and the music dry for 3 s before "It finds one".

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const c = clock(tl);
  const f = (s: number) => tl.f(s);
  const ch = tl.chapter('04');
  const S = (id: string) => c.sc(id);
  const sfx: SfxCue[] = [];
  const add = (...x: SfxCue[]) => sfx.push(...x);

  // 04.0 the thread, the reverse swell into the cube, the impact, air
  add(cue.pinBrush(f(ch.start + 0.25), {id: 'c04-thread', durS: 1.3, shape: 'flat', level: -19}));
  add(...chapterTurn(f(S('04.0').start), {lead: 'swell', durS: 1.4, toneDegree: 5, id: 'c04-turn'}));
  add(cue.pinBrush(f(S('04.0').start), {id: 'c04-gate-rise', durS: 0.9, shape: 'rise', level: -14}));
  add(cue.note(f(S('04.0').start + 1.2), 5, {id: 'c04-gate-clear', octave: 5, level: -16}));

  // 04.1 a soft tick per group of probes, a riser under the 2^256 zoom ending on its last digit
  const s1 = S('04.1').start;
  const streamTo = c.u('u0402').start - 0.3;
  for (let i = 0; i < 12; i++) add(cue.tick(f(s1 + ((streamTo - 1 - s1) * i) / 12), {id: `c04-probes-${i}`, level: -21}));
  const patAt = c.w('u0402', 'every');
  for (let j = 0; j < 6; j++) add(cue.pinTick(f(patAt + j * 0.22), {id: `c04-pattern-${j}`, level: -20}));
  const digitsEnd = S('04.1').end - 0.8;
  add(cue.riser(f(digitsEnd), Math.max(1.2, digitsEnd - c.u('u0403').start), {id: 'c04-riser', level: -14}));
  add(cue.pinBrush(f(c.w('u0403', 'try')), {id: 'c04-grain', durS: 0.8, shape: 'bell', level: -17}));

  // 04.2 the place, typing under the formula, a tick per highlighted line, a pulse while it searches
  const s2 = S('04.2').start;
  add(cue.pinBrush(f(s2 - 0.35), {id: 'c04-emblem', durS: 0.9, shape: 'rise', level: -16}));
  add(cue.blip(f(s2 + 0.25), 5, {id: 'c04-plate', level: -17}));
  add(cue.note(f(s2 + 0.3), 2, {id: 'c04-rule-pin', octave: 6, level: -18}));
  const pipeAt = c.w('u0404', 'compiles') + 0.9;
  for (let i = 0; i < 5; i++) add(cue.blip(f(pipeAt + i * 0.32), [1, 2, 3, 5, 6][i], {id: `c04-pipe-${i}`, level: -21}));
  const claimAt = c.w('u0406', 'claim') - 0.1;
  const formula = '∀p ⊇ {ignore, previous, instructions} : blocked(p)';
  add(cue.typing(f(claimAt), Array.from({length: formula.length}, (_, i) => i / 34), {id: 'c04-formula', level: -21}));
  const codeAt = c.w('u0407', 'solver') - 0.2;
  add(cue.tick(f(c.w('u0407', 'opposite')), {id: 'c04-hl-1', level: -21}), cue.tick(f(c.w('u0408', 'none')), {id: 'c04-hl-2', level: -21}), cue.tick(f(c.nth('u0408', 'one', 1)), {id: 'c04-hl-3', level: -21}));
  const searchFrom = c.w('u0407', 'opposite');
  const searchTo = S('04.2').end - 0.6;
  for (let t = searchFrom; t < searchTo; t += 1.0) add(sfxCue('heartbeat', f(t), {id: `c04-pulse-${Math.round(t * 10)}`, level: -22}));
  void codeAt;

  // 04.3 dry for 3 s before "It finds one"; the stamp lands with a metallic hit and the polite buzz
  const which = c.w('u0410', 'Which');
  add(cue.whoosh(f(S('04.3').start - 0.1), {id: 'c04-monitor-in', durS: 1.0, level: -16}));
  add(cue.stamp(f(which), {id: 'c04-stamp'}));
  add(cue.error(f(which + 0.05), {id: 'c04-buzz', level: -15}));
  add(cue.pinBrush(f(c.w('u0411', 'Four') - 0.3), {id: 'c04-balance', durS: 0.7, shape: 'rise', level: -18}));
  add(cue.blip(f(c.w('u0412', 'website')), 3, {id: 'c04-site', level: -18}));

  // 04.4 an amber tick per SAT probe, a mint tone per UNSAT probe, a chime on PROVED, a roll as the
  // lemmas check, keyboard foley on the terminal, a chime on the printed pass
  const pFrom = c.w('u0413', 'binary');
  const pTo = Math.max(pFrom + 2.8, c.u('u0413').end - 0.1);
  const probeAt = (j: number) => pFrom + ((pTo - pFrom) * j) / (PROVER_PROBES.length - 1);
  veritasRepair.probes.forEach((p, j) => add(p.sat ? cue.tick(f(probeAt(j)), {id: `c04-probe-${j}`, level: -18}) : cue.note(f(probeAt(j)), 5, {id: `c04-probe-${j}`, octave: 6, level: -19})));
  const provesAt = c.w('u0414', 'proves');
  add(cue.chime(f(provesAt), {id: 'c04-proved', notes: ['E6', 'B6'], level: -14}));
  const rupAt = c.w('u0415', 'clause');
  for (let j = 0; j < veritasRepair.lemmas; j++) add(cue.tick(f(rupAt + 0.35 + j * 0.45), {id: `c04-rup-${j}`, level: -19}));
  const termAt = c.w('u0416', 'checker') - 0.4;
  const cmd = check.runs[0].cmd;
  const typeAt = termAt + 0.5;
  add(cue.typing(f(typeAt), Array.from({length: cmd.length}, (_, i) => i / 24), {id: 'c04-type', level: -21}));
  const outAt = typeAt + cmd.length / 24 + 0.6;
  const passLine = check.runs[0].output.findIndex((l) => l.startsWith('# pass'));
  const passAt = outAt + passLine / 9;
  add(cue.chime(f(passAt), {id: 'c04-pass', level: -15}));
  const dratAt = Math.max(passAt + 0.8, termAt + 4.2);
  // the outside checker's card: pending, so a soft blip and the outlined stamp, no keyboard
  add(cue.blip(f(dratAt), 3, {id: 'c04-pending', level: -19}));
  add(cue.stamp(f(dratAt + 0.5), {id: 'c04-not-run', level: -21}));

  // 04.5 a soft neutral tick on BLOCKED, the 256-call roll rising in pitch, a note on the result
  const blocked = c.w('u0417', 'blocked');
  add(cue.tick(f(blocked), {id: 'c04-blocked', level: -18}));
  const dropA = blocked + 0.55;
  add(cue.pinTick(f(dropA), {id: 'c04-drop-a', level: -19}), cue.pinTick(f(dropA + 0.75), {id: 'c04-drop-b', level: -19}));
  const auditFrom = dropA + 1.75;
  const auditTo = auditFrom + 2.4;
  for (let i = 0; i < 32; i++) add(cue.tick(f(auditFrom + ((auditTo - auditFrom) * i) / 32), {id: `c04-audit-${i}`, level: -23}));
  add(cue.note(f(auditTo + 0.1), 3, {id: 'c04-audit-done', octave: 5, level: -17}));
  const chartAt = Math.max(auditTo + 1.5, c.w('u0418', 'random'));
  add(cue.pinBrush(f(chartAt - 0.2), {id: 'c04-chart', durS: 0.8, shape: 'rise', level: -18}));
  add(cue.note(f(Math.max(chartAt + 1.6, c.w('u0419', 'certify'))), 5, {id: 'c04-certified', octave: 5, level: -16}));

  // 04.6 ticks per round as the columns climb, one mint tone as repair drops to zero, the headline
  const roundsFrom = c.w('u0420', 'Retraining');
  const roundsTo = c.w('u0420', 'bypassable');
  for (let r = 1; r < 8; r++) add(cue.tick(f(roundsFrom + ((roundsTo - roundsFrom) * r) / 7), {id: `c04-round-${r}`, level: -20}));
  add(cue.note(f(c.w('u0421', 'zero')), 1, {id: 'c04-zero', octave: 5, level: -15}));
  add(cue.pinBrush(f(c.u('u0422').end + 0.2), {id: 'c04-certs', durS: 0.7, shape: 'flat', level: -19}));
  add(cue.pinBrush(f(c.u('u0423').start - 0.5), {id: 'c04-payoff', durS: 1.0, shape: 'rise', level: -16}));
  add(cue.note(f(c.w('u0423', 'Prove')), 5, {id: 'c04-prove-it', octave: 5, level: -14}));

  // music: Emergent is not in the film's music manifest yet; Decoherence (past the stretch chapter
  // 01 uses) stands in, dry 3 s before the counterexample, back in under the repair, ending on a hold
  const dry = c.w('u0409', 'finds') - 3;
  const m: MusicCue[] = [
    music('decoherence', S('04.0').start + 0.8, dry, {id: 'c04-bed-a', offset: 60, fadeIn: 1.2, fadeOut: 0.25, level: -5}),
    music('decoherence', c.w('u0413', 'repair') - 0.5, ch.end, {id: 'c04-bed-b', offset: 140, fadeIn: 1.5, fadeOut: 2.4, level: -5}),
  ];
  return {sfx, music: m};
};
