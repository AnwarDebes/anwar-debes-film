import React from 'react';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type FieldFn, type Look} from '../../../engine/pins';
import {font} from '../../../engine/tokens';
import {useFontsReady} from '../../../engine/type';
import D from '../../../data/ch05/candor.json';
import {boxesField, type Box} from '../ch03/kit/fields';
import {DeviceProp, pointOnScreen, remapper} from '../ch03/kit/device';
import {frameWidthAt} from '../ch03/kit/camera';
import {Chip, env, pullStyle, useFrameSize} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {GLASSBOX, GLASSBOX_REC, INK_TEXT, MUTED_TEXT, TEAL, TEAL_TEXT} from './common';
import {paper} from './s01';
import {InkCard} from './ink';

// 05.3 the live glass box: a small model counts hidden patterns; switching off concept C moves the
// twin and not the model (δ jumps), a distractor moves nothing, and a second model's backdoor runs on
// two atoms no named concept explains. Behind the screen the 32 atoms stand as a 4 x 8 pin block.

const fmtD = (d: number) => (d >= 0.01 ? d.toFixed(3) : d.toFixed(4));

type StateRow = [number, number, string, React.ReactNode, string, string?];

/** One card at the top left whose rows swap as the page changes (always one row on show). */
const StateCard: React.FC<{t: number; at: number; exitAt: number; rows: StateRow[]}> = ({t, at, exitAt, rows}) => {
  const {W, H} = useFrameSize();
  const k = env(t, at, 0.4, exitAt);
  if (k <= 0.001) return null;
  return (
    <InkCard k={k} x={Math.round(0.07 * W)} y={Math.round(0.09 * H)} w={Math.round(0.36 * W)}>
      <div style={{position: 'relative', height: Math.round(0.148 * H)}}>
        {rows.map(([a, b, head, line, note, note2], i) => {
          const kk = env(t, a, 0.3, b, 0.25);
          if (kk <= 0.001) return null;
          return (
            <div key={i} style={{position: 'absolute', inset: 0, ...pullStyle(kk, H)}}>
              <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), letterSpacing: '0.14em', textTransform: 'uppercase', color: TEAL_TEXT}}>{head}</div>
              <div style={{fontFamily: font.mono, fontSize: Math.round(0.028 * H), color: INK_TEXT, marginTop: Math.round(0.01 * H), whiteSpace: 'nowrap'}}>{line}</div>
              <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: MUTED_TEXT, marginTop: Math.round(0.008 * H), whiteSpace: 'nowrap'}}>{note}</div>
              {note2 ? <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: MUTED_TEXT, marginTop: Math.round(0.004 * H), whiteSpace: 'nowrap'}}>{note2}</div> : null}
            </div>
          );
        })}
      </div>
    </InkCard>
  );
};

