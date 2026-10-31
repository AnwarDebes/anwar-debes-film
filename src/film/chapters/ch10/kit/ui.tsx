import React, {useContext} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CitationChip, KineticLine, blurFilter, easeInCubic, easeOutCubic, easeUI, prog, useFontsReady} from '../../../../engine/type';
import {color, font, motion, type as typeTokens} from '../../../../engine/tokens';
import {rigPoseAt, projectToScreen, type CameraKey} from '../../../../engine/camera';
import {uvToWorld, type Board} from '../../../../engine/pins';
import type {Word} from '../../../../engine/narration/types';
import {FilmGuide, GuideTimeline} from '../../../guide';
import {PixieCard, cardGeometry, presetCell, type PixieWalk} from '../../../../pixie';
import {PROP_REACH} from '../../../../pixie/presets';

// Overlay pieces shared by chapters 10 and 13. Every size comes from the frame height H, every
// time is film time passed in by the scene (from the timeline), and the lower third follows the
// storyboard's spec: name plate top left, chips in the side columns above the caption band,
// Pixie's box at 2% W with its bottom at 88% H, the 66-pin rule line at 97% H.

export const MONO_MIN = 0.022;

/** Fade/blur envelope: in over inS from `at`, out over outS from `out`. */
export const env = (t: number, at: number, out?: number, inS = 0.35, outS = 0.3) => {
  const a = easeOutCubic(prog(t, at, inS));
  const b = out === undefined ? 1 : 1 - easeInCubic(prog(t, out, outS));
  return Math.max(0, Math.min(a, b));
};

const blurMax = (H: number) => (motion.textFocusPull.blurAt1080 * H) / 1080;

// ---------------------------------------------------------------- name plate and status chip

export interface PlateProps {
  t: number;
  at: number;
  exitAt?: number;
  /** exact GitHub spelling */
  name: string;
  /** honest status, mono caps */
  status: string;
  /** a grey line under the chip (e.g. what an acronym means) */
  sub?: string;
  /** status tone: 'mint' (working), 'grey' (prototype), 'amber' (not yet run) */
  tone?: 'mint' | 'grey' | 'amber';
}

