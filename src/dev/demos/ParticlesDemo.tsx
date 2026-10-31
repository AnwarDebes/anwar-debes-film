import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import type {DemoSpec} from '../types';
import {PostFX, REEL_LOOK} from '../../engine/PostFX';
import {color, font, layout as layoutTokens, type as typeTokens} from '../../engine/tokens';
import {
  Constellation,
  ConstellationLabels,
  Dust,
  FlightRig,
  FxStudio,
  GlassBox,
  GodRays,
  Mist,
  PinCluster,
  REPOS,
  Sparks,
  compileFlight,
  constellationLayout,
  flightLensAt,
  flightPoseAt,
  flightStateAt,
  glassCells,
  hexLattice,
  type ClaritySweep,
  type ClusterPin,
  type FlightKey,
  type SparkSource,
  type StreamCurve,
} from '../../engine/fx';

// The fx in one continuous shot: the 66-repository constellation ignites in creation order, the
// camera dives into June 2026 and glides to the present, the four glass-box projects stream into a
// black box past the end of time, and the box clears cell by cell into glass with the light pouring
// through its literals.

const FPS = 60;
const DURATION_S = 12;

// beats, seconds
const T = {
  revealFrom: 0.3,
  revealTo: 1.9,
  dive: 2.6,
  core: 5.0,
  highlight: 5.4,
  toBox: 5.9,
  lightUp: 7.6,
  arrive: 8.4,
  clear: 9.0,
  inside: 9.6,
  statement: 10.5,
};

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const L = constellationLayout();
// past the present, just outside the wide shot
const BOX: V3 = add(L.now, [1.15, -0.05, 0]);
const BOX_SIZE = 0.34;
const HALF = BOX_SIZE / 2;
const WALL = 0.022;
const WALL_OBJ = WALL * BOX_SIZE;

// one continuous flight: the whole history, a dive into June 2026, a glide to the present, and out
// to the box, where the camera settles and pushes in slowly
const FLIGHT: FlightKey[] = [
  {at: 0, position: [-1.3, 0.8, 7.4], target: [-0.1, -0.05, 0], fov: 26, aperture: 0.014},
  {at: T.dive, position: [-1.05, 0.72, 6.5], target: [0, -0.04, 0]},
  {at: T.core, position: [0.1, 0.28, 1.42], target: [0.84, 0.04, 0], aperture: 0.022},
  {at: 6.6, position: [1.35, 0.72, 1.3], target: [2.05, 0.55, 0]},
  {at: T.arrive, position: add(BOX, [0.62, 0.22, 1.55]), target: add(BOX, [-0.16, 0, 0]), fov: 24, focus: BOX, aperture: 0.012, hold: true},
  {at: DURATION_S, position: add(BOX, [0.58, 0.205, 1.45]), target: add(BOX, [-0.155, 0, 0]), focus: BOX},
];

// the light sits behind the box on the line of sight: a corona round the black box, then shafts
// through its literals once the walls clear
const LIGHT: V3 = add(BOX, [-0.51, -0.06, -1.27]);

