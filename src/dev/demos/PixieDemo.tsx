import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoSpec} from '../types';
import {color, font, layout} from '../../engine/tokens';
import {
  PIXIE_STATES,
  Pixie,
  PixieCard,
  PixieGuide,
  pixieField,
  resolveTimeline,
  type Facing,
  type PixieCue,
  type PixiePinSample,
  type PixiePreset,
  type PixieState,
} from '../../pixie';

// ---------------------------------------------------------------- the film beat
// One cue list for the whole demo, as the film will have: the 2D guide and the
// pin-wall Pixie read the same resolved timeline.
const FPS = 60;
const ENTER = 6; // squares appear; Pixie lands 1.2 s later (frame 78) and idles for a beat
const CARD_IN = 94; // the card arrives with the first action
const CARD_OUT = 585;
const WALK = {fromX: 0, toX: -6, startFrame: 594}; // 4 cells/s, arrives on 684
const DISPERSE = 690; // squares gone by 738
const PINS_IN = 708; // pins rise from the bottom of Pixie's box, about 0.85 s
const PINS_CARD_IN = 744;
const DURATION = 900;

const CUES: PixieCue[] = [
  {frame: CARD_IN, activity: 'reading', detail: 'Read glassbox-lm/README.md'},
  {frame: 170, activity: 'searching', detail: 'Search "clauses"'},
  {frame: 246, activity: 'running', detail: 'Run 5 seeds'},
  {frame: 318, activity: 'success', detail: 'F1 0.827 at 107 µs'},
  {frame: 408, activity: 'error', detail: 'About 27 points lost on counterfactual IMDb'},
  {frame: 498, activity: 'waiting', detail: 'Your turn'},
  {frame: 591, activity: 'idle', detail: ''},
  {frame: PINS_IN, activity: 'debugging', detail: 'Run npm test'},
  {frame: 816, activity: 'success', detail: '2 tests pass'},
];

// ---------------------------------------------------------------- pin board
// A stand-in for the pin wall: the film's hex lattice (identity d.1) drawn as
// dots under a soft key-light pool, with Pixie sampled by pixieField at each pin.
const COLS = 171;
const PINS_PER_CELL = 3;
const PIXIE_CENTER: [number, number] = [0.655, 0.5];
const PIXIE_RELIEF = 0.2;

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const toSrgb8 = (c: number) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
const toLinear = (c8: number) => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

interface Lattice {
  n: number;
  p: number; // pitch, px
  extH: number; // board height in board widths
  X: Float32Array;
  Y: Float32Array;
  U: Float64Array;
  V: Float64Array;
  light: Float32Array; // key-light pool, 0..1
}

function lattice(W: number, H: number): Lattice {
  const pu = 1 / COLS;
  const rowH = (pu * Math.sqrt(3)) / 2;
  const rows = Math.max(2, Math.round((H / W - pu) / rowH) + 1);
  const extH = (rows - 1) * rowH + pu;
  const n = rows * COLS - Math.floor(rows / 2);
  const L: Lattice = {
    n,
    p: pu * W,
    extH,
    X: new Float32Array(n),
    Y: new Float32Array(n),
    U: new Float64Array(n),
    V: new Float64Array(n),
    light: new Float32Array(n),
  };
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const odd = r % 2;
    const cols = odd ? COLS - 1 : COLS;
    for (let c = 0; c < cols; c++, i++) {
      const x = -0.5 + pu / 2 + c * pu + (odd ? pu / 2 : 0);
      const y = -((rows - 1) * rowH) / 2 + r * rowH;
      L.U[i] = x + 0.5;
      L.V[i] = (y + extH / 2) / extH;
      L.X[i] = (x + 0.5) * W;
      L.Y[i] = H / 2 - y * W;
      const dx = (L.X[i] / W - 0.55) / 0.42;
      const dy = (L.Y[i] / H - 0.45) / 0.55;
      L.light[i] = Math.exp(-(dx * dx + dy * dy));
    }
  }
  return L;
}

const STEEL_DARK = hex('#101312');
const STEEL_LIT = hex('#2B2F2E');
const HI_DARK = hex('#161A19');
const HI_LIT = hex('#3E4342');
// Steel at Pixie's position: what translucent rects (the shadow) composite over.
const steelAt = (light: number) => mix(STEEL_DARK, STEEL_LIT, light);

