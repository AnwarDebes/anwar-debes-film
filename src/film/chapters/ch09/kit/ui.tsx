import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, type as typeTokens} from '../../../../engine/tokens';
import {blurFilter, clamp01, easeInCubic, easeOutCubic, easeUI, prog} from '../../../../engine/type';
import {projectToScreen, rigPoseAt, type CameraKey, type CameraPose} from '../../../../engine/camera';

// The chapter's HTML layer kit: name plates, the 66-pin rule line, wall-anchored labels, calm
// misses, terminal cards. Everything is a pure function of film time t and is sized from H.

export const mint = color.accent.mint;
export const MONO = font.mono;
export const SANS = font.sans;
export const SERIF = font.serif;

/** 0 -> 1 -> 0 envelope: in over inS from `at`, out over outS from `exitAt`. */
export const fade = (t: number, at: number, exitAt?: number, inS = 0.35, outS = 0.3): number => {
  const a = easeOutCubic(prog(t, at, inS));
  if (exitAt === undefined) return a;
  return Math.min(a, 1 - easeInCubic(prog(t, exitAt, outS)));
};

/** Focus pull: blur radius (px) while a layer comes in and goes out. */
export const pullBlur = (t: number, at: number, exitAt: number | undefined, H: number, inS = 0.35, outS = 0.3) => {
  const a = 1 - easeOutCubic(prog(t, at, inS));
  const b = exitAt === undefined ? 0 : easeInCubic(prog(t, exitAt, outS));
  return Math.max(a, b) * 8 * (H / 1080);
};

export const useWH = () => {
  const {width, height} = useVideoConfig();
  return {W: width, H: height};
};

// ---------------------------------------------------------------- name plate + status chip

export interface PlateProps {
  t: number;
  name: string;
  status: string;
  at: number;
  exitAt?: number;
  /** px left edge (default the 7% margin) */
  x?: number;
  /** fraction of H for the name baseline (default 0.112) */
  y?: number;
}

