import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {chapterTurn, cue, music} from '../../engine/audio/cues';
import {candorCheck as check} from '../../data/ch05/candor-check';
import {clock} from './ch03/kit/time';

// Chapter 05 sound: pure data from the timeline, placed with the same expressions as the pictures.
// A lighter impact into the light palette; a soft click per atom press and nothing at all on the
// distractor (the silence matches "nothing moves"); a cascade as the δ values fall; no buzz under
// the misses; a chime only on the printed pass.

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const c = clock(tl);
  const f = (s: number) => tl.f(s);
  const ch = tl.chapter('05');
  const S = (id: string) => c.sc(id);
  const sfx: SfxCue[] = [];
  const add = (...x: SfxCue[]) => sfx.push(...x);

  // 05.0 the sink: a reverse swell, a soft (high-passed) impact, air
  add(...chapterTurn(f(S('05.0').start), {lead: 'swell', durS: 1.4, toneDegree: 3, id: 'c05-turn', impact: false}));
  add(cue.impact(f(S('05.0').start), {id: 'c05-impact', level: -16, gainDb: -4}));
  add(cue.pinBrush(f(S('05.0').start), {id: 'c05-rim', durS: 1.0, shape: 'rise', level: -16}));
  add(cue.pinBrush(f(S('05.0').start + 0.8), {id: 'c05-paper', durS: 1.4, shape: 'bell', level: -18}));
  add(cue.note(f(c.u('u0501').start - 0.1), 5, {id: 'c05-three', octave: 5, level: -17}));

  // 05.1 the place
  const plateAt = c.u('u0502').start - 0.1;
  add(cue.blip(f(plateAt), 5, {id: 'c05-plate', level: -17}));
  add(cue.note(f(plateAt + 0.05), 3, {id: 'c05-rule-pin', octave: 6, level: -18}));
  add(cue.pinBrush(f(plateAt), {id: 'c05-seal', durS: 0.8, shape: 'rise', level: -17}));

  // 05.2 typing under the code, a tick per lane split
  add(cue.pinBrush(f(S('05.2').start - 0.4), {id: 'c05-row-h', durS: 0.8, shape: 'rise', level: -17}));
  add(cue.pinBrush(f(c.w('u0503', 'rebuilds')), {id: 'c05-row-hat', durS: 0.7, shape: 'flat', level: -18}));
  add(cue.note(f(c.w('u0503', 'leak') - 0.1), 6, {id: 'c05-leak', octave: 5, level: -17}));
  add(cue.tick(f(c.w('u0503', 'concepts')), {id: 'c05-hl-1', level: -21}), cue.tick(f(c.w('u0503', 'leak') - 0.2), {id: 'c05-hl-2', level: -21}));
  const lanes = [c.u('u0504').start, c.w('u0504', 'twin'), c.w('u0504', 'swapped')];
  lanes.forEach((t, i) => add(cue.tick(f(t), {id: `c05-lane-${i}`, level: -19})));
  add(cue.note(f(c.w('u0505', 'delta')), 5, {id: 'c05-delta', octave: 5, level: -16}));

  // 05.3 a soft click per atom press, a rising tone as δ swings toward 1, silence on the distractor
  add(cue.whoosh(f(S('05.3').start - 0.2), {id: 'c05-laptop-in', durS: 0.9, level: -17}));
  add(cue.pinBrush(f(c.u('u0507').start - 0.2), {id: 'c05-atoms', durS: 0.8, shape: 'rise', level: -18}));
  add(cue.tick(f(c.w('u0508', 'off')), {id: 'c05-press-c', level: -18}));
  add(cue.riser(f(c.w('u0509', 'one')), 0.9, {id: 'c05-delta-rise', level: -18}));
  add(cue.tick(f(c.w('u0511', 'trigger')), {id: 'c05-trigger', level: -18}));
  add(cue.note(f(c.w('u0511', 'trigger') + 0.4), 2, {id: 'c05-alien', octave: 5, level: -17}));

  // 05.4 the δ values fall as a soft cascade; no buzz under "tighter", a quiet low tone
  const histAt = c.w('u0513', 'alone');
  add(cue.pinBrush(f(histAt), {id: 'c05-cascade', durS: 1.5, shape: 'fall', level: -17}));
  add(cue.blip(f(c.w('u0512', 'zero')), 5, {id: 'c05-delta-chip', level: -19}));
  add(cue.blip(f(c.w('u0513', 'AUC')), 6, {id: 'c05-auc-chip', level: -19}));
  add(cue.note(f(c.w('u0515', 'tighter')), 1, {id: 'c05-tighter', octave: 3, level: -16}));
  add(cue.note(f(c.w('u0516', 'loose')), 1, {id: 'c05-loose', octave: 3, level: -17}));

  // 05.5 keyboard foley, a chime on the printed pass, a soft data whoosh along the tracer
  const typeAt = S('05.5').start + 0.4;
  const cmd = check.runs[0].cmd;
  add(cue.typing(f(typeAt), Array.from({length: cmd.length}, (_, i) => i / 24), {id: 'c05-type', level: -21}));
  const outAt = typeAt + cmd.length / 24 + 0.7;
  const passIdx = check.runs[0].output.findIndex((l) => l.startsWith('# pass'));
  add(cue.chime(f(outAt + passIdx / 16), {id: 'c05-pass', level: -15}));
  add(cue.whoosh(f(c.w('u0518', 'script') + 0.6), {id: 'c05-tracer', durS: 1.6, level: -20}));
  add(cue.pinTick(f(c.w('u0519', 'overclaimed') - 0.2), {id: 'c05-strike', level: -19}));
  add(cue.note(f(c.u('u0519').end), 5, {id: 'c05-new-title', octave: 5, level: -17}));
  add(cue.note(f(c.w('u0520', 'certificate')), 1, {id: 'c05-certificate', octave: 5, level: -14}));

  // music: Signal to Noise is not in the film's music manifest yet; a stretch of Decoherence that no
  // other chapter uses (4:00 on) stands in, thinning for the misses, out on a long fade
  const m: MusicCue[] = [
    music('decoherence', S('05.0').start + 0.5, ch.end, {
      id: 'c05-bed',
      offset: 240,
      fadeIn: 1.5,
      fadeOut: 2.5,
      level: -6,
      automation: [
        [c.u('u0514').start - 0.5, 0],
        [c.u('u0514').start + 0.5, -4],
        [c.u('u0517').start, -4],
        [c.u('u0517').start + 1.5, 0],
      ],
    }),
  ];
  return {sfx, music: m};
};
