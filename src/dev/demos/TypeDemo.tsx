import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, random, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Utterance, WordTag} from '../../engine/narration/types';
import {color, font, type} from '../../engine/tokens';
import {
  buildCaptionPages,
  Captions,
  ChapterCard,
  CitationChip,
  easeOutCubic,
  fontCSS,
  fontOf,
  GlassCard,
  inkWidth,
  Kicker,
  KineticLine,
  Legend,
  Numeral,
  prog,
  Scrim,
  runTop,
  shiftUtterances,
  Stamp,
  StepPill,
  useFontsReady,
  useNumeralWidth,
  WindowFrame,
  wordStart,
} from '../../engine/type';
import type {DemoSpec} from '../types';

// Test narration: the reel's word timings and tags ([text, start, end, tag]).
type ReelWord = [string, number, number, string];
type ReelUtt = {id: string; chapter: string; words: ReelWord[]};
const REEL: ReelUtt[] = [
  {id: 'u01', chapter: 'The black box', words: [['Most', 1.2, 1.48, ''], ['AI', 1.48, 1.82, ''], ['hands', 1.82, 2.11, ''], ['you', 2.11, 2.19, ''], ['an', 2.19, 2.27, ''], ['answer.', 2.27, 2.98, 'em']]},
  {id: 'u02', chapter: 'The black box', words: [['Very', 3.85, 4.15, ''], ['little', 4.15, 4.36, ''], ['of', 4.36, 4.45, ''], ['it', 4.45, 4.61, ''], ['shows', 4.61, 4.92, ''], ['you', 4.92, 5.08, ''], ['why.', 5.08, 5.65, 'em']]},
  {id: 'u03', chapter: 'The black box', words: [['Anwar', 6.7, 7.1, 'name'], ['Debes', 7.1, 7.59, 'name'], ['builds', 7.59, 7.91, ''], ['the', 7.91, 8.0, ''], ['kind', 8.0, 8.29, ''], ['that', 8.29, 8.43, ''], ['does.', 8.43, 9.05, 'em']]},
  {id: 'u04', chapter: 'Tsetlin Machines', words: [['At', 13.0, 13.11, ''], ['the', 13.11, 13.2, ''], ['University', 13.2, 13.86, ''], ['of', 13.86, 13.96, ''], ['Agder,', 13.96, 14.57, 'key'], ['he', 14.68, 14.84, ''], ['researches', 14.84, 15.47, ''], ['Tsetlin', 15.47, 15.89, 'key'], ['Machines:', 15.89, 16.88, 'key'], ['models', 17.05, 17.55, ''], ['whose', 17.55, 17.79, ''], ['every', 17.79, 18.1, ''], ['decision', 18.1, 18.69, ''], ['is', 18.69, 18.81, ''], ['a', 18.81, 18.9, ''], ['set', 18.9, 19.09, ''], ['of', 19.09, 19.21, ''], ['logical', 19.21, 19.7, 'key'], ['clauses', 19.7, 20.25, 'key'], ['you', 20.25, 20.4, ''], ['can', 20.4, 20.62, ''], ['read,', 20.62, 21.23, 'em'], ['check,', 21.38, 21.82, 'em'], ['and', 21.9, 22.02, ''], ['argue', 22.02, 22.4, 'em'], ['with.', 22.4, 22.88, 'em']]},
  {id: 'u05', chapter: 'glassbox-lm', words: [['His', 24.2, 24.38, ''], ["master's", 24.38, 24.85, ''], ['research,', 24.85, 25.48, ''], ['glassbox-lm,', 25.57, 26.93, 'key'], ['takes', 27.05, 27.34, ''], ['measured', 27.34, 27.75, ''], ['steps', 27.75, 28.12, ''], ['toward', 28.12, 28.34, ''], ['a', 28.34, 28.43, ''], ['language', 28.43, 28.85, ''], ['model', 28.85, 29.23, ''], ['you', 29.23, 29.32, ''], ['can', 29.32, 29.52, ''], ['read.', 29.52, 30.15, 'em']]},
];
// The reel's closing statement, used for the kinetic statement (moved into the breath after u03).
const STATEMENT: ReelUtt = {id: 'u17', chapter: 'Show its work', words: [['If', 91.45, 91.59, ''], ['a', 91.59, 91.69, ''], ['system', 91.69, 92.08, ''], ['makes', 92.08, 92.31, ''], ['a', 92.31, 92.38, ''], ['claim,', 92.38, 92.92, ''], ['it', 93.03, 93.15, ''], ['should', 93.15, 93.34, ''], ['show', 93.34, 93.56, 'em'], ['its', 93.56, 93.75, 'em'], ['work.', 93.75, 94.3, 'em']]};
// The rest of the reel, only for the layout log (logLayout prop).
const REEL_REST: ReelUtt[] = [
  {id: 'u06', chapter: 'glassbox-lm', words: [['Ninety-one', 30.95, 31.43, 'key'], ['hypotheses,', 31.43, 32.42, 'key'], ['written', 32.56, 32.85, ''], ['down', 32.85, 33.09, ''], ['before', 33.09, 33.31, 'em'], ['the', 33.31, 33.4, 'em'], ['runs.', 33.4, 34.08, 'em']]},
  {id: 'u07', chapter: 'glassbox-lm', words: [['Every', 34.75, 35.05, ''], ['result', 35.05, 35.55, ''], ['reported', 35.55, 36.08, ''], ['as', 36.08, 36.23, ''], ['measured,', 36.23, 36.9, 'em'], ['including', 37.02, 37.49, ''], ['the', 37.49, 37.58, ''], ['ones', 37.58, 37.9, ''], ['that', 37.9, 38.04, ''], ['did', 38.04, 38.16, 'em'], ['not', 38.16, 38.38, 'em'], ['work.', 38.38, 38.98, 'em']]},
  {id: 'u08', chapter: 'AI you can check', words: [['He', 39.9, 40.02, ''], ['builds', 40.02, 40.36, ''], ['AI', 40.36, 40.7, ''], ['you', 40.7, 40.8, ''], ['can', 40.8, 41.01, ''], ['check.', 41.01, 41.6, 'em']]},
  {id: 'u09', chapter: 'AI you can check', words: [['VERITAS', 42.45, 43.09, 'key'], ['proves', 43.09, 43.41, 'em'], ['a', 43.41, 43.48, ''], ["guardrail's", 43.48, 43.95, ''], ['safety', 43.95, 44.33, ''], ['rules,', 44.33, 45.02, ''], ['or', 45.14, 45.31, ''], ['hands', 45.31, 45.62, ''], ['you', 45.62, 45.77, ''], ['the', 45.77, 45.92, ''], ['exact', 45.92, 46.44, 'em'], ['input', 46.44, 46.85, 'em'], ['that', 46.85, 47, ''], ['breaks', 47, 47.33, ''], ['one.', 47.33, 47.9, '']]},
  {id: 'u10', chapter: 'AI you can check', words: [['TRACE', 48.65, 49, 'key'], ['catches', 49, 49.36, ''], ['an', 49.36, 49.45, ''], ['attack', 49.45, 49.91, ''], ['hidden', 49.91, 50.25, ''], ['in', 50.25, 50.4, ''], ['innocent', 50.4, 50.8, 'em'], ['steps,', 50.8, 51.55, ''], ['and', 51.65, 51.79, ''], ['signs', 51.79, 52.23, ''], ['a', 52.23, 52.34, ''], ['ledger', 52.34, 52.7, ''], ['anyone', 52.7, 53.15, ''], ['can', 53.15, 53.33, ''], ['verify.', 53.33, 54.17, 'em']]},
  {id: 'u11', chapter: 'AI you can check', words: [['CANDOR', 54.95, 55.35, 'key'], ['puts', 55.35, 55.54, ''], ['a', 55.54, 55.6, ''], ['certificate', 55.6, 56.34, 'em'], ['on', 56.34, 56.56, ''], ['every', 56.56, 56.89, ''], ['answer', 56.89, 57.35, ''], ['a', 57.35, 57.45, ''], ['network', 57.45, 57.85, ''], ['gives.', 57.85, 58.5, '']]},
  {id: 'u12', chapter: 'NTNU and SafeMediAI', words: [['At', 59.55, 59.73, ''], ['NTNU,', 59.73, 60.75, 'key'], ['his', 60.9, 61.1, ''], ['bachelor', 61.1, 61.61, ''], ['team', 61.61, 61.98, ''], ['won', 61.98, 62.14, ''], ['the', 62.14, 62.23, ''], ['Eureka', 62.23, 62.65, 'key'], ['Prize', 62.65, 63.1, 'key'], ['for', 63.1, 63.26, ''], ['software', 63.26, 64.25, ''], ['that', 64.25, 64.49, ''], ['finds', 64.49, 64.95, ''], ['and', 64.95, 65.08, ''], ['removes', 65.08, 65.58, ''], ['sensitive', 65.58, 66.12, ''], ['content', 66.12, 66.74, ''], ['in', 66.74, 66.9, ''], ['images', 66.9, 67.42, ''], ['and', 67.42, 67.55, ''], ['documents.', 67.55, 68.45, '']]},
  {id: 'u13', chapter: 'NTNU and SafeMediAI', words: [['Today,', 69.2, 69.62, ''], ['he', 69.7, 69.85, ''], ['is', 69.85, 69.99, ''], ['CFO', 69.99, 70.62, ''], ['of', 70.62, 70.79, ''], ['SafeMediAI,', 70.79, 72.17, 'key'], ['the', 72.33, 72.42, ''], ['Norwegian', 72.42, 72.97, ''], ['startup', 72.97, 73.45, ''], ['behind', 73.45, 73.85, ''], ['DeclassifAI.', 73.85, 74.92, 'key']]},
  {id: 'u14', chapter: 'Outside the lab', words: [['Outside', 75.85, 76.26, ''], ['the', 76.26, 76.35, ''], ['lab,', 76.35, 76.92, ''], ['he', 77.03, 77.17, ''], ['builds', 77.17, 77.51, ''], ['game-playing', 77.51, 78.22, 'key'], ['agents,', 78.22, 78.83, 'key'], ['data', 78.94, 79.28, 'key'], ['warehouses,', 79.28, 80.22, 'key'], ['and', 80.3, 80.46, ''], ['apps', 80.46, 80.8, 'key'], ['that', 80.8, 80.95, ''], ['run', 80.95, 81.2, ''], ['entirely', 81.2, 81.88, ''], ['in', 81.88, 81.96, ''], ['your', 81.96, 82.08, ''], ['browser.', 82.08, 82.83, 'em']]},
  {id: 'u15', chapter: 'Outside the lab', words: [['Even', 83.55, 83.83, ''], ['his', 83.83, 84, ''], ['coding', 84, 84.39, ''], ['agent', 84.39, 84.81, ''], ['shows', 84.81, 85.11, 'em'], ['its', 85.11, 85.3, 'em'], ['work:', 85.3, 85.8, 'em'], ['Pixie', 85.94, 86.41, 'key'], ['acts', 86.41, 86.71, ''], ['out', 86.71, 86.94, ''], ['every', 86.94, 87.28, ''], ['step.', 87.28, 87.9, '']]},
  {id: 'u16', chapter: 'Show its work', words: [['One', 89, 89.22, ''], ['rule', 89.22, 89.5, 'em'], ['runs', 89.5, 89.8, ''], ['through', 89.8, 90, ''], ['all', 90, 90.16, ''], ['of', 90.16, 90.25, ''], ['it.', 90.25, 90.67, '']]},
  STATEMENT,
  {id: 'u18', chapter: 'Show its work', words: [['Anwar', 95.7, 96.22, 'name'], ['Debes.', 96.38, 97.1, 'name']]},
];

