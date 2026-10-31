// Writes audio/cues/demo.json, the cue sheet of the AudioDemo test mix, the way the film timeline
// will: words from the narration timeline, music cues per chapter, SFX on visual beats, and the
// pin sounds computed from a compiled pin wall (the same code the PinWall renders from).
//
//   node --experimental-strip-types --import ./scripts/audio/register.mjs scripts/audio/demo-cues.ts
//   then: python scripts/audio/mix.py audio/cues/demo.json
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chapterTurn, cue, cueSheet, music} from '../../src/engine/audio/cues.ts';
import {pinBeatHist, pinBrushCue} from '../../src/engine/audio/pins.ts';
import {FILM_WALL, makeBoard} from '../../src/engine/pins/board.ts';
import {compileWall, settledBeat} from '../../src/engine/pins/timeline.ts';
import type {Beat, PinSample} from '../../src/engine/pins/types.ts';
import type {NarrationTimeline} from '../../src/engine/narration/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FPS = 60;
const DURATION_S = 24;
const f = (s: number) => Math.round(s * FPS);

const words: NarrationTimeline = JSON.parse(fs.readFileSync(path.join(root, 'public/audio/demo/words.json'), 'utf8'));
const w = (text: string) => {
  for (const u of words.utterances) for (const x of u.words) if (x.text.replace(/[^\w'-]/g, '') === text) return x;
  throw new Error(`word ${text} not in the demo narration`);
};

// The demo's wall: the portrait grows out of flat steel, a ruled raster clears it for the
// chapter card, then three clause blocks rise.
const flat = (): PinSample => ({h: 0, tint: 0.9});
const dome = (u: number, v: number): PinSample => {
  const r2 = ((u - 0.68) ** 2 + ((v - 0.52) * 0.72) ** 2) / (2 * 0.12 ** 2);
  return {h: r2 < 9 ? 0.95 * Math.exp(-r2) : 0, tint: 0.9};
};
const plate = (u: number, v: number): PinSample => ({h: u > 0.07 && u < 0.62 && v > 0.36 && v < 0.68 ? 0.32 : 0, tint: 0.9});
const clauses = (u: number, v: number): PinSample => {
  const inBox = [0.6, 0.71, 0.82].some((x) => u > x && u < x + 0.08 && v > 0.42 && v < 0.6);
  return inBox ? {h: 0.55, tint: 1, glow: 0.8} : plate(u, v);
};
const beats: Beat[] = [
  settledBeat('rest', flat),
  {id: 'portrait', at: 6.6, field: dome, sweep: {origin: [0.68, 0.52], speed: 0.9, jitterS: 0.06}},
  {id: 'card', at: 12.0, field: plate, sweep: {origin: [0, 0.5], speed: 1.25, kind: 'linear', direction: [1, 0], jitterS: 0.04}},
  {id: 'clauses', at: 19.45, field: clauses, sweep: {origin: [0.7, 0.5], speed: 1, kind: 'random', spreadS: 0.55, jitterS: 0.02}},
];
const wall = compileWall(makeBoard(FILM_WALL), beats);
const pinCue = (id: string, level?: number) => {
  const c = pinBrushCue(wall, id, level !== undefined ? {level} : {});
  if (!c) throw new Error(`beat ${id} moves no pins`);
  return c;
};

const card = f(12.0);
const sheet = cueSheet({
  name: 'demo',
  fps: FPS,
  durationS: DURATION_S,
  out: 'public/audio/demo',
  voice: {src: 'public/audio/demo/standin.wav', wordsFrom: 'public/audio/demo/words.json', targetLufs: -16},
  music: {
    level: -5,
    cues: [
      // cold open: Decoherence has no pulse, so the voice sits easily; enter where its swell begins.
      // It lifts in the 4 s breath after "does." (+3 dB), then hands over to the riser in its last second
      music('decoherence', 0, 12.0, {id: 'M1', offset: 18.0, fadeIn: 1.2, fadeOut: 1.0}),
      // the Tsetlin chapter: Machina starts clean on the chapter card's impact (keys differ, so a
      // riser and an impact bridge the two instead of a crossfade); offset 1.13 s puts Machina's
      // first onset (1.135 s, measured) on the impact's frame
      music('machina', 12.0, DURATION_S, {id: 'M2', offset: 1.13, fadeIn: 0.02, fadeOut: 1.2}),
    ],
  },
  sfx: {
    cues: [
      pinCue('portrait'),
      cue.note(f(w('Anwar').start + 0.8), 6, {id: 'portrait-note-1'}),
      cue.note(f(w('Debes').start + 0.9), 3, {id: 'portrait-note-2', velocity: 0.7}),
      ...chapterTurn(card, {durS: 1.6, id: 'card'}),
      pinCue('card'),
      cue.swish(f(w('Tsetlin').start), {id: 'tsetlin-card'}),
      pinCue('clauses', -26),
      cue.note(f(w('clauses').start), 3, {id: 'clauses-note'}),
      cue.blip(f(w('read').start), 5, {id: 'chip-read'}),
      cue.blip(f(w('check').start), 6, {id: 'chip-check'}),
      cue.blip(f(w('argue').start), 8, {id: 'chip-argue'}),
      cue.stamp(f(w('with').end + 0.22), {id: 'verdict-stamp'}),
      cue.chime(f(w('with').end + 0.25), {id: 'verdict-chime'}),
    ],
  },
  master: {lufs: -15, ceilingDb: -2.0, truePeakMaxDb: -1.5},
});

const out = path.join(root, 'audio/cues/demo.json');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, `${JSON.stringify(sheet, null, 1)}\n`);
const moved = ['portrait', 'card', 'clauses'].map((id) => `${id} ${pinBeatHist(wall, id)?.moved} pins`).join(', ');
console.log(`demo cue sheet: ${sheet.sfx?.cues.length} sfx, ${sheet.music?.cues.length} music cues (${moved}) -> ${path.relative(root, out)}`);
