import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, font, layout, motion, type as typeTokens} from '../../../../engine/tokens';
import {CitationChip, KineticLine, blurFilter, easeInCubic, easeOutCubic, easeUI, prog, useFontsReady} from '../../../../engine/type';
import type {Word} from '../../../../engine/narration/types';
import type {Lens} from './space';

// Overlay pieces shared by chapters 06 and 08. Sizes come from H; text never goes below the
// film's minimums (mono 0.022 H, body 0.026 H).

export const MONO_MIN = 0.022;
export const BODY_MIN = 0.026;

/** Fade-and-focus envelope: 0 before `at`, 1 while shown, back to 0 after `exitAt`. */
export const pull = (t: number, at: number, exitAt?: number, inS = 0.35, outS = 0.3): number => {
  const a = easeOutCubic(prog(t, at, inS));
  if (exitAt === undefined) return a;
  return Math.min(a, 1 - easeInCubic(prog(t, exitAt, outS)));
};

const blurFor = (H: number, k: number) => blurFilter(((motion.textFocusPull.blurAt1080 * H) / 1080) * (1 - k));

const shadow = (H: number, k = 1) => `0 0 ${Math.round(0.006 * H * k)}px rgba(5,8,7,0.85), 0 0 ${Math.round(0.016 * H * k)}px rgba(5,8,7,0.55)`;

// ---------------------------------------------------------------- name plate + status chip

/**
 * The place's name plate (exact GitHub spelling, never upper-cased) and its honest status chip,
 * top-left of the place.
 */
