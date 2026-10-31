import type {CurveSpec} from '../particles/curves';
import {CHAPTERS, REPO_LINKS, type RepoLink} from './links';
import {REPOS, type Repo, type RepoTier} from './repos';

// The constellation's layout, a pure function of the data. Time runs along +X (creation day, with
// long gaps compressed by a square root so 2024's three repositories and June 2026's eighteen-in-a-
// day both read). Each film chapter is a lane: a strand that wanders gently in Y and Z, stacked in
// chapter order from top to bottom and staggered in depth. Repos created on the same day in the same
// lane form a small ring around the strand: a day's work, side by side.

export type Vec3 = [number, number, number];

export interface LayoutOptions {
  /** Length of the time axis, world units. */
  span?: number;
  /** Vertical distance between lanes. */
  laneSpacing?: number;
  /** Depth stagger of the lanes. */
  depth?: number;
  /** Gentle wander of each strand. */
  wander?: number;
  /** In-focus core radius of a deep-dive node; other tiers scale down. */
  nodeRadius?: number;
  /** Centre of the layout. */
  origin?: Vec3;
}

export interface LayoutNode {
  repo: Repo;
  index: number;
  position: Vec3;
  /** 0-based lane (chapter - 1). */
  lane: number;
  /** Position on the time axis (world X before the origin offset). */
  x: number;
  radius: number;
  /** 1 for deep dives down to 0.2 for mentions: label priority and brightness. */
  weight: number;
}

export interface LayoutLane {
  chapter: number;
  title: string;
  idea: string;
  /** Centreline from the lane's first repo to the present (catmull-rom control points). */
  points: Vec3[];
  /** The lane before its first repo, from the start of the time axis (drawn faint and dashed). */
  pre: Vec3[];
  /** Where the lane's title sits: the start of the time axis. */
  titleAt: Vec3;
}

export interface LayoutLink {
  link: RepoLink;
  from: LayoutNode;
  to: LayoutNode;
  curve: CurveSpec;
}

export interface TimeTick {
  label: string;
  position: Vec3;
  major: boolean;
}

export interface ConstellationLayout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  lanes: LayoutLane[];
  links: LayoutLink[];
  spine: {from: Vec3; to: Vec3; ticks: TimeTick[]};
  /** The present (2026-10-29) at the end of the time axis, on the middle of the stack. */
  now: Vec3;
  bounds: {min: Vec3; max: Vec3};
  /** Time-axis X of an ISO date. */
  timeX: (iso: string) => number;
}

export const TIER_WEIGHT: Record<RepoTier, number> = {deep: 1, feature: 0.72, short: 0.5, montage: 0.34, mention: 0.24};
const TIER_SIZE: Record<RepoTier, number> = {deep: 1, feature: 0.8, short: 0.64, montage: 0.52, mention: 0.46};

const LANE_Z = [0.0, 0.26, -0.16, 0.12, -0.26, 0.2, -0.06, 0.3, -0.22, 0.06, -0.3, 0.16];
const NOW = '2026-10-29';

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

const cache = new Map<string, ConstellationLayout>();

/** Deterministic 0..1 from a string (FNV-1a). */
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
};

