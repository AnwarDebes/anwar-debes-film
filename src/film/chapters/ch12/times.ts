import type {FilmTimeline} from '../../timeline';
import {timeKit} from '../ch09/kit/time';

// Every event time of chapter 12, derived from the narration timeline (never hard-coded), shared
// by the picture (ch12.tsx) and the sound (ch12.cues.ts).

export const times12 = (tl: FilmTimeline) => {
  const {w, we, us, ue, S} = timeKit(tl);
  const ch = tl.chapter('12');
  const S0 = S('12.0');
  const S1 = S('12.1');
  const S2 = S('12.2');
  const S3 = S('12.3');
  const S4 = S('12.4');
  const S5 = S('12.5');
  const S6 = S('12.6');
  const S7 = S('12.7');
  const S8 = S('12.8');
  const S9 = S('12.9');
  const dollyDur = 1.7;
  const dollyTo = (next: {start: number}) => next.start - dollyDur + 0.2;

  // 12.0 the gate: a page turns right to left; the new page is the street
  const gate = {turn: S0.start, cardAt: S0.start + 0.25, cardExit: S1.start + 0.4};
  // 12.1 the street of eight houses, the band ruler, the standing chip
  const street = {
    ruler: w('u1201', 'checked') - 0.2,
    chip: w('u1202', 'prototypes') - 0.1,
    medical: w('u1202', 'medical') - 0.2,
    dolly: dollyTo(S2),
  };
  // 12.2 SleepArchitect
  const sleep = {
    plate: us('u1203'),
    window: us('u1203') - 0.25,
    windowExit: w('u1204', 'sum') - 0.3,
    /** playback rate of the 9.5 s capture, so it fills its window (it re-times with the voice) */
    rate: Math.min(1.6, Math.max(0.8, 9.5 / Math.max(1, w('u1204', 'sum') - 0.3 - (us('u1203') - 0.25) - 0.3))),
    curve: w('u1204', 'sum') - 0.2,
    stack: w('u1204', 'named') - 0.2,
    cause: w('u1204', 'cause') - 0.2,
    drake: w('u1205', 'thirty-five') - 0.25,
    band: w('u1205', 'band') - 0.2,
    slope: w('u1205', 'slope') - 0.2,
    readme: w('u1206', 'README') - 0.2,
    internal: w('u1206', 'internal') - 0.3,
    artefact: w('u1207', 'artefact') - 0.2,
    lowers: w('u1207', 'lowers') - 0.2,
    dolly: dollyTo(S3),
  };
  // 12.3 CaffeineSense
  const caff = {
    plate: us('u1208'),
    curve: us('u1208') - 0.1,
    half: w('u1208', 'half-life') - 0.2,
    smoker: w('u1208', 'smoker') - 0.15,
    preg: w('u1208', 'pregnancy') - 0.2,
    clock: w('u1209', 'bedtime') - 0.2,
    cutoff: w('u1209', 'evening') - 0.25,
    dolly: dollyTo(S4),
  };
  // 12.4 HotCarWatch (dry)
  const car = {
    plate: us('u1210'),
    cabin: w('u1210', 'minute') - 0.2,
    day: w('u1211', 'thirty-four') - 0.2,
    crack: w('u1211', 'Cracking') - 0.15,
    zero: w('u1211', 'zero') - 0.1,
    safe: w('u1212', 'guaranteed') - 0.2,
    never: w('u1212', 'all') - 0.2,
    dryFrom: S4.start - 0.4,
    dryTo: S5.start + 0.6,
    dolly: dollyTo(S5),
  };
  // 12.5 SmokeShield
  const smoke = {
    plate: us('u1213'),
    haze: us('u1213') - 0.1,
    settle: w('u1213', 'indoors') - 0.2,
    checks: w('u1214', 'checks') - 0.2,
    ratios: w('u1214', 'ratios') - 0.3,
    dolly: dollyTo(S6),
  };
  // 12.6 PipeGuard
  const pipe = {
    plate: us('u1215'),
    frost: w('u1215', 'frozen') - 0.2,
    burst: w('u1215', 'bursting') - 0.2,
    storm: w('u1216', 'storm') - 0.2,
    drip: w('u1216', 'dripping') - 0.15,
    doors: w('u1216', 'cabinet') - 0.2,
    not: w('u1216', 'not') - 0.1,
    dolly: dollyTo(S7),
  };
  // 12.7 HomeJoule
  const joule = {
    plate: us('u1217'),
    bars: w('u1217', 'ranks') - 0.2,
    irr: w('u1217', 'years') - 0.2,
    hpwh: w('u1218', 'heat-pump') - 0.2,
    year: w('u1218', 'year') - 0.2,
    dolly: dollyTo(S8),
  };
  // 12.8 PyroPredict
  const pyro = {
    plate: us('u1219'),
    grid: us('u1219') - 0.2,
    spread: w('u1219', 'spreads') - 0.1,
    routes: w('u1219', 'routes') - 0.2,
    threats: w('u1219', 'burn') - 0.25,
    aware: w('u1220', 'Routing') - 0.1,
    scored: w('u1220', 'scored') - 0.2,
    noroute: w('u1221', 'seventeen') - 0.25,
    dolly: dollyTo(S9),
  };
  // 12.9 ThermoGuard
  const thermo = {
    plate: us('u1222'),
    circuit: w('u1222', 'circuit') - 0.25,
    walls: w('u1222', 'walls') - 0.2,
    air: w('u1222', 'air') - 0.2,
    peak: w('u1223', 'fifty-two') - 0.25,
    city: w('u1224', 'visits') - 0.3,
    greedy: w('u1224', 'greedy') - 0.2,
    dark: w('u1224', 'no') - 0.25,
    equity: w('u1225', 'equity') - 0.2,
    fewer: w('u1225', 'thirty-six') - 0.2,
    report: w('u1226', 'report') - 0.2,
    file: w('u1226', 'file') - 0.2,
    line: us('u1227') - 0.4,
    arithmetic: w('u1227', 'arithmetic'),
    out: ch.end - 2.3,
  };
  void ue;
  void we;
  return {ch, S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, dollyDur, gate, street, sleep, caff, car, smoke, pipe, joule, pyro, thermo};
};

export type Times12 = ReturnType<typeof times12>;
