// Builders for the cue sheet the film timeline emits (see types.ts). Pure data: no React, no
// Remotion, so a Node script can import this and write the JSON that scripts/audio/mix.py renders.
//
//   const sheet = cueSheet({name: 'film', fps: 60, durationS, voice, music: {cues: [...]}, sfx: {cues: [
//     ...chapterTurn(cardFrame),
//     cue.note(beatFrame, 5),            // scale degree 5 of whatever key the music is in
//     cue.blip(chipFrame, 6),
//     cue.whoosh(cutFrame),              // its peak lands on the cut
//   ]}});

import type {Align, CueSheet, MusicCue, SfxCue, SfxType} from './types';

type Common = Omit<SfxCue, 'type' | 'frame' | 'at' | 'params' | 'align'> & {align?: Align};

/** Any recipe at a frame. Unknown params are reported (not silently used) by the renderer. */
export const sfx = (type: SfxType, frame: number, opts: Common & {params?: Record<string, unknown>} = {}): SfxCue => {
  const {params, ...rest} = opts;
  return {type, frame: Math.round(frame), ...rest, ...(params ? {params} : {})};
};

/** A pitch: a scale degree (1 2 3 5 6 7 is the palette; 8 = tonic an octave up) or a note name. */
export type Pitch = number | string;
const pitchParams = (p: Pitch, octave?: number): Record<string, unknown> =>
  typeof p === 'number' ? {degree: p, ...(octave !== undefined ? {octave} : {})} : {note: p};

export const cue = {
  /** one soft steel pin */
  pinTick: (frame: number, o: Common & {f1?: number; tau?: number} = {}) => {
    const {f1, tau, ...rest} = o;
    return sfx('pin_tick', frame, {...rest, params: {...(f1 ? {f1} : {}), ...(tau ? {tau} : {})}});
  },
  /** a sweep of pins; prefer pinBrushCue (pins.ts), which reads the wall itself */
  pinBrush: (frame: number, o: Common & {durS?: number; shape?: 'rise' | 'fall' | 'bell' | 'flat'; density?: number} = {}) => {
    const {durS, shape, density, ...rest} = o;
    return sfx('pin_brush', frame, {...rest, params: {dur: durS ?? 1.2, ...(shape ? {shape} : {}), ...(density ? {density} : {})}});
  },
  /** tonal event note on a visual beat (~1.1 s to -10 dB); degrees follow the music's key */
  note: (frame: number, p: Pitch, o: Common & {octave?: number; decay?: number; velocity?: number; bright?: number} = {}) => {
    const {octave, decay, velocity, bright, ...rest} = o;
    return sfx('note', frame, {
      ...rest,
      params: {...pitchParams(p, octave), ...(decay ? {decay} : {}), ...(velocity ? {velocity} : {}), ...(bright !== undefined ? {bright} : {})},
    });
  },
  /** success: degrees 5 -> 8 by default */
  chime: (frame: number, o: Common & {degrees?: number[]; notes?: string[]} = {}) => {
    const {degrees, notes, ...rest} = o;
    return sfx('chime', frame, {...rest, params: {...(degrees ? {degrees} : {}), ...(notes ? {notes} : {})}});
  },
  /** polite denied */
  error: (frame: number, o: Common = {}) => sfx('error_buzz', frame, o),
  /** a chip or label appearing */
  blip: (frame: number, p: Pitch = 5, o: Common & {octave?: number} = {}) => {
    const {octave, ...rest} = o;
    return sfx('blip', frame, {...rest, params: pitchParams(p, octave)});
  },
  /** a verdict stamp landing */
  stamp: (frame: number, o: Common = {}) => sfx('stamp', frame, o),
  /** counter / clock tick */
  tick: (frame: number, o: Common = {}) => sfx('tick', frame, o),
  /** keystrokes; keysS are seconds relative to `frame` (from the code engine's typing schedule) */
  typing: (frame: number, keysS: number[], o: Common = {}) => sfx('typing', frame, {...o, params: {keys: keysS}}),
  /** air move whose peak lands on `frame` */
  whoosh: (frame: number, o: Common & {durS?: number} = {}) => {
    const {durS, ...rest} = o;
    return sfx('whoosh', frame, {align: 'peak', ...rest, params: durS ? {dur: durS} : {}});
  },
  swish: (frame: number, o: Common & {durS?: number} = {}) => {
    const {durS, ...rest} = o;
    return sfx('swish', frame, {align: 'peak', ...rest, params: durS ? {dur: durS} : {}});
  },
  /** riser that ends exactly on `frame` (the cut) */
  riser: (frame: number, durS = 1.6, o: Common = {}) => sfx('riser', frame, {align: 'end', ...o, params: {dur: durS}}),
  /** reversed bloom that ends exactly on `frame`; toneDegree adds a reversed note in key */
  swell: (frame: number, durS = 1.4, o: Common & {toneDegree?: number} = {}) => {
    const {toneDegree, ...rest} = o;
    return sfx('reverse_swell', frame, {align: 'end', ...rest, params: {dur: durS, ...(toneDegree ? {tone_degree: toneDegree} : {})}});
  },
  subHit: (frame: number, o: Common = {}) => sfx('sub_hit', frame, o),
  impact: (frame: number, o: Common = {}) => sfx('impact', frame, o),
};

