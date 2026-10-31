// Diffs a PixieDemo still rendered with {"mode":"u10"} (frame 0, scale 1, PNG)
// against research/pixie-golden/u10/<state>.png, tile by tile, in straight RGBA.
//
//   npx remotion still src/index.ts PixieDemo out/pixie/u10.png --frame=0 --scale=1 \
//     --gl=angle --image-format=png --props='{"mode":"u10"}'
//   node --experimental-strip-types scripts/pixie/compare-still.ts out/pixie/u10.png
import {PIXIE_STATES} from '../../src/pixie/pixie-core.ts';
import {readPng} from './png.ts';

const still = readPng(process.argv[2] ?? 'out/pixie/u10.png');
const dir = process.argv[3] ?? 'research/pixie-golden';
// Opaque pixels must match exactly. Translucent ones (shadow, thought dots, code
// lines) may differ by under one 8-bit level: Chrome stores premultiplied 8-bit
// colour, the goldens were composited in floating point and rounded once.
let total = 0;
let failed = 0;
let rounding = 0;
for (const [k, s] of PIXIE_STATES.entries()) {
  const ref = readPng(`${dir}/u10/${s}.png`);
  const ox = 20 + (k % 4) * 360;
  const oy = 20 + Math.floor(k / 4) * 340;
  let diff = 0;
  let near = 0;
  let maxD = 0;
  for (let y = 0; y < ref.h; y++) {
    for (let x = 0; x < ref.w; x++) {
      const a = (y * ref.w + x) * 4;
      const b = ((oy + y) * still.w + ox + x) * 4;
      const ra = ref.data[a + 3];
      const sa = still.data[b + 3];
      // Compare premultiplied values: colour is undefined where alpha is 0.
      let d = Math.abs(ra - sa);
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs((ref.data[a + c] * ra) / 255 - (still.data[b + c] * sa) / 255));
      if (d > 1 || (d > 0.5 && ra === 255)) diff++;
      else if (d > 0.5) near++;
      maxD = Math.max(maxD, d);
    }
  }
  total += ref.w * ref.h;
  failed += diff;
  rounding += near;
  console.log(`${diff === 0 ? 'ok  ' : 'DIFF'}  ${s.padEnd(10)} ${diff} px differ, ${near} translucent px within 1 level, max ${maxD.toFixed(2)}`);
}
console.log(`${total} px compared: ${failed} differ, ${rounding} translucent px within one 8-bit level`);
process.exit(failed ? 1 : 0);
