import React from 'react';
import {getInputProps} from 'remotion';

// The film's ledger reads its sources from the film itself. Rendered with inputProps
// {sourceLog: true} (scripts/ledger/collect-sources.mjs), every source on screen prints one
// console line per rendered frame: the film time in seconds and what it cites. Off in every
// normal render.
let on: boolean | undefined;
const enabled = (): boolean => {
  if (on === undefined) {
    try {
      on = Boolean((getInputProps() as {sourceLog?: unknown}).sourceLog);
    } catch {
      on = false;
    }
  }
  return on;
};

export type NotedSource =
  | {kind: 'chip'; repo: string; path: string; line?: number | string}
  | {kind: 'row'; source: string}
  | {kind: 'capture'; src: string};

export const noteSource = (t: number, s: NotedSource): void => {
  if (!enabled()) return;
  console.log('FILMSOURCE ' + t.toFixed(3) + ' ' + JSON.stringify(s));
};

/** Marks a recording as on screen at film time t (for videos played outside DeviceScreen). */
export const NoteCapture: React.FC<{t: number; src: string}> = ({t, src}) => {
  noteSource(t, {kind: 'capture', src});
  return null;
};
