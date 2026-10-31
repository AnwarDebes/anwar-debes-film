import type {FilmTimeline} from '../../timeline';
import {traceCheck as check} from '../../../data/ch03/trace-check';
import {between, clock, monotone} from './kit/time';

// The hits of chapter 03 as plain times (no React), shared by the sound cues. The scene builders
// place the pictures with the same expressions.

export const times03 = (tl: FilmTimeline) => {
  const c = clock(tl);
  const ch = tl.chapter('03');
  const S = (id: string) => c.sc(id);
  const S0 = S('03.0');
  const S1 = S('03.1');
  const S2 = S('03.2');
  const S3 = S('03.3');
  const S4 = S('03.4');
  const S5 = S('03.5');
  const S6 = S('03.6');
  const S7 = S('03.7');

  const steps = monotone([
    c.w('u0301', 'summarises') - 0.05,
    c.w('u0301', 'tickets'),
    between(c.w('u0301', 'tickets'), c.w('u0301', 'Then'), 0.55),
    c.w('u0301', 'Then'),
    c.w('u0301', 'outside'),
    c.nth('u0302', 'another', 0),
    c.nth('u0302', 'another', 1),
  ]);

  // 03.2: the reading cursor over the page (16 words), terms light as they are read
  const readFrom = S2.start + 0.7;
  const readStep = Math.min(0.24, (c.w('u0305', 'read') - 0.6 - readFrom) / 16);
  const termWords = [1, 6, 7, 8, 9, 10, 12, 14];

  // 03.3
  const ringAt = c.w('u0308', 'ring');
  const stepGap = Math.max(0.32, Math.min(0.55, (c.u('u0308').end - ringAt - 0.4) / 5));
  const binAt = c.w('u0309', 'bounded');

  // 03.5
  const chainBuild = S5.start + 0.1;
  const chainStep = Math.min(0.42, (c.w('u0313', 'chained') - chainBuild) / 7);

  // 03.6: the terminal (same schedule as the Terminal card)
  const typeAt = S6.start + 0.45;
  const cmd1 = check.runs[0].cmd;
  const out1 = typeAt + cmd1.length / 21 + 1.0;
  const run1End = out1 + check.runs[0].output.length / 30;
  const reject = c.w('u0317', 'reject');
  const run2Type = Math.min(run1End + 0.4, reject - 1.9);
  const cmd2 = check.runs[1].cmd;
  const passAt = Math.max(run2Type + cmd2.length / 22 + 0.35, reject);

  return {
    c,
    ch,
    gate: S0.start,
    gateClear: S0.start + 0.85,
    gateOpen: S0.end - 0.55,
    lapIn1: S0.end - 0.45,
    plate: S1.start + 0.25,
    steps,
    filter: c.w('u0303', 'filter'),
    lapOut1: S2.start - 0.15,
    vocab: S2.start - 0.25,
    readFrom,
    terms: termWords.map((i) => readFrom + i * readStep + 0.05),
    literals: c.we('u0305', 'read') + 0.1,
    code1: c.w('u0305', 'monitors'),
    s3: S3.start,
    rule1: c.w('u0306', 'instructions'),
    rule2: c.w('u0306', 'vergiss'),
    sha: c.u('u0306').end + 0.35,
    dialects: [c.w('u0307', 'OpenAI'), c.w('u0307', 'DeepSeek'), c.w('u0307', 'Anthropic')],
    merge: c.w('u0307', 'event'),
    diagram: c.w('u0307', 'policy') - 0.3,
    ring: ringAt,
    ringSteps: [0, 1, 2, 3, 4].map((s) => ringAt + 0.25 + s * stepGap),
    bin: binAt,
    raceFrom: binAt + 0.5,
    raceTo: c.u('u0309').end - 0.2,
    s4: S4.start,
    musicCut: c.u('u0311').start - 3,
    third: c.w('u0310', 'third'),
    stopped: c.w('u0310', 'stopped'),
    lapOut2: c.u('u0311').start - 0.45,
    wasnt: c.u('u0312').start,
    s5: S5.start,
    chain: Array.from({length: 7}, (_, i) => chainBuild + i * chainStep + 0.25),
    signed: c.w('u0313', 'signed'),
    seal: c.u('u0313').end + 0.25,
    lapIn3: c.u('u0314').start - 0.7,
    flip: c.w('u0314', 'Flip'),
    fail: c.w('u0314', 'fails'),
    codeLedger: c.u('u0315').start - 0.2,
    restore: c.w('u0316', 'tampering'),
    verified: c.u('u0316').end + 0.35,
    s6: S6.start,
    typeAt,
    keys1: Array.from({length: cmd1.length}, (_, i) => i / 21),
    run2Type,
    keys2: Array.from({length: cmd2.length}, (_, i) => i / 22),
    pass: passAt,
    numbers: c.u('u0318').start - 0.1,
    asr: c.w('u0319', 'beats'),
    miss: c.u('u0320').start - 0.2,
    fall: c.w('u0320', 'falls'),
    quote: c.u('u0320').end + 0.15,
    s7: S7.start,
    guard: c.w('u0321', 'guard'),
    monitors: c.w('u0321', 'monitors'),
    ledger: c.w('u0321', 'ledger'),
    real: c.w('u0321', 'real'),
    thread: ch.end - 2.2,
    end: ch.end,
  };
};
