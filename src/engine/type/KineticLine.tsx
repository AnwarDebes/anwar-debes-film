import React, {useMemo} from 'react';
import type {Word} from '../narration/types';
import {caption, color, font, motion, type, type TypeStyle} from '../tokens';
import {blurFilter, easeInCubic, easeOutCubic, easeText, easeUI, prog} from './ease';
import {useFontsReady} from './fontsReady';
import {layoutBlock, type Align, type BlockLayout} from './layout';
import {typo, wordsFromMarkup} from './markup';
import {capHeightOf, faceMetrics, fontCSS, inkBearings, runTop, type FontSpec} from './metrics';
import {fontOf, legibilityShadow, mintGlow, tagLook} from './styles';
import {px, REF_H, useTime, useUnits} from './units';

export type KineticVariant = 'rise' | 'focus' | 'mask';

export interface KineticLineProps {
  /** spoken words with film times; each enters on its own start time */
  words?: readonly Word[];
  /** or a line that is not spoken: markup with *idea* and **term** words */
  text?: string;
  /** with `text`: time of the first word, and the stagger between words */
  at?: number;
  perWordS?: number;
  t?: number;
  /** type style from the tokens (headline by default) */
  kind?: TypeStyle;
  /** font size override as a fraction of H */
  sizeH?: number;
  /** override of the style's weight for plain words */
  weight?: number;
  variant?: KineticVariant;
  /** px. The left edge (align left), the centre (center) or the right edge (right). Default: the 7% margin, or the frame centre. */
  x?: number;
  /** px. The anchor line given by yAnchor. Default: headline cap top at 0.12 H. */
  y?: number;
  yAnchor?: 'capTop' | 'firstBaseline' | 'lastBaseline';
  align?: Align;
  /** px. Default 0.45 W − margin for left, 0.8 W centred. */
  maxWidth?: number;
  maxLines?: number;
  /** em, default from the style */
  lineHeight?: number;
  /** plain-word colour */
  color?: string;
  emWeight?: number;
  /** when the line leaves with a focus pull */
  exitAt?: number;
  exitS?: number;
  /** a word starts entering this long before it is spoken */
  leadS?: number;
  /** a mint underline that follows the spoken word, as in captions */
  underline?: boolean;
  /** soft dark halo for legibility over lit pins (default true) */
  halo?: boolean;
  /** opacity multiplier from a parent (cards) */
  opacity?: number;
  /** align left/right lines by their ink rather than the pen origin (default true) */
  optical?: boolean;
}

const DEFAULT_LEAD: Record<KineticVariant, number> = {rise: 0.12, focus: 0.06, mask: 0.1};
const ENTER_S: Record<KineticVariant, number> = {rise: 0.55, focus: motion.textFocusPull.inS, mask: 0.62};

export interface KineticGeometry {
  layout: BlockLayout;
  baselines: number[];
  boxLeft: number;
  base: FontSpec;
  /** per line: optical shift in px (added to x) */
  lineShift: number[];
}

/**
 * Display words that enter on their spoken time: headlines, statements,
 * titles. The block is laid out once in its final position (balanced lines,
 * breaks at punctuation) and words only animate into it.
 */