export const buildGlassBox = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S3 = c.sc('05.3');
  const S4 = c.sc('05.4');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- the 4 x 8 atom block on the wall
  const blockU = 0.305;
  const blockV = 0.555;
  const cell = 5.0;
  const atomCentre = (a: number): [number, number] => {
    const col = a % 8;
    const row = Math.floor(a / 8);
    return [blockU + (col - 3.5) * cell * board.p, blockV + ((1.5 - row) * cell * board.p) / board.extH];
  };
  const named = D.box1.names as Record<string, string>;
  const atomsField = (active: readonly number[], pressed: number | null, alien: readonly number[] = []): FieldFn => {
    const boxes: Box[] = [];
    for (let a = 0; a < 32; a++) {
      const [u, v] = atomCentre(a);
      const on = active.includes(a) && a !== pressed;
      const isAlien = alien.includes(a);
      const look: Look = a === pressed ? {h: 0.0, tint: [0.7, 0.74, 0.73], paint: 1} : isAlien ? {h: 0.5, tint: [1.15, 0.42, 0.5], paint: 1} : on ? {h: 0.46, tint: TEAL, paint: 1, glow: 0.12} : {h: 0.1, tint: [0.86, 0.92, 0.9], paint: 1};
      boxes.push({u, v, w: cell - 1.4, h: cell - 1.4, radius: 0.9, look});
    }
    return boxesField(board, boxes, paper());
  };
  const rest = c.u('u0507').start - 0.2;
  const cOff = c.w('u0508', 'off');
  const cBack = c.u('u0509').end + 0.25;
  const fOff = c.w('u0510', 'off');
  const fBack = c.w('u0510', 'explanation') - 0.2;
  const box2 = c.w('u0511', 'second');
  const trig = c.w('u0511', 'trigger');
  acc.beat({id: 'atoms', at: rest, field: atomsField(D.box1.active, null), sweep: {origin: [blockU, blockV], speed: 0.6, jitterS: 0.06}});
  acc.beat({id: 'c-off', at: cOff, field: atomsField(D.box1.active, D.box1.cAtom)});
  acc.beat({id: 'c-back', at: cBack, field: atomsField(D.box1.active, null)});
  acc.beat({id: 'f-off', at: fOff, field: atomsField(D.box1.active, D.box1.fAtom)});
  acc.beat({id: 'f-back', at: fBack, field: atomsField(D.box1.active, null)});
  acc.beat({id: 'box2', at: box2, field: atomsField([], null), sweep: {origin: [blockU, blockV], speed: 0.8, jitterS: 0.04}});
  acc.beat({id: 'trigger', at: trig, field: atomsField(D.box2.active, null, D.box2.alien), sweep: {origin: [blockU, blockV], speed: 0.8, jitterS: 0.04}});
  // the press: the atom is pushed flat as a wall event while Pixie holds its Editing pose
  const [cu, cv] = atomCentre(D.box1.cAtom);
  const [fu, fv] = atomCentre(D.box1.fAtom);
  acc.presses.push({at: cOff, origin: [cu, cv], radius: 0.02, depth: 0.6}, {at: fOff, origin: [fu, fv], radius: 0.02, depth: 0.6});

  // ---------------------------------------------------------------- the laptop with the glass box page
  const lapPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 136, yaw: 0.08, pitch: 0.05, aspect});
  acc.camera.push({at: S3.start - 0.6, dur: 1.5, pose: lapPose, ease: 'camera'}, {at: S3.start + 1.0, dur: S3.end - S3.start - 1.4, pose: {...lapPose, distance: lapPose.distance * 0.95}, ease: 'inOutSine'});
  const screenAt = pointOnScreen(lapPose, 0.665, 0.4, 0.14, aspect);
  const screenWidth = 0.47 * frameWidthAt(lapPose, screenAt, aspect);
  const recAt = remapper(
    [
      {film: rest, rec: GLASSBOX_REC.rest},
      {film: cOff, rec: GLASSBOX_REC.cOff},
      {film: cBack, rec: GLASSBOX_REC.cBack},
      {film: fOff, rec: GLASSBOX_REC.fOff},
      {film: fBack, rec: GLASSBOX_REC.fBack},
      {film: box2 - 0.9, rec: GLASSBOX_REC.toBox2},
      {film: trig, rec: GLASSBOX_REC.trigger},
    ],
    GLASSBOX,
  );
  const lapIn = S3.start - 0.7;
  const lapOut = S4.start - 0.5;
  acc.prop({
    id: 'laptop',
    from: lapIn,
    to: lapOut + 0.9,
    premountS: 1.2,
    render: (t) => <DeviceProp t={t} kind="laptop" clip={GLASSBOX} recFrame={recAt(t)} at={screenAt} rest={[0.05, -0.2]} screenWidth={screenWidth} motion={{enterAt: lapIn, exitAt: lapOut, enter: 'swing', exit: 'sink'}} />,
  });

  // ---------------------------------------------------------------- the values, set natively, as recorded
  const pose = (t: number) => rigPoseAt(acc.camera, t);
  const b1 = D.box1;
  acc.overlay({
    id: 'values',
    from: S3.start,
    to: S4.start + 0.3,
    render: (t) => {
      const exit = S4.start - 0.4;
      return (
        <>
          <AtomLetters t={t} at={rest + 0.3} exitAt={exit} box2At={box2} named={named} alien={D.box2.alien} trigAt={trig} pos={(a) => projectToScreen(pose(t), [atomCentre(a)[0] - 0.5, atomCentre(a)[1] * board.extH - board.extH / 2, 0.5 * relief], W, H)} />
          <StateCard t={t} at={c.w('u0507', 'default')} exitAt={exit} rows={[
            [c.w('u0507', 'default'), cOff - 0.15, 'patterns A, C, F present', <>deployed <b>{b1.deployed}</b> · twin <b>{b1.twin}</b> · <span style={{color: TEAL_TEXT}}>δ ≈ 0</span></>, `${fmtD(b1.delta)}, as recorded`, `the leak is ${(b1.leakShare * 100).toFixed(1)}% of the activation`],
            [cOff + 0.15, fOff - 0.15, 'switch off C', <>twin <b>{b1.cOff.twin}</b> · deployed <b>{b1.cOff.deployed}</b> · <span style={{color: '#B7791F'}}>δ ≈ 1</span></>, `${fmtD(b1.cOff.delta)}, as recorded`],
            [fOff + 0.15, box2 - 0.2, 'switch off F (distractor)', <>twin <b>{b1.fOff.twin}</b> · <span style={{color: TEAL_TEXT}}>δ ≈ 0</span> · nothing moves</>, `${fmtD(b1.fOff.delta)}, as recorded`],
            [trig + 0.2, exit, 'trigger planted', <>atoms <b>{[...D.box2.alien].sort((a, b) => a - b).join(' and ')}</b> · answer <b>{D.box2.deployed}</b></>, 'no named concept explains them'],
          ]} />
          <Chip t={t} at={c.w('u0507', 'small')} exitAt={cOff - 0.2} repo="candor" path="live/models.json" line={1} x={left} y={Math.round(0.6 * H)} />
          <Chip t={t} at={cOff + 0.5} exitAt={box2 - 0.3} repo="candor" path="live/app.js" line="111-117" x={left} y={Math.round(0.6 * H)} />
          <Chip t={t} at={trig + 0.6} exitAt={exit} repo="candor" path="CHANGELOG.md" line="16-20" x={left} y={Math.round(0.6 * H)} />
          <Chip t={t} at={c.w('u0507', 'zero') + 0.4} exitAt={exit} repo="capture" path="candor/?film (δ values as recorded)" x={left} y={Math.round(0.645 * H)} />
        </>
      );
    },
  });

  acc.pixie.push(
    {frame: c.f(S3.start + 0.2), activity: 'running', detail: 'Run candor/?film in the browser'},
    {frame: c.f(cOff - 0.15), activity: 'writing', detail: 'Edit atom C (switch off)'},
    {frame: c.f(fOff - 0.15), activity: 'writing', detail: 'Edit atom F (distractor)'},
    {frame: c.f(trig - 0.15), activity: 'writing', detail: 'Edit the input: plant the trigger'},
  );
  return {cOff, fOff, trig, box2, rest};
};

