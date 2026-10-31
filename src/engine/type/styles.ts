import type React from 'react';
import type {WordTag} from '../narration/types';
import {color, font, type, type TypeStyle} from '../tokens';
import {fontCSS, type FontSpec} from './metrics';

const MONO_STYLES: ReadonlySet<TypeStyle> = new Set<TypeStyle>([
  'monoChip',
  'monoKicker',
  'monoCardLabel',
  'emblemLabelMono',
  'code',
]);
const UPPER_STYLES: ReadonlySet<TypeStyle> = new Set<TypeStyle>(['monoKicker', 'monoCardLabel', 'emblemLabelMono']);

export const TABULAR = '"tnum" 1, "kern" 1';

/** A token type style resolved at frame height H. */
export const fontOf = (kind: TypeStyle, H: number, over: Partial<FontSpec> = {}): FontSpec => {
  const s = type[kind];
  return {
    family: MONO_STYLES.has(kind) ? font.mono : font.sans,
    size: s.size * H,
    weight: s.weight,
    style: 'normal',
    tracking: s.tracking,
    uppercase: UPPER_STYLES.has(kind),
    ...over,
  };
};

/** CSS for a token type style (for flowing text that does not need measuring). */
export const typeCSS = (kind: TypeStyle, H: number, over: Partial<FontSpec> = {}): React.CSSProperties => ({
  ...fontCSS(fontOf(kind, H, over)),
  lineHeight: type[kind].lineHeight,
});

/** The idea word: STIX Two Text italic, sized up so x-heights match the grotesk. */
export const emFont = (base: FontSpec, weight = 400): FontSpec => ({
  family: font.serif,
  size: base.size * font.emScale,
  weight,
  style: 'italic',
  tracking: base.tracking,
  features: '"kern" 1, "liga" 1',
});

export interface TagLook {
  font: FontSpec;
  color: string;
  glow: boolean;
}

/**
 * Tag to look, for a line whose plain words use `base`. Captions: plain 500
 * #E2E5E4, key and name 700 white, em STIX italic mint ×1.13 with a glow.
 */
export const tagLook = (
  tag: WordTag,
  base: FontSpec,
  opts: {plainColor?: string; keyWeight?: number; emWeight?: number} = {},
): TagLook => {
  if (tag === 'em') return {font: emFont(base, opts.emWeight ?? 400), color: color.accent.mint, glow: true};
  if (tag === 'key' || tag === 'name') {
    return {
      font: {...base, weight: opts.keyWeight ?? Math.max(700, base.weight)},
      color: color.text.key,
      glow: false,
    };
  }
  return {font: base, color: opts.plainColor ?? color.text.caption, glow: false};
};

// Shadow radii grow with the type up to a cap that is a fraction of the
// frame height H (so 1440p and 2160p look the same). Beyond it a wider blur
// is invisible on screen but expensive to rasterise: an uncapped 0.32 em
// halo on a 320 px numeral would be a 100 px blur.
const radius = (size: number, H: number, em: number, capH: number): number => Math.min(em * size, capH * H);

/** The faint mint glow on em words (text-shadow, so the glyphs stay sharp). */
export const mintGlow = (size: number, H: number, strength = 1): string =>
  `0 0 ${radius(size, H, 0.32, 0.022).toFixed(1)}px rgba(116,201,174,${(0.32 * strength).toFixed(3)})`;

/** A soft dark halo that keeps light type legible over lit pins. */
export const legibilityShadow = (size: number, H: number, strength = 1): string =>
  `0 ${(0.03 * size).toFixed(1)}px ${radius(size, H, 0.3, 0.0095).toFixed(1)}px rgba(5,8,7,${(0.42 * strength).toFixed(3)})`;
