// Code excerpts for chapters 03-05 (TRACE, VERITAS, CANDOR), as token JSON for the film's code
// panels. Same token classes and format as scripts/code/highlight.mjs, but each file keeps only the
// excerpt's lines (startLine is the real file line of lines[0]) and lands in src/data/chNN/code/.
//
//   node src/data/ch03/code/highlight-chapters.mjs --repos=<folder holding the clones>
//
// Sources are read from the clones with `git show <commit>:<path>` only (nothing is changed), the
// whole file is highlighted so the grammar state is right on every line, then sliced.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHighlighter} from 'shiki';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(here, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : 'true'];
}));
if (!args.repos) {
  console.error('usage: node highlight-chapters.mjs --repos=<folder with clones>');
  process.exit(1);
}

const TRACE = 'cc3a1a432ab010f58758f55caeec51d853086573';
const VERITAS = '95527346c073d020010558d2831f1b60bf1b5580';
const CANDOR = '6772e1aa6b310dc6d24638f3438705522ddbaa61';

// [chapter, id, repo, commit, path, lang, from, to]
const EXCERPTS = [
  ['ch03', 'trace-automata', 'trace', TRACE, 'tracekit/automata.py', 'python', 79, 98],
  ['ch03', 'trace-ltl-count', 'trace', TRACE, 'tracekit/ltl.py', 'python', 166, 187],
  ['ch04', 'veritas-verify', 'veritas', VERITAS, 'veritaskit/verify.py', 'python', 105, 140],
  ['ch04', 'veritas-repair', 'veritas', VERITAS, 'live/repair.js', 'javascript', 20, 48],
  ['ch04', 'veritas-rup', 'veritas', VERITAS, 'live/rup.js', 'javascript', 45, 72],
  ['ch05', 'candor-bottleneck', 'candor', CANDOR, 'candorkit/bottleneck.py', 'python', 86, 110],
  ['ch05', 'candor-test', 'candor', CANDOR, 'tests/test_candor.py', 'python', 14, 25],
  ['ch05', 'candor-certificate', 'candor', CANDOR, 'candorkit/certificate.py', 'python', 40, 68],
];

const SECRET_PATTERNS = [
  /\b(?:sk|rk|pk)-(?:live-|test-|proj-|ant-)?[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|passw(?:or)?d|private[_-]?key)\b\s*[:=]\s*[bru]?["'][^"'\s]{12,}["']/i,
];

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
  [/^meta\.object-literal\.key|^support\.type\.property-name|^variable\.other\.(?:property|object\.property)|^support\.variable\.property|^meta\.attribute|^entity\.other\.attribute-name|^variable\.other\.member/, 'prop'],
  [/^entity\.name\.tag/, 'kw'],
  [/^variable\.parameter/, 'param'],
  [/^variable\.other\.constant/, 'const?'],
  [/^variable/, 'var'],
  [/^punctuation|^meta\.brace/, 'punc'],
];

const classify = (scopes, text) => {
  for (let s = scopes.length - 1; s >= 1; s--) {
    for (const [re, cls] of RULES) {
      if (!re.test(scopes[s])) continue;
      if (cls === 'const?') return UPPER.test(text.trim()) ? 'const' : 'var';
      return cls;
    }
  }
  return '';
};

const expandTabs = (line) => {
  if (!line.includes('\t')) return line;
  let out = '';
  for (const ch of line) out += ch === '\t' ? ' '.repeat(4 - (out.length % 4)) : ch;
  return out;
};

const tokenizeFile = (hl, code, lang) =>
  hl.codeToTokens(code, {lang, theme: 'film-code', includeExplanation: 'scopeName'}).tokens.map((line) => {
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
    const merged = [];
    for (const [text, cls] of pieces) {
      const last = merged.at(-1);
      if (last && last[1] === cls) last[0] += text;
      else merged.push([text, cls]);
    }
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

const hl = await createHighlighter({
  themes: [{name: 'film-code', type: 'dark', colors: {'editor.background': '#060C11', 'editor.foreground': '#D3D8D6'}, tokenColors: []}],
  langs: ['python', 'javascript'],
});

for (const [chapter, id, repo, ref, file, lang, from, to] of EXCERPTS) {
  const raw = execFileSync('git', ['-C', path.join(args.repos, repo), 'show', `${ref}:${file}`], {encoding: 'utf8', maxBuffer: 64 << 20});
  const code = raw.replace(/\r\n?/g, '\n').split('\n').map(expandTabs).join('\n').replace(/\n$/, '');
  code.split('\n').forEach((l, i) => {
    if (SECRET_PATTERNS.some((re) => re.test(l))) throw new Error(`refusing: ${repo}/${file}:${i + 1} looks like a secret`);
  });
  const lines = tokenizeFile(hl, code, lang).slice(from - 1, to);
  const meta = {kind: 'snippet', id, repo: `AnwarDebes/${repo}`, ref, path: file, lang, startLine: from};
  const text = `${JSON.stringify(meta).slice(0, -1)},"lines":[\n${lines.map((l) => JSON.stringify(l)).join(',\n')}\n]}\n`;
  const out = path.join(dataRoot, chapter, 'code', `${id}.json`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, text);
  console.log(`${chapter}/code/${id}.json  ${repo}@${ref.slice(0, 7)} ${file}:${from}-${to}`);
}
