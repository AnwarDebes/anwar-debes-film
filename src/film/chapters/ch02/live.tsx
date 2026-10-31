import React from 'react';
import {Freeze, staticFile, useVideoConfig} from 'remotion';
import {color, font, layout} from '../../../engine/tokens';
import {KineticLine, Legend} from '../../../engine/type';
import {projectToScreen, pushIn, rigPoseAt, type CameraKey} from '../../../engine/camera';
import {flatField, rectField, type Beat, type FieldFn, type LightKey} from '../../../engine/pins';
import {Laptop, laptopScreenPose} from '../../../engine/devices';
import * as THREE from 'three';
import type {PixieCue} from '../../../pixie';
import {HANDOFF} from '../../handoff';
import type {TimedNode} from '../../types';
import capture from '../../../data/ch02/npm-test-capture.json';
import {bodyStyle, capsStyle, Chip, chipSlot, clamp01, easeOut, env, fmtInt, legible, MissGlyph, monoStyle, MONO_MIN, pull, ramp, TypedChip} from '../ch01/kit';
import {pose, wxy, type Part, type Stage} from '../ch01/stage';
import {GB, hypothesisField, TILES} from './board';
import {BOARD} from './opening';

// 02.7 the glass box page on a laptop, its vote ledger, and its tests run from a fresh clone;
// 02.8 measured, not claimed: the 91 hypotheses in their verdicts, the receipts, the forged draw.

const CAP = capture as {commit: string; date: string; node: string; command: string; note: string; steps: Array<{cmd: string; exit: number; out: string[]}>; summary: {tests: number; pass: number; fail: number; skipped: number}};
const VOTES = [
  {label: 'BIAS', v: -9.38},
  {label: 'IF x₋₁ = universally', v: 6.64},
  {label: 'IF x₋₂ = truth ∧ x₋₁ = universally', v: 1.11},
  {label: 'IF x₋₃ = a ∧ …', v: 0.22},
  {label: 'IF x₋₄ = is ∧ …', v: 0.07},
];

