import React from 'react';
import {Composition, Folder} from 'remotion';
import {PinBench} from './bench/PinBench';
import {FlatBench} from './bench/FlatBench';
import {EngineDemos} from './dev/registry';
import {FilmCompositions} from './film/compositions';
import './engine/fonts';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <FilmCompositions />
      <EngineDemos />
      <Folder name="Bench">
        <Composition
          id="PinBench"
          component={PinBench}
          durationInFrames={240}
          fps={60}
          width={2560}
          height={1440}
          defaultProps={{cols: 160, rows: 90, post: true}}
        />
        <Composition
          id="FlatBench"
          component={FlatBench}
          durationInFrames={240}
          fps={60}
          width={2560}
          height={1440}
          defaultProps={{gl: false}}
        />
        <Composition
          id="PinBench4K"
          component={PinBench}
          durationInFrames={240}
          fps={60}
          width={3840}
          height={2160}
          defaultProps={{cols: 160, rows: 90, post: true}}
        />
      </Folder>
    </>
  );
};
