import React from 'react';
import {font, type as typeScale} from '../tokens';
import {lerp} from './anim';
import {chrome} from './theme';
import type {ChromeMetrics} from './metrics';
import type {CodeHeader} from './types';

// Window chrome in the film's WindowFrame look: charcoal body, a header strip
// with three quiet dots, the repository in mono caps mint and the file path in
// grey mono, a right-aligned detail, a 1 px rule and a soft drop shadow.

export const MONO_TEXT: React.CSSProperties = {
  fontFamily: font.mono,
  whiteSpace: 'pre',
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"calt" 0, "liga" 0',
  fontKerning: 'none',
  textRendering: 'geometricPrecision',
};

const LABEL_TRACK = 0.14;
const PATH_TRACK = 0.01;

/** Width of a mono string with letter-spacing, px. */
const monoWidth = (s: string, size: number, track: number) => s.length * (0.6 + track) * size;

export interface HeaderMix {
  from: CodeHeader;
  to: CodeHeader;
  /** 0 shows `from`, 1 shows `to` */
  k: number;
}

const Field: React.FC<{
  a: string;
  b: string;
  k: number;
  x: number;
  style: React.CSSProperties;
  align?: 'left' | 'right';
}> = ({a, b, k, x, style, align = 'left'}) => {
  const pos: React.CSSProperties =
    align === 'left' ? {position: 'absolute', left: x, top: 0} : {position: 'absolute', right: x, top: 0};
  if (a === b) return a ? <div style={{...pos, ...style}}>{a}</div> : null;
  // out, then in: two different strings never overlap mid-change
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const out = 1 - smooth(Math.min(1, k / 0.5));
  const inn = smooth(Math.max(0, (k - 0.5) / 0.5));
  return (
    <>
      {a && out > 0.001 ? <div style={{...pos, ...style, opacity: out}}>{a}</div> : null}
      {b && inn > 0.001 ? <div style={{...pos, ...style, opacity: inn}}>{b}</div> : null}
    </>
  );
};

export const CodeWindow: React.FC<{
  c: ChromeMetrics;
  width: number;
  height: number;
  header: HeaderMix;
  /** body content (clipped to the window) */
  children?: React.ReactNode;
  /** drawn above everything, not clipped (annotations) */
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({c, width, height, header, children, overlay, style}) => {
  const {from, to, k} = header;
  const lineBox = c.headerH;
  const text: React.CSSProperties = {
    ...MONO_TEXT,
    fontSize: c.labelSize,
    lineHeight: `${lineBox}px`,
    height: lineBox,
  };
  const labelStyle: React.CSSProperties = {
    ...text,
    color: chrome.label,
    fontWeight: 600,
    letterSpacing: `${LABEL_TRACK}em`,
    textTransform: 'uppercase',
  };
  const pathStyle: React.CSSProperties = {...text, color: chrome.path, fontWeight: 450, letterSpacing: `${PATH_TRACK}em`};
  const metaStyle: React.CSSProperties = {...text, color: chrome.meta, fontWeight: 450, letterSpacing: '0.02em'};

  const dotsX = c.sidePad + c.dotR;
  const labelX = dotsX + 2 * c.dotGap + c.dotR + 0.019 * c.H;
  const gap = 0.016 * c.H;
  const labelA = (from.label ?? '').toUpperCase();
  const labelB = (to.label ?? '').toUpperCase();
  const pathXA = labelX + (labelA ? monoWidth(labelA, c.labelSize, LABEL_TRACK) + gap : 0);
  const pathXB = labelX + (labelB ? monoWidth(labelB, c.labelSize, LABEL_TRACK) + gap : 0);
  const pathX = lerp(pathXA, pathXB, k);

  return (
    <div style={{position: 'absolute', width, height, ...style}}>
      {/* body and shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: c.radius,
          background: `radial-gradient(130% 90% at 28% 0%, rgba(228,234,231,0.025), rgba(228,234,231,0) 62%), ${chrome.body}`,
          boxShadow: `0 ${0.022 * c.H}px ${0.06 * c.H}px ${chrome.shadow}, 0 ${0.004 * c.H}px ${0.012 * c.H}px rgba(0,0,0,0.35)`,
        }}
      />
      {/* header strip */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height: c.headerH,
          background: chrome.header,
          borderTopLeftRadius: c.radius,
          borderTopRightRadius: c.radius,
          boxShadow: `inset 0 -${c.border}px 0 ${chrome.headerRule}`,
          overflow: 'hidden',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: dotsX - c.dotR + i * c.dotGap,
              top: c.headerH / 2 - c.dotR,
              width: 2 * c.dotR,
              height: 2 * c.dotR,
              borderRadius: c.dotR,
              background: chrome.dots,
            }}
          />
        ))}
        <Field a={labelA} b={labelB} k={k} x={labelX} style={labelStyle} />
        <Field a={from.path} b={to.path} k={k} x={pathX} style={pathStyle} />
        <Field a={from.meta ?? ''} b={to.meta ?? ''} k={k} x={c.sidePad * 1.1} style={metaStyle} align="right" />
      </div>
      {/* code body */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: c.headerH,
          width,
          height: Math.max(0, height - c.headerH),
          overflow: 'hidden',
          borderBottomLeftRadius: c.radius,
          borderBottomRightRadius: c.radius,
        }}
      >
        {children}
      </div>
      {/* hairline border and a faint top highlight, above the content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: c.radius,
          border: `${c.border}px solid ${chrome.border}`,
          boxShadow: `inset 0 ${c.border}px 0 rgba(255,255,255,0.035)`,
          pointerEvents: 'none',
        }}
      />
      {overlay ? <div style={{position: 'absolute', left: 0, top: c.headerH, width, height: 0, overflow: 'visible'}}>{overlay}</div> : null}
    </div>
  );
};

export const headerLabelSize = (H: number) => typeScale.monoCardLabel.size * H;
