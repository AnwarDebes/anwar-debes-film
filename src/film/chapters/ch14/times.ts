import type {FilmTimeline} from '../../timeline';
import {makeClock, type Clock} from '../ch10/kit/time';

// Chapter 14's anchor times, all derived from the film timeline (scenes, utterances, words).
// Pure data: the picture (ch14.tsx) and the sound (ch14.cues.ts) read the same numbers.

export const times14 = (tl: FilmTimeline) => {
  const c: Clock = makeClock(tl);
  const ch = tl.chapter('14');
  const s = (id: string) => c.sc(id);
  const W = (u: string, w: string | number) => c.w(u, w);

  const s0 = s('14.0');
  // the closed box: rises, the clearing shader starts, flickers and stops
  const gate = {start: s0.start, end: s0.end, rise: s0.start + 0.1, clear: s0.start + 1.6, flicker: s0.start + 2.2, stop: s0.start + 2.9, cardIn: s0.start + 0.4, cardOut: s0.end - 0.6};

  const s1 = s('14.1');
  const video = {
    start: s1.start,
    end: s1.end,
    wall: s1.start - 0.4,
    plate: s1.start + 0.5,
    done: W('u1401', 'definition'),
    person: W('u1401', 'person'),
    never: W('u1402', 'never'),
    tested: W('u1402', 'tested'),
  };

  const s2 = s('14.2');
  const pair = {
    start: s2.start,
    end: s2.end,
    empty: c.u('u1403').start,
    nothing: W('u1403', 'nothing'),
    fork: c.u('u1404').start,
    two: W('u1404', 'two'),
    logo: W('u1404', 'logo'),
    metadata: W('u1404', 'metadata'),
    full: c.u('u1404').end + 0.1,
  };

  const s3 = s('14.3');
  const map = {
    start: s3.start,
    end: s3.end,
    pull: s3.start - 0.3,
    places: W('u1405', 'Sixty-six'),
    missing: W('u1405', 'missing'),
    solid: W('u1406', 'solid'),
    guard: W('u1406', 'guard'),
    dotted: W('u1407', 'dotted'),
    dashed: W('u1408', 'dashed'),
    code: W('u1408', 'code'),
  };

  const s4 = s('14.4');
  const spring = {
    start: s4.start,
    end: s4.end,
    dive: s4.start - 0.6,
    itself: W('u1409', 'itself'),
    press: W('u1409', 'sixty-six') + 0.2,
    code: c.u('u1410').start - 0.1,
    damped: W('u1410', 'damped'),
    side: c.u('u1411').start - 0.15,
    same: W('u1411', 'same'),
  };

  const s5 = s('14.5');
  const ledger = {
    start: s5.start,
    end: s5.end,
    chain: s5.start - 0.2,
    own: W('u1412', 'own'),
    hashed: W('u1413', 'hashed'),
    published: W('u1413', 'published'),
    clones: W('u1414', 'clones'),
    hash: W('u1414', 'hash'),
    match: c.u('u1414').end + 0.2,
  };

  const s6 = s('14.6');
  const rule = {start: s6.start, end: s6.end, gather: s6.start - 0.4, rule: W('u1415', 'rule'), show: c.u('u1416').start, work: W('u1416', 'work')};

  const s7 = s('14.7');
  const glass = {start: s7.start, end: s7.end, rise: s7.start - 0.2, clear: s7.start + 0.9, name: W('u1417', 0), portrait: s7.start + 1.6};

  const s8 = s('14.8');
  const card = {start: s8.start, end: s8.end, qr: s8.start + 2.6, fade: s8.end - 1.0};

  const s9 = s('14.9');
  const credits = {start: s9.start, end: s9.end};

  return {c, chStart: ch.start, chEnd: ch.end, gate, video, pair, map, spring, ledger, rule, glass, card, credits};
};

export type Times14 = ReturnType<typeof times14>;
