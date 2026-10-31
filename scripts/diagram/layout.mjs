#!/usr/bin/env node
// Lays out an architecture JSON for <ArchDiagram>.
//
//   node scripts/diagram/layout.mjs src/data/diagrams/trace.arch.json [options]
//
// Options
//   --out <dir>         where <id>.layout.json goes (default: next to the input)
//   --routing <r>       orthogonal (default) | splines
//   --repo <dir>        check every edge's evidence (file:line contains the code) and every
//                       node's line count against a checkout of the repository; fails on a mismatch
//   --folders           group nodes by folder when the input has no groups
//   --preview <png>     also write a quick PNG of the layout (for checking, not for the film)
//   --no-browser        measure text with built-in estimates instead of Chromium
//
// Units: u = 1/1000 of the frame height at camera zoom 1. Text is measured in Chromium with
// the film's own font files, so every card is sized to the type that will be drawn in it.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STYLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/engine/diagram/style.json'), 'utf8'));
const KINDS = ['module', 'data', 'model', 'ui', 'service', 'step', 'test'];
const FAMILY = {sans: 'Schibsted Grotesk', mono: 'JetBrains Mono'};
const FONT_FILES = [
  {family: 'Schibsted Grotesk', file: 'public/fonts/SchibstedGrotesk-VF.ttf', weight: '400 900'},
  {family: 'JetBrains Mono', file: 'public/fonts/JetBrainsMono-VF.ttf', weight: '100 800'},
];

// ---------------------------------------------------------------- CLI
const argv = process.argv.slice(2);
const opts = {routing: 'orthogonal', folders: false, browser: true};
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opts.out = argv[++i];
  else if (a === '--routing') opts.routing = argv[++i];
  else if (a === '--repo') opts.repo = argv[++i];
  else if (a === '--preview') opts.preview = argv[++i];
  else if (a === '--folders') opts.folders = true;
  else if (a === '--no-browser') opts.browser = false;
  else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
  else inputs.push(a);
}
if (!inputs.length) {
  console.error('usage: node scripts/diagram/layout.mjs <arch.json> [--out dir] [--repo dir] [--preview png]');
  process.exit(2);
}

// ---------------------------------------------------------------- text measurement
async function openBrowser() {
  const {chromium} = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of FONT_FILES) {
    const b64 = fs.readFileSync(path.join(ROOT, f.file)).toString('base64');
    await page.evaluate(
      async ({family, b64: data, weight}) => {
        const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const face = new FontFace(family, bin.buffer, {weight});
        await face.load();
        document.fonts.add(face);
      },
      {family: f.family, b64, weight: f.weight},
    );
  }
  return {browser, page};
}

function estimateWidth(it) {
  // Conservative fallbacks: JetBrains Mono advances are 0.6 em; Schibsted averages ~0.56 em.
  const n = [...it.text].length;
  const em = it.family === FAMILY.mono ? 0.6 : 0.56 + (it.weight - 500) * 0.0002;
  return n * it.size * (em + it.tracking);
}

async function measureAll(items, page) {
  if (!page) return items.map(estimateWidth);
  return page.evaluate((list) => {
    const ctx = document.createElement('canvas').getContext('2d');
    return list.map((it) => {
      ctx.font = `${it.weight} ${it.size}px "${it.family}"`;
      ctx.letterSpacing = `${it.tracking * it.size}px`;
      return ctx.measureText(it.text).width;
    });
  }, items);
}

const spec = (style, text) => ({text, family: FAMILY[style.font], size: style.size, weight: style.weight, tracking: style.tracking ?? 0});

// ---------------------------------------------------------------- input normalisation
const basename = (p) => {
  if (!p) return '';
  const t = p.replace(/\/+$/, '');
  const b = t.slice(t.lastIndexOf('/') + 1);
  return p.endsWith('/') ? `${b}/` : b;
};
const dirname = (p) => (p && p.includes('/') ? p.slice(0, p.replace(/\/+$/, '').lastIndexOf('/') + 1) : '');

function normalise(arch) {
  if (!Array.isArray(arch.nodes) || !Array.isArray(arch.edges)) throw new Error('architecture JSON needs nodes[] and edges[]');
  const ids = new Set();
  const nodes = arch.nodes.map((n) => {
    if (!n.id) throw new Error('every node needs an id');
    if (ids.has(n.id)) throw new Error(`duplicate node id ${n.id}`);
    ids.add(n.id);
    const kind = KINDS.includes(n.kind) ? n.kind : 'module';
    return {...n, kind, label: n.label ?? n.id, sub: n.sub ?? basename(n.path) ?? ''};
  });
  let groups = (arch.groups ?? []).map((g) => ({...g, label: g.label ?? g.id}));
  if (!groups.length && opts.folders) {
    const byDir = new Map();
    for (const n of nodes) {
      const d = dirname(n.path);
      if (!d) continue;
      if (!byDir.has(d)) byDir.set(d, []);
      byDir.get(d).push(n);
    }
    for (const [d, list] of byDir) {
      if (list.length < 2) continue;
      const gid = `dir:${d}`;
      groups.push({id: gid, label: d});
      for (const n of list) n.group = gid;
    }
  }
  const gids = new Set(groups.map((g) => g.id));
  for (const n of nodes) if (n.group && !gids.has(n.group)) throw new Error(`node ${n.id}: unknown group ${n.group}`);
  for (const g of groups) if (g.parent && !gids.has(g.parent)) throw new Error(`group ${g.id}: unknown parent ${g.parent}`);
  const edges = arch.edges.map((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) throw new Error(`edge ${e.from} -> ${e.to}: unknown node`);
    return {...e, id: e.id ?? `e${i}:${e.from}->${e.to}`, label: e.label ?? ''};
  });
  return {nodes, groups, edges};
}

