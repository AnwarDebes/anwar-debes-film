import type {FilmTimeline} from '../timeline';
import type {MusicCue, SfxCue} from '../../engine/audio/types';
import {cue, music, sfx} from '../../engine/audio/cues';
import {COOKIE_REC, POCKET_REC, SKILL_REC, times10} from './ch10/times';

// Chapter 10 sound: pure data from the timeline (no React), so the mix can be built in Node.
// Grammar (audio.md 3.3): one transition sound per cut, tonal notes on visual beats, soft pin
// brushes on sweeps, blips on chips, a stamp on the verdict, an impact on the gate. Levels are LU
// under the voice target.
//
// Music: the storyboard's Convergence is not in audio/music-manifest.json, so this chapter uses
// Discovery (the manifest's launch-montage cue, also Scott Buckley, CC BY 4.0) until it is added.
// Swap MUSIC_TRACK when the manifest gains it; every time below stays.

export const MUSIC_TRACK = 'discovery';

/** Keystroke times (seconds after `at`) for text typed at `cps`, plus the Enter key. */
const keys = (text: string, cps: number, enterAfter?: number): number[] => {
  const out = Array.from({length: text.length}, (_, k) => k / cps);
  if (enterAfter !== undefined) out.push(enterAfter);
  return out;
};

