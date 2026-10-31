import React from 'react';
import {useVideoConfig} from 'remotion';
import {flatField, type FieldFn, type RGB} from '../../../engine/pins';
import {prog} from '../../../engine/type/ease';

// Chapter 07 sits in the warm palette of the Pixie promo (ground #12110E, a radial coral glow
// behind the subject): warm steel in the pins and a soft coral grade over the frame. It comes in
// at the gate and cools back to the film's steel as the chapter hands over.

/** Bare pins in the warm palette (steel 0.9 nudged toward the promo's brown ground). */
export const WARM: RGB = [0.9, 0.82, 0.72];
export const warmFlat: FieldFn = flatField(WARM);

/** The promo's warm grade: a coral glow behind the subject and a brown edge, both very soft. */
export const WarmGrade: React.FC<{t: number; from: number; to: number; focus?: [number, number]; strength?: number}> = ({t, from, to, focus = [0.58, 0.46], strength = 1}) => {
  const {width: W, height: H} = useVideoConfig();
  const k = Math.min(prog(t, from, 1.2), 1 - prog(t, to - 1.4, 1.4)) * strength;
  if (k <= 0.001) return null;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: k,
          background: `radial-gradient(ellipse ${Math.round(0.62 * W)}px ${Math.round(0.7 * H)}px at ${focus[0] * 100}% ${focus[1] * 100}%, rgba(217,119,87,0.13) 0%, rgba(217,119,87,0.05) 45%, rgba(0,0,0,0) 75%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
          opacity: k,
          background: `radial-gradient(ellipse ${Math.round(0.9 * W)}px ${Math.round(0.95 * H)}px at 55% 45%, rgba(255,250,242,1) 35%, rgba(150,128,104,1) 100%)`,
        }}
      />
    </>
  );
};