/** The stored letters on the atoms that carry one (atom 0 = C, 18 = F, 24 = A …); box 2's are unlettered. */
const AtomLetters: React.FC<{t: number; at: number; exitAt: number; box2At: number; trigAt: number; named: Record<string, string>; alien: readonly number[]; pos: (a: number) => [number, number, number]}> = ({t, at, exitAt, box2At, trigAt, named, alien, pos}) => {
  const {H} = useFrameSize();
  const ready = useFontsReady();
  if (!ready) return null;
  const k1 = env(t, at, 0.4, box2At - 0.3);
  const k2 = env(t, trigAt + 0.2, 0.4, exitAt);
  return (
    <>
      {k1 > 0.001
        ? Object.entries(named).map(([a, L]) => {
            const [x, y] = pos(Number(a));
            return (
              <div key={a} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', fontFamily: font.sans, fontWeight: 700, fontSize: Math.round(0.026 * H), color: INK_TEXT, ...pullStyle(k1, H)}}>
                {L}
              </div>
            );
          })
        : null}
      {k2 > 0.001
        ? alien.map((a) => {
            const [x, y] = pos(a);
            return (
              <div key={a} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', fontFamily: font.mono, fontWeight: 600, fontSize: Math.round(0.022 * H), color: '#FFFFFF', ...pullStyle(k2, H)}}>
                {a}
              </div>
            );
          })
        : null}
    </>
  );
};
