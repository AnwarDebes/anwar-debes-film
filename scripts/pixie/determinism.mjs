// Render-order determinism (pixie.md 8.12, test 4): frames rendered in sequence
// in one tab (caches warm) must equal the same frames rendered alone in fresh tabs.
//
//   node scripts/pixie/determinism.mjs [--from=726] [--to=731] [--scale=0.5]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const from = Number(args.from ?? 726);
const to = Number(args.to ?? 731);
const scale = Number(args.scale ?? 0.5);
const dir = path.resolve('out/pixie/determinism');
fs.rmSync(dir, {recursive: true, force: true});
fs.mkdirSync(dir, {recursive: true});
const chromiumOptions = {gl: 'angle'};
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => undefined});
const browser = await openBrowser('chrome', {chromiumOptions});
const composition = await selectComposition({serveUrl, id: 'PixieDemo', inputProps: {}, chromiumOptions, puppeteerInstance: browser});

await renderFrames({
  composition,
  serveUrl,
  inputProps: {},
  outputDir: path.join(dir, 'seq'),
  imageFormat: 'png',
  frameRange: [from, to],
  concurrency: 1,
  scale,
  chromiumOptions,
  puppeteerInstance: browser,
  onStart: () => undefined,
  onFrameUpdate: (n) => process.stdout.write(`\rsequence ${n}/${to - from + 1}`),
});
console.log('');
const seqFiles = fs.readdirSync(path.join(dir, 'seq')).filter((f) => f.endsWith('.png')).sort();
let differ = 0;
// Alone, in reverse order, each in a fresh page.
for (let f = to; f >= from; f--) {
  const solo = path.join(dir, `solo-${f}.png`);
  await renderStill({composition, serveUrl, output: solo, frame: f, scale, inputProps: {}, imageFormat: 'png', chromiumOptions, puppeteerInstance: browser});
  const match = seqFiles.find((n) => n.includes(String(f)));
  const same = match && Buffer.compare(fs.readFileSync(path.join(dir, 'seq', match)), fs.readFileSync(solo)) === 0;
  if (!same) differ++;
  console.log(`frame ${f}: ${same ? 'identical' : 'DIFFERENT'} (${match ?? 'missing'})`);
}
await browser.close({silent: true});
console.log(differ === 0 ? 'render order does not change any frame' : `${differ} frames differ`);
process.exit(differ ? 1 : 0);
