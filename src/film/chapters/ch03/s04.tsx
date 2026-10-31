import React from 'react';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, pinAt, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import {snippets} from '../../../data/code';
import traceData from '../../../data/ch03/trace.json';
import {boxesField, ground, padsField, pinsField, type Box} from './kit/fields';
import {DeviceProp, pointOnScreen, remapper} from './kit/device';
import {frameWidthAt} from './kit/camera';
import {Chip, Headline, Pill, dim, env, mint, pullStyle, useFrameSize, white, wordsOf} from './kit/ui';
import {CLIPS, LEDGER_REC, LIT, RED_DROP, TEAL} from './common';
import {timelinePads} from './s01';
import type {SceneKit} from './scene';

// 03.4 the third outside email is stopped: the film's one red ground drop.
// 03.5 the ledger: hashed, chained, signed; one flipped bit fails verification at that entry.

export const buildBlockedAndLedger = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S4 = c.sc('03.4');
  const S5 = c.sc('03.5');
  const S6 = c.sc('03.6');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;
  const teal = ground(TEAL);
  const red = ground(RED_DROP);

  // ---------------------------------------------------------------- 03.4: the block, and the drop
  const third = c.w('u0310', 'third');
  const stopped = c.w('u0310', 'stopped');
  const allowed6 = ['allowed', 'allowed', 'allowed', 'allowed', 'allowed', 'allowed'] as const;
  acc.beat({id: 'resume', at: S4.start - 0.6, field: padsField(board, timelinePads([...allowed6, 'pending']), teal), sweep: {origin: [0.3, 0.6], speed: 0.9, jitterS: 0.05}});
  acc.beat({id: 'step-6', at: third + 0.1, field: padsField(board, [...timelinePads([...allowed6, 'off']), {u: 0.445, v: 0.635, r: 2.5, look: {h: 0.3, tint: [1.05, 0.98, 0.7], glow: 0.2}}], teal)});
  // count_le fires: the seventh pad turns red, and the ground drops from teal to red-brown
  acc.beat({
    id: 'red-drop',
    at: stopped,
    field: padsField(board, timelinePads([...allowed6, 'blocked']), red),
    sweep: {origin: [0.445, 0.635], speed: 0.85, jitterS: 0.05, tintFollowsWave: true},
    tintTauS: 0.32,
  });
  acc.light.push({at: stopped, dur: 0.9, key: 0.74, spread: 0.92, look: [-0.08, 0.04]});

  const blockPose = frameOn(board, {uv: [0.5, 0.52], pinsAcross: 136, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: S4.start - 0.8, dur: 1.4, pose: blockPose, ease: 'camera'}, {at: S4.start + 0.8, dur: S4.end - S4.start - 1.0, pose: {...blockPose, distance: blockPose.distance * 0.94}, ease: 'inOutSine'});

  const H1 = Math.round(0.47 * H);
  const H2 = Math.round(0.6 * H);
  acc.captionSkip.push('u0311', 'u0312');
  acc.overlay({
    id: 'wasnt',
    from: c.u('u0311').start - 0.2,
    to: S4.end + 0.3,
    render: (t) => (
      <>
        <Headline t={t} words={wordsOf(c.u('u0311').words).map((w) => ({...w, em: false}))} x={left} y={H1} sizeH={0.088} exitAt={S4.end - 0.5} />
        <Headline t={t} words={wordsOf(c.u('u0312').words)} x={left} y={H2} sizeH={0.088} color={color.signal.verdictRed} emColor={color.signal.verdictRed} exitAt={S4.end - 0.5} />
      </>
    ),
  });
  acc.overlay({
    id: 'blocked-chip',
    from: stopped,
    to: S4.end + 0.2,
    render: (t) => <Chip t={t} at={stopped + 0.35} exitAt={S4.end - 0.5} repo="trace" path="live/tests/monitors.test.mjs" line={46} x={left} y={Math.round(0.69 * H)} />,
  });
  acc.pixie.push(
    {frame: c.f(third), activity: 'debugging', detail: 'Check count_le(export, 2, 50)'},
    {frame: c.f(stopped + 0.15), activity: 'success', detail: 'Blocked at step 5'},
  );

  // ---------------------------------------------------------------- 03.5: the hash chain on the wall
  const n = traceData.ledger.entries.length;
  const chainV = 0.6;
  const blockW = 10;
  const pitch = 13.5;
  const chainU0 = 0.5 - (((n - 1) * pitch) / 2) * board.p;
  const blockU = (i: number) => chainU0 + i * pitch * board.p;
  const chainBuild = S5.start + 0.1;
  const stepS = Math.min(0.42, (c.w('u0313', 'chained') - chainBuild) / n);
  const builtAt = (i: number) => chainBuild + i * stepS;
  const BLOCK: Look = {h: 0.3, tint: [0.8, 1.0, 0.96]};
  const BLOCK_SIGNED: Look = {h: 0.34, tint: LIT, glow: 0.45};
  const LINK: Look = {h: 0.16, tint: [0.85, 1.05, 1.0], glow: 0.55};
  const BAD: Look = {h: 0.38, tint: [1.2, 0.86, 0.36], glow: 0.0};
  const chainBoxes = (built: number, signed: boolean, bad: number | null): Box[] => {
    const out: Box[] = [];
    for (let i = 0; i < n; i++) {
      const lk = i < built ? (bad === i ? BAD : signed ? BLOCK_SIGNED : BLOCK) : {h: 0.04, tint: 0.55};
      out.push({u: blockU(i), v: chainV, w: blockW, h: 7, radius: 1.2, look: lk});
      if (i > 0 && i < built) out.push({u: blockU(i) - (pitch / 2) * board.p, v: chainV, w: pitch - blockW + 1, h: 1.6, look: bad !== null && i > bad ? {h: 0.1, tint: 0.5} : LINK});
    }
    return out;
  };
  // the Merkle pyramid seal() builds over the entry hashes (7 leaves: 4, 2, 1, the last leaf repeated)
  const merkle = (on: boolean, bad: number | null): Box[] => {
    if (!on) return [];
    const levels = [4, 2, 1];
    const out: Box[] = [];
    let span = pitch * 2;
    let v = chainV + (8.5 * board.p) / board.extH;
    levels.forEach((m) => {
      for (let j = 0; j < m; j++) {
        const u = chainU0 + (j * span + span / 2 - pitch / 2) * board.p;
        const covers = [j * (span / pitch), (j + 1) * (span / pitch) - 1];
        const broken = bad !== null && bad >= covers[0] && bad <= covers[1];
        out.push({u, v, w: Math.min(span - 4, 15), h: 3.4, radius: 1, look: broken ? {h: 0.2, tint: [1.15, 0.85, 0.4]} : {h: 0.2, tint: [0.82, 1.04, 0.98], glow: 0.3}});
      }
      span *= 2;
      v += (6.5 * board.p) / board.extH;
    });
    return out;
  };
  // the export bit of the entry that broke count_le: one pin inside block 6
  const bitPin = pinAt(board, blockU(6) + 2.5 * board.p, chainV);
  const chainField = (built: number, signed: boolean, sealed: boolean, bad: number | null, bitFlipped = false) => {
    const base = boxesField(board, [...chainBoxes(built, signed, bad), ...merkle(sealed, bad)], teal);
    if (built < n) return base;
    return pinsField(new Map<number, Look>([[bitPin, bitFlipped ? {h: 0.0, tint: 0.2} : {h: 0.5, tint: [1.0, 1.0, 0.92], glow: 0.7}]]), base);
  };

  // the red drains back to teal, left to right, as the timeline re-targets into the chain
  acc.beat({id: 'drain', at: S5.start - 0.5, field: chainField(0, false, false, null), sweep: {kind: 'linear', origin: [0, 0.5], direction: [1, 0], speed: 0.75, jitterS: 0.04, tintFollowsWave: true}});
  acc.light.push({at: S5.start - 0.5, dur: 1.4, key: 1.02, spread: 1.25, look: [0, 0], poolAt: [0, 0.03]});
  for (let i = 1; i <= n; i++) acc.beat({id: `chain-${i}`, at: builtAt(i - 1) + 0.25, field: chainField(i, false, false, null)});
  const signedAt = c.w('u0313', 'signed');
  acc.beat({id: 'signed', at: signedAt, field: chainField(n, true, false, null)});
  const sealAt = c.u('u0313').end + 0.25;
  acc.beat({id: 'sealed', at: sealAt, field: chainField(n, true, true, null), sweep: {origin: [0.5, chainV + 0.06], speed: 0.6, jitterS: 0.04}});
  const flipAt = c.w('u0314', 'Flip');
  const failAt = c.w('u0314', 'fails');
  const restoreAt = c.w('u0316', 'tampering');
  const okAt = c.u('u0316').end + 0.35;
  acc.beat({id: 'flip', at: flipAt + 0.15, field: chainField(n, true, true, null, true)});
  acc.beat({id: 'caught', at: failAt + 0.1, field: chainField(n, true, true, 6, true), sweep: {origin: [blockU(6), chainV], speed: 0.8, jitterS: 0.03, tintFollowsWave: true}});
  acc.beat({id: 'restored', at: restoreAt + 0.1, field: chainField(n, true, true, 6, false)});
  acc.beat({id: 'verified', at: okAt, field: chainField(n, true, true, null, false), sweep: {origin: [0.5, chainV], speed: 0.9, jitterS: 0.04, tintFollowsWave: true}});

  // camera: the whole chain stays framed; the laptop takes the left, the verifier's code the right
  const chainPose = frameOn(board, {uv: [0.5, 0.6], pinsAcross: 134, yaw: 0.08, pitch: 0.05, aspect});
  acc.camera.push(
    {at: S5.start - 0.5, dur: 1.5, pose: chainPose, ease: 'camera'},
    {at: S5.start + 1.1, dur: S5.end - S5.start - 1.4, pose: {...chainPose, distance: chainPose.distance * 0.955}, ease: 'inOutSine'},
  );

  // hash labels under the blocks (the first 8 hex digits of each entry's SHA-256)
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  const labelPoint = (i: number): [number, number, number] => [blockU(i) - 0.5, (chainV - (6.2 * board.p) / board.extH) * board.extH - board.extH / 2, 0.1 * relief];
  acc.overlay({
    id: 'hashes',
    from: S5.start,
    to: S6.start + 0.3,
    render: (t) => <HashLabels t={t} builtAt={builtAt} failAt={failAt} okAt={okAt} exitAt={(i) => (i <= 3 ? c.u('u0314').start - 0.9 : c.u('u0315').start - 0.45)} at={(i) => projectToScreen(pose(t), labelPoint(i), W, H)} />,
  });
  acc.overlay({
    id: 'chain-type',
    from: S5.start,
    to: S6.start + 0.3,
    render: (t) => (
      <>
        <Pill k={env(t, c.w('u0313', 'hashed'), 0.4, c.u('u0314').start - 0.4)} x={Math.round(0.5 * W)} y={Math.round(0.16 * H)} align="center" sizeH={0.026}>
          hash(entry) = SHA-256(index, kind, payload, prev_hash) {dim('·')} {mint('HMAC-signed')}
        </Pill>
        <Chip t={t} at={c.w('u0313', 'hashed') + 0.5} exitAt={c.u('u0314').start - 0.4} repo="trace" path="tracekit/ledger.py" line="47-83" x={Math.round(0.5 * W) - Math.round(0.16 * W)} y={Math.round(0.215 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- the laptop: tamper, verify, restore
  const shotPose = chainPose;
  const screenAt = pointOnScreen(shotPose, 0.285, 0.36, 0.16, aspect);
  const screenWidth = 0.34 * frameWidthAt(shotPose, screenAt, aspect);
  const recAt = remapper(
    [
      {film: sealAt, rec: LEDGER_REC.seal},
      {film: c.u('u0314').start - 0.2, rec: LEDGER_REC.tamper},
      {film: flipAt, rec: LEDGER_REC.flip},
      {film: failAt, rec: LEDGER_REC.verifyBad},
      {film: restoreAt, rec: LEDGER_REC.restore},
      {film: okAt, rec: LEDGER_REC.verifyOk},
    ],
    CLIPS.ledger,
  );
  const lapIn = c.u('u0314').start - 0.7;
  const lapOut = S6.start - 0.4;
  acc.prop({
    id: 'laptop-ledger',
    from: lapIn,
    to: lapOut + 0.9,
    premountS: 1.0,
    render: (t) => <DeviceProp t={t} kind="laptop" clip={CLIPS.ledger} recFrame={recAt(t)} at={screenAt} rest={[0.05, 0.22]} screenWidth={screenWidth} motion={{enterAt: lapIn, exitAt: lapOut, enter: 'swing', exit: 'swing', side: 'left'}} />,
  });

  // ---------------------------------------------------------------- the verifier, in the code
  const codeAt = c.u('u0315').start - 0.2;
  const codeOut = S6.start - 0.4;
  const keyLine = c.w('u0316', 'key');
  const pages: CodePage[] = [
    {
      at: codeAt,
      source: {snippet: snippets['trace-ledger'], lines: [221, 232]},
      dedent: 4,
      zoom: 0.8,
      width: Math.round(0.415 * W),
      header: {label: 'trace', path: 'tracekit/ledger.py', meta: 'verify_ledger · 208-236'},
      cues: [
        cue.reveal(codeAt + 0.1, {stagger: 0.035}),
        cue.highlight(c.w('u0315', 'replays'), 225, {until: c.w('u0315', 'alone')}),
        cue.highlight(c.w('u0315', 'alone'), [226, 230], {until: keyLine - 0.1}),
        cue.highlight(keyLine, 231, {until: codeOut}),
      ],
    },
  ];
  acc.overlay({
    id: 'verifier',
    from: codeAt - 0.2,
    to: codeOut + 0.6,
    render: (t) => (
      <>
        <CodePanel pages={pages} x={Math.round(0.515 * W)} y={Math.round(0.085 * H)} anchor="top-left" t={t} enter={{at: codeAt, dur: 0.5}} exit={{at: codeOut, dur: 0.4}} />
        <Chip t={t} at={codeAt + 0.5} exitAt={codeOut} repo="trace" path="tests/test_ledger_engine.py" line="6-38" x={Math.round(0.93 * W)} y={Math.round(0.565 * H)} align="right" />
        <Pill k={env(t, keyLine + 0.2, 0.4, codeOut)} x={Math.round(0.93 * W)} y={Math.round(0.62 * H)} align="right" sizeH={0.022}>
          signatures need the shared key: {white('tamper evidence')}, not non-repudiation
        </Pill>
        <Chip t={t} at={keyLine + 0.6} exitAt={codeOut} repo="trace" path="tracekit/ledger.py" line="13-16" x={Math.round(0.93 * W)} y={Math.round(0.675 * H)} align="right" />
        <Chip t={t} at={keyLine + 0.9} exitAt={codeOut} repo="trace" path="experiments/tamper_evidence.py" line="8-16" x={Math.round(0.93 * W)} y={Math.round(0.72 * H)} align="right" />
        <Chip t={t} at={failAt + 0.2} exitAt={codeAt} repo="trace" path="live/app.js" line="237-244" x={Math.round(0.93 * W)} y={Math.round(0.72 * H)} align="right" />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(c.u('u0313').start), activity: 'reading', detail: 'Read tracekit/ledger.py'},
    {frame: c.f(flipAt), activity: 'writing', detail: 'Edit ledger entry: flip one export bit'},
    {frame: c.f(failAt - 0.3), activity: 'debugging', detail: 'Run verify() on the page'},
    {frame: c.f(failAt + 0.4), activity: 'success', detail: 'caught at the edited entry'},
    {frame: c.f(codeAt), activity: 'reading', detail: 'Read tracekit/ledger.py'},
    {frame: c.f(okAt), activity: 'success', detail: 'Verified: the log is exactly what happened'},
  );
  return {okAt};
};

const HashLabels: React.FC<{t: number; builtAt: (i: number) => number; failAt: number; okAt: number; exitAt: (i: number) => number; at: (i: number) => [number, number, number]}> = ({t, builtAt, failAt, okAt, exitAt, at}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const fs = Math.round(0.022 * H);
  return (
    <>
      {traceData.ledger.entries.map((e, i) => {
        const k = env(t, builtAt(i) + 0.2, 0.3, exitAt(i));
        if (k <= 0.001) return null;
        const [x, y] = at(i);
        const bad = i === 6 && t >= failAt && t < okAt;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, 0)', fontFamily: font.mono, fontSize: fs, color: bad ? color.signal.amber : color.text.caption, whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.3, ...pullStyle(k, H)}}>
            <div style={{color: color.accent.mintLabel}}>#{e.index}</div>
            <div>{e.hash8}</div>
          </div>
        );
      })}
    </>
  );
};
