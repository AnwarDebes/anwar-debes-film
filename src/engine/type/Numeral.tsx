import React, {useMemo} from 'react';
import {color, motion, type TypeStyle} from '../tokens';
import {blurFilter, clamp01, easeInCubic, easeOutCubic, easeUI, prog} from './ease';
import {blendRuns, naturalRun, slotRun, type GlyphRun} from './digits';
import {useFontsReady} from './fontsReady';
import {advance, fontCSS, inkBearings, inkWidth, runTop, type FontSpec} from './metrics';
import {fontOf, legibilityShadow} from './styles';
import {REF_H, useTime, useUnits} from './units';

export interface NumeralProps {
  /** the value it lands on (for a power, the exponent) */
  value: number;
  /** where the count starts (default 0) */
  from?: number;
  /** film time (s) at which the value lands: the start of the spoken word */
  landAt?: number;
  /** length of the count before landAt (default 1.2 s) */
  countS?: number;
  /** a count in steps synced to several words: [time, value] pairs; overrides from/landAt */
  keys?: ReadonlyArray<readonly [number, number]>;
  decimals?: number;
  /** thousands separators (default: values of 10,000 and up) */
  group?: boolean;
  prefix?: string;
  /** e.g. 'µs', 'KiB', '%', 'bits per byte': set smaller, after a gap */
  unit?: string;
  unitScale?: number;
  /** a power: this base with the counted value as a real superscript (2^256) */
  base?: number | string;
  kind?: TypeStyle;
  sizeH?: number;
  weight?: number;
  color?: string;
  unitColor?: string;
  t?: number;
  /** fade/focus-in time (default: 0.15 s before the count starts) */
  enterAt?: number;
  exitAt?: number;
  /** px: x is the left or right edge (align); baseline is the numeral's baseline */
  x?: number;
  baseline?: number;
  align?: 'left' | 'right';
  opacity?: number;
}

const MINUS = '−';
/** how long the figures take to close from counting slots to their natural spacing */
export const SETTLE_S = 0.45;

/** 1234.5 → "1,234.5" with a true minus sign. */
export const formatNumber = (v: number, decimals = 0, group = false): string => {
  const neg = v < 0;
  const s = Math.abs(v).toFixed(decimals);
  const [int, frac] = s.split('.');
  const g = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int;
  return `${neg ? MINUS : ''}${g}${frac !== undefined ? `.${frac}` : ''}`;
};

export interface CountSpec {
  value: number;
  from?: number;
  landAt?: number;
  countS?: number;
  keys?: ReadonlyArray<readonly [number, number]>;
  decimals?: number;
}

/** The count at time t, quantized toward the start so the final value appears exactly on landing. */
export const countAt = (t: number, o: CountSpec): number => {
  const q = Math.pow(10, o.decimals ?? 0);
  const quant = (v: number, up: boolean) => (up ? Math.floor(v * q + 1e-9) : Math.ceil(v * q - 1e-9)) / q;
  const seg = (ta: number, va: number, tb: number, vb: number): number => {
    if (t >= tb) return vb;
    if (t <= ta) return va;
    const v = va + (vb - va) * easeOutCubic(clamp01((t - ta) / (tb - ta)));
    return quant(v, vb >= va);
  };
  if (o.keys && o.keys.length > 0) {
    const k = o.keys;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 0; i < k.length - 1; i++) if (t < k[i + 1][0]) return seg(k[i][0], k[i][1], k[i + 1][0], k[i + 1][1]);
    return k[k.length - 1][1];
  }
  const land = o.landAt ?? 0;
  return seg(land - (o.countS ?? 1.2), o.from ?? 0, land, o.value);
};

/** The value the count ends on. */
export const landValue = (o: CountSpec): number => (o.keys && o.keys.length ? o.keys[o.keys.length - 1][1] : o.value);

/** When the count lands for good. */
export const landTime = (o: CountSpec): number => (o.keys && o.keys.length ? o.keys[o.keys.length - 1][0] : (o.landAt ?? 0));

/**
 * Layout of a counting figure string at time t: digits in tabular slots while
 * counting (right-aligned in the widest value's slot width, so nothing moves),
 * easing into natural spacing over SETTLE_S after the landing.
 */
export const countingRun = (s: string, f: FontSpec, slotWidthMax: number, settle: number): GlyphRun => {
  const slots = slotRun(s, f);
  const offset = slotWidthMax - slots.width;
  const shifted: GlyphRun = {...slots, xs: slots.xs.map((x) => x + offset), width: slotWidthMax};
  if (settle <= 0) return shifted;
  return blendRuns(shifted, naturalRun(s, f), settle);
};

interface Run {
  text: string;
  font: FontSpec;
  x: number;
  /** baseline offset (negative = raised) */
  dy: number;
  color: string;
}

/**
 * A number that counts up and lands on a spoken word. Figures count in
 * tabular slots and close to their natural spacing as the value lands; true
 * minus, grouping, a smaller unit after a gap, and real superscripts from the
 * font's sups glyphs for powers (2²⁵⁶, 10⁻¹⁶).
 */
