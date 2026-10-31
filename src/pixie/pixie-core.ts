// MIT License
//
// Copyright (c) 2026 Anwar Debes
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// pixie-core.ts: a pure, deterministic port of Pixie's drawing and state machine.
//
// Source of truth: Claude-Code-In-Motion web/js/mascot.js (MIT, Copyright (c) 2026
// Anwar Debes), git blob 848bf1f8, commit 2c79ee0. Every expression below keeps the
// operand order of the original so results are bit-identical; verify.ts checks this
// against golden-rects.json and fsm-trace.json, which were produced by running the
// original file itself.
//
// No DOM, no clock, no Math.random: time, blinking and randomness are inputs.

export const PALETTE = {
  body: "#d97757",
  bodyHi: "#e8a085",
  bodyLo: "#b85d40",
  eye: "#2b2a27",
  white: "#f7f4ec",
  ink: "#3a3833",
  paper: "#f4efe2",
  pencil: "#e3b341",
  glass: "#bfe0e8",
  green: "#7db36a",
  red: "#e0594e",
  term: "#1a1915",
  termText: "#7db36a",
  spark: "#f0c674",
  bug: "#4a4640",
  shadow: "rgba(0,0,0,0.18)",
} as const;

export const SCENE_W = 34;
export const SCENE_H = 32;
export const MIN_DWELL = 150; // ms
export const ONESHOT_MS = 1500; // ms
export const BLINK_MIN_MS = 2200;
export const BLINK_SPAN_MS = 2600;
export const BLINK_CLOSED_MS = 140;

export const STATE_LABELS = {
  idle: "Resting",
  thinking: "Thinking",
  typing: "Typing",
  reading: "Reading",
  writing: "Editing",
  searching: "Searching",
  running: "Running",
  debugging: "Debugging",
  success: "Done!",
  error: "Uh oh",
  waiting: "Waiting for you",
} as const;

export type PixieState = keyof typeof STATE_LABELS;
export const PIXIE_STATES = Object.keys(STATE_LABELS) as PixieState[];

/** Parts let renderers mirror, layer or map heights without guessing from colour. */
export type Part =
  | "shadow" | "laptop" | "leg" | "antenna" | "body" | "eye" | "mouth"
  | "thought" | "document" | "paper" | "magnifier" | "bug" | "bang"
  | "sparkle" | "check" | "bubble" | "question" | "sweat";

/** [x, y, w, h, colour, part] in scene cells (34 x 32 grid), painter's order. */
export type Rect = [number, number, number, number, string, Part];

export interface PoseOptions {
  /** Eyes closed this frame (only affects the normal open eyes, as in the original). */
  blinking?: boolean;
  /** The original's prefers-reduced-motion path: t is forced to 0 and blinking off. */
  reduced?: boolean;
  /** "scurry" swaps in the running/searching leg formula (used for walking). */
  gait?: "state" | "scurry";
}

