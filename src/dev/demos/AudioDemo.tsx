// AudioDemo: the audio engine's test mix with the instruments to check it against the picture.
// Everything drawn is read from what scripts/audio/mix.py wrote (mix.json, meters.json) and from
// the stems themselves (@remotion/media-utils), so the screen shows the mix's own work: the music
// gain the words produced, every effect on its frame, the master's measured loudness.
//
//   node --experimental-strip-types --import ./scripts/audio/register.mjs scripts/audio/demo-cues.ts
//   python scripts/audio/mix.py audio/cues/demo.json
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  FilmAudio,
  LevelMeter,
  WaveLane,
  degreeMidi,
  frameLevelsOf,
  meterAt,
  noteName,
  useEnvelope,
  useStaticAudio,
  useStaticJson,
  type Envelope,
  type MixMeters,
  type MixReport,
  type PlacedSfx,
} from '../../engine/audio';
import type {NarrationTimeline} from '../../engine/narration/types';
import {color, font} from '../../engine/tokens';
import {
  Captions,
  Kicker,
  KineticLine,
  RUN_LH,
  TABULAR,
  Tick,
  easeOutCubic,
  fontCSS,
  fontOf,
  inkWidth,
  prog,
  runTop,
  useFontsReady,
  type FontSpec,
} from '../../engine/type';
import type {DemoSpec} from '../types';

type Props = {
  /** folder under public/ that mix.py wrote */
  dir?: string;
  /** the mix's file format (the cue sheet's files.format) */
  ext?: 'flac' | 'wav';
  /** what plays: the master, or the three stems as mixed (before the master's gain and limiter) */
  mode?: 'master' | 'stems';
  /** seconds of audio across the lanes */
  windowS?: number;
};

const C = {
  ground: color.wall.deep,
  voice: color.text.caption,
  music: color.site.graphite,
  sfx: color.text.chipDim,
  master: color.text.display,
  label: color.text.tertiary,
  detail: color.text.secondary,
  value: color.text.display,
  rule: color.card.rule,
  ruleStrong: color.card.ruleStrong,
  mint: color.accent.mint,
  panel: 'rgba(228,234,231,0.022)',
};

const MINUS = '−';
const num = (v: number, d = 1): string => `${v < 0 && Math.abs(v) >= 0.5 * 10 ** -d ? MINUS : ''}${Math.abs(v).toFixed(d)}`;
const signed = (v: number, d = 1): string => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : `${v > 0 ? '+' : MINUS}${Math.abs(v).toFixed(d)}`);
const grouped = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------- geometry: every length from W and H ----------
const makeGeo = (W: number, H: number) => {
  const y = (f: number) => Math.round(f * H);
  const mL = Math.round(0.069 * W);
  const right = W - mL;
  const colW = Math.round(0.178 * W);
  const colL = right - colW;
  const laneL = mL;
  const laneR = colL - Math.round(0.03 * W);
  const lane = (head: number, top: number, bot: number) => ({head: y(head), top: y(top), bot: y(bot)});
  return {
    W,
    H,
    hair: Math.max(1, Math.round(H / 1080)),
    line: Math.max(1, Math.round(H / 720)),
    mL,
    right,
    colL,
    colW,
    laneL,
    laneR,
    laneW: laneR - laneL,
    kicker: y(0.082),
    title: y(0.15),
    statSub: y(0.19),
    ovLabel: y(0.236),
    ovTop: y(0.248),
    ovBot: y(0.29),
    ovBarTop: y(0.297),
    ovBarH: Math.max(4, Math.round(0.0042 * H)),
    ovCue: y(0.328),
    voice: lane(0.37, 0.381, 0.455),
    music: lane(0.49, 0.501, 0.575),
    sfx: {...lane(0.61, 0.676, 0.722), rows: [y(0.638), y(0.664)]},
    rulerTop: y(0.728),
    ruler: y(0.761),
    meterTop: y(0.381),
    meterBot: y(0.6),
    log: y(0.638),
    credit: y(0.976),
  };
};
type Geo = ReturnType<typeof makeGeo>;

// ---------- text ----------
const Txt: React.FC<{
  f: FontSpec;
  x: number;
  base: number;
  c: string;
  W: number;
  align?: 'left' | 'right' | 'center';
  o?: number;
  children: React.ReactNode;
}> = ({f, x, base, c, W, align = 'left', o = 1, children}) => {
  const pos: React.CSSProperties =
    align === 'left' ? {left: Math.round(x)} : align === 'right' ? {right: Math.round(W - x)} : {left: Math.round(x) - 2000, width: 4000, textAlign: 'center'};
  return (
    <span style={{position: 'absolute', top: Math.round(runTop(base, f)), ...pos, ...fontCSS(f), lineHeight: RUN_LH, color: c, opacity: o}}>
      {children}
    </span>
  );
};

/** JetBrains Mono advances 600/1000 em, so label widths are exact without measuring. */
const monoWidth = (s: string, f: FontSpec): number => s.length * f.size * (0.6 + (f.tracking ?? 0)) - f.size * (f.tracking ?? 0);

