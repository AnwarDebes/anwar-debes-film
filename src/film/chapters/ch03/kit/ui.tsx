import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout, motion, type as T} from '../../../../engine/tokens';
import {CitationChip, easeOutCubic, prog, useFontsReady} from '../../../../engine/type';
import type {Word} from '../../../../engine/narration/types';

// Small HTML building blocks shared by chapters 03-05. Sizes are fractions of the frame height.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeText = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** 0 before `inAt`, 1 after the entry, back to 0 over the exit. */
export const env = (t: number, inAt: number, inS = 0.35, outAt?: number, outS = 0.3): number => {
  const a = easeText(prog(t, inAt, inS));
  if (outAt === undefined) return a;
  return Math.min(a, 1 - easeText(prog(t, outAt, outS)));
};

/** The film's blur-and-fade focus pull as CSS. */
export const pullStyle = (k: number, H: number): React.CSSProperties => {
  const blur = (1 - k) * motion.textFocusPull.blurAt1080 * (H / 1080);
  return {opacity: k, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined};
};

export const useFrameSize = () => {
  const {width, height} = useVideoConfig();
  return {W: width, H: height};
};

/** Mono kicker line (caps, tracked). */
export const MonoKicker: React.FC<{text: string; x: number; y: number; k: number; tone?: string; size?: number; align?: 'left' | 'right'}> = ({text, x, y, k, tone = color.accent.mintLabel, size = T.monoKicker.size, align = 'left'}) => {
  const {W, H} = useFrameSize();
  if (k <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        ...(align === 'left' ? {left: x} : {right: W - x}),
        top: y,
        fontFamily: font.mono,
        fontSize: Math.round(size * H),
        fontWeight: 500,
        letterSpacing: `${T.monoKicker.tracking}em`,
        textTransform: 'uppercase',
        color: tone,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...pullStyle(k, H),
      }}
    >
      {text}
    </div>
  );
};

/** The place's name plate (exact GitHub spelling, never upper-cased) and its honest status chip. */
export const NamePlate: React.FC<{t: number; at: number; exitAt?: number; name: string; status: string; x?: number; y?: number}> = ({t, at, exitAt, name, status, x, y}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  const k1 = env(t, at, 0.4, exitAt);
  const k2 = env(t, at + 0.25, 0.4, exitAt);
  if (!ready || (k1 <= 0 && k2 <= 0)) return null;
  const left = x ?? Math.round(layout.marginLeftW * W);
  const top = y ?? Math.round(0.072 * H);
  const nameSize = Math.round(0.046 * H);
  const chipSize = Math.round(0.022 * H);
  const dot = Math.round(0.014 * H);
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', left, top}}>
      <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.014 * H), ...pullStyle(k1, H)}}>
        <span style={{width: dot, height: dot, borderRadius: '50%', background: color.accent.mint, boxShadow: `0 0 ${Math.round(0.016 * H)}px ${color.accent.mintGlow}`}} />
        <span style={{fontFamily: font.mono, fontSize: nameSize, fontWeight: 600, color: color.text.display, letterSpacing: '-0.01em', lineHeight: 1.1}}>{name}</span>
      </div>
      <div
        style={{
          display: 'inline-block',
          marginTop: Math.round(0.016 * H),
          padding: `${Math.round(chipSize * 0.42)}px ${Math.round(chipSize * 0.8)}px`,
          borderRadius: 999,
          border: `${hair}px solid ${color.card.ruleStrong}`,
          background: 'rgba(10,14,13,0.72)',
          fontFamily: font.mono,
          fontSize: chipSize,
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: color.text.chipDim,
          whiteSpace: 'nowrap',
          lineHeight: 1.15,
          ...pullStyle(k2, H),
        }}
      >
        {status}
      </div>
    </div>
  );
};

/** A citation chip at the film's legible minimum size. */
export const Chip: React.FC<{t: number; at: number; exitAt?: number; repo: string; path: string; line?: number | string; x: number; y: number; align?: 'left' | 'right'; leader?: number}> = ({t, at, exitAt, repo, path, line, x, y, align = 'left', leader}) => {
  const {H} = useFrameSize();
  const k = exitAt === undefined ? 1 : 1 - easeText(prog(t, exitAt, 0.35));
  if (t < at || k <= 0) return null;
  return <CitationChip repo={repo} path={path} line={line} at={at} t={t} x={x} y={y} align={align} sizeH={0.022} leader={leader ?? Math.round(0.0 * H)} opacity={k} />;
};

