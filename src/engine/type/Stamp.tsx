import React from 'react';
import {color, font, motion} from '../tokens';
import {easeInCubic, easeOutCubic, prog} from './ease';
import {useFontsReady} from './fontsReady';
import {capHeightOf, fontCSS, inkWidth, runTop, type FontSpec} from './metrics';
import {useTime, useUnits} from './units';

export type StampKind =
  | 'PROVED'
  | 'VERIFIED'
  | 'MET'
  | 'HOLDS'
  | 'PASSED'
  | 'NOT MET'
  | 'FAILED'
  | 'REFUTED'
  | 'BLOCKED'
  | 'COUNTEREXAMPLE'
  | 'NOT JUDGED'
  | 'NOT RUN';

/** Verdict colours are used only for meaning: mint holds, red fails, amber is a found counterexample or unjudged. */
export const STAMPS: Record<StampKind, {tone: string; filled: boolean}> = {
  PROVED: {tone: color.accent.mint, filled: false},
  VERIFIED: {tone: color.accent.mint, filled: false},
  MET: {tone: color.accent.mint, filled: false},
  HOLDS: {tone: color.accent.mint, filled: false},
  PASSED: {tone: color.accent.mint, filled: false},
  'NOT MET': {tone: color.signal.verdictRed, filled: false},
  FAILED: {tone: color.signal.verdictRed, filled: false},
  REFUTED: {tone: color.signal.verdictRed, filled: false},
  BLOCKED: {tone: color.signal.verdictRed, filled: false},
  COUNTEREXAMPLE: {tone: color.signal.amber, filled: true},
  'NOT JUDGED': {tone: color.signal.amber, filled: false},
  'NOT RUN': {tone: color.text.secondary, filled: false},
};

export interface StampProps {
  kind?: StampKind;
  /** custom label (with tone/filled) instead of a kind */
  label?: string;
  tone?: string;
  filled?: boolean;
  /** when it lands: the stamp drops for 0.35 s before this time plus `at` */
  at: number;
  t?: number;
  exitAt?: number;
  /** px: centre */
  x: number;
  y: number;
  /** label size as a fraction of H */
  sizeH?: number;
  rotate?: number;
  opacity?: number;
}

const hexA = (hex: string, a: number): string => {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * A verdict stamp: mono caps in an outlined (or filled) rounded box, set at
 * −4°. It drops from 1.6× and lands in 0.35 s, accelerating like a stamp,
 * and the impact leaves a faint ring that spreads and fades.
 */
export const Stamp: React.FC<StampProps> = ({
  kind = 'PROVED',
  label,
  tone: toneProp,
  filled: filledProp,
  at,
  t: tProp,
  exitAt,
  x,
  y,
  sizeH = 0.026,
  rotate = motion.stamp.rotateDeg,
  opacity = 1,
}) => {
  const t = useTime(tProp);
  const {H} = useUnits();
  const ready = useFontsReady();
  if (!ready || t < at) return null;
  const spec = STAMPS[kind];
  const tone = toneProp ?? spec.tone;
  const filled = filledProp ?? spec.filled;
  const text = (label ?? kind).toUpperCase();
  const fs = sizeH * H;
  const f: FontSpec = {family: font.mono, size: fs, weight: 700, tracking: 0.12};
  const textW = inkWidth(text, f);
  const border = Math.max(2, Math.round(fs * 0.085));
  const padX = Math.round(fs * 0.62);
  const h = Math.round(fs * 1.62);
  const w = Math.round(textW + 2 * padX);
  const radius = Math.round(fs * 0.24);

  const dur = motion.stamp.durS;
  const p = prog(t, at, dur);
  // slow at first, fastest at contact: s(p) = 1 + 0.6 (1 − p²)
  const scale = 1 + (motion.stamp.fromScale - 1) * (1 - p * p);
  let alpha = easeOutCubic(prog(t, at, dur * 0.5)) * opacity;
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, 0.3);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
  }
  const ringK = prog(t, at + dur, 0.45);
  const ring = ringK > 0 && ringK < 1;

  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: Math.round(x - w / 2),
    top: Math.round(y - h / 2),
    width: w,
    height: h,
    borderRadius: radius,
    boxSizing: 'border-box',
  };
  const baselineLocal = Math.round(h / 2 + capHeightOf(f) / 2);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: alpha, pointerEvents: 'none'}}>
      {ring ? (
        <div
          style={{
            ...boxStyle,
            border: `${border}px solid ${tone}`,
            opacity: 0.45 * (1 - easeOutCubic(ringK)),
            transform: `rotate(${rotate}deg) scale(${(1 + 0.22 * easeOutCubic(ringK)).toFixed(4)})`,
          }}
        />
      ) : null}
      <div
        style={{
          ...boxStyle,
          border: `${border}px solid ${tone}`,
          background: filled ? tone : hexA(tone, 0.08),
          boxShadow: filled ? `0 0 ${Math.round(fs * 0.8)}px ${hexA(tone, 0.25)}` : `0 0 ${Math.round(fs * 0.6)}px ${hexA(tone, 0.12)}`,
          transform: p < 1 ? `rotate(${rotate}deg) scale(${scale.toFixed(4)})` : `rotate(${rotate}deg)`,
        }}
      >
        <span
          style={{
            ...fontCSS(f),
            position: 'absolute',
            left: padX - border,
            top: runTop(baselineLocal, f) - border,
            lineHeight: 1.6,
            color: filled ? '#0B0F0D' : tone,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
