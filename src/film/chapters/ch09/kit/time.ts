import type {FilmTimeline} from '../../../timeline';

/** Timeline lookups used by every scene: word starts and ends, utterance and scene spans. */
export const timeKit = (tl: FilmTimeline) => {
  const w = (u: string, which: number | string) => tl.word(u, which).start;
  const we = (u: string, which: number | string) => tl.word(u, which).end;
  const us = (u: string) => tl.utt(u).start;
  const ue = (u: string) => tl.utt(u).end;
  const S = (id: string) => tl.scene(id);
  const F = (s: number) => tl.f(s);
  return {w, we, us, ue, S, F, tl};
};

export type TimeKit = ReturnType<typeof timeKit>;