export const KineticLine: React.FC<KineticLineProps> = (props) => {
  const {
    words: wordsProp,
    text,
    at = 0,
    perWordS = 0.12,
    t: tProp,
    kind = 'headline',
    sizeH,
    weight,
    variant = 'rise',
    align = 'left',
    maxLines = 4,
    color: plainColor = color.text.display,
    emWeight,
    exitAt,
    exitS = motion.textFocusPull.outS,
    underline = false,
    halo = true,
    opacity = 1,
  } = props;
  const t = useTime(tProp);
  const {W, H, w: fw, h: fh} = useUnits();
  const ready = useFontsReady();

  const words = useMemo<readonly Word[]>(
    () => wordsProp ?? (text ? wordsFromMarkup(text, at, perWordS) : []),
    [wordsProp, text, at, perWordS],
  );

  const margin = fw(0.069);
  const x = props.x ?? (align === 'left' ? margin : align === 'right' ? W - margin : W / 2);
  const maxWidth = props.maxWidth ?? (align === 'center' ? fw(0.8) : fw(0.45) - margin);
  const lineHeight = props.lineHeight ?? type[kind].lineHeight;

  const geo = useMemo<KineticGeometry | null>(() => {
    if (!ready || words.length === 0) return null;
    const base = fontOf(kind, H, {...(sizeH ? {size: sizeH * H} : {}), ...(weight ? {weight} : {})});
    const items = words.map((w) => {
      const look = tagLook(w.tag, base, {plainColor, emWeight, keyWeight: Math.min(800, base.weight + 100)});
      return {text: typo(w.text), tag: w.tag, font: look.font};
    });
    const lay = layoutBlock(items, {maxWidth, maxLines, align, balance: align === 'center' ? 1 : 0.6, boxWidth: maxWidth});
    const pitch = lineHeight * base.size;
    const L = lay.lines.length;
    const yAnchor = props.yAnchor ?? 'capTop';
    const y = props.y ?? fh(0.12);
    const first = yAnchor === 'firstBaseline' ? y : yAnchor === 'lastBaseline' ? y - (L - 1) * pitch : y + capHeightOf(base);
    const baselines = lay.lines.map((_, i) => px(first + i * pitch));
    const boxLeft = align === 'left' ? x : align === 'right' ? x - maxWidth : x - maxWidth / 2;
    const optical = props.optical ?? true;
    const lineShift = lay.lines.map((ln) => {
      if (!optical || align === 'center') return 0;
      if (align === 'left') {
        const r = lay.runs[ln.first];
        return -inkBearings(r.text, r.font).left;
      }
      const r = lay.runs[ln.last];
      return inkBearings(r.text, r.font).right;
    });
    return {layout: lay, baselines, boxLeft, base, lineShift};
  }, [ready, words, kind, H, sizeH, weight, plainColor, emWeight, maxWidth, maxLines, align, lineHeight, props.yAnchor, props.y, props.optical, fh, x]);

  if (!geo) return null;
  const lead = props.leadS ?? DEFAULT_LEAD[variant];
  const enterS = ENTER_S[variant];
  const blurIn = (motion.textFocusPull.blurAt1080 * H) / REF_H;
  const exitK = exitAt === undefined ? 0 : prog(t, exitAt, exitS);
  if (exitK >= 1 || opacity <= 0) return null;
  const blockAlpha = (1 - easeInCubic(exitK)) * opacity;
  const exitBlur = blurIn * easeInCubic(exitK);

  const looks = words.map((w) => tagLook(w.tag, geo.base, {plainColor, emWeight}));
  let active = -1;
  for (let i = 0; i < words.length; i++) if (words[i].start <= t) active = i;

  const nodes: React.ReactNode[] = [];
  for (const r of geo.layout.runs) {
    const w = words[r.i];
    const t0 = w.start - lead;
    if (t < t0) continue;
    const k = prog(t, t0, enterS);
    const baseline = geo.baselines[r.line];
    const left = geo.boxLeft + r.x + geo.lineShift[r.line];
    const look = looks[r.i];
    const shadow = [look.glow ? mintGlow(r.font.size, H) : '', halo ? legibilityShadow(r.font.size, H, 0.8) : ''].filter(Boolean).join(', ') || undefined;
    const runStyle: React.CSSProperties = {
      ...fontCSS(r.font),
      position: 'absolute',
      lineHeight: 1.6,
      color: look.color,
      textShadow: shadow,
    };
    if (variant === 'mask' && k < 1) {
      // the word rises inside a window that ends at the line's descender
      const asc = (r.font.style === 'italic' ? faceMetrics.serifItalic.asc : faceMetrics.sans.asc) * r.font.size;
      const desc = Math.max(faceMetrics.sans.desc * geo.base.size, (r.font.style === 'italic' ? faceMetrics.serifItalic.desc : faceMetrics.sans.desc) * r.font.size);
      const padX = 0.3 * r.font.size;
      const clipTop = baseline - asc - 0.12 * r.font.size;
      const clipH = asc + desc + 0.2 * r.font.size;
      const travel = clipH;
      const dy = (1 - easeUI(k)) * travel;
      nodes.push(
        <span
          key={r.i}
          style={{position: 'absolute', left: left - padX, top: clipTop, width: r.w + 2 * padX, height: clipH, overflow: 'hidden'}}
        >
          <span style={{...runStyle, left: padX, top: runTop(baseline, r.font) - clipTop, transform: `translateY(${dy.toFixed(2)}px)`, opacity: easeOutCubic(prog(t, t0, 0.12))}}>
            {r.text}
          </span>
        </span>,
      );
      continue;
    }
    let opacityRun = 1;
    let transform: string | undefined;
    let filter: string | undefined;
    if (variant === 'rise') {
      opacityRun = easeOutCubic(prog(t, t0, 0.3));
      const dy = (1 - easeText(k)) * 0.42 * geo.base.size;
      transform = dy > 0.01 ? `translateY(${dy.toFixed(2)}px)` : undefined;
      filter = blurFilter(blurIn * 0.5 * (1 - easeOutCubic(prog(t, t0, 0.3))));
    } else if (variant === 'focus') {
      opacityRun = easeOutCubic(prog(t, t0, 0.25));
      filter = blurFilter(blurIn * (1 - easeOutCubic(k)));
    }
    nodes.push(
      <span key={r.i} style={{...runStyle, left, top: runTop(baseline, r.font), opacity: opacityRun, transform, filter}}>
        {r.text}
      </span>,
    );
  }

  let bar: React.ReactNode = null;
  if (underline && active >= 0) {
    const r = geo.layout.runs.find((q) => q.i === active);
    if (r) {
      const grow = easeOutCubic(prog(t, words[active].start, caption.underline.growS));
      const baseSize = r.tag === 'em' ? r.font.size / font.emScale : r.font.size;
      const thick = Math.max(2, Math.round(caption.underline.thicknessEm * baseSize));
      const top = px(geo.baselines[r.line] + caption.underline.offsetBelowBaselineEm * baseSize - thick / 2);
      if (r.ulW * grow > 0.5) {
        bar = (
          <div
            style={{
              position: 'absolute',
              left: geo.boxLeft + r.x + geo.lineShift[r.line],
              top,
              width: r.ulW * grow,
              height: thick,
              borderRadius: thick / 2,
              background: color.accent.mint,
              boxShadow: `0 0 ${(thick * 2.5).toFixed(1)}px rgba(116,201,174,0.35)`,
            }}
          />
        );
      }
    }
  }

  return (
    <div style={{position: 'absolute', inset: 0, opacity: blockAlpha, filter: blurFilter(exitBlur), pointerEvents: 'none'}}>
      {nodes}
      {bar}
    </div>
  );
};
