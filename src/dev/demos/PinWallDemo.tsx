import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import type {DemoSpec} from '../types';
import {PostFX, REEL_LOOK, type MotionBlurOptions} from '../../engine/PostFX';
import {color, font, layout, type as typeTokens} from '../../engine/tokens';
import {
  FILM_RIPPLE,
  FILM_WALL,
  PinStudio,
  SWEEPS,
  PinWall,
  barsField,
  blackBoxField,
  booleanPortrait,
  circleField,
  compileWall,
  emblemField,
  flatField,
  makeBoard,
  noiseField,
  overField,
  pinAt,
  portraitField,
  rectField,
  releasedCount,
  ruleLineField,
  settledBeat,
  textField,
  tileGridField,
  useCanvasFont,
  usePixels,
  type Beat,
  type Board,
  type FieldFn,
  type LightKey,
  type LiveFieldFn,
  type LiveLayer,
  type Magnet,
  type Pixels,
  type Press,
  type Ripple,
} from '../../engine/pins';
import {CameraRig, apertureForBlur, dolly, frameOn, lowAnglePull, macroOn, pushIn, type CameraKey, type FocusKey} from '../../engine/camera';

const FPS = 60;
const DURATION_S = 12;

// beat times, seconds
const T = {
  lit: 0.55,
  answer: 0.85,
  portrait: 2.6,
  bools: 4.6,
  veritas: 6.3,
  trace: 7.4,
  // the hand behind the pins crosses the open wall, then taps it: a press and a ripple
  magnetFrom: 7.95,
  magnetTo: 8.8,
  tap: 8.75,
  clear: 10.15,
  rule: 10.45,
};

/** Where the hand stops and taps the wall (board uv). */
const TAP: [number, number] = [0.335, 0.445];

const SUBJECT: [number, number] = [0.58, 0.5];
const RULE_V = 0.47;

const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A counting number: tabular digits so it does not jitter, proportional commas so it does not gape. */
const Num: React.FC<{n: number}> = ({n}) => (
  <>
    {fmt(n)
      .split(/(,)/)
      .map((part, k) =>
        part === ',' ? (
          <span key={k}>,</span>
        ) : (
          <span key={k} style={{fontVariantNumeric: 'tabular-nums'}}>
            {part}
          </span>
        ),
      )}
  </>
);

interface DemoScene {
  board: Board;
  beats: Beat[];
  ripples: Ripple[];
  magnets: Magnet[];
  presses: Press[];
  camera: CameraKey[];
  focus: FocusKey[];
  light: LightKey[];
  mask: Uint8Array;
  trues: Uint8Array;
  falses: Uint8Array;
  counts: ReturnType<typeof booleanPortrait>['counts'];
  rulePins: number;
}

