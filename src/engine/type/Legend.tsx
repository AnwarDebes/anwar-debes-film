import React, {useMemo} from 'react';
import {color, font, motion} from '../tokens';
import {blurFilter, easeInCubic, easeOutCubic, easeUI, prog} from './ease';
import {useFontsReady} from './fontsReady';
import {capHeightOf, fontCSS, inkWidth, runTop, type FontSpec} from './metrics';
import {countAt, countingRun, formatNumber, SETTLE_S} from './Numeral';
import {slotRun} from './digits';
import {legibilityShadow} from './styles';
import {REF_H, useTime, useUnits} from './units';

export interface LegendItem {
  label: string;
  count?: number;
  color: string;
  /** an outlined swatch (e.g. "not run") */
  outline?: boolean;
}

export interface LegendProps {
  items: readonly LegendItem[];
  t?: number;
  /** first item enters here; the rest follow by `stagger` */
  at?: number;
  stagger?: number;
  /** each count runs up over this long as its item enters */
  countS?: number;
  exitAt?: number;
  direction?: 'row' | 'column';
  /** text size as a fraction of H */
  sizeH?: number;
  /** px: left edge */
  x: number;
  /** px: baseline of the first row */
  y: number;
  opacity?: number;
}

/**
 * Colour swatches with counts: "■ 12 met  ■ 11 not met  ■ 7 not judged  □ 61 not run".
 * Counts are bold figures that run up as each item enters and close to
 * their natural spacing as they land; labels never move.
 */
export const Legend: React.FC<LegendProps> = ({
  items,
  t: tProp,
  at = 0,
  stagger = 0.14,
  countS = 0.7,
  exitAt,
  direction = 'row',
  sizeH = 0.027,
  x,
  y,
  opacity = 1,
}) => {
  const t = useTime(tProp);
  const {H, hair} = useUnits();
  const ready = useFontsReady();
  const fs = sizeH * H;
  const countFont = useMemo<FontSpec>(() => ({family: font.sans, size: fs, weight: 700, tracking: -0.01, features: '"kern" 1'}), [fs]);
  const labelFont = useMemo<FontSpec>(() => ({family: font.sans, size: fs, weight: 500, tracking: -0.01}), [fs]);

  const geo = useMemo(() => {
    if (!ready) return null;
    const sw = Math.round(fs * 0.62);
    const gapSw = fs * 0.42;
    const gapNum = fs * 0.3;
    const gapItem = fs * 1.3;
    const natural = items.map((it) => (it.count === undefined ? 0 : inkWidth(formatNumber(it.count), countFont)));
    const slots = items.map((it) => (it.count === undefined ? 0 : slotRun(formatNumber(it.count), countFont).width));
    const colW = Math.max(0, ...natural);
    const pitch = Math.round(fs * 1.75);
    let pen = 0;
    return items.map((it, i) => {
      const cw = direction === 'column' ? colW : natural[i];
      const ox = direction === 'row' ? pen : 0;
      const oy = direction === 'row' ? 0 : i * pitch;
      const countRight = ox + sw + gapSw + cw;
      const labelX = it.count === undefined ? ox + sw + gapSw : countRight + gapNum;
      if (direction === 'row') pen = labelX + inkWidth(it.label, labelFont) + gapItem;
      return {ox, oy, sw, gapSw, countRight, labelX, slotW: slots[i]};
    });
  }, [ready, items, fs, countFont, labelFont, direction]);

  if (!geo || t < at) return null;
  const blurMax = (motion.textFocusPull.blurAt1080 * H) / REF_H;
  let groupAlpha = opacity;
  let groupBlur = 0;
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, motion.textFocusPull.outS);
    if (k >= 1) return null;
    groupAlpha *= 1 - easeInCubic(k);
    groupBlur = blurMax * 0.6 * easeInCubic(k);
  }
  const capH = capHeightOf(countFont);
  const halo = legibilityShadow(fs, H, 1);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: groupAlpha, filter: blurFilter(groupBlur), pointerEvents: 'none'}}>
      {items.map((it, i) => {
        const g = geo[i];
        const ti = at + i * stagger;
        if (t < ti) return null;
        const a = easeOutCubic(prog(t, ti, 0.3));
        const swK = easeOutCubic(prog(t, ti, 0.32));
        const baseline = Math.round(y + g.oy);
        const swTop = Math.round(baseline - capH / 2 - g.sw / 2);
        const x0 = Math.round(x);
        let swLeft = x0 + g.ox;
        let count: React.ReactNode = null;
        if (it.count !== undefined) {
          const land = ti + countS;
          const s = formatNumber(countAt(t, {value: it.count, from: 0, landAt: land, countS}));
          const run = countingRun(s, countFont, g.slotW, easeUI(prog(t, land, SETTLE_S)));
          // counts are right-aligned to the label; in a row the swatch keeps its gap to the count
          const countLeft = x0 + g.countRight - (run.width - (countFont.tracking ?? 0) * fs);
          if (direction === 'row') swLeft = Math.round(countLeft - g.gapSw - g.sw);
          count = run.chars.map((c, j) => (
            <span
              key={j}
              style={{
                ...fontCSS(countFont),
                position: 'absolute',
                left: countLeft + run.xs[j],
                top: runTop(baseline, countFont),
                lineHeight: 1.6,
                color: color.text.display,
                opacity: a,
                textShadow: halo,
              }}
            >
              {c}
            </span>
          ));
        }
        const labelBlur = blurMax * 0.6 * (1 - easeOutCubic(prog(t, ti + 0.05, 0.3)));
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: swLeft,
                top: swTop,
                width: g.sw,
                height: g.sw,
                borderRadius: Math.round(fs * 0.16),
                background: it.outline ? 'transparent' : it.color,
                border: it.outline ? `${Math.max(hair, Math.round(fs * 0.07))}px solid ${it.color}` : undefined,
                boxSizing: 'border-box',
                boxShadow: it.outline ? undefined : `0 0 ${Math.round(fs * 0.5)}px ${it.color}40`,
                opacity: a,
                transform: swK < 1 ? `scale(${(0.5 + 0.5 * swK).toFixed(4)})` : undefined,
              }}
            />
            {count}
            <span
              style={{
                ...fontCSS(labelFont),
                position: 'absolute',
                left: x0 + g.labelX,
                top: runTop(baseline, labelFont),
                lineHeight: 1.6,
                color: color.text.chipDim,
                opacity: a,
                filter: blurFilter(labelBlur),
                textShadow: halo,
              }}
            >
              {it.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};
