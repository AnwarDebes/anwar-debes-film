import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, sfx} from '../../engine/audio/cues';
import {times09} from './ch09/times';

// Chapter 09 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): one transition sound per move, pin brushes on sweeps, tonal notes on
// visual beats, blips on chips, ticks on counters, a chime only when a printed check passes, the
// polite error once (the 'C.' hard truth), and Filaments dry for 3 s before it.

/** Filaments (Scott Buckley, CC BY 4.0), fetched to public/ch09/music with its provenance JSON. */
const FILAMENTS = 'public/ch09/music/filaments.mp3';

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times09(tl);
  const F = (s: number) => tl.f(s);
  const out: SfxCue[] = [];
  const add = (...c: SfxCue[]) => out.push(...c);
  const brush = (at: number, durS: number, shape: 'rise' | 'fall' | 'bell' | 'flat' = 'bell', level?: number) => add(cue.pinBrush(F(at), {durS, shape, ...(level !== undefined ? {level} : {})}));
  const note = (at: number, degree: number, octave = 5, velocity?: number) => add(cue.note(F(at), degree, {octave, ...(velocity ? {velocity} : {})}));
  const blip = (at: number, degree = 5) => add(cue.blip(F(at), degree));
  const tick = (at: number) => add(cue.tick(F(at)));
  const dolly = (at: number, dur: number) => {
    add(cue.whoosh(F(at + dur * 0.5), {durS: Math.min(1.4, dur), level: -22}));
    brush(at + 0.1, dur * 0.8, 'flat', -30);
  };
  /** the moment a place's name plate appears and its rule-line pin lights */
  const arrive = (at: number) => {
    note(at, 5, 6, 0.55);
    blip(at + 0.25, 6);
  };

  // ---------------------------------------------------------------- 09.0 the gate
  const G = T.gate;
  add(cue.swell(F(G.cube), 1.4, {toneDegree: 1}), cue.impact(F(G.cube)));
  brush(G.cube, 0.7, 'rise');
  add(cue.whoosh(F(G.unfold + G.unfoldDur * 0.55), {durS: 1.1, level: -24}));
  brush(G.unfold + 0.1, G.unfoldDur, 'bell');
  brush(G.tree, 1.3, 'bell');
  note(G.tree + 0.5, 1, 5);
  note(G.cardAt + 0.4, 5, 5, 0.5);

  // ---------------------------------------------------------------- 09.1 tsetlin-zoo
  const Z = T.zoo;
  add(sfx('paper', F(Z.doc), {params: {dur: 0.9}}));
  brush(Z.doc, 1.1, 'bell');
  arrive(Z.plate);
  blip(Z.paths + 0.2);
  note(Z.axis, 3, 5, 0.5);
  tick(Z.bracket + 0.6);
  brush(Z.rows, 0.6, 'flat', -30);
  blip(Z.caveat + 0.1, 3);
  dolly(Z.dolly, Z.dollyDur);

  // ---------------------------------------------------------------- 09.2 subword-dep-graphtm
  const B = T.sub;
  arrive(B.plate);
  for (let k = 0; k < 5; k++) tick(B.nodes + 0.1 + k * 0.14);
  for (let k = 0; k < 4; k++) tick(B.seq + 0.12 + k * 0.16);
  tick(B.deps + 0.25);
  tick(B.deps + 0.5);
  note(B.bar + 0.2, 5, 5);
  blip(B.readme, 3);
  add(sfx('paper', F(B.strike), {params: {dur: 0.45}, level: -24}));
  blip(B.misses + 0.1, 2);

  // ---------------------------------------------------------------- 09.3 attention-distilled-graphtm
  const A = T.attn;
  brush(A.morph, 1.2, 'bell');
  arrive(A.plate);
  add(cue.pinTick(F(A.focus + 0.25), {tau: 0.2}));
  brush(A.all, 0.9, 'rise', -26);
  add(cue.swish(F(A.dissolve + 0.4), {durS: 0.9, level: -24}));
  brush(A.dissolve, 0.9, 'fall', -28);
  note(A.bar + 0.2, 5, 5);

  // ---------------------------------------------------------------- 09.4 decoder-attention-distill-graphtm
  const D = T.dec;
  brush(D.split, 1.3, 'bell');
  arrive(D.plate);
  brush(D.chain, 0.8, 'flat', -28);
  blip(D.stats, 5);
  for (let k = 0; k < 3; k++) note(D.bars + k * 0.28, [5, 3, 1][k], 5, 0.6);
  add(cue.chime(F(D.sig + 0.1), {degrees: [1, 3, 5], level: -24}));
  blip(D.caveatFull[0], 3);

  // ---------------------------------------------------------------- 09.5 tm-llm-robustness-benchmark
  const R = T.rob;
  brush(R.raster, 1.1, 'flat');
  arrive(R.plate);
  brush(R.bars, 0.7, 'rise', -28);
  add(cue.swish(F(R.tm + 0.35), {durS: 1.1, level: -22}));
  add(cue.swish(F(R.bert + 0.15), {durS: 0.4, level: -26}));
  note(R.quote + 0.1, 1, 3, 0.5);
  blip(R.caveats, 3);

  // ---------------------------------------------------------------- 09.6 HGTM
  const H = T.hgtm;
  brush(H.layers, 1.0, 'flat');
  arrive(H.plate);
  brush(H.both, 0.4, 'rise', -30);
  brush(H.lowered, 0.6, 'fall', -28);
  // the feedback line goes quiet: no sound on purpose
  add(sfx('typing', F(H.code + 0.1), {params: {keys: [0, 0.07, 0.15, 0.21, 0.3]}, level: -30}));
  for (let k = 0; k < 3; k++) add(cue.pinTick(F(H.bars + 0.25 + k * 0.22), {tau: 0.12}));

  // ---------------------------------------------------------------- 09.7 RGTM
  const G7 = T.rgtm;
  brush(G7.block, 0.7, 'rise');
  arrive(G7.plate);
  G7.stamps.forEach((at) => add(cue.stamp(F(at), {level: -24})));
  for (let k = 0; k < 5; k++) note(G7.hop1 + 0.12 + k * 0.12, 5, 5, 0.45);
  [2, 6, 1, 7, 5].forEach((d, k) => note(G7.hop2 + 0.12 + k * 0.12, d, 5, 0.45));
  for (let k = 0; k < 5; k++) note(G7.banks + 0.12 + k * 0.12, 8, 5, 0.45);

  // ---------------------------------------------------------------- 09.8 Multi-HGTM
  const M = T.multi;
  brush(M.towers, 1.0, 'rise');
  arrive(M.plate);
  brush(M.fire, 0.6, 'fall', -28);
  add(cue.pinTick(F(M.head + 0.25), {tau: 0.25}));
  brush(M.rule, 0.9, 'bell');
  add(cue.swish(F(M.plane + 0.6), {durS: 1.2, level: -26}));
  brush(M.late, 0.6, 'rise', -28);
  [1, 2, 3, 5, 6].forEach((d, k) => note(M.clause + 0.1 + k * 0.13, d, 5, 0.5));
  add(cue.chime(F(M.done + 0.05), {level: -24}));
  brush(M.bcw, 0.8, 'bell');
  add(cue.stamp(F(M.ns), {level: -24}));
  brush(M.missing, 0.8, 'bell');
  note(M.thirds, 2, 4, 0.5);

  // ---------------------------------------------------------------- 09.9 graphtm-cbr
  const C = T.cbr;
  dolly(C.dolly, C.dollyDur);
  brush(C.mol, 1.4, 'rise');
  note(C.mol + 1.2, 1, 4, 0.6);
  arrive(C.plate);
  blip(C.question, 2);
  add(cue.swish(F(C.press + 0.15), {durS: 0.7, level: -26}));

  // ---------------------------------------------------------------- 09.10 five steps
  const P = T.steps;
  [P.s1, P.s2, P.s3, P.s4, P.s5].forEach((at) => tick(at + 0.05));
  brush(P.s1, 0.8, 'flat', -28);
  brush(P.split, 0.4, 'flat', -30);
  brush(P.s2, 1.0, 'bell', -26);
  add(cue.chime(F(P.hop1 + 0.2), {degrees: [5, 8], level: -28}));
  brush(P.code, 0.5, 'flat', -32);
  brush(P.s3, 0.8, 'fall', -26);
  brush(P.path, 1.0, 'rise', -24);
  brush(P.towers, 0.8, 'rise', -26);
  brush(P.edits, 0.8, 'bell', -28);
  for (let k = 0; k < 9; k++) tick(P.gates + 0.1 + k * 0.11);
  note(P.keep + 0.2, 5, 5, 0.6);

  // ---------------------------------------------------------------- 09.11 the flip, 'C.', RDKit
  const X = T.flip;
  brush(X.close, 1.0, 'bell');
  blip(X.margin, 5);
  add(sfx('glitch', F(X.remove), {level: -26, params: {dur: 0.12}}));
  for (let k = 0; k < 10; k++) tick(X.below + 0.2 + k * 0.11);
  add(cue.chime(F(X.safe + 0.05), {level: -24}));
  blip(X.alert, 2);
  brush(X.mol22, 0.9, 'bell', -28);
  // dry for three seconds (music automation below), then one low note and the polite error
  note(X.cdot, 1, 3, 0.8);
  add(cue.error(F(X.cdot + 0.08)));
  {
    const keys: number[] = [];
    const lines = [
      ['from rdkit import Chem', 60, 0.3],
      ['Chem.GetMolFrags(Chem.MolFromSmiles("C.Cn1c(N)nc2c3ncc(-c4ccccc4)nc3ccc21"))', 70, 0.9],
    ] as const;
    for (const [text, cps, off] of lines) for (let i = 0; i < text.length; i += 2) keys.push(off + i / cps);
    for (let i = 0; i < 6; i++) keys.push(X.frags - 0.45 - X.rdkit + i / 30);
    add(sfx('typing', F(X.rdkit), {params: {keys}, level: -28}));
  }
  add(cue.chime(F(X.frags + 0.1), {level: -24}));
  note(X.closing, 1, 4, 0.5);

  // ---------------------------------------------------------------- 09.12 the numbers card, the line
  const Q = T.close;
  brush(Q.grid, 0.9, 'rise');
  for (let k = 0; k < 8; k++) tick(Q.counter + ((Q.counterEnd - Q.counter) * k) / 7);
  add(cue.chime(F(Q.counterEnd + 0.1), {level: -24}));
  brush(Q.ghost, 0.6, 'fall', -30);
  brush(Q.auroc, 0.9, 'flat', -28);
  note(Q.rf, 2, 4, 0.45);
  brush(Q.kazius, 0.9, 'bell', -28);
  brush(Q.clause3, 1.0, 'rise', -26);
  brush(Q.line, 1.2, 'rise');
  note(Q.structure, 1, 5, 0.7);
  brush(Q.out, 0.9, 'fall', -30);

  // ---------------------------------------------------------------- music
  // Filaments enters 0.5 s after the gate's impact and thins to a pad for graphtm-cbr. It stops 3 s
  // before 'C.' (the dry beat), then re-enters late in the track, placed so that the end of its last
  // swell (313 s into the track, where it starts to decay) lands on 'structure'.
  const inS = G.cube + 0.5;
  const dry0 = X.cdot - 3.0;
  const inB = X.cdot + 1.2;
  const SWELL_END = 313;
  const music: MusicCue[] = [
    {
      id: 'c09-filaments',
      track: 'filaments',
      src: FILAMENTS,
      in: inS,
      out: dry0,
      offset: 0,
      fadeIn: 0.4,
      fadeOut: 0.6,
      key: 'E minor',
      automation: [
        [T.S9.start - 0.5, 0],
        [T.S9.start + 2.5, -6],
      ],
    },
    {
      id: 'c09-filaments-out',
      track: 'filaments',
      src: FILAMENTS,
      in: inB,
      out: T.ch.end,
      offset: Math.max(0, SWELL_END - (Q.structure - inB)),
      fadeIn: 2.0,
      fadeOut: 2.2,
      key: 'E minor',
      automation: [
        [inB, -6],
        [Q.line - 1.0, -3],
        [Q.structure, 0],
      ],
    },
  ];
  return {sfx: out, music};
};