/** The place's name plate (mono, typed on) and its status chip, top left at 8-16% H. */
export const Plate: React.FC<PlateProps> = ({t, at, exitAt, name, status, sub, tone = 'grey'}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const k = env(t, at, exitAt, 0.25, 0.3);
  if (k <= 0) return null;
  const x = Math.round(0.069 * W);
  const nameSize = Math.round(0.04 * H);
  const typed = Math.min(name.length, Math.floor((t - at) * 34) + 1);
  const caretOn = t - at < name.length / 34 + 0.35;
  const chipSize = Math.round(MONO_MIN * H);
  const chipK = env(t, at + 0.32, exitAt, 0.35, 0.3);
  const toneCol = tone === 'mint' ? color.accent.mintLabel : tone === 'amber' ? color.signal.amber : color.text.chipDim;
  const outBlur = exitAt !== undefined ? blurMax(H) * easeInCubic(prog(t, exitAt, 0.3)) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', opacity: k, filter: blurFilter(outBlur)}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: Math.round(0.072 * H),
          fontFamily: font.mono,
          fontWeight: 600,
          fontSize: nameSize,
          letterSpacing: '-0.01em',
          color: color.text.key,
          whiteSpace: 'pre',
          lineHeight: 1,
          textShadow: `0 0 ${Math.round(nameSize * 0.5)}px rgba(0,0,0,0.6)`,
        }}
      >
        {name.slice(0, typed)}
        {caretOn ? (
          <span
            style={{
              display: 'inline-block',
              width: Math.round(nameSize * 0.09),
              height: Math.round(nameSize * 0.92),
              marginLeft: Math.round(nameSize * 0.08),
              verticalAlign: 'middle',
              background: color.accent.mint,
              opacity: 0.9,
            }}
          />
        ) : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: x - Math.round(chipSize * 0.65),
          top: Math.round(0.128 * H),
          opacity: chipK,
          transform: `translateY(${((1 - easeUI(prog(t, at + 0.32, 0.45))) * 0.01 * H).toFixed(2)}px)`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(chipSize * 0.55),
          padding: `${Math.round(chipSize * 0.42)}px ${Math.round(chipSize * 0.75)}px`,
          borderRadius: 999,
          background: 'rgba(14,17,16,0.86)',
          border: `1px solid ${color.card.rule}`,
          fontFamily: font.mono,
          fontWeight: 500,
          fontSize: chipSize,
          letterSpacing: '0.12em',
          color: toneCol,
          whiteSpace: 'pre',
          lineHeight: 1.1,
        }}
      >
        <span style={{width: Math.round(chipSize * 0.38), height: Math.round(chipSize * 0.38), borderRadius: 99, background: toneCol, opacity: 0.9}} />
        {status}
      </div>
      {sub ? (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: Math.round(0.188 * H),
            opacity: env(t, at + 0.6, exitAt, 0.35, 0.3),
            fontFamily: font.sans,
            fontWeight: 500,
            fontSize: Math.round(0.03 * H),
            letterSpacing: '-0.01em',
            color: color.text.secondary,
            whiteSpace: 'pre',
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- citation chips

export interface ChipSpec {
  repo: string;
  path: string;
  line?: number | string;
  at: number;
  exitAt?: number;
}

/**
 * A stack of citation chips. `side` right: right-aligned at the 93% margin; left: at the 7%
 * margin. `y0` is the first chip's centre (fraction of H), `dy` the pitch.
 */
export const Chips: React.FC<{t: number; chips: ChipSpec[]; side?: 'left' | 'right'; y0?: number; dy?: number; x?: number}> = ({
  t,
  chips,
  side = 'right',
  y0 = 0.6,
  dy = 0.052,
  x,
}) => {
  const {width: W, height: H} = useVideoConfig();
  const xx = x ?? (side === 'right' ? Math.round(0.931 * W) : Math.round(0.069 * W));
  return (
    <>
      {chips.map((c, k) => (
        <CitationChip
          key={`${c.repo}/${c.path}:${c.line ?? ''}#${k}`}
          repo={c.repo}
          path={c.path}
          line={c.line}
          at={c.at}
          exitAt={c.exitAt}
          t={t}
          x={xx}
          y={Math.round((y0 + k * dy) * H)}
          align={side}
          sizeH={MONO_MIN}
          cps={60}
        />
      ))}
    </>
  );
};

// ---------------------------------------------------------------- text

/** One number with its source, right-aligned: the value in mint, then a source pill with a tick. */
export const SourceRow: React.FC<{t: number; at: number; exitAt?: number; value: string; source: string; x: number; y: number}> = ({t, at, exitAt, value, source, x, y}) => {
  const {height: H, width: Wd} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const k = env(t, at, exitAt, 0.3, 0.3);
  if (k <= 0) return null;
  const fs = Math.round(MONO_MIN * H);
  const typed = Math.min(source.length, Math.floor((t - at - 0.1) * 70) + 1);
  const tickK = easeOutCubic(prog(t, at + 0.15 + source.length / 70, 0.25));
  return (
    <div
      style={{
        position: 'absolute',
        right: Math.round(Wd - x),
        top: Math.round(y),
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(fs * 0.7),
        opacity: k,
        whiteSpace: 'pre',
      }}
    >
      <span style={{fontFamily: font.sans, fontWeight: 700, fontSize: Math.round(0.03 * H), color: color.accent.mint, letterSpacing: '-0.01em', textShadow: `0 0 ${Math.round(fs * 0.6)}px rgba(0,0,0,0.7)`}}>{value}</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: Math.round(fs * 0.5),
          padding: `${Math.round(fs * 0.4)}px ${Math.round(fs * 0.7)}px`,
          borderRadius: 999,
          background: 'rgba(19,19,19,0.94)',
          border: '1px solid rgba(228,234,231,0.16)',
          fontFamily: font.mono,
          fontWeight: 500,
          fontSize: fs,
          color: color.text.chipDim,
        }}
      >
        {source.slice(0, Math.max(0, typed))}
        <span style={{display: 'inline-block', width: Math.round(fs * 0.9), height: Math.round(fs * 0.9), borderRadius: 99, background: color.accent.mint, opacity: tickK, transform: `scale(${(0.5 + 0.5 * tickK).toFixed(3)})`}} />
      </span>
    </div>
  );
};

