import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout, motion, type as T} from '../../../../engine/tokens';
import {CitationChip} from '../../../../engine/type';
import {blurFilter, easeInCubic, easeOutCubic, easeText, prog} from '../../../../engine/type/ease';

// The small typographic parts both chapters share: name plates, status chips, the disclaimer,
// citation chips in the right column, fact rows. Everything is sized from the frame height and is
// a pure function of film time t.

/** Focus-pull envelope: 0 before `at`, 1 once in, back to 0 over the exit. */
export const pullK = (t: number, at: number, out?: number, inS: number = motion.textFocusPull.inS, outS: number = motion.textFocusPull.outS) => {
  const a = easeText(prog(t, at, inS));
  const b = out === undefined ? 1 : 1 - easeInCubic(prog(t, out, outS));
  return Math.max(0, Math.min(a, b));
};

export const pullStyle = (k: number, H: number, blurAt1080: number = motion.textFocusPull.blurAt1080): React.CSSProperties => ({
  opacity: k,
  filter: blurFilter((1 - k) * blurAt1080 * (H / 1080)),
});

export const mono = (H: number, sizeH: number = T.monoChip.size, weight = 500): React.CSSProperties => ({
  fontFamily: font.mono,
  fontSize: Math.round(sizeH * H),
  fontWeight: weight,
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"calt" 0, "liga" 0',
});

export const sans = (H: number, sizeH: number, weight = 500): React.CSSProperties => ({
  fontFamily: font.sans,
  fontSize: Math.round(sizeH * H),
  fontWeight: weight,
  letterSpacing: '-0.015em',
  whiteSpace: 'pre',
  fontSynthesis: 'none',
});

export const Em: React.FC<{children: React.ReactNode; H: number; sizeH: number}> = ({children, H, sizeH}) => (
  <span
    style={{
      fontFamily: font.serif,
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: Math.round(sizeH * H * font.emScale),
      color: color.accent.mint,
      textShadow: `0 0 ${Math.round(0.012 * H)}px rgba(116,201,174,0.3)`,
      letterSpacing: '-0.01em',
    }}
  >
    {children}
  </span>
);

export const Abs: React.FC<{x: number; y: number; style?: React.CSSProperties; children?: React.ReactNode; align?: 'left' | 'right' | 'center'}> = ({
  x,
  y,
  style,
  children,
  align = 'left',
}) => (
  <div
    style={{
      position: 'absolute',
      left: Math.round(x),
      top: Math.round(y),
      transform: align === 'right' ? 'translateX(-100%)' : align === 'center' ? 'translateX(-50%)' : undefined,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A dark pill with a 1 px rule, mono caps: the honest status of a repository. */
export const Pill: React.FC<{text: string; H: number; tone?: string; sizeH?: number; caps?: boolean; dot?: string}> = ({
  text,
  H,
  tone = color.text.chipDim,
  sizeH = T.monoKicker.size,
  caps = true,
  dot,
}) => {
  const fs = Math.round(sizeH * H);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(fs * 0.55),
        padding: `${Math.round(fs * 0.42)}px ${Math.round(fs * 0.8)}px`,
        borderRadius: 999,
        background: 'rgba(19,19,19,0.9)',
        border: `1px solid ${color.card.rule}`,
        ...mono(H, sizeH, 500),
        letterSpacing: caps ? '0.12em' : '0',
        textTransform: caps ? 'uppercase' : undefined,
        color: tone,
        boxShadow: `0 ${Math.round(fs * 0.2)}px ${Math.round(fs * 0.8)}px rgba(0,0,0,0.3)`,
      }}
    >
      {dot ? <span style={{width: Math.round(fs * 0.42), height: Math.round(fs * 0.42), borderRadius: 99, background: dot, boxShadow: `0 0 ${Math.round(fs * 0.5)}px ${dot}`}} /> : null}
      {text}
    </span>
  );
};

/**
 * Name plate (the exact GitHub name, never upper-cased) and its status chip, top-left of the place
 * (8-16% H). Extra chips sit beside the status chip.
 */