const toUtterances = (src: ReelUtt[]): Utterance[] =>
  src.map((u) => ({
    id: u.id,
    chapter: u.chapter,
    words: u.words.map(([text, start, end, tag]) => ({text, start, end, tag: tag as WordTag})),
  }));

/** A stand-in for the pin wall: a hex lattice of steel heads under a soft light pool. Drawn once. */
const DemoWall: React.FC = () => {
  const {width: W, height: H} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = '#080A0A';
    g.fillRect(0, 0, W, H);
    const p = H * 0.0123;
    const r = 0.47 * p;
    const s = Math.ceil(r * 2 + 4);
    const sprite = document.createElement('canvas');
    sprite.width = s;
    sprite.height = s;
    const sg = sprite.getContext('2d');
    if (!sg) return;
    const grad = sg.createRadialGradient(s / 2 - r * 0.32, s / 2 - r * 0.38, r * 0.04, s / 2, s / 2, r);
    grad.addColorStop(0, '#E4E7E6');
    grad.addColorStop(0.22, '#A3AAA8');
    grad.addColorStop(0.62, '#3B403E');
    grad.addColorStop(1, '#121413');
    sg.fillStyle = grad;
    sg.beginPath();
    sg.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    sg.fill();
    const rowH = (p * Math.sqrt(3)) / 2;
    let row = 0;
    for (let y = -p; y < H + p; y += rowH, row++) {
      const off = row % 2 ? p / 2 : 0;
      let col = 0;
      for (let x = -p + off; x < W + p; x += p, col++) {
        const dx = ((x / W - 0.55) * W) / H;
        const dy = y / H - 0.45;
        const light = 0.16 + 0.84 * Math.exp(-(dx * dx + dy * dy) * 2.4);
        g.globalAlpha = Math.min(1, light * (0.82 + 0.18 * random(`pin-${row}-${col}`)));
        g.drawImage(sprite, x - s / 2, y - s / 2);
      }
    }
    g.globalAlpha = 1;
  }, [W, H]);
  return <canvas ref={ref} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};