export const buildLive = (st: Stage): Part => {
  const {ctx, board, relief, f, W, H} = st;
  const tl = ctx.tl;
  const ch = tl.chapter('02');
  const s7 = tl.scene('02.7');
  const s8 = tl.scene('02.8');
  const u15 = tl.utt('u0215');
  const u16 = tl.utt('u0216');
  const u17 = tl.utt('u0217');
  const u18 = tl.utt('u0218');
  const u19 = tl.utt('u0219');
  const u20 = tl.utt('u0220');
  const u21 = tl.utt('u0221');
  const w = (u: string, word: string) => tl.word(u, word).start;
  const wType = tl.word('u0216', 'Type');
  const wLedger = tl.word('u0216', 'ledger');
  const wPassage = tl.word('u0216', 'passage');
  const wNo = tl.word('u0221', 'no');
  const steel = flatField();

  // ---------------------------------------------------------------- the wall
  // ten book spines rise behind the screen (equal heights: the page does not list per-book counts)
  const spineU = (k: number) => 0.2 + k * 0.026;
  const spines = (ground: FieldFn): FieldFn => {
    let fld = ground;
    for (let k = 0; k < 10; k++) fld = rectField(board, {u: spineU(k), v: 0.47, w: 3.4, h: 30 + (k % 3) * 2, radius: 0.6}, {h: 0.3, tint: 0.95, soft: 0.5, ground: fld});
    return fld;
  };
  // the votes of 'acknowledged' as columns, then one probability bar
  const voteU = (k: number) => 0.2 + k * 0.05;
  const votesField = (collapsed: boolean): FieldFn => {
    let fld: FieldFn = steel;
    if (!collapsed) {
      VOTES.forEach((vt, k) => {
        const hp = 2 + 3.2 * Math.abs(vt.v);
        fld = rectField(board, {u: voteU(k), v: 0.36 + (hp * board.p) / 2 / board.extH, w: 6, h: hp, radius: 0.8}, {h: 0.28, tint: vt.v < 0 ? 0.45 : 1.0, glow: vt.v > 0 ? 0.25 : 0, soft: 0.5, ground: fld});
      });
      return fld;
    }
    const hp = 40 * 0.25;
    return rectField(board, {u: 0.3, v: 0.36 + (hp * board.p) / 2 / board.extH, w: 30, h: hp, radius: 0.8}, {h: 0.34, tint: 1.0, glow: 0.6, soft: 0.5, ground: steel});
  };
  const verdictTiles = hypothesisField(board, BOARD, 'verdict', steel);
  const beats: Beat[] = [
    {id: 'c02-books', at: s7.start + 0.3, field: spines(steel), sweep: {kind: 'linear', origin: [0.18, 0.3], direction: [1, 0], speed: 0.45, jitterS: 0.04}},
    {id: 'c02-votes', at: wLedger.start - 0.2, field: votesField(false), sweep: {kind: 'linear', origin: [0.18, 0.3], direction: [1, 0], speed: 0.5, jitterS: 0.04}},
    {id: 'c02-prob', at: wPassage.start - 0.6, field: votesField(true), sweep: {origin: [0.3, 0.38], speed: 0.6, jitterS: 0.03}},
    {id: 'c02-check-wall', at: u17.start - 0.4, field: steel, sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.6, jitterS: 0.03}},
    // the laptop swings out; the 91 rise again in their verdict colours, tint first, then height
    {id: 'c02-verdicts', at: s8.start - 0.4, field: verdictTiles, sweep: {kind: 'linear', origin: [0.42, 0.75], direction: [1, -0.4], speed: 0.5, jitterS: 0.05, tintFollowsWave: true, tintLeadS: 0.3}},
    {id: 'c02-handoff', at: ch.end - 2.3, field: HANDOFF, sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.55, jitterS: 0.04, tintFollowsWave: true}},
  ];

  // ---------------------------------------------------------------- the laptop and its recording
  const rec = {src: staticFile('recordings/ch02-glassbox.mp4'), size: [2000, 1250] as [number, number], frames: 780};
  // film time -> recording time: the hero while the page is introduced, the typing on "Type", the
  // ledger on "ledger", the passage on "passage"; still frames in between
  const recWindows: Array<[number, number, number]> = [
    [s7.start + 0.4, 0.0, 1.5],
    [u15.end - 0.6, 1.5, 1.4],
    [wType.start - 0.15, 2.95, 2.4],
    [wLedger.start - 0.6, 5.35, 1.3],
    [wPassage.start - 1.7, 6.65, 3.0],
  ];
  const recAt = (t: number) => {
    let r = 0;
    for (const [f0, r0, d] of recWindows) if (t >= f0) r = r0 + Math.min(d, t - f0);
    return Math.max(0, Math.min(rec.frames - 1, Math.round(r * 60)));
  };
  const lapIn = s7.start + 0.05;
  const lapOut = s8.start - 0.9;
  const rot = (t: number) => {
    const a = easeOut(ramp(t, lapIn, 1.1));
    const b = clamp01((t - lapOut) / 0.75);
    const bb = b * b * (3 - 2 * b);
    return (1 - a) * (Math.PI / 2) - 0.13 * a + bb * (-Math.PI / 2 + 0.13);
  };
  const [cx, cy] = wxy(board, 0.5, 0.5);
  const LAP: [number, number, number] = [cx + 0.11, cy - 0.105, 0.2];
  const LAP_SCALE = 0.112;
  const LID = 108;
  const screenLook = {tone: 'aces' as const, exposure: 0.92, glare: 0, reflections: 0};
  // world position of a point of the recording (x from the left, y from the top) on the settled laptop
  const lapPose = laptopScreenPose(LID);
  const lapMat = new THREE.Matrix4().compose(new THREE.Vector3(...LAP), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.13, 0)), new THREE.Vector3(LAP_SCALE, LAP_SCALE, LAP_SCALE));
  const onScreen = (x: number, yTop: number): [number, number, number] => {
    const p = lapPose.point(x, 1 - yTop).applyMatrix4(lapMat);
    return [p.x, p.y, p.z];
  };
  const world: TimedNode[] = [
    {
      id: 'c02-laptop',
      from: lapIn,
      to: s8.start,
      premountS: 1.5,
      render: (t) => (
        <group position={LAP} rotation={[0, rot(t), 0]} scale={LAP_SCALE}>
          <Freeze frame={recAt(t)} active>
            <Laptop lidAngle={LID} screen={{src: rec.src, size: rec.size, durationInFrames: rec.frames, fit: 'cover'}} look={screenLook} spill={0.5} castShadow={false} />
          </Freeze>
        </group>
      ),
    },
  ];

  // ---------------------------------------------------------------- camera and light
  const P7 = pose(st, {uv: [0.5, 0.5], pinsAcross: 150, screen: [0.5, 0.5], yaw: 0.06, pitch: 0.05});
  // the camera pushes into one row of the ledger at a time, close to the glass (text never below
  // 2.2 % H): the BIAS row, the clause on 'universally', the clause on 'truth universally'
  const row = (yTop: number) => ({target: onScreen(0.735, yTop), distance: 0.3, yaw: -0.02, pitch: 0.02, roll: 0, fov: 18});
  const rowsAt = [0.41, 0.5, 0.585];
  const P8 = pose(st, {uv: [0.63, 0.47], pinsAcross: 150, screen: [0.62, 0.5], yaw: 0.12, pitch: 0.06});
  const camera: CameraKey[] = [
    {at: s7.start - 0.4, dur: 1.4, pose: P7},
    {at: wLedger.start - 0.3, dur: 1.2, pose: row(rowsAt[0])},
    {at: wLedger.start + 1.1, dur: 0.8, pose: row(rowsAt[1])},
    {at: wLedger.start + 2.2, dur: 0.8, pose: row(rowsAt[2])},
    {at: wPassage.start - 0.3, dur: 1.4, pose: P7},
    {at: u17.start + 1.2, dur: Math.max(1, s8.start - u17.start - 2.4), pose: pushIn(P7, 0.04), ease: 'inOutSine'},
    {at: s8.start - 0.7, dur: 1.5, pose: P8},
    {at: s8.start + 1.0, dur: Math.max(1, ch.end - s8.start - 4.4), pose: pushIn(P8, 0.05), ease: 'inOutSine'},
    // the chapter change: a lateral dolly right, then the bare wall's pose
    {at: ch.end - 3.3, dur: 1.4, pose: {...pushIn(P8, 0.05), target: [P8.target[0] + 0.05, P8.target[1], P8.target[2]]}},
    {at: ch.end - 1.9, dur: 1.8, pose: st.P0},
  ];
  const [bx, by] = wxy(board, BOARD.u, BOARD.v);
  const light: LightKey[] = [
    {at: s7.start - 0.3, dur: 1.4, key: 0.96, spread: 1.35, poolAt: [cx + 0.05, cy + 0.02], look: [0, 0]},
    {at: s8.start - 0.5, dur: 1.4, key: 1.0, spread: 1.2, poolAt: [bx, by + 0.02], look: [0.1, -0.05]},
    // the light drops toward teal-black under the dolly, and returns to the default for the next chapter
    {at: ch.end - 3.3, dur: 1.3, key: 0.6, spread: 0.9},
    {at: ch.end - 1.6, dur: 1.5, key: 1, pool: 1, spread: 1, poolAt: [0, 0], look: [0, 0], env: 1},
  ];

  // ---------------------------------------------------------------- overlays
  const at = (t: number, u: number, v: number, z = 0) => {
    const p = rigPoseAt(camera, t);
    const [x, y] = wxy(board, u, v);
    const s = projectToScreen(p, [x, y, z], W, H);
    return {x: s[0], y: s[1]};
  };
  const chip = (k: number) => chipSlot(W, H, k);
  const top = (k: number) => ({x: Math.round(W * 0.962), y: Math.round(H * (0.09 + 0.052 * k))});
  const termIn = u17.start - 0.3;
  const termOut = u18.start + 0.6;
  const F = GB.families.totals;
  const R = GB.receipts;
  const overlays: TimedNode[] = [
    {
      id: 'c02-books-label',
      from: s7.start,
      to: wLedger.start,
      render: (t) => {
        const k = env(t, s7.start + 0.6, wLedger.start - 0.3, 0.4, 0.35);
        if (k <= 0.001) return null;
        const q = at(t, spineU(0), 0.47 + (19 * board.p) / board.extH);
        return (
          <div style={{position: 'absolute', left: Math.round(q.x), top: Math.round(q.y - H * 0.1), ...pull(k, H)}}>
            <div style={{...bodyStyle(H, 0.03, 600), textShadow: legible(H)}}>10 books · 678,041 tokens</div>
            <div style={{...monoStyle(H, MONO_MIN, color.text.chipDim), marginTop: Math.round(H * 0.006), textShadow: legible(H)}}>counted in the tab · Reading ten books…</div>
          </div>
        );
      },
    },
    {
      id: 'c02-vote-labels',
      from: wLedger.start - 0.3,
      to: u17.start,
      render: (t) => {
        const k = env(t, wLedger.start, u17.start - 0.4, 0.4, 0.35);
        if (k <= 0.001) return null;
        const collapsed = t > wPassage.start - 0.3;
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            {!collapsed
              ? VOTES.map((vt, j) => {
                  const q = at(t, voteU(j), 0.33);
                  return (
                    <div key={j} style={{position: 'absolute', left: Math.round(q.x - H * 0.05), width: Math.round(H * 0.1), top: Math.round(q.y), textAlign: 'center', ...monoStyle(H, MONO_MIN, vt.v < 0 ? color.text.chipDim : color.text.display), textShadow: legible(H)}}>
                      {vt.v > 0 ? `+${vt.v.toFixed(2)}` : vt.v.toFixed(2)}
                    </div>
                  );
                })
              : null}
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.2), opacity: collapsed ? 1 : 0}}>
              <div style={{...capsStyle(H, MONO_MIN, 0.16), color: color.accent.mintLabel, textShadow: legible(H)}}>why acknowledged · one vote per fired clause</div>
              {collapsed ? (
                <div style={{...bodyStyle(H, 0.04, 650), marginTop: Math.round(H * 0.01), textShadow: legible(H)}}>
                  sum −1.3354 → <span style={{color: color.accent.mint}}>26.3%</span>
                  <span style={{...bodyStyle(H, 0.028, 500, color.text.secondary)}}> · P(acknowledged) 25.0% with the text's own memory</span>
                </div>
              ) : null}
            </div>
            {collapsed ? <PassageCard t={t} at={wPassage.start} exitAt={u17.start - 0.4} /> : null}
          </div>
        );
      },
    },
    {
      id: 'c02-live-chips',
      from: s7.start + 0.5,
      to: s8.start,
      render: (t) => (
        <>
          <Chip t={t} at={s7.start + 1.2} exitAt={wLedger.start} {...top(0)} repo="glassbox-lm" path="live/index.html" line={175} />
          <Chip t={t} at={wLedger.start + 0.3} exitAt={u17.start} {...top(0)} repo="glassbox-lm" path="live/model.js" line="222-250" />
          <Chip t={t} at={wLedger.start + 0.8} exitAt={u17.start} {...top(1)} repo="glassbox-lm" path="live/app.js" line="634-639" />
          <Chip t={t} at={u18.start + 0.3} exitAt={s8.start - 0.4} {...top(0)} repo="glassbox-lm" path="live/README.md" line={44} />
          <FloorPill t={t} at={w('u0218', 'floor') - 0.3} exitAt={s8.start - 0.5} />
        </>
      ),
    },
    {
      id: 'c02-terminal',
      from: termIn - 0.2,
      to: termOut + 0.6,
      render: (t) => <Terminal t={t} at={termIn} exitAt={termOut} />,
    },
    {
      id: 'c02-terminal-chips',
      from: termIn,
      to: termOut + 0.4,
      render: (t) => (
        <>
          <Chip t={t} at={termIn + 2.6} exitAt={termOut} {...top(0)} repo="glassbox-lm" path="live/tests/model.test.mjs" line="77-82" />
          <TypedChip t={t} at={termIn + 3.2} exitAt={termOut} {...top(1)} kind="capture" text={`npm test · fresh clone @ ${CAP.commit.slice(0, 7)} · ${CAP.date}`} />
        </>
      ),
    },
    {
      id: 'c02-numbers',
      from: s8.start - 0.3,
      to: ch.end - 1.4,
      render: (t) => {
        const k = env(t, s8.start + 0.2, ch.end - 2.4, 0.45, 0.4);
        if (k <= 0.001) return null;
        return (
          <div style={{position: 'absolute', inset: 0, ...pull(k, H)}}>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.085), ...capsStyle(H, 0.024, 0.2), color: color.accent.mint, textShadow: legible(H)}}>Measured, not claimed</div>
            <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.13), ...monoStyle(H, MONO_MIN, color.text.chipDim), textShadow: legible(H)}}>as of 381180c · 29 Oct 2026 · six set in the finish pass of 25 Oct</div>
            <Legend
              t={t}
              at={s8.start + 0.6}
              x={Math.round(W * layout.marginLeftW)}
              y={Math.round(H * 0.2)}
              direction="column"
              sizeH={0.03}
              items={[
                {label: `met (${F.metQualified} with a qualifier)`, count: F.met, color: color.accent.mint},
                {label: 'not met', count: F.notMet, color: color.text.display},
                {label: 'not judged', count: F.notJudged, color: color.text.secondary},
                {label: 'not run', count: F.notRun, color: color.text.tertiary, outline: true},
              ]}
            />
            <div style={{position: 'absolute', left: Math.round(W * 0.36), top: Math.round(H * 0.185), ...monoStyle(H, MONO_MIN, color.text.chipDim), lineHeight: 1.5, textShadow: legible(H)}}>
              <div>24 registered 22 Sep · 67 added 24–25 Sep, after the anchor run</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'c02-receipts',
      from: u19.start - 0.2,
      to: ch.end - 1.4,
      render: (t) => <Receipts t={t} at={u19.start} forgedAt={w('u0220', 'forged') - 0.3} exitAt={u21.start + 1.4} />,
    },
    {
      id: 'c02-headline',
      from: u21.end - 0.8,
      to: ch.end - 1.6,
      render: (t) => (
        <KineticLine text="Every next word, *a sum of votes you can read.*" at={u21.end - 0.6} perWordS={0.1} t={t} kind="statement" sizeH={0.058} variant="rise" x={Math.round(W * layout.marginLeftW)} y={Math.round(H * 0.43)} yAnchor="capTop" maxWidth={0.34 * W} exitAt={ch.end - 2.3} />
      ),
    },
    {
      id: 'c02-numbers-chips',
      from: s8.start,
      to: ch.end - 1.6,
      render: (t) => (
        <>
          <Chip t={t} at={s8.start + 1.0} exitAt={u19.start} {...chip(0)} repo="glassbox-lm" path="README.md" line={18} />
          <Chip t={t} at={s8.start + 1.5} exitAt={u19.start} {...chip(1)} repo="glassbox-lm" path="docs/results-overview.md" line={11} />
          <Chip t={t} at={u19.start + 0.6} exitAt={u21.start} {...chip(0)} repo="glassbox-lm" path="studies/tm_language_model/docs/results.md" line={72} />
          <Chip t={t} at={w('u0220', 'forged')} exitAt={u21.start + 1.2} {...chip(1)} repo="glassbox-lm" path="docs/known-limitations.md" line={133} />
          <Chip t={t} at={wNo.start + 0.2} exitAt={ch.end - 2.3} {...chip(0)} repo="glassbox-lm" path="docs/results-overview.md" line="15-30" />
        </>
      ),
    },
  ];
  void TILES;
  void fmtInt;
  void R;

  const pixie: PixieCue[] = [
    {frame: f(s7.start + 0.4), activity: 'waiting', detail: 'Reading ten books…'},
    {frame: f(wType.start), activity: 'typing', detail: 'It is a truth universally'},
    {frame: f(wPassage.start - 0.2), activity: 'searching', detail: 'Search 208 chapters for the pattern'},
    {frame: f(termIn + 0.3), activity: 'debugging', detail: 'Run npm test (live/)'},
    {frame: f(termIn + 2.8), activity: 'success', detail: `${CAP.summary.pass} pass · ${CAP.summary.skipped} skipped · ${CAP.summary.fail} fail`},
    {frame: f(s8.start + 0.2), activity: 'reading', detail: 'Read live/study.json (91 ids)'},
    {frame: f(u21.end), activity: 'idle', detail: ''},
  ];

  return {beats, world, camera, light, overlays, pixie};
};

