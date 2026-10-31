// The pin wall's own motion, turned into sound data: for one compiled beat, every pin that moves
// is binned by its release time, with its position and how far it travels. pin_brush (sfx_synth)
// places a grain per pin from these bins, so pitch follows the row, pan follows the column and
// loudness follows how many pins move. The sound is the data, as the picture is.
//
// Imports only the pure pin modules (no React/three), so Node scripts can call it.

import type {WallTimeline} from '../pins/timeline';
import type {PinHist, SfxCue} from './types';

export interface PinSoundOptions {
  /** bin width, seconds (default 5 ms) */
  binS?: number;
  /** ignore pins that move less than this fraction of the relief (default 0.02) */
  minDh?: number;
  /** add to the wall's composition time to get film time (default 0) */
  offsetS?: number;
}

export interface PinBeatSound {
  /** film time of the first released pin */
  startS: number;
  endS: number;
  moved: number;
  hist: PinHist;
}

const r4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/** Binned motion of the pins a beat moves; null when it moves none. */
export const pinBeatHist = (tl: WallTimeline, beatId: string, o: PinSoundOptions = {}): PinBeatSound | null => {
  const k = tl.beats.findIndex((b) => b.id === beatId);
  if (k < 0) throw new Error(`no beat '${beatId}' in this wall`);
  const b = tl.beats[k];
  const prev = k > 0 ? tl.beats[k - 1] : tl.init;
  const {u, v, N} = tl.board;
  const binS = o.binS ?? 0.005;
  const minDh = o.minDh ?? 0.02;
  let t0 = Infinity;
  let t1 = -Infinity;
  let moved = 0;
  for (let i = 0; i < N; i++) {
    if (Math.abs(b.T[i] - prev.T[i]) / tl.relief < minDh) continue;
    moved++;
    if (b.R[i] < t0) t0 = b.R[i];
    if (b.R[i] > t1) t1 = b.R[i];
  }
  if (!moved) return null;
  const nb = Math.floor((t1 - t0) / binS) + 1;
  const n = new Float64Array(nb);
  const e = new Float64Array(nb);
  const su = new Float64Array(nb);
  const sv = new Float64Array(nb);
  const suu = new Float64Array(nb);
  const svv = new Float64Array(nb);
  for (let i = 0; i < N; i++) {
    const dh = Math.abs(b.T[i] - prev.T[i]) / tl.relief;
    if (dh < minDh) continue;
    const j = Math.min(nb - 1, Math.floor((b.R[i] - t0) / binS));
    const w2 = Math.min(dh, 1.35);
    n[j] += 1;
    e[j] += w2;
    su[j] += u[i];
    sv[j] += v[i];
    suu[j] += u[i] * u[i];
    svv[j] += v[i] * v[i];
  }
  const hist: PinHist = {binS, n: [], e: [], u: [], v: [], us: [], vs: []};
  for (let j = 0; j < nb; j++) {
    const c = n[j];
    const mu = c ? su[j] / c : 0.5;
    const mv = c ? sv[j] / c : 0.5;
    hist.n.push(c);
    hist.e.push(r4(e[j]));
    hist.u.push(r4(mu));
    hist.v.push(r4(mv));
    hist.us.push(r4(c ? Math.sqrt(Math.max(0, suu[j] / c - mu * mu)) + 0.02 : 0.08));
    hist.vs.push(r4(c ? Math.sqrt(Math.max(0, svv[j] / c - mv * mv)) + 0.02 : 0.12));
  }
  const off = o.offsetS ?? 0;
  return {startS: t0 + off, endS: t1 + off, moved, hist};
};

/** A pin_brush cue that starts on the beat's first released pin (null when no pin moves). */
export const pinBrushCue = (
  tl: WallTimeline,
  beatId: string,
  o: PinSoundOptions & Omit<SfxCue, 'type' | 'params' | 'frame' | 'at'> = {},
): SfxCue | null => {
  const {binS, minDh, offsetS, ...rest} = o;
  const s = pinBeatHist(tl, beatId, {binS, minDh, offsetS});
  if (!s) return null;
  return {id: `pins:${beatId}`, ...rest, type: 'pin_brush', at: Math.round(s.startS * 1e4) / 1e4, align: 'start', params: {hist: s.hist}};
};