const GLASS_FOUR = new Set(['glassbox-lm', 'trace', 'veritas', 'candor']);
const highlight = (id: string, t: number) => (GLASS_FOUR.has(id) ? interpolate(t, [T.highlight, T.highlight + 0.7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0);

const reveal = {from: T.revealFrom, to: T.revealTo, linkDrawS: 0.6};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (t: number, a: number, b: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

// the four glass-box repos stream into the black box
const intoBox: StreamCurve[] = [...GLASS_FOUR].map((id, k) => {
  const n = L.byId.get(id)!;
  const end: V3 = add(BOX, [-0.02 + 0.015 * k, 0.03 - 0.02 * k, 0.0]);
  return {
    curve: {kind: 'arc', from: n.position, to: end, bend: [0.05 * (k - 1.5), 0.12 + 0.04 * k, 0.24]},
    from: T.toBox + 0.12 * k,
    to: T.clear + 0.9,
    drawOnS: 1.2,
    fadeS: 0.8,
    speed: 0.85,
    every: 0.3,
    packetLength: 0.12,
    trickle: 0.3,
    radius: 0.004,
    intensity: 2.4,
    bloom: 0.9,
    line: {width: 1.3, intensity: 0.4, color: color.accent.mintLabel},
  };
});

// inside the box: a hex field of literals on the back wall, lit from behind. True literals stand
// raised and bright, false ones sit low and dark; a few true ones glow, and one is the answer.
const PITCH = 0.04;
const lattice = hexLattice(7, 8, PITCH);
// the answer: left of the light, so it reads against the dark field rather than the glare
const ANSWER = 28;
const literal = lattice.map((_, i) => {
  const r = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
  return {isTrue: i === ANSWER || r > 0.42, lit: i === ANSWER || r > 0.8};
});
const BASE_Z = -HALF + WALL_OBJ + 0.004;
const rise = (i: number) => (t: number) => ramp(t, T.inside - 0.3 + (i % 9) * 0.05, T.inside + 0.7 + (i % 9) * 0.05);
const innerPins: ClusterPin[] = lattice.map((p, i) => {
  const {isTrue, lit} = literal[i];
  const answer = i === ANSWER;
  const r = rise(i);
  return {
    position: [p[0], p[1], BASE_Z],
    height: answer ? (t: number) => 0.045 + 0.075 * r(t) : isTrue ? 0.045 : 0.012,
    tint: isTrue ? 0.95 : 0.3,
    // the answer burns hot (it blooms); the other lit literals only glow
    glow: lit ? (t: number) => (answer ? 2.4 : 0.32) * r(t) : 0,
  };
});
const LITERALS = innerPins.length;
const TRUE_LITERALS = literal.filter((l) => l.isTrue).length;
const innerSparkSources: SparkSource[] = innerPins
  .map((p, i) => ({p, i}))
  .filter(({i}) => literal[i].lit)
  .map(({p, i}) => ({
    position: [p.position[0], p.position[1], BASE_Z + (i === ANSWER ? 0.12 : 0.045) + 0.01],
    from: T.inside + 0.4,
    weight: i === ANSWER ? 1 : 0.45,
  }));

const SWEEP: ClaritySweep = {at: T.clear, origin: [0.05, 0.04, HALF], speed: 0.34, jitter: 0.26, cellDur: 0.3};
const CELLS = 8;
const cellSparks: SparkSource[] = glassCells([HALF, HALF, HALF], CELLS, SWEEP).map((c) => ({
  position: c.position,
  from: c.flipAt + 0.06,
  direction: c.normal,
}));

const boxRotation = (t: number): V3 => [0.34, 0.66 + 0.045 * (t - 8), 0];

const years = REPOS.map((r) => +r.created.slice(0, 4));
const SPAN = `${Math.min(...years)} → ${Math.max(...years)}`;

// ---------------------------------------------------------------- HTML layer

const pull = (t: number, from: number, to: number) => {
  const a = interpolate(t, [from, from + 0.35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.33, 1, 0.68, 1)});
  const b = interpolate(t, [to - 0.3, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.32, 0, 0.67, 0)});
  return Math.min(a, b);
};

const Kicker: React.FC<{t: number; from: number; to: number; children: React.ReactNode}> = ({t, from, to, children}) => {
  const {width, height} = useVideoConfig();
  const k = pull(t, from, to);
  if (k <= 0) return null;
  const blur = (1 - k) * 8 * (height / 1080);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(width * layoutTokens.marginLeftW),
        top: Math.round(height * 0.085),
        fontFamily: font.mono,
        fontWeight: typeTokens.monoKicker.weight,
        fontSize: Math.round(height * typeTokens.monoKicker.size),
        letterSpacing: `${typeTokens.monoKicker.tracking}em`,
        textTransform: 'uppercase',
        color: color.accent.mintLabel,
        whiteSpace: 'nowrap',
        opacity: k,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        textShadow: `0 0 ${Math.round(height * 0.01)}px rgba(5,8,7,0.9)`,
      }}
    >
      {children}
    </div>
  );
};

const Statement: React.FC<{t: number}> = ({t}) => {
  const {width, height} = useVideoConfig();
  const k = pull(t, T.statement, DURATION_S + 1);
  if (k <= 0) return null;
  const size = Math.round(height * typeTokens.tagline.size);
  const blur = (1 - k) * 8 * (height / 1080);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(width * layoutTokens.marginLeftW),
        top: Math.round(height * 0.62),
        width: Math.round(width * 0.34),
        fontFamily: font.sans,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: `${typeTokens.tagline.tracking}em`,
        color: color.text.display,
        opacity: k,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        textShadow: `0 0 ${Math.round(height * 0.012)}px rgba(5,8,7,0.9)`,
      }}
    >
      From a black box
      <br />
      to a{' '}
      <span style={{fontFamily: font.serif, fontStyle: 'italic', fontWeight: 400, fontSize: Math.round(size * font.emScale), color: color.accent.mint, letterSpacing: '-0.01em'}}>
        glass box.
      </span>
    </div>
  );
};

// repo labels keep clear of the kicker
const KICKER_ZONE = [[0, 0, 0.5, 0.125]] as const;

