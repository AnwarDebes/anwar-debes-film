import {hash01, seedOf} from '../../../engine/pins';
import {Pic, type Look} from '../ch09/kit/pic';

// Pin pictures of chapter 12's street. Units are pins (y up) around each place's origin.

const STEELLOOK = (h: number, tint = 1.0): Look => ({h, tint});

/** A house in pins: body, pitched roof, a door. (x, y) is the middle of its ground line. */
export const house = (pic: Pic, x: number, y: number, w: number, h: number, look: Look = STEELLOOK(0.45), lit = 0) => {
  const body: Look = {...look, glow: lit * 0.6};
  pic.rect(x, y + h / 2, w, h, body, 0.6, 0.5);
  const roof = h * 0.62;
  pic.line(
    [
      [x - w / 2 - 1.2, y + h - 0.2],
      [x, y + h + roof],
      [x + w / 2 + 1.2, y + h - 0.2],
    ],
    0.75,
    {h: look.h + 0.12, tint: 1.04, glow: lit},
    0.5,
    'max',
  );
  pic.rect(x, y + h * 0.28, w * 0.2, h * 0.56, {h: Math.max(0.02, look.h - 0.3), tint: 0.5}, 0.3, 0.4);
};

export const STREET_NAMES = ['SleepArchitect', 'CaffeineSense', 'HotCarWatch', 'SmokeShield', 'PipeGuard', 'HomeJoule', 'PyroPredict', 'ThermoGuard'] as const;

/** The street of eight houses on one line; `lit[k]` lights house k. Returns x of each house. */
export const streetPic = (spacing: number, lit: readonly number[] = []) => {
  const pic = new Pic();
  const xs: number[] = [];
  for (let k = 0; k < 8; k++) {
    const x = (k - 3.5) * spacing;
    xs.push(x);
    pic.rect(x, -1.6, spacing * 0.78, 2.2, {h: 0.05, tint: 0.62}, 0.8, 0.5);
    house(pic, x, 0, 9, 7, STEELLOOK(0.42, 0.98), lit[k] ?? 0);
  }
  pic.seg(-4 * spacing, -3.4, 4 * spacing, -3.4, 0.4, {h: 0.12, tint: 0.85});
  return {pic, xs};
};

// ---------------------------------------------------------------- SleepArchitect

/** Process S over a day (wake 07:00, bed 23:00): tau 18.2 h awake, 4.2 h asleep (process_s.py:30-44). */
export const processS = (hourFrom7: number) => {
  const S0 = 0.2;
  const tw = Math.min(hourFrom7, 16);
  const Sw = 1 - (1 - S0) * Math.exp(-tw / 18.2);
  if (hourFrom7 <= 16) return Sw;
  return Sw * Math.exp(-(hourFrom7 - 16) / 4.2);
};

/** Process C, the two-harmonic wave (process_c.py:36-46), intermediate chronotype (nadir 03:00). */
export const processC = (clockH: number) => {
  const tRel = (((clockH - 3) % 24) + 24) % 24;
  return 0.12 * Math.sin((2 * Math.PI * tRel) / 24) + 0.04 * Math.sin((4 * Math.PI * tRel) / 24);
};

export const curvesPic = (W: number, Hh: number, withC: boolean) => {
  const pic = new Pic();
  const ptsS: Array<[number, number]> = [];
  const ptsC: Array<[number, number]> = [];
  for (let k = 0; k <= 96; k++) {
    const h = (k / 96) * 24;
    const x = -W / 2 + (k / 96) * W;
    ptsS.push([x, processS(h) * Hh]);
    ptsC.push([x, Hh * 0.5 + processC((h + 7) % 24) * Hh * 2.2]);
  }
  pic.seg(-W / 2, -0.8, W / 2, -0.8, 0.32, {h: 0.12, tint: 0.85});
  // night (23:00-07:00) as a low slab
  pic.rect(W / 2 - W / 6, Hh * 0.45, W / 3, Hh * 0.9 + 3, {h: 0.03, tint: 0.62}, 1, 0.6);
  pic.line(ptsS, 0.62, {h: 0.6, tint: 1.04, glow: 0.25}, 0.5, 'max');
  if (withC) pic.line(ptsC, 0.42, {h: 0.34, tint: 0.9}, 0.45, 'max');
  return pic;
};