/** A line of on-screen text (markup: **bold** numbers, *mint* idea words), focus-pulled in. */
export const Fact: React.FC<{
  t: number;
  at: number;
  exitAt?: number;
  text: string;
  x?: number;
  y: number;
  sizeH?: number;
  maxWidthW?: number;
  align?: 'left' | 'right' | 'center';
  color?: string;
  weight?: number;
}> = ({t, at, exitAt, text, x, y, sizeH = 0.034, maxWidthW = 0.38, align = 'left', color: c, weight}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <KineticLine
      text={text}
      at={at}
      perWordS={0.045}
      t={t}
      kind="columnCaption"
      sizeH={sizeH}
      weight={weight}
      variant="focus"
      x={x ?? Math.round(0.069 * W)}
      y={Math.round(y * H)}
      yAnchor="firstBaseline"
      align={align}
      maxWidth={Math.round(maxWidthW * W)}
      maxLines={3}
      lineHeight={1.22}
      color={c ?? color.text.display}
      exitAt={exitAt}
    />
  );
};

/** A mono label (kicker style) placed in px. */
export const Mono: React.FC<{
  t: number;
  at: number;
  exitAt?: number;
  text: string;
  x: number;
  y: number;
  sizeH?: number;
  align?: 'left' | 'center' | 'right';
  tone?: string;
  caps?: boolean;
  weight?: number;
  tracking?: number;
  bg?: boolean;
}> = ({t, at, exitAt, text, x, y, sizeH = MONO_MIN, align = 'left', tone, caps = false, weight = 500, tracking, bg = false}) => {
  const {height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const k = env(t, at, exitAt, 0.3, 0.3);
  if (k <= 0) return null;
  const fs = Math.round(sizeH * H);
  const tx = align === 'left' ? '0' : align === 'center' ? '-50%' : '-100%';
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        transform: `translate(${tx}, -50%)`,
        opacity: k,
        filter: blurFilter(blurMax(H) * 0.6 * (1 - easeOutCubic(prog(t, at, 0.3)))),
        fontFamily: font.mono,
        fontWeight: weight,
        fontSize: fs,
        letterSpacing: `${tracking ?? (caps ? 0.12 : 0)}em`,
        textTransform: caps ? 'uppercase' : undefined,
        color: tone ?? color.text.chipDim,
        whiteSpace: 'pre',
        lineHeight: 1.15,
        padding: bg ? `${Math.round(fs * 0.35)}px ${Math.round(fs * 0.6)}px` : undefined,
        borderRadius: bg ? Math.round(fs * 0.4) : undefined,
        background: bg ? 'rgba(12,15,14,0.82)' : undefined,
        border: bg ? `1px solid ${color.card.rule}` : undefined,
        textShadow: bg ? undefined : `0 0 ${Math.round(fs * 0.6)}px rgba(0,0,0,0.75)`,
      }}
    >
      {text}
    </div>
  );
};

/** The closing line of a chapter, set as a left-half statement on its spoken words. */
export const Statement: React.FC<{t: number; words: readonly Word[]; exitAt?: number; y?: number; sizeH?: number; maxWidthW?: number; maxLines?: number}> = ({t, words, exitAt, y = 0.38, sizeH, maxWidthW = 0.42, maxLines = 4}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <KineticLine
      words={words}
      t={t}
      kind="statement"
      sizeH={sizeH}
      variant="rise"
      x={Math.round(0.069 * W)}
      y={Math.round(y * H)}
      yAnchor="capTop"
      align="left"
      maxWidth={Math.round(maxWidthW * W)}
      maxLines={maxLines}
      exitAt={exitAt}
      underline
    />
  );
};

