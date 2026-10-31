// Injected into every recorded page before any of its own scripts run.
// It makes the page a pure function of the recorder's virtual clock:
//   - requestAnimationFrame: one batch per recorded frame, stamped with the frame time
//   - CSS animations, transitions and Web Animations: stepped by exactly one frame each frame
//     (their document timeline is frozen through the CDP Animation domain)
//   - SMIL (<animate> in SVG) and <video>: seeked to the frame time
//   - smooth scrolling (scrollIntoView / scrollTo / scrollBy with behavior 'smooth'): replaced by
//     an eased tween on the virtual clock, so it is deterministic and frame-exact
//   - a drawn cursor, so pointer interactions read on screen
// Timers, Date and performance.now come from Playwright's fake clock.
(() => {
  if (window.top !== window || window.__rec) return;
  const cfg = Object.assign(
    {smoothScroll: {minMs: 420, maxMs: 1100, msPerPx: 0.55}, caret: false, cursorSize: 24},
    window.__recConfig || {},
  );
  const rec = {cfg, frames: 0};
  Object.defineProperty(window, '__rec', {value: rec, enumerable: false});

  /* ---------------- Math.random: seeded, so a re-record shows the same page ---------------- */
  // mulberry32; every document of the recording starts from the shot's seed
  if (cfg.seed !== null && cfg.seed !== undefined) {
    let s = cfg.seed >>> 0;
    Math.random = function random() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const now = () => window.performance.now();
  // Real-time primitives, captured before the fake clock replaces them (this script is added
  // before the clock is installed). They are only used to wait for the browser, never to
  // decide what a frame shows.
  const isNative = (f) => typeof f === 'function' && /\[native code\]/.test(Function.prototype.toString.call(f));
  const nativeRafFn = isNative(window.requestAnimationFrame) ? window.requestAnimationFrame.bind(window) : null;
  const nativeTimeout = isNative(window.setTimeout) ? window.setTimeout.bind(window) : null;
  const report = (e) => {
    try {
      if (typeof reportError === 'function') reportError(e);
      else console.error(e);
    } catch {
      /* ignore */
    }
  };

  /* ---------------- requestAnimationFrame: exactly one batch per frame ---------------- */
  let rafId = 0;
  let rafQueue = new Map();
  const raf = (cb) => {
    rafId += 1;
    rafQueue.set(rafId, cb);
    return rafId;
  };
  const caf = (id) => {
    rafQueue.delete(id);
  };
  // A setter that ignores assignment keeps this scheduler in place even if the fake clock is
  // installed after this script (it assigns window.requestAnimationFrame).
  for (const [name, fn] of [
    ['requestAnimationFrame', raf],
    ['cancelAnimationFrame', caf],
  ]) {
    Object.defineProperty(window, name, {configurable: true, enumerable: true, get: () => fn, set: () => {}});
  }
  rec.ownsRaf = () => window.requestAnimationFrame === raf;
  const flushRaf = (ts) => {
    const q = rafQueue;
    rafQueue = new Map();
    for (const cb of q.values()) {
      try {
        cb(ts);
      } catch (e) {
        report(e);
      }
    }
  };

  /* ---------------- CSS that keeps capture deterministic ---------------- */
  const css = [
    // smooth scrolling is re-implemented below on the virtual clock
    'html, body, * { scroll-behavior: auto !important; }',
    // the caret blinks on a real-time timer the recorder cannot control
    cfg.caret ? '' : '* { caret-color: transparent !important; }',
    cfg.css || '',
  ].join('\n');
  const addStyle = () => {
    const root = document.head || document.documentElement;
    if (!root) return false;
    const s = document.createElement('style');
    s.setAttribute('data-recorder', '');
    s.textContent = css;
    root.appendChild(s);
    return true;
  };
  if (!addStyle()) {
    const mo = new MutationObserver(() => {
      if (addStyle()) mo.disconnect();
    });
    mo.observe(document, {childList: true, subtree: true});
  }

  /* ---------------- smooth scrolling on the virtual clock ---------------- */
  const SE = () => document.scrollingElement || document.documentElement;
  const nativeWinScrollTo = window.scrollTo.bind(window);
  const nativeWinScrollBy = window.scrollBy.bind(window);
  const nativeElScrollTo = Element.prototype.scrollTo;
  const nativeElScrollBy = Element.prototype.scrollBy;
  const nativeScrollIntoView = Element.prototype.scrollIntoView;
  const isRoot = (el) => el === SE() || el === document.body || el === document.documentElement;
  const getPos = (el) => (isRoot(el) ? {x: window.scrollX, y: window.scrollY} : {x: el.scrollLeft, y: el.scrollTop});
  const setPos = (el, x, y) => {
    if (isRoot(el)) nativeWinScrollTo({left: x, top: y, behavior: 'instant'});
    else nativeElScrollTo.call(el, {left: x, top: y, behavior: 'instant'});
  };
  const maxPos = (el) => {
    const r = isRoot(el) ? SE() : el;
    return {x: Math.max(0, r.scrollWidth - r.clientWidth), y: Math.max(0, r.scrollHeight - r.clientHeight)};
  };
  const tweens = new Map();
  // film camera ease, cubic-bezier(0.65, 0, 0.35, 1)
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= (sx(t) - x) / d;
        t = Math.min(1, Math.max(0, t));
      }
      return sy(t);
    };
  };
  const scrollEase = bezier(0.65, 0, 0.35, 1);
  const startTween = (el, tx, ty) => {
    const key = isRoot(el) ? SE() : el;
    const m = maxPos(key);
    tx = Math.min(m.x, Math.max(0, tx));
    ty = Math.min(m.y, Math.max(0, ty));
    const p = getPos(key);
    const dist = Math.hypot(tx - p.x, ty - p.y);
    if (dist < 0.5) {
      tweens.delete(key);
      setPos(key, tx, ty);
      return;
    }
    const s = cfg.smoothScroll;
    const dur = Math.min(s.maxMs, Math.max(s.minMs, s.minMs + s.msPerPx * dist * 0.5));
    tweens.set(key, {fx: p.x, fy: p.y, tx, ty, t0: now(), dur});
  };
  const cancelTween = (el) => tweens.delete(isRoot(el) ? SE() : el);
  const stepScroll = (t) => {
    for (const [el, tw] of tweens) {
      const k = Math.min(1, Math.max(0, (t - tw.t0) / tw.dur));
      const e = scrollEase(k);
      setPos(el, tw.fx + (tw.tx - tw.fx) * e, tw.fy + (tw.ty - tw.fy) * e);
      if (k >= 1) tweens.delete(el);
    }
  };
  const smooth = (a) => a !== null && typeof a === 'object' && a.behavior === 'smooth';
  const instantArgs = (a, b) => (a !== null && typeof a === 'object' ? [{...a, behavior: 'instant'}] : [a, b]);
  const winTo = function (a, b) {
    if (smooth(a)) {
      const p = getPos(SE());
      startTween(SE(), a.left ?? p.x, a.top ?? p.y);
      return;
    }
    cancelTween(SE());
    nativeWinScrollTo(...instantArgs(a, b));
  };
  const winBy = function (a, b) {
    if (smooth(a)) {
      const p = getPos(SE());
      startTween(SE(), p.x + (a.left || 0), p.y + (a.top || 0));
      return;
    }
    cancelTween(SE());
    nativeWinScrollBy(...instantArgs(a, b));
  };
  window.scrollTo = winTo;
  window.scroll = winTo;
  window.scrollBy = winBy;
  const elTo = function (a, b) {
    if (smooth(a)) {
      const p = getPos(this);
      startTween(this, a.left ?? p.x, a.top ?? p.y);
      return;
    }
    cancelTween(this);
    nativeElScrollTo.apply(this, instantArgs(a, b));
  };
  Element.prototype.scrollTo = elTo;
  Element.prototype.scroll = elTo;
  Element.prototype.scrollBy = function (a, b) {
    if (smooth(a)) {
      const p = getPos(this);
      startTween(this, p.x + (a.left || 0), p.y + (a.top || 0));
      return;
    }
    cancelTween(this);
    nativeElScrollBy.apply(this, instantArgs(a, b));
  };
  const scrollers = (el) => {
    const out = [];
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (isRoot(n)) continue;
      const cs = getComputedStyle(n);
      const oy = cs.overflowY, ox = cs.overflowX;
      const can = /(auto|scroll|overlay)/;
      if ((can.test(oy) && n.scrollHeight > n.clientHeight) || (can.test(ox) && n.scrollWidth > n.clientWidth)) out.push(n);
    }
    out.push(SE());
    return out;
  };
  Element.prototype.scrollIntoView = function (arg) {
    if (!smooth(arg)) {
      nativeScrollIntoView.call(this, arg !== null && typeof arg === 'object' ? {...arg, behavior: 'instant'} : arg);
      return;
    }
    // Let the browser compute where every scroller ends up, then animate there.
    const list = scrollers(this);
    const before = list.map(getPos);
    nativeScrollIntoView.call(this, {...arg, behavior: 'instant'});
    const after = list.map(getPos);
    list.forEach((s, i) => setPos(s, before[i].x, before[i].y));
    list.forEach((s, i) => {
      if (Math.abs(after[i].x - before[i].x) > 0.5 || Math.abs(after[i].y - before[i].y) > 0.5) startTween(s, after[i].x, after[i].y);
    });
  };
  rec.nativeScrollTo = (x, y) => {
    cancelTween(SE());
    nativeWinScrollTo({left: x, top: y, behavior: 'instant'});
  };

  /* ---------------- CSS animations, transitions, Web Animations ---------------- */
  // The document timeline is frozen (CDP Animation.setPlaybackRate 0). Every frame, each running
  // animation advances by the frame's virtual dt from wherever it is, so restarts, seeks and
  // reversals made by the page itself are respected. A new animation shows its t = 0 state on
  // the frame it is first seen.
  const seen = new WeakSet();
  let lastAnimT = null;
  const stepAnimations = (t) => {
    const dt = lastAnimT === null ? 0 : t - lastAnimT;
    lastAnimT = t;
    let n = 0;
    for (const a of document.getAnimations()) {
      if (a.timeline && a.timeline !== document.timeline) continue; // scroll-driven
      if (!seen.has(a)) {
        seen.add(a);
        continue;
      }
      if (a.playState !== 'running') continue;
      const ct = a.currentTime;
      if (ct === null) continue;
      try {
        a.currentTime = ct + dt * a.playbackRate;
        n++;
      } catch (e) {
        report(e);
      }
    }
    return n;
  };

  /* ---------------- SMIL and video ---------------- */
  const stepSmil = (t) => {
    for (const svg of document.querySelectorAll('svg')) {
      if (svg.ownerSVGElement || typeof svg.setCurrentTime !== 'function') continue;
      if (!svg.querySelector('animate, animateTransform, animateMotion, set')) continue;
      if (!svg.__recBase) {
        svg.__recBase = {at: t, from: svg.getCurrentTime()};
        svg.pauseAnimations();
      }
      svg.setCurrentTime(svg.__recBase.from + (t - svg.__recBase.at) / 1000);
    }
  };
  const stepVideos = async (t) => {
    const waits = [];
    for (const v of document.querySelectorAll('video')) {
      if (!v.__recBase) {
        if (v.paused && !v.autoplay) continue;
        v.__recBase = {at: t, from: v.currentTime};
      }
      if (!v.paused) v.pause();
      const target = v.__recBase.from + (t - v.__recBase.at) / 1000;
      const dur = Number.isFinite(v.duration) ? v.duration : Infinity;
      const want = v.loop && dur < Infinity ? target % dur : Math.min(target, dur);
      if (Math.abs(v.currentTime - want) > 1e-4) {
        waits.push(
          new Promise((res) => {
            const done = () => res();
            v.addEventListener('seeked', done, {once: true});
            v.currentTime = want;
            // never stall the capture on a video that will not seek
            if (nativeTimeout) nativeTimeout(done, 500);
            else done();
          }),
        );
      }
    }
    if (waits.length) await Promise.all(waits);
  };

  /* ---------------- cursor ---------------- */
  let cursorHost = null;
  let cursorParts = null;
  const ensureCursor = () => {
    if (cursorHost && cursorHost.isConnected) return cursorParts;
    cursorHost = document.createElement('recorder-cursor');
    cursorHost.style.cssText =
      // a 0 x 0 fixed anchor; no containment (paint containment would clip the cursor to 0 x 0)
      'position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;';
    const shadow = cursorHost.attachShadow({mode: 'closed'});
    const size = cfg.cursorSize;
    const hot = (1.5 * size) / 17;
    // Classic arrow, hot spot at the tip (1.5, 1.5) of a 17 x 25 drawing.
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .c { position: absolute; left: 0; top: 0; width: ${size}px; height: ${(size * 25) / 17}px; transform-origin: ${hot}px ${hot}px;
             filter: drop-shadow(0 ${size * 0.04}px ${size * 0.07}px rgba(0,0,0,0.45)); will-change: transform, opacity; }
        .r { position: absolute; left: 0; top: 0; width: 0; height: 0; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.9);
             will-change: transform, opacity; opacity: 0; }
        svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .d { position: absolute; left: 0; top: 0; width: ${size * 1.7}px; height: ${size * 1.7}px; border-radius: 50%; opacity: 0;
             background: rgba(255,255,255,0.26); box-shadow: 0 0 0 1.5px rgba(255,255,255,0.78), 0 ${size * 0.08}px ${size * 0.4}px rgba(0,0,0,0.35);
             will-change: transform, opacity; }
      </style>
      <div class="r"></div><div class="r"></div><div class="d"></div><div class="d"></div>
      <div class="c"><svg viewBox="0 0 17 25"><path d="M1.5 1.5 L1.5 19.6 L5.9 15.4 L8.8 22.4 L12 21 L9.1 14.2 L15.2 14.2 Z"
        fill="#fff" stroke="#0b0d0d" stroke-width="1.35" stroke-linejoin="round"/></svg></div>`;
    (document.documentElement || document.body).appendChild(cursorHost);
    cursorParts = {arrow: shadow.querySelector('.c'), rings: [...shadow.querySelectorAll('.r')], dots: [...shadow.querySelectorAll('.d')], hot, size};
    return cursorParts;
  };
  // state: {kind: 'arrow' | 'touch', x, y, opacity, press (0..1), ripples: [{x, y, age (ms)}]}
  const drawCursor = (s) => {
    if (!s) {
      if (cursorHost) cursorHost.style.display = 'none';
      return;
    }
    const p = ensureCursor();
    cursorHost.style.display = s.opacity > 0.001 ? 'block' : 'none';
    const k = 1 - 0.14 * s.press;
    const touch = s.kind === 'touch';
    p.arrow.style.opacity = touch ? '0' : String(s.opacity);
    p.arrow.style.transform = `translate(${s.x - p.hot}px, ${s.y - p.hot}px) scale(${k})`;
    // a finger: a soft disc that lands slightly large, settles, and lifts away
    p.dots.forEach((dot, i) => {
      const r = touch ? s.ripples[i] : null;
      if (!r || r.age < 0 || r.age > 700) {
        dot.style.opacity = '0';
        return;
      }
      const q = r.age / 700;
      const env = q < 0.1 ? q / 0.1 : Math.pow(1 - (q - 0.1) / 0.9, 1.8);
      const sc = q < 0.14 ? 1.14 - 0.24 * (q / 0.14) : 0.9 + 0.1 * Math.min(1, (q - 0.14) / 0.3);
      const half = (p.size * 1.7) / 2;
      dot.style.opacity = String(env * s.opacity);
      dot.style.transform = `translate(${r.x - half}px, ${r.y - half}px) scale(${sc})`;
    });
    p.rings.forEach((ring, i) => {
      const r = s.ripples[i];
      if (!r || r.age < 0 || r.age > 520) {
        ring.style.opacity = '0';
        return;
      }
      const q = r.age / 520;
      const e = 1 - Math.pow(1 - q, 3);
      const rad = 5 + 19 * e;
      ring.style.opacity = String(0.55 * (1 - q) * s.opacity);
      ring.style.transform = `translate(${r.x - rad}px, ${r.y - rad}px)`;
      ring.style.width = `${rad * 2}px`;
      ring.style.height = `${rad * 2}px`;
    });
  };

  /* ---------------- one recorded frame ---------------- */
  // `lag` = how far the fake clock (whole milliseconds) is ahead of the exact frame time. rAF
  // stamps and animation steps use the exact time, so motion is uniform to the sub-millisecond.
  rec.frame = async (cursor, lag = 0) => {
    const t = now() - lag;
    stepScroll(t);
    flushRaf(t);
    const stepped = stepAnimations(t);
    stepSmil(t);
    await stepVideos(t);
    drawCursor(cursor);
    rec.frames += 1;
    return {t, stepped, raf: rafQueue.size, tweens: tweens.size, scrollX: window.scrollX, scrollY: window.scrollY};
  };
  // Resolves after the browser has produced a real frame, so input queued for the next frame
  // (mousemove is rAF-aligned) has been dispatched before the frame is stepped.
  rec.realFrame = () =>
    new Promise((res) => {
      if (!nativeRafFn) return res(false);
      nativeRafFn(() => (nativeTimeout ? nativeTimeout(() => res(true), 0) : res(true)));
    });
  rec.status = () => ({
    nativeRaf: !!nativeRafFn,
    nativeTimeout: !!nativeTimeout,
    ownsRaf: rec.ownsRaf(),
    timeline: document.timeline.currentTime,
    animations: document.getAnimations().length,
    fakeDate: typeof Date.now === 'function' && Date.isFake === true,
  });
})();