export const PlaceTitle: React.FC<{t: number; at: number; exitAt?: number; name: string; status: string; x?: number; y?: number}> = ({t, at, exitAt, name, status, x, y}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  const k = pull(t, at, exitAt);
  const k2 = pull(t, at + 0.22, exitAt);
  if (!ready || k <= 0) return null;
  const left = Math.round(x ?? W * layout.marginLeftW);
  const top = Math.round(y ?? H * 0.072);
  const nameSize = Math.round(0.046 * H);
  const chipSize = Math.round(MONO_MIN * H);
  return (
    <div style={{position: 'absolute', left, top, pointerEvents: 'none'}}>
      <div
        style={{
          fontFamily: font.mono,
          fontWeight: 600,
          fontSize: nameSize,
          letterSpacing: '-0.01em',
          color: color.text.display,
          lineHeight: 1.1,
          opacity: k,
          filter: blurFor(H, k),
          textShadow: shadow(H),
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: 'inline-block',
          marginTop: Math.round(0.014 * H),
          padding: `${Math.round(0.006 * H)}px ${Math.round(0.012 * H)}px`,
          borderRadius: Math.round(0.006 * H),
          border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.22)`,
          background: 'rgba(10,13,12,0.78)',
          fontFamily: font.mono,
          fontWeight: 500,
          fontSize: chipSize,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: color.text.chipDim,
          whiteSpace: 'nowrap',
          opacity: k2,
          filter: blurFor(H, k2),
        }}
      >
        {status}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- mono kicker (not upper-cased)

/** A mono kicker for paths and repository names (keeps their exact case). */
export const PathKicker: React.FC<{t: number; at: number; exitAt?: number; text: string; x?: number; y: number; tone?: string; sizeH?: number; align?: 'left' | 'right'}> = ({
  t,
  at,
  exitAt,
  text,
  x,
  y,
  tone,
  sizeH = MONO_MIN,
  align = 'left',
}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = pull(t, at, exitAt);
  if (k <= 0) return null;
  const xx = x ?? W * layout.marginLeftW;
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'left' ? Math.round(xx) : undefined,
        right: align === 'right' ? Math.round(W - xx) : undefined,
        top: Math.round(y),
        fontFamily: font.mono,
        fontWeight: 500,
        fontSize: Math.round(sizeH * H),
        letterSpacing: '0.04em',
        color: tone ?? color.accent.mintLabel,
        whiteSpace: 'nowrap',
        opacity: k,
        filter: blurFor(H, k),
        textShadow: shadow(H),
      }}
    >
      {text}
    </div>
  );
};

/** A small mono tag in a pill: "schematic", "demo transcript", "illustration · not experiment data". */
export const Tag: React.FC<{t: number; at: number; exitAt?: number; text: string; x: number; y: number; align?: 'left' | 'right' | 'center'; tone?: string; border?: string; dashed?: boolean}> = ({
  t,
  at,
  exitAt,
  text,
  x,
  y,
  align = 'left',
  tone,
  border,
  dashed,
}) => {
  const {height: H} = useVideoConfig();
  const k = pull(t, at, exitAt);
  if (k <= 0) return null;
  const tx = align === 'left' ? '0' : align === 'right' ? '-100%' : '-50%';
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        transform: `translate(${tx}, -50%)`,
        padding: `${Math.round(0.005 * H)}px ${Math.round(0.011 * H)}px`,
        borderRadius: Math.round(0.02 * H),
        border: `${Math.max(1, Math.round(H / 1080))}px ${dashed ? 'dashed' : 'solid'} ${border ?? 'rgba(228,234,231,0.2)'}`,
        background: 'rgba(10,13,12,0.82)',
        fontFamily: font.mono,
        fontWeight: 500,
        fontSize: Math.round(MONO_MIN * H),
        letterSpacing: '0.02em',
        color: tone ?? color.text.chipDim,
        whiteSpace: 'nowrap',
        opacity: k,
        filter: blurFor(H, k),
      }}
    >
      {text}
    </div>
  );
};

// ---------------------------------------------------------------- citation chips

export interface CiteSpec {
  repo: string;
  path: string;
  line?: number | string;
  at: number;
  exitAt: number;
  /** stack slot: 0 is the lowest (0.70 H), each slot 0.052 H higher */
  slot?: number;
  /** right edge override (px); default the 7% margin */
  x?: number;
  y?: number;
  align?: 'left' | 'right';
}

/** Citation chips stacked in the right column, above the caption band. */
export const Cites: React.FC<{t: number; items: readonly CiteSpec[]}> = ({t, items}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <>
      {items.map((c, i) =>
        t >= c.at && t < c.exitAt + 0.4 ? (
          <CitationChip
            key={`${c.repo}/${c.path}:${c.line ?? ''}#${i}`}
            repo={c.repo}
            path={c.path}
            line={c.line}
            at={c.at}
            exitAt={c.exitAt}
            t={t}
            sizeH={MONO_MIN}
            x={c.x ?? Math.round(W * (1 - layout.marginLeftW))}
            y={c.y ?? Math.round(H * (0.7 - 0.052 * (c.slot ?? 0)))}
            align={c.align ?? 'right'}
          />
        ) : null,
      )}
    </>
  );
};

// ---------------------------------------------------------------- labels pinned to the wall

export interface WallText {
  text: React.ReactNode;
  X: number;
  Y: number;
  /** relief height of the surface the label sits on */
  h?: number;
  at: number;
  exitAt?: number;
  sizeH?: number;
  weight?: number;
  color?: string;
  align?: 'center' | 'left' | 'right';
  /** px offset after projection */
  dx?: number;
  dy?: number;
  mono?: boolean;
  /** draw on a dark pill (for labels over bright pins) */
  pill?: boolean;
  opacity?: number;
}