/** A place's name plate (exact GitHub spelling, mono) and its honest status chip (mono caps). */
export const Plate: React.FC<PlateProps> = ({t, name, status, at, exitAt, x, y = 0.112}) => {
  const {W, H} = useWH();
  if (t < at - 0.01) return null;
  const k = fade(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  const left = Math.round(x ?? 0.069 * W);
  const nameSize = Math.round(0.036 * H);
  const chipSize = Math.round(0.0215 * H);
  const blur = pullBlur(t, at, exitAt, H, 0.4, 0.35);
  const statusK = fade(t, at + 0.22, exitAt, 0.4, 0.35);
  const dot = Math.round(0.0105 * H);
  const lit = easeOutCubic(prog(t, at + 0.1, 0.5));
  return (
    <div style={{position: 'absolute', left, top: Math.round(y * H - nameSize * 0.98), pointerEvents: 'none'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H), opacity: k, filter: blurFilter(blur)}}>
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: dot,
            background: `radial-gradient(circle at 38% 34%, #E9FFF7 0%, ${mint} 45%, #2E6B58 100%)`,
            boxShadow: `0 0 ${Math.round(dot * 1.6 * lit)}px rgba(116,201,174,${(0.55 * lit).toFixed(3)})`,
            opacity: 0.35 + 0.65 * lit,
          }}
        />
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: nameSize, color: color.text.display, letterSpacing: '-0.01em', whiteSpace: 'pre', lineHeight: 1.2}}>{name}</div>
      </div>
      <div style={{marginTop: Math.round(0.012 * H), marginLeft: dot + Math.round(0.012 * H), opacity: statusK, filter: blurFilter(pullBlur(t, at + 0.22, exitAt, H, 0.4, 0.35))}}>
        <span
          style={{
            display: 'inline-block',
            padding: `${Math.round(chipSize * 0.42)}px ${Math.round(chipSize * 0.8)}px`,
            borderRadius: 999,
            background: 'rgba(17,20,19,0.9)',
            border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.16)`,
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: chipSize,
            letterSpacing: '0.1em',
            color: color.text.chipDim,
            whiteSpace: 'pre',
            lineHeight: 1.2,
          }}
        >
          {status}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- the rule line (66 pins)

export const RULE_TOTAL = 66;

export interface RuleLineProps {
  t: number;
  /** pins already lit when the chapter starts */
  before: number;
  /** film time each of this chapter's pins lights, in order */
  arrivals: readonly number[];
  /** windows where the line steps aside (dense code panels) */
  hidden?: ReadonlyArray<readonly [number, number]>;
  from: number;
  to: number;
}

/**
 * 66 small steel pins along the bottom edge (97% H, 15-95% W). A pin lights mint when its
 * repository's name plate first appears; the numerals are never shown here.
 */
export const RuleLine: React.FC<RuleLineProps> = ({t, before, arrivals, hidden = [], from, to}) => {
  const {W, H} = useWH();
  let vis = Math.min(1, prog(t, from, 0.6)) * (1 - prog(t, to - 0.6, 0.6));
  for (const [a, b] of hidden) vis *= 1 - Math.min(easeUI(prog(t, a - 0.35, 0.35)), 1 - easeUI(prog(t, b, 0.45)));
  if (vis <= 0.002) return null;
  const y = Math.round(0.97 * H);
  const x0 = 0.15 * W;
  const x1 = 0.95 * W;
  const d = Math.max(5, Math.round(0.0094 * H));
  const items: React.ReactNode[] = [];
  for (let k = 0; k < RULE_TOTAL; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / (RULE_TOTAL - 1));
    let lit = 0;
    let flash = 0;
    if (k < before) lit = 1;
    else {
      const j = k - before;
      if (j < arrivals.length && t >= arrivals[j]) {
        const e = t - arrivals[j];
        lit = easeOutCubic(clamp01(e / 0.35));
        flash = Math.exp(-e / 0.5) * clamp01(e / 0.08);
      }
    }
    const glow = Math.round(d * (0.9 + 2.6 * flash));
    items.push(
      <div
        key={k}
        style={{
          position: 'absolute',
          left: x - d / 2,
          top: y - d / 2,
          width: d,
          height: d,
          borderRadius: d,
          background:
            lit > 0.001
              ? `radial-gradient(circle at 38% 34%, rgba(233,255,247,${lit}) 0%, rgba(116,201,174,${0.35 + 0.65 * lit}) 46%, rgba(30,74,60,${0.6 + 0.4 * lit}) 100%)`
              : 'radial-gradient(circle at 38% 34%, #A8AEAC 0%, #5E6462 45%, #262A29 100%)',
          boxShadow: lit > 0.001 ? `0 0 ${glow}px rgba(116,201,174,${(0.35 * lit + 0.45 * flash).toFixed(3)})` : '0 1px 2px rgba(0,0,0,0.6)',
        }}
      />,
    );
  }
  return <div style={{position: 'absolute', inset: 0, opacity: vis, pointerEvents: 'none'}}>{items}</div>;
};

// ---------------------------------------------------------------- labels anchored to the wall

/** Screen position of a world point under the chapter camera at time t. */
export const screenOf = (keys: readonly CameraKey[], t: number, p: [number, number, number], W: number, H: number, scratch?: CameraPose): [number, number] => {
  const pose = rigPoseAt(keys, t, undefined, scratch);
  const [x, y] = projectToScreen(pose, p, W, H);
  return [x, y];
};

export interface TagProps {
  x: number;
  y: number;
  text: string;
  sizeH?: number;
  colorText?: string;
  align?: 'left' | 'center' | 'right';
  /** vertical anchor: the text's middle (default), its top or bottom */
  anchor?: 'middle' | 'top' | 'bottom';
  opacity?: number;
  weight?: number;
  family?: string;
  blur?: number;
  bg?: boolean;
  strike?: number;
  tracking?: number;
  italic?: boolean;
}

/** A short mono label at a screen point, optionally on a dark pill. */
export const Tag: React.FC<TagProps> = ({
  x,
  y,
  text,
  sizeH = 0.023,
  colorText = color.text.display,
  align = 'center',
  anchor = 'middle',
  opacity = 1,
  weight = 500,
  family = MONO,
  blur = 0,
  bg = false,
  strike = 0,
  tracking = 0,
  italic = false,
}) => {
  const {H} = useWH();
  if (opacity <= 0.002) return null;
  const fs = Math.round(sizeH * H);
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  const ty = anchor === 'middle' ? '-50%' : anchor === 'bottom' ? '-100%' : '0';
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        transform: `translate(${tx}, ${ty})`,
        opacity,
        filter: blurFilter(blur),
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          fontFamily: family,
          fontWeight: weight,
          fontStyle: italic ? 'italic' : 'normal',
          fontSize: fs,
          letterSpacing: tracking ? `${tracking}em` : undefined,
          color: colorText,
          whiteSpace: 'pre',
          lineHeight: 1.25,
          padding: bg ? `${Math.round(fs * 0.3)}px ${Math.round(fs * 0.6)}px` : undefined,
          borderRadius: bg ? 999 : undefined,
          background: bg ? 'rgba(14,17,16,0.86)' : undefined,
          border: bg ? `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.14)` : undefined,
          textShadow: bg ? undefined : '0 1px 3px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.55)',
        }}
      >
        {text}
        {strike > 0 ? (
          <span
            style={{
              position: 'absolute',
              left: bg ? Math.round(fs * 0.45) : -Math.round(fs * 0.1),
              top: '52%',
              height: Math.max(2, Math.round(fs * 0.09)),
              width: `calc(${(strike * 100).toFixed(2)}% - ${bg ? Math.round(fs * 0.9) * strike : 0}px)`,
              background: color.pixie.bodyHi,
              borderRadius: 2,
            }}
          />
        ) : null}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------- calm misses and wins

/** The calm miss glyph: a hollow pin, same size as a win, neutral tone. */
export const PinGlyph: React.FC<{size: number; kind: 'win' | 'miss' | 'steel'; style?: React.CSSProperties}> = ({size, kind, style}) => {
  const ring = Math.max(2, Math.round(size * 0.16));
  if (kind === 'miss')
    return <span style={{display: 'inline-block', flexShrink: 0, width: size, height: size, borderRadius: size, boxSizing: 'border-box', border: `${ring}px solid #8E9391`, ...style}} />;
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: size,
        background:
          kind === 'win'
            ? `radial-gradient(circle at 38% 34%, #E9FFF7 0%, ${mint} 46%, #1E4A3C 100%)`
            : 'radial-gradient(circle at 38% 34%, #EEF1F0 0%, #A3A9A7 52%, #5A605E 100%)',
        boxShadow: kind === 'win' ? `0 0 ${Math.round(size * 0.8)}px rgba(116,201,174,0.45)` : undefined,
        ...style,
      }}
    />
  );
};