/** The seven named terms of the onset delay (forecast.py:116-143), as a stack of blocks. */
export const SOL_TERMS = ['sol_base', 'sol_caff', 'sol_alc', 'sol_ex', 'sol_meal', 'sol_screen', 'sol_light'] as const;
export const stackPic = (n: number) => {
  const pic = new Pic();
  for (let k = 0; k < n; k++) pic.rect(0, k * 3.4, 12, 2.7, {h: 0.4 + 0.05 * k, tint: 0.92 + 0.02 * k}, 0.6, 0.45);
  return pic;
};

// ---------------------------------------------------------------- CaffeineSense

/** One 96 mg coffee, half-life h: hourly bars of what is left (an illustration of the half-life). */
export const decayPic = (half: number, W: number, Hh: number) => {
  const pic = new Pic();
  const hours = 12;
  for (let k = 0; k <= hours; k++) {
    const left = Math.pow(0.5, k / half);
    const x = -W / 2 + (k / hours) * W;
    pic.rect(x, (left * Hh) / 2, W / hours - 1.2, Math.max(0.6, left * Hh), {h: 0.32 + 0.3 * left, tint: 0.88 + 0.14 * left}, 0.4, 0.4);
  }
  pic.seg(-W / 2 - 2, -0.9, W / 2 + 2, -0.9, 0.32, {h: 0.12, tint: 0.85});
  return pic;
};

/** A 24-hour dial with a lit arc from `fromH` to `toH`. */
export const dialPic = (R: number, fromH: number, toH: number, lit: boolean) => {
  const pic = new Pic();
  pic.ring(0, 0, R, 0.55, {h: 0.34, tint: 0.92}, 0.45);
  for (let h = 0; h < 24; h++) {
    const a = Math.PI / 2 - (h / 24) * Math.PI * 2;
    const r0 = R - (h % 6 === 0 ? 2.6 : 1.4);
    pic.seg(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * (R - 0.5), Math.sin(a) * (R - 0.5), 0.32, {h: 0.4, tint: 1.0}, 0.35);
  }
  if (lit) {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 24; k++) {
      const h = fromH + ((toH - fromH) * k) / 24;
      const a = Math.PI / 2 - (h / 24) * Math.PI * 2;
      pts.push([Math.cos(a) * (R - 4), Math.sin(a) * (R - 4)]);
    }
    pic.line(pts, 0.8, {h: 0.6, tint: 1.04, glow: 0.9}, 0.45, 'max');
    const a = Math.PI / 2 - (fromH / 24) * Math.PI * 2;
    pic.seg(0, 0, Math.cos(a) * (R - 3), Math.sin(a) * (R - 3), 0.5, {h: 0.7, tint: 1.04}, 0.45, 'max');
  }
  pic.disc(0, 0, 1.2, {h: 0.6, tint: 1.04}, 0.4);
  return pic;
};

// ---------------------------------------------------------------- HotCarWatch

export const carPic = () => {
  const pic = new Pic();
  pic.rect(0, 3.2, 30, 5.4, {h: 0.5, tint: 0.42}, 2.2, 0.5);
  pic.line(
    [
      [-9, 5.8],
      [-5, 10.4],
      [6.5, 10.4],
      [10.5, 5.8],
    ],
    0.8,
    {h: 0.5, tint: 0.45},
    0.5,
    'max',
  );
  pic.rect(0.6, 8.0, 15, 4.0, {h: 0.12, tint: 0.3}, 0.8, 0.5);
  for (const x of [-9, 9]) {
    pic.disc(x, 0.6, 3.0, {h: 0.6, tint: 0.3}, 0.45);
    pic.disc(x, 0.6, 1.2, {h: 0.7, tint: 0.95}, 0.4);
  }
  return pic;
};

/** Minutes bought, as horizontal bars (1 pin per minute); 9999 runs off the frame. */
export const minutesPic = (rows: ReadonlyArray<{minutes: number; safe: boolean}>, shown: number) => {
  const pic = new Pic();
  rows.forEach((r, k) => {
    if (k >= shown) return;
    const y = -k * 3.2;
    const len = r.minutes >= 9999 ? 160 : r.minutes;
    pic.disc(0, y, 0.9, {h: 0.4, tint: 0.95}, 0.4);
    if (len > 0.05) pic.rect(len / 2 + 0.6, y, len, 1.8, r.safe ? {h: 0.5, tint: 1.04, glow: 0.7} : {h: 0.4, tint: 0.95}, 0.5, 0.4);
  });
  return pic;
};

