// Turns the storyboard script into narration lines for the voice engine.
//
//   node scripts/voice/prepare_lines.mjs [--script=research/storyboard/script.json] [--voice=UK_Charlotte]
//
// For every utterance: caption words (with tags) -> spoken tokens via pronounce.json. Each line gets
// a cache key from voice + spoken text, so a take is rendered once and reused while its text holds.
// Writes voice/lines.json (all lines) and voice/todo.json (lines without a take yet).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseMarkup} from '../timeline/markup.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const scriptPath = args.script || 'research/storyboard/script.json';
const voice = args.voice || 'UK_Charlotte';
const takesDir = 'voice/takes';
const pron = JSON.parse(fs.readFileSync('scripts/voice/pronounce.json', 'utf8'));

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const lines = [];
for (const ch of script.chapters) {
  for (const sc of ch.scenes) {
    for (const u of sc.narration || []) {
      const {words} = parseMarkup(u.text);
      const tokens = [];
      const spans = [];
      for (const w of words) {
        const m = w.text.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9%']*)$/);
        const [, lead, core, trail] = m;
        const said = pron[core] ?? core;
        const parts = said.split(/\s+/).filter(Boolean);
        const start = tokens.length;
        parts.forEach((p, k) => tokens.push((k === 0 ? lead : '') + p + (k === parts.length - 1 ? trail : '')));
        spans.push([start, tokens.length]);
      }
      const spoken = tokens.join(' ');
      const key = crypto.createHash('sha1').update(`${voice}|${spoken}`).digest('hex').slice(0, 16);
      lines.push({id: u.id, chapter: ch.id, scene: sc.id, voice, key, spoken, caption: words.map((w) => w.text), spans});
    }
  }
}
fs.mkdirSync(takesDir, {recursive: true});
const todo = lines.filter((l) => !fs.existsSync(path.join(takesDir, `${l.key}.wav`)));
fs.writeFileSync('voice/lines.json', JSON.stringify(lines, null, 1));
fs.writeFileSync('voice/todo.json', JSON.stringify(todo.map((l) => ({id: l.key, text: l.spoken})), null, 1));
const words = lines.reduce((n, l) => n + l.caption.length, 0);
console.log(`${lines.length} lines (${words} words); ${todo.length} need a take (voice ${voice})`);