// ---------- the ground: a dithered light pool, drawn once ----------
const Ground: React.FC<{W: number; H: number}> = ({W, H}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    c.width = W;
    c.height = H;
    const img = g.createImageData(W, H);
    const d = img.data;
    // a seeded xorshift for the dither: the same pixels on every render
    let s = 0x9e3779b9;
    const rnd = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    const inner = [17, 21, 20];
    const outer = [7, 9, 9];
    for (let py = 0; py < H; py++) {
      const dy = py / H - 0.42;
      for (let px = 0; px < W; px++) {
        const dx = ((px / W - 0.5) * W) / H;
        const k = Math.exp(-(dx * dx + dy * dy) * 1.9);
        const n = rnd() + rnd() - 1;
        const i = (py * W + px) * 4;
        for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.round(outer[ch] + (inner[ch] - outer[ch]) * k + n * 0.75);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }, [W, H]);
  return <canvas ref={ref} style={{position: 'absolute', left: 0, top: 0, width: W, height: H}} />;
};

// ---------- header: the master's measured claims ----------
interface StatSpec {
  label: string;
  value: string;
  unit: string;
  sub: string;
  ok: boolean;
}

const statFonts = (H: number) => ({
  lab: fontOf('monoCardLabel', H),
  val: fontOf('cardTitle', H, {size: 0.052 * H, weight: 650, features: TABULAR, tracking: -0.02}),
  unit: fontOf('monoCardLabel', H, {tracking: 0.06, uppercase: false}),
  sub: fontOf('monoCardLabel', H, {tracking: 0.04, uppercase: false}),
  tick: Math.round(0.019 * H),
});

const statWidth = (st: StatSpec, H: number): number => {
  const f = statFonts(H);
  const v = inkWidth(st.value, f.val) + Math.round(0.35 * f.unit.size) + monoWidth(st.unit, f.unit);
  const sub = f.tick + Math.round(0.4 * f.tick) + monoWidth(st.sub, f.sub);
  return Math.ceil(Math.max(monoWidth(st.label.toUpperCase(), f.lab), v, sub));
};

const Stat: React.FC<{g: Geo; x: number; st: StatSpec; o: number}> = ({g, x, st, o}) => {
  const f = statFonts(g.H);
  return (
    <>
      <Txt f={f.lab} x={x} base={g.kicker} c={C.label} W={g.W} o={o}>
        {st.label}
      </Txt>
      <span style={{position: 'absolute', left: x, top: Math.round(runTop(g.title, f.val)), ...fontCSS(f.val), lineHeight: RUN_LH, color: C.value, opacity: o}}>
        {st.value}
        <span style={{...fontCSS(f.unit), marginLeft: Math.round(0.35 * f.unit.size), color: C.detail}}>{st.unit}</span>
      </span>
      <div style={{position: 'absolute', left: x, top: g.statSub - Math.round(f.tick * 0.86), opacity: o}}>
        <Tick size={f.tick} disc={st.ok ? C.mint : color.signal.verdictRed} />
      </div>
      <Txt f={f.sub} x={x + f.tick + Math.round(0.4 * f.tick)} base={g.statSub} c={C.detail} W={g.W} o={o}>
        {st.sub}
      </Txt>
    </>
  );
};

const Header: React.FC<{g: Geo; t: number; report: MixReport}> = ({g, t, report}) => {
  const m = report.master;
  const bal = report.balance?.musicUnderVoiceLU;
  const o = easeOutCubic(prog(t, 0.35, 0.6));
  const I = m?.ffmpeg.I ?? m?.stats.I ?? null;
  const tp = m?.aac?.TP ?? m?.ffmpeg.TP ?? null;
  const target = m?.target.lufs ?? -15;
  const tpMax = m?.target.truePeakMaxDb ?? -1.5;
  const stats: StatSpec[] = [];
  if (I !== null) stats.push({label: 'Integrated', value: num(I), unit: 'LUFS', sub: `target ${num(target, 0)} ± 0.5`, ok: Math.abs(I - target) <= 0.5});
  if (tp !== null) stats.push({label: 'True peak · AAC', value: num(tp), unit: 'dBTP', sub: `limit ${num(tpMax)}`, ok: tp <= tpMax});
  if (bal)
    stats.push({
      label: 'Music under voice',
      value: num(bal.median),
      unit: 'LU',
      sub: `target ${bal.target[0]}–${bal.target[1]}`,
      ok: bal.median >= bal.target[0] - 0.5 && bal.median <= bal.target[1] + 0.5,
    });
  const gap = Math.round(0.034 * g.W);
  const xs: number[] = [];
  let x = g.right;
  for (let i = stats.length - 1; i >= 0; i--) {
    x -= statWidth(stats[i], g.H);
    xs[i] = x;
    x -= gap;
  }
  return (
    <>
      <Kicker text="Audio engine · test mix" tone="mint" x={g.mL} baseline={g.kicker} at={0.05} t={t} />
      <KineticLine
        text="The mix *shows its work.*"
        kind="cardTitle"
        sizeH={0.06}
        x={g.mL}
        y={g.title}
        yAnchor="firstBaseline"
        at={0.15}
        perWordS={0.07}
        variant="focus"
        halo={false}
        t={t}
      />
      {stats.map((st, i) => (
        <Stat key={st.label} g={g} x={xs[i]} st={st} o={o} />
      ))}
    </>
  );
};

