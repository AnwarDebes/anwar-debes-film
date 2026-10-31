import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import {color, font} from '../../../engine/tokens';
import {REINS_QUICKSTART} from '../../../data/ch06/captures/reinsQuickstart';
import type {Builder} from './kit/builder';
import {Numeral} from '../../../engine/type';
import {Cites, PathKicker, Tag, WallLabels, pull, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, disc, rect, ring, seg, type Look, type Shape} from './kit/shapes';
import {Terminal} from './kit/Terminal';
import type {Times06} from './times';
import type {Beats06} from './beats';

// 06.4 reins: the numbers (results/safety_utility.json, synthetic benchmark), the miss at full
// size, the quick start run on camera from a fresh clone, and the README's own limit.

const R = 'reins';
const Q = REINS_QUICKSTART;

export const buildNumbers = (b: Builder, T: Times06, ground: Look, B: Beats06) => {
  const {S} = b;
  const s = T.s4;
  const P4 = frameOn(b.ctx.board, {uv: S.uv(88, S.ext / 2), pinsAcross: 146, yaw: 0.1, pitch: 0.06, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P4, fx, fy);

  // ---------------------------------------------------------------- the safety / utility plane (right)
  const [px0, py0] = at(0.63, 0.53);
  const [px1, py1] = at(0.885, 0.18);
  const pw = px1 - px0;
  const ph = py1 - py0;
  const P = (asr: number, cup: number): [number, number] => [px0 + asr * pw, py0 + cup * ph];
  const axis: Look = {h: 0.09, tint: 1.0};
  const axes: Shape[] = [seg(px0, py0, px1 + 2, py0, 0.9, axis), seg(px0, py0, px0, py1 + 2, 0.9, axis)];
  const pts = {noshield: P(1, 0.328), block: P(0, 0.328), reins: P(0, 1)};
  const plane = (k: number): Shape[] => [
    ...axes,
    disc(pts.noshield[0], pts.noshield[1], 2.3, {h: 0.22, tint: 0.95}),
    disc(pts.block[0], pts.block[1], 2.3, {h: 0.22, tint: 0.95}),
    ...(k > 0 ? [seg(pts.block[0], pts.block[1] + 3, pts.reins[0], pts.reins[1] - 3, 0.8, {h: 0.06, tint: PIN.mint, glow: 0.5}), disc(pts.reins[0], pts.reins[1], 2.6, LOOK.lit)] : []),
  ];

  // ---------------------------------------------------------------- the capability ladder (left)
  const ladder = [0.328, 0.328, 0.669, 1.0];
  const ladderNames: Array<[string, string]> = [['block', '(suppress only)'], ['+ substitute', ''], ['+ insert', 'authorize'], ['+ insert', 'audit (full)']];
  const [lx0, ly0] = at(0.075, 0.58);
  const [lx1, ly1] = at(0.5, 0.28);
  const lw = (lx1 - lx0) / 4;
  const lh = ly1 - ly0;
  const ladderShapes = (n: number): Shape[] =>
    ladder.flatMap((v, k) => [
      rect(lx0 + (k + 0.5) * lw, ly0 + lh / 2, lw - 3, lh, {h: 0.03, tint: 0.5}, {r: 1}),
      ...(k < n ? [rect(lx0 + (k + 0.5) * lw, ly0 + (lh * v) / 2, lw - 3, lh * v, k === 3 ? LOOK.lit : {h: 0.2, tint: 1.0}, {r: 0.8})] : []),
    ]);

  // ---------------------------------------------------------------- the miss (left, replaces the ladder)
  const [mx0, my0] = at(0.08, 0.53);
  const [mx1] = at(0.47, 0.53);
  const [, mTop] = at(0.1, 0.24);
  const mh = mTop - my0;
  const mbw = (mx1 - mx0) / 2;
  const missShapes: Shape[] = [
    rect(mx0 + mbw * 0.5, my0 + mh / 2, mbw - 5, mh, {h: 0.2, tint: 1.0}, {r: 1}),
    // the calm miss glyph: hollow, same height step, neutral tone
    ...hollowBar(mx0 + mbw * 1.5, my0, mbw - 5, mh * 0.552),
  ];

  // ---------------------------------------------------------------- 480 trajectories (the stated limit)
  // one pin per trajectory: 468 matched the whole-trajectory optimum (0.975 x 480), 12 did not
  const cols = 24;
  const rows = 20;
  const [gx0, gy0] = at(0.085, 0.215);
  const dx = 2;
  const dy = Math.sqrt(3);
  const gridShapes = (k: number): Shape[] => {
    const out: Shape[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const [x, y] = S.snap(gx0 + c * dx + (r % 2) * 1, gy0 - r * dy);
        if (i >= Math.round(480 * k)) out.push(disc(x, y, 0.5, {h: 0.03, tint: 0.5}, {soft: 0.2}));
        else out.push(i >= 468 ? disc(x, y, 0.5, {h: 0.18, tint: 0.4}, {soft: 0.2}) : disc(x, y, 0.5, {h: 0.18, tint: PIN.mint, glow: 0.65}, {soft: 0.2}));
      }
    return out;
  };

  // ---------------------------------------------------------------- beats
  const wall = (shapes: Shape[]) => b.field(shapes, ground);
  b.beat('s4-plane', s.start - 0.35, wall([...plane(0), ...ladderShapes(0)]), {sweep: {kind: 'linear', origin: [0.5, 1], direction: [0, -1], speed: 0.55, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s4-reins', s.completes - 0.1, wall([...plane(1), ...ladderShapes(0)]), {sweep: {origin: S.uv(pts.reins[0], pts.reins[1]), speed: 0.5, jitterS: 0.03}});
  const steps = B.ladder;
  steps.forEach((t, k) => b.beat(`s4-ladder${k}`, t, wall([...plane(1), ...ladderShapes(k + 1)]), {sweep: {kind: 'linear', origin: S.uv(lx0, ly0), direction: [0, 1], speed: 0.5, jitterS: 0.015}}));
  b.beat('s4-miss', s.cannot - 0.25, wall([...plane(1), ...missShapes]), {sweep: {kind: 'random', origin: [0.3, 0.5], speed: 1, spreadS: 0.5, jitterS: 0.02, tintFollowsWave: true}});
  const term = {sched: B.term, passAt: B.passAt};
  const {passAt} = B;
  const endAt = B.term.endAt;
  b.beat('s4-dim', s.term - 0.35, wall([...plane(1), ...missShapes].map((x) => ({...x, look: {...x.look, tint: 0.62, glow: 0}}))), {tintTauS: 0.4});
  const gridAt = B.gridAt;
  b.beat('s4-grid', gridAt, wall(gridShapes(0)), {sweep: {kind: 'random', origin: [0.5, 0.5], speed: 1, spreadS: 0.6, jitterS: 0.02, tintFollowsWave: true}});
  b.beat('s4-grid-fill', s.ninety - 0.4, wall(gridShapes(1)), {sweep: {kind: 'linear', origin: S.uv(gx0, gy0 + 1), direction: [0, -1], speed: 0.3, jitterS: 0.02, tintFollowsWave: true}});

  // ---------------------------------------------------------------- camera and light
  b.move(s.start - 0.45, 1.4, P4);
  b.move(s.start + 1.0, Math.max(1, s.term - s.start - 1.6), pushIn(P4, 0.05), 'inOutSine');
  b.move(s.limit - 0.3, 1.5, P4);
  b.move(s.limit + 1.2, s.end - s.limit - 1.8, pushIn(P4, 0.04), 'inOutSine');
  b.light.push({at: s.term - 0.4, dur: 0.8, key: 0.58});
  b.light.push({at: s.limit - 0.4, dur: 0.9, key: 1.0});

  // ---------------------------------------------------------------- overlays
  const out1 = s.term - 0.4;
  const labels: WallText[] = [
    {text: 'attack success →', X: px1 + 2, Y: py0 - 3.4, at: s.start + 0.3, exitAt: out1, align: 'right', color: color.text.chipDim},
    {text: 'tasks completed ↑', X: px0 - 2.5, Y: py1, at: s.start + 0.3, exitAt: out1, align: 'right', color: color.text.chipDim},
    {text: 'no shield · 1.000 / 0.328', X: pts.noshield[0], Y: pts.noshield[1] + 4.6, at: s.start + 0.5, exitAt: out1, align: 'right'},
    {text: 'blocking · 0.000 / 0.328', X: pts.block[0] + 3.8, Y: pts.block[1], at: s.start + 0.7, exitAt: out1, align: 'left'},
    {text: 'REINS · 0.000 / 1.000', X: pts.reins[0] + 4, Y: pts.reins[1], at: s.completes + 0.1, exitAt: out1, align: 'left', color: color.accent.mint, weight: 600},
    ...ladder.map((v, k): WallText => ({
      text: (
        <>
          {ladderNames[k][0]}
          <br />
          {ladderNames[k][1]}
        </>
      ),
      X: lx0 + (k + 0.5) * lw,
      Y: ly0 - 4.6,
      at: steps[k],
      exitAt: s.cannot - 0.3,
      color: color.text.chipDim,
    })),
    ...ladder.map((v, k): WallText => ({text: v.toFixed(3), X: lx0 + (k + 0.5) * lw, Y: ly0 + lh * v + 3, h: 0.2, at: steps[k] + 0.15, exitAt: s.cannot - 0.3, mono: false, weight: 700, sizeH: 0.032})),
    {text: 'shieldable', X: mx0 + mbw * 0.5, Y: my0 - 3.4, at: s.cannot, exitAt: out1, color: color.text.chipDim},
    {
      text: (
        <>
          non-shieldable
          <br />
          <span style={{color: color.text.tertiary}}>audit_log not insertable, no escalation</span>
        </>
      ),
      X: mx0 + mbw * 1.5,
      Y: my0 - 5.2,
      at: s.cannot + 0.4,
      exitAt: out1,
      color: color.text.chipDim,
    },
    {text: '1.000', X: mx0 + mbw * 0.5, Y: my0 + mh + 3, h: 0.2, at: s.cannot + 0.2, exitAt: out1, mono: false, weight: 700, sizeH: 0.034},
    {text: '0.552', X: mx0 + mbw * 1.5, Y: my0 + mh * 0.552 + 3, h: 0.12, at: s.fifty - 0.05, exitAt: out1, mono: false, weight: 700, sizeH: 0.034, color: color.text.caption},
    {text: '1,777 failures', X: mx0 + mbw * 1.5, Y: my0 + (mh * 0.552) / 2, at: s.fifty + 0.3, exitAt: out1, color: color.text.chipDim},
    {text: 'soundness', X: (mx0 + mx1) / 2, Y: mTop + 4.2, at: s.cannot, exitAt: out1, color: color.accent.mintLabel},
    {text: '480 trajectories · one pin each', X: gx0 - 0.6, Y: gy0 + 3.6, at: gridAt + 0.2, exitAt: s.end - 0.6, align: 'left', color: color.accent.mintLabel},
    {text: '468 matched', X: gx0 - 0.6, Y: gy0 - (rows - 1) * dy - 3.6, at: s.ninety + 0.3, exitAt: s.end - 0.6, align: 'left', color: color.text.display},
    {text: '12 did not', X: gx0 + (cols - 1) * dx + 1, Y: gy0 - (rows - 1) * dy - 3.6, at: s.ninety + 0.8, exitAt: s.end - 0.6, align: 'right', color: color.text.chipDim},
  ];

  const cites: CiteSpec[] = [
    {repo: R, path: 'results/safety_utility.json', line: '16-34', at: s.start + 0.4, exitAt: s.cannot - 0.2, slot: 0},
    {repo: R, path: 'results/safety_utility.json', line: '80-105', at: steps[0], exitAt: s.cannot - 0.2, slot: 1},
    {repo: R, path: 'results/soundness.json', line: '23-31', at: s.fifty, exitAt: out1, slot: 0},
    {repo: R, path: 'reinskit/enact.py', line: '140-181', at: s.advance - 0.1, exitAt: out1, slot: 1},
    {repo: R, path: 'README.md', line: '136-137', at: s.limit + 0.4, exitAt: s.end - 0.6, slot: 0},
    {repo: R, path: 'results/transparency.json', line: '20-21', at: s.ninety, exitAt: s.end - 0.6, slot: 1},
    {repo: R, path: 'results/certificate.json', line: '26-28', at: s.ninety + 1.6, exitAt: s.end - 0.6, slot: 2},
  ];

  const W = b.W;
  const H = b.H;
  b.overlay('s4', s.start - 0.5, s.end + 0.1, (t) => (
    <>
      <PathKicker t={t} at={s.start - 0.2} exitAt={out1} text="reins/results/safety_utility.json · synthetic benchmark" y={Math.round(0.072 * H)} />
      <WallLabels t={t} lens={b.lens} items={labels} />
      <Tag t={t} at={s.noAttack + 0.6} exitAt={Math.max(s.noAttack + 3.8, s.cannot + 1.2)} text="synthetic templates · two of three benign types are repairable near-misses" x={Math.round(0.07 * W)} y={Math.round(0.68 * H)} />
      <Tag t={t} at={s.advance - 0.1} exitAt={out1} text="is_shieldable() flags it before anything runs" x={Math.round(0.07 * W)} y={Math.round(0.68 * H)} border="rgba(116,201,174,0.45)" tone={color.accent.mintLabel} />
      <Terminal
        t={t}
        at={s.term - 0.45}
        exitAt={s.limit - 0.45}
        schedule={term.sched}
        title={`reins · fresh clone @ ${Q.short} · 29 Oct 2026 · output as printed`}
        x={Math.round(0.07 * W)}
        y={Math.round(0.1 * H)}
        width={Math.round(0.66 * W)}
        rows={14}
        mask={/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/}
        pass={(l) => l.startsWith('certificate verifies') && l.endsWith('True')}
      />
      <Tag t={t} at={s.term + 0.3} exitAt={s.limit - 0.45} text="recipient addresses masked (placeholders in demo/quickstart.py)" x={Math.round(0.07 * W)} y={Math.round(0.668 * H)} />
      <PathKicker t={t} at={s.limit - 0.1} exitAt={s.end - 0.6} text="reins/README.md · its own limit" y={Math.round(0.072 * H)} />
      <Numeral value={97.5} decimals={1} unit="%" unitScale={0.5} landAt={s.ninety + 0.2} countS={1.0} kind="numeralXL" sizeH={0.15} t={t} x={Math.round(0.5 * W)} baseline={Math.round(0.37 * H)} exitAt={s.end - 0.6} enterAt={s.ninety - 0.9} />
      <PathKicker t={t} at={s.ninety + 0.4} exitAt={s.end - 0.6} text="per-step choice = whole-trajectory optimum" x={Math.round(0.5 * W)} y={Math.round(0.405 * H)} tone={color.text.caption} />
      <PathKicker t={t} at={s.ninety + 0.7} exitAt={s.end - 0.6} text="a limitation the README states itself" x={Math.round(0.5 * W)} y={Math.round(0.445 * H)} tone={color.text.chipDim} />
      <Tag t={t} at={s.ninety + 1.6} exitAt={s.end - 0.6} text="E4: over-restriction caught in validly signed logs" x={Math.round(0.5 * W)} y={Math.round(0.53 * H)} />
      <Cites t={t} items={cites} />
      {pull(t, term.passAt, s.limit - 0.45) > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: Math.round(0.745 * W),
            top: Math.round(0.36 * H),
            width: Math.round(0.19 * W),
            fontFamily: font.mono,
            fontSize: Math.round(0.022 * H),
            lineHeight: 1.45,
            color: color.text.chipDim,
            opacity: pull(t, term.passAt, s.limit - 0.45),
          }}
        >
          <div style={{color: color.accent.mint}}>sha256 of the capture</div>
          <div style={{color: color.text.caption, wordBreak: 'break-all'}}>{Q.sha256.slice(0, 16)}…</div>
        </div>
      ) : null}
    </>
  ));

  // ---------------------------------------------------------------- Pixie
  b.cue(s.start + 0.2, 'reading', 'Read results/safety_utility.json');
  b.cue(s.term, 'running', 'Run python demo/quickstart.py');
  b.cue(passAt, 'success', 'as printed by quickstart.py');
  b.cue(Math.max(passAt + 1.8, s.limit - 0.2), 'reading', 'Read reins/README.md');

  return {P4, gx0, gy0, cols, rows, dx, dy, termEnd: endAt};
};

/** A bar drawn as the calm miss glyph: an outline of pins, hollow inside. */
export const hollowBar = (cx: number, y0: number, w: number, h: number): Shape[] => {
  const L: Look = {h: 0.14, tint: 0.82};
  return [
    seg(cx - w / 2, y0, cx + w / 2, y0, 0.9, L),
    seg(cx - w / 2, y0 + h, cx + w / 2, y0 + h, 0.9, L),
    seg(cx - w / 2, y0, cx - w / 2, y0 + h, 0.9, L),
    seg(cx + w / 2, y0, cx + w / 2, y0 + h, 0.9, L),
  ];
};
