// The checks behind scripts/pixie/verify.mjs. Each section prints one line; any
// mismatch makes run() return 1.
import {readFileSync, existsSync} from 'node:fs';
import {resolve as resolvePath} from 'node:path';
import {
  PIXIE_STATES,
  SCENE_H,
  SCENE_W,
  mirrorRects,
  pixieRects,
  resolveTimeline as resolveCore,
  samplePixie,
  toDevice,
  type PixieState,
  type Rect,
} from '../../src/pixie/pixie-core.ts';
import {resolveTimeline, walkAt, walkArrivalFrame, type PixieCue} from '../../src/pixie/timeline.ts';
import {CompiledPixie, emptySample} from '../../src/pixie/sampler.ts';
import {blinkScheduleFor, isBlinkingAt, pixiePose} from '../../src/pixie/pose.ts';
import {pixieField, type PixiePinSample} from '../../src/pixie/field.ts';
import {decompose, type DeviceRect} from '../../src/pixie/assemble.ts';
import {rasterize, readPng} from './png.ts';

type Row = {name: string; compared: number; bad: number; note?: string};

// Small deterministic PRNG for test points (not used by the film).
const lcg = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

export async function run(dirArg?: string): Promise<number> {
  const dir = resolvePath(dirArg ?? 'research/pixie-golden');
  const golden = JSON.parse(readFileSync(`${dir}/golden-rects.json`, 'utf8'));
  const fsm = JSON.parse(readFileSync(`${dir}/fsm-trace.json`, 'utf8'));
  const rows: Row[] = [];
  const log = (msg: string) => console.log(`  ${msg}`);

  // 1. Geometry against the original's recorded rects.
  {
    let compared = 0;
    let bad = 0;
    const same = (a: unknown[], b: unknown[]) =>
      a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
    const check = (label: string, mine: Rect[], ref: unknown[][]) => {
      if (mine.length !== ref.length) {
        bad++;
        log(`MISMATCH ${label}: ${mine.length} rects vs ${ref.length}`);
        return;
      }
      for (let i = 0; i < ref.length; i++) {
        compared++;
        if (!same(mine[i], ref[i])) {
          bad++;
          log(`MISMATCH ${label} #${i}: ${JSON.stringify(mine[i])} vs ${JSON.stringify(ref[i])}`);
          return;
        }
      }
    };
    for (const s of PIXIE_STATES) {
      const g = golden.frames[s];
      golden.times.forEach((t: number, k: number) => {
        check(`${s} t=${t} open`, pixieRects(s, t), g.open[k]);
        check(`${s} t=${t} blink`, pixieRects(s, t, {blinking: true}), g.blink[k]);
      });
      check(`${s} reduced`, pixieRects(s, 12.34, {reduced: true, blinking: true}), g.reduced[0]);
    }
    rows.push({name: 'geometry vs golden-rects.json (rects)', compared, bad});
  }

  // 2. State machine: the core and the film timeline against the original's trace.
  {
    const cues = fsm.cues.map(([frame, activity]: [number, string]) => ({frame, activity}));
    const last = fsm.trace[fsm.trace.length - 1][0];
    const core = resolveCore(cues, fsm.fps, last);
    const film = resolveTimeline(cues as PixieCue[], fsm.fps);
    let bad = 0;
    for (const [f, st, tg, lb] of fsm.trace) {
      const a = core[f];
      const b = film.at(f);
      if (a.state !== st || a.target !== tg || a.label !== lb) bad++;
      if (b.state !== st || b.target !== tg || b.label !== lb) {
        bad++;
        if (bad < 5) log(`FSM MISMATCH f${f}: ${b.state}/${b.target}/${b.label} vs ${st}/${tg}/${lb}`);
      }
    }
    // Memo: same content, new array -> same timeline object; frames past the end hold.
    if (resolveTimeline([...cues] as PixieCue[], fsm.fps) !== film) bad++;
    if (film.at(100000) !== film.at(film.lastFrame)) bad++;
    rows.push({name: 'state machine vs fsm-trace.json (core + film timeline, frames)', compared: fsm.trace.length * 2, bad});
  }

  // 3. Card text semantics: label leads the pose, persists after one-shots; detail rules.
  {
    let bad = 0;
    const fps = 60;
    const tl = resolveTimeline(
      [
        {frame: 10, activity: 'reading', detail: 'Read README.md'},
        {frame: 14, activity: 'searching'},
        {frame: 100, activity: 'success', detail: '2 tests pass'},
        {frame: 300, activity: 'searching'}, // detail undefined: kept
        {frame: 400, activity: 'nonsense', detail: ''}, // unknown -> thinking, detail cleared
      ],
      fps,
    );
    const expect = (cond: boolean, what: string) => {
      if (!cond) {
        bad++;
        log(`CARD MISMATCH: ${what}`);
      }
    };
    expect(tl.at(10).label === 'Reading' && tl.at(10).state === 'reading', 'first switch after a long rest is immediate');
    expect(tl.at(14).label === 'Searching' && tl.at(14).state === 'reading', 'label leads the pose');
    expect(tl.at(18).state === 'reading' && tl.at(19).state === 'searching', '9-frame dwell at 60 fps');
    expect(tl.at(14).detail === 'Read README.md', 'detail kept when a cue has none');
    expect(tl.at(100).state === 'success' && tl.at(100).label === 'Done!', 'one-shot switches immediately');
    expect(tl.at(190).state === 'success' && tl.at(191).state === 'idle', 'one-shot reverts on f0 + 91');
    expect(tl.at(250).label === 'Done!', '"Done!" persists while Pixie idles');
    expect(tl.at(300).detail === '2 tests pass', 'undefined detail keeps the previous one');
    expect(tl.at(400).label === 'Thinking' && tl.at(409).state === 'thinking', 'unknown activity -> thinking');
    expect(tl.at(400).detail === '' && tl.at(400).prevDetail === '2 tests pass', 'empty detail clears');
    expect(tl.at(120).labelSince === 100 && tl.at(120).prevLabel === 'Searching', 'labelSince / prevLabel');
    expect(tl.at(130).poseSince === 100, 'poseSince');
    rows.push({name: 'card label/detail semantics', compared: 12, bad});
  }

  // 4. Fast sampler against samplePixie: exact colour, alpha, height and part.
  {
    let compared = 0;
    let bad = 0;
    const cp = new CompiledPixie();
    const out = emptySample();
    const rnd = lcg(12345);
    const frames: Array<[string, Rect[]]> = [];
    for (const s of PIXIE_STATES) {
      for (const t of golden.times as number[]) {
        frames.push([`${s}@${t}`, pixieRects(s, t)]);
        frames.push([`${s}@${t} blink`, pixieRects(s, t, {blinking: true})]);
        frames.push([`${s}@${t} left`, mirrorRects(pixieRects(s, t))]);
        frames.push([`${s}@${t} scurry`, pixieRects(s, t, {gait: 'scurry'})]);
      }
    }
    for (const [name, rects] of frames) {
      cp.compile(rects);
      const pts: Array<[number, number]> = [];
      for (let j = 0; j < 96; j++) for (let i = 0; i < 102; i++) pts.push([(i + 0.5) / 3, (j + 0.5) / 3]);
      for (let k = 0; k < 400; k++) pts.push([-2 + rnd() * 38, -3 + rnd() * 37]);
      for (const [x, y] of pts) {
        compared++;
        const ref = samplePixie(rects, x, y);
        const hit = cp.sample(x, y, out);
        const ok = hit
          ? out.r === ref.r && out.g === ref.g && out.b === ref.b && out.a === ref.a && out.h === ref.h && out.part === ref.part
          : ref.a === 0 && ref.part === null && ref.h === 0;
        if (!ok) {
          bad++;
          if (bad < 5) log(`SAMPLER MISMATCH ${name} (${x}, ${y}): ${JSON.stringify(hit ? out : null)} vs ${JSON.stringify(ref)}`);
        }
      }
    }
    rows.push({name: 'fast sampler vs samplePixie (points)', compared, bad});
  }

  // 5. u = 10 masters: the port's device rects rasterise to u10/<state>.png exactly.
  {
    let compared = 0;
    let bad = 0;
    for (const s of PIXIE_STATES) {
      const ref = readPng(`${dir}/u10/${s}.png`);
      const img = rasterize(toDevice(pixieRects(s, 0), 10), 340, 320);
      for (let i = 0; i < ref.data.length; i++) {
        compared++;
        if (ref.data[i] !== img.data[i]) bad++;
      }
    }
    rows.push({name: 'u10 masters (bytes)', compared, bad});
  }

  // 6. Pin maps: k = 3 square lattice against pins-k3/<state>-colour.png and -height.png.
  {
    let compared = 0;
    let bad = 0;
    const cp = new CompiledPixie();
    const out = emptySample();
    const K = 3;
    const PW = SCENE_W * K;
    const PH = SCENE_H * K;
    for (const s of PIXIE_STATES) {
      const col = readPng(`${dir}/pins-k3/${s}-colour.png`);
      const hgt = readPng(`${dir}/pins-k3/${s}-height.png`);
      cp.compile(pixieRects(s, 0));
      for (let j = 0; j < PH; j++) {
        for (let i = 0; i < PW; i++) {
          const o = (j * PW + i) * 4;
          const hit = cp.sample((i + 0.5) / K, (j + 0.5) / K, out);
          const a = hit ? out.a : 0;
          const un = a > 0 ? 1 / a : 0;
          const mine = hit
            ? [Math.round(out.r * un), Math.round(out.g * un), Math.round(out.b * un), Math.round(a * 255), Math.round(out.h * 255)]
            : [0, 0, 0, 0, 0];
          const ref = [col.data[o], col.data[o + 1], col.data[o + 2], col.data[o + 3], hgt.data[o]];
          compared++;
          if (mine.some((v, q) => v !== ref[q])) {
            bad++;
            if (bad < 5) log(`PIN MISMATCH ${s} (${i}, ${j}): ${mine} vs ${ref}`);
          }
        }
      }
    }
    rows.push({name: 'pin maps pins-k3 colour + height (pins)', compared, bad});
  }

  // 7. pixieField on a hex board: placement, compositing, pooling, presence.
  {
    let compared = 0;
    let bad = 0;
    const fps = 60;
    const cols = 171;
    const p = 1 / cols;
    const rowH = (p * Math.sqrt(3)) / 2;
    const aspect = 1440 / 2560;
    const nRows = Math.max(2, Math.round((aspect - p) / rowH) + 1);
    const extH = (nRows - 1) * rowH + p;
    const cell = 3 * p;
    const center: [number, number] = [0.66, 0.5];
    const field = pixieField({fps, state: 'debugging', cell, boardAspect: extH, center, steel: 0.9, relief: 0.5});
    const cp = new CompiledPixie();
    const out = emptySample();
    const t = 2.5;
    const pose = pixiePose({frame: Math.round(t * fps), fps, state: 'debugging'});
    cp.compile(pose.rects);
    let raised = 0;
    let i = 0;
    for (let r = 0; r < nRows; r++) {
      const odd = r % 2;
      const n = odd ? cols - 1 : cols;
      for (let c = 0; c < n; c++, i++) {
        const x = -0.5 + p / 2 + c * p + (odd ? p / 2 : 0);
        const y = -((nRows - 1) * rowH) / 2 + r * rowH;
        const u = x + 0.5;
        const v = (y + extH / 2) / extH;
        const sx = (u - (center[0] - 17 * cell)) / cell;
        const sy = (center[1] + (16 * cell) / extH - v) / (cell / extH);
        const got = field(u, v, i, t) as PixiePinSample | null;
        const hit = cp.sample(sx, sy, out);
        compared++;
        if (!hit || out.a <= 0) {
          if (got !== null) bad++;
          continue;
        }
        if (!got) {
          bad++;
          continue;
        }
        raised += got.h > 0 ? 1 : 0;
        const okH = Math.abs(got.h - 0.5 * out.h) < 1e-12;
        const okA =
          Math.abs(got.alpha - out.a) < 1e-12 &&
          got.part === out.part &&
          got.paint === (out.part === 'shadow' ? 0 : out.a);
        // Opaque body pins carry the canonical coral (#d97757) in linear space.
        let okC = true;
        if (out.a === 1 && got.part === 'body' && Math.abs(out.r - 217) < 1e-9 && Math.abs(out.b - 87) < 1e-9) {
          const lin = (c8: number) => {
            const c = c8 / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          okC = Math.abs(got.tint[0] - lin(217)) < 1e-9 && Math.abs(got.tint[1] - lin(119)) < 1e-9 && Math.abs(got.tint[2] - lin(87)) < 1e-9;
        }
        if (!okH || !okA || !okC) {
          bad++;
          if (bad < 5) log(`FIELD MISMATCH pin ${i}: ${JSON.stringify(got)} vs ${JSON.stringify(out)}`);
        }
        // The pool hands back the same object for the same pin.
        if (field(u, v, i, t) !== got) bad++;
      }
    }
    if (raised < 1000) {
      bad++;
      log(`FIELD: only ${raised} raised pins`);
    }
    const gone = pixieField({fps, state: 'idle', cell, boardAspect: extH, presence: 0});
    if (gone(0.5, 0.5, 0, 1) !== null) bad++;
    rows.push({name: `pixieField on a ${cols}-column hex board (pins; ${raised} raised)`, compared, bad});
  }

  // 8. Pixel blocks re-compose the frame exactly (the entrance hand-off is invisible).
  {
    let compared = 0;
    let bad = 0;
    for (const u of [8, 13, 20]) {
      for (const s of PIXIE_STATES) {
        for (const t of [0.37, 1.91]) {
          for (const left of [false, true]) {
            let rects = pixieRects(s, t);
            if (left) rects = mirrorRects(rects);
            const dev = toDevice(rects, u) as DeviceRect[];
            const d = decompose(dev, u);
            // Blocks keep painter's order within each cell; the shadow is painted first.
            const pad = 8 * u;
            const shift = (r: readonly [number, number, number, number, string, ...unknown[]]) =>
              [r[0] + pad, r[1] + pad, r[2], r[3], r[4]] as [number, number, number, number, string];
            const W = SCENE_W * u + 2 * pad;
            const H = SCENE_H * u + 2 * pad;
            const a = rasterize(dev.map(shift), W, H);
            const b = rasterize([...d.shadow.map(shift), ...d.blocks.flatMap((k) => k.rects.map(shift))], W, H);
            // Painter's order differs only where blocks would overlap, which they never do.
            for (let q = 0; q < a.data.length; q++) {
              compared++;
              if (a.data[q] !== b.data[q]) bad++;
            }
          }
        }
      }
    }
    rows.push({name: 'pixel-block decomposition re-composes frames (bytes)', compared, bad});
  }

  // 9. Determinism and the seeded blink schedule.
  {
    let bad = 0;
    let compared = 0;
    const fps = 60;
    const frames = Array.from({length: 600}, (_, f) => f);
    const forward = frames.map((f) => JSON.stringify(pixiePose({frame: f, fps, state: 'reading', seed: 'pixie'}).rects));
    const order = [...frames].sort((a, b) => ((a * 7919) % 600) - ((b * 7919) % 600));
    for (const f of order) {
      compared++;
      if (JSON.stringify(pixiePose({frame: f, fps, state: 'reading', seed: 'pixie'}).rects) !== forward[f]) bad++;
    }
    // The pin field gives the same samples whatever order frames are evaluated in.
    {
      const field = pixieField({fps, cues: [{frame: 30, activity: 'searching'}, {frame: 200, activity: 'success'}], cell: 3 / 160, boardAspect: 0.5625, walk: {fromX: 0, toX: -4, startFrame: 60}});
      const pins = Array.from({length: 400}, (_, k) => [0.35 + (k % 20) * 0.015, 0.25 + Math.floor(k / 20) * 0.025] as const);
      const snap = (f: number) =>
        pins.map(([u, v], i) => {
          const s = field(u, v, i, f / fps) as PixiePinSample | null;
          return s ? `${s.h.toFixed(12)},${s.tint.map((c) => c.toFixed(12)).join(',')},${s.paint}` : '-';
        }).join('|');
      const seq = Array.from({length: 300}, (_, f) => snap(f));
      for (const f of [...Array(300).keys()].sort((a, b) => ((a * 7919) % 300) - ((b * 7919) % 300))) {
        compared++;
        if (snap(f) !== seq[f]) bad++;
      }
    }
    const short = Array.from(blinkScheduleFor('verify-seed', 10));
    const long = blinkScheduleFor('verify-seed', 5000);
    if (short.some((v, k) => v !== long[k])) bad++;
    // Blink lengths: 8 or 9 frames at 60 fps; open spans 2.06-4.66 s.
    let runLen = 0;
    let lastEnd = -1;
    const lens: number[] = [];
    const opens: number[] = [];
    for (let f = 0; f < 60 * 120; f++) {
      const b = isBlinkingAt('verify-seed', f / fps);
      if (b) runLen++;
      else if (runLen) {
        lens.push(runLen);
        if (lastEnd >= 0) opens.push((f - runLen - lastEnd) / fps);
        lastEnd = f;
        runLen = 0;
      }
    }
    compared += lens.length;
    if (lens.some((l) => l < 8 || l > 9)) bad++;
    if (opens.some((o) => o < 2.06 - 1 / fps || o > 4.66 + 1 / fps)) bad++;
    const first = long[0];
    if (first < 2.2) bad++;
    rows.push({name: `determinism + blink schedule (${lens.length} blinks in 120 s, ${Math.min(...lens)}-${Math.max(...lens)} frames)`, compared, bad});
  }

  // 10. Walks: linear at 4 cells/s, clamped, facing follows travel and stays.
  {
    let bad = 0;
    const fps = 60;
    const w = {fromX: 0, toX: -8, startFrame: 100};
    const at = (f: number) => walkAt(w, f, fps);
    if (at(99).dx !== 0 || at(99).walking || at(99).facing !== null) bad++;
    if (Math.abs(at(130).dx + 2) > 1e-12 || !at(130).walking || at(130).facing !== 'left') bad++;
    if (walkArrivalFrame(w, fps) !== 220 || at(220).walking || at(220).dx !== -8 || at(400).facing !== 'left') bad++;
    const pose = pixiePose({frame: 130, fps, state: 'idle', walk: w});
    const scurryRects = mirrorRects(pixieRects('idle', 130 / fps, {gait: 'scurry'}));
    if (JSON.stringify(pose.rects) !== JSON.stringify(scurryRects)) bad++;
    const arrived = pixiePose({frame: 260, fps, state: 'idle', walk: w});
    if (JSON.stringify(arrived.rects) !== JSON.stringify(mirrorRects(pixieRects('idle', 260 / fps)))) bad++;
    rows.push({name: 'walk path, gait and facing', compared: 6, bad});
  }

  console.log('Pixie verification');
  let failed = 0;
  for (const r of rows) {
    console.log(`${r.bad === 0 ? 'ok  ' : 'FAIL'}  ${r.name}: ${r.compared} compared, ${r.bad} mismatches`);
    failed += r.bad;
  }
  if (!existsSync(`${dir}/u10`)) console.log('  (u10 masters missing)');
  console.log(failed === 0 ? 'all checks passed' : `${failed} mismatches`);
  return failed === 0 ? 0 : 1;
}