// ---------------------------------------------------------------- SmokeShield

export const SMOKE = [
  {id: 'leaky_old_no_hvac', label: 'leaky old · no HVAC', ratio: 0.7285714285714286, lo: 0.6, hi: 0.9},
  {id: 'typical_modern_merv8', label: 'modern · MERV 8', ratio: 0.25, lo: 0.2, hi: 0.4},
  {id: 'tight_modern_merv13', label: 'tight · MERV 13', ratio: 0.05909090909090909, lo: 0.05, hi: 0.2},
  {id: 'apartment_window_open', label: 'apartment · window open', ratio: 0.9096385542168675, lo: 0.8, hi: 0.95},
  {id: 'passive_house_hepa', label: 'passive house · HEPA', ratio: 0.03648648648648649, lo: 0.02, hi: 0.1},
] as const;

export const smokePic = (settled: number) => {
  const pic = new Pic();
  SMOKE.forEach((s, k) => {
    const x = (k - 2) * 17;
    house(pic, x, 0, 12, 13, {h: 0.3, tint: 0.85});
    const level = 1 + (s.ratio - 1) * settled;
    pic.rect(x, 0.4 + (level * 11.6) / 2, 9.6, Math.max(0.4, level * 11.6), {h: 0.58, tint: [0.92, 0.9, 0.86]}, 0.5, 0.45);
  });
  pic.seg(-44, -0.9, 44, -0.9, 0.35, {h: 0.12, tint: 0.85});
  return pic;
};

// ---------------------------------------------------------------- PipeGuard

export const PIPE_ROWS = [
  {id: 'drip_cold_faucet', label: 'drip the cold faucet', after: 0, cost: '$0.20/day'},
  {id: 'heat_tape', label: 'heat tape', after: 0, cost: '$35 + $0.40/day'},
  {id: 'shut_off_water', label: 'shut off the water', after: 0, cost: '$0'},
  {id: 'open_cabinet_doors', label: 'open the cabinet doors', after: 1, cost: '$0'},
  {id: 'foam_sleeve', label: 'foam sleeve', after: 1, cost: '$12'},
] as const;

export const pipePic = (frost: number) => {
  const pic = new Pic();
  const cold: Look = {h: 0.5, tint: [0.86 + 0.1 * (1 - frost), 0.94 + 0.04 * (1 - frost), 1.08], glow: 0};
  pic.seg(-36, 0, 36, 0, 1.6, frost > 0 ? cold : {h: 0.5, tint: [1.08, 0.86, 0.7]}, 0.5);
  for (const x of [-36, 36]) pic.rect(x, 0, 2.4, 4.6, {h: 0.62, tint: 1.0}, 0.5, 0.4);
  if (frost > 0)
    for (let k = 0; k < 40; k++) {
      const x = -34 + k * 1.75;
      if (hash01(seedOf('c12-frost'), k) > frost) continue;
      pic.disc(x, (hash01(seedOf('c12-frost2'), k) - 0.5) * 2.6, 0.55, {h: 0.66, tint: [0.92, 1.0, 1.12]}, 0.3, 'max');
    }
  return pic;
};

/** Burst probability after each intervention, one row each: a 20-pin track filled to the value. */
export const burstPic = (shown: number) => {
  const pic = new Pic();
  PIPE_ROWS.forEach((r, k) => {
    if (k >= shown) return;
    const y = -k * 3.2;
    pic.rect(10, y, 20, 1.9, {h: 0.06, tint: 0.6}, 0.6, 0.4);
    if (r.after > 0) pic.rect((r.after * 20) / 2, y, r.after * 20, 1.7, {h: 0.5, tint: 0.95}, 0.6, 0.4);
    else pic.disc(0.4, y, 0.8, {h: 0.5, tint: [0.86, 1.06, 0.98], glow: 0.6}, 0.35);
  });
  return pic;
};

// ---------------------------------------------------------------- HomeJoule