// ---- Act D: a natively re-set glassbox-lm clause view (rows from the project film's live demo) ----

type Seg = [string, 'kw' | 'var' | 'sub' | 'op' | 'lit' | 'dim' | 'word'];
const ROWS: Array<{segs: Seg[]; vote: string}> = [
  {segs: [['BIAS', 'kw'], [' always fires: how common ', 'dim'], ['acknowledged', 'word'], [' is', 'dim']], vote: '−9.37'},
  {segs: [['IF ', 'kw'], ['x', 'var'], ['−1', 'sub'], [' = ', 'op'], ['universally', 'lit'], [' THEN', 'kw']], vote: '+6.64'},
  {segs: [['IF ', 'kw'], ['x', 'var'], ['−2', 'sub'], [' = ', 'op'], ['truth', 'lit'], [' ∧ ', 'op'], ['x', 'var'], ['−1', 'sub'], [' = ', 'op'], ['universally', 'lit'], [' THEN', 'kw']], vote: '+1.11'},
  {segs: [['IF ', 'kw'], ['x', 'var'], ['−3', 'sub'], [' = ', 'op'], ['a', 'lit'], [' ∧ ', 'op'], ['x', 'var'], ['−2', 'sub'], [' = ', 'op'], ['truth', 'lit'], [' ∧ ', 'op'], ['x', 'var'], ['−1', 'sub'], [' = ', 'op'], ['universally', 'lit'], [' THEN', 'kw']], vote: '+0.22'},
];
const SEG_STYLE: Record<Seg[1], React.CSSProperties> = {
  kw: {color: color.accent.mintLabel},
  var: {color: color.text.secondary},
  sub: {color: color.text.secondary, fontSize: '0.62em', position: 'relative', top: '0.32em', marginRight: '0.08em'},
  op: {color: color.text.tertiary},
  lit: {color: color.text.display, fontWeight: 650},
  dim: {color: color.text.secondary},
  word: {color: color.text.display, fontWeight: 650},
};

