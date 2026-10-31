#!/usr/bin/env node
// Records selftest/index.html through the full pipeline and measures every moving object frame by
// frame in the decoded H.264, so timing errors show up as numbers rather than impressions.
//
//   node scripts/record/selftest.mjs
//
// Expected per-frame motion at 60 fps (see selftest/index.html):
//   rAF (timestamp) 5 px, CSS animation 5 px, CSS transition 10 px from 0.5 s, WAAPI 5 px,
//   setInterval +30 px exactly every 6 frames, Date.now() 5 px, smooth scroll from 1.0 s.
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {recordShot} from './record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'out', 'record-selftest');
const W = 800, H = 500;

const shot = {
  name: 'selftest',
  url: pathToFileURL(path.join(here, 'selftest', 'index.html')).href,
  viewport: {width: W, height: H},
  deviceScaleFactor: 1,
  duration: 2.5,
  colorScheme: 'dark',
  jpegQuality: 95,
  cursor: {start: [100, 450], visible: true, size: 24},
  actions: [
    {at: 0.3, type: 'move', to: '#btn', duration: 0.6},
    {at: 1.2, type: 'click'},
  ],
};

const decode = (file) =>
  new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {stdio: ['ignore', 'pipe', 'inherit']});
    const chunks = [];
    ff.stdout.on('data', (d) => chunks.push(d));
    ff.on('close', (c) => (c === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg ${c}`))));
  });

// centroid x of a colour inside a horizontal band
const track = (fr, y0, y1, match) => {
  let sx = 0, n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (match(fr[i], fr[i + 1], fr[i + 2])) {
        sx += x;
        n++;
      }
    }
  return n > 40 ? sx / n : null;
};
// top edge y of the white scrolling bar
const barY = (fr) => {
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 100; x < 700; x += 4) {
      const i = (y * W + x) * 3;
      if (fr[i] > 200 && fr[i + 1] > 200 && fr[i + 2] > 200) n++;
    }
    if (n > 100) return y;
  }
  return null;
};

const objects = [
  {name: 'rAF timestamp', band: [30, 50], m: (r, g, b) => r > 160 && g < 90 && b < 90, expect: 5},
  {name: 'CSS animation', band: [80, 100], m: (r, g, b) => g > 160 && r < 90 && b < 90, expect: 5},
  {name: 'CSS transition', band: [130, 150], m: (r, g, b) => b > 160 && r < 90 && g < 90, expect: 10},
  {name: 'Web Animation', band: [180, 200], m: (r, g, b) => r > 160 && g > 160 && b < 90, expect: 5},
  {name: 'setInterval', band: [230, 250], m: (r, g, b) => r > 160 && b > 160 && g < 90, expect: null},
  {name: 'Date.now', band: [280, 300], m: (r, g, b) => g > 160 && b > 160 && r < 90, expect: 5},
];

const main = async () => {
  const meta = await recordShot(shot, {outDir: path.relative(path.resolve(here, '..', '..'), outDir)});
  const file = path.join(outDir, `${meta.name}.mp4`);
  const raw = await decode(file);
  const fsz = W * H * 3;
  const n = raw.length / fsz;
  console.log(`decoded ${n} frames from ${file}`);
  for (const o of objects) {
    const xs = [];
    for (let f = 0; f < n; f++) xs.push(track(raw.subarray(f * fsz, (f + 1) * fsz), o.band[0], o.band[1], o.m));
    const d = [];
    for (let f = 1; f < n; f++) if (xs[f] !== null && xs[f - 1] !== null) d.push(+(xs[f] - xs[f - 1]).toFixed(2));
    const movingD = d.filter((v) => Math.abs(v) > 0.5 && Math.abs(v) < 300);
    const wraps = d.filter((v) => v < -300).length;
    if (o.expect) {
      const bad = movingD.filter((v) => Math.abs(v - o.expect) > 0.75);
      console.log(`${o.name.padEnd(15)} steps=${movingD.length} mean=${(movingD.reduce((a, b) => a + b, 0) / Math.max(1, movingD.length)).toFixed(3)} min=${Math.min(...movingD)} max=${Math.max(...movingD)} expected=${o.expect} off-by>0.75px=${bad.length} wraps=${wraps}`);
    } else {
      const jumps = [];
      for (let f = 1; f < n; f++) if (xs[f] !== null && xs[f - 1] !== null && Math.abs(xs[f] - xs[f - 1]) > 15) jumps.push(f);
      const gaps = jumps.slice(1).map((v, i) => v - jumps[i]);
      console.log(`${o.name.padEnd(15)} jumps at frames ${jumps.slice(0, 8).join(',')}... gaps=${[...new Set(gaps)].join('/')} (expected 6)`);
    }
  }
  const ys = [];
  for (let f = 0; f < n; f++) ys.push(barY(raw.subarray(f * fsz, (f + 1) * fsz)));
  const moves = [];
  for (let f = 1; f < n; f++) if (ys[f] !== ys[f - 1]) moves.push(`${f}:${ys[f - 1] === null ? '-' : ys[f - 1]}>${ys[f] === null ? '-' : ys[f]}`);
  console.log(`smooth scroll: bar top first moves at frame ${moves[0]?.split(':')[0]}, ${moves.length} moving frames; ${moves.slice(0, 12).join(' ')}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
