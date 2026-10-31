import type {FilmTimeline} from '../../timeline';
import {timeKit} from './kit/time';

// Every event time of chapter 09, derived from the narration timeline (never hard-coded), so the
// picture (ch09.tsx) and the sound (ch09.cues.ts) land on the same frames after a re-take.

export const times09 = (tl: FilmTimeline) => {
  const {w, we, us, ue, S} = timeKit(tl);
  const ch = tl.chapter('09');
  const s = (id: string) => S(id);

  const S0 = s('09.0');
  const S1 = s('09.1');
  const S2 = s('09.2');
  const S3 = s('09.3');
  const S4 = s('09.4');
  const S5 = s('09.5');
  const S6 = s('09.6');
  const S7 = s('09.7');
  const S8 = s('09.8');
  const S9 = s('09.9');
  const S10 = s('09.10');
  const S11 = s('09.11');
  const S12 = s('09.12');

  // 09.0 the gate: a cube rises, its faces unfold into a net, the net becomes the family tree
  const gate = {
    start: S0.start,
    cube: S0.start,
    unfold: Math.max(S0.start + 1.0, w('u0901', 'family') - 0.25),
    unfoldDur: 1.45,
    tree: Math.max(S0.start + 3.0, w('u0901', 'graphs') - 0.2),
    cardAt: S0.start + 0.35,
    cardExit: Math.max(S0.start + 3.0, w('u0901', 'graphs') - 0.45),
  };

  // 09.1 tsetlin-zoo: the survey as a document in pins, and the R8 axis
  const zoo = {
    doc: us('u0902') - 0.3,
    plate: us('u0902'),
    axis: w('u0903', 'R8') - 0.25,
    rows: w('u0903', 'graph') - 0.1,
    bracket: w('u0903', 'half') - 0.05,
    paths: w('u0902', 'source') - 0.1,
    caveat: w('u0904', 'best') - 0.1,
    caveatLand: w('u0904', 'caveat'),
    dolly: S2.start - 1.55,
    dollyDur: 1.75,
  };

  // 09.2 subword-dep-graphtm: 'CEO earned more' builds as a graph of word pieces
  const sub = {
    plate: us('u0905'),
    nodes: w('u0905', 'word') - 0.15,
    seq: w('u0905', 'order') - 0.2,
    deps: w('u0905', 'grammar') - 0.2,
    bar: w('u0906', 'ninety-five') - 0.05,
    readme: w('u0906', 'ninety-five') + 0.75,
    strike: we('u0906', 'ninety-five') + 1.25,
    misses: w('u0906', 'failed') - 0.35,
    end: S3.start - 1.1,
  };

  // 09.3 attention-distilled-graphtm: faint attention arcs, five harden per token, BERT dissolves
  const attn = {
    morph: S3.start - 0.85,
    plate: us('u0907'),
    focus: w('u0907', 'five') - 0.15,
    all: w('u0907', 'attends') - 0.1,
    bert: w('u0907', 'BERT') - 0.35,
    dissolve: w('u0908', 'away') - 0.55,
    bar: w('u0908', 'ninety-four') - 0.05,
    note: we('u0908', 'R8') + 0.2,
  };

  // 09.4 decoder-attention-distill-graphtm: a dense web beside a backward chain; three teachers tie
  const dec = {
    split: S4.start - 0.75,
    plate: us('u0909'),
    chain: w('u0909', 'backwards') - 0.4,
    stats: w('u0910', 'chain') - 0.25,
    bars: w('u0910', 'tie') - 0.4,
    sig: w('u0910', 'significant') - 0.35,
    caveatFull: [ue('u0910') + 0.35, ue('u0910') + 3.45] as [number, number],
    axisExit: S5.start - 0.45,
  };

  // 09.5 tm-llm-robustness-benchmark: one edited review; the TM falls, BERT barely moves
  const rob = {
    raster: S5.start - 0.45,
    plate: us('u0911'),
    bars: w('u0911', 'same') - 0.2,
    tm: w('u0912', 'twenty-seven') - 0.35,
    bert: w('u0913', 'two') - 0.25,
    quote: w('u0914', 'contradicts') - 0.2,
    caveats: ue('u0914') + 0.15,
    end: S6.start - 0.8,
  };

  // 09.6 HGTM: two stacked layers; the feedback line carries nothing; three bars on the majority line
  const hgtm = {
    layers: S6.start - 0.8,
    plate: us('u0915'),
    both: w('u0915', 'both') - 0.1,
    lowered: w('u0916', 'upper') - 0.25,
    nothing: w('u0916', 'nothing') - 0.3,
    code: w('u0916', 'start') - 0.25,
    codeExit: w('u0916', 'majority') - 0.6,
    bars: w('u0916', 'majority') - 0.45,
    end: S7.start - 0.6,
  };

  // 09.7 RGTM: one tied bank stamped on every round; one hop perfect, two hops scattered
  const rgtm = {
    block: S7.start - 0.6,
    plate: us('u0917'),
    stamps: [w('u0917', 'every'), w('u0917', 'round'), w('u0917', 'message')] as [number, number, number],
    hop1: w('u0918', 'solved') - 0.25,
    hop2: w('u0919', 'seven') - 0.55,
    banks: w('u0919', 'perfect') - 0.3,
    end: S8.start - 0.8,
  };

  // 09.8 Multi-HGTM: two towers, one clause head; the four cases; seeds; real data; a missing view
  const multi = {
    towers: S8.start - 0.8,
    plate: us('u0920'),
    fire: w('u0920', 'second') - 0.2,
    head: w('u0920', 'fired') - 0.15,
    rule: w('u0921', 'rule') - 0.25,
    plane: w('u0921', 'sum') - 0.1,
    planeFail: w('u0921', 'express') - 0.1,
    late: w('u0922', 'zero') - 0.25,
    clause: w('u0923', 'nine') - 0.25,
    done: w('u0923', 'every'),
    built: w('u0924', 'built') - 0.2,
    bcw: w('u0924', 'breast-cancer') - 0.2,
    ns: w('u0924', 'significant') - 0.2,
    missing: w('u0925', 'drop') - 0.25,
    thirds: w('u0925', 'thirds') - 0.2,
    end: S9.start - 1.6,
  };

  // 09.9 graphtm-cbr: mol_31 assembles; MUTAGENIC?
  const cbr = {
    dolly: S9.start - 1.6,
    dollyDur: 1.8,
    mol: S9.start + 0.1,
    plate: us('u0926'),
    question: w('u0927', 'mutagenic') - 0.15,
    rules: w('u0927', 'rules') - 0.1,
    edit: w('u0927', 'edit') - 0.1,
    press: S10.start - 0.6,
  };

  // 09.10 the method, in five steps
  const steps = {
    s1: us('u0928') - 0.2,
    split: w('u0928', 'split') - 0.1,
    s2: us('u0929') - 0.25,
    hop1: w('u0929', 'neighbours') - 0.2,
    hop2: w('u0929', 'two') - 0.15,
    code: w('u0929', 'built') - 0.2,
    codeExit: us('u0930') + 0.2,
    s3: us('u0930') - 0.2,
    path: w('u0930', 'atom') - 0.3,
    any: w('u0930', 'molecule') - 0.2,
    s4: us('u0931') - 0.2,
    towers: w('u0931', 'machines') - 0.2,
    s5: us('u0932') - 0.2,
    edits: w('u0932', 'propose') - 0.2,
    gates: w('u0932', 'chemistry') - 0.2,
    keep: w('u0932', 'drops') - 0.2,
    collapse: S11.start - 0.7,
  };

  // 09.11 mol_31's flip, mol_22's 'C.', and RDKit's count
  const flip = {
    close: S11.start - 0.5,
    margin: w('u0933', 'margin') - 0.2,
    remove: w('u0934', 'Remove') - 0.1,
    below: w('u0934', 'below') - 0.2,
    safe: w('u0934', 'safe') - 0.15,
    alert: we('u0934', 'safe') + 0.4,
    dryFrom: w('u0935', 'C') - 3.0,
    mol22: w('u0935', 'flattering') - 0.15,
    cdot: w('u0935', 'C'),
    split: w('u0936', 'split') - 0.2,
    rdkit: us('u0937') - 0.3,
    frags: w('u0937', 'two') - 0.1,
    closing: us('u0938') - 0.2,
    end: S12.start - 0.7,
  };

  // 09.12 the numbers card and the closing line
  const close = {
    grid: S12.start - 0.6,
    counter: us('u0939') + 0.1,
    counterEnd: we('u0939', 'tries') - 0.2,
    ghost: w('u0940', 'Without') - 0.1,
    auroc: w('u0941', 'predictor') - 0.2,
    rf: w('u0941', 'forest') - 0.2,
    kazius: w('u0942', 'covers') - 0.2,
    clause3: w('u0942', 'one') - 0.2,
    warn: w('u0942', 'warns') - 0.2,
    line: us('u0943') - 0.3,
    structure: w('u0943', 'structure'),
    out: ch.end - 2.4,
  };

  return {ch, S0, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, gate, zoo, sub, attn, dec, rob, hgtm, rgtm, multi, cbr, steps, flip, close};
};

export type Times09 = ReturnType<typeof times09>;