export const constellationLayout = (opts: LayoutOptions = {}): ConstellationLayout => {
  const key = JSON.stringify(opts);
  const hit = cache.get(key);
  if (hit) return hit;
  const span = opts.span ?? 5;
  const laneSpacing = opts.laneSpacing ?? 0.17;
  const depth = opts.depth ?? 1;
  const wander = opts.wander ?? 1;
  const r0 = opts.nodeRadius ?? 0.0025;
  const [ox, oy, oz] = opts.origin ?? [0, 0, 0];

  // the warped time axis: distinct creation days (plus today), gaps compressed by a square root
  const days = [...new Set([...REPOS.map((r) => r.created), NOW])].sort();
  const raw: number[] = [0];
  for (let i = 1; i < days.length; i++) raw.push(raw[i - 1] + 0.35 + Math.sqrt(day(days[i]) - day(days[i - 1])));
  const total = raw[raw.length - 1];
  const dayX = new Map<string, number>();
  days.forEach((d, i) => dayX.set(d, (raw[i] / total - 0.5) * span));
  const timeX = (iso: string): number => {
    const exact = dayX.get(iso);
    if (exact !== undefined) return exact;
    const dd = day(iso);
    for (let i = 1; i < days.length; i++) {
      const a = day(days[i - 1]);
      const b = day(days[i]);
      if (dd <= b) {
        // inside a gap: position along the square-root-compressed gap
        const f = Math.sqrt(Math.max(0, dd - a)) / Math.max(1e-9, Math.sqrt(b - a));
        return dayX.get(days[i - 1])! + (dayX.get(days[i])! - dayX.get(days[i - 1])!) * Math.min(1, f);
      }
    }
    return dayX.get(days[days.length - 1])!;
  };

  const laneY = (lane: number) => ((CHAPTERS.length - 1) / 2 - lane) * laneSpacing;
  // every chapter starts on one aligned column at the start of the time axis, then the strands
  // fan out in depth and begin to wander (over the first third of the axis)
  const xAxis0 = timeX(days[0]) - 0.12;
  const fan = (x: number) => {
    const k = Math.min(1, Math.max(0, (x - xAxis0) / (0.34 * span)));
    return k * k * (3 - 2 * k);
  };
  const strand = (lane: number, x: number): Vec3 => {
    const ph = lane * 1.7;
    const f = fan(x);
    return [
      x,
      laneY(lane) + f * 0.045 * wander * Math.sin(1.25 * x + ph),
      f * (LANE_Z[lane] * depth + 0.07 * wander * Math.sin(0.8 * x + ph * 1.3)),
    ];
  };

  // group repos per lane and day
  const groups = new Map<string, Repo[]>();
  for (const r of REPOS) {
    const k = `${r.chapter}|${r.created}`;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const nodes: LayoutNode[] = [];
  const byId = new Map<string, LayoutNode>();
  REPOS.forEach((repo, index) => {
    const lane = repo.chapter - 1;
    const g = groups.get(`${repo.chapter}|${repo.created}`)!;
    const k = g.indexOf(repo);
    const n = g.length;
    const x = timeX(repo.created);
    const c = strand(lane, x);
    let p: Vec3 = [c[0], c[1], c[2]];
    if (n > 1) {
      // a ring around the strand, tilted so its members separate in x as well
      const a = (k / n) * Math.PI * 2 + hashString(repo.created) * Math.PI * 2;
      const rr = 0.035 + 0.011 * n;
      p = [c[0] + 0.55 * rr * Math.cos(a + 0.9), c[1] + rr * Math.sin(a), c[2] + rr * Math.cos(a)];
    } else {
      const h = hashString(repo.id);
      p = [c[0], c[1] + 0.02 * (h - 0.5), c[2] + 0.03 * (hashString(repo.id + '#') - 0.5)];
    }
    const node: LayoutNode = {
      repo,
      index,
      position: [p[0] + ox, p[1] + oy, p[2] + oz],
      lane,
      x,
      radius: r0 * TIER_SIZE[repo.tier],
      weight: TIER_WEIGHT[repo.tier],
    };
    nodes.push(node);
    byId.set(repo.id, node);
  });

  // lanes: centreline from the first repo to the present, and faintly before it
  const xNow = timeX(NOW);
  const xStart = timeX(days[0]) - 0.12;
  const run = (lane: number, xa: number, xb: number): Vec3[] => {
    const pts: Vec3[] = [];
    const steps = Math.max(3, Math.ceil(((xb - xa) / span) * 24));
    for (let k = 0; k <= steps; k++) {
      const x = xa + ((xb - xa) * k) / steps;
      const c = strand(lane, x);
      pts.push([c[0] + ox, c[1] + oy, c[2] + oz]);
    }
    return pts;
  };
  const lanes: LayoutLane[] = CHAPTERS.map((ch, lane) => {
    const members = nodes.filter((nd) => nd.lane === lane).sort((a, b) => a.x - b.x);
    const x0 = members.length ? members[0].x : xNow;
    const t0 = strand(lane, xStart);
    return {
      chapter: ch.n,
      title: ch.title,
      idea: ch.idea,
      points: run(lane, x0, xNow),
      pre: x0 - xStart > 0.05 ? run(lane, xStart, x0) : [],
      titleAt: [t0[0] + ox, t0[1] + oy, t0[2] + oz],
    };
  });

  // links: arcs that bow towards the viewer (+Z), in proportion to their length so a short link
  // stays a gentle arc instead of a loop; links inside one lane also lift off the strand
  const links: LayoutLink[] = [];
  for (const link of REPO_LINKS) {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b) continue;
    const dx = b.position[0] - a.position[0];
    const dy = b.position[1] - a.position[1];
    const dz = b.position[2] - a.position[2];
    const d = Math.hypot(dx, dy, dz);
    const lift = Math.min(0.18, 0.01 + 0.22 * d);
    const side = a.lane === b.lane ? (a.lane % 2 ? -1 : 1) * 0.6 : 0;
    const curve: CurveSpec = {kind: 'arc', from: a.position, to: b.position, bend: [0, side * lift * 0.6, lift * 0.55]};
    links.push({link, from: a, to: b, curve});
  }

  // the time axis below the stack, with year and month ticks
  const yBase = laneY(CHAPTERS.length - 1) - 0.24 + oy;
  const ticks: TimeTick[] = [];
  for (let y = 2024; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const iso = `${y}-${String(m).padStart(2, '0')}-01`;
      if (iso < '2024-03-01' || iso > NOW) continue;
      const major = m === 1 || iso === '2024-03-01';
      ticks.push({label: major ? String(y) : '', position: [timeX(iso) + ox, yBase, oz], major});
    }
  }
  const spine = {from: [timeX(days[0]) + ox - 0.1, yBase, oz] as Vec3, to: [xNow + ox + 0.1, yBase, oz] as Vec3, ticks};

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const nd of nodes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], nd.position[i]);
      max[i] = Math.max(max[i], nd.position[i]);
    }
  }
  const out: ConstellationLayout = {
    nodes,
    byId,
    lanes,
    links,
    spine,
    now: [xNow + ox, oy, oz],
    bounds: {min, max},
    timeX: (iso) => timeX(iso) + ox,
  };
  cache.set(key, out);
  return out;
};
