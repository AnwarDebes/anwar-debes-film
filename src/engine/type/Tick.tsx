import React from 'react';
import {color} from '../tokens';

export interface TickProps {
  /** diameter in px */
  size: number;
  /** 0..1: how much of the check stroke is drawn */
  draw?: number;
  disc?: string;
  mark?: string;
  /** an outline ring instead of a filled disc (pending state) */
  ring?: boolean;
  style?: React.CSSProperties;
}

/** The verified tick: a mint disc with a dark check, drawn as vector so it is sharp at any size. */
export const Tick: React.FC<TickProps> = ({size, draw = 1, disc = color.accent.mint, mark = '#06100D', ring = false, style}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block', overflow: 'visible', ...style}}>
    {ring ? (
      <circle cx={12} cy={12} r={11} fill="none" stroke={disc} strokeWidth={1.6} />
    ) : (
      <circle cx={12} cy={12} r={12} fill={disc} />
    )}
    {draw > 0 ? (
      <path
        d="M6.6 12.5 L10.3 16 L17.5 8.5"
        fill="none"
        stroke={ring ? disc : mark}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.min(1, draw)}
      />
    ) : null}
  </svg>
);