/** mild_baltimore, ranked (results/upgrades.json, the first archetype). n/a = no IRR. */
export const JOULE = [
  ['hpwh_replace', 0.282],
  ['solar_pv_10kW', 0.096],
  ['solar_pv_5kW', 0.087],
  ['air_sealing', 0.08],
  ['mini_split', 0.036],
  ['heat_pump_dryer', 0.035],
  ['attic_insulation', 0.029],
  ['battery_10kWh', 0.029],
  ['geothermal', -0.036],
  ['ashp_replace', -0.04],
  ['windows', -0.042],
  ['ashp_cold_climate', -0.042],
  ['wall_insulation', -0.073],
  ['led_lighting', null],
] as const;

export const joulePic = (shown: number) => {
  const pic = new Pic();
  house(pic, 0, 0, 44, 10, {h: 0.3, tint: 0.86});
  const roofY = 10 + 10 * 0.62 + 1.4;
  JOULE.forEach(([, irr], k) => {
    if (k >= shown) return;
    const x = (k - 6.5) * 3.0;
    const v = irr === null ? 0 : irr;
    const h = v > 0 ? v * 50 : 0.8;
    pic.rect(x, roofY + h / 2, 2.1, h, k === 0 ? {h: 0.7, tint: 1.04, glow: 0.45} : v > 0 ? {h: 0.5, tint: 0.95} : {h: 0.05, tint: 0.45}, 0.4, 0.4);
  });
  return {pic, roofY};
};

// ---------------------------------------------------------------- PyroPredict

/** The synthetic grid at 0.6 pins per cell; cells are (row from the top, col). */
export const PYRO = {pinsPerCell: 0.38, n: 100} as const;
const cellXY = (r: number, c: number): [number, number] => [(c - 50) * PYRO.pinsPerCell, (50 - r) * PYRO.pinsPerCell];