export interface HeadWord {
  text: string;
  start: number;
  /** STIX italic idea word */
  em?: boolean;
}

/** Words from an utterance (keeps their spoken times; em-tagged words stay em). */
export const wordsOf = (words: readonly Word[]): HeadWord[] => words.map((w) => ({text: w.text, start: w.start, em: w.tag === 'em'}));

/**
 * A headline whose words arrive as they are spoken (each 40 ms early, de-blurring over 0.25 s).
 * Unlike KineticLine, the idea word can take any colour (the verdict red of 03.4).
 */
export const Headline: React.FC<{
  t: number;
  words: HeadWord[];
  x: number;
  /** baseline */
  y: number;
  sizeH?: number;
  weight?: number;
  color?: string;
  emColor?: string;
  exitAt?: number;
  align?: 'left' | 'center';
  tracking?: number;
}> = ({t, words, x, y, sizeH = T.headline.size, weight = 650, color: plain = color.text.display, emColor = color.accent.mint, exitAt, align = 'left', tracking = T.headline.tracking}) => {
  const {W, H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const size = sizeH * H;
  const out = exitAt === undefined ? 1 : 1 - easeText(prog(t, exitAt, 0.3));
  if (out <= 0 || t < words[0].start - 0.1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'left' ? x : 0,
        width: align === 'center' ? W : undefined,
        textAlign: align,
        top: y - size * 0.9,
        whiteSpace: 'nowrap',
        fontFamily: font.sans,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: `${tracking}em`,
        lineHeight: 1.1,
        color: plain,
        opacity: out,
        textShadow: `0 0 ${Math.round(0.03 * H)}px rgba(0,0,0,0.55)`,
      }}
    >
      {words.map((w, i) => {
        const k = easeOutCubic(prog(t, w.start - 0.04, 0.25));
        const blur = (1 - k) * 6 * (H / 1080);
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: 'inline-block',
                opacity: k,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                ...(w.em
                  ? {fontFamily: font.serif, fontStyle: 'italic', fontWeight: 400, fontSize: size * font.emScale, color: emColor, letterSpacing: '-0.01em'}
                  : {}),
              }}
            >
              {w.text}
            </span>
            {i < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** A dark pill with mono text: a claim set natively next to its subject. */
export const Pill: React.FC<{k: number; x: number; y: number; children: React.ReactNode; align?: 'left' | 'right' | 'center'; sizeH?: number; tone?: string; border?: string; bg?: string}> = ({k, x, y, children, align = 'left', sizeH = 0.024, tone = color.text.caption, border = color.card.ruleStrong, bg = 'rgba(9,13,12,0.86)'}) => {
  const {W, H} = useFrameSize();
  if (k <= 0.001) return null;
  const fs = Math.round(sizeH * H);
  const hair = Math.max(1, Math.round(H / 1080));
  const tx = align === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)';
  return (
    <div
      style={{
        position: 'absolute',
        ...(align === 'right' ? {right: W - x} : {left: x}),
        top: y,
        transform: align === 'right' ? 'translate(0, -50%)' : tx,
        padding: `${Math.round(fs * 0.5)}px ${Math.round(fs * 0.85)}px`,
        borderRadius: 999,
        border: `${hair}px solid ${border}`,
        background: bg,
        fontFamily: font.mono,
        fontSize: fs,
        fontWeight: 500,
        color: tone,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...pullStyle(k, H),
      }}
    >
      {children}
    </div>
  );
};

export const mint = (s: React.ReactNode) => <span style={{color: color.accent.mint}}>{s}</span>;
export const dim = (s: React.ReactNode) => <span style={{color: color.text.secondary}}>{s}</span>;
export const white = (s: React.ReactNode) => <span style={{color: color.text.key, fontWeight: 600}}>{s}</span>;
export const italic = (s: React.ReactNode, c: string = color.accent.mint) => (
  <span style={{fontFamily: font.serif, fontStyle: 'italic', color: c, fontSize: '1.13em', letterSpacing: '-0.01em'}}>{s}</span>
);