// ---------- overview: the whole mix, and where the lanes are looking ----------
const envPath = (env: Envelope, dur: number, width: number, height: number, rangeDb: number, src: Float32Array): string => {
  const mid = height / 2;
  const n = Math.min(env.n, Math.ceil(dur / env.binS));
  const top: string[] = [];
  const bot: string[] = [];
  for (let b = 0; b < n; b++) {
    const x = (((b + 0.5) * env.binS) / dur) * width;
    const k = Math.max(0, Math.min(1, (src[b] + rangeDb) / rangeDb));
    const h = Math.max(0.35, k * mid);
    top.push(`${x.toFixed(1)},${(mid - h).toFixed(1)}`);
    bot.push(`${x.toFixed(1)},${(mid + h).toFixed(1)}`);
  }
  return `M${top.join('L')}L${bot.reverse().join('L')}Z`;
};

const Overview: React.FC<{g: Geo; t: number; t0: number; windowS: number; report: MixReport; words: NarrationTimeline; env: Envelope; o: number}> = ({
  g,
  t,
  t0,
  windowS,
  report,
  words,
  env,
  o,
}) => {
  const dur = report.durationS;
  const h = g.ovBot - g.ovTop;
  const paths = useMemo(() => ({peak: envPath(env, dur, g.laneW, h, 48, env.peakDb), rms: envPath(env, dur, g.laneW, h, 48, env.rmsDb)}), [env, dur, g.laneW, h]);
  const X = (s: number) => g.laneL + (s / dur) * g.laneW;
  const lab = fontOf('monoCardLabel', g.H);
  const cueF = fontOf('monoCardLabel', g.H, {tracking: 0.1});
  const played = Math.max(0, Math.min(g.laneW, X(t) - g.laneL));
  const wx0 = Math.max(g.laneL, X(t0));
  const wx1 = Math.min(g.laneR, X(t0 + windowS));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      {words.chapters
        .filter((c) => c.end - c.start >= 2)
        .map((c, i) => (
          <React.Fragment key={c.id}>
            <div style={{position: 'absolute', left: Math.round(X(c.start)), top: g.ovLabel - Math.round(0.016 * g.H), width: g.hair, height: g.ovBot - g.ovLabel + Math.round(0.016 * g.H), background: C.rule}} />
            <Txt f={lab} x={X(c.start) + Math.round(0.006 * g.H)} base={g.ovLabel} c={C.label} W={g.W}>
              <span style={{color: color.accent.mintLabel}}>{String(i + 1).padStart(2, '0')} · </span>
              {c.title.toUpperCase()}
            </Txt>
          </React.Fragment>
        ))}
      <svg width={g.laneW} height={h} style={{position: 'absolute', left: g.laneL, top: g.ovTop, overflow: 'visible'}}>
        <defs>
          <clipPath id="ovPlayed">
            <rect x={0} y={-1} width={played} height={h + 2} />
          </clipPath>
        </defs>
        <path d={paths.peak} fill={C.master} opacity={0.12} />
        <path d={paths.rms} fill={C.master} opacity={0.3} />
        <g clipPath="url(#ovPlayed)">
          <path d={paths.peak} fill={C.master} opacity={0.22} />
          <path d={paths.rms} fill={C.master} opacity={0.72} />
        </g>
        {report.voice.phrases.map(([a, b], i) => (
          <rect key={i} x={X(a) - g.laneL} y={h + Math.round(0.002 * g.H)} width={Math.max(1, X(b) - X(a))} height={g.hair} fill={C.voice} opacity={0.5} shapeRendering="crispEdges" />
        ))}
      </svg>
      {report.music.map((m) => {
        const a = X(m.in);
        const b = X(m.out);
        const fi = Math.min(b - a, (m.fadeIn / dur) * g.laneW);
        const fo = Math.min(b - a, (m.fadeOut / dur) * g.laneW);
        const H2 = g.ovBarH;
        const d = `M${a.toFixed(1)},${H2} L${(a + fi).toFixed(1)},0 L${(b - fo).toFixed(1)},0 L${b.toFixed(1)},${H2} Z`;
        return (
          <React.Fragment key={m.id}>
            <svg width={g.W} height={H2} style={{position: 'absolute', left: 0, top: g.ovBarTop, overflow: 'visible'}}>
              <path d={d} fill={C.music} opacity={0.55} />
            </svg>
            <Txt f={cueF} x={a + Math.round(0.004 * g.H)} base={g.ovCue} c={C.detail} W={g.W}>
              {`${m.id} · ${(m.title ?? m.track).toUpperCase()}`}
              <span style={{color: C.label}}>{` · TRACK FROM ${Math.floor(m.offset / 60)}:${(m.offset % 60).toFixed(2).padStart(5, '0')}`}</span>
            </Txt>
          </React.Fragment>
        );
      })}
      {/* the window the lanes show, and the playhead */}
      <div
        style={{
          position: 'absolute',
          left: Math.round(wx0),
          top: g.ovTop - Math.round(0.006 * g.H),
          width: Math.max(0, Math.round(wx1 - wx0)),
          height: g.ovBot - g.ovTop + Math.round(0.012 * g.H),
          border: `${g.hair}px solid ${C.ruleStrong}`,
          borderRadius: Math.round(0.004 * g.H),
          boxSizing: 'border-box',
        }}
      />
      <div style={{position: 'absolute', left: Math.round(X(t)), top: g.ovTop - Math.round(0.006 * g.H), width: g.line, height: g.ovBot - g.ovTop + Math.round(0.012 * g.H), background: C.value, opacity: 0.85}} />
    </div>
  );
};

