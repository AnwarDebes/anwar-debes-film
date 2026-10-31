// The 66 public repositories on github.com/AnwarDebes (GitHub API, checked 2026-10-29), with the
// film's tier and chapter for each (research/synthesis.md, section 1). Generated from repos.json;
// dates are UTC days. `gated`: the name needs consent or Anwar's OK before it is shown (synthesis 8.4).
// `disclaimer`: show the non-affiliation line whenever the name is shown (synthesis 8.4.1).

export type RepoTier = 'deep' | 'feature' | 'short' | 'montage' | 'mention';

export interface Repo {
  /** Exact GitHub name. */
  id: string;
  /** Row in the film's running order (1..66). */
  order: number;
  /** Chapter the repo belongs to (01..12); `also` lists later chapters it returns in. */
  chapter: number;
  also: number[];
  tier: RepoTier;
  /** GitHub's primary language ('' when GitHub reports none). */
  language: string;
  created: string;
  pushed: string;
  stars: number;
  fork: boolean;
  /** No commits / zero size. */
  empty: boolean;
  gated: boolean;
  disclaimer: boolean;
}

export const REPOS: readonly Repo[] = [
  {id: "AnwarDebes", order: 1, chapter: 1, also: [12], tier: 'feature', language: "", created: '2026-10-19', pushed: '2026-10-28', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "AnwarDebes.github.io", order: 2, chapter: 1, also: [3, 12], tier: 'feature', language: "HTML", created: '2026-10-20', pushed: '2026-10-22', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Assignment1Cloud", order: 3, chapter: 1, also: [], tier: 'montage', language: "Go", created: '2024-03-02', pushed: '2024-03-03', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "WebOfEverything-", order: 4, chapter: 1, also: [], tier: 'montage', language: "CSS", created: '2024-09-16', pushed: '2024-09-16', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "PROG2053", order: 5, chapter: 1, also: [], tier: 'montage', language: "CSS", created: '2024-10-02', pushed: '2024-10-06', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "DNN", order: 6, chapter: 1, also: [], tier: 'montage', language: "Python", created: '2026-02-12', pushed: '2026-04-02', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Deep-Neural-Networks-Assignments", order: 7, chapter: 1, also: [], tier: 'montage', language: "Python", created: '2026-05-21', pushed: '2026-05-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "HexGTM", order: 8, chapter: 1, also: [], tier: 'mention', language: "", created: '2025-10-31', pushed: '2025-10-31', stars: 0, fork: false, empty: true, gated: false, disclaimer: false},
  {id: "Dynamic_Visualization", order: 9, chapter: 1, also: [], tier: 'short', language: "Python", created: '2025-11-10', pushed: '2025-11-10', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "glassbox-lm", order: 10, chapter: 2, also: [], tier: 'deep', language: "Python", created: '2026-10-10', pushed: '2026-10-23', stars: 1, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "trace", order: 11, chapter: 3, also: [], tier: 'deep', language: "Python", created: '2026-06-28', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "veritas", order: 12, chapter: 3, also: [], tier: 'deep', language: "Python", created: '2026-06-28', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "candor", order: 13, chapter: 4, also: [], tier: 'deep', language: "Python", created: '2026-06-28', pushed: '2026-10-21', stars: 1, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "reins", order: 14, chapter: 5, also: [], tier: 'deep', language: "Python", created: '2026-06-28', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "THGTM", order: 15, chapter: 5, also: [], tier: 'feature', language: "Python", created: '2026-06-12', pushed: '2026-10-21', stars: 1, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "clausegate", order: 16, chapter: 5, also: [], tier: 'short', language: "Python", created: '2026-05-24', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Clause-Driven-LLM", order: 17, chapter: 5, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-14', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "clause86", order: 18, chapter: 5, also: [], tier: 'short', language: "Python", created: '2026-05-24', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "clauseguard", order: 19, chapter: 5, also: [], tier: 'short', language: "Python", created: '2026-05-23', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "graphtm-cbr", order: 20, chapter: 6, also: [], tier: 'deep', language: "Python", created: '2026-05-18', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Multi-HGTM", order: 21, chapter: 6, also: [], tier: 'feature', language: "Python", created: '2026-06-12', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "HGTM", order: 22, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-05-23', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "RGTM", order: 23, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-13', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "subword-dep-graphtm", order: 24, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-05-23', pushed: '2026-05-23', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "attention-distilled-graphtm", order: 25, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-05-23', pushed: '2026-05-23', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "decoder-attention-distill-graphtm", order: 26, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-05-24', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "tm-llm-robustness-benchmark", order: 27, chapter: 6, also: [], tier: 'short', language: "Python", created: '2026-05-23', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "tsetlin-zoo", order: 28, chapter: 6, also: [], tier: 'short', language: "", created: '2026-05-24', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "DiTM", order: 29, chapter: 7, also: [], tier: 'feature', language: "Python", created: '2026-06-12', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "lifelong-tm", order: 30, chapter: 7, also: [], tier: 'short', language: "Python", created: '2026-05-24', pushed: '2026-05-24', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "CCTM", order: 31, chapter: 7, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "ConfTM", order: 32, chapter: 7, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "FedTM", order: 33, chapter: 7, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "RobTM", order: 34, chapter: 7, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Claude-Code-In-Motion", order: 35, chapter: 8, also: [], tier: 'deep', language: "JavaScript", created: '2026-06-15', pushed: '2026-10-21', stars: 1, fork: false, empty: false, gated: false, disclaimer: true},
  {id: "vsclaude", order: 36, chapter: 8, also: [], tier: 'feature', language: "TypeScript", created: '2026-06-21', pushed: '2026-09-07', stars: 1, fork: false, empty: false, gated: false, disclaimer: true},
  {id: "lucid", order: 37, chapter: 8, also: [], tier: 'deep', language: "Python", created: '2026-06-28', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "RL-CCA", order: 38, chapter: 8, also: [], tier: 'feature', language: "Python", created: '2026-05-04', pushed: '2026-10-21', stars: 1, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "RL", order: 39, chapter: 8, also: [], tier: 'mention', language: "", created: '2026-04-01', pushed: '2026-04-01', stars: 0, fork: false, empty: true, gated: false, disclaimer: false},
  {id: "SleepArchitect", order: 40, chapter: 9, also: [], tier: 'feature', language: "Python", created: '2026-06-12', pushed: '2026-10-21', stars: 1, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "ThermoGuard", order: 41, chapter: 9, also: [], tier: 'feature', language: "Python", created: '2026-06-12', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "CaffeineSense", order: 42, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "HotCarWatch", order: 43, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "PipeGuard", order: 44, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "SmokeShield", order: 45, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "HomeJoule", order: 46, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "PyroPredict", order: 47, chapter: 9, also: [], tier: 'short', language: "Python", created: '2026-06-12', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "PocketOS", order: 48, chapter: 10, also: [], tier: 'feature', language: "TypeScript", created: '2026-06-15', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Mneme-Education-Ecosystem", order: 49, chapter: 10, also: [], tier: 'feature', language: "TypeScript", created: '2026-06-12', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "IDM", order: 50, chapter: 10, also: [], tier: 'feature', language: "Python", created: '2026-04-13', pushed: '2026-10-21', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "drone-id", order: 51, chapter: 10, also: [], tier: 'short', language: "Python", created: '2026-06-15', pushed: '2026-06-15', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "SkillBridgeNorway", order: 52, chapter: 10, also: [], tier: 'short', language: "Python", created: '2026-04-12', pushed: '2026-04-12', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "CYFS", order: 53, chapter: 10, also: [], tier: 'short', language: "Python", created: '2026-04-13', pushed: '2026-04-13', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Kaleido", order: 54, chapter: 10, also: [], tier: 'short', language: "TypeScript", created: '2026-04-07', pushed: '2026-06-12', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "cookie-galaxy", order: 55, chapter: 10, also: [], tier: 'short', language: "JavaScript", created: '2026-06-15', pushed: '2026-06-15', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "knotten-web", order: 56, chapter: 11, also: [], tier: 'short', language: "TypeScript", created: '2026-09-13', pushed: '2026-09-13', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "knotten-test", order: 57, chapter: 11, also: [], tier: 'short', language: "TypeScript", created: '2026-06-15', pushed: '2026-06-28', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "knotten-test-2", order: 58, chapter: 11, also: [], tier: 'feature', language: "TypeScript", created: '2026-09-13', pushed: '2026-10-03', stars: 1, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "grimstad-kiosk-grill", order: 59, chapter: 11, also: [], tier: 'short', language: "TypeScript", created: '2025-12-02', pushed: '2026-04-13', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "Trondheim-Cookies", order: 60, chapter: 11, also: [], tier: 'short', language: "JavaScript", created: '2026-06-18', pushed: '2026-06-26', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "ballast", order: 61, chapter: 11, also: [], tier: 'short', language: "Python", created: '2026-06-15', pushed: '2026-06-15', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "hugin", order: 62, chapter: 11, also: [], tier: 'short', language: "Python", created: '2026-06-13', pushed: '2026-06-13', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "Goblin", order: 63, chapter: 11, also: [], tier: 'short', language: "TypeScript", created: '2026-01-13', pushed: '2026-06-17', stars: 0, fork: false, empty: false, gated: true, disclaimer: false},
  {id: "video-editing-skill", order: 64, chapter: 12, also: [], tier: 'short', language: "", created: '2026-09-24', pushed: '2026-09-25', stars: 0, fork: false, empty: false, gated: false, disclaimer: false},
  {id: "ai-medical-training-simulator", order: 65, chapter: 12, also: [], tier: 'mention', language: "", created: '2026-10-20', pushed: '2026-10-20', stars: 0, fork: false, empty: true, gated: false, disclaimer: false},
  {id: "assets", order: 66, chapter: 12, also: [], tier: 'mention', language: "Go", created: '2026-01-22', pushed: '2026-01-22', stars: 0, fork: true, empty: false, gated: false, disclaimer: false},
];
