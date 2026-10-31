import React from 'react';
import {random, useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {KineticLine} from '../../../engine/type';
import {apertureForBlur, projectToScreen, pushIn, rigPoseAt, type CameraKey, type CameraPose, type FocusKey} from '../../../engine/camera';
import {blackBoxField, flatField, pinAt, rectField, type Beat, type FieldFn, type LightKey, type LiveLayer} from '../../../engine/pins';
import {Dust} from '../../../engine/fx';
import {pixieField, resolveTimeline, type PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import {capsStyle, clamp01, easeIn, easeOut, env, legible, pull, ramp, smooth, Em} from './kit';
import {pinTextField} from './pinText';
import {mapField} from './map';
import {pose, wxy, type Part, type Stage} from './stage';

// 01.1 the black box and its spinner, 01.2 Pixie assembles from the spinner and the rule line
// appears, 01.3 the title pressed into the wall.

export const BOX_UV: [number, number] = [0.575, 0.47];
export const BOX_SIZE = 30;
export const PIXIE_UV: [number, number] = [0.6, 0.5];

/** The eight-dot loading spinner beside the box: ticks like a clock, stops, then bursts. */
const Spinner: React.FC<{t: number; x: number; y: number; r: number; from: number; stopAt: number; burstAt: number}> = ({t, x, y, r, from, stopAt, burstAt}) => {
  const {height: H} = useVideoConfig();
  if (t < from) return null;
  const tick = 1 / 8; // one step per eighth of a second
  const run = Math.min(t, stopAt) - from;
  const head = Math.floor(run / tick) % 8;
  const inK = easeOut(ramp(t, from, 0.6));
  const dots: React.ReactNode[] = [];
  const dotD = Math.round(H * 0.0105);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
    // trail: the head is brightest, the dots behind it fade
    const age = (head - k + 8) % 8;
    const lum = t < stopAt ? Math.max(0.18, 1 - age * 0.13) : 0.55;
    // the burst: every dot flies outward and breaks into cell-sized squares
    const b = t >= burstAt ? easeOut(ramp(t, burstAt, 0.55)) : 0;
    const rr = r * (1 + 5.5 * b);
    const fade = 1 - ramp(t, burstAt + 0.25, 0.4);
    if (fade <= 0) continue;
    dots.push(
      <div
        key={k}
        style={{
          position: 'absolute',
          left: Math.round(x + rr * Math.cos(a) - dotD / 2),
          top: Math.round(y + rr * Math.sin(a) - dotD / 2),
          width: dotD,
          height: dotD,
          borderRadius: b > 0.05 ? Math.round(dotD * 0.15) : dotD / 2,
          background: color.pixie.body,
          opacity: inK * lum * fade,
          boxShadow: `0 0 ${Math.round(dotD * 0.8)}px rgba(217,119,87,${(0.35 * lum).toFixed(3)})`,
        }}
      />,
    );
  }
  return <div style={{position: 'absolute', inset: 0}}>{dots}</div>;
};

/** Coral cell-sized squares raining from the burst onto the wall where Pixie forms. */
const Rain: React.FC<{t: number; from: number; x0: number; y0: number; x1: number; y1: number; w: number; h: number}> = ({t, from, x0, y0, x1, y1, w, h}) => {
  const {height: H} = useVideoConfig();
  if (t < from || t > from + 2.4) return null;
  const n = 46;
  const cell = Math.round(H * 0.011);
  const out: React.ReactNode[] = [];
  for (let k = 0; k < n; k++) {
    const d = random(`c01-rain-d-${k}`) * 0.7;
    const s = ramp(t, from + d, 0.75);
    if (s <= 0 || s >= 1) continue;
    const tx = x1 - w / 2 + random(`c01-rain-x-${k}`) * w;
    const ty = y1 - h / 2 + random(`c01-rain-y-${k}`) * h;
    const a = random(`c01-rain-a-${k}`) * Math.PI * 2;
    const sx = x0 + Math.cos(a) * H * 0.05;
    const sy = y0 + Math.sin(a) * H * 0.05;
    const e = easeIn(s);
    const px = sx + (tx - sx) * e;
    const py = sy + (ty - sy) * e - Math.sin(Math.PI * s) * H * 0.06;
    out.push(
      <div
        key={k}
        style={{
          position: 'absolute',
          left: Math.round(px - cell / 2),
          top: Math.round(py - cell / 2),
          width: cell,
          height: cell,
          background: k % 3 === 0 ? color.pixie.bodyHi : color.pixie.body,
          opacity: 0.95 * (1 - smooth((s - 0.82) / 0.18)),
        }}
      />,
    );
  }
  return <div style={{position: 'absolute', inset: 0}}>{out}</div>;
};

/** Kicker, name and tagline set beside the pin title (crisp type, aligned to the pin letters). */
const TitleType: React.FC<{t: number; from: number; to: number; titleTop: number; titleBottom: number}> = ({t, from, to, titleTop, titleBottom}) => {
  const {width: W, height: H} = useVideoConfig();
  const x = Math.round(W * layout.marginLeftW);
  const kK = env(t, from + 0.25, to, 0.5, 0.35);
  const nK = env(t, from + 0.85, to, 0.5, 0.35);
  const gK = env(t, from + 1.25, to, 0.5, 0.35);
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <div style={{position: 'absolute', left: x, top: Math.round(titleTop - H * 0.062), ...capsStyle(H, 0.022, 0.2), color: color.accent.mintLabel, textShadow: legible(H), ...pull(kK, H)}}>
        A walk through 66 repositories
      </div>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: Math.round(titleBottom + H * 0.045),
          fontFamily: font.sans,
          fontWeight: 600,
          fontSize: Math.round(H * 0.042),
          letterSpacing: '-0.02em',
          color: color.text.display,
          whiteSpace: 'pre',
          textShadow: legible(H),
          ...pull(nK, H),
        }}
      >
        Anwar Debes
      </div>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: Math.round(titleBottom + H * 0.105),
          fontFamily: font.sans,
          fontWeight: 500,
          fontSize: Math.round(H * 0.0514),
          letterSpacing: '-0.02em',
          color: color.text.display,
          whiteSpace: 'pre',
          textShadow: legible(H),
          ...pull(gK, H),
        }}
      >
        AI that <Em>shows its work.</Em>
      </div>
    </div>
  );
};