/** Text that sits on pins: projected through the chapter's camera every frame. */
export const WallLabels: React.FC<{t: number; lens: Lens; items: readonly WallText[]}> = ({t, lens, items}) => {
  const {height: H} = useVideoConfig();
  return (
    <>
      {items.map((it, i) => {
        if (t < it.at || (it.exitAt !== undefined && t > it.exitAt + 0.35)) return null;
        const k = pull(t, it.at, it.exitAt, 0.3, 0.3) * (it.opacity ?? 1);
        if (k <= 0) return null;
        const [x, y] = lens.at(t, it.X, it.Y, it.h ?? 0);
        const tx = it.align === 'left' ? '0' : it.align === 'right' ? '-100%' : '-50%';
        const size = Math.round((it.sizeH ?? MONO_MIN) * H);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.round(x + (it.dx ?? 0)),
              top: Math.round(y + (it.dy ?? 0)),
              transform: `translate(${tx}, -50%)`,
              fontFamily: it.mono === false ? font.sans : font.mono,
              fontWeight: it.weight ?? 500,
              fontSize: size,
              letterSpacing: it.mono === false ? '-0.01em' : '0',
              color: it.color ?? color.text.display,
              whiteSpace: 'nowrap',
              opacity: k,
              filter: blurFor(H, Math.min(1, k * 1.2)),
              textShadow: it.pill ? undefined : shadow(H),
              padding: it.pill ? `${Math.round(0.004 * H)}px ${Math.round(0.009 * H)}px` : undefined,
              borderRadius: it.pill ? Math.round(0.008 * H) : undefined,
              background: it.pill ? 'rgba(8,11,10,0.8)' : undefined,
              lineHeight: 1.25,
            }}
          >
            {it.text}
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------- the rule line

export interface RuleLineProps {
  t: number;
  /** pins lit before the chapter began */
  litBefore: number;
  /** film times at which this chapter's pins light, in order */
  lights: readonly number[];
  /** 0..1 visibility (hidden during dense code panels) */
  visible?: number;
}

/**
 * The 66-pin rule line along the bottom edge (97% H, 15-95% W): one pin per repository, lit mint
 * when that repository's name plate first appears. No numerals: arrivals show the lit pin alone.
 */
export const RuleLine66: React.FC<RuleLineProps> = ({t, litBefore, lights, visible = 1}) => {
  const {width: W, height: H} = useVideoConfig();
  if (visible <= 0.001) return null;
  const n = 66;
  const x0 = 0.15 * W;
  const x1 = 0.95 * W;
  const y = 0.97 * H;
  const r = 0.0042 * H;
  const pins: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    let lit = 0;
    let flash = 0;
    if (i < litBefore) lit = 1;
    else {
      const k = i - litBefore;
      if (k < lights.length && t >= lights[k]) {
        lit = easeUI(prog(t, lights[k], 0.45));
        flash = 1 - prog(t, lights[k] + 0.2, 1.4);
      }
    }
    pins.push(
      <g key={i}>
        {lit > 0 ? <circle cx={x} cy={y} r={r * (2.6 + 1.6 * flash)} fill="url(#c06-rl-glow)" opacity={lit * (0.55 + 0.45 * flash)} /> : null}
        <circle cx={x} cy={y} r={r} fill="url(#c06-rl-steel)" />
        {lit > 0 ? <circle cx={x} cy={y} r={r} fill="url(#c06-rl-mint)" opacity={lit} /> : null}
      </g>,
    );
  }
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: visible, pointerEvents: 'none'}}>
      <defs>
        <radialGradient id="c06-rl-steel" cx="0.38" cy="0.34" r="0.7">
          <stop offset="0" stopColor="#8E9391" />
          <stop offset="0.55" stopColor="#4A4E4D" />
          <stop offset="1" stopColor="#1C1F1E" />
        </radialGradient>
        <radialGradient id="c06-rl-mint" cx="0.38" cy="0.34" r="0.7">
          <stop offset="0" stopColor="#E9FFF7" />
          <stop offset="0.45" stopColor={color.accent.mint} />
          <stop offset="1" stopColor={color.accent.mintDeep} />
        </radialGradient>
        <radialGradient id="c06-rl-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(116,201,174,0.55)" />
          <stop offset="1" stopColor="rgba(116,201,174,0)" />
        </radialGradient>
      </defs>
      {pins}
    </svg>
  );
};

// ---------------------------------------------------------------- statement