const ClauseRows: React.FC<{t: number; at: number; highlightFrom: number; highlightTo: number}> = ({t, at, highlightFrom, highlightTo}) => {
  const {height: H} = useVideoConfig();
  const fs = 0.0205 * H;
  const pad = Math.round(0.022 * H);
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', left: pad, right: pad, top: pad, fontFamily: font.mono, fontSize: fs, fontWeight: 450, lineHeight: 1.35, fontSynthesis: 'none'}}>
      <div style={{fontFamily: font.mono, fontSize: type.monoCardLabel.size * H, letterSpacing: '0.15em', color: color.text.tertiary, marginBottom: Math.round(fs * 0.9)}}>
        NEXT WORD · EVERY CLAUSE THAT FIRES, AND ITS VOTE
      </div>
      {ROWS.map((row, i) => {
        const ti = at + i * 0.32;
        const k = easeOutCubic(prog(t, ti, 0.4));
        const lit = i === 3 && t >= highlightFrom && t < highlightTo;
        const litK = i === 3 ? Math.min(prog(t, highlightFrom, 0.3), 1 - prog(t, highlightTo, 0.3)) : 0;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: fs,
              padding: `${Math.round(fs * 0.62)}px ${Math.round(fs * 0.8)}px`,
              marginBottom: Math.round(fs * 0.42),
              borderRadius: Math.round(0.008 * H),
              background: color.card.windowHeader,
              border: `${hair}px solid ${lit || litK > 0 ? `rgba(116,201,174,${(0.2 + 0.6 * litK).toFixed(3)})` : color.card.rule}`,
              boxShadow: litK > 0 ? `0 0 ${Math.round(fs * 0.9)}px rgba(116,201,174,${(0.18 * litK).toFixed(3)})` : undefined,
              opacity: k,
              transform: k < 1 ? `translateY(${((1 - k) * fs * 0.5).toFixed(2)}px)` : undefined,
              whiteSpace: 'nowrap',
            }}
          >
            <span>
              {row.segs.map(([s, kind], j) => (
                <span key={j} style={SEG_STYLE[kind]}>
                  {s}
                </span>
              ))}
            </span>
            <span style={{color: color.text.display, fontWeight: 600, fontFeatureSettings: '"tnum" 1'}}>{row.vote}</span>
          </div>
        );
      })}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: `${Math.round(fs * 0.5)}px ${Math.round(fs * 0.8)}px 0`,
          opacity: easeOutCubic(prog(t, at + ROWS.length * 0.32 + 0.1, 0.4)),
          fontFamily: font.sans,
          fontSize: fs * 1.05,
          color: color.text.secondary,
        }}
      >
        <span>Sum of the votes</span>
        <span style={{fontFamily: font.mono, color: color.text.display, fontWeight: 600}}>
          {'−1.3354'}
          <span style={{color: color.text.tertiary}}>{'  →  '}</span>
          26.3%
        </span>
      </div>
    </div>
  );
};