// ---------- lanes ----------
const LaneHead: React.FC<{g: Geo; base: number; label: string; detail: string; value: React.ReactNode}> = ({g, base, label, detail, value}) => {
  const lab = fontOf('monoCardLabel', g.H);
  const det = fontOf('monoCardLabel', g.H, {tracking: 0.04, uppercase: false});
  const lw = monoWidth(label.toUpperCase(), lab);
  return (
    <>
      <Txt f={lab} x={g.laneL} base={base} c={C.label} W={g.W}>
        {label}
      </Txt>
      <Txt f={det} x={g.laneL + lw + Math.round(0.9 * lab.size)} base={base} c={C.detail} W={g.W} o={0.85}>
        {detail}
      </Txt>
      <Txt f={{...det, features: TABULAR}} x={g.laneR} base={base} c={C.value} W={g.W} align="right">
        {value}
      </Txt>
    </>
  );
};

const LanePanel: React.FC<{g: Geo; top: number; bot: number}> = ({g, top, bot}) => (
  <div
    style={{
      position: 'absolute',
      left: g.laneL,
      top,
      width: g.laneW,
      height: bot - top,
      background: C.panel,
      borderTop: `${g.hair}px solid ${C.rule}`,
      borderBottom: `${g.hair}px solid ${C.rule}`,
      boxSizing: 'border-box',
    }}
  />
);

const WordBars: React.FC<{g: Geo; t: number; t0: number; windowS: number; words: NarrationTimeline}> = ({g, t, t0, windowS, words}) => {
  const pxs = g.laneW / windowS;
  const h = Math.max(2, Math.round(0.0028 * g.H));
  const gap = Math.max(1, Math.round(0.0016 * g.H));
  const y = g.voice.bot - h - Math.round(0.006 * g.H);
  const all = words.utterances.flatMap((u) => u.words);
  return (
    <svg width={g.laneW} height={h} style={{position: 'absolute', left: g.laneL, top: y, overflow: 'hidden'}}>
      {all
        .filter((w) => w.end > t0 - 0.5 && w.start < t0 + windowS + 0.5)
        .map((w, i) => {
          const x = (w.start - t0) * pxs;
          const width = Math.max(1, (w.end - w.start) * pxs - gap);
          const now = t >= w.start && t < w.end;
          const past = t >= w.end;
          const em = w.tag === 'em';
          const fill = em ? C.mint : now ? color.text.key : C.voice;
          const op = now ? 1 : past ? (em ? 0.7 : 0.5) : em ? 0.35 : 0.2;
          return <rect key={i} x={x} y={0} width={width} height={h} rx={h / 2} fill={fill} opacity={op} />;
        })}
    </svg>
  );
};

/** The music automation the words produced (meters.json), drawn over the music lane in dB. */
const GainCurve: React.FC<{g: Geo; t0: number; windowS: number; meters: MixMeters; fps: number; frame: number}> = ({g, t0, windowS, meters, fps, frame}) => {
  const top = g.music.top;
  const h = g.music.bot - top;
  const dbTop = 6;
  const dbBot = -13;
  const gy = (db: number) => ((dbTop - db) / (dbTop - dbBot)) * h;
  const pxs = g.laneW / windowS;
  const f0 = Math.max(0, Math.floor(t0 * fps) - 1);
  const f1 = Math.min(meters.frames - 1, Math.ceil((t0 + windowS) * fps) + 1);
  const pts: string[] = [];
  for (let f = f0; f <= f1; f++) pts.push(`${((f / fps - t0) * pxs).toFixed(1)},${gy(meters.musicGainDb[f]).toFixed(2)}`);
  const line = pts.length ? `M${pts.join('L')}` : '';
  const fill = pts.length ? `${line}L${(((f1 / fps) - t0) * pxs).toFixed(1)},${gy(0)}L${(((f0 / fps) - t0) * pxs).toFixed(1)},${gy(0)}Z` : '';
  const lab = fontOf('monoCardLabel', g.H, {tracking: 0.04, uppercase: false});
  const fr = Math.max(0, Math.min(meters.frames - 1, frame));
  const now = meters.musicGainDb[fr];
  const xPlay = (frame / fps - t0) * pxs;
  return (
    <>
      <svg width={g.laneW} height={h} style={{position: 'absolute', left: g.laneL, top, overflow: 'hidden'}}>
        <path d={fill} fill={C.mint} opacity={0.05} />
        {[0, -10].map((db) => (
          <line key={db} x1={0} x2={g.laneW} y1={Math.round(gy(db)) + 0.5} y2={Math.round(gy(db)) + 0.5} stroke={C.mint} strokeOpacity={0.28} strokeWidth={g.hair} strokeDasharray={`${3 * g.hair} ${5 * g.hair}`} />
        ))}
        <path d={line} fill="none" stroke={C.mint} strokeWidth={g.line} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xPlay} cy={gy(now)} r={g.line * 2.2} fill={C.mint} />
      </svg>
      {[0, -10].map((db) => (
        <Txt key={db} f={lab} x={g.laneL - Math.round(0.008 * g.H)} base={top + Math.round(gy(db) + 0.36 * lab.size)} c={C.mint} W={g.W} align="right" o={0.75}>
          {`${num(db, 0)} dB`}
        </Txt>
      ))}
    </>
  );
};

