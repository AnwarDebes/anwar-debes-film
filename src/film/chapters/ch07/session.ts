import type {PixieCue} from '../../../pixie';
import type {FilmTimeline} from '../../timeline';
import type {Times07} from './times';

// The recorded session of Claude-Code-In-Motion's live demo, as captured frame by frame
// (public/recordings/ch07-ccim-replay.mp4, scripts/record/shots/ch07.json). The page replays
// demo/session.js at its own event gaps; the only free times are the viewer's: when Allow is
// clicked at each gate. The film plays the recording at 1x and lets the two waits for the viewer
// stretch or shrink with the narration, so the agent's own steps keep their real speed.

/** Seconds of the recording (virtual clock of the capture; frame = s * 60). */
export const REC = {
  fps: 60,
  frames: 1500,
  typeFrom: 1.3,
  send: 5.3,
  read: 5.3 + 1.623,
  search: 5.3 + 3.453,
  found: 5.3 + 5.503,
  edit: 5.3 + 7.714,
  gate1: 13.617,
  /** last frame before the cursor appears at gate 1 */
  hold1: 13.95,
  click1: 901 / 60,
  resolved1: 908 / 60,
  test: 908 / 60 + 1.43,
  gate2: 1029 / 60,
  hold2: 1049 / 60,
  click2: 1113 / 60,
  resolved2: 1120 / 60,
  testOut: 1120 / 60 + 2.2,
  reply: 1120 / 60 + 3.05,
  pass: 1120 / 60 + 4.4,
  done: 1420 / 60,
  end: 1499 / 60,
} as const;

/** The replay's own mascot calls (web/js/app.js:63-124) for this session, seconds after send. */
const UI_EVENTS: Array<{at: number; activity: string; detail: string; base?: 'send' | 'resolved1' | 'resolved2'}> = [
  {at: 0.04, activity: 'thinking', detail: 'Thinking…'},
  {at: 0.89, activity: 'typing', detail: 'Writing a reply…'},
  {at: 1.623, activity: 'reading', detail: 'Read src/config.js'},
  {at: 3.073, activity: 'thinking', detail: 'Thinking…'},
  {at: 3.453, activity: 'searching', detail: 'Search parseConfig'},
  {at: 4.803, activity: 'thinking', detail: 'Thinking…'},
  {at: 5.503, activity: 'typing', detail: 'Writing a reply…'},
  {at: 7.714, activity: 'writing', detail: 'Edit src/config.js'},
  {at: 8.314, activity: 'waiting', detail: 'Waiting for your approval…'},
  {at: 0, base: 'resolved1', activity: 'writing', detail: 'Edit src/config.js'},
  {at: 1.05, base: 'resolved1', activity: 'thinking', detail: 'Thinking…'},
  {at: 1.43, base: 'resolved1', activity: 'debugging', detail: 'Run npm test'},
  {at: 2.03, base: 'resolved1', activity: 'waiting', detail: 'Waiting for your approval…'},
  {at: 0, base: 'resolved2', activity: 'debugging', detail: 'Run npm test'},
  {at: 2.35, base: 'resolved2', activity: 'thinking', detail: 'Thinking…'},
  {at: 3.05, base: 'resolved2', activity: 'typing', detail: 'Writing a reply…'},
  {at: 5.0, base: 'resolved2', activity: 'success', detail: '2 tests passing'},
];

export interface SessionMap {
  /** film time of recording time r (the first film time that shows it) */
  film: (r: number) => number;
  /** recording time shown at film time t */
  rec: (t: number) => number;
  hold1: [number, number];
  hold2: [number, number];
  start: number;
  end: number;
}

export const sessionMap = (T: Times07): SessionMap => {
  const {t4} = T;
  // gate 1 lands on "wait", the click comes after the sentence; gate 2 likewise
  const gate1 = t4.wait1 - 0.15;
  const off1 = gate1 - REC.gate1;
  const click1 = Math.max(t4.wait1End + 0.45, gate1 + (REC.click1 - REC.gate1));
  const h1s = REC.hold1 + off1;
  const h1e = Math.max(h1s, click1 - (REC.click1 - REC.hold1));
  const off2 = h1e - REC.hold1;
  const gate2 = REC.gate2 + off2;
  const click2 = Math.max(t4.wait2End + 0.45, gate2 + (REC.click2 - REC.gate2));
  const h2s = REC.hold2 + off2;
  const h2e = Math.max(h2s, click2 - (REC.click2 - REC.hold2));
  const off3 = h2e - REC.hold2;
  const film = (r: number) => (r <= REC.hold1 ? r + off1 : r <= REC.hold2 ? r + off2 : r + off3);
  const rec = (t: number) => {
    if (t <= h1s) return Math.max(0, t - off1);
    if (t <= h1e) return REC.hold1;
    if (t <= h2s) return t - off2;
    if (t <= h2e) return REC.hold2;
    return Math.min(REC.end, t - off3);
  };
  return {film, rec, hold1: [h1s, h1e], hold2: [h2s, h2e], start: off1, end: REC.end + off3};
};

export const sessionCues = (tl: FilmTimeline, T: Times07): PixieCue[] => {
  const m = sessionMap(T);
  const base = {send: REC.send, resolved1: REC.resolved1, resolved2: REC.resolved2};
  const out: PixieCue[] = [];
  for (const e of UI_EVENTS) {
    const r = base[e.base ?? 'send'] + e.at;
    const t = m.film(r);
    if (t < T.s4.start - 0.2 || t > T.s5.start) continue;
    out.push({frame: tl.f(t), activity: e.activity, detail: e.detail});
  }
  return out;
};
