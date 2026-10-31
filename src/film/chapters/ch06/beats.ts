import {FILM_WALL} from '../../../engine/pins/board';
import {THGTM_ATTACK_TRAJECTORY} from '../../../data/ch06/thgtmTrajectory';
import {REINS_QUICKSTART} from '../../../data/ch06/captures/reinsQuickstart';
import {termSchedule, type TermEntry} from './kit/termSchedule';
import type {Times06} from './times';

// The picture's derived beat times (everything that is not simply a word start), pure, so the
// scenes and the sound cues read the same numbers.

const Q = REINS_QUICKSTART;

/** The capture as the terminal shows it: pip's 21 lines folded to its result, then the run. */
export const reinsTerminalEntries = (everyS = 0.2): TermEntry[] => [
  {kind: 'cmd', text: Q.pip.cmd},
  {kind: 'note', text: `  [${Q.pip.foldedBefore} lines folded: build steps and local paths]`},
  {kind: 'out', lines: [Q.pip.shown]},
  {kind: 'note', text: `  [${Q.pip.foldedAfter} lines folded: pip's update notice]`},
  {kind: 'pause', s: 0.25},
  {kind: 'cmd', text: Q.cmd},
  {kind: 'pause', s: 0.2},
  {kind: 'out', lines: Q.lines, everyS},
];

/** The edit kinds of 06.2 and how each fares for the transfer without authorize. */
export const EDITS = [
  {kind: 'allow', cost: '0', fate: 'unsafe' as const},
  {kind: 'insert', cost: '+1', fate: 'chosen' as const},
  {kind: 'substitute', cost: '3', fate: 'none' as const},
  {kind: 'suppress', cost: '5', fate: 'safe' as const},
  {kind: 'defer', cost: '8', fate: 'safe' as const},
];

/** The raster speed of the trajectory reveal (board widths per second). */
export const TRAJ_RASTER = 0.5;

export const beats06 = (T: Times06) => {
  // 06.2: one card at a time through the copy of the monitors, then the cheapest safe one
  const s2 = T.s2;
  const simFrom = s2.simulates;
  const simTo = Math.max(simFrom + 2.5, s2.keeps - 0.15);
  const simAt = EDITS.map((_, k) => simFrom + ((simTo - simFrom) * k) / EDITS.length);
  const chosenAt = Math.max(s2.cheapestSafe - 0.1, simTo + 0.1);
  const fallAt = simAt[0] + 0.55;
  // the architecture diagram fills the hold after the last line (at least 6.5 s of it)
  const diagFrom = Math.min(s2.lastWord + 0.6, s2.end - 6.5);
  const diagTo = s2.end - 0.55;

  // 06.3: the four case studies
  const s3 = T.s3;
  const steps2 = [s3.c2 - 0.15, s3.c2 + 0.9, s3.c2 + 1.7, s3.c2 + 2.5];
  const respAt = Math.max(steps2[3] + 0.8, s3.deadline - 0.1);
  const auditAt = Math.max(respAt + 0.5, s3.inserted - 0.05);
  const send3 = s3.third + 0.15;
  const sends = [send3 - 1.0, send3 - 0.5, send3];
  const noopAt = Math.max(send3 + 0.5, s3.suppressed - 0.05);
  const precAt = Math.min(s3.c1 + 0.9, s3.slid - 0.6);
  const sealAt = s3.lastWord + 0.9;

  // 06.4: the ladder, the terminal (its certificate line prints on "verified"), the 480 pins
  const s4 = T.s4;
  const ladder = [0, 1, 2, 3].map((k) => s4.completes + 0.35 + k * 0.42);
  const base = termSchedule(reinsTerminalEntries(), s4.term);
  const certLine = base.lines.findIndex((l) => l.text.startsWith('certificate verifies'));
  const outFirst = base.lines.findIndex((l) => l.kind === 'out' && l.text === Q.lines[0]);
  const want = Math.max(base.lines[certLine].at, s4.verified - 0.1);
  const every = Math.max(0.16, Math.min(0.5, (want - base.lines[outFirst].at) / Math.max(1, certLine - outFirst)));
  const term = termSchedule(reinsTerminalEntries(every), s4.term);
  const passAt = term.lines.find((l) => l.text.startsWith('certificate verifies'))?.at ?? term.endAt;
  const gridAt = s4.limit - 0.1;

  // 06.5: the temporal XOR bars and the trajectory raster (the third export trips the rule)
  const s5 = T.s5;
  const xorAt = [s5.chance - 0.1, s5.nine - 0.1, s5.every - 0.05];
  const trajAt = s5.agent - 0.35;
  const exportsAt = THGTM_ATTACK_TRAJECTORY.bits[2].flatMap((v, n) => (v ? [n] : []));
  // steps are 2 pins apart; the raster starts 2 pins before step 0
  const stepPass = (n: number) => trajAt + ((n * 2 + 2) / FILM_WALL.cols) / TRAJ_RASTER;
  const exportPass = exportsAt.map(stepPass);
  const tripAt = exportPass[2];
  const threadFrom = s5.trace - 0.1;

  // 06.6-06.9: the plate
  const s6 = T.s6;
  const s7 = T.s7;
  const s9 = T.s9;
  const voteAt = Math.min(s6.graphs + 0.9, s6.seeds - 0.6);
  const q2At = Math.max(s7.transcript + 1.6, s7.swallow - 0.2);
  const escAt = Math.max(q2At + 0.9, s7.tooLow - 0.1);
  const endAt = Math.max(s9.lastWord + 2.0, T.ch.end - 2.4);

  return {
    simFrom, simTo, simAt, chosenAt, fallAt, diagFrom, diagTo,
    steps2, respAt, auditAt, send3, sends, noopAt, precAt, sealAt,
    ladder, term, passAt, gridAt,
    xorAt, trajAt, exportsAt, exportPass, tripAt, threadFrom,
    voteAt, q2At, escAt, endAt,
  };
};

export type Beats06 = ReturnType<typeof beats06>;
