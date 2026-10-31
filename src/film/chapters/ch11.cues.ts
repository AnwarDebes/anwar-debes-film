import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music, sfx as sfxCue} from '../../engine/audio/cues';
import {times11} from './ch11/times';

// Chapter 11 sound: pure data from the timeline (no React), so the mix can be built in Node.
// One tick per chip, the generator's spray resolving into eight pitched tinks, the drift's low
// groan, the dense fall of 276 pins with one left ringing, five soft locks, a snap on consensus,
// a pencil on the README's number, a crumble half as long for lifelong-tm, and a hit on "measured".

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times11(tl);
  const {g, t1, t2, t3, t4, t5, t6, t7} = T;
  const f = (s: number) => tl.f(s);
  const sfx: SfxCue[] = [];
  const add = (...c: SfxCue[]) => sfx.push(...c);

  // 11.0 the gate: impact on frame 0; the cube rises, the net unfolds
  add(cue.impact(f(g.at), {id: 'c11-gate-impact'}));
  add(cue.pinBrush(f(g.at), {id: 'c11-cube', durS: 0.9, shape: 'rise', level: -16}));
  add(cue.pinBrush(f(g.unfold), {id: 'c11-unfold', durS: 1.0, shape: 'bell', level: -16}));

  // 11.1 one tick per chip as it stamps
  for (let k = 0; k < 6; k++) add(cue.tick(f(t1.chips + k * 0.22 + 0.3), {id: `c11-chip-${k}`, level: -18}));
  add(cue.pinBrush(f(t1.plate), {id: 'c11-plate', durS: 0.8, shape: 'bell', level: -18}));

  // 11.2 DiTM: the name plate, the forward flips, the spray that resolves into eight tinks
  add(cue.blip(f(t2.plate), 5, {id: 'c11-ditm-plate', level: -16}));
  for (let s = 0; s < 8; s++) add(cue.pinTick(f(t2.flips + s * 0.36), {id: `c11-ditm-fwd-${s}`, level: -22}));
  add(cue.pinBrush(f(t2.noise), {id: 'c11-ditm-spray', durS: 0.8, shape: 'flat', level: -18}));
  const revStep = Math.max(0.3, (t2.stepsEnd + 0.3 - t2.noise) / 8);
  for (let s = 1; s <= 8; s++) add(cue.note(f(t2.noise + s * revStep), [1, 2, 3, 5, 6, 7, 8, 8][s - 1], {id: `c11-ditm-tink-${s}`, level: -20, octave: 5, decay: 0.5}));
  add(cue.chime(f(t2.noise + 8 * revStep + 0.15), {id: 'c11-ditm-settled', level: -16}));
  add(cue.note(f(t2.broken), 2, {id: 'c11-ditm-broken', level: -18}));
  add(cue.blip(f(t2.auc), 5, {id: 'c11-ditm-auc', level: -18}));

  // 11.3 ConfTM: the label set, the drift's low groan, one steady tone on the adaptive line
  add(cue.blip(f(t3.plate), 5, {id: 'c11-conf-plate', level: -16}));
  add(cue.pinTick(f(t3.set), {id: 'c11-conf-set', level: -18}));
  add(cue.swish(f(t3.change), {id: 'c11-conf-drift', durS: 1.6, level: -20}));
  add(cue.note(f(t3.ninety), 5, {id: 'c11-conf-aci', level: -14, decay: 2.2}));

  // 11.4 RobTM: a scanning tick roll, then 276 pins fall at once and one is left ringing
  add(cue.blip(f(t4.plate), 5, {id: 'c11-rob-plate', level: -16}));
  for (let k = 0; k < 10; k++) add(cue.tick(f(t4.scan + k * ((t4.single - 0.3 - t4.scan) / 10)), {id: `c11-rob-scan-${k}`, level: -24}));
  add(cue.pinBrush(f(t4.single), {id: 'c11-rob-fall', durS: 0.7, shape: 'fall', density: 2.2, level: -13}));
  add(cue.pinTick(f(t4.single + 0.6), {id: 'c11-rob-survivor', level: -16, tau: 0.3}));

  // 11.5 CCTM: a soft paired tone for the two rows, a descending tick as the gap falls
  add(cue.blip(f(t5.plate), 5, {id: 'c11-cctm-plate', level: -16}));
  add(cue.note(f(t5.place + 0.3), 3, {id: 'c11-cctm-row-a', level: -20}));
  add(cue.note(f(t5.twin), 5, {id: 'c11-cctm-row-b', level: -20}));
  add(cue.tick(f(t5.four - 0.1), {id: 'c11-cctm-gap-b', level: -18}));
  add(cue.tick(f(t5.muted), {id: 'c11-cctm-gap-c', level: -20}));

  // 11.6 FedTM: five soft locks, noise on the jitter, a clean snap, a pencil on the README
  add(cue.blip(f(t6.plate), 5, {id: 'c11-fed-plate', level: -16}));
  for (let s = 0; s < 5; s++) add(cue.pinTick(f(t6.place + 0.25 + s * 0.16), {id: `c11-fed-lock-${s}`, level: -20}));
  add(cue.pinBrush(f(t6.noise), {id: 'c11-fed-noise', durS: Math.max(0.6, t6.round - t6.noise), shape: 'flat', density: 0.6, level: -22}));
  add(cue.stamp(f(t6.round), {id: 'c11-fed-snap', level: -16}));
  add(sfxCue('paper', f(t6.twenty - 0.15), {id: 'c11-fed-pencil', level: -18, params: {dur: 0.6}}));

  // 11.7 lifelong-tm: erosion, the memory, the six numbers, the hit on "measured"
  add(cue.blip(f(t7.plate), 5, {id: 'c11-life-plate', level: -16}));
  add(cue.pinBrush(f(t7.forgets), {id: 'c11-life-crumble-plain', durS: 1.2, shape: 'fall', density: 0.8, level: -20}));
  add(cue.pinBrush(f(t7.forgets + 0.2), {id: 'c11-life-crumble-lifelong', durS: 0.6, shape: 'fall', density: 0.5, level: -22}));
  for (let k = 0; k < 6; k++) add(cue.blip(f(t7.six + 0.3 + k * 0.12), [1, 2, 3, 5, 6, 8][k], {id: `c11-final-${k}`, level: -20}));
  add(cue.impact(f(t7.measured), {id: 'c11-measured-hit', level: -10}));
  add(cue.pinBrush(f(t7.clear), {id: 'c11-handoff', durS: 1.2, shape: 'fall', level: -18}));
  // reverse swell into the 12 gate
  add(cue.swell(f(T.next.start), 1.4, {id: 'c11-into-12', toneDegree: 1}));

  // Resonance, the alternative mix's back half (no melody, driving synths), ending on the hit
  const musicCues: MusicCue[] = [
    music('resonance-alt', g.at + 0.5, t7.measured + 0.25, {id: 'c11-resonance', offset: 125, fadeIn: 0.25, fadeOut: 0.6}),
  ];
  return {sfx, music: musicCues};
};
