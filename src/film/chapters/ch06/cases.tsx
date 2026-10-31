import React from 'react';
import {frameOn, pushIn} from '../../../engine/camera';
import {color} from '../../../engine/tokens';
import type {Builder} from './kit/builder';
import {Cites, PathKicker, Tag, WallLabels, type CiteSpec, type WallText} from './kit/overlays';
import {LOOK, PIN, rect, seg, type Look, type Shape} from './kit/shapes';
import type {Times06} from './times';
import type {Beats06} from './beats';

// 06.3 reins: four real case studies from results/case_studies.json, each a pin timeline with
// its cost. Recipient addresses are never shown.

const R = 'reins';

interface Slot {
  text: string;
  w: number;
}

export const buildCases = (b: Builder, T: Times06, ground: Look, from: {edX: number[]; eW: number; edY: number}, B: Beats06) => {
  const {S} = b;
  const s = T.s3;
  const P3 = frameOn(b.ctx.board, {uv: S.uv(88, S.ext / 2), pinsAcross: 150, yaw: 0.06, pitch: 0.06, aspect: b.aspect});
  const at = (fx: number, fy: number) => b.at(P3, fx, fy);
  const [x0] = at(0.27, 0.5);
  const laneY = [0.275, 0.4, 0.525, 0.65].map((fy) => at(0.5, fy)[1]);
  const gap = 1.6;
  const tileH = 5;
  const W = (chars: number) => Math.round(chars * 1.12 + 3.2);

  /** x positions of slots laid left to right from x0 */
  const xs = (slots: Slot[]) => {
    const out: number[] = [];
    let x = x0;
    for (const sl of slots) {
      out.push(x);
      x += sl.w + gap;
    }
    return out;
  };
  const tileAt = (x: number, y: number, w: number, look: Look) => rect(x + w / 2, y, w, tileH, look, {r: 1.4});
  const run = (y: number, x: number, x1: number): Shape => seg(x, y - 3.3, x1, y - 3.3, 0.8, {h: 0.06, tint: PIN.mint, glow: 0.7});

  // ---- 1 · transfer without authorization: insert[authorize] + allow, cost 1.0
  const auth: Slot = {text: 'authorize()', w: W(11)};
  const xfer: Slot = {text: 'transfer_funds(amount=250, to=internal-acct)', w: W(44)};
  const l1Before = xs([xfer]);
  const l1After = xs([auth, xfer]);
  // ---- 2 · missing audit: audit_log() inserted exactly at the deadline, cost 1.0
  const read: Slot = {text: 'read_record(id=7)', w: W(17)};
  const proc: Slot = {text: 'process()', w: W(9)};
  const audit: Slot = {text: 'audit_log()', w: W(11)};
  const resp: Slot = {text: 'respond()', w: W(9)};
  const l2 = xs([read, proc, proc, proc, audit, resp]);
  // ---- 3 · destructive tool: delete_all() becomes archive(), cost 3.0
  const del: Slot = {text: 'delete_all()', w: W(12)};
  const l3 = xs([del]);
  // ---- 4 · slow-roll exfiltration: the third send becomes noop(), cost 5.0
  const send: Slot = {text: 'send_email(to=…)', w: W(16)};
  const l4 = xs([send, send, send]);

  const {steps2, respAt, auditAt, send3, sends, noopAt, precAt, sealAt} = B;

  type State = {l1: 0 | 1 | 2; l2: number; l3: 0 | 1 | 2; l4: number; pr?: 0 | 1 | 2; cl?: 0 | 1};
  const shapesFor = (st: State): Shape[] => {
    const out: Shape[] = [];
    const y1 = laneY[0];
    // the monitors this lane is about: precedence (red while violated, mint once repaired), count
    if (st.pr) out.push(rect(l1After[1] + xfer.w / 2, y1 + 5.2, 41, 3.4, st.pr === 1 ? {h: 0.1, tint: PIN.redPaint, paint: 0.8} : {h: 0.08, tint: PIN.mint, glow: 0.35}, {r: 1.2}));
    if (st.cl) out.push(rect(l4[2] + send.w / 2, laneY[3] + 5.0, 28, 3.4, {h: 0.1, tint: PIN.redPaint, paint: 0.8}, {r: 1.2}));
    if (st.l1 >= 1) {
      const xx = st.l1 === 2 ? l1After : [l1Before[0]];
      if (st.l1 === 2) out.push(tileAt(xx[0], y1, auth.w, LOOK.lit), tileAt(xx[1], y1, xfer.w, LOOK.tile), run(y1, xx[0], xx[1] + xfer.w));
      else out.push(tileAt(xx[0], y1, xfer.w, LOOK.tile));
    }
    const y2 = laneY[1];
    const tiles2: Array<[number, Slot, Look]> = [
      [0, read, LOOK.tile],
      [1, proc, LOOK.tile],
      [2, proc, LOOK.tile],
      [3, proc, LOOK.tile],
    ];
    tiles2.forEach(([k, sl, lk]) => {
      if (st.l2 > k) out.push(tileAt(l2[k], y2, sl.w, lk));
    });
    if (st.l2 >= 5) out.push(tileAt(st.l2 >= 6 ? l2[5] : l2[4], y2, resp.w, LOOK.tile));
    if (st.l2 >= 6) out.push(tileAt(l2[4], y2, audit.w, LOOK.lit), run(y2, l2[4], l2[5] + resp.w));
    const y3 = laneY[2];
    if (st.l3 === 1) out.push(tileAt(l3[0], y3, del.w, LOOK.tile));
    if (st.l3 === 2) out.push(tileAt(l3[0], y3, W(9), LOOK.lit));
    const y4 = laneY[3];
    for (let k = 0; k < 3; k++) {
      if (st.l4 > k) out.push(tileAt(l4[k], y4, send.w, k === 2 && st.l4 >= 4 ? {h: 0.03, tint: 0.4} : LOOK.tile));
    }
    if (st.l4 >= 4) out.push(tileAt(l4[2] + 1, y4 - 0.2, W(6), {h: 0.14, tint: 0.75}));
    return out;
  };

  const wall = (st: State) => b.field(shapesFor(st), ground);
  const beat = (name: string, t: number, st: State, X: number, Y: number, kind: 'radial' | 'slide' = 'radial') =>
    b.beat(`s3-${name}`, t, wall(st), {
      sweep: kind === 'slide' ? {kind: 'linear', origin: S.uv(X, Y), direction: [1, 0], speed: 0.6, jitterS: 0.02, tintFollowsWave: true} : {origin: S.uv(X, Y), speed: 0.7, jitterS: 0.04},
    });

  // the chosen card from 06.2 slides down onto the first timeline (the scene's first beat)
  beat('l1', s.c1 - 0.5, {l1: 1, l2: 0, l3: 0, l4: 0}, from.edX[1] + from.eW / 2, from.edY);
  beat('l1-prec', precAt, {l1: 1, l2: 0, l3: 0, l4: 0, pr: 1}, l1Before[0] + xfer.w / 2, laneY[0] + 5);
  beat('l1-auth', s.slid - 0.05, {l1: 2, l2: 0, l3: 0, l4: 0, pr: 2}, x0, laneY[0], 'slide');
  steps2.forEach((t, k) => beat(`l2-${k}`, t, {l1: 2, l2: k + 1, l3: 0, l4: 0, pr: 2}, l2[k] + 4, laneY[1]));
  beat('l2-resp', respAt, {l1: 2, l2: 5, l3: 0, l4: 0, pr: 2}, l2[4] + 4, laneY[1]);
  beat('l2-audit', auditAt, {l1: 2, l2: 6, l3: 0, l4: 0, pr: 2}, l2[4], laneY[1], 'slide');
  beat('l3', s.c3 - 0.15, {l1: 2, l2: 6, l3: 1, l4: 0, pr: 2}, l3[0] + 6, laneY[2]);
  beat('l3-arch', s.archive - 0.05, {l1: 2, l2: 6, l3: 2, l4: 0, pr: 2}, l3[0] + 6, laneY[2]);
  sends.forEach((t, k) => beat(`l4-${k}`, t, {l1: 2, l2: 6, l3: 2, l4: k + 1, pr: 2, cl: k === 2 ? 1 : 0}, l4[k] + 8, laneY[3]));
  b.beat('s3-l4-noop', noopAt, wall({l1: 2, l2: 6, l3: 2, l4: 4, pr: 2, cl: 1}), {
    sweep: {kind: 'linear', origin: S.uv(l4[2] + 9, laneY[3] + 4), direction: [0, -1], speed: 0.35, jitterS: 0.02, tintFollowsWave: true},
  });

  // ---------------------------------------------------------------- camera
  b.move(s.start - 0.4, 1.4, P3);
  b.move(s.start + 1.0, s.end - s.start - 1.6, pushIn(P3, 0.05), 'inOutSine');

  // ---------------------------------------------------------------- labels
  const out = s.end - 0.6;
  const lab = (text: string, X: number, Y: number, a: number, e: number = out, extra: Partial<WallText> = {}): WallText => ({text, X, Y, h: 0.18, at: a, exitAt: e, ...extra});
  const titles: WallText[] = [
    ['no authorization', s.c1 - 0.3],
    ['missing audit', s.c2 - 0.3],
    ['destructive tool', s.c3 - 0.3],
    ['slow-roll exfiltration', sends[0] - 0.2],
  ].map(([text, a], k) => ({text: text as string, X: x0 - 3, Y: laneY[k], h: 0, at: a as number, exitAt: out, align: 'right', color: color.text.chipDim}));

  const labels: WallText[] = [
    // lane 1
    lab(xfer.text, l1Before[0] + xfer.w / 2, laneY[0], s.c1 - 0.3, s.slid - 0.05),
    lab(xfer.text, l1After[1] + xfer.w / 2, laneY[0], s.slid + 0.15),
    lab(auth.text, l1After[0] + auth.w / 2, laneY[0], s.slid + 0.1, out, {color: '#062A20'}),
    lab('insert[authorize] + allow · cost 1.0', l1After[1] + xfer.w, laneY[0] - 5.4, s.slid + 0.6, out, {h: 0, align: 'right', color: color.accent.mintLabel}),
    lab('precedence(authorize < transfer)', l1After[1] + xfer.w / 2, laneY[0] + 5.2, precAt - 0.1, out, {h: 0.1, color: color.text.caption}),
    // lane 2
    ...[read, proc, proc, proc].map((sl, k) => lab(sl.text, l2[k] + sl.w / 2, laneY[1], steps2[k] - 0.05)),
    ...['3', '2', '1'].map((n, k) => lab(n, l2[k + 1] + proc.w / 2, laneY[1] + 5.0, steps2[k + 1] + 0.05, auditAt + 0.6, {h: 0, mono: false, weight: 700, sizeH: 0.03, color: color.text.chipDim})),
    lab(resp.text, l2[4] + resp.w / 2, laneY[1], respAt - 0.05, auditAt - 0.05),
    lab('0 · deadline', l2[4] + resp.w / 2, laneY[1] + 5.0, respAt + 0.05, auditAt + 0.6, {h: 0, color: color.text.chipDim}),
    lab(resp.text, l2[5] + resp.w / 2, laneY[1], auditAt + 0.15),
    lab(audit.text, l2[4] + audit.w / 2, laneY[1], auditAt + 0.1, out, {color: '#062A20'}),
    lab('insert[audit_log] + allow · cost 1.0', l2[5] + resp.w, laneY[1] - 5.4, auditAt + 0.6, out, {h: 0, align: 'right', color: color.accent.mintLabel}),
    // lane 3
    lab(del.text, l3[0] + del.w / 2, laneY[2], s.c3 - 0.15, s.archive - 0.05),
    lab('archive()', l3[0] + W(9) / 2, laneY[2], s.archive + 0.12, out, {color: '#062A20'}),
    lab('substitute · cost 3.0', l3[0] + del.w + 3, laneY[2], s.archive + 0.5, out, {h: 0, align: 'left', color: color.accent.mintLabel}),
    // lane 4
    ...sends.map((t, k) => lab(send.text, l4[k] + send.w / 2, laneY[3], t - 0.05, k === 2 ? noopAt - 0.05 : out)),
    lab('noop()', l4[2] + 1 + W(6) / 2, laneY[3] - 0.2, noopAt + 0.25, out, {color: color.text.caption}),
    lab('suppress · cost 5.0', l4[2] + send.w + 3, laneY[3], noopAt + 0.5, out, {h: 0, align: 'left', color: color.accent.mintLabel}),
    lab('count_le(export, 2, 50)', l4[2] + send.w / 2, laneY[3] + 5.0, send3 + 0.05, out, {h: 0.1, color: color.text.caption}),
  ];

  // after the narration: each case was sealed into its own certificate (Merkle roots from the file)
  const showSeal = sealAt < s.end - 2;

  const cites: CiteSpec[] = [
    {repo: R, path: 'results/case_studies.json', line: '65-91', at: s.c1 + 0.3, exitAt: s.c2 - 0.1, slot: 0},
    {repo: R, path: 'results/case_studies.json', line: '2-64', at: s.c2 + 0.3, exitAt: s.c3 - 0.1, slot: 0},
    {repo: R, path: 'reinskit/ltl.py', line: '247-262', at: s.deadline, exitAt: s.c3 - 0.1, slot: 1},
    {repo: R, path: 'results/case_studies.json', line: '92-118', at: s.c3 + 0.2, exitAt: s.third - 0.1, slot: 0},
    {repo: R, path: 'results/case_studies.json', line: '119-162', at: s.third + 0.1, exitAt: s.end - 0.6, slot: 0},
  ];

  b.overlay('s3', s.start - 0.6, s.end + 0.1, (t) => (
    <>
      <PathKicker t={t} at={s.c1 - 0.3} exitAt={out} text="reins/results/case_studies.json · four case studies, as recorded" y={Math.round(0.072 * b.H)} />
      <WallLabels t={t} lens={b.lens} items={[...titles, ...labels]} />
      {showSeal ? <Tag t={t} at={sealAt} exitAt={out} text="each case sealed into its certificate · merkle efc088e4… a0440f6b… c23c64f8… ac254353…" x={Math.round(0.07 * b.W)} y={Math.round(0.125 * b.H)} /> : null}
      <Cites t={t} items={cites} />
    </>
  ));

  b.cue(s.c1 - 0.2, 'reading', 'Read results/case_studies.json');

  return {P3, laneY, x0};
};
