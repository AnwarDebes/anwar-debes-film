// When each line of a terminal capture appears: commands type on, output prints one line per
// tick. Pure (no React) so the sound cues can place keystrokes and ticks on the same times.

export type TermEntry =
  | {kind: 'cmd'; text: string; cps?: number}
  | {kind: 'out'; lines: readonly string[]; everyS?: number}
  | {kind: 'note'; text: string}
  | {kind: 'pause'; s: number};

export interface TermLine {
  kind: 'cmd' | 'out' | 'note';
  text: string;
  /** film time the line starts appearing */
  at: number;
  /** film time a typed command is complete (= at for printed lines) */
  doneAt: number;
}

export interface TermSchedule {
  lines: TermLine[];
  /** keystroke times (film s) */
  keys: number[];
  /** printed-line times (film s) */
  prints: number[];
  endAt: number;
}

export const termSchedule = (entries: readonly TermEntry[], startAt: number): TermSchedule => {
  const lines: TermLine[] = [];
  const keys: number[] = [];
  const prints: number[] = [];
  let t = startAt;
  for (const e of entries) {
    if (e.kind === 'pause') {
      t += e.s;
    } else if (e.kind === 'cmd') {
      const cps = e.cps ?? 26;
      const dur = e.text.length / cps;
      for (let i = 0; i < e.text.length; i++) {
        // a deterministic, slightly irregular rhythm
        const jitter = (((i * 7919) % 13) / 13 - 0.5) * 0.35;
        keys.push(t + (i + 0.5 + jitter) / cps);
      }
      lines.push({kind: 'cmd', text: e.text, at: t, doneAt: t + dur});
      t += dur + 0.35;
    } else if (e.kind === 'note') {
      lines.push({kind: 'note', text: e.text, at: t, doneAt: t});
      prints.push(t);
      t += 0.12;
    } else {
      const every = e.everyS ?? 0.16;
      for (const text of e.lines) {
        lines.push({kind: 'out', text, at: t, doneAt: t});
        if (text.trim()) prints.push(t);
        t += text.trim() ? every : every * 0.4;
      }
    }
  }
  return {lines, keys, prints, endAt: t};
};