/** Terminal-style lines, re-set natively so they read (the device screen is too small for it). */
export const Term: React.FC<{
  t: number;
  x: number;
  y: number;
  lines: Array<{at: number; text: string; kind?: 'cmd' | 'out' | 'err'; prompt?: string}>;
  exitAt?: number;
  sizeH?: number;
  width?: number;
  title?: string;
  titleCaps?: boolean;
  at: number;
}> = ({t, x, y, lines, exitAt, sizeH = 0.024, width, title, titleCaps = true, at}) => {
  const {width: W, height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const k = env(t, at, exitAt, 0.35, 0.3);
  if (k <= 0) return null;
  const fs = Math.round(sizeH * H);
  const lh = Math.round(fs * 1.5);
  const pad = Math.round(fs * 0.9);
  const shown = lines.filter((l) => t >= l.at);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width ?? 0.36 * W),
        opacity: k,
        transform: `translateY(${((1 - easeUI(prog(t, at, 0.5))) * 0.012 * H).toFixed(2)}px)`,
        background: 'rgba(8,12,11,0.9)',
        border: `1px solid ${color.card.rule}`,
        borderRadius: Math.round(0.014 * H),
        boxShadow: `0 ${Math.round(0.016 * H)}px ${Math.round(0.05 * H)}px rgba(0,0,0,0.45)`,
        padding: `${pad}px ${pad}px ${Math.round(pad * 0.8)}px`,
        fontFamily: font.mono,
        fontSize: fs,
        lineHeight: `${lh}px`,
        whiteSpace: 'pre',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {title ? (
        <div style={{color: color.accent.mintLabel, fontSize: Math.round(MONO_MIN * H), letterSpacing: titleCaps ? '0.12em' : '0.02em', textTransform: titleCaps ? 'uppercase' : undefined, marginBottom: Math.round(fs * 0.6)}}>{title}</div>
      ) : null}
      {shown.map((l, i) => {
        const typedN = l.kind === 'cmd' ? Math.min(l.text.length, Math.floor((t - l.at) * 22) + 1) : l.text.length;
        const op = l.kind === 'cmd' ? 1 : easeOutCubic(prog(t, l.at, 0.18));
        return (
          <div key={i} style={{opacity: op, color: l.kind === 'err' ? color.signal.verdictRed : l.kind === 'cmd' ? color.text.key : color.text.caption}}>
            {l.kind === 'cmd' ? <span style={{color: color.accent.mint}}>{l.prompt ?? '$ '}</span> : null}
            {l.text.slice(0, typedN)}
          </div>
        );
      })}
    </div>
  );
};

