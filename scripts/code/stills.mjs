// Renders a list of stills from one bundle, one frame at a time in a single
// tab (gentle on a shared laptop GPU).
//
//   node scripts/code/stills.mjs --id=CodeDemo --frames=30,190,520 [--scale=0.5] [--out=out/code]
//        [--prefix=f] [--width=3840 --height=2160]   (lay the composition out at another size)
//        [--props='{"variant":"sheet"}']             (input props)
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
const id = args.id ?? 'CodeDemo';
const inputProps = args.props ? JSON.parse(args.props) : {};
const frames = (args.frames ?? '0').split(',').map(Number);
const scale = Number(args.scale ?? 0.5);
const outDir = path.resolve(args.out ?? 'out/code');
fs.mkdirSync(outDir, {recursive: true});

const t0 = performance.now();
// the webpack cache is shared with other renders on this machine; if a
// concurrent writer breaks it, bundle again without it
const entryPoint = path.resolve('src/index.ts');
const serveUrl = await bundle({entryPoint, onProgress: () => undefined}).catch((err) => {
  console.warn(`bundle failed (${err.message.split('\n')[0]}), retrying without the cache`);
  return bundle({entryPoint, onProgress: () => undefined, enableCaching: false});
});
const tBundle = performance.now();
const browser = await openBrowser('chrome', {chromiumOptions: {gl: 'angle'}});
const selected = await selectComposition({serveUrl, id, inputProps, puppeteerInstance: browser, chromiumOptions: {gl: 'angle'}});
const composition = {
  ...selected,
  width: args.width ? Number(args.width) : selected.width,
  height: args.height ? Number(args.height) : selected.height,
};
for (const frame of frames) {
  const t = performance.now();
  const output = path.join(outDir, `${args.prefix ?? 'f'}${String(frame).padStart(4, '0')}.png`);
  await renderStill({
    composition,
    serveUrl,
    frame,
    output,
    scale,
    inputProps,
    imageFormat: 'png',
    puppeteerInstance: browser,
    chromiumOptions: {gl: 'angle'},
    overwrite: true,
  });
  console.log(`${path.relative(process.cwd(), output)}  ${(performance.now() - t).toFixed(0)} ms`);
}
await browser.close({silent: true});
console.log(`bundle ${(tBundle - t0).toFixed(0)} ms, total ${(performance.now() - t0).toFixed(0)} ms`);
