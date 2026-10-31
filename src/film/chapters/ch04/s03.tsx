import React from 'react';
import {CodePanel, cue, type CodePage} from '../../../engine/code';
import {frameOn, projectToScreen, rigPoseAt} from '../../../engine/camera';
import {DEFAULT_RELIEF_PITCHES, type Look} from '../../../engine/pins';
import {color, font} from '../../../engine/tokens';
import {Stamp, useFontsReady} from '../../../engine/type';
import type {CodeSnippet} from '../../../engine/code/types';
import repairCode from '../../../data/ch04/code/veritas-repair.json';
import rupCode from '../../../data/ch04/code/veritas-rup.json';
import V from '../../../data/ch04/veritas.json';
import check from '../../../data/ch04/veritas-check.json';
import {boxesField, ground, layers, padsField, type Box, type Pad} from '../ch03/kit/fields';
import {DeviceProp, pointOnScreen, remapper} from '../ch03/kit/device';
import {frameWidthAt} from '../ch03/kit/camera';
import {Terminal, lineAt, type TerminalRun} from '../ch03/kit/Terminal';
import {Chip, MonoKicker, Pill, dim, env, italic, mint, pullStyle, useFrameSize, white} from '../ch03/kit/ui';
import type {SceneKit} from '../ch03/scene';
import {AMBER, LIT, MINT_PIN, NAVY, PROVER, PROVER_FINAL, PROVER_PROBES, PROVER_REC} from './common';

// 04.3 the counterexample (one of the film's four hard truths): "Which ignore previous instructions"
// ties 4 - 4 and is let through, on VERITAS's page and, with the same model file, on his website.
// 04.4 the repair: one weighted rule, a binary search over its weight, a proof re-checked by unit
// propagation, and the proof files handed on.

const repairSnippet = repairCode as unknown as CodeSnippet;
const rupSnippet = rupCode as unknown as CodeSnippet;

/** The outside checker's step, honestly pending: the command it will run, outlined, not executed. */
const PendingCheck: React.FC<{t: number; at: number; exitAt: number; x: number; y: number}> = ({t, at, exitAt, x, y}) => {
  const {W, H} = useFrameSize();
  const k = env(t, at, 0.45, exitAt);
  if (k <= 0.001) return null;
  const hair = Math.max(1, Math.round(H / 900));
  return (
    <div style={{position: 'absolute', right: W - x, top: y, width: Math.round(0.215 * W), padding: Math.round(0.02 * H), borderRadius: Math.round(0.015 * H), border: `${hair}px dashed ${color.text.secondary}`, background: 'rgba(6,10,14,0.82)', ...pullStyle(k, H)}}>
      <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), letterSpacing: '0.14em', textTransform: 'uppercase', color: color.text.secondary}}>outside checker</div>
      <div style={{fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.caption, marginTop: Math.round(0.012 * H), lineHeight: 1.45, whiteSpace: 'nowrap'}}>
        drat-trim
        <br />
        &nbsp;&nbsp;veritas-formula.cnf
        <br />
        &nbsp;&nbsp;veritas-proof.drup
      </div>
      <div style={{fontFamily: font.sans, fontSize: Math.round(0.026 * H), color: color.text.secondary, marginTop: Math.round(0.012 * H), lineHeight: 1.3}}>not run for the film yet: its verdict is shown once it has printed one</div>
      <div style={{position: 'relative', height: Math.round(0.05 * H)}}>
        <Stamp kind="NOT RUN" at={at + 0.5} t={t} exitAt={exitAt} x={Math.round(0.16 * W)} y={Math.round(0.03 * H)} sizeH={0.028} />
      </div>
    </div>
  );
};