// ---------------------------------------------------------------- evidence check
function checkEvidence(arch, repo) {
  const problems = [];
  let checked = 0;
  const lines = new Map();
  const read = (file) => {
    if (!lines.has(file)) {
      const p = path.join(repo, file);
      lines.set(file, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split(/\r?\n/) : null);
    }
    return lines.get(file);
  };
  for (const e of arch.edges) {
    for (const ev of e.evidence ?? []) {
      checked++;
      const src = read(ev.file);
      if (!src) problems.push(`${e.from} -> ${e.to}: ${ev.file} not found`);
      else if (!(src[ev.line - 1] ?? '').includes(ev.code.trim()))
        problems.push(`${e.from} -> ${e.to}: ${ev.file}:${ev.line} reads "${(src[ev.line - 1] ?? '').trim()}", not "${ev.code}"`);
    }
  }
  for (const n of arch.nodes) {
    if (n.loc == null || !n.path) continue;
    const p = path.join(repo, n.path);
    if (!fs.existsSync(p)) continue;
    let total = 0;
    const count = (f) => (total += fs.readFileSync(f, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      // a folder node counts its top-level source files
      for (const f of fs.readdirSync(p)) if (/\.(js|mjs|ts|tsx|py)$/.test(f)) count(path.join(p, f));
    } else count(p);
    checked++;
    if (total !== n.loc) problems.push(`${n.id}: ${n.path} has ${total} lines, the JSON says ${n.loc}`);
  }
  return {checked, problems};
}

// ---------------------------------------------------------------- geometry helpers
const r2 = (v) => Math.round(v * 100) / 100;
const ceil2 = (v) => Math.ceil(v / 2) * 2;

function cleanPolyline(pts) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01) continue;
    out.push([p[0], p[1]]);
  }
  // drop collinear interior points
  for (let i = out.length - 2; i >= 1; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 0.01) out.splice(i, 1);
  }
  return out;
}

// Remove small vertical jogs (a few units) by sliding an endpoint along its node side.
// A Z-shaped route whose jog is only a few units reads as a mistake: slide one end along its
// card side so the route runs straight, if that spot on the side is still free.
function straighten(pts, srcBox, dstBox, radius, tol, free) {
  if (pts.length !== 4) return pts;
  const [a, b, c, d] = pts;
  const horizontalZ = Math.abs(a[1] - b[1]) < 0.01 && Math.abs(c[1] - d[1]) < 0.01 && Math.abs(b[0] - c[0]) < 0.01;
  if (!horizontalZ) return pts;
  const jog = d[1] - a[1];
  if (Math.abs(jog) > tol || Math.abs(jog) < 0.01) return pts;
  const inside = (box, y) => y >= box.y + radius && y <= box.y + box.h - radius;
  if (inside(dstBox, a[1]) && free('W', a[1])) return [a, [d[0], a[1]]];
  if (inside(srcBox, d[1]) && free('E', d[1])) return [[a[0], d[1]], d];
  return pts;
}

const overlap = (A, B) => Math.max(0, Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)) * Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));

function placeLabel(points, w, h, obstacles, placed, radius) {
  const E = STYLE.edge;
  const cands = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p, q] = [points[i], points[i + 1]];
    const horizontal = Math.abs(p[1] - q[1]) < 0.01;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const usable = len - 2 * radius;
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (horizontal) {
      for (const side of [-1, 1]) {
        cands.push({box: {x: mx - w / 2, y: side < 0 ? my - 7 - h : my + 7, w, h}, fit: usable - w, seg: i, horizontal, side});
      }
    } else {
      // on a vertical run the pill sits on the wire itself, which passes behind it
      cands.push({box: {x: mx - w / 2, y: my - h / 2, w, h}, fit: usable - h, seg: i, horizontal, side: 0});
    }
  }
  let best = null;
  for (const c of cands) {
    let pen = 0;
    for (const o of obstacles) pen += overlap(c.box, o) * 4;
    for (const o of placed) pen += overlap(c.box, o) * 6;
    if (c.fit < 0) pen += -c.fit * 12;
    if (!c.horizontal) pen += 160;
    if (c.side > 0) pen += 30;
    if (!best || pen < best.pen) best = {...c, pen};
  }
  void E;
  return best;
}

