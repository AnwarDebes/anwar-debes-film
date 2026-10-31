import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music, sfx} from '../../engine/audio/cues';

// Chapter 01 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Every time below is the same formula the scene uses for the picture (ch01/*.tsx), read from the
// narration timeline, so the sound re-times with the voice.
//
// Music: Decoherence fades up under the light ramp of the black box (no pulse), Resonance enters
// with its first drop (10.88 s into the track, measured from the file) on frame 0 of the title,
// and its alternative mix carries on in place under the narration from 01.4 (the manifest's
// measured alignment, +219.83 ms, holds until 83 s into the main mix).

const RESONANCE_DROP_S = 10.88;

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const F = (s: number) => tl.f(s);
  const ch = tl.chapter('01');
  const sc = (id: string) => tl.scene(id);
  const w = (u: string, word: string) => tl.word(u, word);
  const out: SfxCue[] = [];

  // ---------------------------------------------------------------- 01.1 the black box
  const s1 = sc('01.1');
  const s2 = sc('01.2');
  const s3 = sc('01.3');
  const wAnswer = w('u0101', 'answer');
  const wSpinner = w('u0103', 'spinner');
  const burstAt = s2.start - 0.75;
  out.push(cue.pinBrush(F(s1.start + 1.05), {id: 'c01-box-rise', durS: 1.4, shape: 'rise', level: -24}));
  // the answer pin lights: a soft tonal note on the tonic (D when no music decides the key)
  out.push(cue.note(F(wAnswer.start - 0.12), 1, {id: 'c01-answer', octave: 5, level: -14}));
  out.push(cue.pinTick(F(wAnswer.start + 0.28), {id: 'c01-answer-out', level: -20}));
  // the spinner ticks like a clock while it turns (one tick per step of 1/8 s, every other step)
  const spinFrom = s1.start + 1.6;
  for (let t = spinFrom, k = 0; t < wSpinner.start + 0.05; t += 0.25, k++) out.push(cue.tick(F(t), {id: `c01-spin-${k}`, level: -26, gainDb: k % 2 ? -3 : 0}));

  // ---------------------------------------------------------------- 01.2 Pixie assembles
  const wPixie = w('u0104', 'Pixie');
  const pixieIn = Math.max(burstAt + 0.55, wPixie.start - 0.9);
  out.push(sfx('glitch', F(burstAt), {id: 'c01-burst', level: -20}));
  out.push(cue.pinBrush(F(pixieIn), {id: 'c01-pixie-pins', durS: 1.3, shape: 'rise', level: -16}));
  out.push(cue.impact(F(wPixie.end + 0.05), {id: 'c01-pixie-lands', level: -18}));
  const wThese = w('u0106', 'these');
  const w66 = w('u0106', 'sixty-six');
  out.push(cue.pinBrush(F(wThese.start + 0.2), {id: 'c01-map-plant', durS: 1.0, shape: 'bell', level: -24}));
  out.push(cue.blip(F(w66.start - 0.15), 5, {id: 'c01-rule-appears', level: -18}));
  // the lateral dolly
  out.push(cue.whoosh(F(w66.end + 1.6), {id: 'c01-dolly', durS: 2.6, level: -22}));

  // ---------------------------------------------------------------- 01.3 the title
  out.push(cue.subHit(F(s3.start), {id: 'c01-title-hit', level: -12}));
  out.push(cue.pinBrush(F(s3.start), {id: 'c01-title-pins', durS: 1.2, shape: 'rise', level: -18}));

  // ---------------------------------------------------------------- 01.4 the hero board
  const s4 = sc('01.4');
  out.push(cue.pinBrush(F(s4.start), {id: 'c01-portrait', durS: 1.6, shape: 'rise', level: -16}));
  out.push(cue.note(F(tl.utt('u0107').start + 0.2), 5, {id: 'c01-plate-site', level: -18}));
  const wClick = w('u0108', 'click');
  out.push(cue.tick(F(wClick.start), {id: 'c01-click', level: -16}));
  // the boolean flip: the chapter's biggest cascade
  out.push(cue.pinBrush(F(wClick.start + 0.05), {id: 'c01-bools', durS: 1.8, shape: 'bell', density: 1.4, level: -12}));
  const u9 = tl.utt('u0109');
  out.push(cue.pinBrush(F(u9.start - 0.55), {id: 'c01-guard', durS: 0.9, shape: 'flat', level: -20}));
  // typing under the code reveal, and a tick per highlighted line
  const keys: number[] = [];
  for (let k = 0; k < 14; k++) keys.push(k * 0.085);
  out.push(cue.typing(F(u9.start), keys, {id: 'c01-code-typing', level: -26}));
  for (const [word, u] of [['literal', 'u0109'], ['AND', 'u0110'], ['vote', 'u0110'], ['margin', 'u0110']] as const) out.push(cue.tick(F(w(u, word).start - 0.1), {id: `c01-hl-${word}`, level: -22}));
  // the votes tally: eleven ticks
  const wVote = w('u0110', 'vote');
  for (let k = 0; k < 11; k++) out.push(cue.pinTick(F(wVote.start + 0.1 + k * 0.06), {id: `c01-tally-${k}`, level: -24}));

  // ---------------------------------------------------------------- 01.5 the live guard
  const s5 = sc('01.5');
  out.push(cue.whoosh(F(s5.start + 0.6), {id: 'c01-laptop-in', durS: 1.1, level: -20}));
  const press = [w('u0112', 'obvious').start - 0.15, w('u0112', 'German').start - 0.2, tl.utt('u0112').end + 0.15, w('u0113', 'slips').start - 0.15, w('u0113', 'wrong').start - 0.2];
  press[2] = Math.min(press[2], press[3] - 1.3);
  const votes = [11, 3, 7, 5, 7];
  press.forEach((p, k) => {
    out.push(cue.tick(F(p), {id: `c01-ui-click-${k}`, level: -18}));
    const n = votes[k];
    for (let j = 0; j < n; j++) out.push(cue.pinTick(F(p + 0.55 + j * 0.06), {id: `c01-vote-${k}-${j}`, level: -26}));
    // the two misses land with one soft neutral tick each (no buzz: that is kept for the hard truths)
    if (k >= 3) out.push(cue.tick(F(p + 0.4), {id: `c01-miss-${k}`, level: -20, gainDb: -2}));
  });
  const u15 = tl.utt('u0115');
  out.push(cue.blip(F(u15.start + 0.4), 3, {id: 'c01-hash-chip', level: -18}));
  out.push(cue.whoosh(F(s5.end - 0.5), {id: 'c01-laptop-out', durS: 0.9, level: -22}));

  // ---------------------------------------------------------------- 01.6 the profile
  const s6 = sc('01.6');
  out.push(sfx('glitch', F(s6.start - 0.55), {id: 'c01-noise', level: -24}));
  out.push(cue.pinBrush(F(s6.start + 0.15), {id: 'c01-banner', durS: 1.2, shape: 'bell', level: -18}));
  out.push(sfx('paper', F(s6.start + 0.6), {id: 'c01-readme-page', level: -15}));
  out.push(sfx('paper', F(w('u0118', 'Measured').start - 0.3), {id: 'c01-table-page', level: -20}));
  const u19 = tl.utt('u0119');
  out.push(cue.pinBrush(F(u19.start - 0.5), {id: 'c01-research-map', durS: 1.4, shape: 'rise', level: -16}));
  for (let k = 0; k < 8; k++) out.push(cue.pinTick(F(u19.start + 0.4 + k * 0.32), {id: `c01-map-pin-${k}`, level: -26}));
  out.push(cue.blip(F(w('u0120', 'file').start - 0.45), 5, {id: 'c01-every-claim', level: -16}));

  // ---------------------------------------------------------------- 01.7-01.9 the montage
  const plots = [w('u0121', 'cloud').start - 0.3, w('u0122', 'practice').start - 0.3, w('u0122', 'web').start - 0.3, w('u0123', 'Tsetlin').start - 0.3];
  plots.forEach((p, k) => {
    if (k < 3) out.push(cue.tick(F(p), {id: `c01-plot-${k}`, level: -18}));
  });
  out.push(cue.whoosh(F(sc('01.7').start + 1.4), {id: 'c01-montage-dolly', durS: 1.8, level: -24}));
  const s8 = sc('01.8');
  // eight soft tinks as the bars settle, pitch rising with the state
  for (let k = 0; k < 8; k++) out.push(cue.note(F(s8.start + 0.2 + k * 0.11), [1, 2, 3, 5, 6, 7, 8, 9][k], {id: `c01-state-${k + 1}`, octave: 5, level: -26, velocity: 0.5}));
  out.push(cue.note(F(w('u0125', 'ninety-five').start), 5, {id: 'c01-95', octave: 5, level: -16}));
  const s9 = sc('01.9');
  out.push(cue.tick(F(s9.start + 0.15), {id: 'c01-plot-dnn', level: -18}));
  out.push(cue.tick(F(w('u0126', 'two').start - 0.2), {id: 'c01-plot-dna', level: -18}));

  // ---------------------------------------------------------------- 01.10 XOR, and the last line
  const s10 = sc('01.10');
  out.push(cue.swish(F(s10.start - 0.3), {id: 'c01-magnet', durS: 1.2, level: -24}));
  // each epoch a soft tick that speeds up (the learning plays fast, then settles)
  const wFound = w('u0127', 'found');
  const learnFrom = s10.start + 0.9;
  const learnTo = wFound.start - 0.35;
  for (let k = 1; k <= 20; k++) {
    const x = (k / 20) ** 2;
    out.push(cue.tick(F(learnFrom + x * (learnTo - learnFrom)), {id: `c01-epoch-${k}`, level: -26}));
  }
  out.push(cue.chime(F(wFound.start), {id: 'c01-found', level: -12}));
  const wTrue = w('u0128', 'true');
  const wFalse = w('u0128', 'false');
  out.push(cue.note(F(wTrue.start - 0.05), 5, {id: 'c01-true', octave: 5, level: -16}));
  out.push(cue.note(F(wFalse.start - 0.05), 1, {id: 'c01-false', octave: 4, level: -18}));
  out.push(cue.pinBrush(F(ch.end - 2.4), {id: 'c01-handoff', durS: 1.0, shape: 'fall', level: -26}));

  // ---------------------------------------------------------------- music
  const titleAt = s3.start;
  const resIn = titleAt - 0.8;
  const mus: MusicCue[] = [
    music('decoherence', s1.start + 1.2, titleAt + 1.2, {id: 'c01-decoherence', offset: 0, fadeIn: 2.4, fadeOut: 2.0, level: -7}),
    // the first drop of Resonance lands on frame 0 of the title
    music('resonance', resIn, s4.start + 1.5, {id: 'c01-resonance', offset: RESONANCE_DROP_S - 0.8, fadeIn: 0.6, level: -5}),
    // in place, the alternative mix under the narration from 01.4 to the end of the chapter
    {
      track: 'resonance-alt',
      id: 'c01-resonance-alt',
      in: s4.start,
      out: ch.end + 0.6,
      continues: 'c01-resonance',
      crossfade: 1.5,
      crossfadeCurve: 'hsin',
      fadeOut: 3.2,
      // HexGTM's empty board: the music thins for 1.5 s
      automation: [
        [plots[3] - 0.2, 0],
        [plots[3] + 0.3, -6],
        [plots[3] + 1.8, -6],
        [plots[3] + 2.4, 0],
      ],
    },
  ];
  return {sfx: out, music: mus};
};
