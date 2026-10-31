// Builds the film's master timeline from the script and the rendered voice.
//
//   node scripts/timeline/build.mjs [--script=research/storyboard/script.json]
//        [--voice=voice/manifest.json] [--out=src/data/timeline.json] [--fps=60]
//
// script.json: {chapters:[{id,title,gapBeforeS?,scenes:[{id,durationS?,leadS?,holdS?,gapS?,
//               narration:[{id,text,pauseAfterS?}]}]}]}
// manifest.json: {sampleRate, clips:{<utteranceId>:{file,durationS,words:[{text,start,end}]}}}
//   (word times relative to the start of the clip; from Kokoro natively or forced alignment)
//
// Scenes are laid end to end. Inside a scene, utterances follow each other with a sentence
// gap; a scene lasts at least its storyboard duration and at least its narration plus a hold.
import fs from 'node:fs';
import path from 'node:path';
import {parseMarkup, norm} from './markup.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  }),
);
const scriptPath = args.script || 'research/storyboard/script.json';
const voicePath = args.voice || 'voice/manifest.json';
const outPath = args.out || 'src/data/timeline.json';
const fps = Number(args.fps || 60);

const DEFAULTS = {
  firstLeadS: 1.2, // before the first word of the film (reel: 1.2 s)
  sceneLeadS: 0.35, // before the first word of a scene
  sentenceGapS: 0.85, // between sentences (reel median 0.87 s)
  chapterGapS: 1.8, // extra breath at a chapter turn (reel 1.5-4 s)
  holdS: 0.9, // after the last word of a scene, before the next scene starts
  finalHoldS: 7.9, // after the last word of the film (reel)
};

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const voice = fs.existsSync(voicePath) ? JSON.parse(fs.readFileSync(voicePath, 'utf8')) : {clips: {}};

// Estimate duration for lines that have no audio yet (animatic): 2.6 words/s inside sentences.
const estimate = (plain) => Math.max(0.8, plain.split(/\s+/).length / 2.6);

// Attach script words (with tags) to aligned audio words, in order.
const tagWords = (scriptWords, audioWords, clipStart, fallbackDur) => {
  if (!audioWords || !audioWords.length) {
    // spread evenly over the estimated duration
    const per = fallbackDur / scriptWords.length;
    return scriptWords.map((w, i) => ({text: w.text, tag: w.tag, start: clipStart + i * per, end: clipStart + (i + 1) * per}));
  }
  const out = [];
  let j = 0;
  for (const w of scriptWords) {
    const target = norm(w.text);
    let k = j;
    // find the next audio word matching this script word within a small window
    while (k < audioWords.length && k < j + 4 && norm(audioWords[k].text) !== target) k++;
    const a = k < audioWords.length && norm(audioWords[k].text) === target ? audioWords[k] : audioWords[Math.min(j, audioWords.length - 1)];
    if (k < audioWords.length && norm(audioWords[k].text) === target) j = k + 1;
    else j = Math.min(j + 1, audioWords.length);
    out.push({text: w.text, tag: w.tag, start: clipStart + a.start, end: clipStart + a.end});
  }
  // keep times monotonic
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].end;
    if (out[i].end < out[i].start) out[i].end = out[i].start + 0.05;
  }
  return out;
};

let t = 0;
const chapters = [];
const scenes = [];
const utterances = [];
const clips = [];
let first = true;
const missing = [];

for (const [ci, ch] of script.chapters.entries()) {
  const chStart = t;
  if (ci > 0) t += ch.gapBeforeS ?? DEFAULTS.chapterGapS;
  for (const sc of ch.scenes) {
    const scStart = t;
    let cursor = scStart + (first ? DEFAULTS.firstLeadS : sc.leadS ?? DEFAULTS.sceneLeadS);
    let lastEnd = null;
    for (const [ui, u] of (sc.narration || []).entries()) {
      const {plain, words} = parseMarkup(u.text);
      const clip = voice.clips?.[u.id];
      if (!clip) missing.push(u.id);
      const dur = clip ? clip.durationS : estimate(plain);
      if (ui > 0) cursor += sc.gapS ?? DEFAULTS.sentenceGapS;
      const start = cursor;
      const tagged = tagWords(words, clip?.words, start, dur);
      utterances.push({id: u.id, chapter: ch.id, scene: sc.id, start, end: start + dur, plain, words: tagged});
      if (clip) clips.push({id: u.id, file: clip.file, start, trimStartS: clip.trimStartS ?? 0, durS: clip.durationS});
      cursor = start + dur + (u.pauseAfterS ?? 0);
      lastEnd = cursor;
      first = false;
    }
    const narrEnd = lastEnd === null ? scStart : lastEnd + (sc.holdS ?? DEFAULTS.holdS);
    const scEnd = Math.max(scStart + (sc.durationS ?? 0), narrEnd);
    scenes.push({id: sc.id, chapter: ch.id, start: scStart, end: scEnd});
    t = scEnd;
  }
  chapters.push({id: ch.id, title: ch.title, start: chStart, end: t});
}
// final hold after the last word
const lastWord = utterances.length ? utterances[utterances.length - 1].end : t;
const durationS = Math.max(t, lastWord + DEFAULTS.finalHoldS);
if (scenes.length) scenes[scenes.length - 1].end = durationS;
if (chapters.length) chapters[chapters.length - 1].end = durationS;

// Snap to whole frames so every consumer agrees on boundaries.
const snap = (s) => Math.round(s * fps) / fps;
for (const x of [...chapters, ...scenes]) {
  x.start = snap(x.start);
  x.end = snap(x.end);
}

const timeline = {fps, durationS: snap(durationS), durationInFrames: Math.round(durationS * fps), chapters, scenes, utterances, clips};
fs.mkdirSync(path.dirname(outPath), {recursive: true});
fs.writeFileSync(outPath, JSON.stringify(timeline, null, 1));
const words = utterances.reduce((n, u) => n + u.words.length, 0);
console.log(`timeline: ${chapters.length} chapters, ${scenes.length} scenes, ${utterances.length} utterances, ${words} words, ${durationS.toFixed(1)} s (${(words / (durationS / 60)).toFixed(0)} wpm overall)`);
if (missing.length) console.log(`no audio yet for ${missing.length} utterances (estimated timing): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' ...' : ''}`);
