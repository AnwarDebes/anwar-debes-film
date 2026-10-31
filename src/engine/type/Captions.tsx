import React, {useMemo} from 'react';
import type {Utterance} from '../narration/types';
import {caption, color, font, type} from '../tokens';
import {blurFilter, easeInCubic, easeOutCubic, prog} from './ease';
import {useFontsReady} from './fontsReady';
import {paginate, type LineBox, type PlacedRun, type TimedInput} from './layout';
import {typo} from './markup';
import {fontCSS, runTop, type FontSpec} from './metrics';
import {Scrim} from './Scrim';
import {fontOf, legibilityShadow, mintGlow, tagLook} from './styles';
import {px, REF_H, useTime, useUnits} from './units';

export interface CaptionsProps {
  utterances: Utterance[];
  /** film time in seconds (defaults to the current frame) */
  t?: number;
  /** utterance ids set elsewhere as scene typography (headline, statement, column) */
  skip?: readonly string[];
  /** the bottom scrim: always on (default), or none */
  scrim?: boolean;
  /** active-word underline (default true) */
  underline?: boolean;
  /** overrides (fractions of H / W) */
  lastBaselineH?: number;
  maxWidthW?: number;
  maxLines?: number;
  sizeH?: number;
}

/** One caption block as it will be drawn: fixed layout plus its time window. */
export interface CaptionPage {
  key: string;
  runs: Array<PlacedRun & {start: number; end: number; color: string; glow: boolean}>;
  lines: LineBox[];
  /** px: left of the block box, and the baseline of every line */
  boxLeft: number;
  baselines: number[];
  appear: number;
  lastEnd: number;
  exitStart: number;
  exitDur: number;
  /** true when this block ends its sentence */
  final: boolean;
}

/** Where and how big caption blocks are set (px). */
export interface CaptionGeometry {
  W: number;
  H: number;
  base: FontSpec;
  maxWidth: number;
  maxLines: number;
  lastBaseline: number;
  pitch: number;
}

const OVERLAP_S = 0.03;

type UntimedPage = Omit<CaptionPage, 'exitStart' | 'exitDur'>;

// Layout of one sentence at one geometry never changes: cache it by content,
// so a parent that rebuilds its utterance array every frame costs nothing.
const layoutCache = new Map<string, UntimedPage[]>();
const LAYOUT_CACHE_MAX = 2000;

const geometryKey = (g: CaptionGeometry): string =>
  [g.W, g.H, g.base.size.toFixed(3), g.base.weight, g.maxWidth.toFixed(2), g.maxLines, g.lastBaseline.toFixed(2), g.pitch.toFixed(3)].join('|');

const utteranceKey = (u: Utterance): string => `${u.id}:${u.words.map((w) => `${w.text}/${w.tag}/${w.start}/${w.end}`).join(' ')}`;

