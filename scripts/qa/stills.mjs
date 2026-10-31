// Renders one still per scene (and optional extra frames) with a single browser, then tiles them
// into contact sheets for review.
//
//   node scripts/qa/stills.mjs [--chapters=01,02] [--scale=0.5] [--at=0.5] [--serve=build/film]
//
// Stills: out/qa/<chapter>/<scene>.jpg; sheets: out/qa/sheet-<chapter>.jpg (scene id under each tile).
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const tl = JSON.parse(fs.readFileSync('src/data/timeline.json', 'utf8'));
const scale = Number(args.scale ?? 0.5);
const at = Number(args.at ?? 0.5);
const chapters = args.chapters ? args.chapters.split(',') : tl.chapters.map((c) => c.id);
process.env.TEMP = path.resolve('.tmp');
process.env.TMP = path.resolve('.tmp');

const serveUrl = args.serve ? path.resolve(args.serve) : await bundle({entryPoint: path.resolve('src/index.ts')});
const gl = args.gl ?? process.env.FILM_GL ?? 'angle';
const browser = await openBrowser('chrome', {chromiumOptions: {gl}});
const composition = await selectComposition({serveUrl, id: 'Film', puppeteerInstance: browser, chromiumOptions: {gl}});

for (const id of chapters) {
  const dir = path.resolve(`out/qa/${id}`);
  fs.mkdirSync(dir, {recursive: true});
  const scenes = tl.scenes.filter((s) => s.chapter === id);
  const t0 = Date.now();
  for (const s of scenes) {
    const frame = Math.round((s.start + (s.end - s.start) * at) * tl.fps);
    await renderStill({composition, serveUrl, output: path.join(dir, `${s.id}.jpg`), frame, imageFormat: 'jpeg', jpegQuality: 88, scale, puppeteerInstance: browser, chromiumOptions: {gl}});
  }
  // contact sheet, 3 per row, scene ids burned in by a separate label image is avoided (no drawtext):
  // file names carry the ids; tiles keep film order.
  const files = scenes.map((s) => path.join(dir, `${s.id}.jpg`));
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const rows = Math.ceil(files.length / 3);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=640:-1,tile=3x${rows}:padding=6:color=0x202020`, '-frames:v', '1', path.resolve(`out/qa/sheet-${id}.jpg`)]);
  console.log(`[qa] ch${id}: ${scenes.length} stills in ${((Date.now() - t0) / 1000).toFixed(0)} s -> out/qa/sheet-${id}.jpg (order: ${scenes.map((s) => s.id).join(' ')})`);
}
await browser.close({silent: true});
