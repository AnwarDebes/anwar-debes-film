import React from 'react';
import {OffthreadVideo, Sequence, staticFile} from 'remotion';
import {emblemField, STEEL, SWEEPS, type Beat, type FieldFn, type LiveFieldFn, type PinSample} from '../../../engine/pins';
import {pushIn} from '../../../engine/camera';
import {color} from '../../../engine/tokens';
import {ChapterCard, KineticLine, WindowFrame} from '../../../engine/type';
import {Dust} from '../../../engine/fx';
import {HANDOFF} from '../../handoff';
import type {Env} from '../ch09/env';
import {chip, frame, move, plate} from '../ch09/common';
import {Card, MONO, Row, SANS, SERIF, Tag, fade, mint, screenOf} from '../ch09/kit/ui';
import {Pic, picField, treadmill, uvOf, wallPoint} from '../ch09/kit/pic';
import type {Times12} from './times';
import type {NoBand, RulerEntry} from './ruler';
import {
  PIPE_ROWS,
  SMOKE,
  SOL_TERMS,
  STREET_NAMES,
  burstPic,
  carPic,
  circuitPic,
  curvesPic,
  decayPic,
  dialPic,
  joulePic,
  minutesPic,
  pipePic,
  pyroPic,
  smokePic,
  stackPic,
  strataPic,
  streetPic,
} from './places';
import coverage from '../../../data/ch12/thermo-coverage.json';

const AMBER = color.signal.amber;

