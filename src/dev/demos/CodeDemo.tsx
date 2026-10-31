import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoSpec} from '../types';
import {CodePanel, cue, type CodePage} from '../../engine/code';
import {diffs, snippets} from '../../data/code';
import {color, font, layout, type as typeScale} from '../../engine/tokens';
import {easeUi, prog} from '../../engine/code/anim';

// Real code, real line numbers, real commits:
//   1. Claude-Code-In-Motion web/js/mascot.js @ e4ab557: Pixie's state labels
//      revealed line by line, the "waiting" label annotated, then a focus
//      scroll down to setActivity, where unknown activities fall back to
//      "thinking".
//   2. web/js/app.js, commit e4ab557: the edit that makes Pixie show
//      "waiting" (not "thinking") while an approval is pending.
//   3. trace tracekit/ledger.py @ cc3a1a4: the hash the ledger writes morphs
//      into the hash the independent verifier recomputes, and the comparison
//      that catches an edited entry is typed in.
// Render with inputProps {"variant": "sheet"} for a one-page check of every
// callout side and the wipe reveal.

const FPS = 60;
const DURATION_S = 16.9;

const makePages = (H: number): CodePage[] => [
  {
    at: 0,
    source: {snippet: snippets['pixie-mascot'], lines: [25, 82]},
    view: 31,
    rows: 13,
    width: 1.06 * H,
    header: {label: 'Claude-Code-In-Motion', path: 'web/js/mascot.js', meta: 'e4ab557'},
    cues: [
      cue.reveal(0.3, {lines: [31, 43], stagger: 0.09}),
      cue.highlight(1.95, 42, {until: 3.85}),
      cue.annotate(2.1, 42, 'while an edit *waits* for you', {match: '"Waiting for you"', until: 3.85}),
      cue.scroll(3.95, [67, 79], {dur: 1.35, align: 'center'}),
      cue.focus(5.05, 68, {scroll: false, zoom: 1.05, dur: 1.6, until: 6.45}),
      cue.annotate(5.35, 68, 'unknown activity reads as *thinking*', {
        match: '"thinking"',
        side: 'below',
        offset: [-0.06, 0],
        until: 6.45,
      }),
    ],
  },
  {
    at: 6.6,
    transitionDur: 0.75,
    source: {diff: diffs['pixie-app-waiting'], hunk: 2, lines: [112, 116]},
    width: 1.22 * H,
    header: {label: 'Claude-Code-In-Motion', path: 'web/js/app.js', meta: '12c44b2 → e4ab557'},
    cues: [cue.reveal(6.72, {stagger: 0.07}), cue.diff({mark: 7.6, add: 8.0, typeCps: 95, applyAfterTyping: 0.4})],
  },
  {
    at: 11.0,
    transitionDur: 0.75,
    source: {snippet: snippets['trace-ledger'], lines: [98, 103]},
    dedent: 4,
    width: 1.3 * H,
    header: {label: 'trace', path: 'tracekit/ledger.py', meta: 'LedgerEntry.compute_hash'},
    cues: [
      cue.reveal(11.12, {stagger: 0.07}),
      cue.annotate(11.95, 102, 'every entry, *hashed*', {match: 'sha256_hex(canonical(body))', until: 12.8}),
    ],
  },
  {
    at: 13.15,
    transition: 'morph',
    transitionDur: 1.35,
    source: {snippet: snippets['trace-ledger'], lines: [222, 225]},
    dedent: 4,
    zoom: 0.86,
    width: 1.3 * H,
    header: {label: 'trace', path: 'tracekit/ledger.py', meta: 'verify_ledger'},
    cues: [
      cue.highlight(14.55, 224, {until: 16.35}),
      cue.type(14.55, 225, {cps: 64, caretHold: 0.45}),
      cue.annotate(15.25, 224, 'the verifier *recomputes* it', {match: 'recomputed', until: 16.35}),
    ],
  },
];