/**
 * The chapter-turn grammar (audio.md 3.3): a riser (or reverse swell) that ends on frame 0 of the
 * chapter card, and an impact on that frame. One transition sound per cut.
 */
export const chapterTurn = (
  cardFrame: number,
  o: {lead?: 'riser' | 'swell'; durS?: number; impact?: boolean; toneDegree?: number; id?: string} = {},
): SfxCue[] => {
  const id = o.id ?? `chapter@${cardFrame}`;
  const lead =
    (o.lead ?? 'riser') === 'riser'
      ? cue.riser(cardFrame, o.durS ?? 1.6, {id: `${id}:riser`})
      : cue.swell(cardFrame, o.durS ?? 1.4, {id: `${id}:swell`, toneDegree: o.toneDegree ?? 1});
  return o.impact === false ? [lead] : [lead, cue.impact(cardFrame, {id: `${id}:impact`})];
};

/** A music cue from film time `inS` to `outS`, starting `offset` seconds into the track. */
export const music = (track: string, inS: number, outS: number, o: Partial<MusicCue> = {}): MusicCue => ({
  track,
  in: inS,
  out: outS,
  offset: 0,
  ...o,
});

/** Problems the renderer would reject or warn about, found before it runs. */
export const validateCueSheet = (s: CueSheet): string[] => {
  const out: string[] = [];
  const dur = s.durationS ?? (s.durationInFrames !== undefined ? s.durationInFrames / s.fps : undefined);
  if (!dur || dur <= 0) out.push('durationS (or durationInFrames) must be positive');
  const ids = new Set<string>();
  for (const c of s.sfx?.cues ?? []) {
    if (c.frame === undefined && c.at === undefined) out.push(`sfx ${c.id ?? c.type}: needs frame or at`);
    if (c.id) {
      if (ids.has(c.id)) out.push(`duplicate cue id ${c.id}`);
      ids.add(c.id);
    }
  }
  const ms = [...(s.music?.cues ?? [])].sort((a, b) => (a.in ?? 0) - (b.in ?? 0));
  ms.forEach((c, i) => {
    if (c.continues && !ms.slice(0, i).some((p) => p.id === c.continues))
      out.push(`music ${c.id ?? c.track}: continues '${c.continues}', which is not an earlier cue`);
  });
  for (let i = 1; i < ms.length; i++) {
    const prev = ms[i - 1];
    const cur = ms[i];
    const overlap = (prev.out ?? Infinity) - (cur.in ?? 0);
    if (overlap > 0.01 && !cur.crossfade && !(prev.fadeOut && cur.fadeIn))
      out.push(`music ${prev.id ?? prev.track} and ${cur.id ?? cur.track} overlap ${overlap.toFixed(2)} s without fades`);
  }
  return out;
};

/** Finish a cue sheet: version, ids, time order. Throws on problems. */
export const cueSheet = (s: Omit<CueSheet, 'version'>): CueSheet => {
  const sheet: CueSheet = {version: 1, ...s};
  if (sheet.sfx) {
    const counts = new Map<string, number>();
    sheet.sfx.cues = [...sheet.sfx.cues]
      .map((c) => {
        if (c.id) return c;
        const base = `${c.type}@${c.frame ?? Math.round((c.at ?? 0) * sheet.fps)}`;
        const n = (counts.get(base) ?? 0) + 1;
        counts.set(base, n);
        return {...c, id: n === 1 ? base : `${base}#${n}`};
      })
      .sort((a, b) => (a.frame ?? (a.at ?? 0) * sheet.fps) - (b.frame ?? (b.at ?? 0) * sheet.fps));
  }
  const problems = validateCueSheet(sheet);
  if (problems.length) throw new Error(`cue sheet ${s.name}:\n  ${problems.join('\n  ')}`);
  return sheet;
};

export const framesToS = (frame: number, fps: number): number => frame / fps;
export const sToFrames = (s: number, fps: number): number => Math.round(s * fps);
