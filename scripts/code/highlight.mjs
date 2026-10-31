// Turns the snippet sources listed in manifest.json into token JSON for the
// film's code panels (src/data/code/*.json) plus a typed index (index.ts).
//
//   node scripts/code/highlight.mjs           write the JSON
//   node scripts/code/highlight.mjs --check   fail if the JSON is out of date
//
// Tokens carry a semantic class, not a colour: the palette lives in
// src/engine/code/theme.ts, so the look can change without re-running this.
// Classes come from the TextMate scopes shiki reports for each grammar token
// (innermost scope first), which is more predictable than theme matching.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHighlighter} from 'shiki';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const outDir = path.join(root, 'src', 'data', 'code');
const check = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));
const tabSize = manifest.tabSize ?? 4;

const sourcePath = (repo, ref, file) =>
  path.join(here, 'sources', `${repo.split('/').pop()}@${ref.slice(0, 7)}`, ...file.split('/'));

// ---------------------------------------------------------------------------
// Never show secrets: refuse to build if a source looks like it carries one.
// ---------------------------------------------------------------------------
const SECRET_PATTERNS = [
  [/\b(?:sk|rk|pk)-(?:live-|test-|proj-|ant-)?[A-Za-z0-9_-]{20,}/, 'API key (sk-/rk-/pk- style)'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, 'GitHub fine-grained token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JSON web token'],
  [/\bhf_[A-Za-z0-9]{30,}/, 'Hugging Face token'],
  [
    /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|passw(?:or)?d|private[_-]?key)\b\s*[:=]\s*[bru]?["'][^"'\s]{12,}["']/i,
    'hard-coded credential assignment',
  ],
];

const scanSecrets = (label, text) => {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of SECRET_PATTERNS) if (re.test(line)) hits.push(`${label}:${i + 1}: ${what}`);
  });
  return hits;
};

// ---------------------------------------------------------------------------
// Scope -> class. Checked for the innermost scope first; the first scope that
// matches any rule decides. Rule order matters within one scope.
// ---------------------------------------------------------------------------
const UPPER = /^[A-Z][A-Z0-9_]*$/;
const RULES = [
  [/^comment|^punctuation\.definition\.comment|^string\.quoted\.docstring/, 'com'],
  [/^constant\.character\.(?:escape|format)|^constant\.other\.placeholder/, 'esc'],
  [/^punctuation\.definition\.template-expression|^punctuation\.section\.embedded/, 'punc'],
  [/^storage\.type\.string\.python/, 'str'],
  [/^string|^punctuation\.definition\.string/, 'str'],
  [/^constant\.numeric/, 'num'],
  [/^constant\.language/, 'num'],
  [/^support\.constant/, 'const'],
  [/^variable\.language|special\.self|special\.cls/, 'self'],
  [/^entity\.name\.function\.decorator|^punctuation\.definition\.decorator|^meta\.function\.decorator/, 'dec'],
  [/^entity\.name\.function|^support\.function|^meta\.function-call\.generic/, 'fn'],
  [/^entity\.name\.(?:type|class)|^support\.(?:type(?!\.property-name)|class)|^entity\.other\.inherited-class/, 'type'],
  [/^storage\.type\.function\.arrow/, 'op'],
  [/^keyword\.operator\.(?:new|expression|typeof|instanceof|delete|void|logical\.python|in\b|of\b)/, 'kw'],
  [/^keyword\.operator/, 'op'],
  [/^keyword|^storage/, 'kw'],
  [
    /^meta\.object-literal\.key|^support\.type\.property-name|^variable\.other\.(?:property|object\.property)|^support\.variable\.property|^meta\.attribute|^entity\.other\.attribute-name|^variable\.other\.member/,
    'prop',
  ],
  [/^entity\.name\.tag/, 'kw'],
  [/^variable\.parameter/, 'param'],
  [/^variable\.other\.constant/, 'const?'],
  [/^variable/, 'var'],
  [/^punctuation|^meta\.brace/, 'punc'],
];

