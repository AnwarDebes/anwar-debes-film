import type React from 'react';

export type DemoSpec = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>;
  durationInFrames: number;
  width?: number;
  height?: number;
  fps?: number;
  defaultProps?: Record<string, unknown>;
};
