import React from 'react';
import {color, font} from '../../../../engine/tokens';
import {useFontsReady} from '../../../../engine/type';
import {env, pullStyle, useFrameSize} from './ui';

// A terminal card for the on-camera checks: the commands are typed, then their output appears
// exactly as it was printed in the captured run (lines wrap like a real terminal, never edited).

export interface TerminalRun {
  cmd: string;
  /** when typing starts (s) */
  typeAt: number;
  cps?: number;
  /** output lines exactly as printed */
  output: readonly string[];
  /** when output starts; default: after the command is typed + 0.35 s */
  outAt?: number;
  /** lines per second */
  lps?: number;
}

export interface TerminalProps {
  t: number;
  at: number;
  exitAt?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  /** right side of the title bar (date) */
  meta?: string;
  runs: readonly TerminalRun[];
  /** colour a printed line (default: grey; pass/ok lines mint) */
  tone?: (line: string) => string;
  /** prompt prefix, e.g. "trace/live $" */
  prompt?: string;
}

const defaultTone = (line: string): string => {
  if (/^ok \d+/.test(line) || /^# pass [1-9]/.test(line) || /passes;.*caught/.test(line) || /^✔/.test(line)) return color.accent.mint;
  if (/^not ok|^# fail [1-9]|Error|✖/.test(line)) return color.signal.verdictRed;
  if (/^#|^TAP|^1\.\./.test(line)) return color.text.caption;
  if (/^\s+(---|\.\.\.|duration_ms)/.test(line)) return 'rgba(145,148,147,0.62)';
  return color.text.secondary;
};

interface Row {
  text: string;
  tone: string;
  /** characters shown (for typed rows) */
  shown: number;
  typing: boolean;
  prompt: boolean;
}

export const runEnd = (r: TerminalRun): number => {
  const cps = r.cps ?? 26;
  const outAt = r.outAt ?? r.typeAt + r.cmd.length / cps + 0.35;
  return outAt + r.output.length / (r.lps ?? 28);
};

/** When the n-th output line of a run appears. */
export const lineAt = (r: TerminalRun, n: number): number => {
  const cps = r.cps ?? 26;
  const outAt = r.outAt ?? r.typeAt + r.cmd.length / cps + 0.35;
  return outAt + n / (r.lps ?? 28);
};

export const Terminal: React.FC<TerminalProps> = ({t, at, exitAt, x, y, w, h, title, meta, runs, tone = defaultTone, prompt = '$'}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  const k = env(t, at, 0.45, exitAt, 0.4);
  if (!ready || k <= 0.001) return null;
  const fs = Math.round(0.022 * H);
  const lh = Math.round(fs * 1.42);
  const pad = Math.round(0.022 * H);
  const headH = Math.round(0.048 * H);
  const charW = fs * 0.6;
  const cols = Math.max(20, Math.floor((w - pad * 2) / charW));
  const hair = Math.max(1, Math.round(H / 1080));

  // the rows visible at time t: typed commands and printed lines, wrapped at the window width
  const rows: Row[] = [];
  const pushWrapped = (text: string, tn: string, extra: Partial<Row> = {}) => {
    if (text.length <= cols) {
      rows.push({text, tone: tn, shown: text.length, typing: false, prompt: false, ...extra});
      return;
    }
    for (let i = 0; i < text.length; i += cols) rows.push({text: text.slice(i, i + cols), tone: tn, shown: Math.min(cols, text.length - i), typing: false, prompt: false, ...extra});
  };
  for (const r of runs) {
    if (t < r.typeAt) break;
    const cps = r.cps ?? 26;
    const typed = Math.min(r.cmd.length, Math.floor((t - r.typeAt) * cps));
    const doneTyping = typed >= r.cmd.length;
    rows.push({text: r.cmd, tone: color.text.display, shown: typed, typing: !doneTyping || t < (r.outAt ?? r.typeAt + r.cmd.length / cps + 0.35), prompt: true});
    const outAt = r.outAt ?? r.typeAt + r.cmd.length / cps + 0.35;
    if (t < outAt) break;
    const n = Math.min(r.output.length, Math.floor((t - outAt) * (r.lps ?? 28)) + 1);
    for (let i = 0; i < n; i++) pushWrapped(r.output[i], tone(r.output[i]));
    if (n < r.output.length) break;
  }
  const bodyH = h - headH - pad * 1.4;
  const visible = Math.max(1, Math.floor(bodyH / lh));
  const first = Math.max(0, rows.length - visible);
  const caretOn = Math.floor(t * 2.2) % 2 === 0;
  const promptW = (prompt.length + 1) * charW;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: Math.round(0.015 * H),
        background: 'rgba(5,10,13,0.95)',
        border: `${hair}px solid ${color.card.ruleStrong}`,
        boxShadow: `0 ${Math.round(0.02 * H)}px ${Math.round(0.06 * H)}px rgba(0,0,0,0.55)`,
        overflow: 'hidden',
        ...pullStyle(k, H),
        transform: `translateY(${((1 - k) * 0.02 * H).toFixed(2)}px)`,
      }}
    >
      <div style={{height: headH, display: 'flex', alignItems: 'center', gap: Math.round(0.012 * H), padding: `0 ${pad}px`, background: color.card.windowHeader, borderBottom: `${hair}px solid ${color.card.rule}`}}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{width: Math.round(0.011 * H), height: Math.round(0.011 * H), borderRadius: '50%', background: 'rgba(228,234,231,0.22)'}} />
        ))}
        <span style={{marginLeft: Math.round(0.008 * H), fontFamily: font.mono, fontSize: fs, color: color.text.caption, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1}}>{title}</span>
        {meta ? <span style={{fontFamily: font.mono, fontSize: fs, color: color.text.secondary, whiteSpace: 'nowrap'}}>{meta}</span> : null}
      </div>
      <div style={{position: 'absolute', left: pad, right: pad, top: headH + Math.round(pad * 0.7), fontFamily: font.mono, fontSize: fs, lineHeight: `${lh}px`, whiteSpace: 'pre'}}>
        {rows.slice(first).map((r, i) => (
          <div key={first + i} style={{height: lh, color: r.tone, position: 'relative', paddingLeft: r.prompt ? promptW : 0}}>
            {r.prompt ? <span style={{position: 'absolute', left: 0, color: color.accent.mint}}>{prompt}</span> : null}
            {r.text.slice(0, r.shown)}
            {r.prompt && r.typing ? (
              <span style={{display: 'inline-block', width: charW * 0.62, height: fs * 0.95, marginLeft: 2, transform: `translateY(${(fs * 0.12).toFixed(1)}px)`, background: caretOn ? color.text.display : 'transparent'}} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Typing schedule of a run's command, seconds relative to `typeAt` (for keyboard foley). */
export const keyTimes = (r: TerminalRun): number[] => {
  const cps = r.cps ?? 26;
  const out: number[] = [];
  for (let i = 0; i < r.cmd.length; i++) out.push(i / cps);
  return out;
};

