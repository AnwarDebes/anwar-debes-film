import React from 'react';
import {color, font, layout, motion, type} from '../tokens';
import {easeInCubic, easeOutCubic, easeUI, prog} from './ease';
import {useTime, useUnits} from './units';

/** Enter/exit envelope for cards: fade and a short rise in, fade out. */
const cardEnvelope = (t: number, at: number | undefined, exitAt: number | undefined, outS: number) => {
  let alpha = 1;
  let rise = 0;
  if (at !== undefined) {
    if (t < at) return null;
    alpha = easeOutCubic(prog(t, at, 0.35));
    rise = 1 - easeUI(prog(t, at, 0.5));
  }
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, outS);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
  }
  return {alpha, rise};
};

export interface GlassCardProps {
  /** px: top-left corner and size */
  x: number;
  y: number;
  width: number;
  height?: number;
  /** mono caps label in mint, top left */
  label?: string;
  /** bold title, top right */
  title?: string;
  t?: number;
  at?: number;
  exitAt?: number;
  /** px (default 0.026 H) */
  padding?: number;
  opacity?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The film's info card: dark glass (#0D1210 at 92%), 1 px light border,
 * radius 0.017 H, padding 0.026 H, a mint mono label and an optional bold
 * title. Fades and rises in, fades out.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  x,
  y,
  width,
  height,
  label,
  title,
  t: tProp,
  at,
  exitAt,
  padding,
  opacity = 1,
  children,
  style,
}) => {
  const t = useTime(tProp);
  const {H, hair, h: fh} = useUnits();
  const env = cardEnvelope(t, at, exitAt, motion.cardFadeOutS);
  if (!env) return null;
  const pad = Math.round(padding ?? fh(layout.cardPaddingH));
  const labelSize = type.monoCardLabel.size * H;
  const dy = env.rise * fh(0.014);
  return (
    <div
      style={{
        position: 'absolute',
        left: Math.round(x),
        top: Math.round(y),
        width: Math.round(width),
        height: height === undefined ? undefined : Math.round(height),
        boxSizing: 'border-box',
        padding: pad,
        borderRadius: Math.round(fh(layout.cardRadiusH)),
        background: color.card.glass,
        border: `${hair}px solid ${color.card.rule}`,
        boxShadow: `0 ${Math.round(fh(0.018))}px ${Math.round(fh(0.06))}px rgba(0,0,0,0.45)`,
        opacity: env.alpha * opacity,
        transform: dy > 0.01 ? `translateY(${dy.toFixed(2)}px)` : undefined,
        ...style,
      }}
    >
      {label || title ? (
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Math.round(pad * 0.7)}}>
          {label ? (
            <span
              style={{
                fontFamily: font.mono,
                fontSize: labelSize,
                fontWeight: type.monoCardLabel.weight,
                letterSpacing: `${type.monoCardLabel.tracking}em`,
                textTransform: 'uppercase',
                color: color.accent.mint,
                whiteSpace: 'pre',
                fontSynthesis: 'none',
              }}
            >
              {label}
            </span>
          ) : (
            <span />
          )}
          {title ? (
            <span style={{fontFamily: font.sans, fontSize: fh(0.03), fontWeight: 700, letterSpacing: '-0.02em', color: color.text.display, whiteSpace: 'pre', fontSynthesis: 'none'}}>
              {title}
            </span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
};

export interface WindowFrameProps {
  /** px: top-left corner and size of the window (before its 3D pose) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** product name, set in mono caps mint after a mint dot */
  product: string;
  /** grey sans descriptor after the name, e.g. "proofs for guardrails" */
  descriptor?: string;
  t?: number;
  at?: number;
  exitAt?: number;
  /** 3D pose at rest (deg). Both 0 keeps the window flat and its text sharpest. */
  rotateY?: number;
  rotateX?: number;
  /** enter with a swing from edge-on (default true) */
  swing?: boolean;
  /** which edge it hinges on while swinging in */
  hinge?: 'left' | 'right';
  opacity?: number;
  children?: React.ReactNode;
}

/**
 * Window chrome for a product capture or a natively re-set UI: header strip
 * with a mint dot, the product in mono caps and a grey descriptor; dark body;
 * radius 0.015 H; soft drop shadow; an optional 3D pose (−8° yaw, 2° pitch).
 * Swings in from edge-on in 0.5 s, fades out in 0.35 s.
 */
export const WindowFrame: React.FC<WindowFrameProps> = ({
  x,
  y,
  width,
  height,
  product,
  descriptor,
  t: tProp,
  at,
  exitAt,
  rotateY = -8,
  rotateX = 2,
  swing = true,
  hinge = 'right',
  opacity = 1,
  children,
}) => {
  const t = useTime(tProp);
  const {H, hair, h: fh} = useUnits();
  if (at !== undefined && t < at) return null;
  let alpha = opacity;
  let ry = rotateY;
  if (at !== undefined) {
    alpha *= easeOutCubic(prog(t, at, 0.28));
    if (swing) {
      const k = easeUI(prog(t, at, motion.cardSwingS));
      // keep turning one way, from nearly edge-on to the rest pose (never through flat)
      ry = rotateY + (hinge === 'right' ? -1 : 1) * 64 * (1 - k);
    }
  }
  if (exitAt !== undefined) {
    const k = prog(t, exitAt, motion.cardFadeOutS);
    if (k >= 1) return null;
    alpha *= 1 - easeInCubic(k);
  }
  const radius = Math.round(fh(layout.windowRadiusH));
  const headerH = Math.round(fh(0.046));
  const labelSize = type.monoCardLabel.size * H;
  const dot = Math.max(4, Math.round(labelSize * 0.42));
  const flat = Math.abs(ry) < 0.01 && Math.abs(rotateX) < 0.01;
  return (
    <div style={{position: 'absolute', inset: 0, perspective: Math.round(H * 2.4), pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: Math.round(x),
          top: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
          borderRadius: radius,
          overflow: 'hidden',
          background: color.card.windowBody,
          border: `${hair}px solid ${color.card.rule}`,
          boxSizing: 'border-box',
          boxShadow: `0 ${Math.round(fh(0.03))}px ${Math.round(fh(0.09))}px rgba(0,0,0,0.55)`,
          opacity: alpha,
          transformOrigin: hinge === 'right' ? '100% 50%' : '0% 50%',
          transform: flat ? undefined : `rotateY(${ry.toFixed(3)}deg) rotateX(${rotateX}deg)`,
        }}
      >
        <div
          style={{
            height: headerH,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: Math.round(labelSize * 0.7),
            padding: `0 ${Math.round(fh(0.022))}px`,
            background: color.card.windowHeader,
            borderBottom: `${hair}px solid ${color.card.rule}`,
          }}
        >
          <span style={{width: dot, height: dot, borderRadius: dot / 2, background: color.accent.mint, boxShadow: `0 0 ${dot * 1.5}px rgba(116,201,174,0.6)`, flex: 'none'}} />
          <span
            style={{
              fontFamily: font.mono,
              fontSize: labelSize,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: color.accent.mint,
              whiteSpace: 'pre',
              fontSynthesis: 'none',
            }}
          >
            {product}
          </span>
          {descriptor ? (
            <span style={{fontFamily: font.sans, fontSize: fh(0.021), fontWeight: 450, color: color.text.secondary, whiteSpace: 'pre', fontSynthesis: 'none'}}>
              {descriptor}
            </span>
          ) : null}
        </div>
        <div style={{position: 'relative', height: Math.round(height) - headerH}}>{children}</div>
      </div>
    </div>
  );
};
