import type {FilmTimeline} from '../../timeline';
import {between, firstScene, sceneSpan, uttEnd, uttStart, wordAt} from '../ch07/kit/time';

// Every moment of chapter 11, from the timeline (scene builders and the cue sheet share it).

export const times11 = (tl: FilmTimeline) => {
  const ch = tl.chapter('11');
  const s0 = sceneSpan(tl, '11.0');
  const s1 = sceneSpan(tl, '11.1');
  const s2 = sceneSpan(tl, '11.2');
  const s3 = sceneSpan(tl, '11.3');
  const s4 = sceneSpan(tl, '11.4');
  const s5 = sceneSpan(tl, '11.5');
  const s6 = sceneSpan(tl, '11.6');
  const s7 = sceneSpan(tl, '11.7');
  const next = firstScene(tl, '12');

  // 11.0 the gate (unfold) and 11.1 the plate with six chips
  const g = {at: s0.start, unfold: s0.start + 1.25, cardIn: s0.start + 0.28, cardOut: s0.end - 0.25};
  const t1 = {
    plate: s1.start - 0.15,
    chips: wordAt(tl, 'u1101', 'prototypes', 0.1),
    promise: wordAt(tl, 'u1101', 'promise'),
    synthetic: wordAt(tl, 'u1101', 'synthetic'),
    out: s2.start - 0.4,
  };

  // 11.2 DiTM: a generator
  const t2 = {
    place: s2.start - 0.3,
    plate: wordAt(tl, 'u1102', 'DiTM', 0.1),
    generator: wordAt(tl, 'u1102', 'generator'),
    flips: wordAt(tl, 'u1103', 'flips'),
    perFeature: wordAt(tl, 'u1103', 'one'),
    guess: wordAt(tl, 'u1103', 'guess'),
    noise: wordAt(tl, 'u1104', 'noise', 0.2),
    steps: wordAt(tl, 'u1104', 'steps'),
    stepsEnd: uttEnd(tl, 'u1104'),
    sensors: uttStart(tl, 'u1105') - 0.3,
    broken: wordAt(tl, 'u1105', 'broken'),
    auc: wordAt(tl, 'u1105', 'AUC'),
    bayes: wordAt(tl, 'u1105', 'Bayes'),
    readme: wordAt(tl, 'u1106', 'README'),
    loose: wordAt(tl, 'u1106', 'loose'),
    imputation: uttEnd(tl, 'u1106') + 0.4,
    out: s3.start - 0.45,
  };

  // 11.3 ConfTM: a set of labels
  const t3 = {
    place: s3.start - 0.3,
    plate: wordAt(tl, 'u1107', 'ConfTM', 0.1),
    set: wordAt(tl, 'u1107', 'set'),
    nine: wordAt(tl, 'u1107', 'nine'),
    stream: uttStart(tl, 'u1108') - 0.2,
    change: wordAt(tl, 'u1108', 'change'),
    slips: wordAt(tl, 'u1108', 'slips'),
    eightyFour: wordAt(tl, 'u1108', 'eighty-four'),
    holds: wordAt(tl, 'u1109', 'holds'),
    ninety: wordAt(tl, 'u1109', 'ninety'),
    out: s4.start - 0.45,
  };

  // 11.4 RobTM: flip distance
  const t4 = {
    place: s4.start - 0.3,
    plate: wordAt(tl, 'u1110', 'RobTM', 0.1),
    scan: wordAt(tl, 'u1110', 'exactly'),
    flip: wordAt(tl, 'u1110', 'flip'),
    humbling: wordAt(tl, 'u1111', 'humbling'),
    single: wordAt(tl, 'u1111', 'single'),
    out: s5.start - 0.45,
  };

  // 11.5 CCTM: pairs
  const t5 = {
    place: s5.start - 0.3,
    plate: wordAt(tl, 'u1112', 'CCTM', 0.1),
    twin: wordAt(tl, 'u1112', 'twin'),
    gap: wordAt(tl, 'u1113', 'gap'),
    falls: wordAt(tl, 'u1113', 'falls'),
    four: wordAt(tl, 'u1113', 'four'),
    oracle: wordAt(tl, 'u1114', 'oracle'),
    noOracle: wordAt(tl, 'u1114', 15),
    muted: between(tl, 'u1113', 'u1114', 0.5),
    out: s6.start - 0.45,
  };

  // 11.6 FedTM: five sites
  const t6 = {
    place: s6.start - 0.3,
    plate: wordAt(tl, 'u1115', 'FedTM', 0.1),
    five: wordAt(tl, 'u1115', 'five'),
    sharing: wordAt(tl, 'u1115', 'sharing'),
    average: wordAt(tl, 'u1115', 'includes'),
    noise: wordAt(tl, 'u1116', 'noise'),
    round: wordAt(tl, 'u1116', 'round'),
    accuracy: wordAt(tl, 'u1116', 'Accuracy'),
    rounds: wordAt(tl, 'u1117', 'rounds'),
    weakens: wordAt(tl, 'u1117', 'weakens'),
    twenty: wordAt(tl, 'u1117', 'twenty'),
    correction: uttEnd(tl, 'u1117') + 0.2,
    out: s7.start - 0.45,
  };

  // 11.7 lifelong-tm: remember; then the six numbers and the closing line
  const t7 = {
    place: s7.start - 0.3,
    plate: wordAt(tl, 'u1118', 'lifelong-tm', 0.1),
    learns: wordAt(tl, 'u1118', 'learns'),
    forgets: wordAt(tl, 'u1119', 'forgets'),
    half: wordAt(tl, 'u1119', 'half'),
    memory: wordAt(tl, 'u1119', 'price'),
    six: uttStart(tl, 'u1120') - 0.5,
    measured: wordAt(tl, 'u1120', 'measured'),
    hold: uttEnd(tl, 'u1120'),
    clear: Math.max(uttEnd(tl, 'u1120') + 2.0, s7.end - 2.6),
    end: s7.end,
  };

  return {ch, s0, s1, s2, s3, s4, s5, s6, s7, next, g, t1, t2, t3, t4, t5, t6, t7};
};

export type Times11 = ReturnType<typeof times11>;
