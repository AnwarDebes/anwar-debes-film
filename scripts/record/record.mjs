#!/usr/bin/env node
// Deterministic, frame-exact capture of a live web page, encoded to H.264.
//
//   node scripts/record/record.mjs <shots.json> [--only=name[,name]] [--out=public/recordings]
//        [--frames=N] [--dump=dir] [--headed]
//
// Each frame k is the page exactly at t = k / fps on a virtual clock (and Math.random is seeded, so
// a re-record of the same shot shows the same page):
//   1. Playwright's fake clock (installed before navigation, paused) advances to t, firing timers.
//   2. Timed actions for frame k run (pointer moves along eased arcs, clicks, typing, scrolls).
//   3. The page runtime (page-runtime.js) runs one requestAnimationFrame batch stamped t, steps every
//      CSS animation / transition / Web Animation by one frame (their timeline is frozen through
//      the CDP Animation domain), seeks SMIL and <video>, finishes smooth-scroll tweens, and draws
//      the cursor.
//   4. A JPEG screenshot at device resolution goes to ffmpeg (libx264, BT.709, tv range).
// Real time only matters for network and decoding; it never decides what a frame shows.
//
// Shot list: a JSON array (or {outDir, shots: [...]}) of shots. A shot:
//   name, url, viewport {width, height} (CSS px), deviceScaleFactor (2: crisp textures), fps (60),
//   duration (s) or frames, mobile (touch + mobile viewport), colorScheme ('dark'), waitUntil,
//   waitFor [selectors], settleMs, scrollY, css, hide [selectors], caret, seed (1; null = unseeded),
//   cursor {start [x, y], size, visible, style: 'arrow' | 'touch'}, clockStart, prerollMs,
//   crf (12), preset ('slow'), gop (fps), jpegQuality (95), smoothScroll {minMs, maxMs, msPerPx},
//   actions: [{at (s) | frame, type, ...}] where type is
//     move / hover  to: selector | [x, y], anchor [0..1, 0..1], offset [px, px], duration, ease, curve
//     click / down / up  (at the cursor; click holdMs)      tap  to (touch, drawn as a finger)
//     scroll  to: y | selector (block: start | center | end), by, offset, duration, ease
//     type  text, selector, cps                             press  key
//     waitFor  selector, state, timeout                     eval  script
//     cursor  visible, duration (fade)
//   eases: linear, in, out, inOut, film (the film's camera curve), ui.
// Each mp4 gets a sidecar .json: settings plus a per-frame log (page time, scroll position,
// animations stepped), which verify.mjs reads.
//
// Limits (documented, not hidden): the text caret blinks on a real-time timer, so it is hidden
// unless a shot sets "caret": true; GIFs, cross-origin iframes and CSS animations inside iframes
// are not stepped; pages that busy-wait on real time cannot be made deterministic.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');

// GPU through ANGLE (D3D11): WebGL pages render on the real GPU instead of SwiftShader.
const BROWSER_ARGS = [
  '--use-angle=d3d11',
  '--use-gl=angle',
  '--ignore-gpu-blocklist',
  '--enable-gpu-rasterization',
  '--force-color-profile=srgb',
  '--hide-scrollbars',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--autoplay-policy=no-user-gesture-required',
];

const easings = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  // the film's camera curve, cubic-bezier(0.65, 0, 0.35, 1)
  film: bezier(0.65, 0, 0.35, 1),
  // the film's UI curve, cubic-bezier(0.22, 1, 0.36, 1)
  ui: bezier(0.22, 1, 0.36, 1),
};

function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 10; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-7) break;
      t = Math.min(1, Math.max(0, t - (sx(t) - x) / d));
    }
    return sy(t);
  };
}

const ease = (name) => easings[name ?? 'inOut'] ?? easings.inOut;

const parseArgs = (argv) => {
  const flags = {};
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, ...v] = a.slice(2).split('=');
      flags[k] = v.length ? v.join('=') : true;
    } else pos.push(a);
  }
  return {flags, pos};
};

const log = (...a) => process.stdout.write(`[record] ${a.join(' ')}\n`);

function ffmpegArgs({fps, out, crf, preset, gop}) {
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    // Chrome's JPEGs are JFIF: BT.601 matrix, full range. Convert explicitly to BT.709 tv range
    // and tag it, so decoders never have to guess.
    // (yuv420p needs even dimensions: an odd device-pixel size loses its last row / column)
    '-vf', 'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0,scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int+bicubic,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-g', String(gop), '-bf', '2',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart',
    out,
  ];
}

