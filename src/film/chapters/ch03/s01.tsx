import React from 'react';
import {random} from 'remotion';
import {ChapterCard} from '../../../engine/type';
import {frameOn, pushIn} from '../../../engine/camera';
import {cover, SWEEPS, type FieldFn, type Look, type PinSample} from '../../../engine/pins';
import {HANDOFF} from '../../handoff';
import {boxesField, ground, padsField, type Pad} from './kit/fields';
import {DeviceProp, pointOnScreen, remapper, type RemapKey} from './kit/device';
import {frameWidthAt} from './kit/camera';
import {Chip, Headline, NamePlate, Pill, dim, env, mint, white, wordsOf} from './kit/ui';
import {CLIPS, LIT, RED_PIN, SESSION_REC, TEAL} from './common';
import type {SceneKit} from './scene';
import {between, monotone} from './kit/time';

// 03.0 the Act I gate (rise) and 03.1 the session: every call looks normal.

/** The 7-step session timeline on the wall (one pad per step of the exfil session). */
export const TIMELINE = {u0: 0.19, u1: 0.445, v: 0.635, r: 2.5};

export type StepState = 'pending' | 'allowed' | 'blocked' | 'off';

const STEP_LOOK: Record<StepState, Look | null> = {
  off: null,
  pending: {h: 0.06, tint: 0.5},
  allowed: {h: 0.2, tint: LIT, glow: 0.9},
  blocked: {h: 0.3, tint: RED_PIN, paint: 0.35},
};

export const timelinePads = (states: readonly StepState[]): Pad[] =>
  states.map((s, k) => ({u: TIMELINE.u0 + ((TIMELINE.u1 - TIMELINE.u0) * k) / 6, v: TIMELINE.v, r: TIMELINE.r, look: STEP_LOOK[s]}));

/** The gate's face: stacked log lines etched into the risen block of dark pins. */
const logLines = (k: SceneKit, box: {u: number; v: number; w: number; h: number}, look: Look): ((u: number, v: number, i: number) => PinSample | null) => {
  const {board} = k;
  const rows = Math.floor((box.h - 4) / 3);
  const lines = Array.from({length: rows}, (_, L) => {
    const words: Array<[number, number]> = [];
    let x = 2;
    // a timestamp, then words of seeded lengths, the line ending short of the edge
    const end = 2 + (box.w - 4) * (0.5 + 0.48 * random(`c03-log-${L}`));
    words.push([x, x + 5]);
    x += 6.5;
    let n = 0;
    while (x < end && n < 12) {
      const len = 1.5 + 4.5 * random(`c03-logw-${L}-${n}`);
      words.push([x, Math.min(end, x + len)]);
      x += len + 1.3;
      n++;
    }
    return words;
  });
  return (u, v) => {
    const px = (u - box.u) / board.p + box.w / 2;
    const py = box.h / 2 - ((v - box.v) * board.extH) / board.p;
    if (px < 0 || px > box.w || py < 2 || py > box.h - 2) return null;
    const L = Math.floor((py - 2) / 3);
    const inRow = (py - 2) - L * 3;
    if (L >= rows || inRow > 1.1) return null;
    for (const [a, b] of lines[L]) if (px >= a && px <= b) return cover({h: 0.55, tint: 0.24}, look, 1);
    return null;
  };
};

