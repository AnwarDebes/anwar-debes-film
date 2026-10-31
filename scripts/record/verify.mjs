#!/usr/bin/env node
// Checks a recording for smoothness and correct tagging.
//
//   node scripts/record/verify.mjs <video.mp4> [--sheet=out.png] [--every=30] [--width=320]
//
// Reports the stream tags (codec, size, fps, colour matrix / range), then decodes a small grey
// copy and measures the mean absolute difference (MAD) between consecutive frames:
//   - stalls: a frame identical to the previous one inside a run of motion (a dropped tick)
//   - spikes: a frame whose change is far above its neighbours' (a skipped tick or a jump)
// A page that is static for a while is not a stall; only zero-change frames between moving
// frames count. Optionally writes a contact sheet (every Nth frame) for a visual check.
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const probe = (file) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=codec_name,profile,level,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_space,color_range,color_transfer,color_primaries,bit_rate:format=duration,size',
    '-of', 'json', file], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(r.stderr);
  const j = JSON.parse(r.stdout);
  return {...j.streams[0], duration: Number(j.format.duration), size: Number(j.format.size)};
};

export function frameDiffs(file, width = 320) {
  const info = probe(file);
  const w = width;
  const h = Math.round((info.height / info.width) * w / 2) * 2;
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], {stdio: ['ignore', 'pipe', 'inherit']});
    const size = w * h;
    let buf = Buffer.alloc(0);
    let prev = null;
    const mads = [];
    ff.stdout.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= size) {
        const fr = buf.subarray(0, size);
        if (prev) {
          let s = 0;
          for (let i = 0; i < size; i++) s += Math.abs(fr[i] - prev[i]);
          mads.push(s / size);
        }
        prev = Buffer.from(fr);
        buf = buf.subarray(size);
      }
    });
    ff.on('close', (code) => (code === 0 ? resolve({info, mads, w, h}) : reject(new Error(`ffmpeg ${code}`))));
  });
}

export function analyse(mads) {
  const eps = 0.02; // grey levels: below this a frame did not change
  const moving = mads.map((m) => m > eps);
  // A stall is a frame that did not change while both neighbours clearly did. Sub-level changes
  // (the tail of an ease-out) are not motion; periodic page textures can also make a real shift
  // look small, so the frame log (scroll positions) is checked separately below.
  const stalls = [];
  for (let i = 1; i < mads.length - 1; i++) {
    const nb = Math.min(mads[i - 1], mads[i + 1]);
    if (nb > 0.1 && mads[i] < 0.12 * nb) stalls.push(i + 1);
  }
  const spikes = [];
  for (let i = 2; i < mads.length - 2; i++) {
    const nb = [mads[i - 2], mads[i - 1], mads[i + 1], mads[i + 2]].sort((a, b) => a - b);
    const med = (nb[1] + nb[2]) / 2;
    if (med > eps && mads[i] > med * 2.6 && mads[i] - med > 0.4) spikes.push(i + 1);
  }
  const movingFrames = moving.filter(Boolean).length;
  return {stalls, spikes, movingFrames, total: mads.length + 1};
}

const sparkline = (vals, width = 120) => {
  const bars = ' .:-=+*#%@';
  const n = Math.min(width, vals.length);
  const step = vals.length / n;
  const max = Math.max(...vals, 1e-6);
  let s = '';
  for (let i = 0; i < n; i++) {
    const seg = vals.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    const v = Math.max(...seg);
    s += bars[Math.min(bars.length - 1, Math.round((v / max) * (bars.length - 1)))];
  }
  return s;
};

export function contactSheet(file, out, every = 30, cols = 6) {
  const info = probe(file);
  const n = Math.ceil(Number(info.nb_read_frames) / every);
  const rows = Math.ceil(n / cols);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `select='not(mod(n\\,${every}))',scale=480:-2:flags=area,tile=${cols}x${rows}:padding=6:color=0x202020`, '-frames:v', '1', out], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(r.stderr);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  if (!file) {
    console.error('usage: node scripts/record/verify.mjs <video.mp4> [--sheet=out.png] [--every=30]');
    process.exit(2);
  }
  const {info, mads} = await frameDiffs(file, Number(flag('width') ?? 320));
  const a = analyse(mads);
  const [num, den] = info.r_frame_rate.split('/').map(Number);
  console.log(`${path.basename(file)}: ${info.codec_name} ${info.profile} L${info.level} ${info.width}x${info.height} ${info.pix_fmt} ${(num / den).toFixed(3)} fps, ${info.nb_read_frames} frames, ${info.duration.toFixed(3)} s, ${(info.size / 1e6).toFixed(1)} MB (${((info.size * 8) / info.duration / 1e6).toFixed(1)} Mbit/s)`);
  console.log(`  colour: matrix=${info.color_space} range=${info.color_range} transfer=${info.color_transfer} primaries=${info.color_primaries}`);
  console.log(`  motion: ${a.movingFrames}/${a.total - 1} frame steps change; stalls inside motion: ${a.stalls.length ? a.stalls.join(', ') : 'none'}; spikes: ${a.spikes.length ? a.spikes.join(', ') : 'none'}`);
  console.log(`  MAD per frame (max ${Math.max(...mads).toFixed(2)} grey levels):`);
  console.log(`  |${sparkline(mads)}|`);
  // the recorder's own log of what each frame showed (scroll position per frame)
  const metaFile = file.replace(/\.mp4$/, '.json');
  if (fs.existsSync(metaFile)) {
    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    const y = meta.frameLog?.scrollY;
    if (y) {
      const v = y.slice(1).map((q, i) => q - y[i]);
      const jerk = v.slice(1).map((q, i) => Math.abs(q - v[i]));
      const moving = v.filter((q) => Math.abs(q) > 0.01).length;
      const reversals = v.slice(1).filter((q, i) => q * v[i] < 0).length;
      const t = meta.frameLog.t;
      const dt = t.slice(1).map((q, i) => q - t[i]);
      console.log(`  frame log: frame interval ${Math.min(...dt).toFixed(3)}-${Math.max(...dt).toFixed(3)} ms; scroll moves on ${moving} frames, max step ${Math.max(0, ...v.map(Math.abs)).toFixed(1)} px, max change of step ${Math.max(0, ...jerk).toFixed(1)} px, reversals ${reversals}`);
    }
  }
  const sheet = flag('sheet');
  if (sheet) {
    contactSheet(file, sheet, Number(flag('every') ?? 30));
    console.log(`  contact sheet: ${sheet}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
