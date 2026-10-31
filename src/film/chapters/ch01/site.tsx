import React from 'react';
import {Freeze, staticFile, useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import type {CodeSnippet} from '../../../engine/code/types';
import {apertureForBlur, lowAnglePull, macroOn, projectToScreen, pushIn, rigPoseAt, type CameraKey, type CameraPose, type FocusKey} from '../../../engine/camera';
import {booleanPortrait, makeBoard, portraitField, SWEEPS, type Beat, type Board, type FieldFn, type LightKey, type LiveLayer, type Ripple} from '../../../engine/pins';
import {FILM_RIPPLE} from '../../../engine/pins';
import {Laptop} from '../../../engine/devices';
import {Streams} from '../../../engine/fx';
import type {PixieCue} from '../../../pixie';
import type {TimedNode} from '../../types';
import traceSnippet from '../../../data/ch01/code/site-trace.json';
import {bodyStyle, capsStyle, Chip, chipSlot, clamp01, easeOut, Em, env, fmtInt, HoldGlyph, legible, MissGlyph, monoStyle, MONO_MIN, NamePlate, pull, ramp, TypedChip} from './kit';
import {GUARD, gridBox, guardField, literalCells, tallyLayer, unsafeWords, type GuardLayout, type GuardPrompt, type TallyStep} from './guard';
import {pose, wxy, type Part, type Stage} from './stage';

// 01.4 the website's hero board: the portrait in pins, true and false, one literal, one guard;
// 01.5 the live guard on a laptop, five prompts, two misses, and the model file that travels.

const SNIPPET = traceSnippet as unknown as CodeSnippet;

/** The site's hero board, 104 columns (pins.js formula), as a window of the film wall. */
const heroWindow = (board: Board, cu: number, cv: number) => {
  // the window spans 120 hex rows; even rows hold 104 pins, odd rows 103 (the site's board)
  const rows = 120;
  const r0 = Math.round(cv * (board.rows - 1) - (rows - 1) / 2);
  const r0e = r0 % 2 === 0 ? r0 : r0 - 1;
  const cEven = Math.round(cu * board.cols - 104 / 2);
  const inWin = new Uint8Array(board.N);
  let n = 0;
  for (let r = r0e; r < r0e + rows; r++) {
    const odd = r % 2 === 1;
    const cnt = odd ? 103 : 104;
    for (let c = cEven; c < cEven + cnt; c++) {
      const i = board.rowStart[r] + c;
      inWin[i] = 1;
      n++;
    }
  }
  // the window's extent in uv (pin centres, plus half a pitch), for placing face.png over it
  const iTL = board.rowStart[r0e + rows - 1] + cEven;
  const iBR = board.rowStart[r0e] + cEven + 103;
  const u0 = board.u[iTL] - board.p / 2;
  const u1 = board.u[iBR] + board.p / 2;
  const vTop = board.v[iTL] + board.p / 2 / board.extH;
  const vBot = board.v[iBR] - board.p / 2 / board.extH;
  return {inWin, count: n, centre: [(u0 + u1) / 2, (vTop + vBot) / 2] as [number, number], wPins: (u1 - u0) / board.p, hPins: ((vTop - vBot) * board.extH) / board.p};
};

/** The site's own count for comparison: a 104-column board by its grid formula. */
const SITE_BOARD = makeBoard({cols: 104, aspect: 1});

const Callout: React.FC<{t: number; at: number; exitAt: number; x: number; y: number; children: React.ReactNode}> = ({t, at, exitAt, x, y, children}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        display: 'flex',
        alignItems: 'center',
        gap: Math.round(H * 0.012),
        padding: `${Math.round(H * 0.012)}px ${Math.round(H * 0.02)}px`,
        borderRadius: Math.round(H * 0.04),
        background: 'rgba(14,18,17,0.9)',
        border: `${hair}px solid rgba(228,234,231,0.18)`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        ...pull(k, H),
      }}
    >
      <span style={{width: Math.round(H * 0.011), height: Math.round(H * 0.011), borderRadius: '50%', background: color.accent.mint, boxShadow: `0 0 ${Math.round(H * 0.012)}px ${color.accent.mintGlow}`}} />
      <span style={{...bodyStyle(H, 0.032, 500), whiteSpace: 'pre'}}>{children}</span>
    </div>
  );
};

