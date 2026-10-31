// Minimal PNG reader/writer for the checks (8-bit RGB / RGBA, all filter types).
import {readFileSync, writeFileSync} from 'node:fs';
import {deflateSync, inflateSync} from 'node:zlib';

export interface Image {
  w: number;
  h: number;
  /** RGBA, straight alpha. */
  data: Uint8Array;
}

export function readPng(path: string): Image {
  const buf = readFileSync(path);
  let off = 8;
  let w = 0;
  let h = 0;
  let depth = 0;
  let ctype = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      depth = body[8];
      ctype = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2) || interlace !== 0) {
    throw new Error(`${path}: unsupported PNG (depth ${depth}, colour type ${ctype}, interlace ${interlace})`);
  }
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0;
      let out: number;
      if (f === 0) out = v;
      else if (f === 1) out = v + a;
      else if (f === 2) out = v + b;
      else if (f === 3) out = v + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      px[dst + x] = out & 255;
    }
  }
  if (bpp === 4) return {w, h, data: px};
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = px[i * 3];
    data[i * 4 + 1] = px[i * 3 + 1];
    data[i * 4 + 2] = px[i * 3 + 2];
    data[i * 4 + 3] = 255;
  }
  return {w, h, data};
}

function crc32(buf: Uint8Array) {
  let x = 0xffffffff;
  for (const v of buf) {
    let c = (x ^ v) & 255;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    x = c ^ (x >>> 8);
  }
  return (x ^ 0xffffffff) >>> 0;
}

export function writePng(path: string, img: Image) {
  const {w, h, data} = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t, 'latin1'), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
  );
}

export function parseColour(c: string): [number, number, number, number] {
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const p = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/** Premultiplied source-over of device rects into a W x H straight-alpha RGBA image (golden.mjs's rule). */
export function rasterize(list: ReadonlyArray<readonly [number, number, number, number, string, ...unknown[]]>, W: number, H: number): Image {
  const f = new Float64Array(W * H * 4);
  for (const [x, y, w, h, c] of list) {
    const [r, g, b, a] = parseColour(c);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        const i = (yy * W + xx) * 4;
        f[i] = (r / 255) * a + f[i] * (1 - a);
        f[i + 1] = (g / 255) * a + f[i + 1] * (1 - a);
        f[i + 2] = (b / 255) * a + f[i + 2] * (1 - a);
        f[i + 3] = a + f[i + 3] * (1 - a);
      }
    }
  }
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = f[i * 4 + 3];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = a > 0 ? Math.round((f[i * 4 + c] / a) * 255) : 0;
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return {w: W, h: H, data: out};
}