/** A chapter payoff as a left-half statement, set from the spoken words (skip it from captions). */
export const Statement: React.FC<{t: number; words: readonly Word[]; exitAt: number; y?: number}> = ({t, words, exitAt, y}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <KineticLine
      words={words}
      t={t}
      kind="statement"
      variant="rise"
      x={Math.round(W * layout.marginLeftW)}
      y={Math.round(y ?? H * 0.38)}
      yAnchor="capTop"
      maxWidth={Math.round(W * 0.42)}
      exitAt={exitAt}
      underline
    />
  );
};

// ---------------------------------------------------------------- chapter title card

/**
 * The chapter card: "06 · reins · THGTM · …" in mono with the repository names in their exact
 * case, then the display title (markup: *idea* in mint italic).
 */
export const ChapterTitle: React.FC<{t: number; at: number; exitAt: number; index: string; repos: readonly string[]; title: string}> = ({t, at, exitAt, index, repos, title}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  const k = pull(t, at, exitAt, 0.4, 0.35);
  if (!ready) return null;
  const x = Math.round(W * layout.marginLeftW);
  const kb = Math.round(H * layout.kickerBaselineH);
  const size = Math.round(typeTokens.monoKicker.size * H * 1.06);
  return (
    <>
      {k > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: kb - Math.round(size * 0.95),
            fontFamily: font.mono,
            fontWeight: 500,
            fontSize: size,
            letterSpacing: '0.06em',
            color: color.text.secondary,
            whiteSpace: 'nowrap',
            opacity: k,
            filter: blurFor(H, k),
            textShadow: shadow(H),
          }}
        >
          <span style={{color: color.accent.mint}}>{index} · </span>
          {repos.map((r, i) => (
            <span key={r}>
              <span style={{color: color.text.caption}}>{r}</span>
              {i < repos.length - 1 ? <span style={{color: color.text.tertiary}}> · </span> : null}
            </span>
          ))}
        </div>
      ) : null}
      <KineticLine
        text={title}
        at={at + 0.18}
        perWordS={0.085}
        t={t}
        kind="displayM"
        variant="focus"
        x={x}
        y={kb + Math.round(H * 0.044)}
        yAnchor="capTop"
        maxWidth={Math.round(W * 0.6)}
        maxLines={2}
        lineHeight={0.98}
        exitAt={exitAt}
      />
    </>
  );
};

// ---------------------------------------------------------------- a stamp that keeps its text's case

/**
 * A verdict-style stamp for code values ("move_score(45) = 1.0"): the engine's Stamp sets its
 * label in caps, which would change identifiers, so this one keeps the text as written. It drops
 * in from 1.6x with a slight turn and settles, then fades on exit.
 */
export const CaseStamp: React.FC<{t: number; at: number; exitAt?: number; text: string; x: number; y: number; tone?: string; sizeH?: number}> = ({t, at, exitAt, text, x, y, tone, sizeH = MONO_MIN}) => {
  const {height: H} = useVideoConfig();
  if (t < at - 0.35) return null;
  const k = Math.max(0, Math.min(1, (t - (at - 0.35)) / 0.35));
  const e = k * k * (3 - 2 * k);
  const out = exitAt === undefined ? 0 : Math.max(0, Math.min(1, (t - exitAt) / 0.3));
  if (out >= 1) return null;
  const c = tone ?? color.accent.mint;
  const scale = 1.6 - 0.6 * e;
  const rot = -4 * (1 - e);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        transform: `translate(-50%, -50%) scale(${scale.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`,
        opacity: e * (1 - out),
        padding: `${Math.round(0.007 * H)}px ${Math.round(0.014 * H)}px`,
        border: `${Math.max(2, Math.round(0.0022 * H))}px solid ${c}`,
        borderRadius: Math.round(0.008 * H),
        background: 'rgba(8,12,11,0.82)',
        fontFamily: font.mono,
        fontWeight: 600,
        fontSize: Math.round(sizeH * H),
        color: c,
        whiteSpace: 'nowrap',
        fontVariantLigatures: 'none',
        fontFeatureSettings: '"calt" 0, "liga" 0',
      }}
    >
      {text}
    </div>
  );
};
