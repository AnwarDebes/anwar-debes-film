import React from 'react';
import {ChapterCard} from '../../engine/type';
import {frameOn, pushIn} from '../../engine/camera';
import {HANDOFF} from '../handoff';
import type {ChapterModule} from '../types';

// A chapter that is not built yet: the bare wall with a slow push-in and the chapter card,
// while the narration runs as captions. Keeps the whole film playable at every stage.
export const placeholderChapter = (id: string): ChapterModule => ({
  id,
  build: (ctx) => {
    const ch = ctx.tl.chapter(id);
    const pose = frameOn(ctx.board, {uv: [0.5, 0.5], pinsAcross: 150, yaw: 0.12, pitch: 0.06, aspect: ctx.width / ctx.height});
    return {
      beats: [{id: `c${id}-bare`, at: ch.start, field: HANDOFF}],
      camera: [
        {at: ch.start, pose},
        {at: ch.start + 0.01, dur: Math.max(1, ch.end - ch.start), pose: pushIn(pose, 0.06), ease: 'inOutSine'},
      ],
      overlays: [
        {
          id: `c${id}-card`,
          from: ch.start,
          to: Math.min(ch.end, ch.start + 6),
          render: (t) => <ChapterCard index={id} kicker="Chapter" title={ch.title} at={ch.start + 0.3} exitAt={ch.start + 5.2} t={t} />,
        },
      ],
    };
  },
});