export interface OpenOut extends Part {
  /** where the chapter's camera stands at the end of 01.3 */
  titlePose: CameraPose;
  /** time the lower-third guide lands (the rule line appears with it) */
  guideAt: number;
  ruleAt: number;
  /** the lateral dolly, while Pixie scurries in place (s) */
  scurry: [number, number];
}

export const buildOpen = (st: Stage): OpenOut => {
  const {ctx, board, relief, f} = st;
  const tl = ctx.tl;
  const s1 = tl.scene('01.1');
  const s2 = tl.scene('01.2');
  const s3 = tl.scene('01.3');
  const u1 = tl.utt('u0101');
  const u2 = tl.utt('u0102');
  const wAnswer = tl.word('u0101', 'answer');
  const wSpinner = tl.word('u0103', 'spinner');
  const wPixie = tl.word('u0104', 'Pixie');
  const u6 = tl.utt('u0106');
  const w66 = tl.word('u0106', 'sixty-six');
  const wThese = tl.word('u0106', 'these');

  // ---------------------------------------------------------------- the wall
  const answer = pinAt(board, BOX_UV[0] - 0.012, BOX_UV[1] + 0.01);
  const box = blackBoxField(board, {u: BOX_UV[0], v: BOX_UV[1], size: BOX_SIZE, h: 0.42, tint: 0.3});
  const withAnswer = (h: number, tint: number, glow: number): FieldFn => (u, v, i) => (i === answer ? {h, tint, glow} : box(u, v, i));
  const riseAt = s1.start + 1.05;
  const litAt = wAnswer.start - 0.12;
  const outAt = wAnswer.start + 0.28;
  const burstAt = s2.start - 0.75;
  const pixieIn = Math.max(burstAt + 0.55, wPixie.start - 0.9);
  const titleAt = s3.start;

  // the title, pressed into the wall at the left margin (the kicker and tagline sit beside it)
  const titleH = 9.5;
  const titleLeft = 0.134;
  const titleV = 0.545;
  // a darker band under the letters so the raised white pins read as type
  const titleBand = rectField(board, {u: titleLeft + 0.25, v: titleV, w: 104, h: 17, radius: 2}, {h: 0, tint: 0.52, soft: 2});
  const title = pinTextField(board, 'title', {left: titleLeft, v: titleV, heightPins: titleH}, {h: 0.13, tint: 1.0, ground: titleBand});

  const beats: Beat[] = [
    {id: 'c01-box-rise', at: riseAt, field: withAnswer(0.42, 0.3, 0), sweep: {origin: BOX_UV, speed: 0.28, delayS: 0, jitterS: 0.12}},
    {id: 'c01-answer-lit', at: litAt, field: withAnswer(0.42, 1.0, 1)},
    {id: 'c01-answer-out', at: outAt, field: withAnswer(1.08, 1.0, 1), sweep: {origin: BOX_UV, speed: 2, jitterS: 0}},
    // the box sinks back as the spinner bursts; the pins where Pixie forms are the live layer's
    {id: 'c01-box-sink', at: burstAt + 0.1, field: flatField(), sweep: {kind: 'random', origin: BOX_UV, speed: 1, spreadS: 0.7, jitterS: 0.05}},
    // "one of these repositories": the 66 places of the walk glow faintly on the wall, in their
    // fourteen neighbourhoods (the map that returns, drawn whole, in 14.3)
    {id: 'c01-map', at: wThese.start + 0.2, field: mapField(board, () => ({h: 0.14, tint: 1.0, glow: 0.5}), flatField()), sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.9, jitterS: 0.05}},
    {id: 'c01-map-out', at: w66.start + 0.2, field: flatField(), sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.9, jitterS: 0.04, tintFollowsWave: true}},
    {id: 'c01-title', at: titleAt, field: title, sweep: {kind: 'linear', origin: [titleLeft - 0.02, titleV], direction: [1, 0], speed: 0.55, jitterS: 0.05, tintFollowsWave: true}},
  ];

  // ---------------------------------------------------------------- Pixie in pins (01.2)
  // the pins Pixie acts out the five steps it names, on the words (its own cue list: no card is
  // on screen, so nothing is claimed); the film-wide guide cues below carry the card.
  const u5 = tl.utt('u0105');
  const stepWord = (w: string) => tl.word('u0105', w).start - 0.08;
  const localCues: PixieCue[] = [
    {frame: f(wPixie.end + 0.05), activity: 'success'},
    {frame: f(stepWord('reading')), activity: 'reading'},
    {frame: f(stepWord('searching')), activity: 'searching'},
    {frame: f(stepWord('editing')), activity: 'writing'},
    {frame: f(stepWord('running')), activity: 'running'},
    {frame: f(stepWord('debugging')), activity: 'debugging'},
    {frame: f(u5.end + 0.6), activity: 'idle'},
  ];
  const localTl = resolveTimeline(localCues, st.fps);
  const cell = 3 / board.cols;
  const pinsOut = wThese.start - 0.35;
  const dollyAt = w66.end + 0.3;
  const pixiePresence = (t: number, u: number, v: number) => {
    const ri = random(`c01-pp-${Math.round(u * 997)}-${Math.round(v * 991)}`);
    const rin = smooth((t - pixieIn - 1.05 * ri) / 0.22);
    // lift-off: the pins sink from the top down as the guide takes over in the lower third
    const top = PIXIE_UV[1] + 16 * (cell / board.extH);
    const vk = clamp01((top - v) / (32 * (cell / board.extH)));
    const rout = 1 - smooth((t - pinsOut - 0.7 * vk - 0.1 * ri) / 0.3);
    return Math.min(rin, rout);
  };
  const field = pixieField({fps: st.fps, timeline: localTl, cell, boardAspect: board.extH, center: PIXIE_UV, relief: 0.22, presence: pixiePresence, facing: 'left', gain: 1.75});
  const live: LiveLayer[] = [{fn: field, region: field.bounds, from: pixieIn - 0.1, to: pinsOut + 1.4, fadeS: 0.05, speedHint: () => 2}];

  // ---------------------------------------------------------------- camera and lens
  const boxTop = 0.42 * relief + 0.3 * board.p;
  const answerTop = 1.08 * relief + 0.3 * board.p;
  const boxPose = pose(st, {uv: BOX_UV, z: boxTop, pinsAcross: 104, screen: [0.565, 0.6], yaw: -0.1, pitch: -0.075});
  const pixiePose = pose(st, {uv: [0.5, 0.5], pinsAcross: 170, screen: [0.5, 0.5], yaw: 0.08, pitch: 0.05});
  const titlePose = pose(st, {uv: [0.5, 0.505], pinsAcross: 150, screen: [0.5, 0.5], yaw: 0.1, pitch: 0.045});
  const rolled = (p: CameraPose, roll: number): CameraPose => ({...p, roll});
  const camera: CameraKey[] = [
    {at: s1.start, pose: boxPose},
    // the box turns about 4 degrees over 6 s while the reel's slow push-in runs
    {at: riseAt, dur: 6, pose: rolled(pushIn(boxPose, 0.03), 0.07), ease: 'inOutSine'},
    {at: riseAt + 6, dur: Math.max(1, burstAt - riseAt - 6), pose: rolled(pushIn(boxPose, 0.065), 0.07), ease: 'inOutSine'},
    {at: burstAt, dur: 2.2, pose: pixiePose},
    {at: burstAt + 2.2, dur: Math.max(1, pinsOut - burstAt - 2.2), pose: pushIn(pixiePose, 0.05), ease: 'inOutSine'},
    // the lateral dolly: the camera travels right along the wall while Pixie scurries in place
    {at: dollyAt, dur: Math.max(1, titleAt - dollyAt - 0.4), pose: {...pushIn(pixiePose, 0.03), target: [pixiePose.target[0] + 0.05, pixiePose.target[1] + 0.004, pixiePose.target[2]]}, ease: 'inOutSine'},
    {at: titleAt - 0.45, dur: 1.15, pose: titlePose},
    {at: titleAt + 0.7, dur: Math.max(1, s3.end - titleAt - 0.7), pose: pushIn(titlePose, 0.02), ease: 'inOutSine'},
  ];
  const fz = boxPose.distance * 0.97;
  const aperture = apertureForBlur(4.5, fz, -(answerTop - boxTop), boxPose.fov);
  const focus: FocusKey[] = [
    {at: s1.start, to: {uv: BOX_UV, h: boxTop}, aperture},
    {at: outAt, dur: 0.8, to: {uv: [board.u[answer], board.v[answer]], h: answerTop}},
    {at: burstAt, dur: 0.9, to: {uv: PIXIE_UV, h: 0.1 * relief}, aperture: 0},
  ];
  const [bx, by] = wxy(board, BOX_UV[0], BOX_UV[1]);
  const [px, py] = wxy(board, PIXIE_UV[0], PIXIE_UV[1]);
  const [tx, ty] = wxy(board, 0.36, titleV);
  const light: LightKey[] = [
    {at: s1.start, key: 0, pool: 1, spread: 0.62, look: [-0.25, -0.14], poolAt: [bx + 0.015, by + 0.02], env: 0.6},
    {at: s1.start + 1.2, dur: 1.9, key: 0.85, ease: 'inOutSine'},
    {at: burstAt, dur: 1.8, spread: 0.95, poolAt: [px - 0.02, py + 0.02], look: [-0.1, -0.05], env: 0.8},
    {at: titleAt - 0.3, dur: 1.2, key: 0.9, spread: 1.3, poolAt: [tx, ty + 0.02], look: [0, 0], env: 0.9},
  ];

  // ---------------------------------------------------------------- 3D: dust in the light pool
  const world: TimedNode[] = [
    {
      id: 'c01-dust',
      from: s1.start,
      to: s3.end,
      render: () => (
        <Dust
          count={520}
          center={[bx, by, 0.32]}
          box={[1.1, 0.62, 0.62]}
          drift={[0.004, 0.002, 0]}
          brightness={0.2}
          size={[0.0011, 0.0024]}
          bokeh={0.85}
          opacity={(t: number) => smooth((t - s1.start - 1.3) / 2.2) * (1 - smooth((t - s3.end + 1.5) / 1.4))}
          seed={11}
        />
      ),
    },
  ];

  // ---------------------------------------------------------------- overlays
  const headline = (id: string, words: typeof u1.words, exitAt: number): TimedNode => ({
    id,
    from: words[0].start - 0.3,
    to: exitAt + 0.4,
    render: (t) => (
      <KineticLine words={words} t={t} kind="headline" variant="focus" align="center" x={st.W / 2} y={Math.round(st.H * layout.headlineCapTopH)} yAnchor="capTop" maxWidth={0.8 * st.W} exitAt={exitAt} />
    ),
  });
  // the spinner sits on the wall beside the box; the title type is set against the pin letters
  const spinUV: [number, number] = [BOX_UV[0] - 0.135, BOX_UV[1] + 0.005];
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    return projectToScreen(p, [x, y, z], st.W, st.H);
  };
  const titleZ = 0.13 * relief;
  const inkHalfV = (titleH / 2) * board.rowH / board.extH * (board.p / board.rowH);
  const overlays: TimedNode[] = [
    headline('c01-h1', u1.words, u2.start - 0.35),
    headline('c01-h2', u2.words, tl.utt('u0103').start - 0.3),
    {
      id: 'c01-spinner',
      from: s1.start + 1.6,
      to: burstAt + 1.2,
      render: (t) => {
        const [x, y] = at(t, spinUV[0], spinUV[1]);
        return <Spinner t={t} x={x} y={y} r={Math.round(st.H * 0.028)} from={s1.start + 1.6} stopAt={wSpinner.start + 0.05} burstAt={burstAt} />;
      },
    },
    {
      id: 'c01-rain',
      from: burstAt,
      to: burstAt + 2.6,
      render: (t) => {
        const [x0, y0] = at(burstAt, spinUV[0], spinUV[1]);
        const [x1, y1] = at(t, PIXIE_UV[0], PIXIE_UV[1] + 0.02);
        return <Rain t={t} from={burstAt + 0.2} x0={x0} y0={y0} x1={x1} y1={y1} w={st.W * 0.17} h={st.H * 0.52} />;
      },
    },
    {
      id: 'c01-title-type',
      from: titleAt,
      to: s3.end + 0.2,
      render: (t) => {
        const top = at(t, titleLeft, titleV + inkHalfV, titleZ)[1];
        const bottom = at(t, titleLeft, titleV - inkHalfV, titleZ)[1];
        return <TitleType t={t} from={titleAt + 0.2} to={s3.end + 0.15} titleTop={top} titleBottom={bottom} />;
      },
    },
  ];

  // ---------------------------------------------------------------- the guide's cues (film-wide)
  const guideAt = pinsOut - 0.85;
  const pixie: PixieCue[] = [
    {frame: f(s1.start), activity: 'thinking', detail: ''},
    {frame: f(wPixie.end + 0.05), activity: 'success', detail: ''},
    {frame: f(u6.start + 0.05), activity: 'reading', detail: 'Read Claude-Code-In-Motion/README.md'},
    {frame: f(titleAt), activity: 'idle', detail: ''},
  ];

  return {
    beats,
    camera,
    focus,
    light,
    live,
    world,
    overlays,
    captionSkip: ['u0101', 'u0102'],
    pixie,
    titlePose,
    guideAt,
    ruleAt: w66.start - 0.25,
    scurry: [dollyAt, titleAt - 0.2],
  };
};