const buildScene = (board: Board, face: Pixels, aspect: number, blurPx = 5.5): DemoScene => {
  const relief = 22 * board.p;
  const [su, sv] = SUBJECT;
  const answer = pinAt(board, su, sv);

  // 01 the black box: a raised square of dark pins; one pin lights and slides out on its shaft
  const box = blackBoxField(board, {u: su, v: sv, size: 36, h: 0.42, tint: 0.4});
  const withAnswer = (h: number, tint: number, glow: number): FieldFn => (u, v, i) => (i === answer ? {h, tint, glow} : box(u, v, i));

  // 02-03 the portrait, then the same portrait as booleans
  const facePlace = {u: su, v: sv, height: 86};
  const portrait = portraitField(board, face, facePlace);
  const bools = booleanPortrait(board, face, facePlace);

  // 04 emblems
  const embPlace = {u: su, v: sv, height: 74};
  const veritas = emblemField(board, 'veritas', embPlace);
  const trace = emblemField(board, 'trace', embPlace);

  // 06 one rule
  const rule = ruleLineField(board, {v: RULE_V});

  const beats: Beat[] = [
    settledBeat('box', withAnswer(0.42, 0.4, 0)),
    {id: 'lit', at: T.lit, field: withAnswer(0.42, 1.0, 1)},
    {id: 'answer', at: T.answer, field: withAnswer(1.05, 1.0, 1)},
    {id: 'portrait', at: T.portrait, field: portrait, sweep: {origin: [su, sv], speed: 0.55, delayS: 0.05, jitterS: 0.08}},
    // the boolean flip: the tint runs ahead of the wave, then the heights follow
    {id: 'bools', at: T.bools, field: bools.field, sweep: {...SWEEPS.booleanFlip([0.22, 0.98]), speed: 1.1, tintLeadS: 0.22}},
    {id: 'veritas', at: T.veritas, field: veritas, sweep: SWEEPS.from([su, sv])},
    // the fast morph (motion blur takes more sub-frames here)
    {id: 'trace', at: T.trace, field: trace, sweep: SWEEPS.from([su - 0.24, sv])},
    {id: 'clear', at: T.clear, field: flatField(), sweep: {origin: [su, sv], speed: 1.1, jitterS: 0.06}},
    {
      id: 'rule',
      at: T.rule,
      field: rule,
      sweep: {...SWEEPS.raster([1, 0], 1.15, [0.07, RULE_V]), jitterS: 0.012},
    },
  ];

  // 05 the hand behind the pins crosses the open wall towards the shield, stops, and taps: a press
  // heals where it landed while a ring runs out across the wall and through the emblem
  const ease = Easing.bezier(0.45, 0, 0.55, 1);
  const start: [number, number] = [0.19, 0.335];
  const magnets: Magnet[] = [
    {
      from: T.magnetFrom,
      to: T.magnetTo,
      amp: 1.0,
      sigma: 0.032,
      path: (t) => {
        const k = ease(Math.min(1, Math.max(0, (t - T.magnetFrom) / (T.magnetTo - T.magnetFrom))));
        return [start[0] + (TAP[0] - start[0]) * k, start[1] + (TAP[1] - start[1]) * k + 0.03 * Math.sin(k * Math.PI)];
      },
    },
  ];
  const presses: Press[] = [{at: T.tap, origin: TAP, radius: 0.03, depth: 0.9}];
  const ripples: Ripple[] = [{...FILM_RIPPLE, at: T.tap, origin: TAP}];

  // camera: long lens, subject in the right columns, calm moves
  const boxTop = 0.42 * relief + 0.3 * board.p;
  const answerTop = 1.05 * relief + 0.3 * board.p;
  const boxPose = frameOn(board, {uv: SUBJECT, z: boxTop, pinsAcross: 112, screen: [0.645, 0.5], yaw: -0.1, pitch: -0.07, aspect});
  const portraitPose = frameOn(board, {uv: SUBJECT, pinsAcross: 140, screen: [0.68, 0.5], yaw: 0.13, pitch: 0.05, aspect});
  const emblemPose = frameOn(board, {uv: SUBJECT, pinsAcross: 128, screen: [0.675, 0.5], yaw: 0.24, pitch: 0.09, aspect});
  const rulePose = frameOn(board, {uv: [0.5, RULE_V], pinsAcross: 150, screen: [0.5, 0.54], yaw: 0.06, pitch: 0.035, aspect});
  const camera: CameraKey[] = [
    {at: 0, pose: boxPose},
    // the reel's creep: about 6% per beat, easing back as the next morph starts
    {at: 0, dur: 2.55, pose: pushIn(boxPose, 0.06), ease: 'inOutSine'},
    {at: 2.45, dur: 2.0, pose: portraitPose},
    {at: 4.35, dur: 1.9, pose: pushIn(portraitPose, 0.05), ease: 'inOutSine'},
    {at: 6.15, dur: 1.45, pose: emblemPose},
    // one lateral dolly, travelling with the hand behind the pins
    {at: 7.85, dur: 2.2, pose: dolly(emblemPose, 0.05, 0.008)},
    {at: 10.0, dur: 1.3, pose: rulePose},
    {at: 11.3, dur: 0.7, pose: pushIn(rulePose, 0.025), ease: 'inOutSine'},
  ];

  // rack focus: box face -> the answer pin as it slides out -> back to the wall as the face rises
  const fz = boxPose.distance * 0.94;
  const aperture = apertureForBlur(blurPx, fz, -(answerTop - boxTop), boxPose.fov);
  const focus: FocusKey[] = [
    {at: 0, to: {uv: SUBJECT, h: boxTop}, aperture},
    {at: 0.95, dur: 0.8, to: {uv: SUBJECT, h: answerTop}},
    // rack back to the box as the light comes up, and stop down before the portrait boils out
    {at: 2.0, dur: 0.6, to: {uv: SUBJECT, h: boxTop * 0.8}, aperture: aperture * 0.3},
    {at: 2.55, dur: 0.5, to: {uv: SUBJECT, h: 0.35 * relief}, aperture: 0},
  ];

  const subjectX = su - 0.5;
  const subjectY = sv * board.extH - board.extH / 2;
  const tapX = TAP[0] - 0.5;
  const tapY = TAP[1] * board.extH - board.extH / 2;
  // a tight, dim pool on the black box; the key light comes up as the portrait rises (reel 7.0-7.75 s)
  const light: LightKey[] = [
    {at: 0, key: 0.8, spread: 0.8, look: [-0.25, -0.12], poolAt: [subjectX, subjectY + 0.01]},
    {at: 2.55, dur: 1.3, key: 1.15, spread: 1.4, look: [0, 0]},
    {at: 4.45, dur: 1.0, key: 1.05, spread: 1.3},
    {at: 6.15, dur: 1.4, key: 1.0, spread: 1.15, look: [0.22, -0.08]},
    // the pool drifts left with the hand so the ring is lit where it lands
    {at: 7.9, dur: 1.6, spread: 1.3, poolAt: [(subjectX + tapX) / 2, (subjectY + tapY) / 2]},
    {at: 10.0, dur: 1.4, key: 1.0, spread: 1.25, look: [0, 0.12], poolAt: [0.02, RULE_V * board.extH - board.extH / 2 + 0.02]},
  ];

  const {mask, bits, counts} = bools;
  const trues = new Uint8Array(board.N);
  const falses = new Uint8Array(board.N);
  for (let i = 0; i < board.N; i++) {
    if (!mask[i]) continue;
    if (bits[i]) trues[i] = 1;
    else falses[i] = 1;
  }
  let rulePins = 0;
  for (let i = 0; i < board.N; i++) if ((rule(board.u[i], board.v[i], i).glow ?? 0) > 0.5) rulePins++;
  return {board, beats, ripples, magnets, presses, camera, focus, light, mask, trues, falses, counts, rulePins};
};

