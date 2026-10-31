import React from 'react';
import {Composition, Folder} from 'remotion';
import type {DemoSpec} from './types';
import {demo as pinWall} from './demos/PinWallDemo';
import {demo as pixie} from './demos/PixieDemo';
import {demo as type} from './demos/TypeDemo';
import {demo as code} from './demos/CodeDemo';
import {demo as diagram} from './demos/DiagramDemo';
import {demo as device} from './demos/DeviceDemo';
import {demo as particles} from './demos/ParticlesDemo';
import {demo as audio} from './demos/AudioDemo';

const demos: DemoSpec[] = [pinWall, pixie, type, code, diagram, device, particles, audio];

export const EngineDemos: React.FC = () => (
  <Folder name="Engine">
    {demos.map((d) => (
      <Composition
        key={d.id}
        id={d.id}
        component={d.component}
        durationInFrames={d.durationInFrames}
        fps={d.fps ?? 60}
        width={d.width ?? 2560}
        height={d.height ?? 1440}
        defaultProps={d.defaultProps ?? {}}
      />
    ))}
  </Folder>
);
