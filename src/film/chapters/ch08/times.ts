import type {FilmTimeline} from '../../timeline';
import {clock} from '../ch06/kit/time';

// Chapter 08's beat times, all read from the timeline (scenes, utterances, words). Shared by the
// picture (ch08.tsx) and the sound (ch08.cues.ts).

export const times08 = (tl: FilmTimeline) => {
  const c = clock(tl);
  const ch = tl.chapter('08');
  const sc = (id: string) => c.scene(id);
  const s0 = sc('08.0');
  const u = c.u;
  const w = c.w;
  return {
    ch: {start: ch.start, end: ch.end},
    gate: {frame0: s0.start, end: s0.end, cardIn: s0.start + 0.2, cardOut: s0.end - 0.3, unfold: s0.start + 1.0, settle: s0.start + 2.1},
    s1: {
      ...sc('08.1'),
      plate: u('u0801').start,
      game: w('u0801', 'game'),
      instructions: w('u0801', 'instructions'),
      goal: w('u0802', 'goal'),
      rules: w('u0802', 'rules'),
      score: w('u0802', 'score'),
      count: w('u0802', 'count'),
      readme: u('u0803').start,
      frontier: w('u0803', 'frontier'),
      people: w('u0803', 'people'),
      lastWord: u('u0803').end,
    },
    s2: {
      ...sc('08.2'),
      cpu: u('u0804').start,
      splits: w('u0805', 'splits'),
      objects: w('u0805', 'objects'),
      masks: w('u0805', 'masks'),
      same: w('u0805', 'same'),
      pressing: u('u0806').start,
      learns: w('u0806', 'learns'),
      avatar: w('u0806', 'avatar'),
      ends: u('u0807').start,
      locked: w('u0807', 'locked'),
      plans: u('u0808').start,
      bfs: w('u0808', 'breadth-first'),
      reason: w('u0808', 'reason'),
      lastWord: u('u0808').end,
    },
    s3: {
      ...sc('08.3'),
      click: u('u0809').start,
      same: w('u0809', 'same'),
      clears: w('u0809', 'clears'),
      nine: u('u0810').start,
      person: w('u0810', 'person'),
      lastWord: u('u0810').end,
    },
    s4: {
      ...sc('08.4'),
      games: u('u0811').start,
      two: w('u0811', 'two'),
      none: w('u0811', 'none'),
      score: u('u0812').start,
      zero83: w('u0812', 'three'),
      random: u('u0813').start,
      zero95: w('u0813', 'five'),
      plainly: u('u0814').start,
      frontier: w('u0814', 'frontier'),
      beatRandom: w('u0814', 'random'),
      readme: u('u0815').start,
      otherwise: w('u0815', 'otherwise'),
      seven: u('u0816').start,
      different: w('u0816', 'different'),
      lastWord: u('u0816').end,
    },
    s5: {
      ...sc('08.5'),
      runs: w('u0817', 'runs'),
      test: w('u0817', 'test'),
      never: w('u0817', 'never'),
      script: u('u0818').start,
      recounts: w('u0818', 'recounts'),
      strictly: w('u0818', 'strictly'),
      lastWord: u('u0818').end,
    },
    s6: {
      ...sc('08.6'),
      plate: u('u0819').start,
      empty: w('u0819', 'empty'),
      line: w('u0819', 'line'),
      lastWord: u('u0819').end,
    },
    s7: {
      ...sc('08.7'),
      plate: u('u0820').start,
      nexus: w('u0820', 'NEXUS'),
      players: w('u0820', 'players'),
      core: u('u0821').start,
      referee: w('u0821', 'referee'),
      scoring: w('u0821', 'scoring'),
      tests: w('u0821', 'tests'),
      second: u('u0822').start,
      point: w('u0822', 'point'),
      diagnostic: u('u0823').start,
      single: w('u0823', 'single'),
      game6: w('u0823', 'game'),
      noLog: u('u0824').start,
      prototypes: w('u0824', 'prototypes'),
      payoff: u('u0825').start,
      letter: w('u0825', 'letter'),
      other: w('u0825', 'other'),
      rulesWord: w('u0825', 'rules'),
      lastWord: u('u0825').end,
    },
  };
};

export type Times08 = ReturnType<typeof times08>;
