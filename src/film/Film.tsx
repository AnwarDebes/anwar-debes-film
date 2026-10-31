import React, {useMemo} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {FILM_WALL, makeBoard, usePixels, type Board, type Pixels} from '../engine/pins';
import {Captions} from '../engine/type';
import {FilmAudio} from '../engine/audio/FilmAudio';
import {resolveTimeline} from '../pixie/timeline';
import {color} from '../engine/tokens';
import {timeline} from './timeline';
import {World, activeNodes} from './World';
import {GuideTimeline} from './guide';
import {OPENING} from './handoff';
import {CHAPTERS} from './chapters';
import type {ChapterSpec, FilmCtx} from './types';
import media from '../data/media.json';

const byAt = <T extends {at: number}>(a: T, b: T) => a.at - b.at;

/** Merge every chapter's contribution into one film-wide spec, checking ids are unique. */
export const mergeSpecs = (specs: ChapterSpec[]): ChapterSpec => {
  const seen = new Set<string>();
  const unique = <T extends {id: string}>(xs: T[], what: string) => {
    for (const x of xs) {
      if (seen.has(`${what}:${x.id}`)) throw new Error(`film: duplicate ${what} id "${x.id}"`);
      seen.add(`${what}:${x.id}`);
    }
    return xs;
  };
  const all = <K extends keyof ChapterSpec>(k: K) => specs.flatMap((s) => (s[k] ?? []) as NonNullable<ChapterSpec[K]>[number][]);
  return {
    beats: unique([OPENING, ...all('beats')], 'beat').sort(byAt),
    camera: all('camera').sort(byAt),
    focus: all('focus').sort(byAt),
    light: all('light').sort(byAt),
    ripples: all('ripples'),
    magnets: all('magnets'),
    presses: all('presses'),
    live: all('live'),
    world: unique(all('world'), 'world node'),
    overlays: unique(all('overlays'), 'overlay'),
    captionSkip: all('captionSkip'),
    pixie: all('pixie').sort((a, b) => a.frame - b.frame),
    sfx: all('sfx'),
    music: all('music'),
  };
};

const FilmBody: React.FC<{board: Board; face: Pixels}> = ({board, face}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const ctx: FilmCtx = useMemo(() => ({board, tl: timeline, assets: {face}, width, height, fps}), [board, face, width, height, fps]);
  const spec = useMemo(() => mergeSpecs(CHAPTERS.map((c) => c.build(ctx))), [ctx]);
  const guide = useMemo(() => resolveTimeline(spec.pixie ?? [], fps), [spec, fps]);
  const overlays = activeNodes(spec.overlays, t);
  return (
    <GuideTimeline.Provider value={guide}>
      <AbsoluteFill style={{backgroundColor: color.wall.void}}>
        <World spec={spec} ctx={ctx} />
        {overlays.map((n) => (
          <AbsoluteFill key={n.id} style={{visibility: t < n.from ? 'hidden' : 'visible'}}>
            {n.render(t)}
          </AbsoluteFill>
        ))}
        <Captions utterances={timeline.utterances} skip={spec.captionSkip} t={t} />
        {media.mix ? <FilmAudio dir={media.mix} /> : null}
      </AbsoluteFill>
    </GuideTimeline.Provider>
  );
};

/** The whole film. Every layer reads absolute film time from the current frame. */
export const Film: React.FC = () => {
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const face = usePixels('images/face.png');
  if (!face) return <AbsoluteFill style={{backgroundColor: color.wall.void}} />;
  return <FilmBody board={board} face={face} />;
};

/** A window into the film: the same frames, starting at `startFrame` (chapter previews and part renders). */
export const FilmWindow: React.FC<{startFrame: number}> = ({startFrame}) => (
  <Sequence from={-startFrame} layout="none">
    <Film />
  </Sequence>
);
