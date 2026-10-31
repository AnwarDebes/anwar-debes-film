import type {PixieCue} from '../../../pixie';
import type {FilmTimeline} from '../../timeline';
import type {Times07} from './times';
import {sessionCues} from './session';

// Pixie's cues for chapter 07: canonical states only, detail lines in the tool-title style naming
// real files. Running and Debugging only for what actually runs on camera (the replay page in
// 07.4 and npm test in 07.5); the one exception the storyboard sets is 07.3, where the card says
// which pose run_bash plays for a test command.

export const pixie07 = (tl: FilmTimeline, T: Times07): PixieCue[] => {
  const f = (s: number) => tl.f(s);
  const {g, t2, t3, t5, t6} = T;
  return [
    {frame: f(g.cardIn), activity: 'idle', detail: ''},
    {frame: f(T.s1.start + 0.2), activity: 'thinking', detail: 'Thinking…'},
    {frame: f(t2.plate + 0.6), activity: 'reading', detail: 'Read web/js/mascot.js'},
    {frame: f(t3.diagram + 0.3), activity: 'searching', detail: 'Search src/ for decide()'},
    {frame: f(t3.rm - 0.2), activity: 'reading', detail: 'Read src/safety.js'},
    {frame: f(t3.running), activity: 'debugging', detail: 'run_bash plays this for tests'},
    {frame: f(t3.sandbox), activity: 'reading', detail: 'Read test/safety.test.js'},
    ...sessionCues(tl, T),
    {frame: f(t5.typeCmd), activity: 'debugging', detail: 'Run npm test'},
    {frame: f(t5.tally + 0.15), activity: 'success', detail: 'as printed by npm test'},
    {frame: f(t5.thread), activity: 'reading', detail: 'Read assets/js/pixie-mascot.js'},
    {frame: f(t6.line + 0.2), activity: 'reading', detail: 'Read providers.test.ts:83-106'},
    {frame: f(t6.pose), activity: 'writing', detail: 'Editing app.ts'},
    {frame: f(t6.parser), activity: 'reading', detail: 'Read claude-stream.ts:346-395'},
    {frame: f(t6.every - 0.3), activity: 'idle', detail: ''},
  ];
};