// ---------- sound design: every cue on its frame ----------
interface CueGroup {
  at: number;
  frame: number;
  label: string;
  items: PlacedSfx[];
  row: number;
}

/** Words in capitals, note names as written ('BLIP Eb5'). */
const cueLabel = (c: PlacedSfx): string => {
  const p = c.params as {note?: string; degree?: number; octave?: number};
  const pitch = () => (p.note ? p.note : noteName(degreeMidi(p.degree ?? (c.type === 'blip' ? 5 : 1), c.key ?? 'D major', p.octave ?? 5), c.key ?? 'D major'));
  switch (c.type) {
    case 'pin_brush':
      return c.pins ? `PINS ${grouped(c.pins)}` : 'PINS';
    case 'note':
      return `NOTE ${pitch()}`;
    case 'blip':
      return `BLIP ${pitch()}`;
    case 'reverse_swell':
      return 'SWELL';
    case 'error_buzz':
      return 'ERROR';
    case 'sub_hit':
      return 'SUB';
    case 'camera_shutter':
      return 'SHUTTER';
    default:
      return c.type.replace(/_/g, ' ').toUpperCase();
  }
};

const groupCues = (sfx: PlacedSfx[], f: FontSpec, pxs: number): CueGroup[] => {
  const sorted = [...sfx].sort((a, b) => a.anchorS - b.anchorS);
  const groups: CueGroup[] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && c.anchorS - last.at < 0.05) {
      last.items.push(c);
      last.label = `${last.label} + ${cueLabel(c)}`;
    } else groups.push({at: c.anchorS, frame: c.frame, label: cueLabel(c), items: [c], row: 0});
  }
  // two label rows, assigned greedily so labels never overlap at this scale
  const ends = [-Infinity, -Infinity];
  const pad = f.size * 1.4;
  for (const gr of groups) {
    const w = (monoWidth(gr.label, f) + pad) / pxs;
    let row = ends.findIndex((e) => e <= gr.at);
    if (row < 0) row = ends[0] <= ends[1] ? 0 : 1;
    gr.row = row;
    ends[row] = gr.at + w;
  }
  return groups;
};

const LIT_S = 0.9;

const CueLane: React.FC<{g: Geo; t: number; t0: number; windowS: number; groups: CueGroup[]; f: FontSpec}> = ({g, t, t0, windowS, groups, f}) => {
  const pxs = g.laneW / windowS;
  const X = (s: number) => g.laneL + (s - t0) * pxs;
  const barH = Math.max(2, Math.round(0.0024 * g.H));
  return (
    <>
      {groups
        .filter((gr) => {
          const s = Math.min(...gr.items.map((c) => c.startS));
          return gr.at > t0 - 3 && s < t0 + windowS;
        })
        .map((gr) => {
          const x = X(gr.at);
          const lit = t >= gr.at ? 1 - easeOutCubic(prog(t, gr.at, LIT_S)) : 0;
          const past = t >= gr.at;
          const base = g.sfx.rows[gr.row];
          const lineTop = base - Math.round(f.size * 0.95);
          const labelColor = lit > 0.02 ? C.mint : C.detail;
          const lineColor = lit > 0.02 ? C.mint : C.ruleStrong;
          const visible = x > g.laneL - 2 && x < g.laneR + 2;
          return (
            <React.Fragment key={`${gr.at}`}>
              {/* the sound's extent, from its first sample to its last */}
              {gr.items.map((c) => {
                const a = Math.max(g.laneL, X(c.startS));
                const b = Math.min(g.laneR, X(c.endS));
                return b > a ? (
                  <div key={c.id} style={{position: 'absolute', left: Math.round(a), top: g.sfx.bot - barH - Math.round(0.004 * g.H), width: Math.round(b - a), height: barH, background: C.sfx, opacity: 0.22, borderRadius: barH / 2}} />
                ) : null;
              })}
              {visible ? (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      left: Math.round(x),
                      top: lineTop,
                      width: lit > 0.02 ? g.line : g.hair,
                      height: g.sfx.bot - lineTop,
                      background: lineColor,
                      opacity: lit > 0.02 ? 0.5 + 0.5 * lit : 1,
                      boxShadow: lit > 0.02 ? `0 0 ${Math.round(0.012 * g.H)}px rgba(116,201,174,${(0.55 * lit).toFixed(3)})` : undefined,
                    }}
                  />
                  {x + Math.round(0.5 * f.size) < g.laneR ? (
                    <Txt f={f} x={x + Math.round(0.45 * f.size)} base={base} c={labelColor} W={g.W} o={past && lit <= 0.02 ? 0.55 : 1}>
                      {gr.label}
                    </Txt>
                  ) : null}
                </>
              ) : null}
            </React.Fragment>
          );
        })}
    </>
  );
};