const layoutUtterance = (u: Utterance, g: CaptionGeometry, gKey: string): UntimedPage[] => {
  const key = `${gKey}#${utteranceKey(u)}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const boxLeft = (g.W - g.maxWidth) / 2;
  const items: Array<TimedInput & {color: string; glow: boolean}> = u.words.map((w) => {
    const look = tagLook(w.tag, g.base);
    return {text: typo(w.text), tag: w.tag, font: look.font, start: w.start, end: w.end, color: look.color, glow: look.glow};
  });
  const ps = paginate(items, {maxWidth: g.maxWidth, maxLines: g.maxLines, align: 'center', balance: 1});
  const out = ps.map((p, k): UntimedPage => {
    const L = p.layout.lines.length;
    const baselines = p.layout.lines.map((_, i) => px(g.lastBaseline - (L - 1 - i) * g.pitch));
    const runs = p.layout.runs.map((r) => {
      const src = items[p.from + r.i];
      return {...r, start: src.start, end: src.end, color: src.color, glow: src.glow};
    });
    return {
      key: `${u.id}.${k}`,
      runs,
      lines: p.layout.lines,
      boxLeft,
      baselines,
      appear: runs[0].start - caption.wordLeadS,
      lastEnd: runs[runs.length - 1].end,
      final: k === ps.length - 1,
    };
  });
  if (layoutCache.size >= LAYOUT_CACHE_MAX) layoutCache.clear();
  layoutCache.set(key, out);
  return out;
};

/**
 * Pure layout and timing of every caption block for a set of utterances.
 * Exposed so scenes can query where captions are (for Pixie, collisions).
 */
export const buildCaptionPages = (utts: Utterance[], g: CaptionGeometry, skip: readonly string[] = []): CaptionPage[] => {
  const gKey = geometryKey(g);
  const pages: CaptionPage[] = [];
  for (const u of utts) {
    if (skip.includes(u.id) || u.words.length === 0) continue;
    for (const p of layoutUtterance(u, g, gKey)) pages.push({...p, exitStart: 0, exitDur: caption.exitS});
  }
  pages.sort((a, b) => a.appear - b.appear);
  // Exit timing needs the next block: a block leaves before the next appears.
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const nextAppear = i + 1 < pages.length ? pages[i + 1].appear : Infinity;
    const room = nextAppear - p.lastEnd;
    if (p.final) {
      // 0.6-0.85 s when the next sentence leaves room, shorter when it does not
      const hold = Math.max(0.2, Math.min(caption.holdAfterLastWordS[1], room - caption.exitS - 0.02));
      const exitDur = Math.max(0.12, Math.min(caption.exitS, room - hold));
      let exitStart = p.lastEnd + hold;
      if (exitStart + exitDur > nextAppear + OVERLAP_S) exitStart = nextAppear + OVERLAP_S - exitDur;
      p.exitStart = exitStart;
      p.exitDur = exitDur;
    } else {
      // a page turn inside a sentence: hold until the next block appears,
      // clearing in the pause before it
      const exitDur = Math.max(0.12, Math.min(0.2, room));
      const holdMax = caption.holdAfterLastWordS[1];
      p.exitStart = Math.min(nextAppear + OVERLAP_S - exitDur, p.lastEnd + holdMax);
      p.exitDur = exitDur;
    }
  }
  return pages;
};

/** Words of the block, styled for time t. */
const CaptionBlock: React.FC<{page: CaptionPage; t: number; H: number; underline: boolean}> = ({page, t, H, underline}) => {
  const exitK = prog(t, page.exitStart, page.exitDur);
  const pageAlpha = 1 - easeInCubic(exitK);
  const blurMax = (caption.wordBlurAt1080 * H) / REF_H;
  const exitBlur = blurMax * easeInCubic(exitK);

  let active = -1;
  for (let i = 0; i < page.runs.length; i++) if (page.runs[i].start <= t) active = i;

  const out: React.ReactNode[] = [];
  for (let i = 0; i < page.runs.length; i++) {
    const r = page.runs[i];
    const t0 = r.start - caption.wordLeadS;
    if (t < t0) continue;
    const a = prog(t, t0, caption.wordFadeS);
    const deblur = blurMax * (1 - easeOutCubic(prog(t, t0, caption.wordDeblurS)));
    const baseline = page.baselines[r.line];
    const shadow = r.glow ? `${mintGlow(r.font.size, H)}, ${legibilityShadow(r.font.size, H)}` : legibilityShadow(r.font.size, H);
    out.push(
      <span
        key={i}
        style={{
          ...fontCSS(r.font),
          position: 'absolute',
          left: page.boxLeft + r.x,
          top: runTop(baseline, r.font),
          lineHeight: 1.6,
          color: r.color,
          opacity: a,
          filter: blurFilter(deblur),
          textShadow: shadow,
        }}
      >
        {r.text}
      </span>,
    );
  }

  let bar: React.ReactNode = null;
  if (underline && active >= 0) {
    const r = page.runs[active];
    const grow = easeOutCubic(prog(t, r.start, caption.underline.growS));
    const base = r.tag === 'em' ? r.font.size / font.emScale : r.font.size;
    const thick = Math.max(2, Math.round(caption.underline.thicknessEm * base));
    const y = px(page.baselines[r.line] + caption.underline.offsetBelowBaselineEm * base - thick / 2);
    const w = r.ulW * grow;
    if (w > 0.5) {
      bar = (
        <div
          style={{
            position: 'absolute',
            left: page.boxLeft + r.x,
            top: y,
            width: w,
            height: thick,
            borderRadius: thick / 2,
            background: color.accent.mint,
            boxShadow: `0 0 ${(thick * 2.5).toFixed(1)}px rgba(116,201,174,0.35)`,
          }}
        />
      );
    }
  }

  return (
    <div style={{position: 'absolute', inset: 0, opacity: pageAlpha, filter: blurFilter(exitBlur)}}>
      {out}
      {bar}
    </div>
  );
};

/**
 * Word-synced bottom captions. Each block is at most two lines inside 0.8 W,
 * its last baseline on 0.922 H; lines are broken once (measured with the real
 * fonts) and never reflow. Words appear 0.04 s before they are spoken, fade
 * in over 0.1 s and clear from a 6 px (at 1080) blur in 0.25 s. A mint
 * underline grows under the word being spoken. Blocks hold 0.6-0.85 s after
 * their last word, then leave in 0.25 s, before the next block starts.
 */
export const Captions: React.FC<CaptionsProps> = ({
  utterances,
  t: tProp,
  skip,
  scrim = true,
  underline = true,
  lastBaselineH = caption.lastBaselineH,
  maxWidthW = caption.maxWidthW,
  maxLines = caption.maxLines,
  sizeH = type.caption.size,
}) => {
  const t = useTime(tProp);
  const {W, H} = useUnits();
  const ready = useFontsReady();
  const skipKey = skip ? skip.join('|') : '';
  const pages = useMemo(() => {
    if (!ready) return [];
    const base = fontOf('caption', H, {size: sizeH * H});
    return buildCaptionPages(
      utterances,
      {
        W,
        H,
        base,
        maxWidth: maxWidthW * W,
        maxLines,
        lastBaseline: lastBaselineH * H,
        pitch: type.caption.lineHeight * base.size,
      },
      skipKey ? skipKey.split('|') : [],
    );
  }, [ready, utterances, W, H, sizeH, maxWidthW, maxLines, lastBaselineH, skipKey]);

  const visible = pages.filter((p) => t >= p.appear && t < p.exitStart + p.exitDur);
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {scrim ? <Scrim /> : null}
      {visible.map((p) => (
        <CaptionBlock key={p.key} page={p} t={t} H={H} underline={underline} />
      ))}
    </div>
  );
};