/** The canonical frame: what mascot.js _draw(now) paints for `state` at `t` seconds. */
export function pixieRects(state: PixieState, tIn: number, o: PoseOptions = {}): Rect[] {
  const reduced = !!o.reduced;
  const t = reduced ? 0 : tIn;
  const blinking = !reduced && !!o.blinking;
  const out: Rect[] = [];
  let part: Part = "shadow";
  const rect = (x: number, y: number, w: number, h: number, c: string) => { out.push([x, y, w, h, c, part]); };
  const dot = (x: number, y: number, c: string) => rect(x, y, 1, 1, c);

  // Gentle vertical bob; success jumps higher.
  let bob = Math.sin(t * 3) * 0.5;
  if (state === "success") bob = -Math.abs(Math.sin(t * 9)) * 2.2;
  let shake = 0;
  if (state === "error") shake = Math.sin(t * 40) * 0.6;

  part = "shadow";
  rect(11.5, 25.5, 11, 1.4, PALETTE.shadow);

  // ---- props behind the creature ----
  if (state === "typing" || state === "running" || state === "debugging") {
    part = "laptop";
    const lx = 12, ly = 21.5;
    rect(lx, ly + 3, 10, 1.2, PALETTE.bodyLo);
    rect(lx + 0.5, ly - 4, 9, 7, PALETTE.ink);
    if (state === "running") {
      rect(lx + 1.2, ly - 3.2, 7.6, 5.4, PALETTE.term);
      rect(lx + 2, ly - 2.4, 1, 0.8, PALETTE.termText);
      if (Math.floor(t * 2) % 2) rect(lx + 3.2, ly - 2.4, 1.6, 0.8, PALETTE.termText);
      rect(lx + 2, ly - 1, 4, 0.7, "rgba(125,179,106,0.6)");
      rect(lx + 2, ly + 0.1, 5.4, 0.7, "rgba(125,179,106,0.4)");
    } else {
      rect(lx + 1.2, ly - 3.2, 7.6, 5.4, PALETTE.glass);
      for (let i = 0; i < 3; i++) rect(lx + 2, ly - 2.4 + i * 1.4, 4 + (i % 2) * 2, 0.7, "rgba(43,42,39,0.45)");
      if (state === "debugging") rect(lx + 6.5, ly - 1, 1, 0.9, PALETTE.red);
    }
  }

  // ---- the creature ----
  const bx = 10 + shake;
  const by = 8 + bob;
  const BW = 14, BH = 11;
  const body = PALETTE.body;

  part = "leg";
  const lp = Math.sin(t * 6);
  const scurry = o.gait === "scurry" || state === "running" || state === "searching";
  const legXs = [bx + 1.5, bx + 4.5, bx + BW - 5.5, bx + BW - 2.5];
  legXs.forEach((lx, i) => {
    const off = scurry ? Math.sin(t * 8 + i) * 0.4 : lp * 0.2 * (i % 2 ? 1 : -1);
    rect(lx, by + BH - 0.5 + off, 1.6, 2.6, PALETTE.bodyLo);
  });

  part = "antenna";
  const sway = Math.sin(t * 2.2) * 0.5;
  const pulse = state === "thinking" ? Math.abs(Math.sin(t * 5)) * 0.6 : 0;
  for (const side of [-1, 1]) {
    const ax = side < 0 ? bx + 3 : bx + BW - 4;
    rect(ax, by - 2.4 - pulse, 1, 2.8 + pulse, body);
    rect(ax - 0.6 + side * sway, by - 3.6 - pulse, 2.2, 1.6, PALETTE.bodyHi);
  }

  part = "body";
  rect(bx + 1, by, BW - 2, BH, body);
  rect(bx, by + 1, BW, BH - 2, body);
  rect(bx + 2, by + 0.6, BW - 4, 1, PALETTE.bodyHi);
  rect(bx + 1, by + BH - 1.4, BW - 2, 1.4, PALETTE.bodyLo);

  part = "eye";
  {
    const eyeY = by + 3.4;
    const lx = bx + 3.3, rx = bx + BW - 5.3;
    const look = state === "reading" ? Math.sin(t * 3) * 0.8 : state === "searching" ? Math.sin(t * 2) * 0.6 : 0;
    const up = state === "thinking" ? -0.7 : 0;
    const drawEye = (ex: number) => {
      if (state === "success") {
        rect(ex, eyeY + 0.6, 1, 1, PALETTE.eye);
        rect(ex + 1, eyeY, 1, 1, PALETTE.eye);
        rect(ex + 2, eyeY + 0.6, 1, 1, PALETTE.eye);
        return;
      }
      if (state === "error") {
        rect(ex, eyeY, 1, 1, PALETTE.eye);
        rect(ex + 2, eyeY, 1, 1, PALETTE.eye);
        rect(ex + 1, eyeY + 1, 1, 1, PALETTE.eye);
        rect(ex, eyeY + 2, 1, 1, PALETTE.eye);
        rect(ex + 2, eyeY + 2, 1, 1, PALETTE.eye);
        return;
      }
      if (blinking) {
        rect(ex, eyeY + 1.4, 3, 0.8, PALETTE.eye);
        return;
      }
      rect(ex, eyeY, 3, 3.2, PALETTE.eye);
      rect(ex + 1.7 + look, eyeY + 0.4 + up, 0.9, 0.9, PALETTE.white);
    };
    drawEye(lx);
    drawEye(rx);
  }

  part = "mouth";
  {
    const mx = bx + BW / 2 - 1.5;
    const my = by + BH - 3.4;
    if (state === "success") {
      rect(mx, my, 0.8, 1, PALETTE.bodyLo);
      rect(mx + 0.8, my + 0.8, 1.6, 0.8, PALETTE.bodyLo);
      rect(mx + 2.4, my, 0.8, 1, PALETTE.bodyLo);
    } else if (state === "error" || state === "debugging") {
      rect(mx + 0.4, my + 0.8, 2.4, 0.8, PALETTE.bodyLo);
      rect(mx, my + 0.2, 0.8, 0.8, PALETTE.bodyLo);
      rect(mx + 2.6, my + 0.2, 0.8, 0.8, PALETTE.bodyLo);
    } else if (state === "thinking") {
      rect(mx + 0.8, my + 0.6, 1.6, 0.8, PALETTE.bodyLo);
    } else {
      rect(mx + 0.4, my + 0.4, 2.4, 0.8, PALETTE.bodyLo);
    }
  }

  // ---- overlays in front ----
  if (state === "thinking") {
    part = "thought";
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.2 + i * 0.4) % 1;
      const y = by - 4 - ph * 4;
      const x = bx + 11 + i * 1.4;
      rect(x, y, 1 + i * 0.2, 1 + i * 0.2, `rgba(217,119,87,${1 - ph})`);
    }
  }
  if (state === "reading") {
    part = "document";
    const dx = 13, dy = 18;
    rect(dx, dy, 8, 6, PALETTE.paper);
    rect(dx - 0.4, dy - 0.4, 8.8, 0.6, PALETTE.bodyLo);
    const scan = Math.floor((Math.sin(t * 3) * 0.5 + 0.5) * 3);
    for (let i = 0; i < 4; i++) rect(dx + 1, dy + 1 + i * 1.2, i === scan ? 6 : 5, 0.7, i === scan ? PALETTE.body : PALETTE.ink);
  }
  if (state === "writing") {
    part = "paper";
    const dx = 12.5, dy = 19;
    rect(dx, dy, 9, 6, PALETTE.paper);
    const prog = (Math.sin(t * 2) * 0.5 + 0.5);
    rect(dx + 1, dy + 1.5, 1 + prog * 6, 0.7, PALETTE.ink);
    rect(dx + 1, dy + 3, 1 + ((prog + 0.3) % 1) * 6, 0.7, PALETTE.ink);
    const px = dx + 1 + prog * 6;
    rect(px, dy + 0.2, 1, 3.4, PALETTE.pencil);
    rect(px, dy + 3.4, 1, 0.8, PALETTE.ink);
  }
  if (state === "searching") {
    part = "magnifier";
    const cx = bx + 7 + Math.cos(t * 2) * 6;
    const cy = by + 14 + Math.sin(t * 2) * 3;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; dot(cx + Math.cos(a) * 2.4, cy + Math.sin(a) * 2.4, PALETTE.ink); }
    rect(cx + 0.4, cy + 0.4, 1.6, 1.6, PALETTE.glass);
    rect(cx + 2, cy + 2, 2.4, 1, PALETTE.ink);
    if (Math.floor(t * 3) % 2) dot(cx - 3, cy - 3, PALETTE.spark);
  }
  if (state === "debugging") {
    part = "bug";
    const bxg = 9 + ((t * 4) % 16);
    const jit = Math.sin(t * 30) * 0.3;
    rect(bxg, 24 + jit, 2.4, 1.6, PALETTE.bug);
    dot(bxg - 0.6, 24 + jit, PALETTE.bug);
    dot(bxg + 2.4, 24 + jit, PALETTE.bug);
    dot(bxg + 0.4, 23.4 + jit, PALETTE.red);
    if (Math.floor(t * 2) % 2) {
      part = "bang";
      rect(bx + 12, by - 3, 0.9, 2, PALETTE.red);
      dot(bx + 12, by - 0.6, PALETTE.red);
    }
  }
  if (state === "success") {
    part = "sparkle";
    const spk = [[6, 4], [26, 6], [28, 18], [5, 16]];
    spk.forEach(([x, y], i) => {
      if (Math.floor(t * 6 + i) % 2) {
        dot(x, y - Math.sin(t * 4 + i) * 1.5, PALETTE.spark);
        dot(x + 1, y - 1 - Math.sin(t * 4 + i) * 1.5, PALETTE.white);
      }
    });
    part = "check";
    rect(24, 20, 1, 1, PALETTE.green);
    rect(25, 21, 1, 1, PALETTE.green);
    rect(26, 20, 1, 1, PALETTE.green);
    rect(27, 19, 1, 1, PALETTE.green);
    rect(28, 18, 1, 1, PALETTE.green);
  }
  if (state === "waiting") {
    part = "bubble";
    const lift = reduced ? 0 : Math.sin(t * 2.4) * 0.4;
    const qx = bx + 15.4, qy = by - 3.4 + lift;
    rect(qx, qy, 6.2, 6, PALETTE.white);
    rect(qx - 0.6, qy + 0.6, 7.4, 4.8, PALETTE.white);
    rect(qx - 1.4, qy + 4.4, 1.4, 1.2, PALETTE.white);
    part = "question";
    rect(qx + 1.6, qy + 0.9, 3, 1, PALETTE.body);
    rect(qx + 3.6, qy + 1.9, 1, 1, PALETTE.body);
    rect(qx + 2.6, qy + 2.6, 1, 1.2, PALETTE.body);
    if (reduced || Math.floor(t * 2) % 2 === 0) rect(qx + 2.6, qy + 4.4, 1, 0.9, PALETTE.body);
  }
  if (state === "error") {
    part = "sweat";
    rect(bx + 13, by + 2, 1, 1.6, PALETTE.glass);
    dot(bx + 13, by + 3.4, PALETTE.glass);
  }
  return out;
}