/** The passage a vote was counted from (as the page shows it), matched words lifted. */
const PassageCard: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.4, 0.35);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.44), width: Math.round(W * 0.3), padding: Math.round(H * 0.02), borderRadius: Math.round(H * 0.014), background: 'rgba(243,238,226,0.95)', opacity: k}}>
      <div style={{...capsStyle(H, MONO_MIN, 0.14), color: '#5E625F'}}>Pride and Prejudice · chapter I</div>
      <div style={{fontFamily: font.serif, fontSize: Math.round(H * 0.032), color: '#1B1E1D', marginTop: Math.round(H * 0.01), lineHeight: 1.3}}>
        It is a truth <span style={{background: 'rgba(11,135,123,0.25)', color: '#0B5F57'}}>universally acknowledged</span>, that a single man in possession of a …
      </div>
    </div>
  );
};

const FloorPill: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.35, 0.3);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.56), display: 'flex', alignItems: 'flex-start', gap: Math.round(H * 0.012), ...pull(k, H)}}>
      <span style={{marginTop: Math.round(H * 0.006)}}>
        <MissGlyph size={Math.round(H * 0.026)} />
      </span>
      <span>
        <div style={{...bodyStyle(H, 0.032, 600), textShadow: legible(H)}}>no Tsetlin Machine runs</div>
        <div style={{...bodyStyle(H, 0.032, 600), textShadow: legible(H)}}>on this page</div>
        <div style={{...bodyStyle(H, 0.028, 500, color.text.secondary), textShadow: legible(H)}}>the count floor</div>
      </span>
    </div>
  );
};