export const buildGateAndSession = (k: SceneKit) => {
  const {board, aspect, c, acc, home, ctx} = k;
  const ch = c.tl.chapter('03');
  const S0 = c.sc('03.0');
  const S1 = c.sc('03.1');
  const S2 = c.sc('03.2');

  // ---------------------------------------------------------------- the wall
  const box = {u: 0.705, v: 0.515, w: 40, h: 34};
  const teal = ground(TEAL);
  const pendingTimeline = padsField(board, timelinePads(['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']), teal);
  const blockDark = boxesField(board, [{...box, radius: 1.2, look: {h: 0.55, tint: 0.22}}], teal);
  const darkLines = logLines(k, box, {h: 0.66, tint: 0.4});
  const glassLines = logLines(k, box, {h: 0.66, tint: [0.9, 1.15, 1.08], glow: 0.7});
  const blockGlass = boxesField(board, [{...box, radius: 1.2, look: {h: 0.55, tint: [0.62, 0.95, 0.9], glow: 0.08}}], teal);
  const withLines = (f: FieldFn, lines: (u: number, v: number, i: number) => PinSample | null): FieldFn => (u, v, i) => lines(u, v, i) ?? f(u, v, i);

  acc.beat({id: 'handoff', at: ch.start, field: HANDOFF});
  // the cube of dark pins rises out of the wall, its face etched like stacked log lines
  acc.beat({id: 'gate-rise', at: S0.start, field: withLines(blockDark, darkLines), sweep: {origin: [box.u, box.v], speed: 0.55, jitterS: 0.09}});
  // the black box clears to glass from the top edge down (tint first, heights hold)
  acc.beat({
    id: 'gate-clear',
    at: S0.start + 0.85,
    field: withLines(blockGlass, glassLines),
    sweep: {kind: 'linear', origin: [box.u, box.v + (box.h / 2) * (board.p / board.extH)], direction: [0, -1], speed: 0.32, jitterS: 0.05, tintFollowsWave: true},
  });
  // it opens: the block sinks into the TRACE place, whose session timeline waits for its first call
  acc.beat({id: 'gate-open', at: S0.end - 0.55, field: pendingTimeline, sweep: {origin: [box.u, box.v], speed: 0.9, jitterS: 0.07}});

  // ---------------------------------------------------------------- the session's timeline
  const recSteps = SESSION_REC.steps;
  const stepTimes = monotone([
    c.w('u0301', 'summarises') - 0.05,
    c.w('u0301', 'tickets'),
    between(c.w('u0301', 'tickets'), c.w('u0301', 'Then'), 0.55),
    c.w('u0301', 'Then'),
    c.w('u0301', 'outside'),
    c.nth('u0302', 'another', 0),
  ]);
  stepTimes.forEach((at, s) => {
    const states: StepState[] = Array.from({length: 7}, (_, j) => (j <= s ? 'allowed' : 'pending'));
    acc.beat({id: `step-${s}`, at, field: padsField(board, timelinePads(states), teal)});
  });
  // the second "And another.": the seventh call is on its way (it waits, raised, for 03.4)
  acc.beat({
    id: 'step-6-pending',
    at: c.nth('u0302', 'another', 1),
    field: padsField(board, [...timelinePads(['allowed', 'allowed', 'allowed', 'allowed', 'allowed', 'allowed', 'off']), {u: TIMELINE.u1, v: TIMELINE.v, r: TIMELINE.r, look: {h: 0.2, tint: [1.05, 0.98, 0.7], glow: 0.15}}], teal),
  });

  // ---------------------------------------------------------------- camera and light
  const gatePose = frameOn(board, {uv: [0.62, 0.5], pinsAcross: 130, yaw: 0.16, pitch: 0.08, aspect});
  const sessionPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push(
    {at: ch.start, pose: home},
    {at: S0.start, dur: S0.end - S0.start, pose: gatePose, ease: 'camera'},
    {at: S0.end - 0.35, dur: 1.5, pose: sessionPose, ease: 'camera'},
    {at: S0.end + 1.2, dur: S1.end - S0.end - 1.6, pose: pushIn(sessionPose, 0.045), ease: 'inOutSine'},
  );
  const bx = box.u - 0.5;
  const by = box.v * board.extH - board.extH / 2;
  acc.light.push(
    {at: ch.start, key: 1, pool: 1, env: 1, look: [0, 0], poolAt: [0, 0], spread: 1},
    {at: S0.start, dur: 0.6, key: 0.82, spread: 0.8, poolAt: [bx, by], look: [0.12, -0.06]},
    {at: S0.start + 0.9, dur: 1.4, key: 1.0, spread: 1.0},
    {at: S0.end, dur: 1.2, key: 1.04, spread: 1.3, poolAt: [0.02, 0.0], look: [0, 0]},
  );

  // ---------------------------------------------------------------- the laptop with the live page
  const shotPose = pushIn(sessionPose, 0.02);
  const screenAt = pointOnScreen(shotPose, 0.665, 0.385, 0.14, aspect);
  const screenWidth = 0.37 * frameWidthAt(shotPose, screenAt, aspect);
  const sessionKeys: RemapKey[] = [
    ...stepTimes.map((film, s) => ({film, rec: recSteps[s]})),
    {film: c.w('u0310', 'third'), rec: recSteps[6]},
    {film: c.we('u0310', 'stopped') + 0.25, rec: SESSION_REC.monitors},
  ];
  const recAt = remapper(sessionKeys, CLIPS.session);
  // the laptop holds through 03.1, steps aside for 03.2-03.3, and returns for the block in 03.4
  const S4 = c.sc('03.4');
  const laptopNode = (id: string, from: number, to: number, motion: {enterAt: number; exitAt?: number}, brightness = 1) =>
    acc.prop({
      id,
      from,
      to,
      premountS: 1.0,
      render: (t) => (
        <DeviceProp t={t} kind="laptop" clip={CLIPS.session} recFrame={recAt(t)} at={screenAt} rest={[0.05, -0.2]} screenWidth={screenWidth} motion={{...motion, enter: 'swing', exit: 'swing'}} brightness={brightness} />
      ),
    });
  laptopNode('laptop-session', S0.end - 0.6, S2.start + 0.9, {enterAt: S0.end - 0.45, exitAt: S2.start - 0.15});
  laptopNode('laptop-blocked', S4.start - 0.8, c.u('u0311').start + 0.6, {enterAt: S4.start - 0.8, exitAt: c.u('u0311').start - 0.45});

  // ---------------------------------------------------------------- type
  acc.overlay({
    id: 'card',
    from: S0.start,
    to: S0.end + 0.6,
    render: (t) => <ChapterCard index="03" kicker="trace" title="The session *wasn't.*" kind="displayM" maxWidth={Math.round(0.5 * W)} at={S0.start + 0.12} exitAt={S0.end - 0.15} t={t} />,
  });
  const plateAt = S1.start + 0.25;
  acc.overlay({id: 'plate', from: plateAt, to: S2.start + 0.4, render: (t) => <NamePlate t={t} at={plateAt} exitAt={S2.start} name="trace" status="research prototype v1.1.0 · paper draft · live demo" />});

  const H = ctx.height;
  const W = ctx.width;
  const left = Math.round(0.07 * W);
  // "And another. And another." set as the scene's headline, word by word as it is spoken
  acc.captionSkip.push('u0302');
  acc.overlay({
    id: 'another',
    from: c.u('u0302').start - 0.2,
    to: c.u('u0303').start + 0.2,
    render: (t) => <Headline t={t} words={wordsOf(c.u('u0302').words)} x={left} y={Math.round(0.53 * H)} sizeH={0.068} exitAt={c.u('u0303').start - 0.25} />,
  });
  // the per-call filter's real reason, beside the call it lets through
  const filterAt = c.w('u0303', 'filter');
  acc.overlay({
    id: 'filter',
    from: filterAt - 0.1,
    to: S2.start + 0.2,
    render: (t) => (
      <>
        <Pill k={env(t, filterAt, 0.4, S2.start - 0.35)} x={left} y={Math.round(0.47 * H)} sizeH={0.026}>
          {white('send_email')} {dim('·')} {mint('✓ allowed')} {dim('·')} normal sessions send up to two of these
        </Pill>
        <Chip t={t} at={filterAt + 0.45} exitAt={S2.start - 0.35} repo="trace" path="live/scenarios.js" line={89} x={left} y={Math.round(0.535 * H)} />
      </>
    ),
  });
  // where the session and the empty card come from
  acc.overlay({
    id: 'chips-1',
    from: S1.start,
    to: S2.start + 0.2,
    render: (t) => (
      <>
        <Chip t={t} at={S1.start + 0.7} exitAt={stepTimes[0] + 1.6} repo="trace" path="live/index.html" line={65} x={left} y={Math.round(0.365 * H)} />
        <Chip t={t} at={stepTimes[0] + 0.3} exitAt={c.u('u0302').start - 0.3} repo="trace" path="live/scenarios.js" line="36-47" x={left} y={Math.round(0.365 * H)} />
        <Chip t={t} at={c.w('u0304', 'normal')} exitAt={S2.start - 0.35} repo="trace" path="live/tests/monitors.test.mjs" line={46} x={left} y={Math.round(0.6 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- Pixie
  acc.pixie.push(
    {frame: c.f(ch.start), activity: 'idle', detail: ''},
    {frame: c.f(S1.start + 0.3), activity: 'waiting', detail: 'Press Play or Step'},
    {frame: c.f(stepTimes[0]), activity: 'running', detail: "Run session 'exfil'"},
  );

  return {stepTimes, sessionPose, box, teal, recAt, screenAt, screenWidth, laptopNode};
};