/** Translate a whole frame (walking). Pure addition, so dx = dy = 0 is exact. */
export function translateRects(rects: Rect[], dx: number, dy: number): Rect[] {
  if (dx === 0 && dy === 0) return rects;
  return rects.map(([x, y, w, h, c, p]) => [x + dx, y + dy, w, h, c, p]);
}

// Groups that keep their internal orientation when Pixie faces left: glyphs that
// would read backwards, and the props centred under Pixie (their lines are text).
const KEEP_ORIENTATION: ReadonlySet<Part> = new Set<Part>(["check", "question", "bang", "laptop", "document", "paper"]);

/** facing = "left": mirror about the scene centre, re-anchor glyph groups unflipped. */
export function mirrorRects(rects: Rect[]): Rect[] {
  const box = new Map<Part, [number, number]>();
  for (const [x, , w, , , p] of rects) {
    if (!KEEP_ORIENTATION.has(p)) continue;
    const b = box.get(p);
    box.set(p, b ? [Math.min(b[0], x), Math.max(b[1], x + w)] : [x, x + w]);
  }
  return rects.map(([x, y, w, h, c, p]) => {
    const b = box.get(p);
    if (b) return [x - b[0] + (SCENE_W - b[1]), y, w, h, c, p] as Rect;
    return [SCENE_W - x - w, y, w, h, c, p] as Rect;
  });
}

