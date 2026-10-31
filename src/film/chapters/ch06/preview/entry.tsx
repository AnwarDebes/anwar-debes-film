// Review entry for chapters 06 and 08 alone: the film's own World, overlays, guide and captions,
// built from just these chapters, so they can be checked while other chapters are mid-edit.
//   npx remotion still src/film/chapters/ch06/preview/entry.tsx Prev06 out.jpg --frame=N
// Frames are relative to the chapter start, as in the ChNN compositions.
import React, {useMemo} from 'react';
import {AbsoluteFill, Composition, Sequence, registerRoot, useCurrentFrame, useVideoConfig} from 'remotion';
import '../../../../engine/fonts';
import {FILM_WALL, makeBoard, usePixels, type Board, type Pixels} from '../../../../engine/pins';
import {Captions} from '../../../../engine/type';
import {resolveTimeline} from '../../../../pixie/timeline';
import {color} from '../../../../engine/tokens';
import {timeline} from '../../../timeline';
import {World, activeNodes} from '../../../World';
import {GuideTimeline} from '../../../guide';
import {OPENING} from '../../../handoff';
import type {ChapterModule, ChapterSpec, FilmCtx} from '../../../types';
import {chapter as ch06} from '../../ch06';
import {chapter as ch08} from '../../ch08';

const byAt = <T extends {at: number}>(a: T, b: T) => a.at - b.at;

const merge = (specs: ChapterSpec[]): ChapterSpec => {
  const all = <K extends keyof ChapterSpec>(k: K) => specs.flatMap((s) => (s[k] ?? []) as NonNullable<ChapterSpec[K]>[number][]);
  const seen = new Set<string>();
  for (const s of specs) for (const x of [...s.beats, ...(s.overlays ?? []), ...(s.world ?? [])]) {
    if (seen.has(x.id)) throw new Error(`preview: duplicate id ${x.id}`);
    seen.add(x.id);
  }
  return {
    beats: [OPENING, ...all('beats')].sort(byAt),
    camera: all('camera').sort(byAt),
    focus: all('focus').sort(byAt),
    light: all('light').sort(byAt),
    ripples: all('ripples'),
    magnets: all('magnets'),
    presses: all('presses'),
    live: all('live'),
    world: all('world'),
    overlays: all('overlays'),
    captionSkip: all('captionSkip'),
    pixie: all('pixie').sort((a, b) => a.frame - b.frame),
  };
};

const Body: React.FC<{board: Board; face: Pixels; chapters: ChapterModule[]}> = ({board, face, chapters}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const ctx: FilmCtx = useMemo(() => ({board, tl: timeline, assets: {face}, width, height, fps}), [board, face, width, height, fps]);
  const spec = useMemo(() => merge(chapters.map((c) => c.build(ctx))), [ctx, chapters]);
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
      </AbsoluteFill>
    </GuideTimeline.Provider>
  );
};

const PreviewFilm: React.FC<{chapters: ChapterModule[]}> = ({chapters}) => {
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const face = usePixels('images/face.png');
  if (!face) return <AbsoluteFill style={{backgroundColor: color.wall.void}} />;
  return <Body board={board} face={face} chapters={chapters} />;
};

const Window: React.FC<{id: string}> = ({id}) => {
  const c = timeline.chapter(id);
  const chapters = id === '06' ? [ch06] : [ch08];
  return (
    <Sequence from={-Math.round(c.start * timeline.fps)} layout="none">
      <PreviewFilm chapters={chapters} />
    </Sequence>
  );
};

const Root: React.FC = () => (
  <>
    {(['06', '08'] as const).map((id) => {
      const c = timeline.chapter(id);
      return (
        <Composition
          key={id}
          id={`Prev${id}`}
          component={Window}
          durationInFrames={Math.max(1, Math.round((c.end - c.start) * timeline.fps))}
          fps={timeline.fps}
          width={2560}
          height={1440}
          defaultProps={{id}}
        />
      );
    })}
  </>
);

registerRoot(Root);
