// A small, deterministic QR code encoder (ISO/IEC 18004): byte mode, versions 1-10, any error
// correction level, all eight masks scored with the standard penalty rules. Pure JS, no
// dependencies. Used at build time for the end card's QR (scripts/ch14/build-data.mjs).

// ---------------------------------------------------------------- GF(256) and Reed-Solomon
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

const generator = (n) => {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
};

/** Reed-Solomon error-correction codewords for `data` (n of them). */
export const rsEncode = (data, n) => {
  const g = generator(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift();
    res.push(0);
    for (let j = 0; j < n; j++) res[j] ^= mul(g[j + 1], f);
  }
  return res;
};

// ---------------------------------------------------------------- tables (versions 1-10)
// [ec codewords per block, group1 blocks, group1 data cw, group2 blocks, group2 data cw]
const EC = {
  L: [[7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0], [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]],
  M: [[10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
  Q: [[13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16], [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20]],
  H: [[17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12], [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]],
};
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const EC_BITS = {L: 1, M: 0, Q: 3, H: 2};

const dataCapacity = (v, ecl) => {
  const [, b1, d1, b2, d2] = EC[ecl][v - 1];
  return b1 * d1 + b2 * d2;
};

// ---------------------------------------------------------------- BCH codes for format and version
const bchRem = (value, poly, polyDeg) => {
  let v = value << polyDeg;
  for (let i = 31 - Math.clz32(v); i >= polyDeg; i--) if (v & (1 << i)) v ^= poly << (i - polyDeg);
  return v;
};
/** The 15 format bits (EC level and mask), masked with 101010000010010. */
export const formatBits = (ecl, mask) => {
  const d = (EC_BITS[ecl] << 3) | mask;
  return ((d << 10) | bchRem(d, 0b10100110111, 10)) ^ 0b101010000010010;
};
export const versionBits = (v) => (v << 12) | bchRem(v, 0b1111100100101, 12);

// ---------------------------------------------------------------- data codewords
export const dataCodewords = (bytes, v, ecl) => {
  const cap = dataCapacity(v, ecl);
  const bits = [];
  const put = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let k = 0; out.length < cap; k++) out.push(k % 2 ? 0x11 : 0xec);
  return out;
};

const interleave = (data, v, ecl) => {
  const [ecn, b1, d1, b2, d2] = EC[ecl][v - 1];
  const blocks = [];
  let p = 0;
  for (let i = 0; i < b1 + b2; i++) {
    const n = i < b1 ? d1 : d2;
    const d = data.slice(p, p + n);
    p += n;
    blocks.push({d, e: rsEncode(d, ecn)});
  }
  const out = [];
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecn; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
};

// ---------------------------------------------------------------- the matrix
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const baseMatrix = (v) => {
  const n = 17 + 4 * v;
  const m = Array.from({length: n}, () => new Array(n).fill(0));
  const fn = Array.from({length: n}, () => new Array(n).fill(false));
  const set = (r, c, val) => {
    m[r][c] = val ? 1 : 0;
    fn[r][c] = true;
  };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const on = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(rr, cc, on);
      }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const al = ALIGN[v - 1];
  for (const r of al)
    for (const c of al) {
      if ((r < 9 && c < 9) || (r < 9 && c >= n - 8) || (r >= n - 8 && c < 9)) continue; // under a finder
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  set(n - 8, 8, true); // dark module
  // reserve format and version areas
  for (let i = 0; i < 9; i++) {
    if (!fn[8][i]) set(8, i, false);
    if (!fn[i][8]) set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!fn[8][n - 1 - i]) set(8, n - 1 - i, false);
    if (!fn[n - 1 - i][8]) set(n - 1 - i, 8, false);
  }
  if (v >= 7)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        set(i, n - 11 + j, false);
        set(n - 11 + j, i, false);
      }
  return {n, m, fn};
};

const placeData = (base, codewords) => {
  const {n, fn} = base;
  const m = base.m.map((row) => row.slice());
  const bits = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  let k = 0;
  let up = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const cc = c - d;
        if (fn[r][cc]) continue;
        m[r][cc] = k < bits.length ? bits[k] : 0;
        k++;
      }
    }
    up = !up;
  }
  return m;
};

const applyFormat = (m, n, ecl, mask, v) => {
  const f = formatBits(ecl, mask);
  const bit = (i) => (f >>> i) & 1;
  // around the top-left finder (bit 0 is the least significant; positions as in the standard)
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  // the split copy: top-right row and bottom-left column
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = bit(i);
  m[n - 8][8] = 1;
  if (v >= 7) {
    const vb = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const b = (vb >>> i) & 1;
      const r = Math.floor(i / 3);
      const c = n - 11 + (i % 3);
      m[r][c] = b;
      m[c][r] = b;
    }
  }
};

export const penalty = (m) => {
  const n = m.length;
  let p = 0;
  const lines = [];
  for (let r = 0; r < n; r++) lines.push(m[r]);
  for (let c = 0; c < n; c++) lines.push(m.map((row) => row[c]));
  for (const L of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && L[i] === L[i - 1]) run++;
      else {
        if (run >= 5) p += 3 + run - 5;
        run = 1;
      }
    }
    const s = L.join('');
    const pat = /(?=(10111010000|00001011101))/g;
    p += 40 * (s.match(pat) ?? []).length;
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
  let dark = 0;
  for (const row of m) for (const x of row) dark += x;
  p += 10 * Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5);
  return p;
};

/** Encode text (UTF-8 bytes) as a QR matrix: rows of 0/1, 1 = dark. */
export const encodeQR = (text, ecl = 'M') => {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  while (v <= 10 && dataCapacity(v, ecl) * 8 < 4 + (v < 10 ? 8 : 16) + bytes.length * 8) v++;
  if (v > 10) throw new Error(`qr: text too long for version 10-${ecl} (${bytes.length} bytes)`);
  const cw = interleave(dataCodewords(bytes, v, ecl), v, ecl);
  const base = baseMatrix(v);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = placeData(base, cw);
    for (let r = 0; r < base.n; r++) for (let c = 0; c < base.n; c++) if (!base.fn[r][c] && MASKS[mask](r, c)) m[r][c] ^= 1;
    applyFormat(m, base.n, ecl, mask, v);
    const score = penalty(m);
    if (!best || score < best.score) best = {m, mask, score};
  }
  return {version: v, ecl, mask: best.mask, size: base.n, modules: best.m};
};
