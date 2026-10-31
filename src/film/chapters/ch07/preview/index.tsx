import React, {useMemo} from 'react';
import {AbsoluteFill, Composition, Folder, registerRoot, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {FILM_WALL, makeBoard, usePixels, type Board, type Pixels} from '../../../../engine/pins';
import {Captions} from '../../../../engine/type';
import {resolveTimeline} from '../../../../pixie/timeline';
import {color} from '../../../../engine/tokens';
import {timeline} from '../../../timeline';
import {World, activeNodes} from '../../../World';
import {GuideTimeline} from '../../../guide';
import {OPENING} from '../../../handoff';
import type {ChapterModule, ChapterSpec, FilmCtx} from '../../../types';
import {chapter as ch07} from '../../ch07';
import {chapter as ch11} from '../../ch11';
import '../../../../engine/fonts';

// A review entry for chapters 07 and 11 alone: the same World, overlays, captions and guide as
// the film (src/film/Film.tsx), built from these two chapter modules only, so their stills can be
// checked while other chapters are mid-build. Not part of the film's Root.

const MINE: ChapterModule[] = [ch07, ch11];

const merge = (specs: ChapterSpec[]): ChapterSpec => {
  const all = <K extends keyof ChapterSpec>(k: K) => specs.flatMap((s) => (s[k] ?? []) as NonNullable<ChapterSpec[K]>[number][]);
  const byAt = <T extends {at: number}>(a: T, b: T) => a.at - b.at;
  const seen = new Set<string>();
  for (const b of all('beats')) {
    if (seen.has(b.id)) throw new Error(`duplicate beat id ${b.id}`);
    seen.add(b.id);
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

const Body: React.FC<{board: Board; face: Pixels}> = ({board, face}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const ctx: FilmCtx = useMemo(() => ({board, tl: timeline, assets: {face}, width, height, fps}), [board, face, width, height, fps]);
  const spec = useMemo(() => merge(MINE.map((c) => c.build(ctx))), [ctx]);
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

const Preview: React.FC<{startFrame: number}> = ({startFrame}) => {
  const board = useMemo(() => makeBoard(FILM_WALL), []);
  const face = usePixels('images/face.png');
  return (
    <Sequence from={-startFrame} layout="none">
      {face ? <Body board={board} face={face} /> : <AbsoluteFill style={{backgroundColor: color.wall.void}} />}
    </Sequence>
  );
};

const Root: React.FC = () => (
  <Folder name="TeamD">
    {['07', '11'].map((id) => {
      const c = timeline.chapter(id);
      const startFrame = Math.round(c.start * timeline.fps);
      return (
        <Composition
          key={id}
          id={`Review${id}`}
          component={Preview}
          durationInFrames={Math.max(1, Math.round(c.end * timeline.fps) - startFrame)}
          fps={timeline.fps}
          width={2560}
          height={1440}
          defaultProps={{startFrame}}
        />
      );
    })}
  </Folder>
);

registerRoot(Root);
