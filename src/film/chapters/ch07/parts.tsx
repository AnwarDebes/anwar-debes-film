import React from 'react';
import {useVideoConfig} from 'remotion';
import {color, layout, type as T} from '../../../engine/tokens';
import {KineticLine} from '../../../engine/type';
import {DISCLAIMER, mono, pullK, pullStyle} from './kit/ui';

// A chapter card whose kicker keeps the repositories' exact GitHub spelling (the engine's kicker
// sets everything in caps, and name plates are never upper-cased).

export const RepoCard: React.FC<{
  t: number;
  at: number;
  exitAt: number;
  index: string;
  repos: string;
  title: string;
  note?: string;
}> = ({t, at, exitAt, index, repos, title, note}) => {
  const {width: W, height: H} = useVideoConfig();
  const x = Math.round(W * layout.marginLeftW);
  const kb = Math.round(H * layout.kickerBaselineH);
  const ks = T.monoKicker.size;
  const k = pullK(t, at, exitAt + 0.04);
  const kn = note ? pullK(t, at + 0.75, exitAt) : 0;
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {k > 0 ? (
        <div style={{position: 'absolute', left: x, top: kb - Math.round(ks * H * 0.95), ...pullStyle(k, H), ...mono(H, ks, 500), letterSpacing: '0.16em'}}>
          <span style={{color: color.accent.mint}}>{index}</span>
          <span style={{color: color.accent.mintLabel}}>{`  ·  ${repos}`}</span>
        </div>
      ) : null}
      <KineticLine text={title} at={at + 0.18} perWordS={0.1} t={t} kind="displayM" variant="focus" x={x} y={kb + Math.round(0.044 * H)} yAnchor="capTop" maxWidth={W * 0.6} color={color.text.display} exitAt={exitAt} />
      {note && kn > 0 ? (
        <div style={{position: 'absolute', left: x, top: kb + Math.round(0.21 * H), ...pullStyle(kn, H), ...mono(H, ks, 450), color: color.text.tertiary}}>{note}</div>
      ) : null}
    </div>
  );
};

export const ChapterCard07: React.FC<{t: number; at: number; exitAt: number}> = ({t, at, exitAt}) => (
  <RepoCard t={t} at={at} exitAt={exitAt} index="07" repos="Claude-Code-In-Motion · vsclaude" title="*Every step.*" note={DISCLAIMER} />
);