/** The real terminal capture: the command, npm's own output, scrolled to the summary. */
const Terminal: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.5, 0.4);
  if (k <= 0.001) return null;
  const lines: Array<{s: string; c: string}> = [];
  lines.push({s: `$ ${CAP.command}`, c: color.text.key});
  for (const st of CAP.steps) for (const l of st.out) lines.push({s: l, c: /^ok |# pass|# tests/.test(l) ? color.accent.mint : /SKIP/.test(l) ? color.text.secondary : /^# (fail|cancelled|skipped|todo)/.test(l) ? color.text.display : /^npm warn/.test(l) ? color.text.tertiary : color.text.chipDim});
  const fs = Math.round(MONO_MIN * H);
  const lh = Math.round(fs * 1.38);
  const rows = 12;
  // the output prints over two seconds, then the summary stays in view
  const printed = Math.min(lines.length, Math.floor(ramp(t, at + 0.5, 2.0) * lines.length));
  const first = Math.max(0, printed - rows);
  const shown = lines.slice(first, printed);
  const hair = Math.max(1, Math.round(H / 1080));
  const w = Math.round(W * 0.56);
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.115), width: w, borderRadius: Math.round(H * 0.014), overflow: 'hidden', background: 'rgba(6,10,9,0.97)', border: `${hair}px solid rgba(228,234,231,0.18)`, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', ...pull(k, H)}}>
      <div style={{display: 'flex', alignItems: 'center', gap: Math.round(H * 0.01), padding: `${Math.round(H * 0.01)}px ${Math.round(H * 0.016)}px`, background: '#0C1613', borderBottom: `${hair}px solid rgba(228,234,231,0.1)`}}>
        <span style={{width: Math.round(H * 0.01), height: Math.round(H * 0.01), borderRadius: '50%', background: color.accent.mint}} />
        <span style={{...monoStyle(H, MONO_MIN, color.accent.mintLabel)}}>{`glassbox-lm @ ${CAP.commit.slice(0, 7)} · fresh clone · ${CAP.date} · node ${CAP.node}`}</span>
      </div>
      <div style={{padding: `${Math.round(H * 0.012)}px ${Math.round(H * 0.018)}px`, height: rows * lh}}>
        {shown.map((l, j) => (
          <div key={first + j} style={{...monoStyle(H, MONO_MIN, l.c), lineHeight: `${lh}px`, overflow: 'hidden', textOverflow: 'clip'}}>
            {l.s.length > 92 ? `${l.s.slice(0, 91)}…` : l.s || ' '}
          </div>
        ))}
      </div>
      <div style={{padding: `${Math.round(H * 0.008)}px ${Math.round(H * 0.018)}px ${Math.round(H * 0.012)}px`, borderTop: `${hair}px solid rgba(228,234,231,0.1)`, opacity: easeOut(ramp(t, at + 2.6, 0.4))}}>
        <span style={{...monoStyle(H, MONO_MIN, color.text.tertiary), whiteSpace: 'normal'}}>output as printed · the page test skips: jsdom 30.1.3 needs Node ≥ 22.22, this machine runs 22.14</span>
      </div>
    </div>
  );
};

