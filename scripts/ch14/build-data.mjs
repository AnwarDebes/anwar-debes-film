// Chapter 14's build-time data, from files already in the repository (no network):
//   src/data/ch14/facts.json        what 14.2 shows, read from the saved GitHub API snapshots
//   src/data/ch14/ledger/ledger.json a hash-chained ledger of chapter 14's own typed sources
//                                     (api-snapshot: SHA-256 of each saved response; commit: the
//                                     hashes they and the pins.js excerpt pin), with its head hash
//   src/data/ch14/text.json         every 14.x scene's on-screen lines (from the storyboard script)
//   src/data/ch14/qr.json           the end card's QR matrix (scripts/ch14/qr.mjs)
//
// The film-wide film-ledger.json (all chips, all chapters, rebuilt from fresh clones by
// verify-ledger.mjs) does not exist yet; until it does, 14.5 shows this chapter's ledger and says
// so. Run: node scripts/ch14/build-data.mjs [--qr-url=URL]
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {encodeQR} from './qr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = join(ROOT, 'src/data/ch14');
const API = join(D, 'ledger/api');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const read = (p) => readFileSync(p);
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

// ---------------------------------------------------------------- 14.2 facts
const med = json(join(API, 'ai-medical-training-simulator.raw.json'));
const assets = json(join(API, 'assets.raw.json'));
const commits = json(join(API, 'assets-commits.raw.json'));
const facts = {
  note: 'Read from the saved GitHub API responses in ledger/api (snapshot 2026-10-29) by scripts/ch14/build-data.mjs.',
  medical: {name: med.name, createdAt: med.created_at, size: med.size, empty: med.size === 0},
  assets: {
    name: assets.name,
    fork: assets.fork,
    parent: assets.parent?.full_name ?? null,
    // GitHub's own commit count of the fork is not in the API response; the storyboard's 15,299 is
    // the count on the GitHub page (research/dossiers/assets.json)
    ownCommits: commits.map((c) => ({sha: c.sha, short: c.sha.slice(0, 7), date: c.commit.author.date.slice(0, 10)})),
  },
};

// ---------------------------------------------------------------- the chapter's ledger
const sitePins = json(join(D, 'code/site-pins.json'));
const entries = [];
for (const f of ['ai-medical-training-simulator.raw.json', 'assets.raw.json', 'assets-commits.raw.json', 'rl.raw.json']) {
  entries.push({type: 'api-snapshot', id: `ledger/api/${f}`, hash: sha(read(join(API, f)))});
}
for (const c of facts.assets.ownCommits) entries.push({type: 'commit', id: `assets@${c.short}`, hash: c.sha});
entries.push({type: 'commit', id: `AnwarDebes.github.io@${sitePins.ref.slice(0, 7)}`, hash: sitePins.ref});
const transcript = [];
const say = (s) => {
  transcript.push(s);
  console.log(s);
};
let prev = sha('film-ledger v0');
say(`genesis ${prev.slice(0, 16)}`);
for (const e of entries) {
  e.prev = prev;
  e.link = sha(`${prev}\n${e.type} ${e.id} ${e.hash}`);
  prev = e.link;
  say(`${e.type.padEnd(12)} ${e.hash.slice(0, 8)}  ${e.id}`);
}
say(`${entries.length} entries · head ${prev}`);
const ledger = {
  note: "Chapter 14's own sources, hash-chained (link = SHA-256(prev + newline + 'type id hash')). Not the film-wide film-ledger.json, which is not built yet.",
  scope: 'chapter 14',
  genesis: sha('film-ledger v0'),
  entries,
  head: prev,
  transcript,
  cmd: 'node scripts/ch14/build-data.mjs',
};

// ---------------------------------------------------------------- the end card's QR
// The ledger page's URL is fixed at publish (storyboard 14.8); until then this provisional URL.
const url = arg('qr-url', 'https://github.com/AnwarDebes');
const q = encodeQR(url, 'M');
const qr = {note: 'Encoded by scripts/ch14/qr.mjs (byte mode, level M). Provisional URL until the ledger page is published.', url, provisional: true, version: q.version, ecl: q.ecl, mask: q.mask, size: q.size, rows: q.modules.map((r) => r.join(''))};

// ---------------------------------------------------------------- on-screen text, from the script
// Every 14.x scene's on-screen lines and the ledger's planned counts, copied from the storyboard's
// script (research/storyboard/script.json) so nothing is retyped (some names cannot be typed here).
const script = json(join(ROOT, 'research/storyboard/script.json'));
const ch14 = script.chapters.find((c) => c.id === '14');
const text = {
  note: 'Copied from research/storyboard/script.json by scripts/ch14/build-data.mjs.',
  ledgerEntries: script.ledgerEntries,
  ledgerEntryTypes: script.ledgerEntryTypes,
  scenes: Object.fromEntries(ch14.scenes.map((sc) => [sc.id, sc.onScreenText])),
};

const out = [
  [join(D, 'text.json'), text],
  [join(D, 'facts.json'), facts],
  [join(D, 'ledger/ledger.json'), ledger],
  [join(D, 'qr.json'), qr],
];
for (const [p, v] of out) {
  writeFileSync(p, `${JSON.stringify(v, null, 1)}\n`);
  console.log(`wrote ${relative(ROOT, p)} sha256 ${sha(read(p))}`);
}
