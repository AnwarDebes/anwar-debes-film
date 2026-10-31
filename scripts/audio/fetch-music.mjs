// Fetches the licensed music listed in audio/music-manifest.json into public/audio/music/
// and checks every file against the sha256 recorded in the manifest.
//
//   node scripts/audio/fetch-music.mjs                 fetch what is missing, verify everything
//   node scripts/audio/fetch-music.mjs --only=machina  one or more ids, comma separated
//   node scripts/audio/fetch-music.mjs --force         download again even when the file verifies
//   node scripts/audio/fetch-music.mjs --pages         also save each track page (license proof)
//   node scripts/audio/fetch-music.mjs --update        record sha256, bytes and dates in the manifest
//                                                      (only when adding or deliberately replacing a track)
//
// Plain HTTP GETs, one at a time. Exit code 1 if any file is missing or does not match.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifestPath = path.join(root, 'audio', 'music-manifest.json');
const musicDir = path.join(root, 'public', 'audio', 'music');
const pagesDir = path.join(musicDir, 'pages');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const only = typeof args.only === 'string' ? new Set(args.only.split(',').map((s) => s.trim())) : null;

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tracks = manifest.tracks.filter((t) => !only || only.has(t.id));
if (only && tracks.length !== only.size) {
  const known = new Set(manifest.tracks.map((t) => t.id));
  console.error(`unknown id(s): ${[...only].filter((id) => !known.has(id)).join(', ')}`);
  process.exit(1);
}

const sha256File = (file) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });

const download = async (url, dest) => {
  const res = await fetch(url, {redirect: 'follow'});
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status} ${res.statusText}`);
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  const h = crypto.createHash('sha256');
  let bytes = 0;
  const total = Number(res.headers.get('content-length') || 0);
  let lastPct = -1;
  for await (const chunk of res.body) {
    h.update(chunk);
    bytes += chunk.length;
    if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
    const pct = total ? Math.floor((bytes / total) * 100) : -1;
    if (pct !== lastPct && pct % 10 === 0) {
      process.stdout.write(`\r  ${path.basename(dest)} ${pct}%   `);
      lastPct = pct;
    }
  }
  await new Promise((r, j) => out.end((err) => (err ? j(err) : r())));
  process.stdout.write('\n');
  if (total && bytes !== total) {
    fs.rmSync(tmp, {force: true});
    throw new Error(`${url}: received ${bytes} of ${total} bytes`);
  }
  return {tmp, bytes, sha256: h.digest('hex')};
};

// The sentence on the track page that states the license, kept as evidence.
const licenseEvidence = (html) => {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  const license = text.match(/This work is licensed under an? Creative Commons [A-Za-z0-9 .]+?License/i);
  const credit = text.match(/Attribution format:\s*(.+?www\.scottbuckley\.com\.au)/i);
  if (!license && !credit) return null;
  return {license: license ? license[0].trim() : null, attributionFormat: credit ? credit[1].trim() : null};
};

let failures = 0;
const now = new Date().toISOString();
fs.mkdirSync(musicDir, {recursive: true});

for (const t of tracks) {
  const dest = path.join(musicDir, t.file);
  let status = '';
  try {
    let sha = fs.existsSync(dest) && !args.force ? await sha256File(dest) : null;
    if (sha && t.sha256 && sha === t.sha256) {
      status = 'ok (verified)';
    } else {
      if (sha && t.sha256 && sha !== t.sha256) console.log(`  ${t.file}: local file does not match the manifest, fetching again`);
      const got = await download(t.url, dest);
      if (t.sha256 && got.sha256 !== t.sha256 && !args.update) {
        fs.rmSync(got.tmp, {force: true});
        throw new Error(`sha256 mismatch: got ${got.sha256}, manifest has ${t.sha256} (the file changed upstream; check it, then rerun with --update)`);
      }
      if (t.bytes && got.bytes !== t.bytes && !args.update) {
        fs.rmSync(got.tmp, {force: true});
        throw new Error(`size mismatch: got ${got.bytes}, manifest has ${t.bytes}`);
      }
      fs.renameSync(got.tmp, dest);
      sha = got.sha256;
      status = `downloaded ${(got.bytes / 1e6).toFixed(1)} MB`;
      if (args.update) {
        t.sha256 = got.sha256;
        t.bytes = got.bytes;
        t.fetchedAt = now;
      }
    }
    if (!t.sha256 && args.update) {
      t.sha256 = sha;
      t.bytes = fs.statSync(dest).size;
      t.fetchedAt = t.fetchedAt ?? now;
    }
    if (!t.sha256) {
      failures++;
      status += ' (no sha256 in the manifest: run with --update once)';
    }
    if (args.pages && t.page) {
      fs.mkdirSync(pagesDir, {recursive: true});
      const res = await fetch(t.page, {redirect: 'follow'});
      if (!res.ok) throw new Error(`${t.page}: HTTP ${res.status}`);
      const html = await res.text();
      const pageFile = path.join(pagesDir, `${t.id}.html`);
      fs.writeFileSync(pageFile, html);
      if (args.update) {
        t.pageSha256 = crypto.createHash('sha256').update(html).digest('hex');
        t.pageFetchedAt = now;
        t.licenseEvidence = licenseEvidence(html);
      }
      status += ', page saved';
    }
    console.log(`${t.id.padEnd(20)} ${status}`);
  } catch (err) {
    failures++;
    console.error(`${t.id.padEnd(20)} FAILED: ${err.message}`);
  }
}

if (args.update) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest updated: ${path.relative(root, manifestPath)}`);
}
process.exit(failures ? 1 : 0);
