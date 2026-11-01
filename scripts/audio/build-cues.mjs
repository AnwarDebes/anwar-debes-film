// Builds the film's cue sheet for scripts/audio/mix.py from every chapter's chNN.cues.ts,
// the narration clips in src/data/timeline.json, and the shared mix settings.
//
//   node scripts/audio/build-cues.mjs [--out=audio/cues/film.json]
//   then: <venv-audio>/bin/python scripts/audio/mix.py audio/cues/film.json
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const outPath = args.out || 'audio/cues/film.json';
const ids = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'];

const entry = path.resolve('.tmp/cues-entry.ts');
fs.mkdirSync(path.dirname(entry), {recursive: true});
fs.writeFileSync(
  entry,
  [
    `import {timeline} from '../src/film/timeline';`,
    ...ids.map((id) => `import {cues as c${id}} from '../src/film/chapters/ch${id}.cues';`),
    `export const tl = timeline;`,
    `export const chapters = {${ids.map((id) => `'${id}': c${id}`).join(', ')}};`,
  ].join('\n'),
);
const bundle = path.resolve('.tmp/cues-bundle.mjs');
await build({entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: bundle, logLevel: 'error', loader: {'.json': 'json'}});
const mod = await import(pathToFileURL(bundle).href + `?t=${Date.now()}`);
const tl = mod.tl;

const sfx = [];
const music = [];
for (const id of ids) {
  const c = mod.chapters[id](tl);
  for (const s of c.sfx ?? []) sfx.push({...s, id: s.id ?? `c${id}-sfx-${sfx.length}`});
  for (const m of c.music ?? []) music.push({...m, id: m.id ?? `c${id}-music-${music.length}`});
}
const clips = (tl.clips ?? []).map((c) => ({src: c.file, at: c.start, trimStartS: c.trimStartS ?? 0, durS: c.durS}));

const sheet = {
  version: 1,
  name: 'film',
  fps: tl.fps,
  durationS: tl.durationS,
  durationInFrames: tl.durationInFrames,
  out: 'public/audio/film',
  voiceTargetLufs: -16,
  voice: {clips, targetLufs: -16, highpassHz: 70, wordsFrom: 'src/data/timeline.json'},
  duck: {underVoiceLU: 18.5, mergeGapS: 2.5, fullSwellGapS: 6.0, swellMinGapS: 6.0, preS: 0.1, attackS: 0.3, holdS: 0.3, releaseS: 1.0, swellDb: 2.0},
  music: {level: -5, cues: music.sort((a, b) => (a.in ?? 0) - (b.in ?? 0))},
  sfx: {cues: sfx.sort((a, b) => (a.frame ?? a.at * tl.fps) - (b.frame ?? b.at * tl.fps))},
  master: {lufs: -14, ceilingDb: -3.0, truePeakMaxDb: -1.0},
  files: {format: 'flac'},
};
fs.mkdirSync(path.dirname(outPath), {recursive: true});
fs.writeFileSync(outPath, JSON.stringify(sheet, null, 1));
// Shorts are heard on phone speakers: the same mix with the background 2 LU further under the voice.
const shorts = {...sheet, name: 'film-shorts', out: 'public/audio/film-shorts', duck: {...sheet.duck, underVoiceLU: 20.5, balance: {median: [18.5, 23.5], p10Min: 15}}};
fs.writeFileSync(outPath.replace(/\.json$/, '-shorts.json'), JSON.stringify(shorts, null, 1));
fs.rmSync(entry, {force: true});
fs.rmSync(bundle, {force: true});
console.log(`cue sheet: ${clips.length} voice clips, ${music.length} music cues, ${sfx.length} sfx cues, ${tl.durationS.toFixed(1)} s -> ${outPath}`);
