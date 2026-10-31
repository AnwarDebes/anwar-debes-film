// Instruments for checking audio against picture: waveform lanes and level meters drawn from the
// decoded files themselves (@remotion/media-utils), plus loaders for the mix report. Everything
// here is a pure function of the frame: envelopes and per-frame levels are computed once per file,
// and meter ballistics are evaluated over past frames instead of being carried between frames.

import React, {useEffect, useId, useMemo, useState} from 'react';
import {useAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import {continueRender, delayRender, staticFile} from 'remotion';

// ---------- data ----------
export interface JsonState<T> {
  data: T | null;
  error: string | null;
}

/** A JSON file under public/, loaded before the frame is captured. Missing files resolve to an error. */
export const useStaticJson = <T,>(path: string): JsonState<T> => {
  const [handle] = useState(() => delayRender(`load ${path}`));
  const [state, setState] = useState<JsonState<T>>({data: null, error: null});
  useEffect(() => {
    let live = true;
    fetch(staticFile(path))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${path}: HTTP ${r.status}`))))
      .then((d: T) => live && setState({data: d, error: null}))
      .catch((e: unknown) => live && setState({data: null, error: String(e)}))
      .finally(() => continueRender(handle));
    return () => {
      live = false;
    };
  }, [path, handle]);
  return state;
};

/** Decoded samples of a file under public/ (48 kHz), or null while loading. */
export const useStaticAudio = (path: string): MediaUtilsAudioData | null => useAudioData(staticFile(path), {sampleRate: 48000});

// ---------- envelopes ----------
export interface Envelope {
  binS: number;
  n: number;
  /** per bin, max over channels: peak and RMS in dBFS */
  peakDb: Float32Array;
  rmsDb: Float32Array;
}

const envCache = new Map<string, Envelope>();

/** Peak and RMS envelope in fixed time bins (default 5 ms), summed over channels. Cached per file. */
export const envelopeOf = (a: MediaUtilsAudioData, binS = 0.005): Envelope => {
  const key = `${a.resultId}|${binS}`;
  const hit = envCache.get(key);
  if (hit) return hit;
  const sr = a.sampleRate;
  const hop = Math.max(1, Math.round(binS * sr));
  const len = a.channelWaveforms[0].length;
  const n = Math.ceil(len / hop);
  const peakDb = new Float32Array(n);
  const rmsDb = new Float32Array(n);
  const chans = a.channelWaveforms;
  for (let b = 0; b < n; b++) {
    const s0 = b * hop;
    const s1 = Math.min(len, s0 + hop);
    let pk = 0;
    let ss = 0;
    for (const ch of chans) {
      for (let i = s0; i < s1; i++) {
        const v = ch[i];
        const av = v < 0 ? -v : v;
        if (av > pk) pk = av;
        ss += v * v;
      }
    }
    peakDb[b] = 20 * Math.log10(pk + 1e-9);
    rmsDb[b] = 10 * Math.log10(ss / ((s1 - s0) * chans.length) + 1e-18);
  }
  const env = {binS: hop / sr, n, peakDb, rmsDb};
  if (envCache.size > 32) envCache.clear();
  envCache.set(key, env);
  return env;
};

export const useEnvelope = (a: MediaUtilsAudioData | null, binS = 0.005): Envelope | null =>
  useMemo(() => (a ? envelopeOf(a, binS) : null), [a, binS]);

// ---------- waveform lane ----------
export interface WaveLaneProps {
  env: Envelope;
  /** visible window, seconds */
  t0: number;
  t1: number;
  /** px */
  width: number;
  height: number;
  /** playhead: the part before it is drawn as played */
  t: number;
  /** dB shown, from -rangeDb (centre line) to 0 dBFS (lane edge) */
  rangeDb?: number;
  color: string;
  /** opacity of the unplayed part, relative */
  dim?: number;
  style?: React.CSSProperties;
}

const pathOf = (env: Envelope, t0: number, t1: number, width: number, height: number, rangeDb: number, src: Float32Array): string => {
  const mid = height / 2;
  const pxPerS = width / (t1 - t0);
  const b0 = Math.max(0, Math.floor(t0 / env.binS) - 1);
  const b1 = Math.min(env.n - 1, Math.ceil(t1 / env.binS) + 1);
  if (b1 <= b0) return '';
  const top: string[] = [];
  const bot: string[] = [];
  for (let b = b0; b <= b1; b++) {
    const x = ((b + 0.5) * env.binS - t0) * pxPerS;
    const k = Math.max(0, Math.min(1, (src[b] + rangeDb) / rangeDb));
    const h = Math.max(0.35, k * mid);
    top.push(`${x.toFixed(2)},${(mid - h).toFixed(2)}`);
    bot.push(`${x.toFixed(2)},${(mid + h).toFixed(2)}`);
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`;
};

/**
 * A mirrored, dB-scaled waveform for a time window: the peak outline as a veil and the RMS as the
 * body, as in a mixing console. Bins sit at their exact times, so a scrolling window never shimmers.
 */
export const WaveLane: React.FC<WaveLaneProps> = ({env, t0, t1, width, height, t, rangeDb = 54, color, dim = 0.3, style}) => {
  const peak = pathOf(env, t0, t1, width, height, rangeDb, env.peakDb);
  const rms = pathOf(env, t0, t1, width, height, rangeDb, env.rmsDb);
  const xp = Math.max(0, Math.min(width, ((t - t0) / (t1 - t0)) * width));
  const id = `wl${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', overflow: 'visible', ...style}}>
      <defs>
        <clipPath id={`${id}p`}>
          <rect x={0} y={-1} width={xp} height={height + 2} />
        </clipPath>
        <clipPath id={`${id}u`}>
          <rect x={xp} y={-1} width={Math.max(0, width - xp)} height={height + 2} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}p)`}>
        <path d={peak} fill={color} opacity={0.34} />
        <path d={rms} fill={color} opacity={0.92} />
      </g>
      <g clipPath={`url(#${id}u)`}>
        <path d={peak} fill={color} opacity={0.34 * dim} />
        <path d={rms} fill={color} opacity={0.92 * dim} />
      </g>
    </svg>
  );
};

// ---------- level meter ----------
export interface FrameLevels {
  fps: number;
  frames: number;
  /** per frame and channel (interleaved [L, R]): sample peak (linear) and mean square */
  peak: Float32Array;
  ms: Float32Array;
}

const levelCache = new Map<string, FrameLevels>();

/** Per-video-frame peak and mean square of each channel, computed once per file. */
export const frameLevelsOf = (a: MediaUtilsAudioData, fps: number): FrameLevels => {
  const key = `${a.resultId}|${fps}`;
  const hit = levelCache.get(key);
  if (hit) return hit;
  const sr = a.sampleRate;
  const len = a.channelWaveforms[0].length;
  const frames = Math.ceil((len / sr) * fps);
  const peak = new Float32Array(frames * 2);
  const ms = new Float32Array(frames * 2);
  for (let c = 0; c < 2; c++) {
    const ch = a.channelWaveforms[Math.min(c, a.channelWaveforms.length - 1)];
    for (let f = 0; f < frames; f++) {
      const s0 = Math.floor((f * sr) / fps);
      const s1 = Math.min(len, Math.floor(((f + 1) * sr) / fps));
      let pk = 0;
      let ss = 0;
      for (let i = s0; i < s1; i++) {
        const v = ch[i];
        const av = v < 0 ? -v : v;
        if (av > pk) pk = av;
        ss += v * v;
      }
      peak[f * 2 + c] = pk;
      ms[f * 2 + c] = s1 > s0 ? ss / (s1 - s0) : 0;
    }
  }
  const out = {fps, frames, peak, ms};
  if (levelCache.size > 32) levelCache.clear();
  levelCache.set(key, out);
  return out;
};

export interface MeterReading {
  /** dBFS per channel: ballistic peak (instant rise, 13 dB/s fall), held peak (1.5 s), RMS (300 ms) */
  peak: [number, number];
  hold: [number, number];
  rms: [number, number];
}

const dbOf = (v: number): number => 20 * Math.log10(v + 1e-9);

/** The meter at a frame, from the frames before it: same frame, same reading, in any render order. */
export const meterAt = (lv: FrameLevels, frame: number, fallDbPerS = 13.3, holdS = 1.5, rmsS = 0.3): MeterReading => {
  const f = Math.max(0, Math.min(lv.frames - 1, frame));
  const nHold = Math.round(holdS * lv.fps);
  const nRms = Math.max(1, Math.round(rmsS * lv.fps));
  const out: MeterReading = {peak: [-120, -120], hold: [-120, -120], rms: [-120, -120]};
  for (let c = 0; c < 2; c++) {
    let p = -120;
    let h = -120;
    for (let k = 0; k <= nHold && f - k >= 0; k++) {
      const d = dbOf(lv.peak[(f - k) * 2 + c]);
      if (d > h) h = d;
      const ball = d - (fallDbPerS * k) / lv.fps;
      if (ball > p) p = ball;
    }
    let ss = 0;
    let cnt = 0;
    for (let k = 0; k < nRms && f - k >= 0; k++) {
      ss += lv.ms[(f - k) * 2 + c];
      cnt++;
    }
    out.peak[c] = p;
    out.hold[c] = h;
    out.rms[c] = 10 * Math.log10(ss / Math.max(1, cnt) + 1e-18);
  }
  return out;
};

export interface LevelMeterProps {
  reading: MeterReading;
  /** px */
  height: number;
  barWidth: number;
  gap: number;
  /** bottom of the scale, dBFS */
  floorDb?: number;
  /** a mark on the scale, e.g. the limiter ceiling */
  markDb?: number;
  colors: {track: string; body: string; peak: string; hold: string; mark: string};
  hair: number;
}

/** Two vertical bars (L, R): RMS body, ballistic peak cap, held peak tick, optional ceiling mark. */
export const LevelMeter: React.FC<LevelMeterProps> = ({reading, height, barWidth, gap, floorDb = -54, markDb, colors, hair}) => {
  const y = (db: number) => height * (1 - Math.max(0, Math.min(1, (db - floorDb) / -floorDb)));
  const w = barWidth * 2 + gap;
  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{position: 'absolute', overflow: 'visible'}}>
      {[0, 1].map((c) => {
        const x = c * (barWidth + gap);
        const yr = y(reading.rms[c]);
        const yp = y(reading.peak[c]);
        const yh = y(reading.hold[c]);
        return (
          <g key={c}>
            <rect x={x} y={0} width={barWidth} height={height} fill={colors.track} />
            <rect x={x} y={yp} width={barWidth} height={Math.max(0, height - yp)} fill={colors.peak} opacity={0.3} />
            <rect x={x} y={yr} width={barWidth} height={Math.max(0, height - yr)} fill={colors.body} />
            {reading.hold[c] > floorDb ? <rect x={x} y={Math.round(yh - hair)} width={barWidth} height={hair * 2} fill={colors.hold} /> : null}
          </g>
        );
      })}
      {markDb !== undefined ? <rect x={-hair * 3} y={Math.round(y(markDb))} width={w + hair * 6} height={hair} fill={colors.mark} /> : null}
    </svg>
  );
};