// ---------- ruler and playhead ----------
const Ruler: React.FC<{g: Geo; t: number; t0: number; windowS: number; frame: number}> = ({g, t, t0, windowS, frame}) => {
  const pxs = g.laneW / windowS;
  const ticks: React.ReactNode[] = [];
  const lab = fontOf('monoCardLabel', g.H, {tracking: 0.04});
  const a = Math.ceil(t0 * 10);
  const b = Math.floor((t0 + windowS) * 10);
  for (let k = Math.max(0, a); k <= b; k++) {
    const x = Math.round(g.laneL + (k / 10 - t0) * pxs);
    const major = k % 10 === 0;
    const half = k % 5 === 0;
    const len = Math.round((major ? 0.012 : half ? 0.007 : 0.004) * g.H);
    ticks.push(<div key={`t${k}`} style={{position: 'absolute', left: x, top: g.rulerTop, width: g.hair, height: len, background: major ? C.ruleStrong : C.rule}} />);
    if (major) {
      ticks.push(
        <Txt key={`l${k}`} f={lab} x={x} base={g.ruler} c={C.label} W={g.W} align="center">
          {`${k / 10}`}
        </Txt>,
      );
    }
  }
  const xp = g.laneL + (t - t0) * pxs;
  const chip = fontOf('monoCardLabel', g.H, {tracking: 0.04, features: TABULAR, uppercase: false});
  const text = `${t.toFixed(3)} s · f ${String(frame).padStart(4, '0')}`;
  const cw = monoWidth(text, chip) + 1.6 * chip.size;
  const ch = Math.round(chip.size * 1.75);
  return (
    <>
      {ticks}
      <div
        style={{
          position: 'absolute',
          left: Math.round(xp - cw / 2),
          top: g.ruler - Math.round(chip.size * 1.18),
          width: Math.round(cw),
          height: ch,
          background: '#0B0E0D',
          border: `${g.hair}px solid ${C.ruleStrong}`,
          borderRadius: Math.round(ch / 2),
          boxSizing: 'border-box',
        }}
      />
      <Txt f={chip} x={xp} base={g.ruler} c={C.value} W={g.W} align="center">
        {text}
      </Txt>
    </>
  );
};

// ---------- master meter and event log ----------
const Readout: React.FC<{g: Geo; x: number; base: number; label: string; value: string; unit: string; c?: string}> = ({g, x, base, label, value, unit, c = C.value}) => {
  const lab = fontOf('monoCardLabel', g.H);
  const small = fontOf('monoCardLabel', g.H, {tracking: 0.04, uppercase: false});
  const val = fontOf('cardTitle', g.H, {size: 0.042 * g.H, weight: 650, features: TABULAR, tracking: -0.02});
  return (
    <>
      <Txt f={lab} x={x} base={base - Math.round(0.047 * g.H)} c={C.label} W={g.W}>
        {label}
      </Txt>
      <span style={{position: 'absolute', left: x, top: Math.round(runTop(base, val)), ...fontCSS(val), lineHeight: RUN_LH, color: c}}>
        {value}
        <span style={{...fontCSS(small), marginLeft: Math.round(0.3 * small.size), color: C.detail}}>{unit}</span>
      </span>
    </>
  );
};