// A stand-in for the pin wall: hex-packed pin heads under a soft key light,
// the measured light pool, vignette and caption scrim. The film puts the real
// wall here.
const Backdrop: React.FC = () => {
  const {height: H} = useVideoConfig();
  const p = Math.round(0.0123 * H);
  const r2 = Math.round(p * Math.sqrt(3));
  const dot = (x: string, y: string) =>
    `radial-gradient(circle at ${x} ${y}, rgba(222,224,224,0.065) 0px, rgba(222,224,224,0.03) ${0.2 * p}px, rgba(222,224,224,0.01) ${0.4 * p}px, rgba(0,0,0,0.16) ${0.47 * p}px, rgba(0,0,0,0) ${0.5 * p}px)`;
  // static: one cached layer, never repainted while the code animates above it
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.deep, willChange: 'transform'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 78% 88% at 55% 44%, ${color.wall.poolCentre} 0%, #343736 30%, ${color.wall.poolEdge} 46%, #161817 74%, ${color.wall.void} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `${dot('50%', '25%')}, ${dot('0%', '75%')}, ${dot('100%', '75%')}`,
          backgroundSize: `${p}px ${r2}px`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 75% at 55% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,0) ${layout.captionScrim.fromH * 100}%, rgba(0,0,0,${layout.captionScrim.maxAlpha}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Mono kicker naming the current technique (Studio wayfinding).
const beats: Array<[number, string]> = [
  [0, 'Line by line'],
  [1.95, 'Highlight · annotation'],
  [3.95, 'Focus scroll'],
  [6.6, 'Diff · the edit lands'],
  [11.0, 'Token morph'],
  [14.55, 'Typewriter'],
];

const Kicker: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const size = typeScale.monoKicker.size * H;
  return (
    <>
      {beats.map(([at, text], i) => {
        const next = beats[i + 1]?.[0] ?? DURATION_S;
        const a = easeUi(prog(t, at + 0.1, 0.4)) * (1 - easeUi(prog(t, next - 0.25, 0.3))) * (1 - easeUi(prog(t, DURATION_S - 0.5, 0.4)));
        if (a <= 0.001) return null;
        return (
          <div
            key={text}
            style={{
              position: 'absolute',
              left: layout.marginLeftW * W,
              top: 0.072 * H,
              fontFamily: font.mono,
              fontSize: size,
              fontWeight: typeScale.monoKicker.weight,
              letterSpacing: `${typeScale.monoKicker.tracking}em`,
              textTransform: 'uppercase',
              color: color.accent.mintLabel,
              opacity: a,
              whiteSpace: 'pre',
            }}
          >
            {String(i + 1).padStart(2, '0')}
            {'  '}
            <span style={{color: color.text.secondary}}>{text}</span>
          </div>
        );
      })}
    </>
  );
};

// variant "sheet": every callout side and the wipe reveal on one page of the
// browser port of the ledger (trace live/ledger.js), for checking the engine
const sheetPages = (): CodePage[] => [
  {
    at: 0,
    source: {snippet: snippets['trace-ledger-js'], lines: [10, 24]},
    zoom: 0.8,
    header: {label: 'trace', path: 'live/ledger.js', meta: 'merkleRoot'},
    cues: [
      cue.reveal(0.2, {style: 'wipe', stagger: 0.06}),
      cue.highlight(1.3, [13, 22]),
      cue.annotate(1.5, 11, 'no leaves: the *genesis* hash', {match: 'return GENESIS', side: 'above'}),
      cue.annotate(1.6, 14, 'odd count: *repeat* the last', {match: 'level.push(level[level.length - 1])', side: 'right'}),
      cue.annotate(1.7, 19, 'each pair, *hashed*', {match: 'sha256(both)', kicker: 'line 19'}),
      cue.annotate(1.8, 23, 'the Merkle *root*', {match: 'hex(level[0])', side: 'left'}),
    ],
  },
];

const CodeDemoScene: React.FC<{variant?: 'main' | 'sheet'}> = ({variant = 'main'}) => {
  const {width: W, height: H} = useVideoConfig();
  const pages = useMemo(() => (variant === 'sheet' ? sheetPages() : makePages(H)), [H, variant]);
  return (
    <AbsoluteFill>
      <Backdrop />
      {variant === 'main' ? <Kicker /> : null}
      <CodePanel
        pages={pages}
        x={W / 2}
        y={0.445 * H}
        enter={{at: 0, dur: 0.7}}
        exit={variant === 'main' ? {at: DURATION_S - 0.5, dur: 0.45} : undefined}
      />
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {
  id: 'CodeDemo',
  component: CodeDemoScene,
  durationInFrames: Math.round(DURATION_S * FPS),
  fps: FPS,
};