export const pyroPic = (o: {burned: number; threats: number; aware: number}) => {
  const pic = new Pic();
  const s = PYRO.pinsPerCell;
  pic.rect(0, 0, 100 * s, 100 * s, {h: 0.12, tint: 0.7}, 0.6, 0.6);
  // short grass in the south-west corner (landscape_and_spread.png)
  pic.rect(...cellXY(87, 16), 32 * s, 26 * s, {h: 0.06, tint: 0.82}, 2, 1.2);
  // roads: rows 10 and 20, cols 15 and 60
  for (const r of [10, 20]) pic.seg(...cellXY(r, 0), ...cellXY(r, 100), 0.55, {h: 0.04, tint: 0.95}, 0.4);
  for (const c of [15, 60]) pic.seg(...cellXY(0, c), ...cellXY(100, c), 0.55, {h: 0.04, tint: 0.95}, 0.4);
  // the wildland-urban interface: homes in rows 5-24, cols 5-30
  for (let r = 6; r < 24; r += 2.6)
    for (let c = 6; c < 30; c += 2.6) {
      if (Math.abs(r - 10) < 1.3 || Math.abs(r - 20) < 1.3 || Math.abs(c - 15) < 1.3) continue;
      pic.disc(...cellXY(r, c), 0.48, {h: 0.42, tint: 1.0}, 0.3);
    }
  // the burned block after 4 h (rows 0-9, cols 24-57, read from the figure), growing from the ignition
  if (o.burned > 0) {
    const c0 = 40 - (40 - 24) * o.burned;
    const c1 = 40 + (57 - 40) * o.burned;
    const r1 = 9 * o.burned + 1;
    const [x0, y0] = cellXY(0, c0);
    const [x1, y1] = cellXY(r1, c1);
    pic.rect((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y0 - y1, {h: 0.02, tint: 0.22}, 0.4, 0.6);
    pic.seg(x0, y1, x1, y1, 0.5, {h: 0.55, tint: 1.08, glow: 0.3}, 0.4);
  }
  // the two injected road threats (experiments/evacuation.py:64-74): row 20 cols 5-45, row 10 cols 5-30
  if (o.threats > 0) {
    pic.seg(...cellXY(20, 5), ...cellXY(20, 5 + 40 * o.threats), 0.7, {h: 0.5, tint: 1.06, glow: 0.6}, 0.4, 'max');
    pic.seg(...cellXY(10, 5), ...cellXY(10, 5 + 25 * o.threats), 0.7, {h: 0.5, tint: 1.06, glow: 0.6}, 0.4, 'max');
  }
  // aware routes turn away: north-east exits along col 60
  // routes (schematic): naive south across highway 20, forecast-aware east to the col-60 road
  if (o.threats > 0) pic.line([cellXY(15, 18), cellXY(15, 15), cellXY(32, 15)], 0.42, {h: 0.26, tint: 0.85}, 0.4, 'max');
  if (o.aware > 0)
    pic.line(
      [
        cellXY(15, 18),
        cellXY(15, 18 + 42 * Math.min(1, o.aware * 1.6)),
        ...(o.aware > 0.62 ? [cellXY(15 + 30 * Math.min(1, (o.aware - 0.62) / 0.38), 60)] : []),
      ],
      0.5,
      {h: 0.36, tint: 1.02, glow: 0.55},
      0.4,
      'max',
    );
  return pic;
};

// ---------------------------------------------------------------- ThermoGuard

/** The 2R-2C circuit (building.py:1-24): outdoor -R_ext- envelope (C_env) -R_int- indoor (C_in). */
export const circuitPic = (stage: number) => {
  const pic = new Pic();
  const wire: Look = {h: 0.3, tint: 0.92};
  const zig = (x0: number, x1: number) => {
    const pts: Array<[number, number]> = [[x0, 0]];
    const n = 8;
    for (let k = 1; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, k % 2 ? 1.6 : -1.6]);
    pts.push([x1, 0]);
    pic.line(pts, 0.42, {h: 0.5, tint: 1.0}, 0.4, 'max');
  };
  const cap = (x: number, big: boolean, lit: number) => {
    const w = big ? 9 : 4.5;
    pic.seg(x, 0, x, -6, 0.42, wire, 0.4);
    pic.seg(x - w / 2, -6, x + w / 2, -6, 0.6, {h: 0.6, tint: 1.04, glow: 0.5 * lit}, 0.4);
    pic.seg(x - w / 2, -8, x + w / 2, -8, 0.6, {h: 0.6, tint: 1.04, glow: 0.5 * lit}, 0.4);
    pic.seg(x, -8, x, -12, 0.42, wire, 0.4);
  };
  pic.disc(-30, 0, 1.6, {h: 0.6, tint: 1.04}, 0.4);
  pic.seg(-30, 0, -24, 0, 0.42, wire, 0.4);
  zig(-24, -14);
  pic.seg(-14, 0, -6, 0, 0.42, wire, 0.4);
  pic.disc(-6, 0, 1.4, {h: 0.6, tint: 1.04}, 0.4);
  cap(-6, true, stage >= 1 ? 1 : 0);
  pic.seg(-6, 0, 2, 0, 0.42, wire, 0.4);
  zig(2, 12);
  pic.seg(12, 0, 20, 0, 0.42, wire, 0.4);
  pic.disc(20, 0, 1.4, {h: 0.6, tint: 1.04}, 0.4);
  cap(20, false, stage >= 2 ? 1 : 0);
  pic.seg(-30, -12, 20, -12, 0.42, wire, 0.4);
  return pic;
};

/** 15 groups (5 income quintiles x 3 age bands) as tiles lit by their coverage. */
export const STRATA = ['q1', 'q2', 'q3', 'q4', 'q5'].flatMap((q) => ['0-64', '65-74', '75+'].map((a) => `${q}_${a}`));
export const strataPic = (cov: Record<string, number> | null, scale = 1) => {
  const pic = new Pic();
  STRATA.forEach((k, j) => {
    const q = Math.floor(j / 3);
    const a = j % 3;
    const x = (q - 2) * 4.2 * scale;
    const y = (1 - a) * 4.2 * scale;
    const c = cov ? cov[k] ?? 0 : 0;
    pic.rect(x, y, 3.4 * scale, 3.4 * scale, cov === null ? {h: 0.2, tint: 0.7} : c > 0 ? {h: 0.3 + Math.min(0.5, c * 1.6), tint: 1.04, glow: Math.min(1, 0.3 + c * 3)} : {h: 0.03, tint: 0.4}, 0.6, 0.4);
  });
  return pic;
};
