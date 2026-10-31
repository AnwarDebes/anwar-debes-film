// Renders a composition (or a frame range of it) with Remotion on the GPU and
// encodes it on the Intel media engine through the system ffmpeg.
//
//   node scripts/render-hw.mjs --id=Film --out=out/part-01.mp4 [--frames=0-1799]
//        [--scale=0.5] [--concurrency=4] [--bitrate=60M]
//        [--encoder=nvenc-hevc|nvenc-h264|mf-hevc|mf-h264|qsv-h264|x264] [--jpeg=92] [--gl=angle]
//
// nvenc-* use the NVIDIA encoder (the Linux GPU server); mf-* use Media Foundation (Windows);
// x264 is the software fallback.
//
// Video only: audio is mixed separately and muxed at the end, so parts join
// cleanly with the concat demuxer.
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);

const id = args.id ?? 'Film';
const out = path.resolve(args.out ?? `out/${id}.mp4`);
const concurrency = Number(args.concurrency ?? 4);
const scale = Number(args.scale ?? 1);
const bitrate = args.bitrate ?? '60M';
const encoderName = args.encoder ?? 'nvenc-hevc';
const gl = args.gl ?? process.env.FILM_GL ?? 'angle';
const jpegQuality = Number(args.jpeg ?? 92);
const ffmpegBin = args.ffmpeg ?? 'ffmpeg';
const inputProps = args.props ? JSON.parse(fs.readFileSync(args.props, 'utf8')) : {};
const serveUrlArg = args.serve;

const t0 = Date.now();
const serveUrl =
  serveUrlArg ??
  (await bundle({
    entryPoint: path.resolve('src/index.ts'),
    onProgress: () => undefined,
  }));
const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions: {gl}});

let [start, end] = [0, composition.durationInFrames - 1];
if (args.frames) {
  const [a, b] = args.frames.split('-').map(Number);
  start = a;
  end = Number.isFinite(b) ? b : composition.durationInFrames - 1;
}
const total = end - start + 1;
const outW = Math.round((composition.width * scale) / 2) * 2;
const outH = Math.round((composition.height * scale) / 2) * 2;

fs.mkdirSync(path.dirname(out), {recursive: true});

const maxrate = `${Math.round(parseFloat(bitrate) * 1.5)}M`;
const bufsize = `${Math.round(parseFloat(bitrate) * 2)}M`;
const rate = ['-b:v', bitrate, '-maxrate', maxrate, '-bufsize', bufsize];
// BT.709 tags in the bitstream itself, so players never guess the matrix.
const tag709 = (codec) => ['-bsf:v', `${codec}_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1`];
const encoders = {
  'nvenc-hevc': ['-c:v', 'hevc_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', ...rate, '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', ...tag709('hevc')],
  'nvenc-h264': ['-c:v', 'h264_nvenc', '-preset', 'p6', '-tune', 'hq', '-rc', 'vbr', ...rate, '-pix_fmt', 'yuv420p', '-profile:v', 'high', ...tag709('h264')],
  'mf-hevc': ['-c:v', 'hevc_mf', '-hw_encoding', '1', '-rate_control', 'cbr', ...rate, '-pix_fmt', 'nv12', '-tag:v', 'hvc1', ...tag709('hevc')],
  'mf-h264': ['-c:v', 'h264_mf', '-hw_encoding', '1', '-rate_control', 'cbr', ...rate, '-pix_fmt', 'nv12', ...tag709('h264')],
  'qsv-h264': ['-c:v', 'h264_qsv', '-preset', 'medium', ...rate, '-pix_fmt', 'nv12', ...tag709('h264')],
  x264: ['-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', ...tag709('h264')],
};
const encoder = encoders[encoderName];
if (!encoder) throw new Error(`unknown encoder ${encoderName}`);

const ff = spawn(
  ffmpegBin,
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(composition.fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=full:out_range=tv',
    ...encoder,
    '-g', String(composition.fps * 2),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart',
    out,
  ],
  {stdio: ['pipe', 'inherit', 'inherit']},
);
ff.on('error', (e) => {
  console.error('ffmpeg failed to start', e);
  process.exit(1);
});

// Frames can finish out of order with concurrency > 1; write them in order.
const pending = new Map();
let next = start;
let written = 0;
const flush = () => {
  while (pending.has(next)) {
    ff.stdin.write(pending.get(next));
    pending.delete(next);
    next++;
    written++;
  }
};

let lastLog = 0;
await renderFrames({
  composition,
  serveUrl,
  inputProps,
  outputDir: null,
  imageFormat: 'jpeg',
  jpegQuality,
  scale,
  concurrency,
  frameRange: [start, end],
  chromiumOptions: {gl},
  onStart: () => undefined,
  onFrameUpdate: (rendered) => {
    const now = Date.now();
    if (now - lastLog > 5000 || rendered === total) {
      lastLog = now;
      const secs = (now - t0) / 1000;
      process.stdout.write(`[render-hw] ${rendered}/${total} frames, ${(rendered / secs).toFixed(2)} fps\n`);
    }
  },
  onFrameBuffer: (buffer, frame) => {
    pending.set(frame, buffer);
    flush();
  },
});

flush();
ff.stdin.end();
await new Promise((resolve, reject) => ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))));
const secs = (Date.now() - t0) / 1000;
console.log(`[render-hw] done: ${written} frames ${outW}x${outH} in ${secs.toFixed(1)} s = ${(written / secs).toFixed(2)} fps -> ${out}`);