// ---------------------------------------------------------------- layout
async function layoutOne(file, page) {
  const arch = JSON.parse(fs.readFileSync(file, 'utf8'));
  const {nodes, groups, edges} = normalise(arch);
  const C = STYLE.card;
  const G = STYLE.group;
  const E = STYLE.edge;
  const S = STYLE.spacing;

  // measure every string that ends up in a card, a group label or an edge label
  const items = [];
  const want = (style, text) => {
    items.push(spec(style, text));
    return items.length - 1;
  };
  const plan = nodes.map((n) => ({
    kind: want(C.kind, n.kind.toUpperCase()),
    title: want(C.title, n.label),
    sub: want(C.sub, n.sub),
    head: n.detail ? want(C.detailHead, detailHead(n)) : -1,
    detail: (n.detail ?? []).map((l) => want(C.detail, l)),
  }));
  const gplan = groups.map((g) => ({
    label: want(G.label, g.label.toUpperCase()),
    path: g.path ? want(G.path, g.path) : -1,
  }));
  const eplan = edges.map((e) => (e.label ? want(E.label, e.label) : -1));
  const widths = await measureAll(items, page);
  const W = (i) => (i < 0 ? 0 : widths[i]);

  const baseH = C.padTop + C.kind.lineH + C.gapKindTitle + C.title.lineH + C.gapTitleSub + C.sub.lineH + C.padBottom;
  const sized = nodes.map((n, i) => {
    const p = plan[i];
    const inner = Math.max(C.glyph + C.glyphGap + W(p.kind), W(p.title), W(p.sub));
    const w = Math.max(C.minW, ceil2(inner + 2 * C.padX + 4));
    let detail = null;
    if (n.detail?.length) {
      const dInner = Math.max(W(p.head), ...p.detail.map(W));
      const dw = Math.max(w, ceil2(dInner + 2 * C.padX + 6));
      const dh = baseH - C.padBottom + C.detail.gapTop + C.detailHead.lineH + C.detailHead.gapBelow + n.detail.length * C.detail.lineH + C.detail.padBottom;
      detail = {w: dw, h: ceil2(dh), head: detailHead(n), lines: n.detail};
    }
    return {node: n, w, h: baseH, detail};
  });
  const sizedById = new Map(sized.map((s) => [s.node.id, s]));

  // Groups are drawn afterwards as outlines around their members, so the graph is laid out
  // flat: members of one group then share ranks with everything else instead of being packed
  // into a block of their own. Members are inflated vertically by the group padding
  // (symmetrically, so centred ports stay on the card's centre line).
  const infl = (s) => (s.node.group ? G.pad + G.clearance : 0);
  // Edges inside one group, and edges the author marks `straight`, are the ones the node
  // placement tries hardest to keep level: they carry a group's reading line.
  const straightness = (e) => {
    if (e.straight) return 10;
    const a = sizedById.get(e.from).node.group;
    return a && a === sizedById.get(e.to).node.group ? 8 : 1;
  };
  const runElk = async (widthFor, fixed = null, ports = null) => {
    const elk = new ELK();
    const strategies = fixed
      ? {
          'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
          'elk.layered.layering.strategy': 'INTERACTIVE',
          'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
          'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
        }
      : {
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
          'elk.layered.nodePlacement.favorStraightEdges': 'true',
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        };
    const root = {
      id: '__root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': opts.routing === 'splines' ? 'SPLINES' : 'ORTHOGONAL',
        'elk.json.edgeCoords': 'ROOT',
        'elk.json.shapeCoords': 'ROOT',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(S.betweenLayers),
        'elk.spacing.nodeNode': String(S.nodeNode),
        'elk.spacing.edgeNode': String(S.edgeNode),
        'elk.spacing.edgeEdge': String(S.edgeEdge),
        'elk.layered.spacing.edgeNodeBetweenLayers': String(S.edgeNode),
        'elk.layered.spacing.edgeEdgeBetweenLayers': String(S.edgeEdge),
        'elk.spacing.componentComponent': String(S.componentGap),
        'elk.spacing.portPort': String(S.portPort),
        'elk.layered.thoroughness': '80',
        'elk.layered.mergeEdges': 'false',
        'elk.layered.unnecessaryBendpoints': 'false',
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
        ...strategies,
      },
      children: [],
      edges: [],
    };
    const el = new Map();
    for (const s of sized) {
      const node = {
        id: s.node.id,
        width: widthFor(s),
        height: s.h + 2 * infl(s),
        layoutOptions: {'elk.portConstraints': ports ? 'FIXED_POS' : 'FIXED_SIDE', 'elk.portAlignment.default': 'CENTER'},
        ports: [],
      };
      if (fixed) {
        const f = fixed.get(s.node.id);
        node.x = f.x;
        node.y = f.y - infl(s);
      }
      el.set(s.node.id, node);
      root.children.push(node);
    }
    for (const e of edges) {
      const out = {id: `${e.id}#out`, width: 0, height: 0, layoutOptions: {'elk.port.side': 'EAST'}};
      const inp = {id: `${e.id}#in`, width: 0, height: 0, layoutOptions: {'elk.port.side': 'WEST'}};
      if (ports) {
        out.x = widthFor(sizedById.get(e.from));
        out.y = ports.get(out.id) + infl(sizedById.get(e.from));
        inp.x = 0;
        inp.y = ports.get(inp.id) + infl(sizedById.get(e.to));
      }
      el.get(e.from).ports.push(out);
      el.get(e.to).ports.push(inp);
      root.edges.push({
        id: e.id,
        sources: [out.id],
        targets: [inp.id],
        layoutOptions: {'elk.layered.priority.straightness': String(straightness(e))},
      });
    }
    return elk.layout(root);
  };
  const boxesOf = (res) => {
    const boxes = new Map();
    for (const ch of res.children) {
      const d = infl(sizedById.get(ch.id));
      boxes.set(ch.id, {x: ch.x, y: ch.y + d, w: ch.width, h: ch.height - 2 * d});
    }
    return boxes;
  };

  // pass 1 finds the ranks; pass 2 gives every card in a rank the rank's width
  const first = boxesOf(await runElk((s) => s.w));
  const rankOf = rankByCentre([...first.entries()].map(([id, b]) => ({id, c: b.x + b.w / 2})));
  const rankW = new Map();
  for (const s of sized) {
    const r = rankOf.get(s.node.id);
    rankW.set(r, Math.max(rankW.get(r) ?? 0, s.w));
  }
  for (const s of sized) s.w = rankW.get(rankOf.get(s.node.id));
  for (const s of sized) if (s.detail) s.detail.w = Math.max(s.detail.w, s.w);
  const second = boxesOf(await runElk((s) => s.w));

  // pass 3: a designed grid. Cards sit on shared rows, either the rows the author asked for
  // (`row` on a node) or the rows found by snapping pass 2; ELK then routes around them.
  const rowOf = new Map();
  const hinted = sized.some((s) => s.node.row != null);
  if (hinted) {
    for (const s of sized) rowOf.set(s.node.id, s.node.row ?? null);
    // nodes without a hint take the nearest hinted row of pass 2
    const ref = sized.filter((s) => s.node.row != null).map((s) => ({row: s.node.row, cy: second.get(s.node.id).y + s.h / 2}));
    for (const s of sized) {
      if (rowOf.get(s.node.id) != null) continue;
      const cy = second.get(s.node.id).y + s.h / 2;
      rowOf.set(s.node.id, ref.reduce((b, r) => (Math.abs(r.cy - cy) < Math.abs(b.cy - cy) ? r : b)).row);
    }
  } else {
    const items = sized.map((s) => ({id: s.node.id, rank: rankOf.get(s.node.id), cy: second.get(s.node.id).y + s.h / 2})).sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const it of items) {
      let best = null;
      for (const r of rows) {
        if (r.ranks.has(it.rank) || Math.abs(r.cy - it.cy) > baseH * 0.55) continue;
        if (!best || Math.abs(r.cy - it.cy) < Math.abs(best.cy - it.cy)) best = r;
      }
      if (!best) rows.push((best = {cy: it.cy, n: 0, ranks: new Set()}));
      best.cy = (best.cy * best.n + it.cy) / (best.n + 1);
      best.n++;
      best.ranks.add(it.rank);
      it.row = best;
    }
    rows.sort((a, b) => a.cy - b.cy).forEach((r, i) => (r.index = i));
    for (const it of items) rowOf.set(it.id, it.row.index);
  }
  const warningsEarly = [];
  // Row centres. Two cards stacked in one rank need room for their group outlines (and the
  // legend on top of a group), or only an inner gap when they share a group. A fractional
  // row (2.5) sits between its neighbours; the gaps open until every pair fits.
  const legendH = G.label.lineH / 2;
  const need = (a, b) => {
    const same = a.node.group && a.node.group === b.node.group;
    const gap = same ? S.innerGap : infl(a) + infl(b) + (b.node.group ? legendH : 0) + S.rowGap;
    return a.h / 2 + b.h / 2 + gap;
  };
  const rowVals = [...new Set(rowOf.values())];
  const whole = [...new Set(rowVals.flatMap((r) => [Math.floor(r), Math.ceil(r)]))].sort((a, b) => a - b);
  const pitch = new Map();
  for (let i = 1; i < whole.length; i++) {
    let p = baseH + S.innerGap;
    for (const a of sized)
      for (const b of sized)
        if (rowOf.get(a.node.id) === whole[i - 1] && rowOf.get(b.node.id) === whole[i] && rankOf.get(a.node.id) === rankOf.get(b.node.id)) p = Math.max(p, need(a, b));
    pitch.set(whole[i], p);
  }
  const centreOf = () => {
    const c = new Map();
    let y = 0;
    whole.forEach((r, i) => {
      y += i ? pitch.get(r) : 0;
      c.set(r, y);
    });
    return (r) => (Number.isInteger(r) ? c.get(r) : c.get(Math.floor(r)) + (c.get(Math.ceil(r)) - c.get(Math.floor(r))) * (r - Math.floor(r)));
  };
  let rowY = centreOf();
  for (let pass = 0; pass < 20; pass++) {
    let bad = null;
    for (const a of sized)
      for (const b of sized) {
        if (a === b || rankOf.get(a.node.id) !== rankOf.get(b.node.id)) continue;
        const ra = rowOf.get(a.node.id);
        const rb = rowOf.get(b.node.id);
        if (!(ra < rb)) continue;
        const deficit = need(a, b) - (rowY(rb) - rowY(ra));
        if (deficit > 0.5 && (!bad || deficit > bad.deficit)) bad = {deficit, ra, rb};
      }
    if (!bad) break;
    // open the whole-row gaps between the two rows, proportionally
    const span = whole.filter((r) => r > bad.ra && r <= Math.ceil(bad.rb));
    const k = bad.deficit / ((rowY(bad.rb) - rowY(bad.ra)) || 1);
    for (const r of span) pitch.set(r, pitch.get(r) * (1 + k) + 0.5);
    rowY = centreOf();
  }
  const cardTop = (s) => rowY(rowOf.get(s.node.id)) - s.h / 2;

  // Long edges (more than one rank) get a horizontal track through the ranks they cross:
  // the target's row if it is free, else the source's row, else the quietest gap between
  // rows. The track is pinned with a waypoint per crossed rank, so ELK routes only short
  // hops and never has to push a card aside.
  const rankCol = new Map();
  for (const s of sized) rankCol.set(rankOf.get(s.node.id), {x: second.get(s.node.id).x, w: s.w});
  const gapsMid = [];
  for (let i = 1; i < whole.length; i++) gapsMid.push((rowY(whole[i - 1]) + rowY(whole[i])) / 2);
  const tracks = new Map();
  const waypoints = [];
  const chains = new Map();
  for (const e of [...edges].sort((a, b) => rankOf.get(b.to) - rankOf.get(b.from) - (rankOf.get(a.to) - rankOf.get(a.from)))) {
    const r0 = rankOf.get(e.from);
    const r1 = rankOf.get(e.to);
    if (r1 - r0 < 2) continue;
    const src = sizedById.get(e.from);
    const dst = sizedById.get(e.to);
    const sy = cardTop(src) + src.h / 2;
    const ty = cardTop(dst) + dst.h / 2;
    const mid = (sy + ty) / 2;
    const base = [ty, sy, ...[...gapsMid].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))];
    const cands = base.flatMap((c) => [c, c - S.edgeEdge, c + S.edgeEdge, c - 2 * S.edgeEdge, c + 2 * S.edgeEdge]);
    const friendly = new Set([src.node.group, dst.node.group].filter(Boolean));
    const free = (c) => {
      for (let k = r0 + 1; k < r1; k++) {
        for (const s of sized) {
          if (rankOf.get(s.node.id) !== k) continue;
          const m = friendly.has(s.node.group) ? S.edgeNode : S.edgeNode + infl(s) + (s.node.group ? legendH : 0);
          const top = cardTop(s);
          if (c > top - m && c < top + s.h + m) return false;
        }
        for (const t of tracks.get(k) ?? []) if (Math.abs(t - c) < S.edgeEdge) return false;
      }
      // the hop onto the track and the hop off it must not run level with another card's
      // ports in those two channels, or the two lines would read as one
      const band = (s, side) => {
        const has = edges.some((q) => (side === 'E' ? q.from === s.node.id : q.to === s.node.id) && q.id !== e.id);
        if (!has) return false;
        const top = cardTop(s);
        return c > top + C.radius - S.edgeEdge && c < top + s.h - C.radius + S.edgeEdge;
      };
      for (const s of sized) {
        if (s === src || s === dst) continue;
        if (rankOf.get(s.node.id) === r0 && band(s, 'E')) return false;
        if (rankOf.get(s.node.id) === r1 && band(s, 'W')) return false;
      }
      return true;
    };
    const c = cands.find(free);
    if (c == null) continue;
    const ids = [];
    for (let k = r0 + 1; k < r1; k++) {
      (tracks.get(k) ?? tracks.set(k, []).get(k)).push(c);
      const id = `wp:${e.id}:${k}`;
      waypoints.push({id, rank: k, x: rankCol.get(k).x, w: rankCol.get(k).w, y: c});
      ids.push(id);
    }
    chains.set(e.id, ids);
  }

  // Hops: every edge becomes a chain of rank-to-rank hops (through its waypoints, if any).
  const wpById = new Map(waypoints.map((w) => [w.id, w]));
  const hops = [];
  for (const e of edges) {
    const seq = [e.from, ...(chains.get(e.id) ?? []), e.to];
    for (let i = 0; i < seq.length - 1; i++) hops.push({id: `${e.id}~${i}`, edge: e.id, a: seq[i], b: seq[i + 1]});
  }
  const centreY = (id, rowShift) => {
    const w = wpById.get(id);
    if (w) return w.y + shiftFor(rowShift, w.y);
    const s = sizedById.get(id);
    return cardTop(s) + shiftForRow(rowShift, rowOf.get(id)) + s.h / 2;
  };
  const shiftForRow = (rowShift, r) => {
    let d = 0;
    for (const [row, v] of rowShift) if (row <= r) d += v;
    return d;
  };
  const shiftFor = (rowShift, y) => {
    let d = 0;
    for (const [row, v] of rowShift) if (rowY(row) - 1 <= y) d += v;
    return d;
  };

  // Ports: on each card side, hops are ordered by where their other end sits (so routes do
  // not cross on the way in), and a hop to the same row is anchored on the centre line, so
  // chains run dead straight. Waypoints have one port each side, on their track.
  const assignPorts = (rowShift) => {
    const sides = new Map();
    const add = (k, v) => (sides.get(k) ?? sides.set(k, []).get(k)).push(v);
    for (const h of hops) {
      if (sizedById.has(h.a)) add(`${h.a}|E`, {port: `${h.id}#out`, me: h.a, other: h.b});
      if (sizedById.has(h.b)) add(`${h.b}|W`, {port: `${h.id}#in`, me: h.b, other: h.a});
    }
    const rk = (id) => (sizedById.has(id) ? rankOf.get(id) : wpById.get(id).rank);
    const out = new Map();
    for (const list of sides.values()) {
      const me = list[0].me;
      const h = sizedById.get(me).h;
      const myCy = centreY(me, rowShift);
      for (const it of list) {
        it.dy = centreY(it.other, rowShift) - myCy;
        it.dist = Math.abs(rk(it.other) - rankOf.get(me));
      }
      list.sort((a, b) => (Math.abs(a.dy - b.dy) > 1 ? a.dy - b.dy : a.dy < 0 ? a.dist - b.dist : b.dist - a.dist));
      const sp = S.portPort;
      let ys = list.map((_, i) => i * sp);
      const anchor = list.findIndex((it) => Math.abs(it.dy) < 1);
      const shift = anchor >= 0 ? h / 2 - ys[anchor] : h / 2 - ((list.length - 1) * sp) / 2;
      ys = ys.map((v) => v + shift);
      const lo = C.radius + 8;
      const hi = h - C.radius - 8;
      if (ys[0] < lo) ys = ys.map((v) => v + (lo - ys[0]));
      if (ys[ys.length - 1] > hi) ys = ys.map((v) => v - (ys[ys.length - 1] - hi));
      list.forEach((it, i) => out.set(it.port, ys[i]));
      for (const it of list) it.y = ys[list.indexOf(it)];
    }
    // facing ports of different edges in one channel stay an edge spacing apart
    const abs = (it) => centreY(it.me, rowShift) - sizedById.get(it.me).h / 2 + out.get(it.port);
    const lists = [...sides.entries()];
    for (const [kW, west] of lists) {
      if (!kW.endsWith('|W')) continue;
      const rk = rankOf.get(west[0].me);
      const facing = lists.filter(([k, l]) => k.endsWith('|E') && rankOf.get(l[0].me) === rk - 1).flatMap(([, l]) => l);
      const h = sizedById.get(west[0].me).h;
      for (const it of west) {
        const edgeOf = (port) => port.slice(0, port.lastIndexOf('~'));
        const clash = facing.find((f) => edgeOf(f.port) !== edgeOf(it.port) && Math.abs(abs(f) - abs(it)) < S.edgeEdge * 0.9);
        if (!clash || Math.abs(it.dy) < 1) continue;
        const dir = out.get(it.port) >= h / 2 ? 1 : -1;
        const moved = out.get(it.port) + dir * (S.edgeEdge - Math.abs(abs(clash) - abs(it)));
        if (moved > C.radius + 4 && moved < h - C.radius - 4) out.set(it.port, moved);
      }
    }
    return out;
  };

  const runFinal = async (rowShift) => {
    const elk = new ELK();
    const ports = assignPorts(rowShift);
    const root = {
      id: '__root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': opts.routing === 'splines' ? 'SPLINES' : 'ORTHOGONAL',
        'elk.json.edgeCoords': 'ROOT',
        'elk.json.shapeCoords': 'ROOT',
        'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
        'elk.layered.layering.strategy': 'INTERACTIVE',
        'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
        'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
        'elk.layered.spacing.nodeNodeBetweenLayers': String(S.betweenLayers),
        // positions are final: collisions are already resolved, so ELK needs no slack of its own
        'elk.spacing.nodeNode': '2',
        'elk.spacing.edgeNode': '2',
        'elk.spacing.edgeEdge': String(S.edgeEdge),
        'elk.layered.spacing.edgeNodeBetweenLayers': String(S.edgeNode),
        'elk.layered.spacing.edgeEdgeBetweenLayers': String(S.edgeEdge),
        'elk.layered.mergeEdges': 'false',
        'elk.layered.unnecessaryBendpoints': 'false',
        'elk.padding': '[top=0,left=0,bottom=0,right=0]',
      },
      children: [],
      edges: [],
    };
    const el = new Map();
    for (const s of sized) {
      const node = {
        id: s.node.id,
        x: rankCol.get(rankOf.get(s.node.id)).x,
        y: cardTop(s) + shiftForRow(rowShift, rowOf.get(s.node.id)),
        width: s.w,
        height: s.h,
        layoutOptions: {'elk.portConstraints': 'FIXED_POS'},
        ports: [],
      };
      el.set(s.node.id, node);
      root.children.push(node);
    }
    for (const w of waypoints) {
      const node = {id: w.id, x: w.x, y: w.y + shiftFor(rowShift, w.y) - 0.5, width: w.w, height: 1, layoutOptions: {'elk.portConstraints': 'FIXED_POS'}, ports: []};
      el.set(w.id, node);
      root.children.push(node);
    }
    for (const h of hops) {
      const a = el.get(h.a);
      const b = el.get(h.b);
      const out = {id: `${h.id}#out`, width: 0, height: 0, x: a.width, y: sizedById.has(h.a) ? ports.get(`${h.id}#out`) : 0.5, layoutOptions: {'elk.port.side': 'EAST'}};
      const inp = {id: `${h.id}#in`, width: 0, height: 0, x: 0, y: sizedById.has(h.b) ? ports.get(`${h.id}#in`) : 0.5, layoutOptions: {'elk.port.side': 'WEST'}};
      a.ports.push(out);
      b.ports.push(inp);
      root.edges.push({id: h.id, sources: [out.id], targets: [inp.id]});
    }
    return {res: await elk.layout(root), placed: root.children};
  };

  // ELK should keep every card where it was put; if it ever does not, the row moves with it
  // and the routing runs again, so rows stay rows.
  const rowShift = new Map();
  let res = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const run = await runFinal(rowShift);
    res = run.res;
    const want = new Map(run.placed.map((n) => [n.id, n.y]));
    const ref = sized[0].node.id;
    const got = new Map(res.children.map((n) => [n.id, n.y]));
    const off = got.get(ref) - want.get(ref);
    let worst = null;
    for (const s of sized) {
      const d = got.get(s.node.id) - off - want.get(s.node.id);
      if (Math.abs(d) > 0.5 && (!worst || rowOf.get(s.node.id) < rowOf.get(worst.id))) worst = {id: s.node.id, d};
    }
    if (!worst) break;
    const r = rowOf.get(worst.id);
    rowShift.set(r, (rowShift.get(r) ?? 0) + Math.max(worst.d, 4));
    if (attempt === 5) warningsEarly.push(`rows did not settle (${worst.id} moved ${worst.d.toFixed(1)} u)`);
  }
  const boxes = new Map();
  for (const ch of res.children) if (sizedById.has(ch.id)) boxes.set(ch.id, {x: ch.x, y: ch.y, w: ch.width, h: ch.height});
  // spline routes come back as cubic Bezier control points: sample them into a smooth line
  const sampleSpline = (pts) => {
    if (opts.routing !== 'splines' || pts.length < 4 || (pts.length - 1) % 3 !== 0) return pts;
    const out = [pts[0]];
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const [p0, p1, p2, p3] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
      for (let k = 1; k <= 16; k++) {
        const u = k / 16;
        const m = 1 - u;
        const f = (j) => m * m * m * p0[j] + 3 * m * m * u * p1[j] + 3 * m * u * u * p2[j] + u * u * u * p3[j];
        out.push([f(0), f(1)]);
      }
    }
    return out;
  };
  const hopPts = new Map();
  for (const e of res.edges) {
    const sec = e.sections?.[0];
    if (sec) hopPts.set(e.id, sampleSpline([sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint].map((p) => [p.x, p.y])));
  }
  const routed = new Map();
  for (const e of edges) {
    const pts = [];
    for (const h of hops.filter((q) => q.edge === e.id)) pts.push(...(hopPts.get(h.id) ?? []));
    routed.set(e.id, pts);
  }

  // group outlines: the members' bounding box plus padding; if that box would swallow a card
  // that is not a member, fall back to one outline per cluster of members
  const cards = [...boxes.entries()].map(([id, b]) => ({id, ...b}));
  const pad = (b, p) => ({x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p});
  const union = (list) => {
    const x0 = Math.min(...list.map((b) => b.x));
    const y0 = Math.min(...list.map((b) => b.y));
    const x1 = Math.max(...list.map((b) => b.x + b.w));
    const y1 = Math.max(...list.map((b) => b.y + b.h));
    return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
  };
  const hits = (box, ids) => cards.some((c) => !ids.has(c.id) && overlap(pad(c, 6), box) > 0);
  const groupRects = new Map();
  const warnings = [...warningsEarly];
  for (const g of groups) {
    const members = cards.filter((c) => sizedById.get(c.id).node.group === g.id);
    if (!members.length) continue;
    const ids = new Set(members.map((m) => m.id));
    let rects = [pad(union(members), G.pad)];
    if (hits(rects[0], ids)) {
      warnings.push(`group ${g.id}: its members are not contiguous; drawn as separate outlines`);
      rects = members.map((m) => pad(m, G.pad));
      let merged = true;
      while (merged) {
        merged = false;
        outer: for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const u = union([rects[i], rects[j]]);
            if (!hits(u, ids)) {
              rects.splice(j, 1);
              rects[i] = u;
              merged = true;
              break outer;
            }
          }
        }
      }
      rects.sort((a, b) => a.y - b.y || a.x - b.x);
    }
    groupRects.set(g.id, rects);
  }
  const allGroupRects = [...groupRects.entries()].flatMap(([id, rs]) => rs.map((r) => ({id, r})));
  for (let i = 0; i < allGroupRects.length; i++)
    for (let j = i + 1; j < allGroupRects.length; j++)
      if (allGroupRects[i].id !== allGroupRects[j].id && overlap(allGroupRects[i].r, allGroupRects[j].r) > 0)
        warnings.push(`groups ${allGroupRects[i].id} and ${allGroupRects[j].id} overlap`);

  // normalise to the origin (group legends sit on the top border and rise above it)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x, y, w = 0, h = 0) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const b of boxes.values()) grow(b.x, b.y, b.w, b.h);
  for (const {r} of allGroupRects) grow(r.x, r.y - G.label.lineH / 2, r.w, r.h + G.label.lineH / 2);
  for (const pts of routed.values()) for (const p of pts) grow(p[0], p[1]);
  const ox = -minX;
  const oy = -minY;
  const mv = (b) => ({x: r2(b.x + ox), y: r2(b.y + oy), w: r2(b.w), h: r2(b.h)});

  const outNodes = sized.map((s) => {
    const n = s.node;
    const o = {id: n.id, label: n.label, kind: n.kind, sub: n.sub, ...mv(boxes.get(n.id)), rank: rankOf.get(n.id)};
    if (n.path) o.path = n.path;
    if (n.group) o.group = n.group;
    if (n.loc != null) o.loc = n.loc;
    if (s.detail) o.detail = s.detail;
    return o;
  });
  const nodeBox = new Map(outNodes.map((n) => [n.id, n]));

  const outGroups = groups
    .map((g, i) => {
      const rects = groupRects.get(g.id);
      if (!rects) return null;
      return {
        id: g.id,
        label: g.label,
        ...(g.path ? {path: g.path} : {}),
        rects: rects.map(mv),
        labelW: r2(W(gplan[i].label)),
        pathW: r2(W(gplan[i].path)),
        nodes: outNodes.filter((n) => n.group === g.id).map((n) => n.id),
      };
    })
    .filter(Boolean);

  // edges: tidy the routes, then find each label a quiet spot
  const ends = new Map();
  const push = (k, v) => (ends.get(k) ?? ends.set(k, []).get(k)).push(v);
  const shifted = new Map();
  for (const e of edges) {
    const pts = cleanPolyline((routed.get(e.id) ?? []).map((p) => [p[0] + ox, p[1] + oy]));
    shifted.set(e.id, pts);
    if (!pts.length) continue;
    push(`${e.from}:E`, {edge: e.id, y: pts[0][1]});
    push(`${e.to}:W`, {edge: e.id, y: pts[pts.length - 1][1]});
  }
  const legendBoxes = outGroups.flatMap((g) =>
    g.rects.map((r) => ({x: r.x + G.legendInset - 8, y: r.y - G.label.lineH / 2 - 3, w: g.labelW + (g.pathW ? g.pathW + G.pathGap : 0) + 16, h: G.label.lineH + 6})),
  );
  const obstacles = [...outNodes.map((n) => ({x: n.x - 5, y: n.y - 5, w: n.w + 10, h: n.h + 10})), ...legendBoxes];
  const placedLabels = [];
  const outEdges = edges.map((e, i) => {
    let pts = shifted.get(e.id);
    if (opts.routing !== 'splines') {
      const free = (key, y, self) => !(ends.get(key) ?? []).some((q) => q.edge !== self && Math.abs(q.y - y) < S.portPort * 0.75);
      const before = pts;
      pts = cleanPolyline(straighten(pts, nodeBox.get(e.from), nodeBox.get(e.to), C.radius + 6, 12, (side, y) => free(side === 'E' ? `${e.from}:E` : `${e.to}:W`, y, e.id)));
      if (pts !== before && pts.length) {
        for (const q of ends.get(`${e.from}:E`)) if (q.edge === e.id) q.y = pts[0][1];
        for (const q of ends.get(`${e.to}:W`)) if (q.edge === e.id) q.y = pts[pts.length - 1][1];
      }
    }
    const o = {id: e.id, from: e.from, to: e.to, label: e.label, points: pts.map(([x, y]) => [r2(x), r2(y)])};
    if (opts.routing === 'splines') o.curve = 'smooth';
    if (e.label) {
      const lw = W(eplan[i]) + 2 * E.labelPadX;
      const lh = E.label.lineH + 2 * E.labelPadY;
      const at = placeLabel(pts, lw, lh, obstacles, placedLabels, E.cornerRadius);
      if (at) {
        placedLabels.push(at.box);
        o.labelBox = mvRaw(at.box);
      }
    }
    if (e.evidence) o.evidence = e.evidence;
    return o;
  });

  // topological order: Kahn, ties broken by rank, then by height on the page
  const indeg = new Map(outNodes.map((n) => [n.id, 0]));
  const succ = new Map(outNodes.map((n) => [n.id, []]));
  for (const e of outEdges) {
    indeg.set(e.to, indeg.get(e.to) + 1);
    succ.get(e.from).push(e.to);
  }
  const key = (id) => {
    const n = nodeBox.get(id);
    return n.rank * 1e6 + n.y * 10 + n.x * 1e-3;
  };
  const ready = outNodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order = [];
  while (ready.length) {
    ready.sort((a, b) => key(a) - key(b));
    const id = ready.shift();
    order.push(id);
    for (const t of succ.get(id)) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) ready.push(t);
    }
  }
  const cyclic = order.length !== outNodes.length;
  if (cyclic) for (const n of [...outNodes].sort((a, b) => key(a.id) - key(b.id))) if (!order.includes(n.id)) order.push(n.id);
  order.forEach((id, i) => (nodeBox.get(id).order = i));

  return {
    layout: {
      id: arch.id ?? path.basename(file).replace(/\.arch\.json$/, ''),
      title: arch.title ?? arch.id ?? '',
      ...(arch.repo ? {repo: arch.repo} : {}),
      ...(arch.commit ? {commit: arch.commit} : {}),
      ...(arch.about ? {about: arch.about} : {}),
      generated: {by: 'scripts/diagram/layout.mjs', elk: 'layered', routing: opts.routing, measured: Boolean(page), cyclic},
      unit: 'u = 1/1000 of the frame height at camera zoom 1',
      style: STYLE,
      bounds: {w: r2(maxX - minX), h: r2(maxY - minY)},
      ranks: Math.max(...outNodes.map((n) => n.rank)) + 1,
      order,
      nodes: outNodes,
      groups: outGroups,
      edges: outEdges,
      ...(arch.paths ? {paths: arch.paths} : {}),
    },
    warnings,
  };
}