// ---- Act E: the card with the H1.1 result (glassbox-lm docs/results-overview.md, line 41) ----

const ResultCard: React.FC<{t: number; at: number; exitAt: number; x: number; y: number; w: number; h: number}> = ({t, at, exitAt, x, y, w, h}) => {
  const {height: H} = useVideoConfig();
  const ready = useFontsReady();
  const hair = Math.max(1, Math.round(H / 1080));
  const pad = Math.round(0.026 * H);
  const sizeH = 0.064;
  const w1 = useNumeralWidth({value: 2.2193, decimals: 4, kind: 'cardTitle', sizeH, weight: 700});
  if (!ready) return null;
  const vsFont = {...fontOf('tagline', H), size: 0.027 * H, weight: 500};
  const noteFont = {...fontOf('bodySmall', H), weight: 450};
  const vsW = inkWidth('vs', vsFont);
  const gap = Math.round(0.02 * H);
  const baseline = Math.round(0.158 * H);
  const noteBaseline = baseline + Math.round(0.05 * H);
  const footBaseline = h - pad - Math.round(0.006 * H);
  const n1Land = at + 0.85;
  const n2Land = at + 1.15;
  const x2 = pad + w1 + gap + vsW + gap;
  const fade = (from: number) => easeOutCubic(prog(t, from, 0.4));
  const note = (text: string, left: number, b: number, c: string, alpha: number) => (
    <span style={{...fontCSS(noteFont), position: 'absolute', left, top: runTop(b, noteFont), lineHeight: 1.6, color: c, opacity: alpha}}>{text}</span>
  );
  return (
    <GlassCard x={x} y={y} width={w} height={h} label="H1.1 · against the 5-gram floor" t={t} at={at} exitAt={exitAt}>
      <Numeral value={2.2193} decimals={4} landAt={n1Land} countS={0.8} kind="cardTitle" sizeH={sizeH} weight={700} t={t} x={pad} baseline={baseline} />
      <span style={{...fontCSS(vsFont), position: 'absolute', left: pad + w1 + gap, top: runTop(baseline, vsFont), lineHeight: 1.6, color: color.text.secondary, opacity: fade(n1Land - 0.25)}}>vs</span>
      <Numeral value={1.3719} decimals={4} landAt={n2Land} countS={0.8} kind="cardTitle" sizeH={sizeH} weight={700} unit="bits per byte" unitScale={0.4} t={t} x={x2} baseline={baseline} />
      {note('Tsetlin model', pad, noteBaseline, color.text.chipDim, fade(n1Land))}
      {note('Kneser-Ney 5-gram', x2, noteBaseline, color.text.chipDim, fade(n2Land))}
      <div style={{position: 'absolute', left: pad, right: pad, top: footBaseline - Math.round(0.042 * H), height: hair, background: color.card.rule, opacity: fade(n2Land + 0.1)}} />
      {note('WikiText-103 test split · seed 1 · same tokens', pad, footBaseline, color.text.tertiary, fade(n2Land + 0.1))}
    </GlassCard>
  );
};

