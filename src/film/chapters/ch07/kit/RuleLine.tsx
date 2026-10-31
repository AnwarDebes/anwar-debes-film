import React from 'react';
import {useVideoConfig} from 'remotion';
import {color} from '../../../../engine/tokens';
import {easeInCubic, easeOutCubic, prog} from '../../../../engine/type/ease';
import order from '../../../../data/ch07/repo-order.json';

// The rule line: 66 small steel pins along the bottom edge of the frame (97% H, 15-95% W), one per
// repository in the order its name plate first appears. A pin lights mint when its repository is
// reached; the numerals are never shown here. Hidden while a dense code panel is up.

export const REPO_ORDER: readonly string[] = order.repos;

export const repoIndex = (repo: string): number => {
  const i = REPO_ORDER.indexOf(repo);
  if (i < 0) throw new Error(`rule line: unknown repository ${repo}`);
  return i;
};

export interface RuleLight {
  repo: string;
  at: number;
}

export interface RuleLineProps {
  t: number;
  /** repositories lit before this chapter: every pin with an index below this is already lit */
  litBefore: number;
  lights: readonly RuleLight[];
  /** windows [from, to] in which the line is hidden (dense code panels) */
  hide?: ReadonlyArray<readonly [number, number]>;
}

const visibility = (t: number, hide: ReadonlyArray<readonly [number, number]>) => {
  let k = 1;
  for (const [a, b] of hide) {
    const inK = prog(t, a - 0.35, 0.35);
    const outK = prog(t, b, 0.45);
    k = Math.min(k, 1 - inK + outK);
  }
  return Math.max(0, Math.min(1, k));
};

export const RuleLine: React.FC<RuleLineProps> = ({t, litBefore, lights, hide = []}) => {
  const {width: W, height: H} = useVideoConfig();
  const vis = visibility(t, hide);
  if (vis <= 0.001) return null;
  const n = REPO_ORDER.length;
  const x0 = 0.15 * W;
  const x1 = 0.95 * W;
  const y = Math.round(0.97 * H);
  const d = Math.max(6, Math.round(0.0085 * H));
  const lightAt = new Map(lights.map((l) => [repoIndex(l.repo), l.at]));
  const pins: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    const at = lightAt.get(i);
    const lit = i < litBefore ? 1 : at !== undefined ? easeOutCubic(prog(t, at, 0.35)) : 0;
    const flare = at !== undefined ? Math.max(0, 1 - easeInCubic(prog(t, at + 0.1, 0.9))) * (t >= at ? 1 : 0) : 0;
    const s = 1 + 0.55 * flare;
    pins.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          left: Math.round(x - (d * s) / 2),
          top: Math.round(y - (d * s) / 2),
          width: Math.round(d * s),
          height: Math.round(d * s),
          borderRadius: 999,
          background:
            lit > 0
              ? `radial-gradient(circle at 38% 34%, rgba(236,255,248,${0.35 + 0.65 * lit}) 0%, rgba(116,201,174,${lit}) 45%, rgba(24,106,85,${lit}) 100%)`
              : 'radial-gradient(circle at 38% 34%, #5b605e 0%, #2c2f2e 52%, #151716 100%)',
          boxShadow:
            lit > 0
              ? `0 0 ${Math.round(d * (0.9 + 1.6 * flare))}px rgba(116,201,174,${(0.55 * lit + 0.35 * flare).toFixed(3)})`
              : `0 ${Math.round(d * 0.12)}px ${Math.round(d * 0.3)}px rgba(0,0,0,0.6)`,
          border: lit > 0 ? 'none' : `1px solid rgba(228,234,231,0.08)`,
          boxSizing: 'border-box',
        }}
      />,
    );
  }
  return <div style={{position: 'absolute', inset: 0, opacity: vis, pointerEvents: 'none'}}>{pins}</div>;
};

export const RULE_COLOR = color.accent.mint;
