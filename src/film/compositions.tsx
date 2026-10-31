import React from 'react';
import {Composition, Folder} from 'remotion';
import {Film, FilmWindow} from './Film';
import {timeline} from './timeline';

const W = 2560;
const H = 1440;

// "Film" is the whole thing; "ChNN" are windows into the same frames for review and part renders.
export const FilmCompositions: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={Math.max(1, timeline.durationInFrames)} fps={timeline.fps} width={W} height={H} />
    <Folder name="Chapters">
      {timeline.chapters.map((c) => {
        const startFrame = Math.round(c.start * timeline.fps);
        const endFrame = Math.round(c.end * timeline.fps);
        return (
          <Composition
            key={c.id}
            id={`Ch${c.id}`}
            component={FilmWindow}
            durationInFrames={Math.max(1, endFrame - startFrame)}
            fps={timeline.fps}
            width={W}
            height={H}
            defaultProps={{startFrame}}
          />
        );
      })}
    </Folder>
  </>
);
