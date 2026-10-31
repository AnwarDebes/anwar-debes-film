import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout, type as typeTokens} from '../../../engine/tokens';
import {CitationChip, KineticLine, Tick, useFontsReady, type KineticLineProps} from '../../../engine/type';
import type {Word} from '../../../engine/narration/types';

// The film's shared scene kit for chapters 01, 02 and 14: easing, envelopes, the name plate and
// status chip of a place, source chips, glass cards and statements. Sizes come from frame height H
// (mono never below 0.022 H, body never below 0.026 H) and the 7 % margins.

export const clamp01 = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
export const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number) => Math.pow(clamp01(x), 3);
export const easeInOut = (x: number) => {
  const k = clamp01(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
export const ramp = (t: number, at: number, dur: number) => clamp01((t - at) / Math.max(1e-6, dur));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** In over inS from `from`, out over outS ending at `to` (focus-pull envelope, 0..1). */
export const env = (t: number, from: number, to: number, inS = 0.35, outS = 0.3) =>
  Math.min(easeOut(ramp(t, from, inS)), 1 - easeIn(ramp(t, to - outS, outS)));

/** Opacity and blur of a focus pull (identity: 8 px at 1080 while out of focus). */
export const pull = (k: number, H: number): React.CSSProperties => {
  const blur = (1 - k) * 8 * (H / 1080);
  return {opacity: k, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined};
};

export const MONO_MIN = 0.022;

export const fmtInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A word's start, shifted (s). */
export const wAt = (w: Word, lead = 0) => w.start - lead;

/** A focus-pulled layer at an absolute position. */
export const Pulled: React.FC<{t: number; from: number; to: number; inS?: number; outS?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  t,
  from,
  to,
  inS,
  outS,
  style,
  children,
}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, from, to, inS, outS);
  if (k <= 0.001) return null;
  return <div style={{position: 'absolute', ...style, ...pull(k, H)}}>{children}</div>;
};

const monoBase = (H: number, size = MONO_MIN): React.CSSProperties => ({
  fontFamily: font.mono,
  fontSize: Math.round(size * H),
  fontWeight: 500,
  lineHeight: 1.25,
  whiteSpace: 'pre',
  fontSynthesis: 'none',
  fontVariantLigatures: 'none',
});

/** Mono caps label with wide tracking (kickers, status chips). */
export const capsStyle = (H: number, size = MONO_MIN, tracking = 0.16): React.CSSProperties => ({
  ...monoBase(H, size),
  letterSpacing: `${tracking}em`,
  textTransform: 'uppercase',
});

export const legible = (H: number) => `0 0 ${Math.round(H * 0.012)}px rgba(5,8,7,0.92), 0 0 ${Math.round(H * 0.004)}px rgba(5,8,7,0.9)`;

/**
 * A place's name plate: the repository's exact GitHub name in mono, and its honest status chip
 * underneath (mono caps in an outlined pill). Top-left of the place, 8-16 % H.
 */
export const NamePlate: React.FC<{t: number; at: number; exitAt: number; name: string; status: string; x?: number; y?: number; tone?: string}> = ({
  t,
  at,
  exitAt,
  name,
  status,
  x,
  y,
  tone,
}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (!ready || k <= 0.001) return null;
  const left = Math.round(x ?? W * layout.marginLeftW);
  const top = Math.round(y ?? H * 0.082);
  const nameSize = 0.036;
  const chipSize = MONO_MIN;
  const chipK = easeOut(ramp(t, at + 0.25, 0.4));
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', left, top, ...pull(k, H)}}>
      <div
        style={{
          ...monoBase(H, nameSize),
          fontWeight: 600,
          color: color.text.key,
          letterSpacing: '-0.01em',
          textShadow: legible(H),
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: 'inline-block',
          marginTop: Math.round(H * 0.012),
          padding: `${Math.round(H * 0.006)}px ${Math.round(H * 0.012)}px`,
          borderRadius: Math.round(H * 0.022),
          border: `${hair}px solid ${tone ?? 'rgba(228,234,231,0.32)'}`,
          background: 'rgba(10,13,12,0.78)',
          opacity: chipK,
          transform: chipK < 1 ? `translateY(${((1 - chipK) * H * 0.008).toFixed(2)}px)` : undefined,
        }}
      >
        <span style={{...capsStyle(H, chipSize, 0.14), color: tone ?? color.text.chipDim}}>{status}</span>
      </div>
    </div>
  );
};

