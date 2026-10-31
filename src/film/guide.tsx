import React, {createContext, useContext} from 'react';
import {useCurrentFrame} from 'remotion';
import {PixieGuide, type PixieGuideProps} from '../pixie/PixieGuide';
import type {PixieTimeline} from '../pixie/timeline';

// Pixie's state machine runs once over the whole film (one-shots, dwell and blinks carry across
// scenes and chapters), so every on-screen guide reads the same resolved timeline.
export const GuideTimeline = createContext<PixieTimeline | null>(null);

/** Pixie as the guide, anywhere in an overlay. Uses the film-wide timeline and absolute frame. */
export const FilmGuide: React.FC<Omit<PixieGuideProps, 'timeline' | 'cues' | 'frame'>> = (props) => {
  const timeline = useContext(GuideTimeline);
  const frame = useCurrentFrame();
  return <PixieGuide {...props} timeline={timeline} frame={frame} />;
};
