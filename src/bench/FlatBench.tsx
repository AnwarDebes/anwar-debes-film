import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';

// Baselines: what a frame costs with no 3D (2D motion graphics), and with an
// almost empty WebGL canvas (fixed cost of WebGL readback).
export const FlatBench: React.FC<{gl: boolean}> = ({gl}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const x = interpolate(frame, [0, 180], [0, width * 0.4]);
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 30% 30%, #1A2220, #121816 70%)'}}>
      {gl ? (
        <ThreeCanvas width={width} height={height} camera={{position: [0, 0, 5]}}>
          <mesh rotation={[frame / 40, frame / 60, 0]}>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshNormalMaterial />
          </mesh>
        </ThreeCanvas>
      ) : null}
      <AbsoluteFill style={{padding: '8%', justifyContent: 'center'}}>
        <div style={{color: '#E4EAE7', fontSize: height * 0.09, fontWeight: 800, transform: `translateX(${x}px)`}}>
          Glass box, frame {frame}
        </div>
        <svg width={width * 0.5} height={height * 0.2} style={{marginTop: 40}}>
          {Array.from({length: 40}, (_, i) => (
            <circle key={i} cx={20 + i * 30} cy={60 + Math.sin(frame / 10 + i) * 30} r={10} fill="#74C9AE" />
          ))}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
