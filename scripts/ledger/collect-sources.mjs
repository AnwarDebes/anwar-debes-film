// Collects every source the film shows, from the film itself: renders sampled frames of the Film
// composition with inputProps {sourceLog: true} (src/engine/ledger/sources.ts) and keeps each
// source's first time on screen. Pixels are thrown away.
//
//   node scripts/ledger/collect-sources.mjs --bundle=build/ledger          (bundle once)
//   node scripts/ledger/collect-sources.mjs --serve=build/ledger --frames=0-59347 [--every=6]
//        [--scale=0.2] [--concurrency=2] [--out=out/ledger/sources-0.jsonl]
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
if (args.bundle) {
  const dir = path.resolve(args.bundle);
  await bundle({entryPoint: path.resolve('src/index.ts'), outDir: dir, onProgress: () => undefined});
  console.log('[collect] bundled to ' + dir);
  process.exit(0);
}
const gl = args.gl || process.env.FILM_GL || 'angle';
const every = Number(args.every || 6);
const scale = Number(args.scale || 0.2);
const concurrency = Number(args.concurrency || 2);
const inputProps = {sourceLog: true};
const serveUrl = path.resolve(args.serve || 'build/ledger');
const composition = await selectComposition({serveUrl, id: 'Film', inputProps, chromiumOptions: {gl}});
let start = 0;
let end = composition.durationInFrames - 1;
if (args.frames) {
  const [a, b] = args.frames.split('-').map(Number);
  start = a;
  if (Number.isFinite(b)) end = b;
}
const out = path.resolve(args.out || 'out/ledger/sources-' + start + '-' + end + '.jsonl');
fs.mkdirSync(path.dirname(out), {recursive: true});
const first = new Map();
const t0 = Date.now();
let lines = 0;
let lastLog = 0;
const save = () => {
  const rows = [...first].map(([k, t]) => JSON.stringify({t, ...JSON.parse(k)}));
  fs.writeFileSync(out, rows.join('\n') + '\n');
};
await renderFrames({
  composition,
  serveUrl,
  inputProps,
  outputDir: null,
  imageFormat: 'jpeg',
  jpegQuality: 20,
  scale,
  concurrency,
  frameRange: [start, end],
  everyNthFrame: every,
  chromiumOptions: {gl},
  onStart: () => undefined,
  onFrameUpdate: (n) => {
    const now = Date.now();
    if (now - lastLog > 15000) {
      lastLog = now;
      save();
      console.log('[collect] ' + n + ' frames, ' + (n / ((now - t0) / 1000)).toFixed(1) + ' fps, ' + first.size + ' sources');
    }
  },
  onFrameBuffer: () => undefined,
  onBrowserLog: (log) => {
    const m = /^FILMSOURCE (\S+) (.*)$/.exec(log.text);
    if (!m) return;
    lines++;
    const t = Number(m[1]);
    const prev = first.get(m[2]);
    if (prev === undefined || t < prev) first.set(m[2], t);
  },
});
save();
console.log('[collect] done: ' + first.size + ' sources from ' + lines + ' log lines in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s -> ' + out);
