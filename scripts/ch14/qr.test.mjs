// Tests for the QR encoder: run with `node scripts/ch14/qr.test.mjs` (exit code 0 = pass).
// Known vectors from the standard's worked example (HELLO WORLD, 1-M, alphanumeric data codewords
// with their published EC codewords), the published format and version bit strings, and a
// read-back of every encoded matrix: unmask, walk the zigzag, check every Reed-Solomon block's
// syndromes are zero and decode the bytes back to the text.
import assert from 'node:assert/strict';
import {rsEncode, formatBits, versionBits, encodeQR} from './qr.mjs';

let pass = 0;
const ok = (name, fn) => {
  fn();
  pass++;
  console.log(`ok - ${name}`);
};

ok('RS: HELLO WORLD 1-M ec codewords', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(rsEncode(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});
ok('format bits: M mask 0 and L mask 0', () => {
  assert.equal(formatBits('M', 0).toString(2).padStart(15, '0'), '101010000010010');
  assert.equal(formatBits('L', 0).toString(2).padStart(15, '0'), '111011111000100');
  assert.equal(formatBits('H', 7).toString(2).padStart(15, '0'), '000100000111011');
});
ok('version bits: v7', () => {
  assert.equal(versionBits(7).toString(2).padStart(18, '0'), '000111110010010100');
});

// ---------------------------------------------------------------- independent read-back
const EXP = [];
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP.push(x);
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
}
const gmul = (a, b) => (a && b ? EXP[(EXP.indexOf(a) + EXP.indexOf(b)) % 255] : 0);
const syndromesZero = (cw, nEc) => {
  for (let i = 0; i < nEc; i++) {
    let s = 0;
    for (const c of cw) s = gmul(s, EXP[i]) ^ c;
    if (s !== 0) return false;
  }
  return true;
};
const EC_M = [[10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]];
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const isFunction = (v, n, r, c) => {
  if ((r < 9 && c < 9) || (r < 9 && c >= n - 8) || (r >= n - 8 && c < 9)) return true;
  if (r === 6 || c === 6) return true;
  if (v >= 7 && ((r < 6 && c >= n - 11) || (c < 6 && r >= n - 11))) return true;
  const al = ALIGN[v - 1];
  for (const ar of al) for (const ac of al) {
    if ((ar < 9 && ac < 9) || (ar < 9 && ac >= n - 8) || (ar >= n - 8 && ac < 9)) continue;
    if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return true;
  }
  return false;
};
const readBack = (q) => {
  const {modules: m, size: n, version: v} = q;
  // format from the top-left copy (standard positions), checked against both copies
  const bitsA = [];
  for (let i = 0; i <= 5; i++) bitsA[i] = m[i][8];
  bitsA[6] = m[7][8];
  bitsA[7] = m[8][8];
  bitsA[8] = m[8][7];
  for (let i = 9; i < 15; i++) bitsA[i] = m[8][14 - i];
  const fA = bitsA.reduce((a, b, i) => a | (b << i), 0);
  const bitsB = [];
  for (let i = 0; i < 8; i++) bitsB[i] = m[8][n - 1 - i];
  for (let i = 8; i < 15; i++) bitsB[i] = m[n - 15 + i][8];
  const fB = bitsB.reduce((a, b, i) => a | (b << i), 0);
  assert.equal(fA, fB, 'format copies differ');
  let mask = -1;
  for (let k = 0; k < 8; k++) if (formatBits('M', k) === fA) mask = k;
  assert.ok(mask >= 0, 'format bits do not decode to level M');
  assert.equal(m[n - 8][8], 1, 'dark module');
  const MASKS = [(r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0, (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0];
  const bits = [];
  let up = true;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let i = 0; i < n; i++) {
      const r = up ? n - 1 - i : i;
      for (let d = 0; d < 2; d++) {
        const cc = c - d;
        if (isFunction(v, n, r, cc)) continue;
        bits.push(m[r][cc] ^ (MASKS[mask](r, cc) ? 1 : 0));
      }
    }
    up = !up;
  }
  const cws = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) cws.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  const [ecn, b1, d1, b2, d2] = EC_M[v - 1];
  const nb = b1 + b2;
  const blocks = Array.from({length: nb}, (_, i) => ({d: [], e: [], n: i < b1 ? d1 : d2}));
  let p = 0;
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.n) b.d.push(cws[p++]);
  for (let i = 0; i < ecn; i++) for (const b of blocks) b.e.push(cws[p++]);
  for (const b of blocks) assert.ok(syndromesZero([...b.d, ...b.e], ecn), 'RS syndromes not zero');
  const data = blocks.flatMap((b) => b.d);
  const dbits = data.flatMap((x) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (x >> i) & 1));
  const take = (k, len) => dbits.slice(k, k + len).reduce((a, b) => (a << 1) | b, 0);
  assert.equal(take(0, 4), 0b0100, 'byte mode');
  const cl = v < 10 ? 8 : 16;
  const len = take(4, cl);
  const out = [];
  for (let i = 0; i < len; i++) out.push(take(4 + cl + 8 * i, 8));
  return new TextDecoder().decode(new Uint8Array(out));
};

for (const text of ['A', 'HELLO WORLD', 'https://github.com/AnwarDebes', 'https://anwardebes.github.io/film-ledger.json', 'x'.repeat(150)]) {
  ok(`round trip: ${text.length} bytes`, () => {
    const q = encodeQR(text, 'M');
    assert.equal(q.size, 17 + 4 * q.version);
    assert.equal(readBack(q), text);
    // finder pattern corners
    for (const [r0, c0] of [[0, 0], [0, q.size - 7], [q.size - 7, 0]]) {
      assert.equal(q.modules[r0][c0], 1);
      assert.equal(q.modules[r0 + 1][c0 + 1], 0);
      assert.equal(q.modules[r0 + 3][c0 + 3], 1);
    }
  });
}
ok('deterministic', () => {
  assert.deepEqual(encodeQR('https://github.com/AnwarDebes'), encodeQR('https://github.com/AnwarDebes'));
});
console.log(`${pass} passed`);
