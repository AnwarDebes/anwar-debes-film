// Per-frame cost of pixieField on the film wall (176 x 126 hex pins) and of the
// 2D pose, measured in Node.
//   node --experimental-strip-types scripts/pixie/verify.mjs is the parity test; this is timing only:
//   node --experimental-strip-types --import ./scripts/pixie/register.mjs scripts/pixie/bench.ts
import {performance} from 'node:perf_hooks';
import {pixieField} from '../../src/pixie/field.ts';
import {pixiePose} from '../../src/pixie/pose.ts';
import {resolveTimeline} from '../../src/pixie/timeline.ts';
import {toDevice} from '../../src/pixie/pixie-core.ts';

const cols = 176;
const rows = 126;
const p = 1 / cols;
const rowH = (p * Math.sqrt(3)) / 2;
const extH = (rows - 1) * rowH + p;
const U: number[] = [];
const V: number[] = [];
for (let r = 0; r < rows; r++) {
  const odd = r % 2;
  const n = odd ? cols - 1 : cols;
  for (let c = 0; c < n; c++) {
    const x = -0.5 + p / 2 + c * p + (odd ? p / 2 : 0);
    const y = -((rows - 1) * rowH) / 2 + r * rowH;
    U.push(x + 0.5);
    V.push((y + extH / 2) / extH);
  }
}
const fps = 60;
const cues = [
  {frame: 0, activity: 'searching'},
  {frame: 200, activity: 'debugging'},
  {frame: 400, activity: 'success'},
];
const timeline = resolveTimeline(cues, fps);
const field = pixieField({fps, timeline, cell: 3 / cols, boardAspect: extH, center: [0.62, 0.5]});
const [u0, v0, u1, v1] = field.bounds;
const region: number[] = [];
for (let i = 0; i < U.length; i++) if (U[i] >= u0 && U[i] <= u1 && V[i] >= v0 && V[i] <= v1) region.push(i);

const run = (list: number[] | null, frames: number) => {
  let hits = 0;
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const n = list ? list.length : U.length;
    for (let k = 0; k < n; k++) {
      const i = list ? list[k] : k;
      if (field(U[i], V[i], i, t)) hits++;
    }
  }
  return {ms: (performance.now() - t0) / frames, hits: hits / frames};
};
run(region, 60); // warm up
const whole = run(null, 600);
const boxed = run(region, 600);
let t0 = performance.now();
let n = 0;
for (let f = 0; f < 6000; f++) n += toDevice(pixiePose({frame: f, fps, timeline}).rects, 20).length;
const poseMs = (performance.now() - t0) / 6000;
console.log(`board ${U.length} pins; Pixie box ${region.length} pins`);
console.log(`pixieField, every pin:      ${whole.ms.toFixed(3)} ms/frame (${whole.hits.toFixed(0)} pins hit)`);
console.log(`pixieField, region = bounds: ${boxed.ms.toFixed(3)} ms/frame`);
console.log(`2D pose + toDevice:          ${(poseMs * 1000).toFixed(1)} us/frame (${(n / 6000).toFixed(0)} rects)`);
