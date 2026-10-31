import type {FilmTimeline} from '../../timeline';
import {makeClock, uttOr, wordOr, type Clock} from '../ch10/kit/time';

// Chapter 13's anchor times, all derived from the film timeline (scenes, utterances, words).
// Pure data: the picture (ch13.tsx) and the sound (ch13.cues.ts) read the same numbers.
//
// Consent gates (STORYBOARD section 4): the client-gated lines (u1305, u1309, u1310) and the
// approval-gated Goblin lines (u1320-u1322) are shown only while they are in the timeline. When the
// timeline drops them, their beats fall away and the pin re-creations from committed data stand.

export const times13 = (tl: FilmTimeline) => {
  const c: Clock = makeClock(tl);
  const ch = tl.chapter('13');
  const s = (id: string) => c.sc(id);
  const W = (u: string, w: string | number) => c.w(u, w);

  const s0 = s('13.0');
  const gate = {at: s0.start, page: s0.start + 0.7, end: s0.end, cardIn: s0.start + 0.25, cardOut: Math.min(s0.end + 0.1, c.u('u1301').start - 0.25)};

  const s1 = s('13.1');
  const street = {start: s1.start, end: s1.end, at: s1.start - 0.05, search: c.u('u1301').start, dollyFrom: s1.start + 0.2, dollyTo: s1.end - 0.4, stricter: W('u1301', 'stricter')};

  const s2 = s('13.2');
  const web = {
    start: s2.start,
    end: s2.end,
    wall: s2.start - 0.45,
    plate: W('u1302', 'Knotten'),
    rule: W('u1302', 'no'),
    source: W('u1302', 'source'),
    kilde: W('u1303', 'Kilde'),
    thread: W('u1303', 'Kilde') + 0.35,
    code: W('u1303', 'button') - 0.1,
    build: W('u1303', 'build'),
  };

  const s3 = s('13.3');
  const briefShown = c.has('u1305');
  const test = {
    start: s3.start,
    end: s3.end,
    wall: s3.start - 0.45,
    plate: W('u1304', 'knotten-test'),
    specs: W('u1304', 'twenty-seven') - 0.4,
    notes: W('u1304', 'completion'),
    briefShown,
    eight: wordOr(c, 'u1305', 'eight', s3.end),
    flip: wordOr(c, 'u1305', 'internship', s3.end),
    homes: wordOr(c, 'u1305', 'homes', s3.end),
  };

  const s4 = s('13.4');
  const treesShown = c.has('u1309');
  const sheetShown = c.has('u1310');
  const [u9s, u9e] = uttOr(c, 'u1309', [s4.end, s4.end]);
  const twin = {
    start: s4.start,
    end: s4.end,
    wall: s4.start - 0.5,
    plate: W('u1306', 'knotten-test-2'),
    thirty: W('u1306', 'thirty'),
    wide: c.u('u1307').start - 0.35,
    lines: W('u1307', 'water') - 0.2,
    water: W('u1307', 'three') - 0.25,
    sun: c.u('u1308').start - 0.3,
    darkest: W('u1308', 'darkest'),
    quarter: W('u1308', 'quarter'),
    treesShown,
    trees: treesShown ? u9s - 0.3 : s4.end,
    eighty: wordOr(c, 'u1309', 'eighty-four', s4.end),
    gone: wordOr(c, 'u1309', 'gone', s4.end),
    u9end: u9e,
    sheetShown,
    sheet: sheetShown ? c.u('u1310').start - 0.2 : s4.end,
    high: wordOr(c, 'u1310', 'high', s4.end),
    pvgis: sheetShown ? c.u('u1310').start + 0.4 : treesShown ? u9s + 1 : c.u('u1308').end + 0.6,
  };

  const s5 = s('13.5');
  const grill = {
    start: s5.start,
    end: s5.end,
    wall: s5.start - 0.45,
    plate: W('u1311', 'Grimstad'),
    seventy: W('u1311', 'seventy-four') - 0.15,
    file: W('u1311', 'file'),
    v0: W('u1312', 'Vercel'),
    started: W('u1312', 'started'),
  };

  const s6 = s('13.6');
  const cookies = {
    start: s6.start,
    end: s6.end,
    wall: s6.start - 0.45,
    plate: W('u1313', 0),
    english: W('u1313', 'English'),
    norwegian: W('u1313', 'Norwegian'),
    arabic: W('u1313', 'Arabic'),
    free: W('u1314', 'free'),
    ten: W('u1314', 'ten') - 0.1,
    syria: W('u1314', 'Syria'),
  };

  const s7 = s('13.7');
  const ballast = {
    start: s7.start,
    end: s7.end,
    wall: s7.start - 0.45,
    plate: W('u1315', 0),
    proposes: W('u1315', 'propose'),
    never: W('u1315', 'never'),
    tests: c.u('u1316').start - 0.2,
    falling: W('u1316', 'falling'),
    stop: W('u1316', 'stop'),
    whatever: W('u1316', 'whatever'),
    last: W('u1317', 'last'),
    run: c.u('u1317').end + 0.35,
  };

  const s8 = s('13.8');
  const hugin = {
    start: s8.start,
    end: s8.end,
    wall: s8.start - 0.45,
    plate: W('u1318', 0),
    earn: W('u1318', 'earn'),
    ninety: W('u1318', 'ninety'),
    today: W('u1318', 'today'),
    warns: c.u('u1319').start - 0.1,
    something: W('u1319', 'something'),
  };

  const s9 = s('13.9');
  const approved = c.has('u1320');
  const goblin = {
    start: s9.start,
    end: s9.end,
    approved,
    wall: s9.start - 0.45,
    plate: wordOr(c, 'u1320', 0, s9.start + 0.3),
    services: wordOr(c, 'u1320', 'fourteen', s9.start + 1),
    bus: wordOr(c, 'u1320', 'bus', s9.start + 1.5),
    edge: wordOr(c, 'u1321', 'edge', s9.start + 2),
    strategy: c.has('u1321') ? c.u('u1321').start - 0.1 : s9.end,
    comment: c.has('u1322') ? c.u('u1322').start - 0.2 : s9.end,
    fortyFive: wordOr(c, 'u1322', 'forty-five', s9.end),
    coin: wordOr(c, 'u1322', 'coin', s9.end),
  };

  const s10 = s('13.10');
  const close = {
    start: s10.start,
    end: s10.end,
    glow: s10.start - 0.4,
    line: c.u('u1323').start,
    source: W('u1323', 'source'),
    release: ch.end - 1.5,
  };

  return {c, chStart: ch.start, chEnd: ch.end, gate, street, web, test, twin, grill, cookies, ballast, hugin, goblin, close};
};

export type Times13 = ReturnType<typeof times13>;