const MasterColumn: React.FC<{g: Geo; t: number; frame: number; report: MixReport; meters: MixMeters; masterLv: ReturnType<typeof frameLevelsOf>; groups: CueGroup[]; o: number}> = ({
  g,
  t,
  frame,
  report,
  meters,
  masterLv,
  groups,
  o,
}) => {
  const lab = fontOf('monoCardLabel', g.H);
  const small = fontOf('monoCardLabel', g.H, {tracking: 0.04, uppercase: false});
  const logF = fontOf('monoCardLabel', g.H, {tracking: 0.02, features: TABULAR, uppercase: false});
  const reading = meterAt(masterLv, frame);
  const barW = Math.round(0.0105 * g.W);
  const gap = Math.round(0.0035 * g.W);
  const mh = g.meterBot - g.meterTop;
  const floorDb = -54;
  const ceiling = report.master?.limiter.ceilingDb ?? -2;
  const yDb = (db: number) => g.meterTop + mh * (1 - (db - floorDb) / -floorDb);
  const fr = Math.max(0, Math.min(meters.frames - 1, frame));
  const mom = meters.momentaryLufs.master[fr];
  const held = Math.max(reading.hold[0], reading.hold[1]);
  const xs = g.colL + 2 * barW + gap + Math.round(0.005 * g.W);
  const xr = g.colL + Math.round(0.07 * g.W);
  const step = Math.round(0.08 * g.H);
  // event log: the last cues that fired, newest first
  const fired = groups.filter((gr) => gr.at <= t).slice(-4).reverse();
  const rowH = Math.round(0.03 * g.H);
  const cw = logF.size * (0.6 + 0.02);
  const nameX = g.colL + Math.round(5.6 * cw);
  const maxName = Math.floor((g.right - Math.round(5.4 * cw) - nameX) / cw);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      <Txt f={lab} x={g.colL} base={g.voice.head} c={C.label} W={g.W}>
        Master
      </Txt>
      <Txt f={small} x={g.right} base={g.voice.head} c={C.detail} W={g.W} align="right" o={0.85}>
        L R · dBFS
      </Txt>
      <div style={{position: 'absolute', left: g.colL, top: g.meterTop}}>
        <LevelMeter
          reading={reading}
          height={mh}
          barWidth={barW}
          gap={gap}
          floorDb={floorDb}
          markDb={ceiling}
          hair={g.hair}
          colors={{track: 'rgba(228,234,231,0.05)', body: 'rgba(236,238,237,0.82)', peak: C.master, hold: color.text.key, mark: C.mint}}
        />
      </div>
      {[-12, -18, -24, -36, -54].map((db) => (
        <Txt key={db} f={small} x={xs} base={Math.round(yDb(db) + 0.36 * small.size)} c={C.label} W={g.W}>
          {num(db, 0)}
        </Txt>
      ))}
      <Txt f={small} x={xs} base={Math.round(yDb(ceiling) + 0.36 * small.size)} c={C.mint} W={g.W}>
        {num(ceiling, 0)}
      </Txt>
      <Readout g={g} x={xr} base={g.meterTop + Math.round(0.058 * g.H)} label="Momentary" value={mom > -70 ? num(mom) : `${MINUS}∞`} unit="LUFS" />
      <Readout g={g} x={xr} base={g.meterTop + Math.round(0.058 * g.H) + step} label="Peak · held" value={held > -90 ? num(held) : `${MINUS}∞`} unit="dBFS" />
      <Readout g={g} x={xr} base={g.meterTop + Math.round(0.058 * g.H) + 2 * step} label="Ceiling" value={num(ceiling)} unit="dBTP" c={C.mint} />

      <Txt f={lab} x={g.colL} base={g.log} c={C.label} W={g.W}>
        Events
      </Txt>
      <Txt f={small} x={g.right} base={g.log} c={C.detail} W={g.W} align="right" o={0.85}>
        LU under voice
      </Txt>
      <div style={{position: 'absolute', left: g.colL, top: g.log + Math.round(0.011 * g.H), width: g.colW, height: g.hair, background: C.rule}} />
      {fired.map((gr, i) => {
        const base = g.log + Math.round(0.038 * g.H) + i * rowH;
        const lit = i === 0 ? 1 - easeOutCubic(prog(t, gr.at, LIT_S)) : 0;
        const c = lit > 0.02 ? C.mint : i === 0 ? C.value : C.detail;
        const rel = gr.items.map((it) => it.relToVoiceLU).filter((v): v is number => v !== null);
        const name = gr.label.length > maxName ? `${gr.label.slice(0, maxName - 1)}…` : gr.label;
        const fade = 1 - i * 0.14;
        return (
          <React.Fragment key={gr.at}>
            <Txt f={logF} x={g.colL} base={base} c={C.label} W={g.W} o={fade}>
              {String(gr.frame).padStart(4, '0')}
            </Txt>
            <Txt f={logF} x={nameX} base={base} c={c} W={g.W} o={fade}>
              {name}
            </Txt>
            <Txt f={{...logF, uppercase: false}} x={g.right} base={base} c={rel.length ? c : C.label} W={g.W} align="right" o={fade}>
              {rel.length ? num(-Math.max(...rel)) : 'hold'}
            </Txt>
          </React.Fragment>
        );
      })}
      {fired.length === 0 && groups[0] ? (
        <Txt f={small} x={g.colL} base={g.log + Math.round(0.038 * g.H)} c={C.label} W={g.W}>
          {`first cue at frame ${groups[0].frame}`}
        </Txt>
      ) : null}
    </div>
  );
};

// ---------- the demo ----------
const useMix = (dir: string, ext: string) => {
  const report = useStaticJson<MixReport>(`${dir}/mix.json`);
  const meters = useStaticJson<MixMeters>(`${dir}/meters.json`);
  const words = useStaticJson<NarrationTimeline>(`${dir}/words.json`);
  const voice = useStaticAudio(`${dir}/voice.${ext}`);
  const music = useStaticAudio(`${dir}/music.${ext}`);
  const sfx = useStaticAudio(`${dir}/sfx.${ext}`);
  const master = useStaticAudio(`${dir}/master.${ext}`);
  const env = {
    voice: useEnvelope(voice, 0.005),
    music: useEnvelope(music, 0.005),
    sfx: useEnvelope(sfx, 0.005),
    overview: useEnvelope(master, 0.02),
  };
  const {fps} = useVideoConfig();
  const masterLv = useMemo(() => (master ? frameLevelsOf(master, fps) : null), [master, fps]);
  const error = report.error ?? meters.error ?? words.error;
  return {report: report.data, meters: meters.data, words: words.data, env, masterLv, error};
};