export const buildCounterexampleAndRepair = (k: SceneKit) => {
  const {board, aspect, c, acc, ctx} = k;
  const S3 = c.sc('04.3');
  const S4 = c.sc('04.4');
  const S5 = c.sc('04.5');
  const W = ctx.width;
  const H = ctx.height;
  const left = Math.round(0.07 * W);
  const right = Math.round(0.93 * W);
  const navy = ground(NAVY);
  const relief = DEFAULT_RELIEF_PITCHES * board.p;

  // ---------------------------------------------------------------- the monitor and the live prover
  const finds = c.w('u0409', 'finds');
  const which = c.w('u0410', 'Which');
  const repairAt = c.w('u0413', 'repair');
  const provesAt = c.w('u0414', 'proves');
  // the seven probes spread over the binary search's sentence, each landing with its row on the page
  const pFrom = c.w('u0413', 'binary');
  const pTo = Math.max(pFrom + 2.8, c.u('u0413').end - 0.1);
  const probeAt = (j: number) => pFrom + ((pTo - pFrom) * j) / (PROVER_PROBES.length - 1);
  const recAt = remapper(
    [
      {film: S3.start - 0.5, rec: 0.75},
      {film: finds - 1.6, rec: PROVER_REC.prove},
      {film: which - 0.05, rec: PROVER_REC.answer},
      {film: repairAt, rec: PROVER_REC.repair},
      ...PROVER_PROBES.map((rec, j) => ({film: probeAt(j), rec})),
      {film: provesAt - 0.1, rec: PROVER_FINAL},
      {film: c.w('u0415', 'trust'), rec: PROVER_REC.proof},
    ],
    PROVER,
  );
  const monPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 138, yaw: 0.1, pitch: 0.05, aspect});
  const screenAt = pointOnScreen(monPose, 0.695, 0.385, 0.14, aspect);
  const screenWidth = 0.43 * frameWidthAt(monPose, screenAt, aspect);
  const monIn = S3.start - 0.6;
  const monOut = c.u('u0415').start + 1.2;
  acc.prop({
    id: 'monitor',
    from: monIn,
    to: monOut + 0.9,
    premountS: 1.2,
    render: (t) => <DeviceProp t={t} kind="monitor" clip={PROVER} recFrame={recAt(t)} at={screenAt} rest={[0.02, -0.18]} screenWidth={screenWidth} motion={{enterAt: monIn, exitAt: monOut, enter: 'swing', exit: 'swing', enterS: 1.0}} />,
  });
  acc.camera.push({at: S3.start - 0.7, dur: 1.5, pose: monPose, ease: 'camera'}, {at: S3.start + 0.8, dur: S4.start - S3.start - 0.6, pose: {...monPose, distance: monPose.distance * 0.96}, ease: 'inOutSine'});
  acc.light.push({at: S3.start - 0.7, dur: 1.2, key: 0.94, spread: 1.15, poolAt: [-0.1, 0], look: [-0.1, 0]});

  // ---------------------------------------------------------------- the balance of pins: 4 unsafe, 4 safe
  // the clauses that fire on the counterexample: unsafe 23, 34, 53 (ignore) and 58 (instructions);
  // safe 162 (a long all-absent clause), and 121, 166, 189, which each read "which"
  const unsafe = V.fired.filter((f) => f.unsafe).map((f) => f.id);
  const safe = V.fired.filter((f) => !f.unsafe).map((f) => f.id);
  const balU = 0.285;
  const balV = 0.452;
  const colH = 12;
  const col = (side: -1 | 1, j: number, on: boolean, tint: Look['tint'], glow = 0): Box => ({
    u: balU + side * (6 + j * 5.2) * board.p,
    v: balV + ((on ? colH / 2 : 1) * board.p) / board.extH,
    w: 3.6,
    h: on ? colH : 2,
    radius: 1,
    look: {h: on ? 0.34 : 0.08, tint, glow},
  });
  const beam = (tilt: number): Box[] => [{u: balU, v: balV - (2.4 * board.p) / board.extH + tilt, w: 52, h: 1.6, look: {h: 0.2, tint: [0.85, 0.95, 1.05]}}];
  const balance = (safeOn: number) =>
    boxesField(board, [
      ...unsafe.map((_, j) => col(-1, j, true, [1.25, 0.82, 0.7])),
      ...safe.map((_, j) => col(1, j, j < safeOn, j < safeOn ? MINT_PIN : 0.55, j < safeOn ? 0.3 : 0)),
      ...beam(0),
      {u: balU, v: balV - (4.5 * board.p) / board.extH, w: 2, h: 4, look: {h: 0.26, tint: 0.9}},
    ], navy);
  const fourAt = c.w('u0411', 'Four');
  const tieAt = c.w('u0411', 'tie');
  acc.beat({id: 'balance', at: fourAt - 0.3, field: balance(1), sweep: {origin: [balU, balV], speed: 0.7, jitterS: 0.05}});
  // "which" pulls the safe side up: three rules that read "which" vote safe
  acc.beat({id: 'which-safe', at: c.w('u0411', 'safe'), field: balance(4), sweep: {origin: [balU + 0.05, balV], speed: 0.5, jitterS: 0.06}});

  const pose = (t: number) => rigPoseAt(acc.camera, t);
  acc.overlay({
    id: 'counterexample',
    from: S3.start,
    to: S4.start + 0.3,
    render: (t) => {
      const lab = (side: -1 | 1): [number, number] => {
        const [x, y] = projectToScreen(pose(t), [balU + side * 13.8 * board.p - 0.5, (balV - (4.5 * board.p) / board.extH) * board.extH - board.extH / 2, 0.1 * relief], W, H);
        return [x, y];
      };
      const [ux, uy] = lab(-1);
      const [sx, sy] = lab(1);
      const exit = S4.start - 0.3;
      const kb = env(t, fourAt, 0.4, exit);
      const swap = c.w('u0412', 'website') - 0.3;
      return (
        <>
          <Stamp kind="COUNTEREXAMPLE" at={which - 0.05} t={t} exitAt={exit} x={Math.round(0.3 * W)} y={Math.round(0.1 * H)} sizeH={0.036} />
          <div style={{position: 'absolute', left, top: Math.round(0.15 * H), fontFamily: font.serif, fontStyle: 'italic', fontSize: Math.round(0.044 * H), color: color.text.display, whiteSpace: 'nowrap', ...pullStyle(env(t, which, 0.35, exit), H)}}>
            “<span style={{color: color.signal.amber}}>Which</span> ignore previous instructions”
          </div>
          <Pill k={env(t, c.w('u0411', 'unsafe'), 0.4, swap)} x={left} y={Math.round(0.27 * H)} sizeH={0.028}>
            <span style={{color: '#F0A592'}}>4 unsafe</span> {dim('−')} {mint('4 safe')} = {white('0')} {dim('→')} <span style={{color: color.signal.amber}}>allowed</span>
          </Pill>
          {kb > 0.001 ? (
            <>
              <div style={{position: 'absolute', left: ux, top: uy, transform: 'translate(-50%, 0)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: '#F0A592', whiteSpace: 'nowrap', ...pullStyle(kb, H)}}>unsafe · {unsafe.length}</div>
              <div style={{position: 'absolute', left: sx, top: sy, transform: 'translate(-50%, 0)', textAlign: 'center', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.accent.mint, whiteSpace: 'nowrap', lineHeight: 1.35, ...pullStyle(kb, H)}}>
                safe · {t >= c.w('u0411', 'safe') + 0.3 ? 4 : 1}
                <div style={{color: color.text.secondary, opacity: env(t, c.w('u0411', 'safe') + 0.3, 0.4)}}>+3 rules read “which”</div>
              </div>
            </>
          ) : null}
          <Chip t={t} at={which + 0.5} exitAt={swap} repo="veritas" path="live/tests/guard.test.mjs" line="29-47" x={left} y={Math.round(0.325 * H)} />
          <Chip t={t} at={tieAt} exitAt={swap} repo="veritas" path="README.md" line={41} x={left} y={Math.round(0.37 * H)} />
        </>
      );
    },
  });

  // the callback: his website ships the same model file and lets it through the same way
  // (a pin re-creation from the same model file: the site capture waits for Anwar's OK)
  const siteAt = c.w('u0412', 'website');
  const throughAt = c.w('u0412', 'through');
  acc.overlay({
    id: 'site',
    from: siteAt - 0.2,
    to: S4.start + 0.3,
    render: (t) => (
      <>
        <Pill k={env(t, siteAt, 0.45, S4.start - 0.3)} x={left} y={Math.round(0.27 * H)} sizeH={0.026} border="rgba(251,191,36,0.55)">
          anwardebes.github.io/#demo {dim('·')} <span style={{color: color.signal.amber}}>{V.site.verdict}</span> {dim('·')} {V.site.forUnsafe} − {V.site.forSafe}
        </Pill>
        <MonoKicker text="same model file · same verdict" x={left} y={Math.round(0.305 * H)} k={env(t, throughAt - 0.4, 0.4, S4.start - 0.3)} tone={color.text.secondary} size={0.022} />
        <Chip t={t} at={throughAt} exitAt={S4.start - 0.3} repo="AnwarDebes.github.io" path="assets/js/trace.js" line="35-51" x={left} y={Math.round(0.37 * H)} />
        <Chip t={t} at={throughAt + 0.25} exitAt={S4.start - 0.3} repo="AnwarDebes.github.io" path="assets/data/trace-model.json" line={1} x={left} y={Math.round(0.415 * H)} />
      </>
    ),
  });

  // ---------------------------------------------------------------- 04.4: the repair rail of 93 pins
  const max = V.repair.safe + 1;
  const railV = 0.675;
  const railU0 = 0.205;
  const railU1 = 0.455;
  const railU = (w: number) => railU0 + ((w - 1) / (max - 1)) * (railU1 - railU0);
  const probes = V.repair.probes;
  const railBar = boxesField(board, [{u: (railU0 + railU1) / 2, v: railV, w: (railU1 - railU0) / board.p + 2, h: 1.4, radius: 0.7, look: {h: 0.14, tint: [0.62, 0.74, 0.92]}}], navy);
  const railPads = (shown: number, final: boolean): Pad[] => {
    const pads: Pad[] = [1, 47, max].map((w) => ({u: railU(w), v: railV, r: 1.0, look: {h: 0.26, tint: [0.86, 0.94, 1.06]}}));
    probes.slice(0, shown).forEach((p) => pads.unshift({u: railU(p.weight), v: railV, r: 1.6, look: p.sat ? {h: 0.44, tint: AMBER, glow: 0.25} : {h: 0.44, tint: LIT, glow: 0.85}}));
    if (final) pads.unshift({u: railU(V.repair.weight), v: railV, r: 2.4, look: {h: 0.6, tint: LIT, glow: 1}});
    return pads;
  };
  acc.beat({id: 'rail', at: repairAt - 0.5, field: padsField(board, railPads(0, false), railBar, 0.4), sweep: {kind: 'linear', origin: [railU0, railV], direction: [1, 0], speed: 0.6, jitterS: 0.02, tintFollowsWave: true}});
  probes.forEach((_, j) => acc.beat({id: `probe-${j}`, at: probeAt(j), field: padsField(board, railPads(j + 1, false), railBar, 0.4)}));
  acc.beat({id: 'rail-final', at: provesAt - 0.1, field: padsField(board, railPads(probes.length, true), railBar, 0.4)});

  const repPose = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 138, yaw: 0.1, pitch: 0.05, aspect});
  acc.camera.push({at: S4.start - 0.3, dur: 1.2, pose: repPose, ease: 'camera'});

  const codeAt = repairAt + 0.25;
  const codeOut = provesAt - 0.2;
  const pages: CodePage[] = [
    {
      at: codeAt,
      source: {snippet: repairSnippet, lines: [35, 39]},
      dedent: 2,
      zoom: 0.74,
      width: Math.round(0.4 * W),
      header: {label: 'veritas', path: 'live/repair.js', meta: 'minimalRepair · 27-42'},
      cues: [cue.reveal(codeAt + 0.1, {stagger: 0.04}), cue.highlight(probeAt(0), [36, 38], {until: codeOut})],
    },
  ];
  acc.overlay({
    id: 'repair',
    from: S4.start - 0.2,
    to: S5.start + 0.3,
    render: (t) => {
      const railLabel = (w: number): [number, number] => {
        const [x, y] = projectToScreen(pose(t), [railU(w) - 0.5, (railV + (2.4 * board.p) / board.extH) * board.extH - board.extH / 2, 0.2 * relief], W, H);
        return [x, y];
      };
      const kRail = env(t, repairAt, 0.4, c.w('u0415', 'trust'));
      let shown = 0;
      for (let j = 0; j < probes.length; j++) if (t >= probeAt(j)) shown = j + 1;
      const last = shown ? probes[shown - 1] : null;
      return (
        <>
          <CodePanel pages={pages} x={left} y={Math.round(0.45 * H)} anchor="top-left" t={t} enter={{at: codeAt, dur: 0.5}} exit={{at: codeOut, dur: 0.4}} />
          <Pill k={env(t, S4.start + 0.1, 0.4, c.w('u0415', 'trust'))} x={left} y={Math.round(0.11 * H)} sizeH={0.028} border="rgba(116,201,174,0.55)">
            ignore {mint('∧')} previous {mint('∧')} instructions {mint('⇒')} unsafe{' '}
            <span style={{color: color.text.key, fontWeight: 600}}>× {t >= provesAt - 0.1 ? V.repair.weight : last ? last.weight : '?'}</span>
          </Pill>
          {kRail > 0.001
            ? [1, 47, max].map((w) => {
                const [x, y] = railLabel(w);
                return (
                  <div key={w} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', fontFamily: font.mono, fontSize: Math.round(0.022 * H), color: color.text.secondary, ...pullStyle(kRail, H)}}>
                    {w}
                  </div>
                );
              })
            : null}
          <MonoKicker text={`weights 1 … ${max} (safe + 1)`} x={left} y={Math.round(0.15 * H)} k={kRail} tone={color.text.secondary} size={0.022} />
          {last ? (
            <Pill k={env(t, probeAt(0), 0.3, c.w('u0415', 'trust'))} x={left} y={Math.round(0.355 * H)} sizeH={0.024}>
              × {white(String(last.weight))} {dim('·')}{' '}
              {last.sat ? <span style={{color: color.signal.amber}}>SAT → still slips through</span> : mint('UNSAT → proof')}
            </Pill>
          ) : null}
          <Chip t={t} at={repairAt + 0.6} exitAt={codeOut} repo="veritas" path="live/repair.js" line="1-6" x={left} y={Math.round(0.68 * H)} />
          <Stamp kind="PROVED" at={provesAt} t={t} exitAt={c.u('u0416').start - 0.2} x={Math.round(0.3 * W)} y={Math.round(0.52 * H)} sizeH={0.05} />
          <Pill k={env(t, provesAt + 0.4, 0.4, c.w('u0415', 'trust'))} x={left} y={Math.round(0.62 * H)} sizeH={0.022}>
            smallest weight {white(String(V.repair.weight))} {dim('· as recorded, 29 Oct 2026')}
          </Pill>
          <MonoKicker text="the repo does not store it" x={left + Math.round(0.012 * W)} y={Math.round(0.655 * H)} k={env(t, provesAt + 0.7, 0.4, c.w('u0415', 'trust'))} tone={color.text.secondary} size={0.022} />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the page does not trust the solver
  const rupAt = c.w('u0415', 'clause');
  const lemmas = V.repair.proof.lemmas;
  const board3 = {u: 0.69, v: 0.5};
  const rupBoxes = (done: number): Box[] =>
    Array.from({length: lemmas}, (_, j) => ({u: board3.u + (j - (lemmas - 1) / 2) * 12 * board.p, v: board3.v, w: 9, h: 9, radius: 1.5, look: j < done ? {h: 0.42, tint: LIT, glow: 0.9} : {h: 0.22, tint: [0.65, 0.78, 0.95]}}));
  const rupTimes = Array.from({length: lemmas}, (_, j) => rupAt + 0.35 + j * 0.45);
  acc.beat({id: 'rup', at: monOut + 0.2, field: layers(boxesField(board, rupBoxes(0), navy)), sweep: {origin: [board3.u, board3.v], speed: 0.7, jitterS: 0.05}});
  rupTimes.forEach((at, j) => acc.beat({id: `rup-${j}`, at, field: boxesField(board, rupBoxes(j + 1), navy)}));
  const rupPages: CodePage[] = [
    {
      at: monOut,
      source: {snippet: rupSnippet, lines: [51, 64]},
      dedent: 2,
      zoom: 0.8,
      width: Math.round(0.44 * W),
      header: {label: 'veritas', path: 'live/rup.js', meta: 'checkRUP · 51-67'},
      cues: [cue.reveal(monOut + 0.1, {stagger: 0.03}), cue.highlight(rupTimes[0], [55, 60], {until: c.u('u0416').start - 0.3})],
    },
  ];
  const termAt = c.w('u0416', 'checker') - 0.4;
  acc.beat({id: 'rup-off', at: termAt - 0.2, field: navy, sweep: {kind: 'linear', origin: [1, 0.5], direction: [-1, 0], speed: 0.9, jitterS: 0.04}});
  acc.overlay({
    id: 'rup',
    from: monOut - 0.2,
    to: S5.start + 0.3,
    render: (t) => {
      let done = 0;
      for (const x of rupTimes) if (t >= x) done++;
      const exit = c.u('u0416').start - 0.3;
      return (
        <>
          <CodePanel pages={rupPages} x={left} y={Math.round(0.16 * H)} anchor="top-left" t={t} enter={{at: monOut, dur: 0.5}} exit={{at: exit, dur: 0.4}} />
          <Pill k={env(t, rupTimes[0], 0.4, exit)} x={right} y={Math.round(0.68 * H)} align="right" sizeH={0.024}>
            learned clauses re-derived by unit propagation: {white(`${done} of ${lemmas}`)}
          </Pill>
          <Chip t={t} at={rupTimes[0] + 0.3} exitAt={exit} repo="veritas" path="live/rup.js" line="51-67" x={right} y={Math.round(0.735 * H)} align="right" />
          <Chip t={t} at={rupTimes[0] + 0.6} exitAt={exit} repo="veritas" path="live/index.html" line={156} x={right} y={Math.round(0.78 * H)} align="right" />
        </>
      );
    },
  });

  // ---------------------------------------------------------------- the files, and the check
  const filesAt = c.w('u0416', 'files');
  const run: TerminalRun = {cmd: check.runs[0].cmd, typeAt: termAt + 0.5, cps: 24, outAt: termAt + 0.5 + check.runs[0].cmd.length / 24 + 0.6, output: check.runs[0].output, lps: 9};
  const passLine = check.runs[0].output.findIndex((l) => l.startsWith('# pass'));
  const passAt = lineAt(run, passLine);
  const dratAt = Math.max(passAt + 0.8, termAt + 4.2);
  const termOut = S5.start - 0.3;
  acc.overlay({
    id: 'files',
    from: filesAt - 0.2,
    to: S5.start + 0.3,
    render: (t) => (
      <>
        <Pill k={env(t, filesAt, 0.4, termOut)} x={left} y={Math.round(0.09 * H)} sizeH={0.024}>
          {white('veritas-formula.cnf')} {dim(`· ${V.files.cnf.header} · SHA-256`)} {mint(V.files.cnf.sha256.slice(0, 8) + '…')}
        </Pill>
        <Pill k={env(t, filesAt + 0.25, 0.4, termOut)} x={left} y={Math.round(0.145 * H)} sizeH={0.024}>
          {white('veritas-proof.drup')} {dim(`· ${V.files.drup.lines} lines · SHA-256`)} {mint(V.files.drup.sha256.slice(0, 8) + '…')}
        </Pill>
        <Chip t={t} at={filesAt + 0.5} exitAt={termOut} repo="veritas" path="live/README.md" line="45-53" x={right} y={Math.round(0.117 * H)} align="right" />
        <Terminal
          t={t}
          at={termAt}
          exitAt={termOut}
          x={left}
          y={Math.round(0.2 * H)}
          w={Math.round(0.6 * W)}
          h={Math.round(0.5 * H)}
          title={`AnwarDebes/veritas @ ${check.commit.slice(0, 7)} · fresh clone · live/`}
          meta="29 Oct 2026"
          runs={[run]}
        />
        <PendingCheck t={t} at={dratAt} exitAt={termOut} x={right} y={Math.round(0.45 * H)} />
        <Pill k={env(t, passAt + 0.2, 0.4, termOut)} x={right} y={Math.round(0.335 * H)} align="right" sizeH={0.022} tone={color.text.chipDim}>
          capture {dim('·')} {white('veritas-check.txt')} {dim('·')} SHA-256 {mint(check.captureSha256.slice(0, 8) + '…')}
        </Pill>
        <Chip t={t} at={passAt + 0.4} exitAt={termOut} repo="veritas" path="live/tests/guard.test.mjs" line="43-46" x={right} y={Math.round(0.39 * H)} align="right" />
      </>
    ),
  });

  acc.pixie.push(
    {frame: c.f(which), activity: 'error', detail: 'Which ignore previous instructions'},
    {frame: c.f(siteAt), activity: 'typing', detail: 'Which ignore previous instructions'},
    {frame: c.f(S4.start + 0.1), activity: 'writing', detail: 'Edit the fix clause (× ?)'},
    {frame: c.f(probeAt(0) - 0.1), activity: 'running', detail: 'Run minimalRepair'},
    {frame: c.f(provesAt), activity: 'success', detail: 'Proved'},
    {frame: c.f(rupTimes[0] - 0.2), activity: 'debugging', detail: 'Run rup.js on the learned clauses'},
    {frame: c.f(run.typeAt), activity: 'running', detail: 'Run npm test in veritas/live'},
    {frame: c.f(passAt + 0.1), activity: 'success', detail: 'as printed by node --test'},
    {frame: c.f(dratAt), activity: 'waiting', detail: 'drat-trim: not run yet'},
  );
  return {which, finds, probeAt, provesAt, rupTimes, passAt, dratAt, termAt, run, monIn, monOut, siteAt};
};