export const cues = (tl: FilmTimeline): {sfx: SfxCue[]; music: MusicCue[]} => {
  const T = times10(tl);
  const fps = tl.fps;
  const f = (s: number) => Math.round(s * fps);
  const out: SfxCue[] = [];
  const add = (c: SfxCue) => out.push({...c, id: `c10-${c.id ?? `${c.type}@${c.frame}`}`});
  const brush = (id: string, at: number, durS: number, level = -17, shape: 'rise' | 'fall' | 'bell' | 'flat' = 'bell') => add(cue.pinBrush(f(at), {id, durS, shape, level}));
  const blip = (id: string, at: number, degree = 5) => add(cue.blip(f(at), degree, {id, level: -21}));

  // 10.0 the gate: impact on frame 0 (the swell into it belongs to the chapter before)
  const G = T.gate;
  add(cue.impact(f(G.at), {id: 'gate-impact'}));
  brush('cube', G.at, 1.0, -15, 'rise');
  brush('unfold', G.unfold, 1.2, -16, 'bell');
  brush('street', G.street, 1.1, -17, 'fall');
  add(cue.note(f(G.cardIn + 0.2), 1, {id: 'card', octave: 4, level: -18}));

  // 10.1 the street: one whoosh on the lateral dolly
  add(cue.whoosh(f(T.street.dollyFrom + 2.2), {id: 'street-dolly', durS: 2.4, level: -24}));

  // 10.2 PocketOS
  const P = T.pocket;
  brush('pocket', P.wall, 1.0, -17, 'rise');
  add(cue.whoosh(f(P.recAt + 0.35), {id: 'phone-in', durS: 0.9, level: -22}));
  blip('pk-plate', P.plate, 5);
  add(cue.typing(f(P.rec.ls), keys('ls', 7, POCKET_REC.lsEnter - POCKET_REC.ls), {id: 'type-ls', level: -24}));
  add(cue.typing(f(P.rec.cd), keys('cd Documents', 12, POCKET_REC.cdEnter - POCKET_REC.cd), {id: 'type-cd', level: -24}));
  add(cue.typing(f(P.rec.cat), keys('cat welcome.md', 12, POCKET_REC.catEnter - POCKET_REC.cat), {id: 'type-cat', level: -24}));
  add(cue.typing(f(P.rec.frob), keys('frobnicate', 11, POCKET_REC.frobEnter - POCKET_REC.frob), {id: 'type-frob', level: -24}));
  add(cue.note(f(P.rec.frobEnter + 0.1), 2, {id: 'not-found', octave: 4, velocity: 0.5, level: -22}));
  add(cue.whoosh(f(P.laptopIn + 0.45), {id: 'laptop-in', durS: 0.9, level: -22}));
  add(cue.note(f(P.rule), 5, {id: 'rule-768', level: -17}));
  brush('bp-rule', P.rule - 0.15, 1.1, -18, 'flat');
  add(cue.whoosh(f(P.full), {id: 'fold-768', durS: 0.8, level: -28}));
  brush('tree', P.tree, 0.9, -18);
  add(cue.swish(f(P.strike + 0.2), {id: 'pencil', durS: 0.45, level: -23}));
  add(cue.note(f(P.fix), 3, {id: 'fix', level: -19}));

  // 10.3 Mneme
  const M = T.mneme;
  add(sfx('paper', f(M.wall + 0.15), {id: 'book-open', level: -19}));
  brush('mneme', M.wall, 1.0, -18, 'rise');
  blip('mn-plate', M.plate, 5);
  for (let k = 0; k < 5; k++) add(cue.tick(f(M.funnel + k * 0.42 + 0.2), {id: `card-tick${k}`, level: -22}));
  add(cue.note(f(M.seventeen), 6, {id: 'seventeen', level: -17}));
  add(cue.swish(f(M.flip + 0.35), {id: 'flip', durS: 0.5, level: -23}));
  add(cue.note(f(M.hard), 3, {id: 'hard', level: -18}));
  add(cue.swish(f(M.hard + 0.75), {id: 'code-in', durS: 0.4, level: -26}));
  add(cue.tick(f(M.rules + 0.05), {id: 'code-hl1', level: -25}));
  add(cue.tick(f(M.rules + 0.7), {id: 'code-hl2', level: -25}));
  add(cue.tick(f(M.rules + 1.5), {id: 'code-hl3', level: -25}));
  brush('receipt', M.receipt - 0.2, 0.9, -19, 'flat');
  add(cue.stamp(f(M.notRun + 0.35), {id: 'not-yet-run', level: -15}));

  // 10.4 IDM: three engine tones race, pitched to each lane's time; Q11 sustains off the edge
  const I = T.idm;
  add(cue.whoosh(f(I.wall + 0.6), {id: 'idm-dolly', durS: 1.4, level: -23}));
  blip('idm-plate', I.plate, 5);
  add(cue.note(f(I.split), 1, {id: 'split', level: -18}));
  add(sfx('camera_shutter', f(I.monitorIn + 0.45), {id: 'shutter', level: -18}));
  add(cue.note(f(I.mongoDone), 8, {id: 'lane-mongo', decay: 0.7, level: -17}));
  add(cue.note(f(I.neoDone), 5, {id: 'lane-neo', decay: 0.7, level: -19}));
  add(cue.note(f(I.pgDone), 3, {id: 'lane-pg', decay: 0.7, level: -19}));
  add(cue.note(f(I.q11), 1, {id: 'lane-q11', octave: 3, decay: 3.5, level: -19}));
  blip('vaccine', I.vaccine, 6);

  // 10.5 drone-id: a soft radar sweep, a tick when the weights settle
  const D = T.drone;
  add(cue.whoosh(f(D.press + 0.6), {id: 'drone-dolly', durS: 1.4, level: -23}));
  brush('drone-press', D.press + 0.7, 0.6, -18, 'fall');
  add(cue.swish(f(D.tiles + 1.4), {id: 'radar', durS: 2.6, level: -26}));
  add(cue.tick(f(D.renorm + 0.3), {id: 'renorm', level: -19}));
  add(cue.note(f(D.whose), 6, {id: 'whose', level: -18}));

  // 10.6 SkillBridgeNorway: the language toggle, a flat tone on the floor at 40
  const K = T.skill;
  add(cue.whoosh(f(K.recAt + 0.35), {id: 'skill-in', durS: 0.9, level: -23}));
  add(cue.tick(f(K.recAt + SKILL_REC.toEnglish), {id: 'toggle-en', level: -20}));
  add(cue.tick(f(K.recAt + SKILL_REC.toNorwegian), {id: 'toggle-no', level: -21}));
  for (const [k, w] of ['meaning', 'skills', 'place', 'freshness'].entries()) add(cue.tick(f(tl.word('u1017', w).start), {id: `formula${k}`, level: -23}));
  add(cue.note(f(K.forty), 1, {id: 'floor-40', octave: 4, decay: 1.6, level: -17}));

  // 10.7 CYFS: soft typing under the prompt (no music sampled from any song)
  const Y = T.cyfs;
  add(cue.whoosh(f(Y.wall + 0.6), {id: 'cyfs-dolly', durS: 1.4, level: -23}));
  add(cue.typing(f(Y.prompt + 0.2), keys('at 120 BPM upbeat high energy', 13), {id: 'prompt-type', level: -25}));
  add(cue.whoosh(f(Y.laptopIn + 0.4), {id: 'cyfs-in', durS: 0.9, level: -23}));
  add(cue.note(f(Y.gpu), 2, {id: 'gpu-32', level: -19}));

  // 10.8 Kaleido: a heavy clunk per model swap
  const Ka = T.kaleido;
  add(cue.whoosh(f(Ka.wall + 0.6), {id: 'kaleido-dolly', durS: 1.4, level: -23}));
  if (Ka.approved) {
    for (const [k, at] of [Ka.text, Ka.image, Ka.video].entries()) add(cue.stamp(f(at), {id: `swap${k}`, level: -21}));
    add(cue.note(f(Ka.bars + 0.4), 5, {id: 'bars', level: -19}));
    add(cue.note(f(Ka.rejected), 2, {id: 'rejected', octave: 4, level: -20}));
  }

  // 10.9 cookie-galaxy: a soft whoosh on the bite, the final hit on "yours", the swell into 11
  const Co = T.cookie;
  add(cue.whoosh(f(Co.recAt + 0.35), {id: 'cookie-in', durS: 0.9, level: -23}));
  add(cue.whoosh(f(Co.recAt + COOKIE_REC.scrollFrom + 0.8 * (COOKIE_REC.scrollTo - COOKIE_REC.scrollFrom)), {id: 'bite', durS: 0.7, level: -24}));
  brush('street-again', Co.street, 1.0, -18, 'bell');
  add(cue.chime(f(Co.machine), {id: 'own', level: -20}));
  add(cue.note(f(Co.yours), 1, {id: 'yours', level: -16, decay: 2.4}));
  brush('handoff', Co.release, 0.8, -20, 'fall');
  add(cue.swell(f(tl.scene('11.0').start), 1.4, {id: 'swell-11', toneDegree: 1}));

  // Music: in on the gate's frame 0, out on a fade after "yours"
  const m: MusicCue[] = [music(MUSIC_TRACK, G.at, Co.yours + 2.6, {id: 'c10-music', fadeIn: 0.4, fadeOut: 2.2, level: -6})];
  return {sfx: out, music: m};
};
