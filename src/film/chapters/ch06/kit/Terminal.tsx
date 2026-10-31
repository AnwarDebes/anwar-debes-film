import React, {useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import {color, font} from '../../../../engine/tokens';
import {easeInCubic, easeOutCubic, easeUI, prog} from '../../../../engine/type';
import type {TermSchedule} from './termSchedule';

// A terminal card for a real on-camera check: the capture is shown exactly as printed, wrapped at
// the window's width the way a terminal wraps it, scrolling once it fills. Spans that match
// `mask` (placeholder addresses) are covered by a bar of the same width, never retyped.

export interface TerminalProps {
  t: number;
  at: number;
  exitAt: number;
  schedule: TermSchedule;
  /** title bar text, e.g. "reins · fresh clone @ 6f0cf55 · 29 Oct 2026" */
  title: string;
  /** px: top-left and width */
  x: number;
  y: number;
  width: number;
  /** visible rows */
  rows: number;
  /** font size as a fraction of H (>= 0.022) */
  sizeH?: number;
  /** prompt shown before commands */
  prompt?: string;
  mask?: RegExp;
  /** lines to light mint once printed (a printed pass) */
  pass?: (text: string) => boolean;
}

interface Row {
  line: number;
  text: string;
  /** characters of the command typed when this row starts (for wrapped commands) */
  offset: number;
  kind: 'cmd' | 'out' | 'note';
  first: boolean;
}

const MONO_ADVANCE = 0.6;

export const Terminal: React.FC<TerminalProps> = ({t, at, exitAt, schedule, title, x, y, width, rows, sizeH = 0.022, prompt = '$ ', mask, pass}) => {
  const {height: H} = useVideoConfig();
  const fs = Math.round(sizeH * H);
  const lh = Math.round(fs * 1.5);
  const padX = Math.round(0.022 * H);
  const padY = Math.round(0.018 * H);
  const headerH = Math.round(0.046 * H);
  const charW = fs * MONO_ADVANCE;
  const cols = Math.max(20, Math.floor((width - 2 * padX) / charW));

  // wrap every line once: rows of at most `cols` characters
  const allRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    schedule.lines.forEach((l, li) => {
      const text = l.kind === 'cmd' ? prompt + l.text : l.text;
      if (text.length === 0) {
        out.push({line: li, text: '', offset: 0, kind: l.kind, first: true});
        return;
      }
      for (let o = 0; o < text.length; o += cols) out.push({line: li, text: text.slice(o, o + cols), offset: o, kind: l.kind, first: o === 0});
    });
    return out;
  }, [schedule, cols, prompt]);

  const enter = easeUI(prog(t, at, 0.5));
  const leave = easeInCubic(prog(t, exitAt, 0.35));
  const alpha = Math.min(easeOutCubic(prog(t, at, 0.35)), 1 - leave);
  if (alpha <= 0) return null;

  // what is on screen now
  const shownChars = (r: Row): number => {
    const l = schedule.lines[r.line];
    if (t < l.at) return 0;
    if (l.kind !== 'cmd') return r.text.length;
    const full = prompt.length + l.text.length;
    const dur = Math.max(1e-3, l.doneAt - l.at);
    const typed = prompt.length + Math.floor(((t - l.at) / dur) * l.text.length + 1e-6);
    const n = Math.min(full, typed);
    return Math.max(0, Math.min(r.text.length, n - r.offset));
  };
  const visibleRows = allRows.filter((r) => shownChars(r) > 0 || (schedule.lines[r.line].at <= t && r.text === ''));
  // scroll: the window keeps the newest rows; a new row eases the window up by one row
  const total = visibleRows.length;
  const lastRow = visibleRows[total - 1];
  const sinceLast = lastRow ? t - schedule.lines[lastRow.line].at : 1;
  const scrollLag = total > rows ? 1 - easeOutCubic(Math.min(1, sinceLast / 0.12)) : 0;
  const topIdx = Math.max(0, total - rows - scrollLag);
  const from = Math.floor(topIdx);
  const winRows = visibleRows.slice(from).map((r, j) => ({r, top: (from + j - topIdx) * lh}));

  const bodyH = rows * lh;
  const height = headerH + padY * 2 + bodyH;
  // the caret sits after the last typed character of a command still being typed
  const typingRow = (() => {
    for (let j = visibleRows.length - 1; j >= 0; j--) {
      const r = visibleRows[j];
      const l = schedule.lines[r.line];
      if (l.kind === 'cmd' && t >= l.at && t < l.doneAt + 0.45) return r;
    }
    return null;
  })();

  const renderText = (text: string, k: string, tone: string) => {
    if (!mask || !text) return <span style={{color: tone}}>{text}</span>;
    const parts: React.ReactNode[] = [];
    let last = 0;
    const re = new RegExp(mask.source, mask.flags.includes('g') ? mask.flags : mask.flags + 'g');
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push(<span key={`${k}-t${n}`} style={{color: tone}}>{text.slice(last, m.index)}</span>);
      parts.push(
        <span
          key={`${k}-m${n}`}
          style={{display: 'inline-block', width: m[0].length * charW, height: Math.round(fs * 0.92), verticalAlign: 'middle', background: '#2A302E', borderRadius: Math.round(fs * 0.12)}}
        />,
      );
      last = m.index + m[0].length;
      n++;
    }
    if (last < text.length) parts.push(<span key={`${k}-t${n}`} style={{color: tone}}>{text.slice(last)}</span>);
    return <>{parts}</>;
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y + (1 - enter) * 0.02 * H),
        width: Math.round(width),
        height,
        borderRadius: Math.round(0.014 * H),
        background: 'rgba(6,10,9,0.95)',
        border: `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.16)`,
        boxShadow: `0 ${Math.round(0.02 * H)}px ${Math.round(0.06 * H)}px rgba(0,0,0,0.55)`,
        overflow: 'hidden',
        opacity: alpha,
      }}
    >
      <div
        style={{
          height: headerH,
          display: 'flex',
          alignItems: 'center',
          gap: Math.round(0.01 * H),
          padding: `0 ${padX}px`,
          background: 'rgba(14,20,18,0.96)',
          borderBottom: `${Math.max(1, Math.round(H / 1080))}px solid rgba(228,234,231,0.1)`,
          fontFamily: font.mono,
          fontSize: Math.round(0.022 * H),
          color: color.text.chipDim,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{width: Math.round(0.011 * H), height: Math.round(0.011 * H), borderRadius: 99, background: color.accent.mint, boxShadow: `0 0 ${Math.round(0.01 * H)}px ${color.accent.mintGlow}`}} />
        <span>{title}</span>
      </div>
      <div style={{position: 'absolute', left: padX, top: headerH + padY, right: padX, height: bodyH, overflow: 'hidden'}}>
        {winRows.map(({r, top}) => {
          const n = shownChars(r);
          const text = r.text.slice(0, n);
          const l = schedule.lines[r.line];
          const isPass = pass && l.kind === 'out' && pass(l.text);
          const passK = isPass ? easeOutCubic(prog(t, l.at, 0.3)) : 0;
          const tone = l.kind === 'cmd' ? color.text.display : l.kind === 'note' ? color.text.tertiary : isPass ? color.accent.mint : color.text.caption;
          const cmdPrompt = l.kind === 'cmd' && r.first;
          return (
            <div
              key={`${r.line}-${r.offset}`}
              style={{
                position: 'absolute',
                left: 0,
                top: Math.round(top),
                height: lh,
                lineHeight: `${lh}px`,
                fontFamily: font.mono,
                fontSize: fs,
                fontWeight: l.kind === 'cmd' ? 500 : 450,
                whiteSpace: 'pre',
                // characters exactly as printed: no programming ligatures (-> must stay two glyphs)
                fontVariantLigatures: 'none',
                fontFeatureSettings: '"calt" 0, "liga" 0',
                fontStyle: l.kind === 'note' ? 'italic' : undefined,
                textShadow: passK > 0 ? `0 0 ${Math.round(0.012 * H * passK)}px rgba(116,201,174,${(0.55 * passK).toFixed(3)})` : undefined,
              }}
            >
              {cmdPrompt ? (
                <>
                  <span style={{color: color.accent.mint}}>{text.slice(0, prompt.length)}</span>
                  {renderText(text.slice(prompt.length), `${r.line}`, tone)}
                </>
              ) : (
                renderText(text, `${r.line}-${r.offset}`, tone)
              )}
              {typingRow === r && (t < l.doneAt || Math.floor(t * 2.4) % 2 === 0) ? (
                <span style={{display: 'inline-block', width: Math.round(charW * 0.6), height: Math.round(fs * 1.05), marginLeft: 1, verticalAlign: 'middle', background: color.accent.mint, opacity: 0.85}} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