/** A claim struck through by a pencil line, with its correction setting in below. */
export const Strike: React.FC<{
  t: number;
  at: number;
  strikeAt: number;
  fixAt: number;
  exitAt?: number;
  label: string;
  claim: string;
  fix: string;
  x: number;
  y: number;
  width: number;
}> = ({t, at, strikeAt, fixAt, exitAt, label, claim, fix, x, y, width}) => {
  const {height: H} = useVideoConfig();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const k = env(t, at, exitAt, 0.35, 0.3);
  if (k <= 0) return null;
  const fs = Math.round(0.024 * H);
  const ls = Math.round(MONO_MIN * H);
  const fixK = env(t, fixAt, exitAt, 0.4, 0.3);
  const pad = Math.round(0.024 * H);
  const lines = claim.split('\n');
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        opacity: k,
        transform: `translateY(${((1 - easeUI(prog(t, at, 0.5))) * 0.012 * H).toFixed(2)}px)`,
        background: color.card.glass,
        border: `1px solid ${color.card.rule}`,
        borderRadius: Math.round(0.017 * H),
        padding: pad,
        boxSizing: 'border-box',
        boxShadow: `0 ${Math.round(0.016 * H)}px ${Math.round(0.05 * H)}px rgba(0,0,0,0.45)`,
      }}
    >
      <div style={{fontFamily: font.mono, fontSize: ls, letterSpacing: '0.12em', color: color.accent.mintLabel, textTransform: 'uppercase', marginBottom: Math.round(pad * 0.6)}}>{label}</div>
      {lines.map((line, li) => {
        const sk = easeOutCubic(prog(t, strikeAt + li * 0.32, 0.42));
        const lead = line.length - line.trimStart().length;
        return (
          <div key={li} style={{position: 'relative', fontFamily: font.mono, fontSize: fs, color: sk > 0.5 ? color.text.secondary : color.text.caption, lineHeight: 1.4, whiteSpace: 'pre'}}>
            {line}
            <div
              style={{
                position: 'absolute',
                left: `${lead}ch`,
                top: '54%',
                height: Math.max(2, Math.round(fs * 0.09)),
                width: `calc(${(sk * 100).toFixed(2)}% - ${(lead * sk).toFixed(2)}ch)`,
                background: color.pixie.bodyHi,
                borderRadius: 4,
                boxShadow: `0 0 ${Math.round(fs * 0.3)}px rgba(232,160,133,0.45)`,
              }}
            />
          </div>
        );
      })}
      <div
        style={{
          marginTop: Math.round(pad * 0.7),
          opacity: fixK,
          filter: blurFilter(blurMax(H) * (1 - easeOutCubic(prog(t, fixAt, 0.35)))),
          fontFamily: font.mono,
          fontSize: fs,
          color: color.text.key,
          lineHeight: 1.35,
          whiteSpace: 'pre-wrap',
        }}
      >
        <span style={{color: color.accent.mint}}>→ </span>
        {fix}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- projection

/** Screen position (px) of a wall point (uv, height in world units) at film time t. */
export const project = (keys: readonly CameraKey[], board: Board, t: number, uv: [number, number], z: number, W: number, H: number): [number, number] => {
  const pose = rigPoseAt(keys, t);
  const [x, y] = uvToWorld(board, uv[0], uv[1]);
  const p = projectToScreen(pose, [x, y, z], W, H);
  return [p[0], p[1]];
};

// ---------------------------------------------------------------- the 66-pin rule line

export interface RuleLineProps {
  t: number;
  /** pins already lit when the chapter starts */
  base: number;
  /** when each of this chapter's pins lights (in order) */
  lights: number[];
  /** windows where the line hides (dense code panels) */
  hide?: Array<[number, number]>;
  from: number;
  to: number;
}

/** 66 small steel pins along the bottom of the frame; one lights mint per repository reached. */
export const RuleLine: React.FC<RuleLineProps> = ({t, base, lights, hide = [], from, to}) => {
  const {width: W, height: H} = useVideoConfig();
  let vis = env(t, from, to - 0.3, 0.4, 0.3);
  for (const [a, b] of hide) vis = Math.min(vis, 1 - Math.min(easeOutCubic(prog(t, a, 0.3)), 1 - easeOutCubic(prog(t, b, 0.4))));
  if (vis <= 0.001) return null;
  const y = Math.round(0.97 * H);
  const x0 = 0.15 * W;
  const x1 = 0.95 * W;
  const r = Math.max(3, Math.round(0.0042 * H));
  const pins: React.ReactNode[] = [];
  for (let k = 0; k < 66; k++) {
    const cx = Math.round(x0 + ((x1 - x0) * k) / 65);
    const mine = k - base;
    const litAt = k < base ? -Infinity : mine < lights.length ? lights[mine] : Infinity;
    const lit = t >= litAt;
    const flash = lit && Number.isFinite(litAt) ? 1 - prog(t, litAt, 1.2) : 0;
    const on = lit ? (Number.isFinite(litAt) ? easeOutCubic(prog(t, litAt, 0.25)) : 1) : 0;
    pins.push(
      <div
        key={k}
        style={{
          position: 'absolute',
          left: cx - r,
          top: y - r,
          width: 2 * r,
          height: 2 * r,
          borderRadius: r,
          background: on > 0 ? `rgba(116,201,174,${(0.35 + 0.65 * on).toFixed(3)})` : 'radial-gradient(circle at 35% 30%, #9a9e9d 0%, #4d5150 45%, #222524 100%)',
          boxShadow: on > 0 ? `0 0 ${Math.round(r * (2 + 4 * flash))}px rgba(116,201,174,${(0.35 + 0.5 * flash).toFixed(3)})` : '0 1px 2px rgba(0,0,0,0.6)',
        }}
      />,
    );
    if (flash > 0.01) {
      const s = 1 + 2.4 * (1 - flash);
      pins.push(
        <div
          key={`f${k}`}
          style={{
            position: 'absolute',
            left: cx - r,
            top: y - r,
            width: 2 * r,
            height: 2 * r,
            borderRadius: r,
            border: `1px solid rgba(116,201,174,${(0.8 * flash).toFixed(3)})`,
            transform: `scale(${s.toFixed(3)})`,
          }}
        />,
      );
    }
  }
  return <div style={{position: 'absolute', inset: 0, opacity: vis, pointerEvents: 'none'}}>{pins}</div>;
};