const canvasGl = {antialias: false, powerPreference: 'high-performance' as const, stencil: false, alpha: false};
const dprFor = () => (typeof window === 'undefined' ? 1 : Math.min(1, window.devicePixelRatio || 1));

const flightTrack = compileFlight(FLIGHT);
const poseAt = (t: number) => flightPoseAt(FLIGHT, t);
const lensAt = (t: number) => flightLensAt(flightTrack, t, flightStateAt(flightTrack, t));
// the fly-through is all sprites, which streak with the camera themselves: one render per frame
// there; the box gets real sub-frames
const motionScale = (t: number) => ramp(t, 7.0, 7.4);

// a broad soft light for the corona round the black box; as the walls clear it gathers into a
// compact source behind the literals, so the shafts are cut by the pins instead of washing the frame
const opened = (t: number) => ramp(t, T.clear + 0.2, T.clear + 1.7);
const lightRadius = (t: number) => 0.32 - 0.2 * opened(t);
const lightIntensity = (t: number) => 0.9 * ramp(t, T.lightUp, T.lightUp + 1.0) * (1 - 0.25 * opened(t));
const raysStrength = (t: number) => 0.7 - 0.15 * opened(t);

const ParticlesDemo: React.FC<{debug?: boolean; glassDebug?: number}> = ({debug = false, glassDebug = 0}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = frame / FPS;

  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={dprFor()} camera={{fov: 26, near: 0.02, far: 80, position: [0, 0, 3]}}>
        <FxStudio t={t} env={1.6} rim={{position: LIGHT, target: BOX, intensity: (tt) => 0.5 + 2.4 * ramp(tt, T.lightUp, T.clear + 1.2)}} />
        <FlightRig keys={FLIGHT} motionScale={motionScale} />
        <Mist intensity={(tt) => 0.25 + 0.75 * ramp(tt, 0, 0.9)} scatter={0.14} />
        <Dust count={1100} box={[2.4, 1.6, 3.2]} ahead={1.6} brightness={0.34} bokeh={0.9} maxBlur={0.022} shaftGain={2.2} opacity={(tt) => ramp(tt, 0.1, 1.2)} />
        <Constellation reveal={reveal} highlight={highlight} extraStreams={intoBox} nodeIntensity={1.7} opacity={(tt) => 1 - 0.55 * ramp(tt, 7.0, 8.6)} />
        <GodRays light={{position: LIGHT, radius: lightRadius, color: color.text.display, intensity: lightIntensity}} glow={false} strength={raysStrength} length={0.86} decay={0.952} bloom={0.05} />
        <GlassBox size={BOX_SIZE} wall={WALL} position={BOX} rotation={boxRotation} clarity={SWEEP} cells={CELLS} flash={2.0} debugView={glassDebug}>
          <PinCluster pins={innerPins} pitch={PITCH * 0.72} reach={0.012} glowIntensity={1.5} />
          <Sparks sources={innerSparkSources} count={260} life={[1.1, 2.3]} direction={[0, 0, 1]} speed={0.035} spread={0.5} rise={[0, 0.03, 0]} drag={1.6} flutter={0.004} size={[0.0011, 0.0022]} intensity={2.2} />
          <Sparks sources={cellSparks} refract={false} mode="burst" burstSpread={0.12} count={cellSparks.length * 2} life={[0.4, 0.85]} speed={0.15} spread={0.55} drag={3.2} rise={[0, 0.02, 0]} flutter={0.003} size={[0.0011, 0.0019]} intensity={2.4} seed={9} />
        </GlassBox>
        <PostFX width={width} height={height} {...REEL_LOOK} focusDistance={0} motionBlur={{maxSamples: 6}} debug={debug} />
      </ThreeCanvas>
      <AbsoluteFill>
        <ConstellationLabels poseAt={poseAt} lensAt={lensAt} reveal={reveal} highlight={highlight} avoid={KICKER_ZONE} opacity={(tt) => 1 - ramp(tt, 6.4, 7.2)} />
        <Kicker t={t} from={0.7} to={T.lightUp - 0.4}>
          {`${L.nodes.length} repositories · ${SPAN}`}
        </Kicker>
        <Kicker t={t} from={T.lightUp - 0.1} to={T.clear + 0.15}>
          The black box
        </Kicker>
        <Kicker t={t} from={T.clear + 0.35} to={DURATION_S + 1}>
          {`The glass box · ${LITERALS} literals, ${TRUE_LITERALS} true`}
        </Kicker>
        <Statement t={t} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {
  id: 'ParticlesDemo',
  component: ParticlesDemo,
  durationInFrames: DURATION_S * FPS,
  fps: FPS,
  defaultProps: {debug: false},
};