const classify = (scopes, text) => {
  for (let s = scopes.length - 1; s >= 1; s--) {
    const name = scopes[s];
    for (const [re, cls] of RULES) {
      if (!re.test(name)) continue;
      if (cls === 'const?') return UPPER.test(text.trim()) ? 'const' : 'var';
      return cls;
    }
  }
  return '';
};

const expandTabs = (line) => {
  if (!line.includes('\t')) return line;
  let out = '';
  for (const ch of line) {
    if (ch === '\t') out += ' '.repeat(tabSize - (out.length % tabSize));
    else out += ch;
  }
  return out;
};

const normalise = (text) => text.replace(/\r\n?/g, '\n').split('\n').map(expandTabs).join('\n');

// Highlight a whole file (so grammar state is right on every line) and return
// lines of [text, class] pairs, whitespace kept, trailing spaces dropped.
const tokenizeFile = (hl, code, lang) => {
  const res = hl.codeToTokens(code, {lang, theme: 'film-code', includeExplanation: 'scopeName'});
  return res.tokens.map((line) => {
    const pieces = [];
    for (const tok of line) {
      const parts = tok.explanation?.length ? tok.explanation : [{content: tok.content, scopes: []}];
      for (const ex of parts) {
        const scopes = ex.scopes.map((s) => s.scopeName);
        const text = ex.content;
        const cls = text.trim() === '' && !/^(?:string|comment)/.test(scopes.at(-1) ?? '') ? '' : classify(scopes, text);
        pieces.push([text, cls]);
      }
    }
    // merge neighbours of the same class
    const merged = [];
    for (const [text, cls] of pieces) {
      const last = merged.at(-1);
      if (last && last[1] === cls) last[0] += text;
      else merged.push([text, cls]);
    }
    // drop trailing whitespace
    while (merged.length) {
      const last = merged.at(-1);
      const trimmed = last[0].replace(/\s+$/, '');
      if (trimmed === '') merged.pop();
      else {
        last[0] = trimmed;
        break;
      }
    }
    return merged;
  });
};

// ---------------------------------------------------------------------------
// Line diff (LCS), grouped into hunks with `context` lines around changes.
// ---------------------------------------------------------------------------
const lineDiff = (a, b) => {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({k: ' ', a: i, b: j}), i++, j++;
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({k: '-', a: i}), i++;
    else ops.push({k: '+', b: j}), j++;
  }
  while (i < n) ops.push({k: '-', a: i++});
  while (j < m) ops.push({k: '+', b: j++});
  return ops;
};

const hunksOf = (ops, context) => {
  const changed = ops.map((o) => o.k !== ' ');
  const keep = ops.map((_, idx) => {
    for (let d = -context; d <= context; d++) if (changed[idx + d]) return true;
    return false;
  });
  const hunks = [];
  let cur = null;
  ops.forEach((o, idx) => {
    if (!keep[idx]) {
      cur = null;
      return;
    }
    if (!cur) hunks.push((cur = []));
    cur.push(o);
  });
  return hunks;
};

// ---------------------------------------------------------------------------
const filmTheme = {
  name: 'film-code',
  type: 'dark',
  colors: {'editor.background': '#060C11', 'editor.foreground': '#D3D8D6'},
  tokenColors: [],
};

const langs = [...new Set([...manifest.snippets, ...manifest.diffs].map((s) => s.lang))];
const hl = await createHighlighter({themes: [filmTheme], langs});

const outputs = new Map();
const problems = [];

const readSource = (repo, ref, file) => {
  const p = sourcePath(repo, ref, file);
  if (!fs.existsSync(p)) throw new Error(`missing source ${path.relative(root, p)}: run fetch-sources.mjs`);
  return normalise(fs.readFileSync(p, 'utf8')).replace(/\n$/, '');
};