/** The present words of a prompt as literal chips, each wired to its pin on the wall. */
const LiteralChips: React.FC<{t: number; at: number; exitAt: number; p: GuardPrompt; pins: Array<{word: string; x: number; y: number}>; x: number; y: number}> = ({t, at, exitAt, p, pins, x, y}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  const uw = unsafeWords(p);
  const row = H * 0.046;
  const hair = Math.max(1, Math.round(H / 1080));
  return (
    <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        {pins.map((q, j) => {
          const cy = y + j * row + row / 2;
          const kk = easeOut(ramp(t, at + 0.15 + j * 0.06, 0.5));
          const x0 = x + H * 0.24;
          const xe = x0 + (q.x - x0) * kk;
          const ye = cy + (q.y - cy) * kk;
          return <path key={j} d={`M ${x0} ${cy} C ${x0 + (q.x - x0) * 0.4} ${cy}, ${xe - (q.x - x0) * 0.25} ${ye}, ${xe} ${ye}`} fill="none" stroke={uw.has(q.word) ? 'rgba(116,201,174,0.75)' : 'rgba(228,234,231,0.4)'} strokeWidth={hair * 1.5} />;
        })}
      </svg>
      {pins.map((q, j) => {
        const n = uw.get(q.word) ?? 0;
        const kk = easeOut(ramp(t, at + j * 0.06, 0.4));
        return (
          <div
            key={j}
            style={{
              position: 'absolute',
              left: Math.round(x),
              top: Math.round(y + j * row + (row - H * 0.036) / 2),
              height: Math.round(H * 0.036),
              width: Math.round(H * 0.24),
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `0 ${Math.round(H * 0.012)}px`,
              borderRadius: Math.round(H * 0.018),
              border: `${hair}px solid ${n ? color.accent.mint : 'rgba(228,234,231,0.24)'}`,
              background: n ? 'rgba(116,201,174,0.1)' : 'rgba(14,18,17,0.85)',
              opacity: kk,
            }}
          >
            <span style={monoStyle(H, MONO_MIN, color.text.display)}>{q.word}</span>
            <span style={monoStyle(H, MONO_MIN, n ? color.accent.mint : color.text.tertiary)}>{n ? `×${n}` : ''}</span>
          </div>
        );
      })}
    </div>
  );
};

/** The verdict as the guard computes it: votes on each side and the margin. */
const Verdict: React.FC<{t: number; at: number; exitAt: number; x: number; y: number; p: GuardPrompt; miss?: boolean; label?: string}> = ({t, at, exitAt, x, y, p, miss, label}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.35, 0.3);
  if (k <= 0.001) return null;
  const word = p.unsafe ? 'BLOCKED' : 'ALLOWED';
  const by = p.unsafe ? `unsafe by ${p.margin}` : `safe by ${-p.margin}`;
  const g = Math.round(H * 0.026);
  return (
    <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y), ...pull(k, H)}}>
      {label ? <div style={{...capsStyle(H, MONO_MIN, 0.14), color: color.text.chipDim, textShadow: legible(H), marginBottom: Math.round(H * 0.01)}}>{label}</div> : null}
      <div style={{display: 'flex', alignItems: 'center', gap: Math.round(H * 0.012)}}>
        {miss ? <MissGlyph size={g} /> : <HoldGlyph size={g} />}
        <span style={{...capsStyle(H, 0.03, 0.1), fontWeight: 600, color: miss ? color.text.secondary : color.accent.mint, textShadow: legible(H)}}>{word}</span>
        <span style={{...monoStyle(H, 0.026, color.text.display), textShadow: legible(H)}}>{by}</span>
      </div>
      <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.008), textShadow: legible(H)}}>
        {`${p.forUnsafe} vote unsafe · ${p.forSafe} vote safe`}
      </div>
    </div>
  );
};

