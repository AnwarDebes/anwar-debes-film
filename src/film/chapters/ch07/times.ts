import type {FilmTimeline} from '../../timeline';
import {between, firstScene, sceneSpan, uttEnd, uttStart, wordAt, wordEnd} from './kit/time';

// Every moment of chapter 07, from the timeline. The scene builders and the cue sheet read the
// same object, so picture and sound move together when the narration is re-timed.

export const times07 = (tl: FilmTimeline) => {
  const ch = tl.chapter('07');
  const s0 = sceneSpan(tl, '07.0');
  const s1 = sceneSpan(tl, '07.1');
  const s2 = sceneSpan(tl, '07.2');
  const s3 = sceneSpan(tl, '07.3');
  const s4 = sceneSpan(tl, '07.4');
  const s5 = sceneSpan(tl, '07.5');
  const s6 = sceneSpan(tl, '07.6');
  const next = firstScene(tl, '08');

  // 07.0 the gate: the floor sinks into a well, the camera descends onto the terminal
  const gate = s0.start;
  const g = {
    at: gate,
    cardIn: gate + 0.28,
    cardOut: s0.end - 0.3,
    descendFrom: gate + 0.25,
    descendTo: s1.start + 0.1,
    floor: s1.start - 0.15,
  };

  // 07.1 the terminal behind a spinner
  const rm = wordAt(tl, 'u0702', 'rm', 0.45);
  const t1 = {
    spinFrom: gate,
    agent: wordAt(tl, 'u0701', 'agent'),
    spinner: wordAt(tl, 'u0701', 'spinner'),
    rm,
    rmSpoken: wordAt(tl, 'u0702', 'rm'),
    after1: rm + 1.35,
    after2: rm + 2.55,
    same: wordAt(tl, 'u0702', 'same'),
    hold: uttEnd(tl, 'u0702'),
    push: uttEnd(tl, 'u0702') + 0.2,
    burst: s2.start - 0.25,
  };

  // 07.2 Pixie's own place: the name plate, mascot.js, the dwell
  const t2 = {
    form: t1.burst + 0.05,
    walk: t1.burst + 0.95,
    plate: wordAt(tl, 'u0703', 'Claude-Code-In-Motion', 0.15),
    map: wordAt(tl, 'u0703', 'missing'),
    codeIn: wordAt(tl, 'u0704', 'one', 0.35),
    grid: wordAt(tl, 'u0704', 'three'),
    paint: wordAt(tl, 'u0704', 18, 0.1),
    fsm: between(tl, 'u0704', 'u0705', 0.2),
    dwell: wordAt(tl, 'u0705', 'holds'),
    fifty: wordAt(tl, 'u0705', 'fifty'),
    lanes: wordAt(tl, 'u0705', 'Between', 0.2),
    flickers: wordAt(tl, 'u0705', 'flickers'),
    oneShot: uttEnd(tl, 'u0705') + 0.35,
    codeOut: s3.start - 0.45,
  };

  // 07.3 the harness decides
  const t3 = {
    diagram: s3.start - 0.25,
    deps: wordAt(tl, 'u0706', 'fetch', 0.1),
    six: wordAt(tl, 'u0706', 'six', 0.1),
    proposes: wordAt(tl, 'u0707', 'proposes'),
    decides: wordAt(tl, 'u0707', 'decides'),
    runs: wordAt(tl, 'u0707', 'runs'),
    asks: wordAt(tl, 'u0707', 'asks'),
    refused: wordAt(tl, 'u0707', 'refused'),
    diagramOut: between(tl, 'u0707', 'u0708', 0.1),
    lanes: between(tl, 'u0707', 'u0708', 0.15),
    ls: between(tl, 'u0707', 'u0708', 0.55),
    rm: wordAt(tl, 'u0708', 'rm'),
    yes: wordAt(tl, 'u0708', 'yes'),
    code: uttStart(tl, 'u0709') - 0.35,
    root: wordAt(tl, 'u0709', 'refused'),
    first: wordAt(tl, 'u0709', 'first'),
    tool: uttStart(tl, 'u0710') - 0.3,
    running: wordAt(tl, 'u0710', 'Running'),
    bug: wordAt(tl, 'u0710', 'chase'),
    sandbox: uttEnd(tl, 'u0710') + 0.5,
    out: s4.start - 0.6,
  };

  // 07.4 the recorded session, at its real speed (see session.ts for the recording's own clock)
  const t4 = {
    swingIn: s4.start - 0.5,
    session: uttStart(tl, 'u0711'),
    read: wordAt(tl, 'u0712', 'Read'),
    search: wordAt(tl, 'u0712', 'Search'),
    propose: wordAt(tl, 'u0712', 'Propose'),
    wait1: wordAt(tl, 'u0712', 'wait'),
    wait1End: uttEnd(tl, 'u0712'),
    ask: wordAt(tl, 'u0713', 'Ask'),
    wait2: wordAt(tl, 'u0713', 'wait'),
    wait2End: uttEnd(tl, 'u0713'),
    real: wordAt(tl, 'u0714', 'real'),
    scripted: wordAt(tl, 'u0714', 'scripted'),
    readme: wordAt(tl, 'u0714', 'README'),
    end: s4.end,
    swingOut: s5.start - 0.6,
  };

  // 07.5 the film runs the tests
  const t5 = {
    term: s5.start - 0.2,
    typeCmd: s5.start + 0.15,
    runs: wordAt(tl, 'u0715', 'runs'),
    tests: wordAt(tl, 'u0715', 'thirty-two'),
    gate: wordAt(tl, 'u0715', 'gate'),
    providers: wordAt(tl, 'u0715', 'providers'),
    agent: wordAt(tl, 'u0715', 'agent'),
    mascot: wordAt(tl, 'u0715', 'mascot'),
    tally: wordEnd(tl, 'u0715', 'itself'),
    cards: uttEnd(tl, 'u0715') + 0.2,
    thread: uttStart(tl, 'u0716') - 0.2,
    copied: wordAt(tl, 'u0716', 'copied'),
    header: wordAt(tl, 'u0716', 'three-line'),
    misses: uttEnd(tl, 'u0716') + 0.6,
    out: s6.start - 0.5,
  };

  // 07.6 vsclaude
  const t6 = {
    place: s6.start - 0.1,
    plate: wordAt(tl, 'u0717', 'vsclaude', 0.1),
    idea: wordAt(tl, 'u0717', 'watch'),
    arch: uttStart(tl, 'u0718') - 0.3,
    claude: wordAt(tl, 'u0718', 'Claude'),
    frozen: wordAt(tl, 'u0718', 'frozen'),
    line: uttStart(tl, 'u0719') - 0.4,
    edit: wordAt(tl, 'u0719', 'file'),
    caption: wordAt(tl, 'u0719', 'caption'),
    pose: wordAt(tl, 'u0719', 'pose'),
    table: wordAt(tl, 'u0719', 'table'),
    parser: uttStart(tl, 'u0720') - 0.3,
    holds: wordAt(tl, 'u0720', 'holds'),
    surfaces: wordAt(tl, 'u0720', 'surfaces'),
    textOnly: wordAt(tl, 'u0720', 20),
    beta: uttStart(tl, 'u0721') - 0.3,
    permission: wordAt(tl, 'u0721', 'permission'),
    planned: wordAt(tl, 'u0721', 'planned'),
    demo: wordAt(tl, 'u0721', 'scripted'),
    spinner: uttStart(tl, 'u0722') - 0.6,
    noSpinner: wordAt(tl, 'u0722', 'spinner'),
    every: wordAt(tl, 'u0722', 'every'),
    hold: uttEnd(tl, 'u0722'),
    cool: Math.max(uttEnd(tl, 'u0722') + 2.4, s6.end - 3.2),
    end: s6.end,
  };

  return {ch, s0, s1, s2, s3, s4, s5, s6, next, g, t1, t2, t3, t4, t5, t6};
};

export type Times07 = ReturnType<typeof times07>;