// ---- Sheet: every component and variant in one still (view="sheet"), for review ----

const SheetLabel: React.FC<{x: number; y: number; text: string}> = ({x, y, text}) => (
  <Kicker text={text} tone="grey" kind="monoCardLabel" x={x} baseline={y} />
);

const Sheet: React.FC<{t: number}> = ({t}) => {
  const {width: W, height: H} = useVideoConfig();
  const m = Math.round(0.069 * W);
  const col = (k: number) => Math.round(m + k * 0.178 * W);
  const yH = (f: number) => Math.round(f * H);
  // every timed element is offset so that at time t it shows a chosen state
  const done = t - 5;
  const nsz = 0.075;
  return (
    <>
      <SheetLabel x={m} y={yH(0.06)} text="Numeral formats, landed" />
      <Numeral value={0.827} decimals={3} landAt={done} sizeH={nsz} t={t} x={col(0)} baseline={yH(0.16)} />
      <Numeral value={107} unit="µs" unitScale={0.42} landAt={done} sizeH={nsz} t={t} x={col(1)} baseline={yH(0.16)} />
      <Numeral value={12.5} decimals={1} unit="KiB" unitScale={0.42} landAt={done} sizeH={nsz} t={t} x={col(2)} baseline={yH(0.16)} />
      <Numeral value={256} base={2} landAt={done} sizeH={nsz} t={t} x={col(3)} baseline={yH(0.16)} />
      <Numeral value={-16} base={10} prefix={'4.4 × '} landAt={done} sizeH={nsz} t={t} x={col(4)} baseline={yH(0.16)} />
      <SheetLabel x={m} y={yH(0.215)} text="Counting in tabular slots (5,401 at 70%) and settling on landing (91)" />
      <Numeral value={5401} group landAt={t + 0.35} countS={1.2} sizeH={nsz} t={t} x={col(0)} baseline={yH(0.31)} />
      <Numeral value={91} landAt={t - 0.2} countS={1.2} sizeH={nsz} t={t} x={col(2)} baseline={yH(0.31)} />

      <SheetLabel x={m} y={yH(0.365)} text="Stamps, landed; the last one still dropping" />
      {(['PROVED', 'VERIFIED', 'MET', 'NOT MET', 'COUNTEREXAMPLE', 'NOT JUDGED', 'NOT RUN'] as const).map((k, i) => (
        <Stamp key={k} kind={k} at={done} t={t} x={Math.round(m + 0.055 * W + i * 0.108 * W + (i >= 4 ? 0.03 * W : 0) + (i >= 5 ? 0.02 * W : 0))} y={yH(0.42)} />
      ))}
      <Stamp kind="PROVED" at={t - 0.2} t={t} x={Math.round(0.89 * W)} y={yH(0.42)} />

      <SheetLabel x={m} y={yH(0.49)} text="KineticLine: rise, focus, mask (mid-entry)" />
      <KineticLine text="A test checks *examples.*" at={t - 0.25} perWordS={0.12} t={t} kind="headline" sizeH={0.05} variant="rise" x={col(0)} y={yH(0.56)} yAnchor="firstBaseline" />
      <KineticLine text="A test checks *examples.*" at={t - 0.25} perWordS={0.12} t={t} kind="headline" sizeH={0.05} variant="focus" x={col(2) - Math.round(0.04 * W)} y={yH(0.56)} yAnchor="firstBaseline" />
      <KineticLine text="A test checks *examples.*" at={t - 0.3} perWordS={0.12} t={t} kind="headline" sizeH={0.05} variant="mask" x={col(4) - Math.round(0.08 * W)} y={yH(0.56)} yAnchor="firstBaseline" />

      <SheetLabel x={m} y={yH(0.615)} text="Step pills, a kicker typing on, chips: typing, verified with a leader, right-aligned" />
      <StepPill n={4} text="One extra word, and the attack *gets through.*" at={done} t={t} x={m} y={yH(0.675)} align="left" />
      <StepPill n={7} text="Check the proof." at={t - 0.15} t={t} x={Math.round(0.56 * W)} y={yH(0.675)} align="left" />
      <Kicker text="Right now, Pixie is" tone="grey" enter="type" at={t - 0.25} t={t} x={Math.round(0.76 * W)} baseline={yH(0.684)} />
      <CitationChip repo="veritas" path="paper/main.tex" line="210-214" at={t - 0.35} t={t} x={m} y={yH(0.755)} />
      <CitationChip repo="trace" path="README.md" line={42} at={done} t={t} x={Math.round(0.4 * W)} y={yH(0.755)} leader={Math.round(0.03 * W)} />
      <CitationChip repo="candor" path="results/summary.json" line={7} at={done} t={t} x={Math.round(0.931 * W)} y={yH(0.755)} align="right" verified={false} />

      <Legend direction="column" at={done} t={t} x={m} y={yH(0.84)} sizeH={0.024} items={[
        {label: 'met', count: 12, color: color.accent.mint},
        {label: 'not met', count: 11, color: color.signal.verdictRed},
        {label: 'not judged', count: 7, color: color.signal.amber},
        {label: 'never run', count: 61, color: color.text.secondary, outline: true},
      ]} />
      <GlassCard x={Math.round(0.3 * W)} y={yH(0.81)} width={Math.round(0.3 * W)} height={yH(0.15)} label="Tsetlin machine" title="Is this a face?">
        <div style={{fontFamily: font.sans, fontSize: 0.026 * H, color: color.text.secondary}}>GlassCard: label, title, body.</div>
      </GlassCard>
      <WindowFrame x={Math.round(0.631 * W)} y={yH(0.81)} width={Math.round(0.3 * W)} height={yH(0.15)} product="veritas" descriptor="proofs for guardrails" rotateY={0} rotateX={0}>
        <div style={{position: 'absolute', left: Math.round(0.022 * H), top: Math.round(0.02 * H), fontFamily: font.mono, fontSize: 0.021 * H, color: color.text.display, whiteSpace: 'nowrap'}}>
          drat-trim formula.cnf proof.drup <span style={{color: color.accent.mint}}>s VERIFIED</span>
        </div>
      </WindowFrame>
    </>
  );
};