/** Resolve a pointer target: [x, y] in CSS px, or a selector (+ anchor in 0..1, + offset px). */
async function resolvePoint(page, a, vp) {
  if (Array.isArray(a.to)) return {x: a.to[0], y: a.to[1]};
  const box = await page.locator(a.to).first().boundingBox({timeout: 15000});
  if (!box) throw new Error(`move: ${a.to} has no box`);
  const [ax, ay] = a.anchor ?? [0.5, 0.5];
  const [ox, oy] = a.offset ?? [0, 0];
  return {x: Math.min(vp.width - 1, Math.max(0, box.x + box.width * ax + ox)), y: Math.min(vp.height - 1, Math.max(0, box.y + box.height * ay + oy))};
}

/** Normalise the action list: frame numbers, durations in frames, stable order within a frame. */
function planActions(actions, fps) {
  const order = {waitFor: 0, eval: 1, cursor: 2, move: 3, hover: 3, scroll: 4, down: 5, click: 5, tap: 5, up: 6, type: 7, press: 8};
  return (actions ?? [])
    .map((a, i) => {
      const f0 = a.frame ?? Math.round((a.at ?? 0) * fps);
      const durF = Math.max(1, Math.round((a.duration ?? (a.type === 'scroll' ? 1 : a.type === 'cursor' ? 0.25 : 0.8)) * fps));
      return {...a, i, f0, durF};
    })
    .sort((p, q) => p.f0 - q.f0 || (order[p.type] ?? 9) - (order[q.type] ?? 9) || p.i - q.i);
}