const PinBoard: React.FC<{lat: Lattice}> = ({lat}) => {
  const {width: W, height: H} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const g = ctx.createRadialGradient(0.55 * W, 0.45 * H, 0, 0.55 * W, 0.45 * H, 0.78 * W);
    g.addColorStop(0, '#131716');
    g.addColorStop(0.55, '#0B0E0D');
    g.addColorStop(1, color.wall.void);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Batch by quantised light level: one path per level for heads, one for highlights.
    const LEVELS = 24;
    const heads: Path2D[] = Array.from({length: LEVELS}, () => new Path2D());
    const highs: Path2D[] = Array.from({length: LEVELS}, () => new Path2D());
    const r = lat.p * 0.38;
    for (let i = 0; i < lat.n; i++) {
      const q = Math.min(LEVELS - 1, Math.floor(lat.light[i] * LEVELS));
      const x = lat.X[i];
      const y = lat.Y[i];
      heads[q].moveTo(x + r, y);
      heads[q].arc(x, y, r, 0, Math.PI * 2);
      highs[q].moveTo(x - r * 0.3 + r * 0.42, y - r * 0.32);
      highs[q].arc(x - r * 0.3, y - r * 0.32, r * 0.42, 0, Math.PI * 2);
    }
    for (let q = 0; q < LEVELS; q++) {
      const t = (q + 0.5) / LEVELS;
      ctx.fillStyle = rgb(mix(STEEL_DARK, STEEL_LIT, t));
      ctx.fill(heads[q]);
      ctx.fillStyle = rgb(mix(HI_DARK, HI_LIT, t));
      ctx.fill(highs[q]);
    }
  }, [W, H, lat]);
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0, width: W, height: H}} />;
};

interface PinDots {
  count: number;
  raised: number;
  X: number[];
  Y: number[];
  R: number[];
  fill: string[];
  hi: string[];
}

/** Samples Pixie at every pin for film time t (pure; drawn by PixieDots). */
function samplePins(lat: Lattice, field: ReturnType<typeof pixieField>, t: number): PinDots {
  const out: PinDots = {count: 0, raised: 0, X: [], Y: [], R: [], fill: [], hi: []};
  const [u0, v0, u1, v1] = field.bounds;
  for (let i = 0; i < lat.n; i++) {
    const u = lat.U[i];
    const v = lat.V[i];
    if (u < u0 || u > u1 || v < v0 || v > v1) continue;
    const s = field(u, v, i, t) as PixiePinSample | null;
    if (!s) continue;
    out.count++;
    if (s.h > 0) out.raised++;
    const c = s.tint.map(toSrgb8);
    out.X.push(lat.X[i]);
    out.Y.push(lat.Y[i]);
    // Raised pins read slightly larger, as they would face the lens.
    out.R.push(lat.p * 0.38 * (1 + 0.1 * (s.h / PIXIE_RELIEF)));
    out.fill.push(rgb(c));
    out.hi.push(rgb(mix(c, [255, 255, 255], 0.22 * s.alpha)));
  }
  return out;
}

