import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music, sfx} from '../../engine/audio/cues';
import {times13} from './ch13/times';

// Chapter 13 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Nightfall (main mix) returns quietly; the trading plots (ballast, hugin, Goblin) play dry, and
// the strings return for the last line. One transition sound per cut, notes on visual beats,
// soft pin brushes on sweeps, a chime only where a printed check passes.

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times13(tl);
  const f = (s: number) => Math.round(s * tl.fps);
  const out: SfxCue[] = [];
  const add = (c: SfxCue) => out.push({...c, id: `c13-${c.id ?? `${c.type}@${c.frame}`}`});
  const brush = (id: string, at: number, durS: number, level = -17, shape: 'rise' | 'fall' | 'bell' | 'flat' = 'bell') => add(cue.pinBrush(f(at), {id, durS, shape, level}));
  const blip = (id: string, at: number, degree = 5) => add(cue.blip(f(at), degree, {id, level: -21}));
  const dollyWhoosh = (id: string, at: number) => add(cue.whoosh(f(at + 0.6), {id, durS: 1.4, level: -23}));

  // 13.0 the page turns: impact on frame 0 (the swell into it belongs to the chapter before)
  const G = T.gate;
  add(cue.impact(f(G.at), {id: 'gate-impact'}));
  brush('page', G.at, 1.4, -15, 'flat');
  add(sfx('paper', f(G.at + 0.25), {id: 'page-turn', level: -18}));
  add(cue.note(f(G.cardIn + 0.2), 1, {id: 'card', octave: 4, level: -18}));

  // 13.1 the street
  add(cue.whoosh(f(T.street.dollyFrom + 2.6), {id: 'street-dolly', durS: 2.2, level: -24}));
  add(cue.note(f(T.street.stricter), 5, {id: 'stricter', level: -19}));

  // 13.2 knotten-web: a soft click on the chip, the thread, a dry low tick on the failing chip
  const K = T.web;
  brush('lengde', K.wall, 1.0, -17, 'rise');
  blip('web-plate', K.plate);
  add(cue.tick(f(K.kilde), {id: 'kilde-click', level: -17}));
  add(cue.swish(f(K.thread + 0.45), {id: 'thread', durS: 0.9, level: -24}));
  add(cue.note(f(K.thread + 0.5), 6, {id: 'quote', level: -19}));
  add(cue.tick(f(K.build + 0.15), {id: 'build-fails', level: -16}));

  // 13.3 knotten-test: soft card slaps as the specs stack; a paper flip on the "8"
  const Te = T.test;
  dollyWhoosh('test-dolly', Te.wall);
  blip('test-plate', Te.plate);
  for (let k = 0; k < 14; k++) add(cue.tick(f(Te.specs + k * 0.12), {id: `spec${k}`, level: -24}));
  add(cue.note(f(Te.notes), 3, {id: 'notes', level: -19}));
  if (Te.briefShown) {
    add(sfx('paper', f(Te.flip - 0.1), {id: 'eight-flip', level: -18}));
    add(cue.note(f(Te.homes), 5, {id: 'homes', level: -18}));
  }

  // 13.4 knotten-test-2: a fine tink per water bearing, a slow clock under the sun dial, a low thud
  const Tw = T.twin;
  dollyWhoosh('twin-dolly', Tw.wall);
  brush('twin', Tw.wall, 1.3, -16, 'rise');
  blip('twin-plate', Tw.plate);
  brush('wide', Tw.wide, 1.1, -18, 'bell');
  for (let k = 0; k < 6; k++) add(cue.pinTick(f(Tw.water + k * 0.13), {id: `bearing${k}`, level: -22}));
  add(cue.note(f(Tw.water + 0.9), 6, {id: 'water', level: -18}));
  for (let k = 0; k < 10; k++) add(cue.tick(f(Tw.sun + 0.6 + k * 0.5), {id: `clock${k}`, level: -25}));
  add(cue.note(f(Tw.quarter), 2, {id: 'quarter', level: -19}));
  if (Tw.treesShown) {
    add(cue.subHit(f(Tw.gone), {id: 'trees-gone', level: -19}));
    brush('trees-sink', Tw.gone - 0.2, 0.9, -19, 'fall');
  }
  if (Tw.sheetShown) add(cue.note(f(Tw.high), 2, {id: 'sheet', octave: 4, level: -19}));

  // 13.5 grimstad-kiosk-grill: ember crackle under the bars
  const Gr = T.grill;
  dollyWhoosh('grill-dolly', Gr.wall);
  brush('menu', Gr.wall, 1.1, -17, 'rise');
  blip('grill-plate', Gr.plate);
  add(cue.note(f(Gr.seventy), 5, {id: 'seventy-four', level: -18}));
  for (let k = 0; k < 8; k++) add(cue.pinTick(f(Gr.wall + 1.2 + k * 0.9), {id: `ember${k}`, level: -27}));

  // 13.6 Trondheim-Cookies: a tap on each language, a coin-like tink on the fee
  const Ck = T.cookies;
  dollyWhoosh('cookies-dolly', Ck.wall);
  blip('ck-plate', Ck.plate);
  for (const [k, at] of [Ck.english, Ck.norwegian, Ck.arabic].entries()) add(cue.tick(f(at), {id: `lang${k}`, level: -21}));
  add(cue.pinTick(f(Ck.free + 0.5), {id: 'fee-tink', level: -18}));
  add(cue.note(f(Ck.syria), 3, {id: 'syria', level: -19}));

  // 13.7 ballast (dry): a low tick per price step, a firm click on EXIT, a chime when 11 pass
  const B = T.ballast;
  dollyWhoosh('ballast-dolly', B.wall);
  blip('ba-plate', B.plate);
  for (let k = 0; k < 4; k++) add(cue.tick(f(B.falling - 0.1 + k * 0.42), {id: `price${k}`, level: -20}));
  add(cue.stamp(f(B.stop), {id: 'exit', level: -17}));
  add(cue.typing(f(B.run + 0.2), Array.from({length: 24}, (_, k) => k / 24), {id: 'pytest-type', level: -25}));
  add(cue.chime(f(B.run + 1.5), {id: 'eleven-pass', level: -19}));
  add(cue.note(f(B.run + 3.0), 2, {id: 'collection', octave: 4, velocity: 0.5, level: -22}));

  // 13.8 hugin (dry): a soft latch per rung, silence at the top
  const Hu = T.hugin;
  dollyWhoosh('hugin-dolly', Hu.wall);
  blip('hu-plate', Hu.plate);
  add(cue.tick(f(Hu.earn), {id: 'rung1', level: -19}));
  add(cue.tick(f(Hu.ninety - 0.2), {id: 'rung2', level: -19}));
  add(cue.tick(f(Hu.today - 0.2), {id: 'rung3', level: -19}));

  // 13.9 Goblin (dry): a single low tone under the 50% line
  const Go = T.goblin;
  dollyWhoosh('goblin-dolly', Go.wall);
  blip('go-plate', Go.plate);
  if (Go.approved) {
    brush('bus', Go.wall, 1.0, -18, 'flat');
    brush('hit', Go.comment, 0.9, -19, 'bell');
    add(cue.note(f(Go.coin), 1, {id: 'coin-flip', octave: 3, decay: 2.2, level: -18}));
  }

  // 13.10 the strings return on "source"; the swell into chapter 14's cube
  const Cl = T.close;
  for (let j = 0; j < 8; j++) add(cue.blip(f(Cl.glow + 0.4 + j * 0.16), [1, 2, 3, 5, 6, 5, 3, 2][j], {id: `number${j}`, level: -23}));
  brush('closing-rule', Cl.line + 0.5, 0.9, -19, 'flat');
  add(cue.note(f(Cl.source), 1, {id: 'source', level: -16, decay: 2.4}));
  brush('handoff', Cl.release, 0.8, -20, 'fall');
  add(cue.swell(f(tl.scene('14.0').start), 1.4, {id: 'swell-14', toneDegree: 1}));

  // Music: Nightfall (main mix) quietly from the page turn; out before the trading plots, which
  // play dry; back on the closing line so the strings arrive on "source"
  const s7 = tl.scene('13.7');
  const m: MusicCue[] = [
    music('nightfall', G.at, s7.start + 0.4, {id: 'c13-music-a', fadeIn: 0.6, fadeOut: 2.4, level: -9}),
    music('nightfall', Cl.start - 1.2, T.chEnd + 0.2, {id: 'c13-music-b', offset: Cl.start - 1.2 - G.at, fadeIn: 2.2, fadeOut: 1.6, level: -7}),
  ];
  return {sfx: out, music: m};
};
