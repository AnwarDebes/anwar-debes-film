import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, sfx} from '../../engine/audio/cues';
import {times12} from './ch12/times';

// Chapter 12 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Aphelion under the street; dry under HotCarWatch (a low heat hum only, no chime); back for
// SmokeShield, a gentle swell on the triage curve and a held chord on 'arithmetic'.

/** Aphelion (Scott Buckley, CC BY 4.0), fetched to public/ch12/music with its provenance JSON. */
const APHELION = 'public/ch12/music/aphelion.mp3';

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times12(tl);
  const F = (s: number) => tl.f(s);
  const out: SfxCue[] = [];
  const add = (...c: SfxCue[]) => out.push(...c);
  const brush = (at: number, durS: number, shape: 'rise' | 'fall' | 'bell' | 'flat' = 'bell', level?: number) => add(cue.pinBrush(F(at), {durS, shape, ...(level !== undefined ? {level} : {})}));
  const note = (at: number, degree: number, octave = 5, velocity?: number) => add(cue.note(F(at), degree, {octave, ...(velocity ? {velocity} : {})}));
  const blip = (at: number, degree = 5) => add(cue.blip(F(at), degree));
  const tick = (at: number) => add(cue.tick(F(at)));
  const dolly = (at: number) => {
    add(cue.whoosh(F(at + T.dollyDur * 0.5), {durS: 1.3, level: -22}));
    brush(at + 0.1, T.dollyDur * 0.8, 'flat', -30);
  };
  const arrive = (at: number) => {
    note(at, 5, 6, 0.5);
    blip(at + 0.25, 6);
  };

  // 12.0 the page turns
  add(cue.swell(F(T.gate.turn), 1.4, {toneDegree: 1}), cue.impact(F(T.gate.turn), {gainDb: -4}));
  add(sfx('paper', F(T.gate.turn + 0.1), {params: {dur: 1.2}, level: -22}));
  brush(T.gate.turn, 1.3, 'flat');
  note(T.gate.cardAt + 0.4, 5, 5, 0.5);

  // 12.1 the street, the ruler, the standing chip
  note(T.street.ruler, 3, 5, 0.5);
  tick(T.street.chip + 0.05);
  dolly(T.street.dolly);

  // 12.2 SleepArchitect
  const P = T.sleep;
  arrive(P.plate);
  add(cue.swish(F(P.window + 0.25), {durS: 0.5, level: -24}));
  // clicks in the capture (scripts/record/shots/ch12.json): fields at 1.0 and 3.35 s, the add button at 2.5 s, the tabs at 5.0 and 7.3 s
  for (const s of [1.0, 2.5, 3.35, 5.0, 7.3]) tick(P.window + s / P.rate);
  brush(P.curve, 1.0, 'rise', -28);
  for (let k = 0; k < 7; k++) tick(P.stack + k * 0.22 + 0.1);
  note(P.drake + 0.2, 5, 5);
  add(cue.chime(F(P.internal + 0.1), {level: -24}));
  add(sfx('paper', F(P.readme + 0.7), {params: {dur: 0.45}, level: -24}));
  note(P.lowers, 2, 4, 0.5);
  dolly(P.dolly);

  // 12.3 CaffeineSense
  const C = T.caff;
  arrive(C.plate);
  add(sfx('paper', F(C.curve + 0.2), {params: {dur: 0.6}, level: -28}));
  brush(C.smoker, 0.6, 'fall', -30);
  brush(C.preg, 0.6, 'rise', -30);
  add(cue.pinTick(F(C.cutoff + 0.3), {tau: 0.2}));
  tick(C.cutoff + 0.35);
  dolly(C.dolly);

  // 12.4 HotCarWatch: dry, a low heat hum only
  const R = T.car;
  arrive(R.plate);
  add(sfx('pin_brush', F(R.cabin), {params: {dur: Math.max(1, T.S5.start - R.cabin - 0.6), shape: 'flat', density: 120, f_range: [180, 420]}, level: -34}));
  brush(R.zero, 0.5, 'flat', -32);
  dolly(R.dolly);

  // 12.5 SmokeShield
  const M = T.smoke;
  arrive(M.plate);
  add(sfx('whoosh', F(M.haze + 1.0), {params: {dur: 2.6, f_lo: 180, f_hi: 900}, level: -30}));
  brush(M.settle, 1.4, 'fall', -28);
  add(cue.chime(F(M.checks + 0.2), {level: -26}));
  dolly(M.dolly);

  // 12.6 PipeGuard
  const G = T.pipe;
  arrive(G.plate);
  add(sfx('glitch', F(G.frost + 0.1), {params: {dur: 0.25}, level: -32}));
  brush(G.frost, 1.6, 'flat', -32);
  for (let k = 0; k < 6; k++) add(cue.pinTick(F(G.drip + k * 0.42), {tau: 0.05, level: -30}));
  for (let k = 0; k < 2; k++) tick(G.doors + k * 0.4);
  dolly(G.dolly);

  // 12.7 HomeJoule
  const J = T.joule;
  arrive(J.plate);
  for (let k = 0; k < 14; k++) tick(J.bars + k * 0.12);
  note(J.hpwh + 0.1, 5, 5);
  dolly(J.dolly);

  // 12.8 PyroPredict
  const Y = T.pyro;
  arrive(Y.plate);
  add(sfx('pin_brush', F(Y.spread), {params: {dur: 2.4, shape: 'rise', density: 260, f_range: [2600, 6200]}, level: -34}));
  brush(Y.threats, 0.7, 'flat', -28);
  add(cue.whoosh(F(Y.aware + 0.4), {durS: 0.9, level: -24}));
  blip(Y.noroute, 2);
  dolly(Y.dolly);

  // 12.9 ThermoGuard
  const Q = T.thermo;
  arrive(Q.plate);
  brush(Q.walls, 0.6, 'bell', -28);
  brush(Q.air, 0.6, 'bell', -28);
  note(Q.peak + 0.2, 3, 4, 0.55);
  brush(Q.city, 0.9, 'bell', -28);
  for (let k = 0; k < 15; k++) tick(Q.greedy + 0.05 + k * 0.05);
  for (let k = 0; k < 15; k++) tick(Q.equity + 0.05 + k * 0.05);
  add(sfx('paper', F(Q.report + 0.45), {params: {dur: 0.45}, level: -24}));
  brush(Q.line, 1.2, 'rise');
  note(Q.arithmetic, 1, 5, 0.7);
  note(Q.arithmetic + 0.05, 5, 5, 0.5);
  brush(Q.out, 0.9, 'fall', -30);

  const music: MusicCue[] = [
    {
      id: 'c12-aphelion',
      track: 'aphelion',
      src: APHELION,
      in: T.gate.turn + 0.3,
      out: T.ch.end,
      offset: 0,
      fadeIn: 0.6,
      fadeOut: 2.6,
      key: 'A minor',
      automation: [
        [R.dryFrom - 1.2, 0],
        [R.dryFrom, -60],
        [R.dryTo - 0.4, -60],
        [R.dryTo + 1.6, -2],
        [Q.greedy, -2],
        [Q.equity + 1.0, 1.5],
        [Q.report, -1],
        [Q.arithmetic, 2],
      ],
    },
  ];
  return {sfx: out, music};
};