/** A citation chip (repo/path:line) at the film's mono minimum. */
export const Chip: React.FC<{t: number; at: number; exitAt?: number; x: number; y: number; align?: 'left' | 'right'; repo: string; path: string; line?: number | string; verified?: boolean}> = (
  p,
) => <CitationChip t={p.t} at={p.at} exitAt={p.exitAt} x={p.x} y={p.y} align={p.align ?? 'right'} repo={p.repo} path={p.path} line={p.line} sizeH={MONO_MIN} verified={p.verified ?? true} />;

/**
 * A typed source chip for entries that are not a file and a line: a commit, a saved API response,
 * a capture. Same look as the citation chip: typed on, then a mint tick.
 */
export const TypedChip: React.FC<{
  t: number;
  at: number;
  exitAt?: number;
  x: number;
  y: number;
  align?: 'left' | 'right';
  kind: string;
  text: string;
  verified?: boolean;
  cps?: number;
}> = ({t, at, exitAt, x, y, align = 'right', kind, text, verified = true, cps = 46}) => {
  const {height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const fs = MONO_MIN * H;
  const charW = fs * 0.6;
  const full = `${kind} · ${text}`;
  const N = full.length;
  const typed = Math.min(N, Math.floor(clamp01((t - at - 0.08) / (N / cps)) * N + 1e-6));
  const doneAt = at + 0.08 + N / cps;
  const h = Math.round(fs * 1.85);
  const padL = Math.round(fs * 0.72);
  const tickD = Math.round(fs * 0.92);
  const finalW = Math.round(padL + N * charW + (verified ? fs * 0.5 + tickD + (h - tickD) / 2 : padL));
  let alpha = easeOut(ramp(t, at, 0.14));
  if (exitAt !== undefined) {
    const k = ramp(t, exitAt, 0.3);
    if (k >= 1) return null;
    alpha *= 1 - easeIn(k);
  }
  // the pill grows with the typed text, then settles to its final width (as the citation chip)
  const typingW = Math.round(padL + typed * charW + padL);
  const settle = easeOut(ramp(t, doneAt, 0.24));
  const w = t < doneAt ? typingW : Math.round(typingW + (finalW - typingW) * settle);
  const left = Math.round(align === 'left' ? x : x - finalW);
  const top = Math.round(y - h / 2);
  const hair = Math.max(1, Math.round(H / 1080));
  const tickK = verified ? easeOut(ramp(t, doneAt + 0.06, 0.22)) : 0;
  const kindPart = full.slice(0, Math.min(typed, kind.length + 3));
  const textPart = typed > kind.length + 3 ? full.slice(kind.length + 3, typed) : '';
  return (
    <div style={{position: 'absolute', left, top, width: w, height: h, opacity: alpha}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: h / 2,
          background: 'rgba(19,19,19,0.94)',
          border: `${hair}px solid rgba(228,234,231,0.16)`,
          boxShadow: `0 ${Math.round(fs * 0.25)}px ${Math.round(fs * 0.9)}px rgba(0,0,0,0.35)`,
        }}
      />
      <span style={{...monoBase(H), position: 'absolute', left: padL, top: Math.round((h - fs * 1.25) / 2)}}>
        <span style={{color: color.text.tertiary}}>{kindPart}</span>
        <span style={{color: color.text.display}}>{textPart}</span>
      </span>
      {tickK > 0 ? (
        <div style={{position: 'absolute', right: Math.round((h - tickD) / 2), top: Math.round((h - tickD) / 2), width: tickD, height: tickD, opacity: tickK}}>
          <Tick size={tickD} draw={easeOut(ramp(t, doneAt + 0.14, 0.24))} />
        </div>
      ) : null}
    </div>
  );
};

/** Right-column chip slots: right edge at 96 % W, stacked up from 0.70 H (clear of the captions). */
export const chipSlot = (W: number, H: number, k: number): {x: number; y: number} => ({x: Math.round(W * 0.962), y: Math.round(H * (0.705 - 0.052 * k))});