export const scenes12 = (env: Env, T: Times12, ruler: {entries: RulerEntry[]; noBand: NoBand[]; hide: Array<[number, number]>}) => {
  const {board: b, base, W, H} = env;
  const beat = (x: Beat) => env.beats.push(x);
  const scratch = {target: [0, 0, 0] as [number, number, number], distance: 1, yaw: 0, pitch: 0, roll: 0, fov: 18};
  const sp = (u: number, v: number, x: number, y: number, h: number, t: number) => {
    const [uu, vv] = uvOf(b, u, v, x, y);
    return screenOf(env.camera, t, wallPoint(b, uu, vv, h), W, H, scratch);
  };
  const dolly = (from: FieldFn, to: FieldFn, at: number, id: string) => {
    beat({id, at, field: to});
    env.live.push(treadmill(b, from, to, at, T.dollyDur));
    move(env, at, T.dollyDur, base);
  };

  // ------------------------------------------------------------------ 12.0 the page turns
  beat({id: 'c12-bare', at: T.ch.start, field: HANDOFF});
  env.camera.push({at: T.ch.start, pose: base});
  const [su0, sv0] = env.at(0.5, 0.46);
  const SPACING = 16.5;
  const street = streetPic(SPACING);
  const streetF = picField(b, street.pic, su0, sv0);
  const turnSpeed = 0.8;
  beat({id: 'c12-street', at: T.gate.turn, field: streetF, sweep: {...SWEEPS.raster([-1, 0], turnSpeed), origin: [1.02, 0.5], jitterS: 0.03}});
  // the lifted page edge: a ridge that runs right to left with the front, higher at the top corner
  const edge: PinSample = {h: 0, tint: STEEL};
  const pageFn: LiveFieldFn = (u, v, _i, t) => {
    const uf = 1.02 - turnSpeed * (t - T.gate.turn) + 0.035;
    const d = (u - uf) / 0.05;
    if (d < -3 || d > 3) return null;
    edge.h = (0.34 + 0.55 * v) * Math.exp(-d * d) * (d > 0 ? 1 : 0.7);
    edge.tint = 1.0;
    return edge;
  };
  env.live.push({fn: pageFn, from: T.gate.turn, to: T.gate.turn + 1.45, fadeS: 0.12, mode: 'add', speedHint: () => 1.4});
  move(env, T.gate.turn + 0.2, T.S1.start - T.gate.turn + 0.5, pushIn(base, 0.02), 'inOutSine');
  move(env, T.S1.start + 0.8, T.street.dolly - T.S1.start - 0.9, pushIn(base, 0.05), 'inOutSine');
  env.overlays.push({
    id: 'c12-card',
    from: T.gate.cardAt,
    to: T.gate.cardExit + 0.6,
    render: (t) => <ChapterCard index="12" kicker="eight repositories" title="Models of the everyday." at={T.gate.cardAt} exitAt={T.gate.cardExit} t={t} kind="headline" maxWidth={0.62 * W} kickerBaseline={Math.round(0.12 * H)} />,
  });
  env.cue(T.ch.start, 'idle', '');

  // ------------------------------------------------------------------ 12.1 the street
  env.cue(T.S1.start + 0.4, 'searching', 'Search results/validation.json in 8 repos');
  env.overlays.push({
    id: 'c12-street-names',
    from: T.S1.start,
    to: T.street.dolly + 0.6,
    render: (t) => (
      <>
        {STREET_NAMES.map((n, k) => {
          const [x, y] = sp(su0, sv0, street.xs[k], -5.4, 0.05, t);
          return <Tag key={n} x={x} y={y} text={n} sizeH={0.022} anchor="top" colorText={color.text.chipDim} opacity={fade(t, T.S1.start + 0.3 + k * 0.12, T.street.dolly + 0.1, 0.35, 0.4)} />;
        })}
      </>
    ),
  });
  chip(env, 'c12-chip-st-sleep', 'SleepArchitect', 'README.md', 134, T.street.medical - 0.2, T.street.medical + 1.8, 0);
  chip(env, 'c12-chip-st-caff', 'CaffeineSense', 'README.md', 117, T.street.medical + 0.1, T.street.medical + 2.1, 1);
  chip(env, 'c12-chip-st-car', 'HotCarWatch', 'README.md', 13, T.street.medical + 2.0, T.street.dolly + 0.1, 0);
  chip(env, 'c12-chip-st-pyro', 'PyroPredict', 'README.md', 82, T.street.medical + 2.3, T.street.dolly + 0.1, 1);
  chip(env, 'c12-chip-st-thermo', 'ThermoGuard', 'README.md', 87, T.street.medical + 2.6, T.street.dolly + 0.1, 2);

  // ------------------------------------------------------------------ 12.2 SleepArchitect
  const P = T.sleep;
  const [du, dv] = env.at(0.24, 0.43);
  const dial = emblemField(b, 'sleep', {u: du, v: dv, height: 40}, {ground: 0.62, glowAbove: 0.88});
  dolly(streetF, dial, T.street.dolly, 'c12-sleep-dial');
  plate(env, 'c12-sleep-plate', 'SleepArchitect', 'WORKING WEB APP + RESEARCH PROTOTYPE v0.1.0 · PAPER', P.plate, T.S3.start + 0.1);
  env.cue(P.plate - 0.2, 'reading', 'Read sleeparchitect/process_s.py');
  env.cue(P.readme + 0.6, 'writing', 'Edit README: 11 published → 9 published · 2 internal');
  env.cue(P.artefact - 0.2, 'reading', 'Read results/interventions.json');
  // the live app, captured frame by frame (scripts/record/shots/ch12.json)
  const rate = P.rate;
  const capFrom = env.ctx.tl.f(P.window);
  const winW = Math.round(0.46 * W);
  const winH = Math.round((winW * 1200) / 1920) + Math.round(0.046 * H);
  ruler.hide.push([P.window - 0.2, P.drake - 0.3]);
  env.overlays.push({
    id: 'c12-sleep-window',
    from: P.window,
    to: P.windowExit + 0.5,
    premountS: 1.0,
    render: (t) => (
      <WindowFrame x={Math.round(0.47 * W)} y={Math.round(0.16 * H)} width={winW} height={winH} product="SleepArchitect" descriptor="anwardebes.github.io/SleepArchitect · live capture" t={t} at={P.window} exitAt={P.windowExit} rotateY={-6} rotateX={1.5}>
        <Sequence from={capFrom} layout="none">
          <OffthreadVideo src={staticFile('recordings/ch12-sleeparchitect.mp4')} muted playbackRate={rate} style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
        </Sequence>
      </WindowFrame>
    ),
  });
  // Process S and C, then the seven named terms
  const [cu, cv] = env.at(0.55, 0.42);
  const [ku, kv] = env.at(0.875, 0.47);
  const curves = (withC: boolean, n: number): FieldFn => {
    const a = picField(b, curvesPic(56, 16, withC), cu, cv);
    const s = picField(b, stackPic(n), ku, kv);
    return (u, v, i) => (u > (cu + ku) / 2 ? s(u, v, i) : a(u, v, i));
  };
  beat({id: 'c12-sleep-curve', at: P.curve, field: curves(false, 0), sweep: {...SWEEPS.raster([1, 0], 0.55), origin: [cu - 34 * b.p, cv]}});
  beat({id: 'c12-sleep-c', at: P.curve + 1.1, field: curves(true, 0), sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [cu - 34 * b.p, cv]}});
  for (let k = 1; k <= 7; k++) beat({id: `c12-sleep-stack${k}`, at: P.stack + (k - 1) * 0.22, field: curves(true, k), sweep: {origin: uvOf(b, ku, kv, 0, (k - 1) * 3.4), speed: 0.5, jitterS: 0.02}});
  env.overlays.push({
    id: 'c12-sleep-labels',
    from: P.curve,
    to: P.drake + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, P.drake - 0.5, undefined, 0.4);
      const [x0, y0] = sp(cu, cv, 0, -3.2, 0.05, t);
      out.push(<Tag key="s" x={x0} y={y0} text="Process S: τ 18.2 h awake · 4.2 h asleep" sizeH={0.023} anchor="top" opacity={fade(t, P.curve + 0.4, undefined, 0.4) * gone} />);
      out.push(<Tag key="c" x={x0} y={y0 + 0.034 * H} text="Process C: two harmonics" sizeH={0.022} anchor="top" colorText={color.text.chipDim} opacity={fade(t, P.curve + 1.4, undefined, 0.4) * gone} />);
      const [nx, ny] = sp(cu, cv, 18.7, 20, 0.2, t);
      out.push(<Tag key="n" x={nx} y={ny} text="night" sizeH={0.022} colorText={color.text.tertiary} opacity={fade(t, P.curve + 0.6, undefined, 0.4) * gone} />);
      SOL_TERMS.forEach((term, k) => {
        const [x, y] = sp(ku, kv, -7.2, k * 3.4, 0.5, t);
        out.push(<Tag key={term} x={x} y={y} text={term} sizeH={0.022} align="right" opacity={fade(t, P.stack + k * 0.22 + 0.15, undefined, 0.3) * gone} />);
      });
      const [bx, by] = sp(ku, kv, 0, -3.4, 0.05, t);
      out.push(<Tag key="sum" x={Math.min(bx + 0.05 * W, 0.931 * W)} y={by} text="onset delay = a sum of named terms" sizeH={0.023} anchor="top" align="right" colorText={mint} opacity={fade(t, P.cause, undefined, 0.4) * gone} />);
      out.push(<Tag key="sch" x={Math.min(bx + 0.05 * W, 0.931 * W)} y={by + 0.034 * H} text="block heights schematic" sizeH={0.022} anchor="top" align="right" colorText={color.text.tertiary} opacity={fade(t, P.cause + 0.3, undefined, 0.4) * gone} />);
      return <>{out}</>;
    },
  });
  ruler.entries.push({id: 'drake', at: P.drake, value: 35.0, lo: 25, hi: 50, label: '400 mg at bedtime → 35.0 min · band 25–50', labelTo: T.S3.start - 0.3, house: 0});
  env.overlays.push({
    id: 'c12-sleep-cards',
    from: P.drake - 0.1,
    to: T.S3.start + 0.3,
    render: (t) => {
      const strike = Math.min(1, Math.max(0, (t - (P.readme + 0.7)) / 0.55));
      return (
        <>
          <Card t={t} at={P.drake - 0.1} exitAt={P.readme - 0.3} x={0.069 * W} y={0.24 * H} width={0.31 * W} kicker="results/validation.json · Drake 2013">
            <div style={{fontFamily: SANS, fontSize: Math.round(0.03 * H), color: color.text.display, lineHeight: 1.3}}>
              400 mg caffeine at bedtime → <b>35.0 min</b>
            </div>
            <div style={{marginTop: Math.round(0.01 * H), fontFamily: MONO, fontSize: Math.round(0.023 * H), color: color.text.chipDim}}>{'band 25–50 · within'}</div>
            <div style={{marginTop: Math.round(0.012 * H), fontFamily: SANS, fontSize: Math.round(0.026 * H), color: color.text.chipDim, opacity: fade(t, P.slope, undefined, 0.4)}}>
              the slope was <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.03 * H)}}>set to match</span>: 0.10 × (burden − 50)
            </div>
          </Card>
          <Card t={t} at={P.readme} exitAt={P.artefact - 0.3} x={0.069 * W} y={0.24 * H} width={0.33 * W} kicker="README.md:117">
            <div style={{position: 'relative', display: 'inline-block', fontFamily: SERIF, fontStyle: 'italic', fontSize: Math.round(0.032 * H), color: color.text.display}}>
              “All 11 published quantitative checks pass”
              <span style={{position: 'absolute', left: -4, top: '55%', height: Math.max(2, Math.round(0.0035 * H)), width: `calc(${(strike * 100).toFixed(1)}% + 8px)`, background: color.pixie.bodyHi, borderRadius: 2}} />
            </div>
            <div style={{marginTop: Math.round(0.016 * H), opacity: fade(t, P.internal, undefined, 0.4)}}>
              <div style={{fontFamily: MONO, fontSize: Math.round(0.021 * H), letterSpacing: '0.12em', color: color.accent.mintLabel}}>{'RESULTS/VALIDATION.JSON'}</div>
              <div style={{marginTop: Math.round(0.008 * H), fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'11 / 11 within band'}</div>
              <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: '#CFEFE4'}}>{'9 published · 2 internal'}</div>
            </div>
          </Card>
          <Card t={t} at={P.artefact} exitAt={T.S3.start - 0.2} x={0.069 * W} y={0.24 * H} width={0.36 * W} kicker="results/interventions.json · its own artefact">
            <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'weekend_bender · skip_alcohol'}</div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: Math.round(0.085 * H), color: color.text.display, lineHeight: 1.05, opacity: fade(t, P.lowers, undefined, 0.35)}}>
              −6.66
              <span style={{fontSize: Math.round(0.03 * H), fontWeight: 500, color: color.text.chipDim}}>{'  score'}</span>
            </div>
          </Card>
        </>
      );
    },
  });
  chip(env, 'c12-chip-sleep-readme', 'SleepArchitect', 'README.md', '21-28', P.plate + 0.4, P.windowExit - 0.2, 0);
  chip(env, 'c12-chip-sleep-s', 'SleepArchitect', 'sleeparchitect/process_s.py', '30-44', P.curve + 0.3, P.stack - 0.1, 0);
  chip(env, 'c12-chip-sleep-c', 'SleepArchitect', 'sleeparchitect/process_c.py', '32-56', P.curve + 1.2, P.drake - 0.3, 1);
  chip(env, 'c12-chip-sleep-f', 'SleepArchitect', 'sleeparchitect/forecast.py', '116-143', P.stack + 0.2, P.drake - 0.3, 0);
  chip(env, 'c12-chip-sleep-v', 'SleepArchitect', 'results/validation.json', '3-8', P.drake + 0.1, P.readme - 0.2, 0);
  chip(env, 'c12-chip-sleep-caf', 'SleepArchitect', 'sleeparchitect/caffeine.py', '67-73', P.slope, P.readme - 0.2, 1);
  chip(env, 'c12-chip-sleep-int', 'SleepArchitect', 'results/validation.json', '76-93', P.internal, P.artefact - 0.2, 0);
  chip(env, 'c12-chip-sleep-art', 'SleepArchitect', 'results/interventions.json', '119, 220-225', P.artefact + 0.2, T.S3.start - 0.2, 0);

  // ------------------------------------------------------------------ 12.3 CaffeineSense
  const C = T.caff;
  const [eu, ev] = env.at(0.58, 0.42);
  const [qu, qv] = env.at(0.84, 0.37);
  const caffAt = (half: number, lit: boolean): FieldFn => {
    const a = picField(b, decayPic(half, 46, 18), eu, ev);
    const d = picField(b, dialPic(13, 18.2944, 23, lit), qu, qv);
    return (u, v, i) => (u > (eu + qu) / 2 + 0.02 ? d(u, v, i) : a(u, v, i));
  };
  dolly(curves(true, 7), caffAt(5, false), P.dolly, 'c12-caff-plot');
  beat({id: 'c12-caff-smoker', at: C.smoker, field: caffAt(2.5, false), sweep: {...SWEEPS.raster([1, 0], 0.6), origin: [eu - 26 * b.p, ev]}});
  beat({id: 'c12-caff-preg', at: C.preg, field: caffAt(14.25, false), sweep: {...SWEEPS.raster([1, 0], 0.6), origin: [eu - 26 * b.p, ev]}});
  beat({id: 'c12-caff-base', at: C.clock - 0.2, field: caffAt(5, false), sweep: {...SWEEPS.raster([1, 0], 0.6), origin: [eu - 26 * b.p, ev]}});
  beat({id: 'c12-caff-clock', at: C.cutoff, field: caffAt(5, true), sweep: {origin: [qu, qv], speed: 0.5, jitterS: 0.03}});
  plate(env, 'c12-caff-plate', 'CaffeineSense', 'RESEARCH PROTOTYPE · LOCAL APP (NOT DEPLOYED)', C.plate, T.S4.start + 0.1);
  env.cue(C.plate - 0.1, 'thinking', 'Planning the last coffee…');
  ruler.entries.push(
    {id: 'caf-base', at: C.half, value: 5.0, lo: 3, hi: 7, label: 'baseline adult · 5.0 h · band 3–7', labelTo: C.smoker - 0.1, house: 1},
    {id: 'caf-smoker', at: C.smoker, value: 2.5, lo: 2, hi: 3.5, label: 'smoker · 2.5 h · band 2–3.5', labelTo: C.preg - 0.1, house: 1},
    {id: 'caf-preg', at: C.preg, value: 14.25, lo: 12, hi: 18, label: 'third trimester · 14.25 h · band 12–18', labelTo: C.clock - 0.3, house: 1},
  );
  env.overlays.push({
    id: 'c12-caff-labels',
    from: P.dolly + T.dollyDur,
    to: T.S4.start + 0.3,
    render: (t) => {
      const half = t < C.smoker ? '5.0' : t < C.preg ? '2.5' : t < C.clock - 0.2 ? '14.25' : '5.0';
      const who = t < C.smoker ? 'baseline adult' : t < C.preg ? 'smoker' : t < C.clock - 0.2 ? 'third trimester' : 'baseline adult';
      const [x, y] = sp(eu, ev, 0, -3.0, 0.05, t);
      const [cx, cy] = sp(qu, qv, 0, 15.4, 0.05, t);
      const gone = 1 - fade(t, T.S4.start - 0.5, undefined, 0.4);
      return (
        <>
          <Tag x={x} y={y} text={`what is left of one 96 mg coffee, hour by hour · half-life ${half} h · ${who}`} sizeH={0.023} anchor="top" opacity={fade(t, C.half, undefined, 0.4) * gone} />
          <Tag x={cx} y={cy - 0.05 * H} text="latest 96 mg coffee for a 23:00 bedtime" sizeH={0.022} anchor="bottom" colorText={color.text.chipDim} opacity={fade(t, C.cutoff + 0.2, undefined, 0.4) * gone} />
          <Tag x={cx} y={cy} text="18:18" sizeH={0.04} family={SANS} weight={700} anchor="bottom" colorText={mint} opacity={fade(t, C.cutoff + 0.35, undefined, 0.4) * gone} />
        </>
      );
    },
  });
  chip(env, 'c12-chip-caff-v', 'CaffeineSense', 'results/validation.json', '4-43', C.half, T.S4.start - 0.3, 0);
  chip(env, 'c12-chip-caff-p', 'CaffeineSense', 'caffeinesense/profile.py', 9, C.half + 0.3, C.clock - 0.3, 1);
  chip(env, 'c12-chip-caff-cut', 'CaffeineSense', 'results/cutoff_grid.json', '38-44', C.cutoff, T.S4.start - 0.3, 1);

  // ------------------------------------------------------------------ 12.4 HotCarWatch
  const R = T.car;
  const [au, av] = env.at(0.56, 0.255);
  const [mu, mv] = env.at(0.5, 0.37);
  const rows = [
    {label: 'crack the windows', minutes: 0.0, safe: false, val: '0.0 min'},
    {label: 'open halfway', minutes: 3.0, safe: false, val: '3.0'},
    {label: 'windshield sunshade', minutes: 16.5, safe: false, val: '16.5'},
    {label: 'do not leave the occupant', minutes: 9999, safe: true, val: 'guaranteed safe'},
    {label: 'park in the shade', minutes: 9999, safe: false, val: 'threshold never reached · not marked safe'},
    {label: 'engine and air conditioning on', minutes: 9999, safe: false, val: 'threshold never reached · not marked safe'},
  ];
  const carAt = (bar: number, shown: number): FieldFn => {
    const c = new Pic().put(carPic());
    // the cabin bar: schematic rise to the committed peak, 1 pin per 2 °C above 34
    const hh = Math.max(0.5, ((58.7 - 34) / 2) * bar);
    c.rect(24, hh / 2, 3.2, hh, {h: 0.6, tint: [1.08, 0.98, 0.9]}, 0.5, 0.4);
    const a = picField(b, c, au, av);
    const m = picField(b, minutesPic(rows, shown), mu, mv);
    return (u, v, i) => (v < av - (4 * b.p) / b.extH ? m(u, v, i) : a(u, v, i));
  };
  dolly(caffAt(5, true), carAt(0, 0), C.dolly, 'c12-car');
  beat({id: 'c12-car-cabin', at: R.cabin, field: carAt(1, 0), sweep: {...SWEEPS.raster([0, 1], 0.12), origin: [uvOf(b, au, av, 24, 0)[0], av]}});
  for (let k = 1; k <= 6; k++) beat({id: `c12-car-row${k}`, at: (k <= 1 ? R.zero : k <= 3 ? R.zero + (k - 1) * 0.5 : R.safe + (k - 4) * 0.55) - 0.05, field: carAt(1, k), sweep: {...SWEEPS.raster([1, 0], 0.5), origin: [mu, mv]}});
  plate(env, 'c12-car-plate', 'HotCarWatch', 'RESEARCH PROTOTYPE · LOCAL APP (NOT DEPLOYED)', R.plate, T.S5.start + 0.1);
  env.cue(R.plate - 0.1, 'reading', 'Read results/interventions.json');
  ruler.noBand.push({from: R.plate + 0.3, to: T.S5.start - 0.2, label: 'no band · HotCarWatch commits peaks, not published bands'});
  env.overlays.push({
    id: 'c12-car-labels',
    from: R.plate,
    to: T.S5.start + 0.3,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, T.S5.start - 0.5, undefined, 0.4);
      const [px, py] = sp(au, av, 26.6, (58.7 - 34) / 2 - 0.6, 0.6, t);
      out.push(<Tag key="pk" x={px} y={py} text="58.7 °C cabin peak" sizeH={0.024} align="left" anchor="top" opacity={fade(t, R.cabin + 1.2, undefined, 0.4) * gone} />);
      out.push(<Tag key="pk2" x={px} y={py + 0.036 * H} text={'schematic rise\ncommitted peak'} sizeH={0.022} align="left" anchor="top" colorText={color.text.tertiary} opacity={fade(t, R.cabin + 1.4, undefined, 0.4) * gone} />);
      const [dx, dy] = sp(au, av, -1, -3.4, 0.1, t);
      out.push(<Tag key="day" x={dx} y={dy} text="toddler · dark midsize sedan · 34 °C day" sizeH={0.022} anchor="top" colorText={color.text.chipDim} opacity={fade(t, R.day, undefined, 0.4) * gone} />);
      rows.forEach((r, k) => {
        const at = k === 0 ? R.zero : k <= 2 ? R.zero + k * 0.5 : R.safe + (k - 3) * 0.55;
        const [lx, ly] = sp(mu, mv, -1.6, -k * 3.2, 0.2, t);
        out.push(<Tag key={`l${k}`} x={lx} y={ly} text={r.label} sizeH={0.022} align="right" opacity={fade(t, at, undefined, 0.35) * gone} />);
        const len = r.minutes >= 9999 ? 0 : r.minutes;
        const [vx, vy] = sp(mu, mv, len + 2.4, -k * 3.2, 0.5, t);
        out.push(<Tag key={`v${k}`} x={r.minutes >= 9999 ? Math.min(vx + 0.03 * W, 0.6 * W) : vx} y={vy} text={r.val} sizeH={0.022} align="left" bg={r.minutes >= 9999} colorText={r.safe ? '#CFEFE4' : r.minutes >= 9999 ? color.text.chipDim : color.text.display} weight={r.safe ? 700 : 500} opacity={fade(t, at + 0.25, undefined, 0.35) * gone} />);
      });
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-car-caveat',
    from: R.never,
    to: T.S5.start + 0.3,
    render: (t) => <Tag x={0.069 * W} y={0.165 * H} text={'derived: the core model has no\nphysiological ceiling (62.2 °C in one row)'} sizeH={0.023} align="left" anchor="top" bg opacity={fade(t, R.never + 0.3, T.S5.start - 0.4, 0.4, 0.4)} />,
  });
  chip(env, 'c12-chip-car-iv', 'HotCarWatch', 'results/interventions.json', '10702-10713', R.zero, R.safe - 0.2, 0);
  chip(env, 'c12-chip-car-safe', 'HotCarWatch', 'results/interventions.json', '10690-10766', R.safe, T.S5.start - 0.3, 0);
  chip(env, 'c12-chip-car-readme', 'HotCarWatch', 'README.md', '105-109', R.safe + 0.3, R.never + 0.2, 1);
  chip(env, 'c12-chip-car-core', 'HotCarWatch', 'results/scenarios.json', 903, R.never + 0.45, T.S5.start - 0.3, 1);

  // ------------------------------------------------------------------ 12.5 SmokeShield
  const M = T.smoke;
  const [hu, hv] = env.at(0.655, 0.47);
  const smokeAt = (k: number) => picField(b, smokePic(k), hu, hv);
  dolly(carAt(1, 6), smokeAt(0), R.dolly, 'c12-smoke');
  beat({id: 'c12-smoke-settle', at: M.settle, field: smokeAt(1), sweep: {...SWEEPS.raster([0, -1], 0.08), origin: [hu, hv + (13 * b.p) / b.extH]}});
  plate(env, 'c12-smoke-plate', 'SmokeShield', 'RESEARCH PROTOTYPE · LOCAL APP (NOT DEPLOYED)', M.plate, T.S6.start + 0.1);
  env.cue(M.plate - 0.1, 'reading', 'Read results/validation.json');
  const hazeC = wallPoint(b, hu, hv + (8 * b.p) / b.extH, 0.8);
  env.world.push({
    id: 'c12-smoke-haze',
    from: M.haze - 0.2,
    to: M.dolly + 0.3,
    render: () => <Dust count={520} box={[0.64, 0.2, 0.12]} center={hazeC} drift={[0.004, 0.001, 0]} size={[0.0016, 0.0032]} brightness={0.32} colors={['#D8D2C8', '#B8B0A4']} opacity={(t) => fade(t, M.haze, T.S6.start - 0.6, 0.8, 0.8) * 0.9} seed={12} />,
  });
  env.overlays.push({
    id: 'c12-smoke-labels',
    from: M.haze,
    to: T.S6.start + 0.3,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, T.S6.start - 0.5, undefined, 0.4);
      const settle = Math.min(1, Math.max(0, (t - M.settle) / 1.4));
      SMOKE.forEach((s, k) => {
        const x0 = (k - 2) * 17;
        const [x, y] = sp(hu, hv, x0, -2.6, 0.1, t);
        out.push(<Tag key={`h${k}`} x={x} y={y} text={s.label.replace(' · ', '\n')} sizeH={0.022} anchor="top" colorText={color.text.chipDim} opacity={fade(t, M.haze + 0.2 + k * 0.1, undefined, 0.35) * gone} />);
        const now = Math.round(200 * (1 + (s.ratio - 1) * settle));
        const [vx, vy] = sp(hu, hv, x0, 22.5, 0.4, t);
        out.push(<Tag key={`v${k}`} x={vx} y={vy} text={`${now}`} sizeH={0.03} family={SANS} weight={700} anchor="bottom" opacity={fade(t, M.settle - 0.3, undefined, 0.35) * gone} />);
      });
      out.push(<Tag key="out" x={0.069 * W} y={0.27 * H} text={'outdoor 200 µg/m³ of wildfire smoke\nindoors, µg/m³ · settling schematic'} sizeH={0.023} align="left" anchor="top" bg opacity={fade(t, M.haze + 0.4, M.checks - 0.3, 0.4, 0.3) * gone} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-smoke-card',
    from: M.checks,
    to: T.S6.start + 0.3,
    render: (t) => (
      <Card t={t} at={M.checks} exitAt={T.S6.start - 0.3} x={0.069 * W} y={0.26 * H} width={0.3 * W} kicker="results/validation.json">
        <div style={{fontFamily: SANS, fontWeight: 700, fontSize: Math.round(0.06 * H), color: color.text.display}}>{'25 / 25'}</div>
        <div style={{fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim}}>{'in band'}</div>
        <div style={{marginTop: Math.round(0.012 * H), fontFamily: SANS, fontSize: Math.round(0.027 * H), color: color.text.chipDim, lineHeight: 1.3, opacity: fade(t, M.ratios - 0.2, undefined, 0.4)}}>
          a linear model: <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.031 * H)}}>5 ratios</span>, checked 5 times
        </div>
        <div style={{marginTop: Math.round(0.01 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.tertiary, opacity: fade(t, M.ratios, undefined, 0.4)}}>{'indoor = committed I/O ratio × 200'}</div>
      </Card>
    ),
  });
  SMOKE.forEach((s, k) => ruler.entries.push({id: `smoke${k}`, at: M.ratios - 0.3 + k * 0.16, value: s.ratio, lo: s.lo, hi: s.hi, label: k === 0 ? 'five I/O ratios, each in its band' : '', labelTo: T.S6.start - 0.3, house: 3}));
  chip(env, 'c12-chip-smoke-readme', 'SmokeShield', 'README.md', '63-65', M.plate + 0.4, M.checks - 0.2, 0);
  chip(env, 'c12-chip-smoke-v', 'SmokeShield', 'results/validation.json', '7, 254-255', M.checks, T.S6.start - 0.3, 0);

  // ------------------------------------------------------------------ 12.6 PipeGuard
  const G = T.pipe;
  const [pu, pv] = env.at(0.62, 0.3);
  const [bu, bv] = env.at(0.56, 0.4);
  const pipeAt = (frost: number, shown: number): FieldFn => {
    const a = picField(b, pipePic(frost), pu, pv);
    const c = picField(b, burstPic(shown), bu, bv);
    return (u, v, i) => (v > pv - (3.4 * b.p) / b.extH ? a(u, v, i) : c(u, v, i));
  };
  dolly(smokeAt(1), pipeAt(0, 0), M.dolly, 'c12-pipe');
  beat({id: 'c12-pipe-frost', at: G.frost, field: pipeAt(1, 0), sweep: {...SWEEPS.raster([1, 0], 0.18), origin: [pu - 37 * b.p, pv]}});
  PIPE_ROWS.forEach((_, k) => beat({id: `c12-pipe-row${k}`, at: (k < 3 ? G.drip + k * 0.35 : G.doors + (k - 3) * 0.4) - 0.05, field: pipeAt(1, k + 1), sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [bu, bv]}}));
  plate(env, 'c12-pipe-plate', 'PipeGuard', 'RESEARCH PROTOTYPE · LOCAL APP (NOT DEPLOYED)', G.plate, T.S7.start + 0.1);
  env.cue(G.plate - 0.1, 'reading', 'Read results/interventions.json');
  ruler.entries.push({id: 'pipe-tau', at: G.burst + 0.2, value: 0.6859, lo: 0.3, hi: 2, label: 'attic copper pipe · cooling τ 0.69 h · band 0.3–2', labelTo: T.S7.start - 0.3, house: 4});
  env.overlays.push({
    id: 'c12-pipe-labels',
    from: G.plate,
    to: T.S7.start + 0.3,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, T.S7.start - 0.5, undefined, 0.4);
      const [x, y] = sp(pu, pv, 0, 4.2, 0.5, t);
      out.push(<Tag key="p" x={x} y={y} text={'3/4" copper · uninsulated attic · burst 1.0'} sizeH={0.023} anchor="bottom" opacity={fade(t, G.burst, undefined, 0.4) * gone} />);
      const [sx, sy] = sp(pu, pv, 0, 7.6, 0.5, t);
      out.push(<Tag key="s" x={sx} y={sy} text="storm template: 7 days, +5 → −15 °C → +5 °C (schematic cooling)" sizeH={0.022} anchor="bottom" colorText={color.text.chipDim} opacity={fade(t, G.storm, undefined, 0.4) * gone} />);
      PIPE_ROWS.forEach((r, k) => {
        const at = k < 3 ? G.drip + k * 0.35 : G.doors + (k - 3) * 0.4;
        const [lx, ly] = sp(bu, bv, -1.4, -k * 3.2, 0.1, t);
        out.push(<Tag key={`l${k}`} x={lx} y={ly} text={r.label} sizeH={0.022} align="right" opacity={fade(t, at, undefined, 0.35) * gone} />);
        const [vx, vy] = sp(bu, bv, 21.6, -k * 3.2, 0.3, t);
        out.push(<Tag key={`c${k}`} x={vx} y={vy} text={`burst ${r.after.toFixed(1)} · ${r.cost}`} sizeH={0.022} align="left" colorText={r.after > 0 ? color.text.chipDim : '#CFEFE4'} opacity={fade(t, at + 0.2, undefined, 0.35) * gone} />);
      });
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-pipe-caveat',
    from: G.not,
    to: T.S7.start + 0.3,
    render: (t) => <Tag x={0.069 * W} y={0.27 * H} text={'saturated model:\n26 of 28 scenario-pipe pairs end at 1.0'} sizeH={0.023} align="left" anchor="top" bg opacity={fade(t, G.not + 0.3, T.S7.start - 0.4, 0.4, 0.4)} />,
  });
  chip(env, 'c12-chip-pipe-iv', 'PipeGuard', 'results/interventions.json', '3-87', G.drip, T.S7.start - 0.3, 0);
  chip(env, 'c12-chip-pipe-storm', 'PipeGuard', 'pipeguard/forecast.py', '50-61', G.storm, G.doors - 0.1, 1);
  chip(env, 'c12-chip-pipe-sat', 'PipeGuard', 'results/scenarios.json', 'per_scenario', G.not + 0.3, T.S7.start - 0.3, 1);
  chip(env, 'c12-chip-pipe-v', 'PipeGuard', 'results/validation.json', '4-9', G.burst + 0.3, G.storm - 0.2, 0);

  // ------------------------------------------------------------------ 12.7 HomeJoule
  const J = T.joule;
  const [ju, jv] = env.at(0.64, 0.56);
  const jp = (n: number) => joulePic(n);
  const jouleAt = (n: number) => picField(b, jp(n).pic, ju, jv);
  dolly(pipeAt(1, 5), jouleAt(0), G.dolly, 'c12-joule');
  for (let k = 1; k <= 14; k++) beat({id: `c12-joule-bar${k}`, at: J.bars + (k - 1) * 0.12, field: jouleAt(k), sweep: {origin: uvOf(b, ju, jv, (k - 7.5) * 3, jp(0).roofY), speed: 0.5, jitterS: 0.02}});
  plate(env, 'c12-joule-plate', 'HomeJoule', 'RESEARCH PROTOTYPE · LOCAL APP (NOT DEPLOYED)', J.plate, T.S8.start + 0.1);
  env.cue(J.plate - 0.1, 'reading', 'Read results/upgrades.json');
  [
    [12703, 9000, 14500],
    [9293.8, 7500, 11000],
    [8493.1, 7000, 10000],
    [7914, 6500, 9500],
    [7809.1, 6500, 9500],
    [7312.3, 6800, 8200],
    [6609.2, 6100, 7400],
    [6328, 5800, 6900],
    [5062.4, 4400, 5500],
    [6046.7, 5600, 6800],
  ].forEach(([v, lo, hi], k) => ruler.entries.push({id: `joule${k}`, at: J.irr + k * 0.1, value: v, lo, hi, label: k === 0 ? '10 benchmark cases · within (wide) bands' : '', labelTo: T.S8.start - 0.3, house: 5}));
  env.overlays.push({
    id: 'c12-joule-labels',
    from: J.bars,
    to: T.S8.start + 0.3,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, T.S8.start - 0.5, undefined, 0.4);
      const roofY = jp(0).roofY;
      const [hx, hy] = sp(ju, jv, -19.5, roofY + 0.282 * 50 + 1.2, 0.8, t);
      out.push(<Tag key="h" x={hx} y={hy} text="heat-pump water heater · 0.28" sizeH={0.024} anchor="bottom" align="left" colorText={mint} opacity={fade(t, J.hpwh, undefined, 0.4) * gone} />);

      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-joule-card',
    from: J.hpwh,
    to: T.S8.start + 0.3,
    render: (t) => (
      <Card t={t} at={J.irr} exitAt={T.S8.start - 0.3} x={0.069 * W} y={0.24 * H} width={0.3 * W} kicker="results/upgrades.json · mild_baltimore">
        <div style={{fontFamily: SANS, fontSize: Math.round(0.027 * H), color: color.text.chipDim, marginBottom: Math.round(0.012 * H)}}>14 upgrades · 25-year IRR after US tax credits</div>
        <div style={{fontFamily: MONO, fontSize: Math.round(0.026 * H), color: color.text.display}}>{'hpwh_replace  0.282'}</div>
        <div style={{marginTop: Math.round(0.01 * H), fontFamily: SANS, fontSize: Math.round(0.028 * H), color: color.text.chipDim}}>in 4 of 5 homes</div>
        <div style={{marginTop: Math.round(0.006 * H), fontFamily: SERIF, fontStyle: 'italic', fontSize: Math.round(0.03 * H), color: mint, opacity: fade(t, J.year, undefined, 0.4)}}>climate-independent in this model</div>
      </Card>
    ),
  });
  chip(env, 'c12-chip-joule-u', 'HomeJoule', 'results/upgrades.json', 23, J.bars + 0.3, T.S8.start - 0.3, 0);
  chip(env, 'c12-chip-joule-c', 'HomeJoule', 'homejoule/upgrades.py', '37-65', J.irr, J.hpwh - 0.2, 1);
  chip(env, 'c12-chip-joule-v', 'HomeJoule', 'results/validation.json', 'n_passed 10 of 10', J.hpwh + 0.2, T.S8.start - 0.3, 1);

  // ------------------------------------------------------------------ 12.8 PyroPredict
  const Y = T.pyro;
  const [yu, yv] = env.at(0.64, 0.355);
  const pyroAt = (burned: number, threats: number, aware: number) => picField(b, pyroPic({burned, threats, aware}), yu, yv);
  dolly(jouleAt(14), pyroAt(0, 0, 0), J.dolly, 'c12-pyro');
  beat({id: 'c12-pyro-spread', at: Y.spread, field: pyroAt(1, 0, 0), sweep: {origin: uvOf(b, yu, yv, -6, 27), speed: 0.1, jitterS: 0.03, tintFollowsWave: true}});
  beat({id: 'c12-pyro-threats', at: Y.threats, field: pyroAt(1, 1, 0), sweep: {...SWEEPS.raster([1, 0], 0.35), origin: [uvOf(b, yu, yv, -28, 0)[0], yv]}});
  beat({id: 'c12-pyro-aware', at: Y.aware, field: pyroAt(1, 1, 1), sweep: {origin: uvOf(b, yu, yv, -12, 22), speed: 0.3, jitterS: 0.02}});
  plate(env, 'c12-pyro-plate', 'PyroPredict', 'RESEARCH PROTOTYPE v0.1 · SYNTHETIC GRID · REPORT', Y.plate, T.S9.start + 0.1);
  env.cue(Y.plate - 0.1, 'reading', 'Read results/evacuation.json');
  ruler.noBand.push({from: Y.plate + 0.3, to: T.S9.start - 0.2, label: 'no band · a synthetic grid'});
  env.overlays.push({
    id: 'c12-pyro-labels',
    from: Y.grid,
    to: T.S9.start + 0.3,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const gone = 1 - fade(t, T.S9.start - 0.5, undefined, 0.4);
      const [tx, ty] = sp(yu, yv, 21.5, (50 - 15) * 0.38, 0.3, t);
      out.push(<Tag key="t" x={tx} y={ty} text={'two injected\nroad threats'} sizeH={0.022} align="left" colorText={mint} opacity={fade(t, Y.threats + 0.3, undefined, 0.4) * gone} />);
      const [fx, fy] = sp(yu, yv, 21.5, (50 - 4) * 0.38, 0.3, t);
      out.push(<Tag key="f" x={fx} y={fy} text={'burned, 4 h'} sizeH={0.022} align="left" colorText={color.text.chipDim} opacity={fade(t, Y.spread + 0.6, undefined, 0.4) * gone} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-pyro-card',
    from: Y.routes,
    to: T.S9.start + 0.3,
    render: (t) => (
      <Card t={t} at={Y.spread} exitAt={T.S9.start - 0.3} x={0.069 * W} y={0.2 * H} width={0.33 * W} kicker="results/evacuation.json · seed 0 · wind 45 km/h">
        <div style={{fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.tertiary, lineHeight: 1.4, marginBottom: Math.round(0.012 * H)}}>
          {'100 × 100 synthetic chaparral'}
          <br />
          {'fire front: read from figure · schematic in between'}
          <br />
          {'routes drawn schematically'}
        </div>
        <Row t={t} at={Y.routes + 0.2} kind="steel" sizeH={0.024}>{'naive routes   3,658 trapped'}</Row>
        <Row t={t} at={Y.aware + 0.2} kind="win" sizeH={0.024}>{'forecast-aware     0 trapped'}</Row>
        <Row t={t} at={Y.noroute} kind="miss" sizeH={0.024}>{'               1,716 no route'}</Row>
        <Row t={t} at={Y.noroute + 0.35} kind="miss" sizeH={0.024}>{'               2,892 safe, late'}</Row>
        <div style={{marginTop: Math.round(0.012 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: AMBER, opacity: fade(t, Y.scored, undefined, 0.4), lineHeight: 1.35}}>
          {'scored against the forecast it used:'}
          <br />
          {'0 trapped by construction'}
        </div>
      </Card>
    ),
  });
  chip(env, 'c12-chip-pyro-ev', 'PyroPredict', 'results/evacuation.json', '3-18', Y.routes + 0.2, T.S9.start - 0.3, 0);
  chip(env, 'c12-chip-pyro-code', 'PyroPredict', 'experiments/evacuation.py', '64-108, 202-206', Y.threats, Y.noroute - 0.2, 1);
  chip(env, 'c12-chip-pyro-land', 'PyroPredict', 'pyropredict/landscape.py', 194, Y.spread + 0.2, Y.threats - 0.2, 1);

  // ------------------------------------------------------------------ 12.9 ThermoGuard
  const Q = T.thermo;
  const [tu, tv] = env.at(0.29, 0.42);
  const [ru, rv] = env.at(0.7, 0.36);
  const thermoEmblem = emblemField(b, 'thermo', {u: tu, v: tv, height: 34}, {ground: STEEL});
  const circuitAt = (stage: number): FieldFn => {
    const c = picField(b, circuitPic(stage), ru, rv);
    return (u, v, i) => (u < (tu + ru) / 2 - 0.02 ? thermoEmblem(u, v, i) : c(u, v, i));
  };
  dolly(pyroAt(1, 1, 1), circuitAt(0), Y.dolly, 'c12-thermo');
  beat({id: 'c12-thermo-walls', at: Q.walls, field: circuitAt(1), sweep: {origin: uvOf(b, ru, rv, -6, -7), speed: 0.4, jitterS: 0.03}});
  beat({id: 'c12-thermo-air', at: Q.air, field: circuitAt(2), sweep: {origin: uvOf(b, ru, rv, 20, -7), speed: 0.4, jitterS: 0.03}});
  const cov = coverage as Array<{seed: number; greedy: Record<string, number>; equity: Record<string, number>}>;
  const [gu, gv] = env.at(0.66, 0.36);
  const strataAt = (which: 'none' | 'greedy' | 'equity'): FieldFn => {
    const pic = new Pic();
    cov.forEach((c, k) => pic.put(strataPic(which === 'none' ? null : which === 'greedy' ? c.greedy : c.equity), (k - 1) * 26, 0));
    return picField(b, pic, gu, gv);
  };
  beat({id: 'c12-thermo-strata', at: Q.city, field: strataAt('none'), sweep: {origin: [gu, gv], speed: 0.6, jitterS: 0.05}});
  beat({id: 'c12-thermo-greedy', at: Q.greedy, field: strataAt('greedy'), sweep: {...SWEEPS.booleanFlip([gu - 0.2, gv + 0.1])}});
  beat({id: 'c12-thermo-equity', at: Q.equity, field: strataAt('equity'), sweep: {...SWEEPS.booleanFlip([gu - 0.2, gv + 0.1])}});
  // the closing: the street returns in place, every house lit
  const [lu0, lv0] = env.at(0.5, 0.25);
  const litStreet = picField(b, streetPic(SPACING, [1, 1, 1, 1, 1, 1, 1, 1]).pic, lu0, lv0);
  beat({id: 'c12-thermo-street', at: Q.line, field: litStreet, sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [lu0 - 70 * b.p, lv0]}});
  beat({id: 'c12-end', at: Q.out, field: HANDOFF, sweep: {...SWEEPS.raster([1, 0], 0.7), origin: [lu0 - 70 * b.p, lv0]}});
  move(env, Y.dolly + T.dollyDur + 0.1, Q.city - Y.dolly - T.dollyDur - 0.3, pushIn(base, 0.04), 'inOutSine');
  move(env, Q.city - 0.2, 1.6, base);
  move(env, Q.city + 1.5, Q.line - Q.city - 1.7, pushIn(base, 0.04), 'inOutSine');
  move(env, Q.line - 0.2, 1.6, base);
  env.camera.push({at: Q.out, dur: 1.5, pose: base, ease: 'camera'});
  plate(env, 'c12-thermo-plate', 'ThermoGuard', 'RESEARCH PROTOTYPE v0.1 · DRAFT REPORT · SYNTHETIC CITY', Q.plate, Q.line - 0.2);
  env.cue(Q.plate - 0.1, 'reading', 'Read thermoguard/building.py');
  env.cue(Q.city - 0.1, 'thinking', 'Planning 80 visits and 160 kits…');
  env.cue(Q.report + 0.3, 'writing', 'Edit report row: random 3.50 → 0.94 (results file)');
  env.cue(Q.line, 'idle', '');
  ruler.noBand.push({from: Q.plate + 0.3, to: Q.line - 0.4, label: 'no band · a synthetic city'});
  env.overlays.push({
    id: 'c12-thermo-labels',
    from: Q.circuit,
    to: Q.line + 0.4,
    render: (t) => {
      const out: React.ReactNode[] = [];
      const circK = 1 - fade(t, Q.city - 0.4, undefined, 0.35);
      const L: Array<[number, number, string, number]> = [
        [-30, 2.6, 'outdoor', Q.circuit],
        [-19, 3.2, 'R_ext', Q.circuit + 0.2],
        [-6, -14.4, 'walls store heat (C_env)', Q.walls + 0.1],
        [7, 3.2, 'R_int', Q.circuit + 0.4],
        [20, -14.4, 'air follows (C_in)', Q.air + 0.1],
      ];
      for (const [x, y, s, at] of L) {
        const [px, py] = sp(ru, rv, x, y, 0.4, t);
        out.push(<Tag key={s} x={px} y={py} text={s} sizeH={0.022} anchor={y < 0 ? 'top' : 'bottom'} colorText={s.includes('(') ? mint : color.text.chipDim} opacity={fade(t, at, undefined, 0.35) * circK} />);
      }
      const gk = 1 - fade(t, Q.line - 0.4, undefined, 0.35);
      cov.forEach((c, k) => {
        const zero = Object.values(c.greedy).filter((v) => v === 0).length;
        const [x, y] = sp(gu, gv, (k - 1) * 26, -7.2, 0.1, t);
        out.push(<Tag key={`s${k}`} x={x} y={y} text={`seed ${c.seed}`} sizeH={0.022} anchor="top" colorText={color.text.tertiary} opacity={fade(t, Q.city + 0.3, undefined, 0.35) * gk} />);
        out.push(<Tag key={`z${k}`} x={x} y={y + 0.032 * H} text={t < Q.equity + 0.4 ? `${zero} of 15 groups\nget nothing` : 'every group\nreached'} sizeH={0.022} anchor="top" colorText={t < Q.equity + 0.4 ? color.text.display : '#CFEFE4'} opacity={fade(t, Q.greedy + 0.4, undefined, 0.35) * gk} />);
      });
      const [hx, hy] = sp(gu, gv, 0, -15.2, 0.4, t);
      out.push(<Tag key="hd" x={hx} y={hy} text="15 groups: 5 income quintiles × 3 age bands · 1,500 households" sizeH={0.022} anchor="top" colorText={color.text.chipDim} opacity={fade(t, Q.city + 0.2, undefined, 0.35) * gk} />);
      return <>{out}</>;
    },
  });
  env.overlays.push({
    id: 'c12-thermo-cards',
    from: Q.peak - 0.2,
    to: Q.line + 0.4,
    render: (t) => {
      const strike = Math.min(1, Math.max(0, (t - (Q.report + 0.45)) / 0.55));
      return (
        <>
          <Card t={t} at={Q.peak - 0.2} exitAt={Q.city - 0.3} x={0.069 * W} y={0.24 * H} width={0.32 * W} kicker="paper/thermoguard.tex:136 · figure caption">
            <div style={{fontFamily: SANS, fontSize: Math.round(0.028 * H), color: color.text.display}}>care home, top floor, no cooling</div>
            <div style={{fontFamily: SANS, fontWeight: 700, fontSize: Math.round(0.075 * H), color: color.text.display, lineHeight: 1.05}}>
              {'≈ 52 °C'}
              <span style={{fontSize: Math.round(0.028 * H), fontWeight: 500, color: color.text.chipDim}}>{'  outdoor peak 46 °C'}</span>
            </div>
            <div style={{marginTop: Math.round(0.006 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.tertiary}}>{'model · curves committed as a figure: read from figure'}</div>
          </Card>
          <Card t={t} at={Q.greedy} exitAt={Q.report - 0.3} x={0.069 * W} y={0.24 * H} width={0.3 * W} kicker="results/triage.json · 80 visits + 160 kits">
            <Row t={t} at={Q.greedy + 0.2} kind="steel" sizeH={0.024}>{'greedy        lives 5.43'}</Row>
            <div style={{marginLeft: Math.round(0.03 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, opacity: fade(t, Q.dark, undefined, 0.4)}}>{'min group coverage 0.00'}</div>
            <Row t={t} at={Q.equity + 0.2} kind="win" sizeH={0.024}>{'equity floor  lives 3.46'}</Row>
            <div style={{marginLeft: Math.round(0.03 * H), fontFamily: MONO, fontSize: Math.round(0.022 * H), color: color.text.chipDim, opacity: fade(t, Q.equity + 0.4, undefined, 0.4)}}>{'min group coverage 0.11'}</div>
            <div style={{marginTop: Math.round(0.012 * H), fontFamily: SANS, fontSize: Math.round(0.027 * H), color: color.text.chipDim, opacity: fade(t, Q.fewer + 0.6, undefined, 0.4)}}>
              the choice is left to <span style={{fontFamily: SERIF, fontStyle: 'italic', color: mint, fontSize: Math.round(0.031 * H)}}>public health</span>
            </div>
          </Card>
          <Card t={t} at={Q.report} exitAt={Q.line - 0.3} x={0.069 * W} y={0.24 * H} width={0.3 * W} kicker="paper/thermoguard.tex:247 · draft report">
            <div style={{position: 'relative', display: 'inline-block', fontFamily: MONO, fontSize: Math.round(0.028 * H), color: color.text.display}}>
              {'random allocator  3.50'}
              <span style={{position: 'absolute', left: -4, top: '55%', height: Math.max(2, Math.round(0.0035 * H)), width: `calc(${(strike * 100).toFixed(1)}% + 8px)`, background: color.pixie.bodyHi, borderRadius: 2}} />
            </div>
            <div style={{marginTop: Math.round(0.016 * H), opacity: fade(t, Q.file, undefined, 0.4)}}>
              <div style={{fontFamily: MONO, fontSize: Math.round(0.021 * H), letterSpacing: '0.12em', color: color.accent.mintLabel}}>{'RESULTS/TRIAGE.JSON:2519-2523'}</div>
              <div style={{marginTop: Math.round(0.008 * H), fontFamily: MONO, fontSize: Math.round(0.028 * H), color: '#CFEFE4'}}>{'random allocator  0.94'}</div>
            </div>
          </Card>
        </>
      );
    },
  });
  env.captionSkip.push('u1227');
  const u27 = env.ctx.tl.utt('u1227');
  env.overlays.push({
    id: 'c12-closing',
    from: Q.line,
    to: Q.out + 0.8,
    render: (t) => <KineticLine words={u27.words} t={t} kind="statement" sizeH={0.064} variant="rise" x={Math.round(0.069 * W)} y={Math.round(0.33 * H)} yAnchor="capTop" maxWidth={0.36 * W} exitAt={Q.out + 0.2} />,
  });
  chip(env, 'c12-chip-thermo-b', 'ThermoGuard', 'thermoguard/building.py', '1-24', Q.circuit, Q.peak - 0.3, 0);
  chip(env, 'c12-chip-thermo-fig', 'ThermoGuard', 'paper/thermoguard.tex', 136, Q.peak, Q.city - 0.3, 0);
  chip(env, 'c12-chip-thermo-risk', 'ThermoGuard', 'results/risk_stratification.json', '353, 361, 369', Q.city, Q.greedy - 0.2, 1);
  chip(env, 'c12-chip-thermo-tri', 'ThermoGuard', 'results/triage.json', '2524-2533', Q.greedy + 0.2, Q.report - 0.3, 0);
  chip(env, 'c12-chip-thermo-runs', 'ThermoGuard', 'results/triage.json', 'per_run · PNW_2021 · greedy', Q.dark, Q.report - 0.3, 1);
  chip(env, 'c12-chip-thermo-280', 'ThermoGuard', 'paper/thermoguard.tex', 280, Q.fewer, Q.report - 0.3, 2);
  chip(env, 'c12-chip-thermo-171', 'ThermoGuard', 'paper/thermoguard.tex', 171, Q.fewer + 0.6, Q.report - 0.3, 3);
  chip(env, 'c12-chip-thermo-247', 'ThermoGuard', 'paper/thermoguard.tex', 247, Q.report + 0.2, Q.line - 0.3, 0);
  chip(env, 'c12-chip-thermo-2519', 'ThermoGuard', 'results/triage.json', '2519-2523', Q.file, Q.line - 0.3, 1);
  // the 1,500 households and their concentration are in the card text above; keep the risk share honest
  env.overlays.push({
    id: 'c12-thermo-share',
    from: Q.city,
    to: Q.greedy + 0.4,
    render: (t) => <Tag x={0.069 * W} y={0.27 * H} text={'riskiest quarter of households:\n70–82% of expected deaths'} sizeH={0.023} align="left" anchor="top" bg opacity={fade(t, Q.city + 0.2, Q.greedy - 0.2, 0.4, 0.3)} />,
  });
  return {litStreet};
};