export interface SiteOut extends Part {
  /** the pose the camera holds at the end of 01.5 */
  endPose: CameraPose;
  /** the code panel's window (the rule line hides under it) */
  codeWindow: [number, number];
}

export const buildSite = (st: Stage, from: {pose: CameraPose}): SiteOut => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const face = ctx.assets.face;
  const s4 = tl.scene('01.4');
  const s5 = tl.scene('01.5');
  const u7 = tl.utt('u0107');
  const u8 = tl.utt('u0108');
  const u9 = tl.utt('u0109');
  const u10 = tl.utt('u0110');
  const wTwelve = tl.word('u0107', 'twelve');
  const wClick = tl.word('u0108', 'click');
  const wTrue = tl.word('u0108', 'true');
  const wLiteral = tl.word('u0109', 'literal');
  const wAnd = tl.word('u0110', 'AND');
  const wVote = tl.word('u0110', 'vote');
  const wMargin = tl.word('u0110', 'margin');

  // ---------------------------------------------------------------- the hero board
  const hero = heroWindow(board, 0.6, 0.5);
  const heroCount = hero.count;
  const siteCount = SITE_BOARD.N;
  const facePlace = {u: hero.centre[0], v: hero.centre[1], height: hero.hPins, width: hero.wPins};
  const portrait = portraitField(board, face, facePlace);
  const bools = booleanPortrait(board, face, facePlace, {relief: 0.55});
  const MASK_N = bools.counts.mask;
  // the hero board reads as the site's board: its window sits on a slightly darker plate
  const plated = (fld: FieldFn): FieldFn => (u, v, i) => {
    const s = fld(u, v, i);
    if (!hero.inWin[i] || s.h > 0.001 || typeof s.tint !== 'number') return s;
    return {...s, tint: Math.min(s.tint, 0.8)};
  };

  // ---------------------------------------------------------------- the guard (prompt 1 first)
  // the guard at the centre of the wall (01.4), then moved left to make room for the laptop (01.5):
  // the wall re-targets, the camera never runs past the wall's edge
  const L: GuardLayout = {cu: 0.5, cv: 0.505, s: 2.6};
  const L5: GuardLayout = {cu: 0.3, cv: 0.505, s: 2.6};
  const cells = literalCells(board, L);
  const cells5 = literalCells(board, L5);
  const P = GUARD.prompts;
  const steel: FieldFn = () => ({h: 0, tint: 0.9});
  const ignoreIdx = P[0].presentIdx[P[0].present.indexOf('ignore')];
  const ignoreCell = cells[ignoreIdx];
  const box = gridBox(board, L);
  const tallyU = box.u1 + 4.5 * board.p;
  const tallyV = box.v0 + 0.5 * (board.rowH / board.extH);
  const box5 = gridBox(board, L5);
  const tallyU5 = box5.u1 + 4.5 * board.p;

  const flipAt = wClick.start + 0.05;
  const toGuardAt = u9.start - 0.55;
  const beats: Beat[] = [
    {id: 'c01-portrait', at: s4.start, field: plated(portrait), sweep: {kind: 'linear', origin: [0.08, 0.5], direction: [1, 0], speed: 0.7, jitterS: 0.07}},
    {id: 'c01-bools', at: flipAt, field: plated(bools.field), sweep: {...SWEEPS.booleanFlip([0.3, 0.15]), speed: 0.75, tintLeadS: 0.22}},
    {id: 'c01-guard', at: toGuardAt, field: guardField(board, L, P[0], steel), sweep: {kind: 'random', origin: [0.6, 0.5], speed: 1, spreadS: 0.8, jitterS: 0.04, tintFollowsWave: true}},
  ];
  const ripples: Ripple[] = [{...FILM_RIPPLE, at: flipAt - 0.05, origin: [0.3, 0.15], amp: 0.05}];

  // ---------------------------------------------------------------- 01.5: five prompts on the guard
  const w = (u: string, word: string) => tl.word(u, word).start;
  const press = [w('u0112', 'obvious') - 0.15, w('u0112', 'German') - 0.2, tl.utt('u0112').end + 0.15, w('u0113', 'slips') - 0.15, w('u0113', 'wrong') - 0.2];
  // the normal question sits between two sentences; keep at least 1.2 s before the fourth
  press[2] = Math.min(press[2], press[3] - 1.3);
  const moveAt = s5.start - 0.25;
  beats.push({id: 'c01-guard-left', at: moveAt, field: guardField(board, L5, null, steel), sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.8, jitterS: 0.04, tintFollowsWave: true}});
  P.forEach((p, k) => {
    beats.push({id: `c01-prompt${k + 1}`, at: press[k] + 0.25, field: guardField(board, L5, p, steel), sweep: {kind: 'random', origin: [0.3, 0.5], speed: 1, spreadS: 0.45, jitterS: 0.03, tintFollowsWave: true}});
  });
  const tally4 = tallyLayer(board, {u: tallyU, v: tallyV, gap: 6, width: 3}, [{at: wVote.start + 0.1, unsafe: P[0].forUnsafe, safe: P[0].forSafe}], moveAt + 0.3, 2);
  const tally5 = tallyLayer(board, {u: tallyU5, v: tallyV, gap: 6, width: 3}, P.map((p, k) => ({at: press[k] + 0.55, unsafe: p.forUnsafe, safe: p.forSafe})), s5.end - 0.2, 2);
  const live: LiveLayer[] = [
    {fn: tally4.fn, region: tally4.region, from: wVote.start - 0.3, to: moveAt + 0.3, fadeS: 0.3},
    {fn: tally5.fn, region: tally5.region, from: press[0], to: s5.end - 0.2, fadeS: 0.3},
  ];

  // ---------------------------------------------------------------- camera
  const faceUV: [number, number] = [hero.centre[0], hero.centre[1] + 0.02];
  const facePose = pose(st, {uv: faceUV, pinsAcross: 150, screen: [0.66, 0.48], yaw: 0.14, pitch: 0.05});
  const lowPose = lowAnglePull(facePose, {pitch: -0.28, pull: 0.03, yaw: 0.17});
  const flipPose = pose(st, {uv: faceUV, pinsAcross: 140, screen: [0.66, 0.5], yaw: 0.1, pitch: 0.06});
  const pinTop = 0.3 * relief + 0.3 * board.p;
  const macro = macroOn(board, ignoreCell.pin, {pinsAcross: 24, h: 0.3 * relief, yaw: 0.3, pitch: 0.16, screen: [0.78, 0.55], aspect: st.aspect});
  const guardPose = pose(st, {uv: [L.cu, L.cv], pinsAcross: 160, screen: [0.5, 0.45], yaw: 0.08, pitch: 0.06});
  const demoPose = pose(st, {uv: [0.5, L.cv + 0.004], pinsAcross: 150, screen: [0.5, 0.5], yaw: 0.06, pitch: 0.05});
  const camera: CameraKey[] = [
    {at: s4.start - 0.2, dur: 1.7, pose: facePose},
    {at: u7.start + 0.6, dur: Math.max(2, u8.start - u7.start - 0.9), pose: lowPose, ease: 'inOutSine'},
    {at: wClick.start - 1.1, dur: 1.2, pose: flipPose},
    {at: flipAt + 0.4, dur: Math.max(1, toGuardAt - flipAt - 0.4), pose: pushIn(flipPose, 0.05), ease: 'inOutSine'},
    // a macro push-in onto one literal: the word 'ignore', present
    {at: toGuardAt + 0.1, dur: Math.max(1.2, wLiteral.start - toGuardAt + 0.2), pose: macro},
    {at: u10.start - 0.35, dur: 1.9, pose: guardPose},
    {at: u10.start + 1.6, dur: Math.max(1, s5.start - u10.start - 1.9), pose: pushIn(guardPose, 0.04), ease: 'inOutSine'},
    // 01.5: the grid moves left, the laptop swings in on the right
    {at: s5.start - 0.3, dur: 1.6, pose: demoPose},
    {at: s5.start + 1.4, dur: Math.max(1, s5.end - s5.start - 2.2), pose: pushIn(demoPose, 0.05), ease: 'inOutSine'},
  ];
  const macroAperture = apertureForBlur(7, macro.distance, 0.06, macro.fov);
  const [lx, ly] = wxy(board, 0.5, L.cv);
  const LAPTOP_POS: [number, number, number] = [lx + 0.165, ly - 0.105, 0.2];
  const focus: FocusKey[] = [
    {at: s4.start, to: {uv: faceUV, h: 0.3 * relief}, aperture: 0},
    {at: toGuardAt + 0.1, dur: 1.2, to: {uv: [ignoreCell.u, ignoreCell.v], h: pinTop}, aperture: macroAperture},
    {at: u10.start - 0.35, dur: 1.2, to: {uv: [L.cu, L.cv], h: 0.2 * relief}, aperture: 0},
    // the laptop in focus, the pins behind it step back
    {at: s5.start + 0.2, dur: 1.2, to: {point: [LAPTOP_POS[0], LAPTOP_POS[1] + 0.12, LAPTOP_POS[2] + 0.02]}, aperture: apertureForBlur(3.2, 1.3, 0.2, 18)},
    {at: s5.end - 0.9, dur: 0.8, to: {uv: [0.5, 0.5], h: 0}, aperture: 0},
  ];
  const [fx, fy] = wxy(board, faceUV[0], faceUV[1]);
  const [gx, gy] = wxy(board, L.cu, L.cv);
  const light: LightKey[] = [
    {at: s4.start - 0.2, dur: 1.6, key: 0.92, spread: 1.15, poolAt: [fx - 0.03, fy + 0.03], look: [0.1, -0.1], env: 0.95},
    {at: toGuardAt, dur: 1.2, spread: 1.0, poolAt: [gx + 0.02, gy + 0.02], look: [0.05, 0]},
    {at: s5.start, dur: 1.5, spread: 1.35, poolAt: [gx - 0.05, gy + 0.02], look: [0, 0], key: 0.94},
  ];

  // ---------------------------------------------------------------- the laptop (01.5)
  const rec = {src: staticFile('recordings/ch01-demo.mp4'), size: [2000, 1250] as [number, number], frames: 690, press: [1.2, 3.2, 5.2, 7.2, 9.2], why: 9.9};
  // film time -> recording time: each press lands on its word, the page holds still between them
  const recWindows: Array<[number, number, number]> = press.map((ft, k) => [ft - 0.75, rec.press[k] - 0.75, 1.9]);
  recWindows.push([w('u0114', 'clauses') - 0.3, rec.why, 1.5]);
  const recAt = (t: number) => {
    let r = 0;
    for (const [f0, r0, d] of recWindows) {
      if (t >= f0) r = r0 + Math.min(d, t - f0);
    }
    return Math.max(0, Math.min(rec.frames - 1, Math.round(r * 60)));
  };
  const swingIn = s5.start + 0.05;
  const swingOut = s5.end - 0.85;
  const laptopRot = (t: number) => {
    const a = easeOut(ramp(t, swingIn, 1.1));
    const b = clamp01((t - swingOut) / 0.75);
    const bb = b * b * (3 - 2 * b);
    return (1 - a) * (Math.PI / 2) - 0.14 * a + bb * (-Math.PI / 2 + 0.14);
  };
  const screenLook = {tone: 'aces' as const, exposure: 0.92, glare: 0.18};
  const world: TimedNode[] = [
    {
      id: 'c01-laptop',
      from: swingIn,
      to: s5.end,
      premountS: 1.5,
      render: (t) => (
        <group position={LAPTOP_POS} rotation={[0, laptopRot(t), 0]} scale={0.112}>
          <Freeze frame={recAt(t)} active>
            <Laptop lidAngle={108} screen={{src: rec.src, size: rec.size, durationInFrames: rec.frames, fit: 'cover'}} look={screenLook} spill={0.5} castShadow={false} />
          </Freeze>
        </group>
      ),
    },
    {
      id: 'c01-thread',
      from: tl.utt('u0115').start,
      to: s5.end,
      render: () => {
        const [x0, y0] = wxy(board, L5.cu, L5.cv - 0.02);
        return (
          <Streams
            curves={[
              {
                curve: {kind: 'line', from: [x0, y0, 0.03], to: [x0 + 1.1, y0 - 0.05, 0.03]},
                from: tl.utt('u0115').start + 0.3,
                to: s5.end,
                drawOnS: 1.6,
                fadeS: 0.6,
                speed: 0.35,
                every: 0.35,
                packetLength: 0.06,
                radius: 0.0022,
                intensity: 2.2,
                bloom: 0.8,
                line: {width: 1.4, intensity: 0.5, color: color.accent.mint},
              },
            ]}
          />
        );
      },
    },
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const plate = tl.utt('u0107').start + 0.2;
  const chip = (k: number) => chipSlot(W, H, k);
  // above the laptop, while it is on screen
  const top = (k: number) => ({x: Math.round(W * 0.962), y: Math.round(H * (0.09 + 0.052 * k))});
  const codePages: CodePage[] = [
    {
      at: u9.start - 0.1,
      source: {snippet: SNIPPET, lines: [32, 51]},
      dedent: 2,
      view: 32,
      rows: 11,
      zoom: 0.87,
      width: Math.round(W * 0.53),
      header: {label: 'AnwarDebes.github.io', path: 'assets/js/trace.js', meta: 'TraceGuard'},
      cues: [
        cue.reveal(u9.start, {lines: [32, 43], stagger: 0.07}),
        cue.highlight(wLiteral.start - 0.1, [32, 33], {until: wAnd.start - 0.2}),
        cue.annotate(wLiteral.start + 0.2, 33, 'literal = a word, *present* or absent', {match: 'k < this.F', until: wAnd.start - 0.2}),
        cue.scroll(wAnd.start - 0.6, [39, 50], {dur: 0.9, align: 'center'}),
        cue.highlight(wAnd.start - 0.15, [42, 43], {until: wVote.start - 0.15}),
        cue.annotate(wAnd.start + 0.15, 43, 'clause = *AND* of its literals', {match: '!this.literal(x, inc[n])', side: 'below', until: wVote.start - 0.15}),
        cue.highlight(wVote.start - 0.1, [45, 46], {until: wMargin.start - 0.15}),
        cue.highlight(wMargin.start - 0.1, [50, 50], {until: u10.end + 0.8}),
        cue.annotate(wMargin.start + 0.15, 50, 'vote > 0 → *blocked*', {match: 'unsafe: v > 0', side: 'below', until: u10.end + 0.8}),
      ],
    },
  ];
  const codeExit = u10.end + 0.9;
  const prompt1Pins = () => P[0].present.map((word, j) => ({word, k: P[0].presentIdx[j]}));

  const overlays: TimedNode[] = [
    {
      id: 'c01-site-plate',
      from: plate,
      to: s5.end,
      render: (t) => <NamePlate t={t} at={plate} exitAt={s5.start + 0.9} name="AnwarDebes.github.io" status="Working website · live" />,
    },
    {
      id: 'c01-count',
      from: wTwelve.start - 0.2,
      to: flipAt + 0.4,
      render: (t) => (
        <>
          <Callout t={t} at={wTwelve.start - 0.1} exitAt={flipAt + 0.3} x={W * layout.marginLeftW} y={H * 0.62}>
            <b style={{fontWeight: 700, color: color.text.key}}>{fmtInt(heroCount)}</b> pins <Em>(counted from the mesh)</Em>
            {heroCount !== 12420 || siteCount !== 12420 ? <span style={{color: color.signal.amber}}>{`  ≠ 12,420`}</span> : null}
          </Callout>
          <Chip t={t} at={wTwelve.start + 0.3} exitAt={flipAt + 0.3} {...chip(0)} repo="AnwarDebes.github.io" path="assets/js/pins.js" line="76-99" />
          <Chip t={t} at={wTwelve.start + 0.7} exitAt={flipAt + 0.3} {...chip(1)} repo="AnwarDebes.github.io" path="assets/js/home.js" line={152} />
        </>
      ),
    },
    {
      id: 'c01-mask',
      from: wTrue.start - 0.3,
      to: toGuardAt + 0.5,
      render: (t) => (
        <>
          <Callout t={t} at={wTrue.start - 0.15} exitAt={toGuardAt + 0.4} x={W * layout.marginLeftW} y={H * 0.62}>
            <b style={{fontWeight: 700, color: color.text.key}}>{fmtInt(MASK_N)}</b> pins in the portrait, each one <Em>true</Em> or <Em>false</Em>
          </Callout>
          <Chip t={t} at={wTrue.start + 0.25} exitAt={toGuardAt + 0.4} {...chip(0)} repo="AnwarDebes.github.io" path="assets/js/pins.js" line="202-223" />
          <Chip t={t} at={wTrue.start + 0.6} exitAt={toGuardAt + 0.4} {...chip(1)} repo="AnwarDebes.github.io" path="assets/js/home.js" line="164-197" />
        </>
      ),
    },
    {
      id: 'c01-literal-label',
      from: wLiteral.start - 0.5,
      to: u10.start + 0.2,
      render: (t) => {
        const q = at(t, ignoreCell.u, ignoreCell.v, pinTop);
        const k = env(t, wLiteral.start - 0.3, u10.start, 0.4, 0.35);
        if (k <= 0.001) return null;
        return (
          <div style={{position: 'absolute', left: Math.round(q.x - H * 0.06), top: Math.round(q.y + H * 0.075), width: Math.round(H * 0.5), ...pull(k, H)}}>
            <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>literal 30 · word present</div>
            <div style={{...monoStyle(H, 0.04, color.text.key, 600), textShadow: legible(H), marginTop: Math.round(H * 0.006)}}>ignore</div>
          </div>
        );
      },
    },
    {
      id: 'c01-code',
      from: u9.start - 0.2,
      to: codeExit + 0.6,
      render: (t) => <CodePanel pages={codePages} x={Math.round(W * layout.marginLeftW)} y={Math.round(H * 0.2)} anchor="top-left" t={t} enter={{at: u9.start - 0.2, dur: 0.6}} exit={{at: codeExit, dur: 0.5}} maxWidth={Math.round(W * 0.53)} />,
    },
    {
      id: 'c01-trace-chip',
      from: u9.start,
      to: codeExit + 0.4,
      render: (t) => <Chip t={t} at={wLiteral.start + 0.4} exitAt={codeExit} {...chip(0)} repo="AnwarDebes.github.io" path="assets/js/trace.js" line="32-51" />,
    },
    {
      id: 'c01-prompt1',
      from: u10.start,
      to: s5.start + 0.6,
      render: (t) => {
        const pins = prompt1Pins().map(({word, k}) => {
          const q = at(t, cells[k].u, cells[k].v, pinTop);
          return {word, x: q.x, y: q.y};
        });
        const tq = at(t, tallyU + 11 * board.p, tallyV + (22 * board.rowH) / board.extH, 0);
        void cells5;
        return (
          <>
            <LiteralChips t={t} at={codeExit + 0.3} exitAt={s5.start + 0.4} p={P[0]} pins={pins} x={W * layout.marginLeftW} y={H * 0.215} />
            <Verdict t={t} at={wMargin.start + 0.2} exitAt={s5.start + 0.4} x={tq.x} y={tq.y} p={P[0]} label="An obvious attack" />
            <Chip t={t} at={codeExit + 0.5} exitAt={s5.start + 0.3} {...chip(0)} repo="AnwarDebes.github.io" path="assets/data/trace-model.json" line={1} />
            <Pill t={t} at={codeExit + 0.8} exitAt={s5.start + 0.3} x={W * 0.962} y={chip(1).y} text={`${GUARD.n_clauses} clauses · ${GUARD.n_features} word features · no server`} />
          </>
        );
      },
    },
    {
      id: 'c01-demo-labels',
      from: press[0] - 0.4,
      to: s5.end,
      render: (t) => {
        let k = -1;
        press.forEach((pt, j) => {
          if (t >= pt + 0.35) k = j;
        });
        if (k < 0) return null;
        const p = P[k];
        const miss = k === 3 || k === 4;
        const next = k + 1 < press.length ? press[k + 1] + 0.3 : s5.end - 0.7;
        const g = {x: W * layout.marginLeftW, y: H * 0.075};
        return (
          <>
            <Verdict t={t} at={press[k] + 0.35} exitAt={next} x={g.x} y={g.y} p={p} miss={miss} label={p.label} />
            {miss ? (
              <Pulled t={t} from={press[k] + 0.5} to={next} x={g.x + H * 0.62} y={g.y + H * 0.035}>
                <span style={{fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(H * 0.032), color: color.text.display, textShadow: legible(H)}}>{`“${p.text}”`}</span>
              </Pulled>
            ) : null}
          </>
        );
      },
    },
    {
      id: 'c01-demo-chips',
      from: s5.start + 1,
      to: s5.end,
      render: (t) => (
        <>
          <Chip t={t} at={s5.start + 1.6} exitAt={press[2]} {...top(0)} repo="AnwarDebes.github.io" path="index.html" line="143-147" />
          <Chip t={t} at={press[3]} exitAt={tl.utt('u0115').start} {...top(0)} repo="AnwarDebes.github.io" path="assets/js/trace.js" line="16-51" />
          <TypedChip t={t} at={tl.utt('u0115').start + 0.4} exitAt={s5.end - 0.5} {...top(0)} kind="same model file in trace and veritas" text={`SHA-256 ${GUARD.sha256.slice(0, 8)}…`} />
          <Chip t={t} at={tl.utt('u0115').start + 1.2} exitAt={s5.end - 0.5} {...top(1)} repo="trace" path="live/trace-model.json" line={1} />
          <Chip t={t} at={tl.utt('u0115').start + 1.6} exitAt={s5.end - 0.5} {...top(2)} repo="veritas" path="live/trace-model.json" line={1} />
        </>
      ),
    },
  ];

  // ---------------------------------------------------------------- Pixie
  const pixie: PixieCue[] = [
    {frame: f(plate + 0.3), activity: 'reading', detail: 'Read assets/js/pins.js'},
    {frame: f(u9.start), activity: 'reading', detail: 'Read assets/js/trace.js'},
    {frame: f(press[0] - 0.1), activity: 'debugging', detail: 'Check five prompts against trace-model.json'},
    {frame: f(press[3] + 0.3), activity: 'debugging', detail: 'Disregard the rules… → allowed'},
    {frame: f(press[4] + 0.3), activity: 'debugging', detail: 'Write a poem about the sea. → blocked'},
    {frame: f(s5.end - 0.4), activity: 'idle', detail: ''},
  ];

  return {beats, ripples, camera, focus, light, live, world, overlays, pixie, endPose: pushIn(demoPose, 0.05), codeWindow: [u9.start - 0.2, codeExit + 0.5]};
};