const PixieDots: React.FC<{dots: PinDots; p: number}> = ({dots, p}) => {
  const {width: W, height: H} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const heads = new Map<string, Path2D>();
    const highs = new Map<string, Path2D>();
    const bg = new Path2D();
    for (let k = 0; k < dots.X.length; k++) {
      const x = dots.X[k];
      const y = dots.Y[k];
      const r = dots.R[k];
      // Cover the steel dot underneath so its antialiased rim never shows.
      bg.moveTo(x + p * 0.42, y);
      bg.arc(x, y, p * 0.42, 0, Math.PI * 2);
      let h = heads.get(dots.fill[k]);
      if (!h) heads.set(dots.fill[k], (h = new Path2D()));
      h.moveTo(x + r, y);
      h.arc(x, y, r, 0, Math.PI * 2);
      let g = highs.get(dots.hi[k]);
      if (!g) highs.set(dots.hi[k], (g = new Path2D()));
      g.moveTo(x - r * 0.3 + r * 0.42, y - r * 0.32);
      g.arc(x - r * 0.3, y - r * 0.32, r * 0.42, 0, Math.PI * 2);
    }
    ctx.fillStyle = '#0B0E0D';
    ctx.fill(bg);
    for (const [c, path] of heads) {
      ctx.fillStyle = c;
      ctx.fill(path);
    }
    for (const [c, path] of highs) {
      ctx.fillStyle = c;
      ctx.fill(path);
    }
  }, [dots, p, W, H]);
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0, width: W, height: H}} />;
};

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Per-pin jitter from the pin's own position (deterministic, no state).
const pinHash = (u: number, v: number) => {
  const x = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const FilmBeat: React.FC = () => {
  const frame = useCurrentFrame();
  const {width: W, height: H, fps} = useVideoConfig();
  const timeline = useMemo(() => resolveTimeline(CUES, fps), [fps]);
  const lat = useMemo(() => lattice(W, H), [W, H]);
  const field = useMemo(() => {
    const cellU = PINS_PER_CELL / COLS;
    // Steel under Pixie's centre, in the linear space the wall's instance tint uses.
    const st = steelAt(0.92).map(toLinear) as [number, number, number];
    // The reveal is the field's own per-pin presence: a wave rising from the bottom
    // of Pixie's box, with a little jitter, each pin easing in over 0.3 s.
    const cellV = cellU / lat.extH;
    const vMin = PIXIE_CENTER[1] - 16 * cellV;
    const t0 = PINS_IN / fps;
    return pixieField({
      fps,
      timeline,
      cell: cellU,
      boardAspect: lat.extH,
      center: PIXIE_CENTER,
      relief: PIXIE_RELIEF,
      steel: st,
      presence: (t, u, v) => smooth((t - t0 - 0.5 * ((v - vMin) / (32 * cellV)) - 0.06 * pinHash(u, v)) / 0.3),
    });
  }, [fps, timeline, lat]);
  const t = frame / fps;
  const dots = useMemo(() => (frame >= PINS_IN ? samplePins(lat, field, t) : null), [frame, lat, field, t]);

  // Featured guide, centred as a group: creature, gap, card.
  const boxX = Math.round(W * 0.099);
  const margin = Math.round(layout.marginLeftW * W);
  // Pin Pixie's head centre on screen (scene row 13.5), for the card beside it.
  const cellPx = (PINS_PER_CELL / COLS) * W;
  const pinHeadY = Math.round(H / 2 - (16 - 13.5) * cellPx);
  const monoLabel: React.CSSProperties = {
    position: 'absolute',
    left: margin,
    top: Math.round(0.885 * H),
    fontFamily: font.mono,
    fontWeight: 500,
    fontSize: Math.round(0.02 * H),
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: color.text.secondary,
    whiteSpace: 'pre',
    fontVariantLigatures: 'none',
    opacity: smooth((frame - PINS_CARD_IN) / 20),
  };
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <PinBoard lat={lat} />
      {dots ? <PixieDots dots={dots} p={lat.p} /> : null}
      <PixieGuide
        preset="featured"
        timeline={timeline}
        x={boxX}
        enterAt={ENTER}
        cardEnterAt={CARD_IN}
        cardExitAt={CARD_OUT}
        exitAt={DISPERSE - Math.round(0.12 * fps)}
        exitDuration={0.8}
        walk={WALK}
      />
      {frame >= PINS_CARD_IN ? (
        <>
          <PixieCard timeline={timeline} preset="hero" align="left" x={margin} y={pinHeadY} enterAt={PINS_CARD_IN} />
          {dots ? (
            <div style={monoLabel}>
              {`pixieField · ${PINS_PER_CELL} pins per cell · ${dots.count.toLocaleString('en-US')} pins covered · ${dots.raised.toLocaleString('en-US')} raised`}
            </div>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- checks
// mode "u10": every state at u = 10, t = 0, on a transparent page, tiled
// 360 x 340 from (20, 20). scripts/pixie/compare-still.ts diffs the tiles
// against research/pixie-golden/u10/<state>.png.
const U10: React.FC<{facing?: Facing}> = ({facing}) => (
  <AbsoluteFill>
    {PIXIE_STATES.map((s, k) => (
      <div key={s} style={{position: 'absolute', left: 20 + (k % 4) * 360, top: 20 + Math.floor(k / 4) * 340}}>
        <Pixie state={s} cell={10} frame={0} facing={facing} />
      </div>
    ))}
  </AbsoluteFill>
);

// mode "states": every state, live, at a given cell size on the ground.
const States: React.FC<{cell: number; facing?: Facing}> = ({cell, facing}) => {
  const {width: W} = useVideoConfig();
  const cols = Math.max(1, Math.floor((W - 40) / (34 * cell + 20)));
  return (
    <AbsoluteFill style={{backgroundColor: '#121615'}}>
      {PIXIE_STATES.map((s, k) => (
        <div key={s} style={{position: 'absolute', left: 20 + (k % cols) * (34 * cell + 20), top: 20 + Math.floor(k / cols) * (32 * cell + 20)}}>
          <Pixie state={s} cell={cell} facing={facing} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

// mode "preset": one layout preset with guides, cycling the states.
const PresetCheck: React.FC<{preset: PixiePreset; side?: 'left' | 'right'; state?: PixieState; detail?: string; facing?: Facing; debug?: boolean}> = (p) => {
  const {width: W, height: H} = useVideoConfig();
  const lat = useMemo(() => lattice(W, H), [W, H]);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <PinBoard lat={lat} />
      <PixieGuide preset={p.preset} side={p.side} state={p.state ?? 'waiting'} detail={p.detail ?? 'Your turn'} facing={p.facing} debug={p.debug} />
      {p.debug ? (
        <div style={{position: 'absolute', left: Math.round(layout.marginLeftW * W), top: 0, bottom: 0, width: 1, background: 'rgba(240,138,112,0.35)'}} />
      ) : null}
    </AbsoluteFill>
  );
};

type DemoProps = {
  mode?: 'film' | 'u10' | 'states' | 'preset';
  preset?: PixiePreset;
  side?: 'left' | 'right';
  state?: PixieState;
  detail?: string;
  facing?: Facing;
  cell?: number;
  debug?: boolean;
};

const PixieDemo: React.FC<DemoProps> = (props) => {
  switch (props.mode ?? 'film') {
    case 'u10':
      return <U10 facing={props.facing} />;
    case 'states':
      return <States cell={props.cell ?? 12} facing={props.facing} />;
    case 'preset':
      return <PresetCheck preset={props.preset ?? 'guide'} side={props.side} state={props.state} detail={props.detail} facing={props.facing} debug={props.debug} />;
    default:
      return <FilmBeat />;
  }
};

export const demo: DemoSpec = {
  id: 'PixieDemo',
  component: PixieDemo,
  durationInFrames: DURATION,
  fps: FPS,
  defaultProps: {mode: 'film'},
};