for (const s of manifest.snippets) {
  const code = readSource(s.repo, s.ref, s.path);
  problems.push(...scanSecrets(`${s.repo}@${s.ref.slice(0, 7)}/${s.path}`, code));
  const lines = tokenizeFile(hl, code, s.lang);
  outputs.set(s.id, {
    kind: 'snippet',
    id: s.id,
    repo: s.repo,
    ref: s.ref,
    path: s.path,
    lang: s.lang,
    startLine: 1,
    lines,
  });
}

for (const d of manifest.diffs) {
  const before = readSource(d.repo, d.from, d.path);
  const after = readSource(d.repo, d.to, d.path);
  problems.push(...scanSecrets(`${d.repo}@${d.from.slice(0, 7)}/${d.path}`, before));
  problems.push(...scanSecrets(`${d.repo}@${d.to.slice(0, 7)}/${d.path}`, after));
  const ta = tokenizeFile(hl, before, d.lang);
  const tb = tokenizeFile(hl, after, d.lang);
  const ops = lineDiff(before.split('\n'), after.split('\n'));
  const hunks = hunksOf(ops, d.context ?? 3).map((h) => ({
    rows: h.map((o) =>
      o.k === ' '
        ? {k: ' ', a: o.a + 1, b: o.b + 1, t: tb[o.b]}
        : o.k === '-'
          ? {k: '-', a: o.a + 1, t: ta[o.a]}
          : {k: '+', b: o.b + 1, t: tb[o.b]},
    ),
  }));
  outputs.set(d.id, {
    kind: 'diff',
    id: d.id,
    repo: d.repo,
    path: d.path,
    lang: d.lang,
    from: d.from,
    to: d.to,
    message: d.message ?? '',
    hunks,
  });
}

if (problems.length) {
  console.error('Refusing to build: possible secrets in sources\n  ' + problems.join('\n  '));
  process.exit(2);
}

// Compact JSON: one line per code line keeps diffs of the data readable.
const toJson = (o) => {
  const {lines, hunks, ...meta} = o;
  const head = JSON.stringify(meta).slice(0, -1);
  if (lines) return `${head},"lines":[\n${lines.map((l) => JSON.stringify(l)).join(',\n')}\n]}\n`;
  const hs = hunks.map((h) => `{"rows":[\n${h.rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}`);
  return `${head},"hunks":[\n${hs.join(',\n')}\n]}\n`;
};

const camel = (id) => id.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
const index = [
  '// Generated by scripts/code/highlight.mjs. Do not edit by hand.',
  "import type {CodeDiff, CodeSnippet} from '../../engine/code/types';",
  ...[...outputs.values()].map((o) => `import ${camel(o.id)} from './${o.id}.json';`),
  '',
  'export const snippets = {',
  ...[...outputs.values()]
    .filter((o) => o.kind === 'snippet')
    .map((o) => `  '${o.id}': ${camel(o.id)} as unknown as CodeSnippet,`),
  '} as const;',
  '',
  'export const diffs = {',
  ...[...outputs.values()].filter((o) => o.kind === 'diff').map((o) => `  '${o.id}': ${camel(o.id)} as unknown as CodeDiff,`),
  '} as const;',
  '',
  'export type SnippetId = keyof typeof snippets;',
  'export type DiffId = keyof typeof diffs;',
  '',
].join('\n');

const files = new Map([...[...outputs.values()].map((o) => [`${o.id}.json`, toJson(o)]), ['index.ts', index]]);

if (check) {
  const stale = [...files].filter(([f, text]) => {
    const p = path.join(outDir, f);
    return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text;
  });
  if (stale.length) {
    console.error('out of date: ' + stale.map(([f]) => f).join(', '));
    process.exit(1);
  }
  console.log('code data up to date');
} else {
  fs.mkdirSync(outDir, {recursive: true});
  for (const [f, text] of files) fs.writeFileSync(path.join(outDir, f), text);
  for (const o of outputs.values()) {
    const n = o.lines ? o.lines.length : o.hunks.reduce((s, h) => s + h.rows.length, 0);
    console.log(`${o.id}.json  ${o.kind}  ${n} ${o.lines ? 'lines' : 'diff rows'}`);
  }
}
