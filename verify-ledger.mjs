#!/usr/bin/env node
// Rebuilds the film's ledger from scratch and checks it against film-ledger.json.
// Every repository it cites is cloned fresh from GitHub, every file is read at its pinned
// commit, every capture and API snapshot is read from this repository, and the chain is
// recomputed: link = SHA-256(prev + newline + type + ' ' + id + ' ' + hash), from the
// genesis SHA-256('film-ledger v0'). The last line it prints is the head hash.
// A pinned commit that was re-published with the identical tree is read from its successor.
//   node verify-ledger.mjs [--dir=DIR] [--keep]     (Node 18 or later, and git)
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const run = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : 'true']; }));
const here = path.dirname(fileURLToPath(import.meta.url));
const ledger = JSON.parse(fs.readFileSync(path.join(here, 'film-ledger.json'), 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const dir = args.dir ? path.resolve(args.dir) : fs.mkdtempSync(path.join(os.tmpdir(), 'film-ledger-'));
const out = (s) => console.log(s);
const git = async (repo, a) => (await run('git', ['-C', path.join(dir, repo), ...a], {maxBuffer: 1 << 30, encoding: 'buffer'})).stdout;
const globRe = (g) => new RegExp('^' + g.split('*').map((x) => x.replace(/[.+?^$(){}|[\]\\]/g, (c) => '\\' + c)).join('[^/]*') + '$');

const genesis = sha('film-ledger v0');
out('film-ledger.json: ' + ledger.entries.length + ' entries, genesis ' + genesis.slice(0, 16));

// fresh clones: history and trees now, file contents fetched at each pinned commit as needed
const repos = [...new Set(ledger.entries.filter((e) => e.repo).map((e) => e.repo))].sort();
const commits = new Set(ledger.entries.filter((e) => e.repo).map((e) => e.repo + '@' + e.ref));
const pool = async (items, n, fn) => {
  const queue = [...items];
  await Promise.all(Array.from({length: n}, async () => { while (queue.length) await fn(queue.shift()); }));
};
await pool(repos, 8, async (repo) => {
  if (fs.existsSync(path.join(dir, repo))) return;
  await run('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', 'https://github.com/AnwarDebes/' + repo + '.git', path.join(dir, repo)]);
});
out('fresh clones: ' + repos.length + ' repositories, ' + commits.size + ' pinned commits');

// A pinned commit that was later re-published under a new id with the identical tree is read from
// its successor. The ledger keeps the original id, and the successor's tree is checked first.
const republished = {
  'video-editing-skill@cd5970d3c426d2c83517862cd67ab27138be4c15': {commit: '0970ec60b8f2392207a4beeb34faa686c5f09621', tree: '9cf3121eaade1a5666e92d33b08ab6e3eda6f561'},
};
const resolved = new Map();
const refOf = (e) => {
  const key = e.repo + '@' + e.ref;
  if (!resolved.has(key)) resolved.set(key, (async () => {
    try { await git(e.repo, ['cat-file', '-e', e.ref + '^{commit}']); return e.ref; } catch {}
    const r = republished[key];
    if (!r) return e.ref;
    const tree = (await git(e.repo, ['rev-parse', r.commit + '^{tree}'])).toString().trim();
    if (tree !== r.tree) return e.ref;
    out(e.repo + '@' + e.ref.slice(0, 7) + ': re-published as ' + r.commit.slice(0, 7) + ' with the identical tree ' + r.tree.slice(0, 7) + ', read from there');
    return r.commit;
  })());
  return resolved.get(key);
};

// recompute every entry's hash
const got = new Map();
await pool(ledger.entries, 8, async (e) => {
  let h = null;
  try {
    if (e.type === 'file@commit' && e.path.includes('*')) {
      const dirp = e.path.slice(0, e.path.indexOf('*')).replace(/[^/]*$/, '').replace(/\/$/, '');
      const re = globRe(e.path);
      const lines = (await git(e.repo, ['ls-tree', '-r', await refOf(e), '--', dirp || '.'])).toString().split('\n').filter((l) => l && re.test(l.split('\t')[1]));
      h = sha(Buffer.from(lines.join('\n') + '\n'));
    } else if (e.type === 'file@commit') {
      const ty = (await git(e.repo, ['cat-file', '-t', (await refOf(e)) + ':' + e.path])).toString().trim();
      h = sha(ty === 'tree' ? await git(e.repo, ['ls-tree', '-r', (await refOf(e)) + ':' + e.path]) : await git(e.repo, ['show', (await refOf(e)) + ':' + e.path]));
    } else if (e.type === 'commit') {
      h = (await git(e.repo, ['rev-parse', '--verify', e.ref + '^{commit}'])).toString().trim();
    } else {
      h = sha(fs.readFileSync(path.join(here, e.path)));
    }
  } catch {
    h = null;
  }
  got.set(e, h);
});

// rebuild the chain
const TYPES = ['file@commit', 'commit', 'capture', 'api-snapshot'];
const ok = {};
const all = {};
const bad = [];
let prev = genesis;
let links = 0;
for (const e of ledger.entries) {
  all[e.type] = (all[e.type] || 0) + 1;
  const h = got.get(e);
  if (h === e.hash) ok[e.type] = (ok[e.type] || 0) + 1;
  else bad.push(e.type + ' ' + e.id);
  const link = sha(prev + '\n' + e.type + ' ' + e.id + ' ' + (h === null ? 'missing' : h));
  if (link === e.link) links++;
  prev = link;
}
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
for (const t of TYPES) if (all[t]) out(pad(t, 13) + pad((ok[t] || 0) + '/' + all[t], 9) + ((ok[t] || 0) === all[t] ? 'match' : 'MISMATCH'));
out(pad('chain', 13) + pad(links + '/' + ledger.entries.length, 9) + 'links recomputed');
if (!args.keep && !args.dir) fs.rmSync(dir, {recursive: true, force: true});
if (bad.length || prev !== ledger.head) {
  for (const b of bad.slice(0, 20)) out('mismatch: ' + b);
  out('head ' + prev + ' (film-ledger.json says ' + ledger.head + ')');
  process.exit(1);
}
out('head ' + prev);