const mvRaw = (b) => ({x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h)});

function rankByCentre(list) {
  const sorted = [...list].sort((a, b) => a.c - b.c);
  const out = new Map();
  let rank = -1;
  let last = -Infinity;
  for (const it of sorted) {
    if (it.c - last > 40) rank++;
    last = it.c;
    out.set(it.id, rank);
  }
  return out;
}

function detailHead(n) {
  const parts = [];
  if (n.path) parts.push(n.path);
  if (n.loc != null) parts.push(`${n.loc} lines`);
  return parts.join(' · ').toUpperCase();
}

// ---------------------------------------------------------------- preview (checking only)
function previewSvg(L) {
  const C = L.style.card;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const pad = 40;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${L.bounds.w + 2 * pad}" height="${L.bounds.h + 2 * pad}" viewBox="${-pad} ${-pad} ${L.bounds.w + 2 * pad} ${L.bounds.h + 2 * pad}" style="background:#0d1110">`];
  const GS = L.style.group;
  for (const g of L.groups) {
    for (const r of g.rects) {
      parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${GS.radius}" fill="none" stroke="rgba(228,234,231,0.25)" stroke-dasharray="4 4"/>`);
    }
    for (const r of g.rects) {
      const lx = r.x + GS.legendInset;
      parts.push(`<rect x="${lx - 8}" y="${r.y - 10}" width="${g.labelW + (g.pathW ? g.pathW + GS.pathGap : 0) + 16}" height="20" fill="#0d1110"/>`);
      parts.push(`<text x="${lx}" y="${r.y + 5}" font-family="JetBrains Mono" font-size="${GS.label.size}" letter-spacing="${GS.label.tracking * GS.label.size}" fill="#919493">${esc(g.label.toUpperCase())}</text>`);
      if (g.path) parts.push(`<text x="${lx + g.labelW + GS.pathGap}" y="${r.y + 5}" font-family="JetBrains Mono" font-size="${GS.path.size}" fill="#858787">${esc(g.path)}</text>`);
    }
  }
  for (const e of L.edges) {
    parts.push(`<polyline points="${e.points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="rgba(228,234,231,0.45)" stroke-width="1.4"/>`);
    if (e.labelBox) {
      const b = e.labelBox;
      parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="#0d1110" stroke="rgba(116,201,174,0.5)"/>`);
      parts.push(`<text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 4.5}" text-anchor="middle" font-family="JetBrains Mono" font-size="13.5" fill="#84B1A2">${esc(e.label)}</text>`);
    }
  }
  for (const n of L.nodes) {
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${C.radius}" fill="rgba(13,18,16,0.95)" stroke="rgba(228,234,231,0.3)"/>`);
    const bx = n.x + C.padX;
    let y = n.y + C.padTop + C.kind.size * 0.8;
    parts.push(`<text x="${bx + C.glyph + C.glyphGap}" y="${y}" font-family="JetBrains Mono" font-weight="500" font-size="${C.kind.size}" letter-spacing="${C.kind.tracking * C.kind.size}" fill="#919493">${esc(n.kind.toUpperCase())} · ${n.order}</text>`);
    y = n.y + C.padTop + C.kind.lineH + C.gapKindTitle + C.title.size * 0.8;
    parts.push(`<text x="${bx}" y="${y}" font-family="Schibsted Grotesk" font-weight="650" font-size="${C.title.size}" letter-spacing="${C.title.tracking * C.title.size}" fill="#ECEEED">${esc(n.label)}</text>`);
    y += C.title.lineH - C.title.size * 0.8 + C.gapTitleSub + C.sub.size * 0.8;
    parts.push(`<text x="${bx}" y="${y}" font-family="JetBrains Mono" font-size="${C.sub.size}" fill="#858787">${esc(n.sub)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

async function writePreview(L, png, page) {
  if (!page) return console.warn('preview needs the browser');
  const svg = previewSvg(L);
  await page.setViewportSize({width: Math.ceil(L.bounds.w + 80), height: Math.ceil(L.bounds.h + 80)});
  await page.setContent(`<html><body style="margin:0;background:#0d1110">${svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(png), {recursive: true});
  await page.screenshot({path: png});
}

// ---------------------------------------------------------------- main
let session = null;
if (opts.browser) {
  try {
    session = await openBrowser();
  } catch (err) {
    console.warn(`Chromium unavailable (${err.message.split('\n')[0]}); using estimated text widths`);
  }
}
let failed = false;
try {
  for (const file of inputs) {
    const arch = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (opts.repo) {
      const {checked, problems} = checkEvidence(arch, path.resolve(opts.repo));
      if (problems.length) {
        failed = true;
        console.error(`${file}: ${problems.length} of ${checked} citations do not match the repository`);
        for (const p of problems) console.error(`  - ${p}`);
        continue;
      }
      console.log(`${file}: all ${checked} citations match ${opts.repo}`);
    }
    const {layout: L, warnings} = await layoutOne(file, session?.page ?? null);
    const outDir = opts.out ?? path.dirname(file);
    fs.mkdirSync(outDir, {recursive: true});
    const out = path.join(outDir, `${L.id}.layout.json`);
    fs.writeFileSync(out, `${JSON.stringify(L, null, 1)}\n`);
    console.log(`${out}: ${L.nodes.length} nodes, ${L.edges.length} edges, ${L.groups.length} groups, ${L.ranks} ranks, ${L.bounds.w} x ${L.bounds.h} u (aspect ${(L.bounds.w / L.bounds.h).toFixed(2)})`);
    for (const w of warnings) console.warn(`  warning: ${w}`);
    if (opts.preview) await writePreview(L, opts.preview, session?.page ?? null);
  }
} finally {
  await session?.browser.close();
}
process.exit(failed ? 1 : 0);