/** The receipts row: what passes, what fails, and the forged draw the repository records. */
const Receipts: React.FC<{t: number; at: number; forgedAt: number; exitAt: number}> = ({t, at, forgedAt, exitAt}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = env(t, at, exitAt, 0.45, 0.35);
  if (k <= 0.001) return null;
  const R = GB.receipts;
  const fk = easeOut(ramp(t, forgedAt, 0.5));
  return (
    <div style={{position: 'absolute', left: Math.round(W * layout.marginLeftW), top: Math.round(H * 0.43), width: Math.round(W * 0.3), ...pull(k, H)}}>
      <div style={{...capsStyle(H, MONO_MIN, 0.14), color: color.text.tertiary, textShadow: legible(H)}}>receipts · tiny-LM scale</div>
      <div style={{...bodyStyle(H, 0.03, 600), marginTop: Math.round(H * 0.008), textShadow: legible(H)}}>
        {fmtInt(R.pass)} of {fmtInt(R.pass)} pass <span style={{fontWeight: 500, color: color.text.secondary}}>· {fmtInt(R.tampered)} tampered fail across {R.modes} tamper modes</span>
      </div>
      {fk > 0.001 ? (
        <div style={{opacity: fk, marginTop: Math.round(H * 0.014)}}>
          <div style={{...bodyStyle(H, 0.028, 500), whiteSpace: 'normal', textShadow: legible(H)}}>1 forged random draw accepted · internal audit {R.audit}, judged by an AI model</div>
        </div>
      ) : null}
    </div>
  );
};
