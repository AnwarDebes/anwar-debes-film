// Copies the exact file versions listed in manifest.json out of local clones of
// the repositories, so highlighting is reproducible without network access.
//
//   node scripts/code/fetch-sources.mjs --repos=<folder holding the clones>
//
// A clone is looked up as <repos>/<repository name>, e.g. <repos>/trace for
// AnwarDebes/trace. Only `git show` and `git rev-parse` are used: the clones
// are read, never changed.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
if (!args.repos) {
  console.error('usage: node scripts/code/fetch-sources.mjs --repos=<folder with clones>');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], {encoding: 'utf8', maxBuffer: 64 << 20});

export const sourcePath = (repo, ref, file) =>
  path.join(here, 'sources', `${repo.split('/').pop()}@${ref.slice(0, 7)}`, ...file.split('/'));

const jobs = [];
for (const s of manifest.snippets) jobs.push({repo: s.repo, ref: s.ref, path: s.path});
for (const d of manifest.diffs) {
  jobs.push({repo: d.repo, ref: d.from, path: d.path});
  jobs.push({repo: d.repo, ref: d.to, path: d.path});
}

const lock = {};
for (const j of jobs) {
  const clone = path.join(args.repos, j.repo.split('/').pop());
  const full = git(clone, 'rev-parse', `${j.ref}^{commit}`).trim();
  const text = git(clone, 'show', `${full}:${j.path}`);
  const out = sourcePath(j.repo, full, j.path);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, text);
  lock[`${j.repo}@${full}:${j.path}`] = {bytes: Buffer.byteLength(text), lines: text.split('\n').length};
  console.log(`copied ${j.repo}@${full.slice(0, 7)} ${j.path}`);
}
fs.writeFileSync(path.join(here, 'sources', 'lock.json'), JSON.stringify(lock, null, 2) + '\n');