/** A dark glass card with a mint mono label (film-native, legible sizes). */
export const Card: React.FC<{
  t: number;
  at: number;
  exitAt: number;
  x: number;
  y: number;
  w?: number;
  label?: string;
  labelTone?: string;
  children?: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}> = ({t, at, exitAt, x, y, w, label, labelTone, children, pad, style}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.45, 0.35);
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  const p = Math.round(pad ?? H * 0.024);
  const rise = (1 - easeOut(ramp(t, at, 0.5))) * H * 0.014;
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: w === undefined ? undefined : Math.round(w),
        boxSizing: 'border-box',
        padding: p,
        borderRadius: Math.round(H * 0.017),
        background: color.card.glass,
        border: `${hair}px solid ${color.card.rule}`,
        boxShadow: `0 ${Math.round(H * 0.018)}px ${Math.round(H * 0.06)}px rgba(0,0,0,0.45)`,
        opacity: k,
        transform: rise > 0.05 ? `translateY(${rise.toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {label ? <div style={{...capsStyle(H, MONO_MIN, 0.14), color: labelTone ?? color.accent.mint, marginBottom: Math.round(p * 0.6)}}>{label}</div> : null}
      {children}
    </div>
  );
};

/** Body text inside cards (Schibsted, never below 0.026 H). */
export const bodyStyle = (H: number, size = 0.03, weight = 500, c: string = color.text.display): React.CSSProperties => ({
  fontFamily: font.sans,
  fontSize: Math.round(size * H),
  fontWeight: weight,
  lineHeight: 1.22,
  letterSpacing: '-0.012em',
  color: c,
  fontSynthesis: 'none',
});

export const monoStyle = (H: number, size = MONO_MIN, c: string = color.text.display, weight = 500): React.CSSProperties => ({
  ...monoBase(H, size),
  color: c,
  fontWeight: weight,
});

/** The idea word: STIX Two Text italic in mint, set x1.13. */
export const Em: React.FC<{children: React.ReactNode; scale?: number}> = ({children, scale = font.emScale}) => (
  <span style={{fontFamily: font.serif, fontStyle: 'italic', fontWeight: 400, fontSize: `${scale}em`, color: color.accent.mint, letterSpacing: '-0.01em'}}>{children}</span>
);

/** The XOR operator, drawn (no film face carries U+2295). */
export const Oplus: React.FC<{size: number; c?: string}> = ({size, c = color.text.secondary}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{display: 'inline-block', verticalAlign: '-0.12em', margin: `0 ${(size * 0.22).toFixed(1)}px`}}>
    <circle cx="10" cy="10" r="8.2" fill="none" stroke={c} strokeWidth="1.7" />
    <path d="M10 2.6 V17.4 M2.6 10 H17.4" stroke={c} strokeWidth="1.7" />
  </svg>
);

/** A left-half statement from spoken words (the utterance is skipped from the bottom captions). */
export const Statement: React.FC<{t: number; words: readonly Word[]; exitAt: number; y?: number; kind?: KineticLineProps['kind']; sizeH?: number; maxWidthW?: number; x?: number}> = ({
  t,
  words,
  exitAt,
  y,
  kind = 'statement',
  sizeH,
  maxWidthW = 0.46,
  x,
}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <KineticLine
      words={words}
      t={t}
      kind={kind}
      sizeH={sizeH}
      variant="rise"
      x={x ?? Math.round(W * layout.marginLeftW)}
      y={Math.round(y ?? H * 0.36)}
      yAnchor="capTop"
      maxWidth={maxWidthW * W}
      exitAt={exitAt}
      underline
    />
  );
};

/** The calm miss glyph: a hollow pin at the type size, neutral tone (no red, no buzz). */
export const MissGlyph: React.FC<{size: number; c?: string}> = ({size, c = color.text.secondary}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{display: 'inline-block', verticalAlign: '-0.1em'}}>
    <circle cx="10" cy="10" r="7.4" fill="none" stroke={c} strokeWidth="2" />
  </svg>
);

/** A filled pin glyph (a verdict that holds), mint. */
export const HoldGlyph: React.FC<{size: number; c?: string}> = ({size, c = color.accent.mint}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{display: 'inline-block', verticalAlign: '-0.1em'}}>
    <circle cx="10" cy="10" r="7.4" fill={c} />
  </svg>
);