export interface RowProps {
  t: number;
  at: number;
  exitAt?: number;
  kind: 'win' | 'miss' | 'steel';
  children: React.ReactNode;
  sizeH?: number;
}

/** One row of a numbers card: glyph + text, rising in. */
export const Row: React.FC<RowProps> = ({t, at, exitAt, kind, children, sizeH = 0.028}) => {
  const {H} = useWH();
  const k = fade(t, at, exitAt, 0.4, 0.3);
  if (k <= 0.002) return null;
  const fs = Math.round(sizeH * H);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(fs * 0.6),
        opacity: k,
        transform: `translateY(${((1 - easeUI(prog(t, at, 0.5))) * 0.012 * H).toFixed(2)}px)`,
        filter: blurFilter(pullBlur(t, at, exitAt, H, 0.4, 0.3)),
        fontFamily: MONO,
        fontSize: fs,
        color: kind === 'miss' ? '#B9BDBB' : color.text.display,
        whiteSpace: 'pre',
        lineHeight: 1.35,
      }}
    >
      <PinGlyph size={Math.round(fs * 0.72)} kind={kind} />
      <span>{children}</span>
    </div>
  );
};

// ---------------------------------------------------------------- cards

export const cardStyle = (H: number): React.CSSProperties => ({
  position: 'absolute',
  boxSizing: 'border-box',
  borderRadius: Math.round(0.017 * H),
  background: color.card.glass,
  border: `${Math.max(1, Math.round(H / 1080))}px solid ${color.card.rule}`,
  boxShadow: `0 ${Math.round(0.018 * H)}px ${Math.round(0.06 * H)}px rgba(0,0,0,0.45)`,
  padding: Math.round(0.024 * H),
});

