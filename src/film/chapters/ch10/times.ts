import type {FilmTimeline} from '../../timeline';
import {makeClock, wordOr, type Clock} from './kit/time';

// Chapter 10's anchor times, all derived from the film timeline (scenes, utterances, words).
// Pure data: the picture (ch10.tsx) and the sound (ch10.cues.ts) read the same numbers.

/** The PocketOS phone recording's own events, seconds from its first frame (scripts/record/shots/ch10.json). */
export const POCKET_REC = {unlock: 2.6, terminal: 4.05, ls: 5.3, lsEnter: 5.9, cd: 6.7, cdEnter: 7.9, cat: 8.5, catEnter: 9.9, frob: 11.7, frobEnter: 12.8, length: 15.5};
/** SkillBridgeNorway: the language toggle clicks. */
export const SKILL_REC = {toEnglish: 1.5, toNorwegian: 5.4, length: 7};
/** cookie-galaxy: the constant-rate scroll, top to bottom. */
export const COOKIE_REC = {scrollFrom: 0.6, scrollTo: 10.5, length: 11};

export const times10 = (tl: FilmTimeline) => {
  const c: Clock = makeClock(tl);
  const ch = tl.chapter('10');
  const s = (id: string) => c.sc(id);
  const W = (u: string, w: string | number) => c.w(u, w);

  const s0 = s('10.0');
  const gate = {at: s0.start, unfold: s0.start + 1.1, street: s0.start + 2.2, end: s0.end, cardIn: s0.start + 0.2, cardOut: Math.min(s0.start + 2.15, c.u('u1001').start - 0.2)};

  const s1 = s('10.1');
  const street = {start: s1.start, end: s1.end, search: c.u('u1001').start, dollyFrom: s1.start + 0.15, dollyTo: s1.end - 1.6, toPhone: s1.end - 1.65};

  const s2 = s('10.2');
  const recAt = s2.start + 0.05;
  const pocket = {
    start: s2.start,
    end: s2.end,
    wall: s2.start - 0.5,
    recAt,
    rec: Object.fromEntries(Object.entries(POCKET_REC).map(([k, v]) => [k, recAt + v])) as Record<keyof typeof POCKET_REC, number>,
    plate: W('u1002', 'PocketOS'),
    apps: W('u1002', 'nine') - 0.15,
    kernelQuote: W('u1003', 0),
    laptopIn: c.u('u1004').start - 0.75,
    rule: W('u1004', 'seven'),
    full: W('u1004', 'full'),
    devicesOut: c.u('u1005').start - 0.7,
    tree: c.u('u1005').start - 0.45,
    claim: W('u1005', 'README'),
    strike: W('u1005', 'code'),
    fix: W('u1005', 'types'),
  };

  const s3 = s('10.3');
  const mneme = {
    start: s3.start,
    end: s3.end,
    wall: s3.start - 0.45,
    plate: W('u1006', 'Mneme'),
    anki: W('u1006', 'Anki'),
    funnel: c.u('u1007').start - 0.3,
    seventeen: W('u1007', 'seventeen'),
    flip: c.u('u1008').start - 0.3,
    hard: W('u1008', 'hard'),
    rules: W('u1008', 'rules') - 0.35,
    receipt: c.u('u1009').start - 0.1,
    stage: W('u1009', 'stage'),
    notRun: W('u1010', 'not'),
    capitals: W('u1010', 'capital'),
  };

  const s4 = s('10.4');
  const raceAt = W('u1013', 'MongoDB') - 0.35;
  const msToS = 0.135;
  const idm = {
    start: s4.start,
    end: s4.end,
    wall: s4.start - 0.45,
    plate: W('u1011', 'IDM'),
    three: W('u1011', 'three'),
    seed: W('u1012', 0) - 0.15,
    split: W('u1012', 'star') - 0.2,
    monitorIn: W('u1013', 'One') - 0.45,
    compare: W('u1013', 'same'),
    monitorOut: c.wa('u1013', 'three', 'on') - 0.05,
    race: raceAt,
    msToS,
    mongoDone: raceAt + 5.63 * msToS,
    neoDone: raceAt + 11.38 * msToS,
    pgDone: raceAt + 17.79 * msToS,
    q11: W('u1014', 'Only') - 0.1,
    border: W('u1014', 'border'),
    twenty: W('u1014', 'twenty'),
    vaccine: c.u('u1014').end + 0.25,
  };

  const s5 = s('10.5');
  const drone = {
    start: s5.start,
    end: s5.end,
    press: s5.start - 0.45,
    plate: W('u1015', 0),
    tiles: W('u1015', 'fifty-six') - 0.25,
    signature: W('u1015', 'description') - 0.2,
    scores: W('u1015', 'model') - 0.1,
    dropOut: c.u('u1015').end + 0.1,
    renorm: c.u('u1015').end + 0.55,
    whose: W('u1016', 'whose') - 0.2,
  };

  const s6 = s('10.6');
  const skill = {
    start: s6.start,
    end: s6.end,
    recAt: s6.start + 0.05,
    wall: s6.start - 0.45,
    plate: W('u1017', 0),
    formula: W('u1017', 'meaning') - 0.2,
    laptopOut: c.u('u1018').start - 0.4,
    test: c.u('u1018').start - 0.1,
    forty: W('u1018', 'forty'),
    starts: W('u1018', 'starts'),
  };

  const s7 = s('10.7');
  const cyfs = {
    start: s7.start,
    end: s7.end,
    wall: s7.start - 0.45,
    plate: W('u1019', 0),
    clone: W('u1019', 'Clone'),
    tempo: W('u1019', 'tempo'),
    key: W('u1019', 'key'),
    energy: W('u1019', 'energy'),
    prompt: W('u1019', 'prompt') - 0.2,
    laptopIn: c.u('u1020').start - 0.35,
    recAt: c.u('u1020').start - 0.35,
    gpu: W('u1020', 'Generation') - 0.1,
    laptopOut: s7.end - 0.55,
  };

  const s8 = s('10.8');
  const approved = c.has('u1021');
  const kaleido = {
    start: s8.start,
    end: s8.end,
    approved,
    wall: s8.start - 0.45,
    plate: wordOr(c, 'u1021', 0, s8.start + 0.3),
    text: wordOr(c, 'u1021', 'posts', s8.start + 1),
    image: wordOr(c, 'u1021', 'images', s8.start + 1.6),
    video: wordOr(c, 'u1021', 'videos', s8.start + 2.2),
    turns: wordOr(c, 'u1021', 'turns', s8.start + 3),
    bars: c.has('u1022') ? c.u('u1022').start - 0.1 : s8.end,
    rejected: wordOr(c, 'u1022', 'rejected', s8.end),
    slow: wordOr(c, 'u1022', 'slow', s8.end),
  };

  const s9 = s('10.9');
  const cookie = {
    start: s9.start,
    end: s9.end,
    recAt: s9.start + 0.05,
    wall: s9.start - 0.45,
    plate: W('u1023', 0),
    particles: W('u1023', 'fifty-two') - 0.2,
    exist: W('u1023', 'exist'),
    laptopOut: c.u('u1024').start - 0.55,
    street: c.u('u1024').start - 0.45,
    machine: W('u1024', 'machine'),
    yours: W('u1024', 'yours'),
    release: ch.end - 1.55,
  };

  return {c, chStart: ch.start, chEnd: ch.end, gate, street, pocket, mneme, idm, drone, skill, cyfs, kaleido, cookie};
};

export type Times10 = ReturnType<typeof times10>;
