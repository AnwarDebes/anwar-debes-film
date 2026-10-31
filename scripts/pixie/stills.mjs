// Renders several stills of a composition with one bundle and one browser.
//
//   node scripts/pixie/stills.mjs --id=PixieDemo --frames=30,80,200 --out=out/pixie/film
//        [--scale=0.5] [--props='{"mode":"film"}'] [--format=png|jpeg] [--width=3840 --height=2160]
//
// Writes <out>-<frame>.<format>. One tab, frames in order: gentle on a shared GPU.
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
const id = args.id ?? 'PixieDemo';
const frames = String(args.frames ?? '0').split(',').map(Number);
const out = args.out ?? `out/pixie/${id}`;
const scale = Number(args.scale ?? 0.5);
const format = args.format ?? 'png';
const inputProps = args.props ? JSON.parse(args.props) : {};
const chromiumOptions = {gl: 'angle'};

fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
const t0 = Date.now();
const serveUrl = args.serve ?? (await bundle({entryPoint: path.resolve('src/index.ts'), onProgress: () => undefined}));
const browser = await openBrowser('chrome', {chromiumOptions});
const selected = await selectComposition({serveUrl, id, inputProps, chromiumOptions, puppeteerInstance: browser});
// Optional size override (e.g. the 4K master) without registering another composition.
const composition = {
  ...selected,
  width: args.width ? Number(args.width) : selected.width,
  height: args.height ? Number(args.height) : selected.height,
};
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const frame of frames) {
  const t = Date.now();
  const output = path.resolve(`${out}-${frame}.${format}`);
  await renderStill({composition, serveUrl, output, frame, scale, inputProps, imageFormat: format, chromiumOptions, puppeteerInstance: browser});
  console.log(`frame ${frame}: ${output} (${Date.now() - t} ms)`);
}
await browser.close({silent: true});