// ---------------------------------------------------------------- Pixie in the corner

/**
 * Pixie's corner box (x 2% W, bottom at 88% H, u = 8 at 1440p) with its state card beside it.
 * The card shows both lines for 2.5 s after each change, then collapses to the label.
 */
export const Guide: React.FC<{walk?: PixieWalk | readonly PixieWalk[]; kicker?: string | null}> = ({walk, kicker}) => {
  const {width: W, height: H, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const timeline = useContext(GuideTimeline);
  const u = presetCell('corner', H);
  const bx = Math.round(0.02 * W);
  const by = Math.round(0.88 * H) - 32 * u;
  const gap = Math.max(u, Math.round(0.016 * H));
  const cardX = bx + Math.ceil(PROP_REACH * u) + gap;
  const cardY = by + Math.round(13.5 * u);
  const sizes = {kicker: Math.round(MONO_MIN * H), detail: Math.round(MONO_MIN * H)};
  const withKicker = kicker !== null;
  const g = cardGeometry(H, 'corner', sizes, withKicker);
  const top = Math.round(cardY - g.height / 2);
  const m = timeline ? timeline.at(frame) : null;
  const since = m ? Math.max(m.labelSince, m.detailSince) : 0;
  const hold = Math.round(2.5 * fps);
  const fade = Math.round(0.35 * fps);
  const a = m && m.detail ? 1 - Math.min(1, Math.max(0, (frame - since - hold) / fade)) : 1;
  const cut = top + g.detailTop - Math.round(0.006 * H);
  const mask = a >= 1 ? undefined : `linear-gradient(to bottom, #000 0px, #000 ${cut}px, rgba(0,0,0,${a.toFixed(3)}) ${cut + 1}px, rgba(0,0,0,${a.toFixed(3)}) 100%)`;
  return (
    <>
      <FilmGuide preset="corner" x={bx} y={by} card={false} walk={walk} />
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', maskImage: mask, WebkitMaskImage: mask}}>
        <PixieCard
          timeline={timeline}
          frame={frame}
          preset="corner"
          align="left"
          x={cardX}
          y={cardY}
          kicker={kicker}
          kickerSize={sizes.kicker}
          detailSize={sizes.detail}
        />
      </div>
    </>
  );
};

/** Walking in place: the canonical scurry while the wall moves behind Pixie (a tiny real step). */
export const scurry = (startFrame: number, durS: number, fromX: number, stepCells = 0.25): PixieWalk => ({
  fromX,
  toX: fromX + stepCells,
  startFrame,
  speed: Math.max(0.02, stepCells / Math.max(0.2, durS)),
  gait: 'scurry',
  arriveFacing: 'right',
});
