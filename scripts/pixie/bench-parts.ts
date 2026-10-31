// Splits pixieField's per-frame cost into its parts (timing only).
import {performance} from 'node:perf_hooks';
import {pixieField} from '../../src/pixie/field.ts';
import {pixiePose} from '../../src/pixie/pose.ts';
import {CompiledPixie, emptySample} from '../../src/pixie/sampler.ts';

const cols = 176;
const rows = 126;
const p = 1 / cols;
const rowH = (p * Math.sqrt(3)) / 2;
const extH = (rows - 1) * rowH + p;
const U = new Float32Array(22113);
const V = new Float32Array(22113);
let i = 0;
for (let r = 0; r < rows; r++) {
  const odd = r % 2;
  const n = odd ? cols - 1 : cols;
  for (let c = 0; c < n; c++, i++) {
    const x = -0.5 + p / 2 + c * p + (odd ? p / 2 : 0);
    const y = -((rows - 1) * rowH) / 2 + r * rowH;
    U[i] = x + 0.5;
    V[i] = (y + extH / 2) / extH;
  }
}
const N = i;
const fps = 60;
const cell = 3 / cols;
const center: [number, number] = [0.62, 0.5];
const time = (label: string, frames: number, fn: (f: number) => number) => {
  for (let f = 0; f < 30; f++) fn(f);
  const t0 = performance.now();
  let acc = 0;
  for (let f = 0; f < frames; f++) acc += fn(f);
  console.log(`${label.padEnd(34)} ${((performance.now() - t0) / frames).toFixed(3)} ms/frame  (${(acc / frames).toFixed(0)})`);
};

const cp = new CompiledPixie();
const out = emptySample();
const u0 = center[0] - 17 * cell;
const cellV = cell / extH;
const v0 = center[1] + 16 * cellV;
time('compile + sample all pins', 300, (f) => {
  cp.compile(pixiePose({frame: f, fps, state: 'searching'}).rects);
  let hits = 0;
  for (let k = 0; k < N; k++) if (cp.sample((U[k] - u0) / cell, (v0 - V[k]) / cellV, out)) hits++;
  return hits;
});
time('bbox test only', 300, (f) => {
  cp.compile(pixiePose({frame: f, fps, state: 'searching'}).rects);
  let inside = 0;
  for (let k = 0; k < N; k++) {
    const x = (U[k] - u0) / cell;
    const y = (v0 - V[k]) / cellV;
    if (x >= cp.minX && x < cp.maxX && y >= cp.minY && y < cp.maxY) inside++;
  }
  return inside;
});
const field = pixieField({fps, state: 'searching', cell, boardAspect: extH, center});
time('pixieField all pins', 300, (f) => {
  let hits = 0;
  for (let k = 0; k < N; k++) if (field(U[k], V[k], k, f / fps)) hits++;
  return hits;
});
time('pose only', 3000, (f) => pixiePose({frame: f, fps, state: 'searching'}).rects.length);