/** A dark pill with mono text, right-aligned at x (a stated fact that is not a file citation). */
export const Pill: React.FC<{t: number; at: number; exitAt: number; x: number; y: number; text: string}> = ({t, at, exitAt, x, y, text}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.3, 0.3);
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 1080));
  const h = Math.round(MONO_MIN * H * 1.85);
  return (
    <div
      style={{
        position: 'absolute',
        right: Math.round(W - x),
        top: Math.round(y - h / 2),
        height: h,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${Math.round(MONO_MIN * H * 0.72)}px`,
        borderRadius: h / 2,
        background: 'rgba(19,19,19,0.94)',
        border: `${hair}px solid rgba(228,234,231,0.16)`,
        opacity: k,
      }}
    >
      <span style={monoStyle(H, MONO_MIN, color.text.display)}>{text}</span>
    </div>
  );
};

/** A focus-pulled block at a screen point. */
const Pulled: React.FC<{t: number; from: number; to: number; x: number; y: number; children: React.ReactNode}> = ({t, from, to, x, y, children}) => {
  const {height: H} = useVideoConfig();
  const k = env(t, from, to, 0.35, 0.3);
  if (k <= 0.001) return null;
  return <div style={{position: 'absolute', left: Math.round(x), top: Math.round(y), maxWidth: Math.round(H * 0.7), ...pull(k, H)}}>{children}</div>;
};

