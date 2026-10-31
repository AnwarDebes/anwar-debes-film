// The wall at time t: settled beats + springing beats + analytic effects + live layers.
// Pure: the output depends only on t (the output arrays are scratch, never read back as state).

import type {Board} from './board';
import {applyHeightEffects, applyLiveLayers, effectsIdle, type CompiledEffects} from './effects';
import {ease1, step} from './spring';
import {MAX_H, type CompiledBeat, type PinState, type WallTimeline} from './timeline';

export class WallEvaluator {
  readonly board: Board;
  readonly h: Float32Array;
  readonly rgb: Float32Array;
  readonly glow: Float32Array;
  readonly paint: Float32Array;
  private lastStatic = -2;

  constructor(
    readonly tl: WallTimeline,
    readonly fx: CompiledEffects,
  ) {
    this.board = tl.board;
    const N = tl.board.N;
    this.h = new Float32Array(N);
    this.rgb = new Float32Array(N * 3);
    this.glow = new Float32Array(N);
    this.paint = new Float32Array(N);
  }

  /** Index of the last beat of the settled prefix at t (-1: none). */
  settledIndex(t: number): number {
    const ps = this.tl.prefixSettled;
    let e = -1;
    for (let k = 0; k < ps.length; k++) {
      if (ps[k] <= t) e = k;
      else break;
    }
    return e;
  }

  /** Index of the last beat that has started by t (-1: none). */
  startedIndex(t: number): number {
    const b = this.tl.beats;
    let e = -1;
    for (let k = 0; k < b.length; k++) {
      if (b[k].at <= t) e = k;
      else break;
    }
    return e;
  }

  /** True when nothing on the wall moves anywhere in [t0, t1]. */
  isStill(t0: number, t1: number): boolean {
    const es = this.settledIndex(t0);
    return this.startedIndex(t1) === es && effectsIdle(this.fx, t0, t1);
  }

  /**
   * Evaluate everything into h / rgb / glow / paint. Returns false when the result is identical
   * to the previous call (a settled wall with no effects), so uploads can be skipped.
   */
  evaluate(t: number): boolean {
    const {tl, board} = this;
    const beats = tl.beats;
    const es = this.settledIndex(t);
    const last = this.startedIndex(t);
    const idle = effectsIdle(this.fx, t, t);
    const still = last === es && idle;
    if (still && this.lastStatic === es) return false;
    this.lastStatic = still ? es : -2;

    const base: PinState = es >= 0 ? beats[es] : tl.init;
    this.h.set(base.T);
    this.rgb.set(base.C);
    this.glow.set(base.G);
    this.paint.set(base.P);
    for (let e = es + 1; e <= last; e++) {
      const prev = e > 0 ? beats[e - 1] : tl.init;
      this.addHeights(beats[e], prev, t, this.h);
      this.addPaint(beats[e], prev, t);
    }
    if (!idle) {
      applyHeightEffects(board, this.fx, tl.relief, t, this.h);
      applyLiveLayers(board, this.fx, tl.relief, t, this.h, this.rgb, this.glow, this.paint);
    }
    clampHeights(this.h, MAX_H * tl.relief);
    return true;
  }

  /** Heights only, into `out` (for motion estimates). Live layers are left out. */
  evaluateHeights(t: number, out: Float32Array): void {
    const {tl, board} = this;
    const beats = tl.beats;
    const es = this.settledIndex(t);
    const last = this.startedIndex(t);
    out.set(es >= 0 ? beats[es].T : tl.init.T);
    for (let e = es + 1; e <= last; e++) this.addHeights(beats[e], e > 0 ? beats[e - 1] : tl.init, t, out);
    if (!effectsIdle(this.fx, t, t)) applyHeightEffects(board, this.fx, tl.relief, t, out);
    clampHeights(out, MAX_H * tl.relief);
  }

  private addHeights(b: CompiledBeat, prev: PinState, t: number, h: Float32Array) {
    if (!b.changes.h || t <= b.rMin) return;
    const T = b.T;
    const Tp = prev.T;
    const R = b.R;
    const N = T.length;
    for (let i = 0; i < N; i++) {
      const tau = t - R[i];
      if (tau <= 0) continue;
      const d = T[i] - Tp[i];
      if (d !== 0) h[i] += d * step(tau);
    }
  }

  private addPaint(b: CompiledBeat, prev: PinState, t: number) {
    const {c, g, p} = b.changes;
    if (!c && !g && !p) return;
    const {rgb, glow, paint} = this;
    const N = b.T.length;
    if (b.PR === null) {
      const tau = t - b.at;
      if (tau <= 0) return;
      const ct = ease1(tau, b.tintTau);
      const cg = ease1(tau, b.glowTau);
      if (c) {
        const C = b.C;
        const Cp = prev.C;
        for (let j = 0; j < N * 3; j++) rgb[j] += (C[j] - Cp[j]) * ct;
      }
      if (p) {
        const P = b.P;
        const Pp = prev.P;
        for (let i = 0; i < N; i++) paint[i] += (P[i] - Pp[i]) * ct;
      }
      if (g) {
        const G = b.G;
        const Gp = prev.G;
        for (let i = 0; i < N; i++) glow[i] += (G[i] - Gp[i]) * cg;
      }
      return;
    }
    const PR = b.PR;
    const C = b.C;
    const Cp = prev.C;
    const G = b.G;
    const Gp = prev.G;
    const P = b.P;
    const Pp = prev.P;
    for (let i = 0; i < N; i++) {
      const tau = t - PR[i];
      if (tau <= 0) continue;
      if (c) {
        const ct = ease1(tau, b.tintTau);
        const j = i * 3;
        rgb[j] += (C[j] - Cp[j]) * ct;
        rgb[j + 1] += (C[j + 1] - Cp[j + 1]) * ct;
        rgb[j + 2] += (C[j + 2] - Cp[j + 2]) * ct;
        if (p) paint[i] += (P[i] - Pp[i]) * ct;
      } else if (p) {
        paint[i] += (P[i] - Pp[i]) * ease1(tau, b.tintTau);
      }
      if (g) glow[i] += (G[i] - Gp[i]) * ease1(tau, b.glowTau);
    }
  }
}

const clampHeights = (h: Float32Array, max: number) => {
  for (let i = 0; i < h.length; i++) {
    const x = h[i];
    if (x < 0) h[i] = 0;
    else if (x > max) h[i] = max;
  }
};
