import type {FilmTimeline} from '../../timeline';
import {clock} from './kit/time';

// Chapter 06's beat times, all read from the timeline (scenes, utterances, words). Shared by the
// picture (ch06.tsx) and the sound (ch06.cues.ts), so every hit lands on the same frame.

export const times06 = (tl: FilmTimeline) => {
  const c = clock(tl);
  const ch = tl.chapter('06');
  const sc = (id: string) => c.scene(id);
  const s0 = sc('06.0');
  const s1 = sc('06.1');
  const s2 = sc('06.2');
  const s3 = sc('06.3');
  const s4 = sc('06.4');
  const s5 = sc('06.5');
  const s6 = sc('06.6');
  const s7 = sc('06.7');
  const s8 = sc('06.8');
  const s9 = sc('06.9');
  const u = c.u;
  const w = c.w;

  // 06.4: the terminal starts on "runs" and must finish before the README limit is spoken
  const termAt = w('u0614', 'runs');

  return {
    ch: {start: ch.start, end: ch.end},
    gate: {
      alarmFrom: ch.start + 0.45,
      frame0: s0.start,
      cardIn: s0.start + 0.2,
      cardOut: s0.end - 0.35,
      descentFrom: s0.start + 0.12,
      descentTo: s0.end - 0.05,
    },
    s1: {
      ...s1,
      plate: u('u0601').start,
      next: w('u0601', 'next'),
      blocking: w('u0602', 'blocking'),
      stops: w('u0602', 'stops'),
      malicious: w('u0602', 'malicious'),
      legit: w('u0602', 'legitimate'),
      forgot: w('u0602', 'forgot'),
      bench: u('u0603').start,
      third: w('u0603', 'third'),
      lastWord: u('u0603').end,
    },
    s2: {
      ...s2,
      lift: s2.start - 0.35,
      plates: w('u0604', 'policy'),
      cheapest: w('u0604', 'cheapest'),
      declares: w('u0605', 'declares'),
      insert: w('u0605', 'insert'),
      swap: w('u0605', 'swap'),
      suppress: w('u0605', 'suppress'),
      human: w('u0605', 'human'),
      price: w('u0606', 'price'),
      humanCost: w('u0606', 'most'),
      every: u('u0607').start,
      simulates: w('u0607', 'simulates'),
      copy: w('u0607', 'copy'),
      keeps: w('u0607', 'keeps'),
      cheapestSafe: w('u0607', 'cheapest'),
      noSafe: u('u0608').start,
      failed: w('u0608', 'failed'),
      lastWord: u('u0608').end,
    },
    s3: {
      ...s3,
      c1: u('u0609').start,
      slid: w('u0609', 'slid'),
      c2: u('u0610').start,
      deadline: w('u0610', 'deadline'),
      inserted: w('u0610', 'inserted'),
      c3: u('u0611').start,
      archive: w('u0611', 'archive'),
      third: w('u0611', 'third'),
      suppressed: w('u0611', 'suppressed'),
      lastWord: u('u0611').end,
    },
    s4: {
      ...s4,
      card: u('u0612').start,
      completes: w('u0612', 'completes'),
      noAttack: w('u0612', 'attack'),
      cannot: u('u0613').start,
      fifty: w('u0613', 'fifty-five'),
      advance: w('u0613', 'advance'),
      term: termAt,
      sealed: w('u0614', 'sealed'),
      verified: w('u0614', 'verified'),
      limit: u('u0615').start,
      ninety: w('u0615', 'ninety-seven'),
      lastWord: u('u0615').end,
    },
    s5: {
      ...s5,
      plate: u('u0616').start,
      memory: w('u0616', 'memory'),
      fades: w('u0616', 'fades'),
      zero: u('u0617').start,
      classic: w('u0617', 'classic'),
      trace: w('u0617', 'TRACE'),
      literal: u('u0618').start,
      kAgo: w('u0618', 'steps'),
      chance: w('u0618', 'chance'),
      nine: w('u0618', 'nine'),
      echo: u('u0619').start,
      every: w('u0619', 'every'),
      agent: u('u0620').start,
      counting: w('u0620', 'counting'),
      stops: w('u0620', 'stops'),
      flags: w('u0620', 'flags'),
      but: u('u0621').start,
      three: w('u0621', 'three'),
      builtIn: w('u0621', 'built'),
      lastWord: u('u0621').end,
    },
    s6: {
      ...s6,
      plate: u('u0622').start,
      input: w('u0622', 'input'),
      graphs: w('u0622', 'graphs'),
      seeds: u('u0623').start,
      noAttack: w('u0623', 'attack'),
      thirty: w('u0624', 'thirty'),
      human: w('u0624', 'human'),
      lastWord: u('u0624').end,
    },
    s7: {
      ...s7,
      plate: u('u0625').start,
      escalation: w('u0625', 'escalation'),
      transcript: u('u0626').start,
      swallow: w('u0626', 'unladen-swallow'),
      tooLow: w('u0626', 'low'),
      person: w('u0626', 'person'),
      oos: u('u0627').start,
      trails: w('u0627', 'trails'),
      softmax: w('u0627', 'softmax'),
      lastWord: u('u0627').end,
    },
    s8: {
      ...s8,
      plate: u('u0628').start,
      fired: w('u0628', 'fired'),
      readme: u('u0629').start,
      adult: w('u0629', 'adult'),
      majority: w('u0629', 'majority'),
      lastWord: u('u0629').end,
    },
    s9: {
      ...s9,
      plate: u('u0630').start,
      contradict: w('u0630', 'contradict'),
      runs: u('u0631').start,
      targets: w('u0631', 'targets'),
      // the scoreboard comes up after the word "targets" and stays through the payoff
      board: w('u0631', 'targets') + 0.7,
      payoff: u('u0632').start,
      repair: w('u0632', 'repair'),
      lastWord: u('u0632').end,
    },
  };
};

export type Times06 = ReturnType<typeof times06>;
