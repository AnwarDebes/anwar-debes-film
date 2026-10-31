// Renders the film in chapter parts, joins them without re-encoding, and muxes the mix.
//
//   node scripts/render-film.mjs [--chapters=01,02] [--scale=1] [--concurrency=2]
//        [--bitrate=40M] [--encoder=mf-hevc] [--name=anwar-debes-film] [--skip-existing]
//        [--join] [--web]
//
// Parts land in out/parts/chNN-<scale>.mp4; the joined master in out/<name>.mp4 (with the audio
// from public/audio/film/master.flac when present); --web also writes out/<name>-web.mp4.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
const tl = JSON.parse(fs.readFileSync('src/data/timeline.json', 'utf8'));
const scale = Number(args.scale ?? 1);
const concurrency = args.concurrency ?? '2';
const bitrate = args.bitrate ?? '40M';
const encoder = args.encoder ?? 'nvenc-hevc';
const name = args.name ?? 'anwar-debes-film';
const chapters = args.chapters ? args.chapters.split(',') : tl.chapters.map((c) => c.id);
const tag = scale === 1 ? 'full' : `s${scale}`;
const env = {...process.env, TEMP: path.resolve('.tmp'), TMP: path.resolve('.tmp')};
fs.mkdirSync('out/parts', {recursive: true});
fs.mkdirSync('.tmp', {recursive: true});

const serve = path.resolve('build/film');
if (!args['no-bundle']) {
  console.log('[film] bundling');
  execFileSync('npx', ['remotion', 'bundle', 'src/index.ts', `--out-dir=${serve}`], {stdio: 'inherit', env, shell: true});
}

const parts = [];
for (const id of chapters) {
  const ch = tl.chapters.find((c) => c.id === id);
  const a = Math.round(ch.start * tl.fps);
  const b = Math.round(ch.end * tl.fps) - 1;
  const out = path.resolve(`out/parts/ch${id}-${tag}.mp4`);
  parts.push(out);
  if (args['skip-existing'] && fs.existsSync(out)) {
    console.log(`[film] ch${id}: exists, skipped`);
    continue;
  }
  const t0 = Date.now();
  console.log(`[film] ch${id}: frames ${a}-${b} (${((b - a + 1) / tl.fps).toFixed(1)} s)`);
  execFileSync(
    'node',
    ['scripts/render-hw.mjs', ...(args.gl ? [`--gl=${args.gl}`] : []), `--serve=${serve}`, '--id=Film', `--frames=${a}-${b}`, `--scale=${scale}`, `--concurrency=${concurrency}`, `--bitrate=${bitrate}`, `--encoder=${encoder}`, `--out=${out}`],
    {stdio: 'inherit', env},
  );
  console.log(`[film] ch${id}: done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

if (args.join) {
  const list = path.resolve('out/parts/concat.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const video = path.resolve(`out/${name}-${tag}-video.mp4`);
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video], {stdio: 'inherit'});
  const master = path.resolve('public/audio/film/master.flac');
  const final = path.resolve(`out/${name}${scale === 1 ? '' : '-' + tag}.mp4`);
  if (fs.existsSync(master)) {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-i', master, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final], {stdio: 'inherit'});
    fs.rmSync(video);
  } else {
    fs.renameSync(video, final);
  }
  console.log(`[film] joined -> ${final}`);
  if (args.web) {
    const web = path.resolve(`out/${name}-web.mp4`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', final, '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', web], {stdio: 'inherit'});
    console.log(`[film] web -> ${web}`);
  }
}