// ---------------------------------------------------------------- HTML layer

const pull = (t: number, from: number, to: number, inS = 0.35, outS = 0.3) => {
  const a = interpolate(t, [from, from + inS], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.33, 1, 0.68, 1)});
  const b = interpolate(t, [to - outS, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.32, 0, 0.67, 0)});
  return Math.min(a, b);
};

const Kicker: React.FC<{t: number; from: number; to: number; text: string}> = ({t, from, to, text}) => {
  const {width, height} = useVideoConfig();
  const k = pull(t, from, to);
  if (k <= 0) return null;
  const blur = (1 - k) * 8 * (height / 1080);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(width * layout.marginLeftW),
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
      }}
    >
      {text}
    </div>
  );
};

const CountChip: React.FC<{t: number; s: DemoScene; tl: ReturnType<typeof compileWall>}> = ({t, s, tl}) => {
  const {width, height} = useVideoConfig();
  const k = pull(t, T.bools + 0.12, T.veritas + 0.15);
  if (k <= 0) return null;
  // live: the pins this sweep has already turned into booleans, read from the wall's own arrays
  const flipped = releasedCount(tl, 'bools', t, s.mask);
  const trues = releasedCount(tl, 'bools', t, s.trues);
  const falses = releasedCount(tl, 'bools', t, s.falses);
  const fs = Math.round(height * 0.031);
  const pad = Math.round(height * 0.0125);
  const blur = (1 - k) * 8 * (height / 1080);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(width * layout.marginLeftW) - pad * 1.4,
        top: Math.round(height * 0.43),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        opacity: k,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: Math.round(fs * 0.32),
          padding: `${pad}px ${Math.round(pad * 1.6)}px`,
          borderRadius: 999,
          background: 'rgba(16,19,18,0.86)',
          border: `1px solid ${color.card.rule}`,
          fontFamily: font.sans,
          fontSize: fs,
          letterSpacing: '-0.01em',
          color: color.text.caption,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: Math.round(fs * 0.32),
            height: Math.round(fs * 0.32),
            borderRadius: 999,
            background: color.accent.mint,
            boxShadow: `0 0 ${Math.round(fs * 0.4)}px ${color.accent.mintGlow}`,
            alignSelf: 'center',
          }}
        />
        <span style={{fontWeight: 700, color: color.text.key}}>
          <Num n={flipped} /> pins,
        </span>
        <span style={{fontWeight: 500}}>each one</span>
        <span style={{fontFamily: font.serif, fontStyle: 'italic', color: color.accent.mint, fontSize: Math.round(fs * font.emScale)}}>true</span>
        <span style={{fontWeight: 500}}>or</span>
        <span style={{fontFamily: font.serif, fontStyle: 'italic', color: color.accent.mint, fontSize: Math.round(fs * font.emScale)}}>false</span>
      </div>
      {/* the split, from the same arrays: a second, quieter pill so it reads over bright pins */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: Math.round(height * 0.009),
          marginTop: Math.round(height * 0.01),
          marginLeft: Math.round(pad * 0.6),
          padding: `${Math.round(pad * 0.55)}px ${Math.round(pad * 1.2)}px`,
          borderRadius: 999,
          background: 'rgba(12,15,14,0.8)',
          border: `1px solid ${color.card.rule}`,
          fontFamily: font.mono,
          fontWeight: 500,
          fontSize: Math.round(height * typeTokens.monoCardLabel.size * 1.1),
          letterSpacing: `${typeTokens.monoCardLabel.tracking}em`,
          color: color.text.chipDim,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{color: color.text.caption}}>
          <Num n={trues} />
        </span>
        <span>TRUE</span>
        <span style={{color: color.text.tertiary}}>·</span>
        <span style={{color: color.text.caption}}>
          <Num n={falses} />
        </span>
        <span>FALSE</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- compositions