// ---------------------------------------------------------------- blinking
/**
 * The original schedules blinkAt = now + 2200 + Math.random() * 2600 whenever now
 * passes blinkAt, and shows closed eyes while now > blinkAt - 140. Deterministic
 * equivalent: interval k (k = 1, 2, ...) is 2.2 + 2.6 * rand(k) seconds, blink k ends
 * at B_k = sum of the first k intervals, eyes are closed for t in (B_k - 0.14, B_k].
 * `rand(k)` must return a uniform number in [0, 1); in Remotion use
 * random(`${seed}-blink-${k}`).
 */
export function blinkSchedule(rand: (k: number) => number, untilSeconds: number): Float64Array {
  const ends: number[] = [];
  let b = 0;
  for (let k = 1; b <= untilSeconds + 5; k++) {
    b += (BLINK_MIN_MS + rand(k) * BLINK_SPAN_MS) / 1000;
    ends.push(b);
  }
  return Float64Array.from(ends);
}

export function isBlinking(schedule: Float64Array, t: number): boolean {
  // first blink end >= t (binary search)
  let lo = 0, hi = schedule.length - 1, k = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (schedule[m] >= t) { k = m; hi = m - 1; } else lo = m + 1;
  }
  return k >= 0 && t > schedule[k] - BLINK_CLOSED_MS / 1000;
}

// ---------------------------------------------------------------- state machine
export interface Cue { frame: number; activity: string }
export interface Resolved { state: PixieState; target: PixieState; label: string }

/**
 * The original setActivity + _loop, stepped once per frame exactly as
 * requestAnimationFrame would (cues at a frame are applied before that frame's loop).
 * Time is compared in integer frame units, which is the original's millisecond test
 * without float noise:
 *   now - lastSwitch >= MIN_DWELL   <=>  (f - fSwitch) * 1000 >= MIN_DWELL * fps
 *   now > oneShotUntil              <=>  (f - fShot) * 1000 > ONESHOT_MS * fps
 * At 60 fps a switch needs 9 frames of dwell and a one-shot reverts on frame f0 + 91.
 * Returns one entry per frame, 0..lastFrame. Memoise it; it is O(frames).
 */
