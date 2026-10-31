// Edges of the 66-repo constellation: drawn only where code or data is actually shared
// (research/synthesis.md, diagram 12, with the dossiers it cites). Dashed edges are stated but not
// shown in code; dotted edges join one client project. Data streams run only along 'data' and
// 'code' edges: the particles are the shared artefacts.

export type LinkKind =
  /** the same file or data in both repos */
  | 'data'
  /** code copied or imported */
  | 'code'
  /** a successor or precursor (same recipe, the work moved) */
  | 'lineage'
  /** one client project across repos (dotted) */
  | 'project'
  /** vendored but unused (dashed) */
  | 'unused'
  /** claimed in the profile README, not shown in code (dashed) */
  | 'claim';

export interface RepoLink {
  from: string;
  to: string;
  kind: LinkKind;
  /** What is shared, for captions and debugging. */
  note: string;
}

export const REPO_LINKS: readonly RepoLink[] = [
  {from: 'trace', to: 'veritas', kind: 'data', note: 'one trace-model.json, identical SHA-256'},
  {from: 'trace', to: 'AnwarDebes.github.io', kind: 'data', note: 'one trace-model.json, identical SHA-256'},
  {from: 'THGTM', to: 'trace', kind: 'code', note: "THGTM's Echo-Trace automaton in tracekit/automata.py"},
  {from: 'Claude-Code-In-Motion', to: 'AnwarDebes.github.io', kind: 'code', note: 'mascot.js copied byte for byte as pixie-mascot.js'},
  {from: 'Claude-Code-In-Motion', to: 'vsclaude', kind: 'code', note: "Pixie, the banner mascot"},
  {from: 'HGTM', to: 'Multi-HGTM', kind: 'code', note: 'the HGTM library (datasets.py:53)'},
  {from: 'attention-distilled-graphtm', to: 'decoder-attention-distill-graphtm', kind: 'lineage', note: 'the precursor recipe'},
  {from: 'subword-dep-graphtm', to: 'tm-llm-robustness-benchmark', kind: 'code', note: 'its student model'},
  {from: 'attention-distilled-graphtm', to: 'tm-llm-robustness-benchmark', kind: 'code', note: 'its student model'},
  {from: 'subword-dep-graphtm', to: 'clauseguard', kind: 'code', note: "clauseguard's graph builder"},
  {from: 'attention-distilled-graphtm', to: 'clauseguard', kind: 'code', note: "clauseguard's graph builder"},
  {from: 'subword-dep-graphtm', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'attention-distilled-graphtm', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'decoder-attention-distill-graphtm', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'tm-llm-robustness-benchmark', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'HGTM', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'graphtm-cbr', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'clauseguard', to: 'tsetlin-zoo', kind: 'data', note: 'headline numbers copied verbatim'},
  {from: 'RL', to: 'RL-CCA', kind: 'lineage', note: 'the brief; the work lives in RL-CCA'},
  {from: 'knotten-test', to: 'knotten-web', kind: 'project', note: 'one client project'},
  {from: 'knotten-web', to: 'knotten-test-2', kind: 'project', note: 'one client project'},
  {from: 'THGTM', to: 'reins', kind: 'unused', note: 'ETTABank vendored, not imported by the shield'},
  {from: 'trace', to: 'reins', kind: 'claim', note: "the profile's safety stack: TRACE detects, REINS enforces"},
  {from: 'reins', to: 'veritas', kind: 'claim', note: "the profile's safety stack: REINS enforces, VERITAS verifies"},
];

/** Film chapters (synthesis.md 2.2): the constellation's lanes. */
export const CHAPTERS: ReadonlyArray<{n: number; title: string; idea: string}> = [
  {n: 1, title: 'True or false', idea: ''},
  {n: 2, title: 'Ninety-one hypotheses', idea: 'before the runs'},
  {n: 3, title: 'Check the guard', idea: 'prove it'},
  {n: 4, title: 'The explanation is the forward pass', idea: 'certificate'},
  {n: 5, title: 'After the alarm', idea: 'repair'},
  {n: 6, title: 'Graphs a clause can walk', idea: 'structure'},
  {n: 7, title: 'One machine, many guarantees', idea: 'guarantee'},
  {n: 8, title: 'Agents you can watch', idea: 'every step'},
  {n: 9, title: 'Models of the everyday', idea: 'arithmetic'},
  {n: 10, title: 'Built for people', idea: 'yours'},
  {n: 11, title: 'Real stakes', idea: 'source'},
  {n: 12, title: 'Show its work', idea: 'show its work'},
];
