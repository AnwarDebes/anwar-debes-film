// Checks that src/engine/audio/duck.ts (the music automation Remotion previews use) computes the
// same curve as scripts/audio/duck_env.py (what mix.py bakes into the master), frame by frame.
//
//   node --experimental-strip-types --no-warnings --import ./scripts/audio/register.mjs scripts/audio/parity.ts [words.json]
//
// Word sets: the demo narration (or the file given), plus synthetic edge cases: a gap just over
// the merge gap (partial swell), long holds (lifts), back-to-back phrases, a single word, none.
// Exit code 1 if any frame differs by more than 0.001 dB (gain) or 0.0001 (voice activity).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeMusicCurve} from '../../src/engine/audio/duck.ts';
import type {NarrationTimeline} from '../../src/engine/narration/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const python = process.env.FILM_AUDIO_PYTHON ?? path.join(process.env.FILM_TOOLS ?? path.join(os.homedir(), 'film-tools'), 'venv-audio', 'bin', 'python');
const FPS = 60;

const wordsFile = process.argv[2] ?? path.join(root, 'public/audio/demo/words.json');
const tl: NarrationTimeline = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
const demo: Array<[number, number]> = tl.utterances.flatMap((u) => u.words.map((w): [number, number] => [w.start, w.end]));

const cases: Array<{name: string; durS: number; words: Array<[number, number]>; spec?: Record<string, number>}> = [
  {name: path.basename(wordsFile), durS: tl.durationS, words: demo},
  {name: 'partial swell (1.6 s gap)', durS: 12, words: [[3.0, 3.3], [3.35, 3.7], [3.8, 4.4], [6.0, 6.5], [6.55, 7.2]]},
  {name: 'long holds', durS: 30, words: [[2.0, 2.6], [9.0, 9.4], [9.5, 11.0], [19.0, 19.3], [25.5, 26.0]]},
  {name: 'phrases 1.49 s apart (merged)', durS: 10, words: [[1.0, 2.0], [3.49, 4.0], [5.49, 6.0]]},
  {name: 'single word at 0', durS: 5, words: [[0.0, 0.4]]},
  {name: 'no words', durS: 4, words: []},
  {name: 'custom params', durS: 16, words: [[1.0, 2.0], [4.2, 5.0], [11.0, 12.0]], spec: {depthDb: -8, mergeGapS: 2, swellDb: 4, swellMinGapS: 4}},
];

const pyKw: Record<string, string> = {
  depthDb: 'depth_db', mergeGapS: 'merge_gap', preS: 'pre', attackS: 'attack', holdS: 'hold', releaseS: 'release',
  fullSwellGapS: 'full_gap', swellDb: 'swell_db', swellMinGapS: 'swell_min_gap', swellRiseS: 'swell_rise', swellFallS: 'swell_fall',
};

const script = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(root, 'scripts/audio').replace(/\\/g, '/'))})
import duck_env
out = []
for c in json.load(sys.stdin):
    g, d, ph = duck_env.music_curve([tuple(w) for w in c["words"]], c["durS"], rate=${FPS}, **c["kw"])
    out.append({"gain": [float(x) for x in g], "depth": [float(x) for x in d]})
json.dump(out, sys.stdout)
`;
const payload = cases.map((c) => ({
  durS: c.durS,
  words: c.words,
  kw: Object.fromEntries(Object.entries(c.spec ?? {}).map(([k, v]) => [pyKw[k], v])),
}));
const run = spawnSync(python, ['-c', script], {input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 1 << 28});
if (run.status !== 0) {
  console.error(run.stderr || run.error);
  process.exit(2);
}
const py: Array<{gain: number[]; depth: number[]}> = JSON.parse(run.stdout);

let failed = 0;
for (let k = 0; k < cases.length; k++) {
  const c = cases[k];
  const curve = makeMusicCurve(c.words, c.spec ?? {});
  const n = py[k].gain.length;
  let dg = 0;
  let dd = 0;
  let at = 0;
  for (let f = 0; f < n; f++) {
    const t = f / FPS;
    const eg = Math.abs(curve.gainDb(t) - py[k].gain[f]);
    const ed = Math.abs(curve.depth(t) - py[k].depth[f]);
    if (eg > dg) {
      dg = eg;
      at = f;
    }
    dd = Math.max(dd, ed);
  }
  const ok = dg <= 1e-3 && dd <= 1e-4;
  if (!ok) failed++;
  const lo = Math.min(...py[k].gain);
  const hi = Math.max(...py[k].gain);
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(30)} ${String(n).padStart(5)} frames  max |dGain| ${dg.toExponential(1)} dB${dg > 0 ? ` (frame ${at})` : ''}` +
      `  max |dDepth| ${dd.toExponential(1)}  range ${lo.toFixed(2)}..${hi.toFixed(2)} dB`,
  );
}
process.exit(failed ? 1 : 0);