const canvasGl = {antialias: false, powerPreference: 'high-performance' as const, stencil: false, alpha: false};
const devicePixelRatioFor = () => (typeof window === 'undefined' ? 1 : Math.min(1, window.devicePixelRatio || 1));

interface FilmProps {
  face: Pixels;
  debug: boolean;
  grain?: number;
  debugView?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Blur radius of the answer pin while the box is in focus, px at 1440p. */
  blurPx?: number;
  /** Motion blur override for A/B checks (default: adaptive sub-frames). */
  motionBlur?: MotionBlurOptions | boolean;
}

const FilmScene: React.FC<FilmProps> = ({face, debug, grain, debugView, blurPx, motionBlur}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const s = useMemo(() => buildScene(board, face, width / height, blurPx), [board, face, width, height, blurPx]);
  const tl = useMemo(() => compileWall(board, s.beats), [board, s.beats]);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={devicePixelRatioFor()} camera={{fov: 18, near: 0.1, far: 20, position: [0, 0, 2]}}>
        <PinStudio light={s.light} />
        <CameraRig keys={s.camera} focus={s.focus} board={board} />
        <PinWall board={board} beats={s.beats} ripples={s.ripples} magnets={s.magnets} presses={s.presses} glowIntensity={3.0} />
        <PostFX width={width} height={height} {...REEL_LOOK} grain={grain ?? REEL_LOOK.grain} dither={grain !== 0} debug={debug} debugView={debugView} motionBlur={motionBlur ?? true} />
      </ThreeCanvas>
      <AbsoluteFill>
        <Kicker t={t} from={0.15} to={T.portrait - 0.1} text={`The black box · ${fmt(board.N)} steel pins`} />
        <Kicker t={t} from={T.portrait + 0.05} to={T.bools - 0.05} text="Portrait · released by a sweep" />
        <Kicker t={t} from={T.bools + 0.05} to={T.veritas - 0.05} text="Booleans · Floyd–Steinberg on the hex grid" />
        <Kicker t={t} from={T.veritas + 0.05} to={T.magnetFrom - 0.05} text="Emblem swap · VERITAS → TRACE" />
        <Kicker t={t} from={T.magnetFrom} to={T.clear - 0.05} text="The hand behind the pins · a press, a ripple" />
        <Kicker t={t} from={T.rule} to={DURATION_S + 1} text={`One rule · ${fmt(s.rulePins)} lit pins`} />
        <CountChip t={t} s={s} tl={tl} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// A contact sheet of the field library on one wall, for checking fields by eye.
const GalleryScene: React.FC<{face: Pixels}> = ({face}) => {
  const {width, height} = useVideoConfig();
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const fontReady = useCanvasFont({weight: 700});
  const beats = useMemo<Beat[] | null>(() => {
    if (!fontReady) return null;
    const ground = flatField(0.62);
    const tiles = tileGridField(
      board,
      {u: 0.17, v: 0.74, cols: 7, rows: 4, cell: 6, gap: 1},
      (c, r) => {
        const k = (c * 7 + r * 3) % 4;
        return [{h: 0.3, tint: [0.84, 1.0, 0.97]}, {h: 0.18, tint: [1.0, 0.92, 0.82]}, {h: 0.12, tint: 0.55}, {h: 0.45, tint: 1.0, glow: 0.6}][k] as {h: number; tint: number | [number, number, number]; glow?: number};
      },
      {ground},
    );
    const bars = barsField(board, {u: 0.17, v: 0.3, width: 40, height: 28, values: [0.35, 0.6, 0.45, 0.9, 0.7, 1.0]}, {ground});
    const ninetyOne = textField(board, {text: '91', weight: 700, tracking: -0.03}, {u: 0.48, v: 0.76, height: 30}, {h: 0.55, ground: 0.62});
    const nexus = emblemField(board, 'nexus', {u: 0.48, v: 0.28, height: 44}, {ground: 0.62});
    const lucid = emblemField(board, 'lucid', {u: 0.8, v: 0.76, height: 44}, {ground: 0.62});
    const disc = circleField(board, {u: 0.72, v: 0.28, r: 12}, {h: 0.4, tint: 1.0, ground});
    const noise = noiseField(board, {seed: 'gallery', scale: 6, h: 0.35, tint: [0.45, 1.0]});
    const rule = ruleLineField(board, {v: 0.52}, {ground});
    const coral = rectField(board, {u: 0.17, v: 0.07, w: 44, h: 8, radius: 3}, {h: 0.2, tint: [1.0, 0.78, 0.66], paint: 1, ground});
    const fields: FieldFn = overField(
      ground,
      (u, v, i) => (u < 0.32 && v > 0.56 ? tiles(u, v, i) : null),
      (u, v, i) => (u < 0.32 && v < 0.5 && v > 0.12 ? bars(u, v, i) : null),
      (u, v, i) => (u > 0.34 && u < 0.62 && v > 0.55 ? ninetyOne(u, v, i) : null),
      (u, v, i) => (u > 0.34 && u < 0.62 && v < 0.5 ? nexus(u, v, i) : null),
      (u, v, i) => (u > 0.64 && u < 0.98 && v > 0.55 ? lucid(u, v, i) : null),
      (u, v, i) => (u > 0.64 && u < 0.81 && v < 0.5 ? disc(u, v, i) : null),
      (u, v, i) => (u > 0.81 && v < 0.5 ? noise(u, v, i) : null),
      (u, v, i) => (Math.abs(v - 0.52) < 0.012 ? rule(u, v, i) : null),
      (u, v, i) => (u > 0.02 && u < 0.32 && v < 0.12 ? coral(u, v, i) : null),
    );
    return [settledBeat('gallery', fields)];
  }, [board, fontReady]);
  // a slow low-angle pull: the camera drops under the relief so every raised field shows its shafts
  const camera = useMemo<CameraKey[]>(() => {
    const base = frameOn(board, {uv: [0.5, 0.5], pinsAcross: 158, yaw: 0.16, pitch: 0.12, aspect: width / height});
    // (the pull stays inside the board: no edge of the wall comes into frame)
    return [
      {at: 0, pose: base},
      {at: 0.5, dur: 4, pose: lowAnglePull(base, {pitch: -0.2, pull: 0.02})},
    ];
  }, [board, width, height]);
  // keep the face loaded for parity with the film scene
  void face;
  if (!beats) return <AbsoluteFill style={{backgroundColor: color.wall.void}} />;
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={devicePixelRatioFor()} camera={{fov: 18, near: 0.1, far: 20, position: [0, 0, 2]}}>
        <PinStudio shadows={{mapSize: 4096, radius: 3}} />
        <CameraRig keys={camera} />
        <PinWall board={board} beats={beats} shadows />
        <PostFX width={width} height={height} {...REEL_LOOK} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// Effects on a flat wall: a ripple, a magnet pass, a press and a live lit-pin tracer.
const EffectsScene: React.FC<{debug: boolean}> = ({debug}) => {
  const {width, height} = useVideoConfig();
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const beats = useMemo<Beat[]>(() => [settledBeat('flat', flatField())], []);
  const ripples = useMemo<Ripple[]>(() => [{at: 0.4, origin: [0.5, 0.5], amp: 0.6}], []);
  const magnets = useMemo<Magnet[]>(
    () => [{from: 1.6, to: 3.4, amp: 0.85, path: (t) => [0.32 + 0.36 * Math.min(1, Math.max(0, (t - 1.6) / 1.8)), 0.5]}],
    [],
  );
  const presses = useMemo(() => [{at: 4.0, origin: [0.5, 0.5] as [number, number], radius: 0.05, depth: 1}], []);
  // a lit-pin path tracer: a mint head runs along a sine and leaves a fading trail of lit pins
  const live = useMemo<LiveLayer[]>(() => {
    const from = 5.2;
    const dur = 2.4;
    const pathAt = (k: number): [number, number] => [0.22 + 0.56 * k, 0.5 + 0.08 * Math.sin(k * Math.PI * 2)];
    const r2 = (1.1 * board.p) ** 2;
    const fn: LiveFieldFn = (u, v, _i, t) => {
      const head = Math.min(1, Math.max(0, (t - from) / dur));
      // distance to the path, sampled behind the head
      let best = 0;
      for (let j = 0; j <= 48; j++) {
        const k = head - j / 160;
        if (k < 0) break;
        const [pu, pv] = pathAt(k);
        const du = u - pu;
        const dv = (v - pv) * board.extH;
        if (du * du + dv * dv < r2) {
          best = Math.max(best, 1 - j / 48);
          break;
        }
      }
      return best > 0 ? {h: 0.06 * best, tint: 1, glow: best} : null;
    };
    return [{fn, from, to: from + dur + 0.9, fadeS: 0.3, region: [0.18, 0.36, 0.82, 0.64], speedHint: () => 0.4}];
  }, [board]);
  const camera = useMemo<CameraKey[]>(() => [{at: 0, pose: frameOn(board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.2, pitch: 0.08, aspect: width / height})}], [board, width, height]);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={devicePixelRatioFor()} camera={{fov: 18, near: 0.1, far: 20, position: [0, 0, 2]}}>
        <PinStudio light={[{at: 0, poolAt: [0, 0]}]} />
        <CameraRig keys={camera} />
        <PinWall board={board} beats={beats} ripples={ripples} magnets={magnets} presses={presses} live={live} />
        <PostFX width={width} height={height} {...REEL_LOOK} debug={debug} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// A macro push from the wall onto the single answer pin: close-up lathe LOD, soft shadows, DoF.
const MacroScene: React.FC<{debug: boolean}> = ({debug}) => {
  const {width, height} = useVideoConfig();
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const aspect = width / height;
  const s = useMemo(() => {
    const relief = 22 * board.p;
    const answer = pinAt(board, SUBJECT[0], SUBJECT[1]);
    const box = blackBoxField(board, {u: SUBJECT[0], v: SUBJECT[1], size: 36, h: 0.42, tint: 0.4});
    const field: FieldFn = (u, v, i) => (i === answer ? {h: 0.75, tint: 1.0, glow: 1} : box(u, v, i));
    const beats: Beat[] = [settledBeat('macro', field)];
    const wide = frameOn(board, {uv: SUBJECT, z: 0.42 * relief, pinsAcross: 112, screen: [0.5, 0.5], yaw: -0.1, pitch: -0.07, aspect});
    const close = macroOn(board, answer, {h: 0.75 * relief, pinsAcross: 7, yaw: 0.42, pitch: 0.22, aspect});
    const camera: CameraKey[] = [
      {at: 0, pose: wide},
      {at: 0.3, dur: 3.2, pose: close, ease: 'camera'},
    ];
    const headZ = 0.75 * relief + 0.3 * board.p;
    const focus: FocusKey[] = [
      {at: 0, to: {uv: SUBJECT, h: 0.42 * relief}, aperture: 0},
      // macro depth of field: the box surface, a third of the relief behind the head, blurs by 18 px
      {at: 1.2, dur: 2.3, to: {uv: [board.u[answer], board.v[answer]], h: headZ}, aperture: apertureForBlur(18, close.distance, (0.75 - 0.42) * relief, close.fov, 1440)},
    ];
    return {beats, camera, focus};
  }, [board, aspect]);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void}}>
      <ThreeCanvas width={width} height={height} gl={canvasGl} dpr={devicePixelRatioFor()} camera={{fov: 18, near: 0.01, far: 20, position: [0, 0, 2]}}>
        <PinStudio shadows={{mapSize: 4096, radius: 4}} light={[{at: 0, poolAt: [SUBJECT[0] - 0.5, SUBJECT[1] * board.extH - board.extH / 2], spread: 0.8}]} />
        <CameraRig keys={s.camera} focus={s.focus} board={board} />
        <PinWall board={board} beats={s.beats} lod="auto" shadows glowIntensity={3.0} />
        <PostFX width={width} height={height} {...REEL_LOOK} debug={debug} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// Capture-cost reference without WebGL: a static pin-like dot field with fine noise (similar JPEG
// entropy to a real wall frame), shifted one pixel per frame so every frame differs.
const CaptureScene: React.FC = () => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const url = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = width + 64;
    c.height = height;
    const x = c.getContext('2d');
    if (!x) return '';
    const img = x.createImageData(c.width, c.height);
    const pitch = height / 81.6;
    let seed = 12345;
    for (let py = 0; py < c.height; py++)
      for (let px = 0; px < c.width; px++) {
        const row = Math.round(py / (pitch * 0.866));
        const cx = (Math.round(px / pitch - (row % 2) * 0.5) + (row % 2) * 0.5) * pitch;
        const cy = row * pitch * 0.866;
        const d = Math.hypot(px - cx, py - cy) / (pitch * 0.47);
        seed = (seed * 16807) % 2147483647;
        const v = (d < 1 ? 40 + 120 * Math.sqrt(1 - d * d) : 22) + ((seed / 2147483647) * 4 - 2);
        const k = (py * c.width + px) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
        img.data[k + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }, [width, height]);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.void, overflow: 'hidden'}}>
      {url ? <img src={url} style={{position: 'absolute', left: -(frame % 64), top: 0}} /> : null}
    </AbsoluteFill>
  );
};

const PinWallDemo: React.FC<Omit<FilmProps, 'face' | 'debug'> & {mode?: 'film' | 'gallery' | 'effects' | 'macro' | 'capture'; debug?: boolean}> = ({
  mode = 'film',
  debug = false,
  grain,
  debugView,
  blurPx,
  motionBlur,
}) => {
  const face = usePixels('images/face.png');
  // the canvas mounts once its assets exist, so its first rendered frame already has them
  if (!face) return <AbsoluteFill style={{backgroundColor: color.wall.void}} />;
  if (mode === 'capture') return <CaptureScene />;
  if (mode === 'effects') return <EffectsScene debug={debug} />;
  if (mode === 'macro') return <MacroScene debug={debug} />;
  return mode === 'gallery' ? <GalleryScene face={face} /> : <FilmScene face={face} debug={debug} grain={grain} debugView={debugView} blurPx={blurPx} motionBlur={motionBlur} />;
};

export const demo: DemoSpec = {
  id: 'PinWallDemo',
  component: PinWallDemo,
  durationInFrames: DURATION_S * FPS,
  fps: FPS,
  defaultProps: {mode: 'film', debug: false},
};