export const kickerStyle = (H: number, tone: string = color.accent.mintLabel): React.CSSProperties => ({
  fontFamily: MONO,
  fontWeight: 500,
  fontSize: Math.round(typeTokens.monoKicker.size * H),
  letterSpacing: `${typeTokens.monoKicker.tracking}em`,
  textTransform: 'uppercase',
  color: tone,
  whiteSpace: 'pre',
});

export interface CardProps {
  t: number;
  at: number;
  exitAt?: number;
  x: number;
  y: number;
  width?: number;
  kicker?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** A glass card that rises and focus-pulls in, fades out. x, y: top-left px. */
export const Card: React.FC<CardProps> = ({t, at, exitAt, x, y, width, kicker, children, style}) => {
  const {H} = useWH();
  if (t < at) return null;
  const k = fade(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.002) return null;
  const rise = (1 - easeUI(prog(t, at, 0.55))) * 0.016 * H;
  // a mono caps kicker never wraps: the card is at least as wide as its kicker (0.8 em per character)
  const kickerW = kicker ? kicker.length * 0.0162 * H + 2 * Math.round(0.024 * H) + Math.round(0.006 * H) : 0;
  const w = width === undefined ? undefined : Math.round(Math.max(width, kickerW));
  return (
    <div style={{...cardStyle(H), left: Math.round(x), top: Math.round(y), width: w, opacity: k, transform: `translateY(${rise.toFixed(2)}px)`, ...style}}>
      {kicker ? <div style={{...kickerStyle(H), fontSize: Math.round(0.02 * H), marginBottom: Math.round(0.014 * H)}}>{kicker}</div> : null}
      {children}
    </div>
  );
};

// ---------------------------------------------------------------- terminal

export interface TermLine {
  /** time the line starts typing (prompt lines) or appears (output) */
  at: number;
  text: string;
  kind: 'cmd' | 'out' | 'note';
  /** characters per second for commands */
  cps?: number;
}

export interface TerminalProps {
  t: number;
  at: number;
  exitAt?: number;
  x: number;
  y: number;
  width: number;
  title: string;
  lines: readonly TermLine[];
  sizeH?: number;
}

/** A terminal card: title bar (with the commit and the date), typed commands, printed output. */
export const Terminal: React.FC<TerminalProps> = ({t, at, exitAt, x, y, width, title, lines, sizeH = 0.023}) => {
  const {H} = useWH();
  if (t < at) return null;
  const k = fade(t, at, exitAt, 0.35, 0.35);
  if (k <= 0.002) return null;
  const fs = Math.round(sizeH * H);
  const bar = Math.round(fs * 2.1);
  const rise = (1 - easeUI(prog(t, at, 0.55))) * 0.016 * H;
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (t < L.at) break;
    let text = L.text;
    let caret = false;
    if (L.kind === 'cmd') {
      const n = Math.floor((t - L.at) * (L.cps ?? 38));
      caret = n < L.text.length || (i === lines.length - 1 || t < lines[i + 1].at);
      text = L.text.slice(0, Math.max(0, n));
    }
    const blink = caret && Math.floor((t - L.at) * 2.2) % 2 === 0;
    rows.push(
      <div key={i} style={{whiteSpace: 'pre', color: L.kind === 'cmd' ? color.text.display : L.kind === 'note' ? color.text.tertiary : '#CFE9DF', minHeight: Math.round(fs * 1.5)}}>
        {L.kind === 'cmd' ? <span style={{color: mint}}>{'› '}</span> : null}
        {text}
        {caret ? <span style={{display: 'inline-block', width: Math.round(fs * 0.55), height: Math.round(fs * 1.05), marginLeft: 2, verticalAlign: 'text-bottom', background: mint, opacity: blink ? 0.9 : 0.25}} /> : null}
      </div>,
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        borderRadius: Math.round(0.014 * H),
        background: '#070B0A',
        border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.16)`,
        boxShadow: `0 ${Math.round(0.02 * H)}px ${Math.round(0.07 * H)}px rgba(0,0,0,0.55)`,
        overflow: 'hidden',
        opacity: k,
        transform: `translateY(${rise.toFixed(2)}px)`,
      }}
    >
      <div style={{height: bar, display: 'flex', alignItems: 'center', gap: Math.round(fs * 0.5), padding: `0 ${Math.round(fs * 0.8)}px`, background: '#0C1613', borderBottom: '1px solid rgba(228,234,231,0.1)'}}>
        {[0, 1, 2].map((j) => (
          <span key={j} style={{width: Math.round(fs * 0.5), height: Math.round(fs * 0.5), borderRadius: fs, background: j === 0 ? mint : 'rgba(228,234,231,0.22)'}} />
        ))}
        <span style={{marginLeft: Math.round(fs * 0.6), fontFamily: MONO, fontSize: Math.round(fs * 0.86), color: color.text.chipDim, whiteSpace: 'pre'}}>{title}</span>
      </div>
      <div style={{padding: `${Math.round(fs * 0.8)}px ${Math.round(fs * 1.0)}px`, fontFamily: MONO, fontSize: fs, lineHeight: 1.5}}>{rows}</div>
    </div>
  );
};

// ---------------------------------------------------------------- a quiet verdict

export interface QuietStampProps {
  t: number;
  text: string;
  at: number;
  exitAt?: number;
  /** px centre */
  x: number;
  y: number;
  tone?: string;
  sizeH?: number;
  rotate?: number;
}

/**
 * A stamp in the calm style: outlined, neutral grey, set at -3 degrees, landing from 1.4x in
 * 0.35 s. Keeps the text's own case (a lowercase p stays a p).
 */
export const QuietStamp: React.FC<QuietStampProps> = ({t, text, at, exitAt, x, y, tone = color.text.chipDim, sizeH = 0.025, rotate = -3}) => {
  const {H} = useWH();
  if (t < at - 0.35) return null;
  const k = easeInCubic(clamp01((t - (at - 0.35)) / 0.35));
  const out = exitAt === undefined ? 0 : prog(t, exitAt, 0.3);
  if (out >= 1) return null;
  const fs = Math.round(sizeH * H);
  const scale = 1.4 - 0.4 * k;
  const hair = Math.max(2, Math.round(H / 540));
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale.toFixed(4)})`,
        opacity: k * (1 - easeInCubic(out)),
        padding: `${Math.round(fs * 0.45)}px ${Math.round(fs * 0.8)}px`,
        border: `${hair}px solid ${tone}`,
        borderRadius: Math.round(fs * 0.35),
        fontFamily: MONO,
        fontWeight: 600,
        fontSize: fs,
        letterSpacing: '0.06em',
        color: tone,
        whiteSpace: 'pre',
        background: 'rgba(10,13,12,0.55)',
      }}
    >
      {text}
    </div>
  );
};
