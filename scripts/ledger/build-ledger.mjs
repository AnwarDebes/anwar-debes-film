// Builds film-ledger.json: every source the film shows, in order of first appearance, typed,
// hashed and chained. link = SHA-256(prev + newline + type + ' ' + id + ' ' + hash), from the
// genesis SHA-256('film-ledger v0'): the scheme of chapter 14's own ledger.
//   file@commit   SHA-256 of the cited file at its pinned commit (a directory: its ls-tree -r
//                 listing; a wildcard path: the ls-tree lines of every matching file)
//   commit        the commit hash itself
//   capture       SHA-256 of a screen recording or terminal capture in this repository
//   api-snapshot  SHA-256 of a saved GitHub API response in this repository
// Pinned commit: the commit the film's own data records for that repository (the most recent one
// that has the cited file and lines), else the default branch as of --cutoff.
//   node scripts/ledger/build-ledger.mjs --clones=DIR [--cutoff=2026-10-30T00:00:00Z]
// DIR holds one bare clone per repository (<name>.git). Sources come from
// out/ledger/sources-*.jsonl (scripts/ledger/collect-sources.mjs). verify-ledger.mjs rebuilds the
// same ledger from fresh clones.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : 'true']; }));
const clones = path.resolve(args.clones || 'out/ledger/clones');
const cutoff = args.cutoff || '2026-10-30T00:00:00Z';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const GENESIS = sha('film-ledger v0');
const git = (repo, ...a) => execFileSync('git', ['-C', path.join(clones, repo + '.git'), ...a], {maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore']});
const tl = JSON.parse(fs.readFileSync('src/data/timeline.json', 'utf8'));
const chapterStart = (n) => tl.chapters.find((c) => Number(c.id || c.n) === n).start;

const names = fs.readdirSync(clones).filter((d) => d.endsWith('.git')).map((d) => d.slice(0, -4));
const byLower = new Map(names.map((r) => [r.toLowerCase(), r]));
const normRepo = (r) => byLower.get(String(r).replace(/^https?:\/\//, '').replace(/^github\.com\//i, '').replace(/^AnwarDebes\//i, '').replace(/\/$/, '').toLowerCase()) || null;

// ---------------------------------------------------------------- what the film showed
const shown = new Map();
for (const f of fs.readdirSync('out/ledger').filter((f) => /^sources-.*\.jsonl$/.test(f))) {
  for (const line of fs.readFileSync(path.join('out/ledger', f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const {t, ...rest} = JSON.parse(line);
    const key = JSON.stringify(rest);
    const prev = shown.get(key);
    if (!prev || t < prev.t) shown.set(key, {t, ...rest});
  }
}

// ---------------------------------------------------------------- pinned commits in the film's data
const pins = new Map();
const addPin = (r, s) => {
  const repo = normRepo(r);
  if (!repo || typeof s !== 'string' || !/^[0-9a-f]{40}$/.test(s)) return;
  if (!pins.has(repo)) pins.set(repo, new Set());
  pins.get(repo).add(s);
};
const walk = (v) => {
  if (Array.isArray(v)) return v.forEach(walk);
  if (!v || typeof v !== 'object') return;
  const r = v.repo ?? v.repository;
  const s = v.ref ?? v.commit ?? v.sha ?? v.pinned;
  if (typeof r === 'string') addPin(r, s);
  Object.values(v).forEach(walk);
};
const trackedAll = execFileSync('git', ['ls-files'], {encoding: 'utf8'}).split('\n').filter(Boolean);
for (const f of trackedAll.filter((f) => /^(src\/data|scripts\/code|public\/recordings|audio)\/.*\.json$/.test(f))) {
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  walk(j);
  if (f.endsWith('lock.json')) for (const k of Object.keys(j)) { const m = /^(?:AnwarDebes\/)?([^@]+)@([0-9a-f]{40}):/.exec(k); if (m) addPin(m[1], m[2]); }
}
const headAt = new Map();
const fallback = (repo) => {
  if (!headAt.has(repo)) headAt.set(repo, git(repo, 'rev-list', '-1', '--before=' + cutoff, 'HEAD').toString().trim());
  return headAt.get(repo);
};
const ctime = new Map();
const commitTime = (repo, s) => {
  const k = repo + '@' + s;
  if (!ctime.has(k)) { try { ctime.set(k, Number(git(repo, 'show', '-s', '--format=%ct', s).toString().trim())); } catch { ctime.set(k, -1); } }
  return ctime.get(k);
};
const objType = (repo, ref, p) => { try { return git(repo, 'cat-file', '-t', ref + ':' + p).toString().trim(); } catch { return null; } };
const lineNums = (line) => (line === undefined || line === null ? [] : String(line).match(/\d+/g) || []).map(Number);
const globRe = (g) => new RegExp('^' + g.split('*').map((x) => x.replace(/[.+?^$(){}|[\]\\]/g, (c) => '\\' + c)).join('[^/]*') + '$');
const globBody = (repo, ref, g) => {
  const dir = g.slice(0, g.indexOf('*')).replace(/[^/]*$/, '').replace(/\/$/, '');
  let listing;
  try { listing = git(repo, 'ls-tree', '-r', ref, '--', dir || '.').toString(); } catch { return null; }
  const re = globRe(g);
  const lines = listing.split('\n').filter((l) => l && re.test(l.split('\t')[1]));
  return lines.length ? Buffer.from(lines.join('\n') + '\n') : null;
};
const content = (repo, ref, p) => {
  if (p.includes('*')) return globBody(repo, ref, p);
  const ty = objType(repo, ref, p);
  if (ty === 'blob') return git(repo, 'show', ref + ':' + p);
  if (ty === 'tree') return git(repo, 'ls-tree', '-r', ref + ':' + p);
  return null;
};
const resolveFile = (repo, p, line) => {
  const cands = [...(pins.get(repo) || [])].filter((s) => commitTime(repo, s) > 0).sort((a, b) => commitTime(repo, b) - commitTime(repo, a));
  cands.push(fallback(repo));
  const need = Math.max(0, ...lineNums(line));
  for (const ref of [...new Set(cands)]) {
    const b = content(repo, ref, p);
    if (!b) continue;
    if (!p.includes('*') && need > b.toString('utf8').split('\n').length) continue;
    return {ref, hash: sha(b)};
  }
  return null;
};

// ---------------------------------------------------------------- entries
const entries = [];
const unresolved = [];
const ids = new Set();
const add = (e) => { if (ids.has(e.type + ' ' + e.id)) return; ids.add(e.type + ' ' + e.id); entries.push(e); };
const fileEntry = (t, repoRaw, pRaw, line, from) => {
  const repo = normRepo(repoRaw);
  const p = String(pRaw || '').replace(/^\/+/, '');
  if (!repo || !p) { unresolved.push({t, from, repo: repoRaw, path: pRaw, line, why: repo ? 'no path' : 'not a repository'}); return; }
  const r = resolveFile(repo, p, line);
  if (!r) { unresolved.push({t, from, repo, path: p, line, why: 'not at any pinned commit'}); return; }
  const lineStr = line === undefined || line === null || line === '' ? '' : ':' + line;
  add({t, type: 'file@commit', id: repo + '/' + p + lineStr + '@' + r.ref.slice(0, 7), hash: r.hash, repo, ref: r.ref, path: p, line: line ?? null});
};
const localEntry = (t, type, p) => {
  if (!fs.existsSync(p)) { unresolved.push({t, type, path: p, why: 'missing file'}); return; }
  add({t, type, id: p, hash: sha(fs.readFileSync(p)), path: p});
};
// a chip that names a capture: a tracked file with that name, or the recording of that page
const captureFor = (p) => {
  const exact = trackedAll.find((f) => f === p || f.endsWith('/' + p));
  if (exact) return exact;
  const token = p.split(' ')[0];
  for (const f of trackedAll.filter((f) => /^public\/recordings\/.*\.json$/.test(f))) {
    try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (typeof j.url === 'string' && j.url.includes(token)) return f; } catch {}
  }
  return null;
};
for (const s of shown.values()) {
  if (s.kind === 'chip' && s.repo === 'capture') {
    const f = captureFor(String(s.path));
    if (f) localEntry(s.t, 'capture', f);
    else unresolved.push({t: s.t, from: 'chip', path: s.path, why: 'no capture file'});
  } else if (s.kind === 'chip' && /^commit\s/.test(String(s.path))) {
    const repo = normRepo(s.repo);
    for (const tok of String(s.path).match(/\b[0-9a-f]{7,40}\b/g) || []) {
      let full = null;
      try { full = git(repo, 'rev-parse', '--verify', tok + '^{commit}').toString().trim(); } catch {}
      if (full) add({t: s.t, type: 'commit', id: repo + '@' + tok.slice(0, 7), hash: full, repo, ref: full});
      else unresolved.push({t: s.t, from: 'chip', repo, path: s.path, why: 'unknown commit ' + tok});
    }
  } else if (s.kind === 'chip') fileEntry(s.t, s.repo, s.path, s.line, 'chip');
  else if (s.kind === 'row') {
    const m = /^([^/]+)\/(.+?)(?::([\d,\s-]+))?$/.exec(s.source);
    if (m) fileEntry(s.t, m[1], m[2], m[3], 'row');
    else unresolved.push({t: s.t, from: 'row', source: s.source, why: 'unparsed'});
  } else if (s.kind === 'capture') {
    const i = s.src.indexOf('recordings/');
    localEntry(s.t, 'capture', 'public/' + s.src.slice(i).split('?')[0]);
  }
}
// terminal captures and API snapshots the chapters replay (placed at the start of their chapter)
const STATIC = [
  ['capture', 'src/data/ch02/npm-test-capture.json'],
  ['capture', 'src/data/ch03/trace-check.json'],
  ['capture', 'src/data/ch04/veritas-check.json'],
  ['capture', 'src/data/ch05/candor-check.json'],
  ['capture', 'src/data/ch06/captures/reins-quickstart.txt'],
  ['capture', 'src/data/ch07/npm-test.capture.txt'],
  ['capture', 'src/data/ch08/captures/lucid-pytest.txt'],
  ['api-snapshot', 'src/data/ch08/captures/rl-api-snapshot.json'],
  ['capture', 'src/data/ch09/rdkit-check.json'],
  ['capture', 'src/data/ch13/ballast-full.capture.txt'],
  ['capture', 'src/data/ch13/ballast-test-risk.capture.txt'],
];
for (const [type, p] of STATIC) localEntry(chapterStart(Number(/ch(\d\d)/.exec(p)[1])) + 0.5, type, p);
// chapter 14's own sources (14.2 shows them)
const t142 = (tl.scenes.find((s) => String(s.id) === '14.2') || {start: chapterStart(14)}).start;
const own = JSON.parse(fs.readFileSync('src/data/ch14/ledger/ledger.json', 'utf8'));
for (const e of own.entries) {
  if (e.type === 'api-snapshot') localEntry(t142, 'api-snapshot', 'src/data/ch14/' + e.id);
  else if (e.type === 'commit') {
    const repo = normRepo(e.id.split('@')[0]);
    add({t: t142, type: 'commit', id: e.id, hash: e.hash, repo, ref: e.hash});
  }
}

// ---------------------------------------------------------------- order and chain
const ORDER = {'file@commit': 0, commit: 1, capture: 2, 'api-snapshot': 3};
entries.sort((a, b) => a.t - b.t || ORDER[a.type] - ORDER[b.type] || (a.id < b.id ? -1 : 1));
let prev = GENESIS;
for (const e of entries) {
  e.prev = prev;
  e.link = sha(prev + '\n' + e.type + ' ' + e.id + ' ' + e.hash);
  prev = e.link;
  e.t = Math.round(e.t * 100) / 100;
}
const counts = {};
for (const e of entries) counts[e.type] = (counts[e.type] || 0) + 1;
const pinned = {};
for (const e of entries) if (e.repo) (pinned[e.repo] = pinned[e.repo] || new Set()).add(e.ref);
const ledger = {
  note: "Every source the film shows, in order of first appearance (t: seconds into the film), typed, hashed and chained: link = SHA-256(prev + newline + 'type id hash'), from genesis = SHA-256('film-ledger v0'). Hash-chained, not signed: anyone can recompute it with node verify-ledger.mjs.",
  scope: 'film',
  genesis: GENESIS,
  counts,
  pins: Object.fromEntries(Object.entries(pinned).sort().map(([r, s]) => [r, [...s]])),
  entries: entries.map(({t, type, id, hash, prev, link, repo, ref, path: p, line}) => ({t, type, id, hash, prev, link, ...(repo ? {repo} : {}), ...(ref ? {ref} : {}), ...(p ? {path: p} : {}), ...(line !== undefined && line !== null ? {line} : {})})),
  head: prev,
};
fs.writeFileSync('film-ledger.json', JSON.stringify(ledger, null, 1) + '\n');
fs.writeFileSync('out/ledger/unresolved.json', JSON.stringify(unresolved, null, 1) + '\n');
console.log('film-ledger.json: ' + entries.length + ' entries ' + JSON.stringify(counts) + ', ' + Object.keys(pinned).length + ' repositories, head ' + prev);
console.log('unresolved: ' + unresolved.length + ' (out/ledger/unresolved.json)');