export function resolveTimeline(cues: Cue[], fps: number, lastFrame: number): Resolved[] {
  let state: PixieState = "idle", target: PixieState = "idle", label: string = STATE_LABELS.idle;
  let fSwitch: number | null = null, fShot: number | null = null;
  const dwellOk = (f: number) => fSwitch === null || (f - fSwitch) * 1000 >= MIN_DWELL * fps;
  const shotOver = (f: number) => fShot === null || (f - fShot) * 1000 > ONESHOT_MS * fps;
  const byFrame = new Map<number, string[]>();
  for (const c of cues) byFrame.set(c.frame, [...(byFrame.get(c.frame) ?? []), c.activity]);
  const out: Resolved[] = [];
  for (let f = 0; f <= lastFrame; f++) {
    for (const a of byFrame.get(f) ?? []) {
      const s = (a in STATE_LABELS ? a : "thinking") as PixieState; // unknown activity -> thinking
      if (s === "success" || s === "error") {
        state = s; target = s; fShot = f; fSwitch = f; label = STATE_LABELS[s];
      } else { target = s; label = STATE_LABELS[s]; } // the label leads; the pose waits for dwell
    }
    if (shotOver(f)) {
      if (state !== target && dwellOk(f)) { state = target; fSwitch = f; }
      if (state === "success" || state === "error") {
        state = target === state ? "idle" : target; // label is NOT updated here (original behaviour)
        target = state;
      }
    }
    out.push({ state, target, label });
  }
  return out;
}

// ---------------------------------------------------------------- renderers
/** Device-pixel rects exactly as the original _rect computes them. */
export function toDevice(rects: Rect[], u: number, ox = 0, oy = 0): Array<[number, number, number, number, string, Part]> {
  return rects.map(([x, y, w, h, c, p]) => [ox + Math.round(x * u), oy + Math.round(y * u), Math.ceil(w * u), Math.ceil(h * u), c, p]);
}

/** Largest integer cell size that fits a box, as the original _resize does. */
export function cellFor(widthPx: number, heightPx: number): number {
  return Math.max(1, Math.floor(Math.min(widthPx / SCENE_W, heightPx / SCENE_H)));
}

/** Draw a frame into a 2D context (canvas cleared first, transparent background). */
export function drawFrame(ctx: CanvasRenderingContext2D, rects: Rect[], u: number, ox = 0, oy = 0): void {
  ctx.imageSmoothingEnabled = false;
  for (const [x, y, w, h, c] of toDevice(rects, u, ox, oy)) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
}

// Pin heights by canonical colour. SITE = AnwarDebes.github.io assets/js/emblems.js
// draw.pixie, the existing Pixie pin emblem; the others extend it by the same logic
// (creature proud, props lower, dark details sunk, glints and sparks highest).
export const PIN_HEIGHT: Record<string, number> = {
  "#f7f4ec": 1.0, "#e8a085": 0.9, "#d97757": 0.74, "#b85d40": 0.56, // SITE
  "#bfe0e8": 0.5, "#3a3833": 0.36, "#2b2a27": 0.14,                  // SITE
  "#f4efe2": 0.8, "#e3b341": 0.9, "#f0c674": 0.95, "#7db36a": 0.62,  // proposed
  "#e0594e": 0.85, "#1a1915": 0.2, "#4a4640": 0.4,                    // proposed
};
const CODE_LINE_HEIGHT = 0.3; // rgba(43,42,39,0.45) on the laptop screen: SITE

function parseColour(c: string): [number, number, number, number] {
  if (c[0] === "#") { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const p = c.slice(c.indexOf("(") + 1, c.indexOf(")")).split(",").map(Number);
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

export interface PinSample { r: number; g: number; b: number; a: number; h: number; part: Part | null }

/**
 * Point-sample a frame at one scene coordinate (x, y in cells): source-over in
 * painter's order, exactly like the canvas but at an infinitely fine resolution.
 * Use one call per pin centre; the pin's colour is (r, g, b) / a and its relief h.
 */
export function samplePixie(rects: Rect[], x: number, y: number): PinSample {
  let r = 0, g = 0, b = 0, a = 0, h = 0, part: Part | null = null;
  for (const [rx, ry, rw, rh, c, p] of rects) {
    if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) continue;
    const [cr, cg, cb, ca] = parseColour(c);
    let ch: number;
    if (c[0] === "#") ch = PIN_HEIGHT[c] ?? 0.5;
    else if (c.startsWith("rgba(43,42,39")) ch = CODE_LINE_HEIGHT;
    else if (c.startsWith("rgba(0,0,0")) ch = h; // the shadow darkens, it never raises
    else if (c.startsWith("rgba(217,119,87")) ch = PIN_HEIGHT["#d97757"];
    else ch = PIN_HEIGHT["#7db36a"];
    h = ca >= 1 ? ch : h + (ch - h) * ca;
    r = cr * ca + r * (1 - ca); g = cg * ca + g * (1 - ca); b = cb * ca + b * (1 - ca); a = ca + a * (1 - ca);
    if (ca >= 1 || part === null) part = p;
  }
  return { r, g, b, a, h, part };
}