export async function recordShot(shot, {outDir, framesLimit, dumpDir, headed} = {}) {
  const fps = shot.fps ?? 60;
  const totalFrames = Math.min(framesLimit ?? Infinity, shot.frames ?? Math.round((shot.duration ?? 6) * fps));
  const vp = shot.viewport ?? {width: 1600, height: 1000};
  const dsf = shot.deviceScaleFactor ?? 2;
  const outW = Math.floor(Math.round(vp.width * dsf) / 2) * 2;
  const outH = Math.floor(Math.round(vp.height * dsf) / 2) * 2;
  const jpegQuality = shot.jpegQuality ?? 95;
  const name = shot.name ?? 'recording';
  const out = path.resolve(projectRoot, outDir ?? 'public/recordings', `${name}.mp4`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  if (dumpDir) fs.mkdirSync(dumpDir, {recursive: true});

  const runtime = fs.readFileSync(path.join(here, 'page-runtime.js'), 'utf8');
  const config = {
    smoothScroll: {minMs: 420, maxMs: 1100, msPerPx: 0.55, ...(shot.smoothScroll ?? {})},
    caret: !!shot.caret,
    // Math.random is seeded (null keeps the browser's own)
    seed: shot.seed === undefined ? 1 : shot.seed,
    cursorSize: shot.cursor?.size ?? 24,
    css: [shot.css ?? '', ...(shot.hide ?? []).map((s) => `${s} { visibility: hidden !important; }`)].join('\n'),
  };

  const browser = await chromium.launch({headless: !headed, args: [...BROWSER_ARGS, ...(shot.browserArgs ?? [])]});
  const t0 = Date.now();
  try {
    const context = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: dsf,
      colorScheme: shot.colorScheme ?? 'dark',
      reducedMotion: 'no-preference',
      locale: shot.locale ?? 'en-US',
      timezoneId: shot.timezoneId ?? 'Europe/Oslo',
      // phones: mobile viewport semantics and touch input
      isMobile: !!shot.mobile,
      hasTouch: !!shot.mobile,
    });
    // Added before the clock, so it runs first in every document and can keep native timers for
    // waiting on the browser (see page-runtime.js).
    await context.addInitScript({content: `window.__recConfig = ${JSON.stringify(config)};\n${runtime}`});
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text());
    });

    // Fake clock before navigation, paused: the page's timers, Date and performance.now only
    // move when the recorder moves them.
    const clockStart = new Date(shot.clockStart ?? '2026-01-15T10:00:00+01:00').getTime();
    await page.clock.install({time: clockStart});
    await page.clock.pauseAt(clockStart + 1000);

    // Freeze the document timeline of CSS / Web Animations; the runtime steps them per frame.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    await cdp.send('Animation.setPlaybackRate', {playbackRate: 0});

    log(`${name}: ${shot.url} @ ${vp.width}x${vp.height} x${dsf} -> ${outW}x${outH}, ${totalFrames} frames at ${fps} fps`);
    await page.goto(shot.url, {waitUntil: shot.waitUntil ?? 'load', timeout: 90000});
    await cdp.send('Animation.setPlaybackRate', {playbackRate: 0});
    for (const sel of shot.waitFor ?? []) await page.waitForSelector(sel, {state: 'visible', timeout: 30000});
    if (shot.settleMs) await page.waitForTimeout(shot.settleMs); // real time: network, decoding
    // Load every declared font face now, including ones the page has not used yet (otherwise the
    // first frame that needs one shows a fallback face while it downloads).
    await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load().catch(() => null))).then(() => document.fonts.ready));
    // Rebuild layout and compositor layers once everything has arrived. Without this, the 1-device-
    // pixel snapping of elements at fractional positions depends on the order in which fonts and
    // data loaded, so two recordings of the same page could differ. ("rebuildLayout": false skips it.)
    if (shot.rebuildLayout !== false) await page.evaluate(() => {
      const d = document.documentElement;
      const v = d.style.display;
      d.style.display = 'none';
      void d.offsetHeight;
      d.style.display = v;
      void d.offsetHeight;
    });
    await page.waitForTimeout(200);

    const status = await page.evaluate(() => window.__rec.status());
    const tl0 = status.timeline;
    await page.waitForTimeout(120);
    const tl1 = await page.evaluate(() => document.timeline.currentTime);
    log(`${name}: runtime ownsRaf=${status.ownsRaf} nativeRaf=${status.nativeRaf} timeline frozen=${tl0 === tl1} (${tl0} -> ${tl1})`);
    if (!status.ownsRaf) throw new Error('page-runtime does not own requestAnimationFrame');

    if (shot.scrollY !== undefined) await page.evaluate((y) => window.__rec.nativeScrollTo(0, y), shot.scrollY);

    // Cursor state lives here; the page only draws it.
    const cur = shot.cursor ?? {};
    const cursor = {
      kind: cur.style === 'touch' ? 'touch' : 'arrow',
      enabled: cur.visible !== undefined || cur.start !== undefined || cur.style === 'touch',
      x: cur.start?.[0] ?? vp.width * 0.62,
      y: cur.start?.[1] ?? vp.height * 0.7,
      opacity: cur.visible === false ? 0 : 1,
      fade: null,
      press: 0,
      pressTarget: 0,
      ripples: [],
    };
    const inside = (x, y) => x >= 0 && y >= 0 && x < vp.width && y < vp.height;
    if (cursor.enabled && inside(cursor.x, cursor.y)) await page.mouse.move(cursor.x, cursor.y);

    const actions = planActions(shot.actions, fps);
    const active = []; // continuous actions in progress
    let virtualMs = 0;
    let typedState = new Map();
    let inputThisFrame = false;

    const startAction = async (a, f) => {
      switch (a.type) {
        case 'waitFor':
          await page.waitForSelector(a.selector, {state: a.state ?? 'visible', timeout: a.timeout ?? 30000});
          break;
        case 'eval':
          await page.evaluate((src) => (0, eval)(src), a.script);
          break;
        case 'cursor':
          cursor.enabled = true;
          cursor.fade = {from: cursor.opacity, to: a.visible === false ? 0 : 1, f0: f, durF: a.durF};
          break;
        case 'move':
        case 'hover': {
          cursor.enabled = true;
          const to = await resolvePoint(page, a, vp);
          const from = {x: cursor.x, y: cursor.y};
          const dx = to.x - from.x, dy = to.y - from.y;
          const bend = a.curve ?? 0.14;
          const ctrl = {x: (from.x + to.x) / 2 - dy * bend, y: (from.y + to.y) / 2 + dx * bend};
          active.push({...a, from, to, ctrl, f0: f, f1: f + a.durF});
          break;
        }
        case 'scroll': {
          const from = await page.evaluate(() => window.scrollY);
          let to = a.to;
          if (typeof to === 'string') {
            to = await page.evaluate(
              ([sel, block]) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const y = r.top + window.scrollY;
                return block === 'center' ? y + r.height / 2 - innerHeight / 2 : block === 'end' ? y + r.height - innerHeight : y;
              },
              [to, a.block ?? 'start'],
            );
            if (to === null) throw new Error(`scroll: ${a.to} not found`);
          }
          if (a.by !== undefined) to = from + a.by;
          to += a.offset ?? 0;
          active.push({...a, from, to, f0: f, f1: f + a.durF});
          break;
        }
        case 'down':
        case 'click':
          await page.mouse.down({button: a.button ?? 'left'});
          inputThisFrame = true;
          cursor.pressTarget = 1;
          cursor.ripples.push({x: cursor.x, y: cursor.y, f0: f});
          if (a.type === 'click') active.push({type: 'release', f0: f, f1: f + Math.max(1, Math.round(((a.holdMs ?? 95) / 1000) * fps)), button: a.button});
          break;
        case 'tap': {
          // a touch: pointerdown / touchstart / touchend / click at the point, drawn as a finger
          cursor.enabled = true;
          const at = a.to !== undefined ? await resolvePoint(page, a, vp) : {x: cursor.x, y: cursor.y};
          cursor.x = at.x;
          cursor.y = at.y;
          await page.touchscreen.tap(at.x, at.y);
          inputThisFrame = true;
          cursor.ripples.push({x: at.x, y: at.y, f0: f});
          break;
        }
        case 'up':
          await page.mouse.up({button: a.button ?? 'left'});
          inputThisFrame = true;
          cursor.pressTarget = 0;
          break;
        case 'type':
          if (a.selector) await page.focus(a.selector);
          typedState.set(a.i, 0);
          active.push({...a, f0: f, f1: f + Math.ceil((a.text.length / (a.cps ?? 14)) * fps) + 1});
          break;
        case 'press':
          await page.keyboard.press(a.key);
          inputThisFrame = true;
          break;
        default:
          throw new Error(`unknown action ${a.type}`);
      }
    };

    const runActive = async (f) => {
      for (let j = active.length - 1; j >= 0; j--) {
        const a = active[j];
        if (f < a.f0) continue;
        const k = Math.min(1, (f - a.f0) / Math.max(1, a.f1 - a.f0));
        if (a.type === 'move' || a.type === 'hover') {
          const s = ease(a.ease)(k);
          const u = 1 - s;
          cursor.x = u * u * a.from.x + 2 * u * s * a.ctrl.x + s * s * a.to.x;
          cursor.y = u * u * a.from.y + 2 * u * s * a.ctrl.y + s * s * a.to.y;
          if (inside(cursor.x, cursor.y)) {
            await page.mouse.move(cursor.x, cursor.y);
            inputThisFrame = true;
          }
        } else if (a.type === 'scroll') {
          const y = a.from + (a.to - a.from) * ease(a.ease ?? 'film')(k);
          await page.evaluate((yy) => window.__rec.nativeScrollTo(window.scrollX, yy), y);
        } else if (a.type === 'type') {
          const due = Math.min(a.text.length, Math.floor(((f - a.f0 + 1) / fps) * (a.cps ?? 14)));
          const done = typedState.get(a.i);
          if (due > done) {
            await page.keyboard.type(a.text.slice(done, due));
            typedState.set(a.i, due);
            inputThisFrame = true;
          }
        } else if (a.type === 'release' && f >= a.f1) {
          await page.mouse.up({button: a.button ?? 'left'});
          inputThisFrame = true;
          cursor.pressTarget = 0;
        }
        if (f >= a.f1) active.splice(j, 1);
      }
    };

    const ff = dumpDir
      ? null
      : spawn('ffmpeg', ffmpegArgs({fps, out, crf: shot.crf ?? 12, preset: shot.preset ?? 'slow', gop: shot.gop ?? fps}), {
          stdio: ['pipe', 'inherit', 'inherit'],
        });
    let ffFailed = null;
    const ffDone = ff
      ? new Promise((res, rej) => {
          ff.on('error', rej);
          ff.on('close', (code) => {
            if (code === 0) res();
            else rej((ffFailed = new Error(`ffmpeg exited with ${code} (see its message above)`)));
          });
        })
      : Promise.resolve();
    // a failed encoder closes the pipe: stop capturing and report it instead of crashing on EPIPE
    if (ff) ff.stdin.on('error', (e) => (ffFailed = ffFailed ?? e));
    ffDone.catch(() => undefined);

    const preroll = Math.round(((shot.prerollMs ?? 0) / 1000) * fps);
    const stats = [];
    let nextAction = 0;
    const tLoop = Date.now();
    for (let f = -preroll; f < totalFrames; f++) {
      // 1. virtual time to this frame. Playwright's clock works in whole milliseconds, so it is
      // advanced to the next whole ms at or after the exact frame time; the page runtime gets the
      // difference and stamps rAF / steps animations with the exact time.
      const exact = ((f + preroll) * 1000) / fps;
      const target = Math.ceil(exact - 1e-9);
      if (target > virtualMs) {
        await page.clock.runFor(target - virtualMs);
        virtualMs = target;
      }
      const lag = virtualMs - exact;
      // 2. actions
      inputThisFrame = false;
      while (nextAction < actions.length && actions[nextAction].f0 <= f) {
        await startAction(actions[nextAction], f);
        nextAction++;
      }
      await runActive(f);
      // let rAF-aligned input reach the page before the frame is stepped
      if (inputThisFrame) await page.evaluate(() => window.__rec.realFrame());
      // cursor visuals
      if (cursor.fade) {
        const k = Math.min(1, (f - cursor.fade.f0) / cursor.fade.durF);
        cursor.opacity = cursor.fade.from + (cursor.fade.to - cursor.fade.from) * easings.inOut(k);
        if (k >= 1) cursor.fade = null;
      }
      cursor.press += (cursor.pressTarget - cursor.press) * (cursor.pressTarget > cursor.press ? 0.55 : 0.3);
      const cursorState = cursor.enabled
        ? {
            kind: cursor.kind,
            x: cursor.x,
            y: cursor.y,
            opacity: cursor.opacity,
            press: cursor.press,
            ripples: cursor.ripples.slice(-2).map((r) => ({x: r.x, y: r.y, age: ((f - r.f0) * 1000) / fps})),
          }
        : null;
      // 3. one frame of the page
      const st = await page.evaluate(([c, l]) => window.__rec.frame(c, l), [cursorState, lag]);
      if (f < 0) continue;
      // 4. capture
      // The clip's scale is what makes the capture device-pixel (3200 x 2000 at x2). Clip
      // coordinates are document coordinates, so the clip follows the scroll position; a clip at
      // 0, 0 on a scrolled page composites a stale view.
      const shotRes = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: jpegQuality,
        fromSurface: true,
        captureBeyondViewport: false,
        clip: {x: st.scrollX, y: st.scrollY, width: vp.width, height: vp.height, scale: dsf},
      });
      const buf = Buffer.from(shotRes.data, 'base64');
      if (dumpDir) fs.writeFileSync(path.join(dumpDir, `${name}_${String(f).padStart(4, '0')}.jpg`), buf);
      else {
        if (ffFailed) throw ffFailed;
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      }
      stats.push(st);
      if (f % 60 === 0 || f === totalFrames - 1) {
        const secs = (Date.now() - tLoop) / 1000;
        log(`${name}: frame ${f + 1}/${totalFrames} t=${(st.t - stats[0].t).toFixed(0)}ms anim=${st.stepped} scrollY=${Math.round(st.scrollY)} (${((f + preroll + 1) / secs).toFixed(1)} fps)`);
      }
    }
    if (ff) ff.stdin.end();
    await ffDone;
    await context.close();

    const meta = {
      name,
      url: shot.url,
      src: `recordings/${name}.mp4`,
      width: outW,
      height: outH,
      viewport: vp,
      deviceScaleFactor: dsf,
      fps,
      frames: totalFrames,
      durationS: totalFrames / fps,
      colorScheme: shot.colorScheme ?? 'dark',
      encode: {codec: 'h264', crf: shot.crf ?? 12, preset: shot.preset ?? 'slow', pixFmt: 'yuv420p', matrix: 'bt709', range: 'tv'},
      clockStart: new Date(clockStart).toISOString(),
      recordedAt: new Date().toISOString(),
      pageErrors: pageErrors.slice(0, 20),
      // per-frame page state, for checking what each frame showed
      frameLog: {
        t: stats.map((x) => +(x.t - stats[0].t).toFixed(3)),
        scrollY: stats.map((x) => +x.scrollY.toFixed(2)),
        animationsStepped: stats.map((x) => x.stepped),
      },
      shot,
    };
    if (!dumpDir) fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(meta, null, 2));
    log(`${name}: done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${path.relative(projectRoot, out)}${pageErrors.length ? ` (${pageErrors.length} page errors)` : ''}`);
    return meta;
  } finally {
    await browser.close();
  }
}

async function main() {
  const {flags, pos} = parseArgs(process.argv.slice(2));
  if (!pos[0]) {
    console.error('usage: node scripts/record/record.mjs <shots.json> [--only=a,b] [--out=dir] [--frames=N] [--dump=dir] [--headed]');
    process.exit(2);
  }
  const spec = JSON.parse(fs.readFileSync(path.resolve(pos[0]), 'utf8'));
  const shots = Array.isArray(spec) ? spec : spec.shots ?? [spec];
  const only = typeof flags.only === 'string' ? new Set(flags.only.split(',')) : null;
  for (const shot of shots) {
    if (only && !only.has(shot.name)) continue;
    await recordShot(shot, {
      outDir: typeof flags.out === 'string' ? flags.out : spec.outDir,
      framesLimit: flags.frames ? Number(flags.frames) : undefined,
      dumpDir: typeof flags.dump === 'string' ? path.resolve(flags.dump) : undefined,
      headed: !!flags.headed,
    });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