export const Numeral: React.FC<NumeralProps> = (p) => {
  const {
    value,
    from = 0,
    landAt,
    countS = 1.2,
    keys,
    decimals = 0,
    prefix = '',
    unit,
    unitScale = 0.36,
    base,
    kind = 'numeralXL',
    sizeH,
    weight,
    color: fg = color.text.display,
    unitColor = color.text.secondary,
    t: tProp,
    exitAt,
    align = 'left',
    opacity = 1,
  } = p;
  const t = useTime(tProp);
  const {H, w: fw, h: fh} = useUnits();
  const ready = useFontsReady();
  const group = p.group ?? Math.abs(value) >= 10000;
  const x = p.x ?? fw(0.069);
  const baseline = Math.round(p.baseline ?? fh(0.35));

  const f = useMemo(() => fontOf(kind, H, {...(sizeH ? {size: sizeH * H} : {}), ...(weight ? {weight} : {}), features: '"kern" 1'}), [kind, H, sizeH, weight]);
  const supFont = useMemo<FontSpec>(() => ({...f, features: '"sups" 1'}), [f]);
  const unitFont = useMemo<FontSpec>(() => ({...fontOf('tagline', H), size: f.size * unitScale, weight: 500}), [f, H, unitScale]);

  const spec: CountSpec = {value, from, landAt, countS, keys, decimals};
  const startT = keys && keys.length ? keys[0][0] : (landAt ?? 0) - countS;
  const enterAt = p.enterAt ?? startT - 0.15;
  const cur = countAt(t, spec);
  const settle = easeUI(prog(t, landTime(spec), SETTLE_S));
  const finalsKey = (keys && keys.length ? keys.map((k) => k[1]) : [from, value]).join(',');

  const slotMax = useMemo(() => {
    if (!ready) return 0;
    const finals = finalsKey.split(',').map(Number);
    return Math.max(...finals.map((v) => slotRun(formatNumber(v, decimals, group), f).width));
  }, [ready, finalsKey, decimals, group, f]);

  if (!ready || t < enterAt) return null;

  const runs: Run[] = [];
  let pen = 0;
  if (prefix) {
    runs.push({text: prefix, font: f, x: 0, dy: 0, color: fg});
    pen += advance(prefix, f);
  }
  if (base !== undefined) {
    // a power: the base, then the counted exponent in superscript figures
    const b = String(base);
    runs.push({text: b, font: f, x: pen, dy: 0, color: fg});
    pen += advance(b, f) + 0.02 * f.size;
    const e = formatNumber(cur, decimals, false);
    let es = e;
    if (e.startsWith(MINUS)) {
      // the sans has no superscript minus: a small minus centred on the sups figures
      const mf: FontSpec = {...f, size: f.size * 0.6, features: 'normal'};
      runs.push({text: MINUS, font: mf, x: pen, dy: -0.367 * f.size, color: fg});
      pen += advance(MINUS, mf) - 0.04 * f.size;
      es = e.slice(1);
    }
    runs.push({text: es, font: supFont, x: pen, dy: 0, color: fg});
  } else {
    const s = formatNumber(cur, decimals, group);
    const run = countingRun(s, f, slotMax, settle);
    run.chars.forEach((c, i) => runs.push({text: c, font: f, x: pen + run.xs[i], dy: 0, color: fg}));
    pen += run.width;
    if (unit) {
      pen += 0.14 * f.size;
      runs.push({text: unit, font: unitFont, x: pen, dy: 0, color: unitColor});
    }
  }

  const blurMax = (motion.textFocusPull.blurAt1080 * H) / REF_H;
  let alpha = easeOutCubic(prog(t, enterAt, 0.25)) * opacity;
  let blur = blurMax * (1 - easeOutCubic(prog(t, enterAt, motion.textFocusPull.inS)));
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, motion.textFocusPull.outS);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
    blur = Math.max(blur, blurMax * easeInCubic(k));
  }
  const last = runs[runs.length - 1];
  const total = last.x + inkWidth(last.text, last.font);
  // optical margin: the settled figures' ink, not their pen origin, sits on x
  const settledText = base !== undefined ? `${prefix}${base}` : `${prefix}${formatNumber(landValue(spec), decimals, group)}`;
  const bear = inkBearings(settledText, f);
  const left = align === 'left' ? x - bear.left : x - total + (unit ? 0 : bear.right);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: alpha, filter: blurFilter(blur), pointerEvents: 'none'}}>
      {runs.map((r, i) => (
        <span
          key={i}
          style={{
            ...fontCSS(r.font),
            position: 'absolute',
            left: left + r.x,
            top: runTop(Math.round(baseline + r.dy), r.font),
            lineHeight: 1.6,
            color: r.color,
            textShadow: legibilityShadow(r.font.size, H, 0.7),
          }}
        >
          {r.text}
        </span>
      ))}
    </div>
  );
};

/** Width in px of a numeral once it has landed and settled (for placing chips beside it). */
export const useNumeralWidth = (o: {value: number; decimals?: number; group?: boolean; kind?: TypeStyle; sizeH?: number; weight?: number; unit?: string; unitScale?: number}): number => {
  const {H} = useUnits();
  const ready = useFontsReady();
  return useMemo(() => {
    if (!ready) return 0;
    const f = fontOf(o.kind ?? 'numeralXL', H, {...(o.sizeH ? {size: o.sizeH * H} : {}), ...(o.weight ? {weight: o.weight} : {}), features: '"kern" 1'});
    const group = o.group ?? Math.abs(o.value) >= 10000;
    let w = inkWidth(formatNumber(o.value, o.decimals ?? 0, group), f);
    if (o.unit) {
      const uf = {...fontOf('tagline', H), size: f.size * (o.unitScale ?? 0.36), weight: 500};
      w += 0.14 * f.size + inkWidth(o.unit, uf);
    }
    return w;
  }, [ready, H, o.value, o.decimals, o.group, o.kind, o.sizeH, o.weight, o.unit, o.unitScale]);
};