type Props = {logLayout?: boolean; view?: 'film' | 'sheet' | 'scrim'; sheetT?: number; wall?: boolean};

const TypeDemo: React.FC<Props> = ({logLayout = false, view = 'film', sheetT = 10, wall = true}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const utts = useMemo(() => toUtterances(REEL), []);
  const statement = useMemo(() => shiftUtterances(toUtterances([STATEMENT]), 9.6 - STATEMENT.words[0][1])[0].words, []);
  const ready = useFontsReady();

  // dev aid: print every caption block of the whole reel, as laid out at this size
  useEffect(() => {
    if (!logLayout || !ready) return;
    const all = toUtterances([...REEL, ...REEL_REST]);
    const base = fontOf('caption', H);
    const pages = buildCaptionPages(all, {W, H, base, maxWidth: 0.8 * W, maxLines: 2, lastBaseline: 0.922 * H, pitch: 1.39 * base.size});
    for (const p of pages) {
      const lines = p.lines.map((l) => p.runs.slice(l.first, l.last + 1).map((r) => r.text).join(' '));
      // eslint-disable-next-line no-console
      console.log(`[captions ${H}p] ${p.key} ${p.appear.toFixed(2)}-${(p.exitStart + p.exitDur).toFixed(2)}s  | ${lines.join('  //  ')}`);
    }
  }, [logLayout, ready, W, H]);

  const m = 0.069 * W;
  // Act E geometry
  const numBaseline = Math.round(0.42 * H);
  const w91 = useNumeralWidth({value: 91});
  const cardX = Math.round(0.52 * W);
  const cardY = Math.round(0.215 * H);
  const cardW = Math.round(0.41 * W);
  const cardH = Math.round(0.3 * H);
  const measured = wordStart(utts, 'u05', 'measured');
  const exitE = 32.9;
  // Act D geometry
  const win = {x: Math.round(0.47 * W), y: Math.round(0.13 * H), w: Math.round(0.465 * W), h: Math.round(0.455 * H)};
  const pillY = win.y + win.h + Math.round(0.05 * H);
  const push = 1 + 0.035 * (frame / durationInFrames);

  if (view === 'scrim') {
    // banding check: the caption scrim over the light pool's flat centre tone
    return (
      <AbsoluteFill style={{backgroundColor: '#505252'}}>
        <Scrim />
      </AbsoluteFill>
    );
  }
  if (view === 'sheet') {
    return (
      <AbsoluteFill style={{backgroundColor: '#080A0A', overflow: 'hidden'}}>
        <DemoWall />
        <Sheet t={sheetT} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: '#080A0A', overflow: 'hidden'}}>
      {/* its own compositor layer, like the film's WebGL canvas: the slow push never repaints the type */}
      {wall ? (
        <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '55% 45%', willChange: 'transform'}}>
          <DemoWall />
        </AbsoluteFill>
      ) : null}

      {/* Act A: chapter card over the opening lines */}
      <ChapterCard index={1} kicker="The black box" title="AI that *shows its work.*" sub="Every repository on github.com/AnwarDebes" at={0.3} exitAt={5.75} t={t} />

      {/* Act C: the film's rule as a kinetic statement, entering on its spoken words */}
      <KineticLine words={statement} t={t} kind="statement" variant="rise" x={m} y={Math.round(0.4 * H)} yAnchor="capTop" maxWidth={0.6 * W} exitAt={13.4} underline />

      {/* Act D: a clause view in a window, with numbered steps */}
      <WindowFrame x={win.x} y={win.y} width={win.w} height={win.h} product="glassbox-lm" descriptor="a language model you can read" t={t} at={13.7} exitAt={23.25} rotateY={-6} rotateX={1.5}>
        <ClauseRows t={t} at={14.3} highlightFrom={wordStart(utts, 'u04', 'logical')} highlightTo={wordStart(utts, 'u04', 'read,')} />
      </WindowFrame>
      <StepPill n={1} text="Every guess is a *sum of votes.*" t={t} at={wordStart(utts, 'u04', 'models') - 0.1} exitAt={wordStart(utts, 'u04', 'logical') - 0.4} x={win.x + win.w} y={pillY} align="right" />
      <StepPill n={2} text="Each clause fires on your last words and votes for the next." t={t} at={wordStart(utts, 'u04', 'logical') - 0.1} exitAt={wordStart(utts, 'u04', 'read,') - 0.4} x={win.x + win.w} y={pillY} align="right" />
      <StepPill n={3} text="Every vote points back to the page it was counted on." t={t} at={wordStart(utts, 'u04', 'read,') - 0.1} exitAt={22.95} x={win.x + win.w} y={pillY} align="right" />

      {/* Act E: 91, its source, the legend, and a result that was not met */}
      <Kicker text="glassbox-lm · pre-registered study" t={t} at={24.0} exitAt={exitE} x={m} baseline={Math.round(0.205 * H)} />
      <Numeral value={91} landAt={measured} countS={1.5} t={t} x={m} baseline={numBaseline} exitAt={exitE} />
      <Kicker text="hypotheses, written down before the runs" tone="grey" kind="monoCardLabel" enter="type" t={t} at={measured + 0.12} exitAt={exitE} x={m} baseline={numBaseline + Math.round(0.06 * H)} />
      <CitationChip repo="glassbox-lm" path="README.md" line={18} t={t} at={measured + 0.15} exitAt={exitE} x={m + w91 + Math.round(0.034 * W)} y={Math.round(numBaseline - 0.703 * type.numeralXL.size * H * 0.5)} leader={Math.round(0.02 * W)} />
      <Legend
        t={t}
        at={measured + 0.9}
        exitAt={exitE}
        x={m}
        y={Math.round(0.565 * H)}
        items={[
          {label: 'met', count: 12, color: color.accent.mint},
          {label: 'not met', count: 11, color: color.signal.verdictRed},
          {label: 'not judged', count: 7, color: color.signal.amber},
          {label: 'not run', count: 61, color: color.text.secondary, outline: true},
        ]}
      />
      <ResultCard t={t} at={measured + 1.35} exitAt={exitE + 0.05} x={cardX} y={cardY} w={cardW} h={cardH} />
      <Stamp kind="NOT MET" t={t} at={30.4} exitAt={exitE + 0.05} x={cardX + cardW - Math.round(0.07 * W)} y={cardY + Math.round(0.004 * H)} />
      <CitationChip repo="glassbox-lm" path="docs/results-overview.md" line={41} t={t} at={30.95} exitAt={exitE + 0.1} x={cardX} y={cardY + cardH + Math.round(0.045 * H)} />

      {/* captions over everything, with their scrim */}
      <Captions utterances={utts} t={t} />
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {id: 'TypeDemo', component: TypeDemo, durationInFrames: 34 * 60, defaultProps: {logLayout: false, view: 'film', sheetT: 10, wall: true}};
