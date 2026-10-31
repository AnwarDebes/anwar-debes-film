import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {chapterTurn, cue, music, sfx} from '../../engine/audio/cues';

// Chapter 02 sound: pure data from the timeline (no React), so the mix can be built in Node. The
// times are the scene formulas of ch02/*.tsx, read from the narration timeline.
//
// Music: Tears in Rain (Scott Buckley, CC BY 4.0; public/ch02/music, not in the shared manifest)
// enters after 0.8 s of air on the gate, goes dry about 3 s before "It scores" and stays dry through
// the NOT MET stamp, comes back softly on "Then" (02.5), sits at its open level under the glass box,
// and resolves on the chapter's last word before the swell into chapter 03.

const TEARS = 'public/ch02/music/sb_tearsinrain.mp3';

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const F = (s: number) => tl.f(s);
  const ch = tl.chapter('02');
  const sc = (id: string) => tl.scene(id);
  const w = (u: string, word: string) => tl.word(u, word);
  const out: SfxCue[] = [];

  // ---------------------------------------------------------------- 02.0 the gate
  const s0 = sc('02.0');
  out.push(...chapterTurn(F(s0.start), {lead: 'swell', durS: 1.4, id: 'c02-turn'}));
  out.push(cue.pinBrush(F(s0.start), {id: 'c02-cube-rise', durS: 1.0, shape: 'rise', level: -16}));
  out.push(cue.pinBrush(F(s0.start + 1.1), {id: 'c02-cube-clear', durS: 1.8, shape: 'fall', level: -20}));

  // ---------------------------------------------------------------- 02.1 the place
  const s1 = sc('02.1');
  out.push(cue.note(F(s1.start + 0.5), 5, {id: 'c02-plate', level: -18}));
  out.push(sfx('paper', F(s1.start + 0.6), {id: 'c02-readme', level: -16}));
  const u2 = tl.utt('u0202');
  out.push(cue.pinBrush(F(u2.start + 0.6), {id: 'c02-target', durS: 0.9, shape: 'rise', level: -22}));

  // ---------------------------------------------------------------- 02.2 the registration
  const s2 = sc('02.2');
  out.push(sfx('paper', F(s2.start - 0.2), {id: 'c02-page-turn', level: -15}));
  out.push(cue.pinBrush(F(s2.start - 0.2), {id: 'c02-page-pins', durS: 1.0, shape: 'flat', level: -22}));
  out.push(cue.stamp(F(tl.utt('u0203').start + 0.5), {id: 'c02-frozen', level: -16}));
  const u4 = tl.utt('u0204');
  const keys: number[] = [];
  for (let k = 0; k < 12; k++) keys.push(k * 0.09);
  out.push(cue.typing(F(u4.start - 0.4), keys, {id: 'c02-code-typing', level: -26}));
  out.push(cue.tick(F(u4.start + 0.4), {id: 'c02-hl-1', level: -22}));
  out.push(cue.tick(F(w('u0204', 'hash').start), {id: 'c02-hl-2', level: -22}));
  // 24 soft tinks as the strip rises (one cascade rendered from the strip's own sweep)
  const s24 = w('u0205', 'twenty-four').start - 0.1;
  out.push(cue.pinBrush(F(s24), {id: 'c02-24', durS: 0.9, shape: 'rise', density: 0.6, level: -18}));

  // ---------------------------------------------------------------- 02.3 literals and three engines
  const s3 = sc('02.3');
  const u6 = tl.utt('u0206');
  out.push(cue.pinBrush(F(s3.start - 0.3), {id: 'c02-slots', durS: 0.8, shape: 'flat', level: -24}));
  for (let k = 0; k < 3; k++) out.push(cue.pinTick(F(u6.start + 0.6 + k * 0.12), {id: `c02-literal-${k}`, level: -20}));
  out.push(cue.chime(F(u6.start + 3.4), {id: 'c02-three-hashes', degrees: [1, 3, 5], level: -16}));

  // ---------------------------------------------------------------- 02.4 the anchor run and the miss
  const s4 = sc('02.4');
  const wScores = w('u0207', 'scores');
  const wNot = w('u0209', 'not');
  const wTriggered = w('u0210', 'triggered');
  const wSixty = w('u0211', 'sixty-seven');
  out.push(cue.pinBrush(F(tl.utt('u0207').start + 0.3), {id: 'c02-epochs', durS: 1.0, shape: 'rise', level: -22}));
  out.push(cue.pinBrush(F(wScores.start - 0.1), {id: 'c02-tm-bar', durS: 1.2, shape: 'rise', level: -18}));
  out.push(cue.pinBrush(F(w('u0208', 'Counting').start - 0.1), {id: 'c02-kn-bar', durS: 1.0, shape: 'rise', level: -18}));
  // one of the film's four hard truths: the polite error buzz on the NOT MET stamp
  out.push(cue.error(F(wNot.start), {id: 'c02-not-met', level: -12}));
  out.push(cue.stamp(F(wTriggered.start), {id: 'c02-kb7', level: -16}));
  // the pencil under the 67 amendments
  out.push(sfx('paper', F(tl.utt('u0211').start + 0.3), {id: 'c02-pencil', level: -18, params: {dur: 1.6}}));
  out.push(cue.pinBrush(F(wSixty.start - 0.2), {id: 'c02-67', durS: 1.6, shape: 'rise', density: 1.2, level: -16}));

  // ---------------------------------------------------------------- 02.5 the identity
  const s5 = sc('02.5');
  const meterAt = w('u0213', 'counting').start - 0.6;
  for (let k = 0; k < 16; k++) out.push(cue.tick(F(meterAt - 0.9 + k * 0.05), {id: `c02-meter-${k}`, level: -28}));
  out.push(cue.chime(F(meterAt), {id: 'c02-identity', level: -14}));
  void s5;

  // ---------------------------------------------------------------- 02.6 the document
  const s6 = sc('02.6');
  out.push(cue.pinBrush(F(s6.start - 0.3), {id: 'c02-doc', durS: 1.2, shape: 'bell', level: -20}));
  out.push(cue.whoosh(F(s6.start + 1.4), {id: 'c02-pointer', durS: 1.0, level: -26}));
  const learned = w('u0214', 'learned').start - 0.2;
  for (let k = 0; k < 3; k++) out.push(cue.note(F(learned + 0.3 + k * 0.32), [5, 3, 2][k], {id: `c02-gain-${k}`, octave: 5, level: -24, velocity: 0.5}));

  // ---------------------------------------------------------------- 02.7 the glass box page and its tests
  const s7 = sc('02.7');
  out.push(cue.whoosh(F(s7.start + 0.6), {id: 'c02-laptop-in', durS: 1.1, level: -20}));
  out.push(cue.pinBrush(F(s7.start + 0.3), {id: 'c02-books', durS: 0.8, shape: 'rise', level: -24}));
  const wType = w('u0216', 'Type');
  const tkeys: number[] = [];
  for (let k = 0; k < 25; k++) tkeys.push(k / 13);
  out.push(cue.typing(F(wType.start - 0.15), tkeys, {id: 'c02-type', level: -24}));
  const wLedger = w('u0216', 'ledger');
  for (let k = 0; k < 3; k++) out.push(cue.tick(F(wLedger.start - 0.3 + k * 1.15), {id: `c02-row-${k}`, level: -22}));
  out.push(sfx('paper', F(w('u0216', 'passage').start), {id: 'c02-passage', level: -20}));
  const u17 = tl.utt('u0217');
  const termIn = u17.start - 0.3;
  const termKeys: number[] = [];
  for (let k = 0; k < 28; k++) termKeys.push(k * 0.05);
  out.push(cue.typing(F(termIn), termKeys, {id: 'c02-terminal', level: -24}));
  // the printed output passes (0 fail): a chime
  out.push(cue.chime(F(termIn + 2.6), {id: 'c02-tests-pass', level: -14}));
  out.push(cue.whoosh(F(sc('02.8').start - 0.6), {id: 'c02-laptop-out', durS: 0.9, level: -22}));

  // ---------------------------------------------------------------- 02.8 measured, not claimed
  const s8 = sc('02.8');
  // the tiles tint with a cascade rendered from the grid (four bands, one per verdict)
  out.push(cue.pinBrush(F(s8.start - 0.4), {id: 'c02-verdicts', durS: 1.8, shape: 'bell', density: 1.2, level: -16}));
  out.push(cue.tick(F(w('u0220', 'forged').start - 0.3), {id: 'c02-forgery', level: -18, gainDb: -3}));
  out.push(cue.note(F(tl.utt('u0221').end - 0.6), 1, {id: 'c02-headline', octave: 4, level: -18}));
  out.push(cue.pinBrush(F(ch.end - 2.3), {id: 'c02-handoff', durS: 1.2, shape: 'fall', level: -24}));
  out.push(cue.whoosh(F(ch.end - 2.6), {id: 'c02-dolly-out', durS: 1.6, level: -24}));

  // ---------------------------------------------------------------- music
  const dryFrom = wScores.start - 3.0;
  const dryTo = w('u0212', 'Then').start;
  const tearsIn = s0.start + 0.8;
  const mus: MusicCue[] = [
    music('tears-in-rain', tearsIn, dryFrom + 1.2, {id: 'c02-tears-a', src: TEARS, offset: 0, fadeIn: 2.0, fadeOut: 1.2, level: -6}),
    // back in softly on "Then", carried through the glass box to the chapter's last word
    music('tears-in-rain', dryTo, ch.end + 0.4, {id: 'c02-tears-b', src: TEARS, offset: 40, fadeIn: 1.6, fadeOut: 2.2, level: -7, automation: [[sc('02.7').start, -7], [sc('02.7').start + 1.5, -5]]}),
  ];
  return {sfx: out, music: mus};
};