export const NamePlate: React.FC<{
  t: number;
  at: number;
  out?: number;
  repo: string;
  status: string;
  extra?: Array<{text: string; at: number; out?: number; tone?: string}>;
  x?: number;
  y?: number;
}> = ({t, at, out, repo, status, extra = [], x, y}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pullK(t, at, out);
  if (k <= 0) return null;
  const left = x ?? W * layout.marginLeftW;
  const top = y ?? H * 0.078;
  const ks = pullK(t, at + 0.22, out);
  return (
    <div style={{position: 'absolute', left: Math.round(left), top: Math.round(top), ...pullStyle(k, H)}}>
      <div style={{display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H)}}>
        <span style={{width: Math.round(0.011 * H), height: Math.round(0.011 * H), borderRadius: 99, background: color.accent.mint, boxShadow: `0 0 ${Math.round(0.014 * H)}px ${color.accent.mintGlow}`}} />
        <span style={{...mono(H, 0.04, 600), color: color.text.display, letterSpacing: '-0.01em'}}>{repo}</span>
      </div>
      <div style={{display: 'flex', gap: Math.round(0.01 * H), marginTop: Math.round(0.014 * H), opacity: ks, flexWrap: 'nowrap'}}>
        <Pill text={status} H={H} />
      </div>
      {extra.length ? (
        <div style={{display: 'flex', gap: Math.round(0.01 * H), marginTop: Math.round(0.011 * H), flexWrap: 'nowrap'}}>
          {extra.map((e) => {
            const ke = pullK(t, e.at, e.out ?? out);
            return ke > 0 ? (
              <span key={e.text} style={{opacity: ke}}>
                <Pill text={e.text} H={H} tone={e.tone ?? color.text.secondary} caps={false} />
              </span>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
};

/** Approximate width of a pill (mono advance 0.6 em, plus tracking for caps), px. */
export const pillWidth = (text: string, H: number, caps = true, sizeH: number = T.monoKicker.size) => {
  const fs = Math.round(sizeH * H);
  return [...text].length * (0.6 + (caps ? 0.12 : 0)) * fs + 2 * Math.round(fs * 0.8) + 2;
};

/** Where the rows of a name plate sit (for chips placed beside them). */
export const plateRows = (H: number, y?: number) => {
  const top = y ?? H * 0.078;
  const name = Math.round(0.04 * H * 1.25);
  const pill = Math.round(T.monoKicker.size * H * (1.25 + 0.84));
  const row1 = top + name + Math.round(0.014 * H);
  const row2 = row1 + pill + Math.round(0.011 * H);
  return {top, statusCentre: row1 + pill / 2, extraCentre: row2 + pill / 2, bottom: row2 + pill};
};

export const DISCLAIMER = 'Independent open-source project. Not affiliated with Anthropic.';

/** The disclaimer every Claude-Code-In-Motion and vsclaude scene carries, top-right. */
export const Footnote: React.FC<{t: number; at: number; out?: number; text?: string}> = ({t, at, out, text = DISCLAIMER}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pullK(t, at, out, 0.5, 0.4);
  if (k <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        right: Math.round(W * layout.marginLeftW),
        top: Math.round(H * 0.046),
        ...mono(H, T.monoKicker.size, 450),
        color: color.text.tertiary,
        letterSpacing: '0.01em',
        opacity: k * 0.95,
      }}
    >
      {text}
    </div>
  );
};

export interface CiteSpec {
  repo: string;
  path: string;
  line?: number | string;
  at: number;
  out?: number;
}

/** Citation chips stacked in the right column, right-aligned on the 7% margin. */
export const CiteStack: React.FC<{t: number; chips: readonly CiteSpec[]; top?: number; gap?: number; right?: number}> = ({t, chips, top = 0.575, gap = 0.047, right}) => {
  const {width: W, height: H} = useVideoConfig();
  const x = right ?? W * (1 - layout.marginLeftW);
  return (
    <>
      {chips.map((c, i) => (
        <CitationChip
          key={`${c.repo}/${c.path}:${c.line}`}
          repo={c.repo}
          path={c.path}
          line={c.line}
          at={c.at}
          exitAt={c.out}
          t={t}
          x={x}
          y={Math.round(H * (top + i * gap))}
          align="right"
          sizeH={T.monoKicker.size}
        />
      ))}
    </>
  );
};

/** One citation chip anywhere. */
export const Cite: React.FC<CiteSpec & {t: number; x: number; y: number; align?: 'left' | 'right'; leader?: number}> = ({t, x, y, align = 'left', leader, ...c}) => (
  <CitationChip repo={c.repo} path={c.path} line={c.line} at={c.at} exitAt={c.out} t={t} x={x} y={y} align={align} leader={leader} sizeH={T.monoKicker.size} />
);

/** Enter with a rise and a fade (cards), leave with a fade. */
export const riseK = (t: number, at: number, out?: number, inS = 0.5, outS = 0.35) => {
  const a = easeOutCubic(prog(t, at, inS));
  const b = out === undefined ? 1 : 1 - easeInCubic(prog(t, out, outS));
  return Math.max(0, Math.min(a, b));
};

/** A glass card (the film's info card look) with an optional mint mono label. */
export const Card: React.FC<{
  t: number;
  at: number;
  out?: number;
  x: number;
  y: number;
  w: number;
  h?: number;
  label?: string;
  labelTone?: string;
  children?: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}> = ({t, at, out, x, y, w, h, label, labelTone, children, pad, style}) => {
  const {height: H} = useVideoConfig();
  const k = riseK(t, at, out);
  if (k <= 0) return null;
  const p = Math.round(pad ?? H * layout.cardPaddingH);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y + (1 - k) * H * 0.014),
        width: Math.round(w),
        height: h === undefined ? undefined : Math.round(h),
        boxSizing: 'border-box',
        padding: p,
        borderRadius: Math.round(H * layout.cardRadiusH),
        background: color.card.glass,
        border: `1px solid ${color.card.rule}`,
        boxShadow: `0 ${Math.round(H * 0.018)}px ${Math.round(H * 0.06)}px rgba(0,0,0,0.45)`,
        opacity: k,
        ...style,
      }}
    >
      {label ? (
        <div style={{...mono(H, T.monoKicker.size, 500), letterSpacing: '0.15em', textTransform: 'uppercase', color: labelTone ?? color.accent.mint, marginBottom: Math.round(p * 0.7)}}>{label}</div>
      ) : null}
      {children}
    </div>
  );
};

/** A calm miss: a hollow pin glyph beside the text, same size and step as a win, neutral tone. */
export const MissDot: React.FC<{H: number; size?: number}> = ({H, size = 0.016}) => (
  <span
    style={{
      display: 'inline-block',
      width: Math.round(size * H),
      height: Math.round(size * H),
      borderRadius: 99,
      border: `${Math.max(2, Math.round(0.0024 * H))}px solid ${color.text.secondary}`,
      boxSizing: 'border-box',
      flex: 'none',
    }}
  />
);

export const WinDot: React.FC<{H: number; size?: number}> = ({H, size = 0.016}) => (
  <span
    style={{
      display: 'inline-block',
      width: Math.round(size * H),
      height: Math.round(size * H),
      borderRadius: 99,
      background: color.accent.mint,
      boxShadow: `0 0 ${Math.round(0.012 * H)}px ${color.accent.mintGlow}`,
      flex: 'none',
    }}
  />
);
