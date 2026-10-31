import {LUCID_PYTEST} from '../../../data/ch08/captures/lucidPytest';
import {termSchedule, type TermEntry} from '../ch06/kit/termSchedule';
import type {Times08} from './times';

// Chapter 08's derived beat times (everything that is not simply a word start), pure, so the
// scenes and the sound cues read the same numbers.

export const lucidTerminalEntries = (): TermEntry[] => [
  {kind: 'cmd', text: LUCID_PYTEST.cmd},
  {kind: 'pause', s: 0.9},
  {kind: 'out', lines: LUCID_PYTEST.lines, everyS: 0.55},
];

export const beats08 = (T: Times08) => {
  const g = T.gate;
  // 08.2: perception, the world model rows, the fatal pin, the plan
  const s2 = T.s2;
  const liftAt = s2.splits - 0.2;
  const maskAt = s2.masks - 0.1;
  const modelRows = [0, 1, 2, 3, 4, 5].map((k) => s2.pressing + 0.5 + k * ((s2.avatar + 0.3 - s2.pressing - 0.5) / 5));
  const fatalAt = s2.locked - 0.15;
  const bfsAt = s2.bfs - 0.1;
  const rippleS = 0.028;
  const stepAt = bfsAt + 1.9;
  const diagFrom = Math.min(s2.lastWord + 0.5, s2.end - 4.2);
  const diagTo = s2.end - 0.45;

  // 08.3: three clicks that each change 288 cells, then the level clears
  const s3 = T.s3;
  const clickAt = [s3.same - 0.1, s3.same + 0.9, s3.same + 1.9];
  const levelAt = Math.max(clickAt[2] + 1.0, s3.clears - 0.05);

  // 08.4: the scoreboard (one of the film's four hard truths)
  const s4 = T.s4;
  const gamesAt = s4.games - 0.3;
  const lucidAt = s4.zero83 - 0.25;
  const randomAt = s4.zero95 - 0.2;
  const frontierAt = s4.frontier - 0.2;
  const strikeAt = s4.otherwise - 0.1;
  const deathsAt = s4.seven - 0.2;

  // 08.5: the unit test on camera
  const s5 = T.s5;
  const term = termSchedule(lucidTerminalEntries(), s5.runs);
  const passAt = term.lines[term.lines.length - 1].at;

  // 08.7: NEXUS
  const s7 = T.s7;
  const diffAt = s7.core - 0.2;
  const matchAt = [0, 1, 2, 3].map((k) => s7.scoring + k * Math.max(0.3, (s7.tests - s7.scoring + 0.6) / 4));
  const stampAt = [0, 1, 2].map((k) => s7.tests + 0.2 + k * 0.45);
  const columnsAt = s7.second - 0.25;
  const drainFrom = s7.point;
  const histAt = s7.diagnostic - 0.2;
  const fixAt = Math.max(s7.game6 + 0.6, histAt + 1.8);
  const protoAt = s7.prototypes - 0.2;
  const lineAt = s7.payoff - 0.35;
  const endAt = Math.max(s7.lastWord + 2.0, T.ch.end - 2.4);

  return {
    cubeAt: g.frame0, unfoldAt: g.unfold, settleAt: g.settle,
    liftAt, maskAt, modelRows, fatalAt, bfsAt, rippleS, stepAt, diagFrom, diagTo,
    clickAt, levelAt,
    gamesAt, lucidAt, randomAt, frontierAt, strikeAt, deathsAt,
    term, passAt,
    diffAt, matchAt, stampAt, columnsAt, drainFrom, histAt, fixAt, protoAt, lineAt, endAt,
  };
};

export type Beats08 = ReturnType<typeof beats08>;
