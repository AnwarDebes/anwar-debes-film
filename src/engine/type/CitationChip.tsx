import React from 'react';
import {color, font} from '../tokens';
import {clamp01, easeInCubic, easeOutCubic, easeUI, prog} from './ease';
import {useFontsReady} from './fontsReady';
import type {Align} from './layout';
import {advance, fontCSS, runTop, type FontSpec} from './metrics';
import {Tick} from './Tick';
import {useTime, useUnits} from './units';
import {noteSource} from '../ledger/sources';

export interface CitationChipProps {
  /** repository name, e.g. "glassbox-lm" */
  repo: string;
  /** path inside the repository, e.g. "docs/results-overview.md" */
  path: string;
  /** line or range, e.g. 41 or "37-41" */
  line?: number | string;
  /** when typing starts (s) */
  at: number;
  t?: number;
  /** characters per second */
  cps?: number;
  /** the verified tick after the source is typed (default true) */
  verified?: boolean;
  exitAt?: number;
  /** px: the chip's left edge (align left) or right edge (align right) */
  x: number;
  /** px: the chip's vertical centre */
  y: number;
  align?: Exclude<Align, 'center'>;
  /** font size as a fraction of H */
  sizeH?: number;
  /** px: a hairline pointing from the chip back to its claim (to the left, or right for align right) */
  leader?: number;
  opacity?: number;
}

const SEG_COLORS = {repo: color.text.display, path: color.text.chipDim, line: color.text.display};

/**
 * The source of a claim, typed in beside it: "repo/path:line" in mono on a
 * dark chip, then a verified tick. Every number in the film carries one.
 */
export const CitationChip: React.FC<CitationChipProps> = ({
  repo,
  path,
  line,
  at,
  t: tProp,
  cps = 46,
  verified = true,
  exitAt,
  x,
  y,
  align = 'left',
  sizeH = 0.021,
  leader = 0,
  opacity = 1,
}) => {
  const t = useTime(tProp);
  const {H, hair} = useUnits();
  const ready = useFontsReady();
  if (!ready || t < at) return null;

  const f: FontSpec = {family: font.mono, size: sizeH * H, weight: 500, tracking: 0, features: '"calt" 1'};
  const fs = f.size;
  const segs: Array<[keyof typeof SEG_COLORS, string]> = [
    ['repo', repo],
    ['path', `/${path}`],
  ];
  if (line !== undefined) segs.push(['line', `:${line}`]);
  const full = segs.map((s) => s[1]).join('');
  const N = full.length;
  const charW = advance('0', f);

  const h = Math.round(fs * 1.85);
  const padL = Math.round(fs * 0.72);
  const tickD = Math.round(fs * 0.92);
  const tickGap = Math.round(fs * 0.5);
  const padR = Math.round((h - tickD) / 2);
  const caretW = Math.max(hair * 2, Math.round(fs * 0.085));

  const leaderS = leader > 0 ? 0.22 : 0;
  const typeAt = at + leaderS + 0.08;
  const typedF = clamp01((t - typeAt) / (N / cps)) * N;
  const typed = Math.min(N, Math.floor(typedF + 1e-6));
  const doneAt = typeAt + N / cps;
  const tickAt = doneAt + 0.06;
  const tickK = verified ? easeOutCubic(prog(t, tickAt, 0.22)) : 0;
  const drawK = verified ? easeOutCubic(prog(t, tickAt + 0.08, 0.24)) : 0;
  const caretAlpha = t < doneAt ? 1 : 1 - prog(t, doneAt, 0.12);

  const textW = N * charW;
  const typingW = padL + typedF * charW + caretW + padL;
  const finalW = verified ? padL + textW + tickGap + tickD + padR : padL + textW + padL;
  const settle = verified ? easeUI(prog(t, doneAt, 0.24)) : prog(t, doneAt, 0.01);
  const w = t < doneAt ? typingW : typingW + (finalW - typingW) * settle;

  let alpha = opacity * easeOutCubic(prog(t, at + leaderS, 0.14));
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, 0.3);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
  }
  noteSource(t, {kind: 'chip', repo, path, line});
  const top = Math.round(y - h / 2);
  // right-aligned chips reserve their final width so the text types rightwards
  const left = Math.round(align === 'left' ? x : x - finalW);
  const baseline = Math.round(y + 0.35 * fs);

  // the typed text, segment by segment
  let rest = typed;
  const spans: React.ReactNode[] = [];
  segs.forEach(([kind, s], i) => {
    if (rest <= 0) return;
    const part = s.slice(0, rest);
    rest -= part.length;
    spans.push(
      <span key={i} style={{color: SEG_COLORS[kind]}}>
        {part}
      </span>,
    );
  });

  const leaderK = leader > 0 ? easeUI(prog(t, at, leaderS)) : 0;
  const leaderLen = leader * leaderK;
  const dot = Math.max(hair * 3, Math.round(fs * 0.22));
  const textLeft = left + padL;

  return (
    <div style={{position: 'absolute', inset: 0, opacity: alpha, pointerEvents: 'none'}}>
      {leader > 0 ? (
        <>
          <div
            style={{
              position: 'absolute',
              top: Math.round(y - hair / 2),
              height: hair,
              width: leaderLen,
              left: align === 'left' ? Math.round(x) - leaderLen : Math.round(x),
              background: color.card.ruleStrong,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              top: Math.round(y - dot / 2),
              left: align === 'left' ? Math.round(x - leader - dot / 2) : Math.round(x + leader - dot / 2),
              background: color.text.chipDim,
              opacity: leaderK,
            }}
          />
        </>
      ) : null}
      {t >= at + leaderS ? (
        <>
          <div
            style={{
              position: 'absolute',
              left,
              top,
              width: w,
              height: h,
              borderRadius: h / 2,
              background: 'rgba(19,19,19,0.94)',
              border: `${hair}px solid rgba(228,234,231,0.16)`,
              boxSizing: 'border-box',
              boxShadow: `0 ${Math.round(fs * 0.25)}px ${Math.round(fs * 0.9)}px rgba(0,0,0,0.35)`,
            }}
          />
          <span style={{...fontCSS(f), position: 'absolute', left: textLeft, top: runTop(baseline, f), lineHeight: 1.6}}>{spans}</span>
          {caretAlpha > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: Math.round(textLeft + typedF * charW + hair),
                top: Math.round(y - fs * 0.55),
                width: caretW,
                height: Math.round(fs * 1.1),
                background: color.accent.mint,
                opacity: 0.9 * caretAlpha,
              }}
            />
          ) : null}
          {verified && tickK > 0 ? (
            <div
              style={{
                position: 'absolute',
                left: Math.round(left + w - padR - tickD),
                top: Math.round(y - tickD / 2),
                width: tickD,
                height: tickD,
                opacity: tickK,
                transform: tickK < 1 ? `scale(${(0.45 + 0.55 * tickK).toFixed(4)})` : undefined,
              }}
            >
              <Tick size={tickD} draw={drawK} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