const AudioDemo: React.FC<Props> = ({dir = 'audio/demo', ext = 'flac', mode = 'master', windowS = 8}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const g = useMemo(() => makeGeo(W, H), [W, H]);
  const ready = useFontsReady();
  const mix = useMix(dir, ext);
  const cueF = useMemo(() => fontOf('monoCardLabel', H, {tracking: 0.1, uppercase: false}), [H]);
  const groups = useMemo(() => (mix.report ? groupCues(mix.report.sfx, cueF, g.laneW / windowS) : []), [mix.report, cueF, g.laneW, windowS]);

  const {report, meters, words, env, masterLv} = mix;
  const loaded = ready && report && meters && words && env.voice && env.music && env.sfx && env.overview && masterLv;
  const lead = windowS * 0.3125;
  const t0 = t - (windowS - lead);
  const o = easeOutCubic(prog(t, 0.2, 0.7));
  const fr = Math.max(0, Math.min((meters?.frames ?? 1) - 1, frame));
  const lu = (k: 'voice' | 'music' | 'sfx'): string => {
    const v = meters ? meters.momentaryLufs[k][fr] : -90;
    return v > -70 ? `${num(v)} LUFS M` : `${MINUS}∞ LUFS M`;
  };
  const gainNow = meters ? meters.musicGainDb[fr] : 0;
  const state = !meters ? '' : meters.voiceActivity[fr] > 0.98 ? 'under the voice' : gainNow > 2.9 ? 'swell in a hold' : gainNow > -0.05 ? 'open' : 'moving';
  const xPlay = g.laneL + (t - t0) * (g.laneW / windowS);

  return (
    <AbsoluteFill style={{backgroundColor: C.ground}}>
      <Ground W={W} H={H} />
      <FilmAudio dir={dir} ext={ext} mode={mode} />
      {mix.error ? (
        <Txt f={fontOf('monoCardLabel', H)} x={g.mL} base={Math.round(H / 2)} c={color.signal.amber} W={W}>
          {`${mix.error} · run scripts/audio/mix.py audio/cues/demo.json`}
        </Txt>
      ) : null}
      {loaded ? (
        <>
          <Header g={g} t={t} report={report} />
          <Overview g={g} t={t} t0={t0} windowS={windowS} report={report} words={words} env={env.overview!} o={o} />

          <div style={{position: 'absolute', inset: 0, opacity: o}}>
            {/* voice */}
            <LaneHead g={g} base={g.voice.head} label="Voice" detail={`stand-in from the reel · ${report.voice.words} words · ${num(report.stems.voice.I)} LUFS`} value={lu('voice')} />
            <LanePanel g={g} top={g.voice.top} bot={g.voice.bot} />
            <WaveLane env={env.voice!} t0={t0} t1={t0 + windowS} width={g.laneW} height={g.voice.bot - g.voice.top} t={t} color={C.voice} dim={0.3} style={{left: g.laneL, top: g.voice.top}} />
            <WordBars g={g} t={t} t0={t0} windowS={windowS} words={words} />

            {/* music, with the gain the words produced */}
            <LaneHead
              g={g}
              base={g.music.head}
              label="Music"
              detail={`${num(report.duck?.params?.depth_db ?? -10, 0)} dB under every phrase · ${signed(report.duck?.params?.swell_db ?? 3, 0)} dB in holds`}
              value={
                <>
                  <span style={{color: C.mint}}>{`${signed(gainNow)} dB`}</span>
                  <span style={{color: C.detail}}>{` ${state} · `}</span>
                  {lu('music')}
                </>
              }
            />
            <LanePanel g={g} top={g.music.top} bot={g.music.bot} />
            <WaveLane env={env.music!} t0={t0} t1={t0 + windowS} width={g.laneW} height={g.music.bot - g.music.top} t={t} color={C.music} dim={0.3} style={{left: g.laneL, top: g.music.top}} />
            <GainCurve g={g} t0={t0} windowS={windowS} meters={meters} fps={fps} frame={frame} />

            {/* sound design */}
            <LaneHead g={g} base={g.sfx.head} label="Sound design" detail={`${report.sfx.length} cues · synthesized · placed on their frames`} value={lu('sfx')} />
            <LanePanel g={g} top={g.sfx.top} bot={g.sfx.bot} />
            <WaveLane env={env.sfx!} t0={t0} t1={t0 + windowS} width={g.laneW} height={g.sfx.bot - g.sfx.top} t={t} color={C.sfx} dim={0.3} rangeDb={48} style={{left: g.laneL, top: g.sfx.top}} />
            <CueLane g={g} t={t} t0={t0} windowS={windowS} groups={groups} f={cueF} />

            {/* time */}
            <div style={{position: 'absolute', left: Math.round(xPlay), top: g.voice.top - Math.round(0.004 * g.H), width: g.line, height: g.rulerTop - g.voice.top + Math.round(0.004 * g.H), background: C.value, opacity: 0.8}} />
            <Ruler g={g} t={t} t0={t0} windowS={windowS} frame={frame} />
          </div>

          <MasterColumn g={g} t={t} frame={frame} report={report} meters={meters} masterLv={masterLv} groups={groups} o={o} />

          <Captions utterances={words.utterances} t={t} scrim={false} />
          <Txt f={fontOf('bodySmall', H, {size: 0.021 * H, weight: 450})} x={g.mL} base={g.credit} c={C.label} W={W} o={0.85 * o}>
            {`Music: ${report.music.map((m) => `'${m.title ?? m.track}'`).join(' and ')} by Scott Buckley, CC BY 4.0, edited for length · Narration: a stand-in cut from the reel · Sound design: synthesized`}
          </Txt>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

export const demo: DemoSpec = {
  id: 'AudioDemo',
  component: AudioDemo,
  durationInFrames: 24 * 60,
  defaultProps: {dir: 'audio/demo', ext: 'flac', mode: 'master', windowS: 8},
};
