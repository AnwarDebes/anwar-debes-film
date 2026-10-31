// Guide sizes (pixie.md 8.6) and the card's type scale. Cell sizes are integers
// at every output size: even u at 1440p, so the 4K u = 1.5u is an integer too.

import {color, font, type as typeTokens} from '../engine/tokens';

export type PixiePreset = 'corner' | 'guide' | 'featured' | 'hero';

interface PresetSpec {
  /** Integer cell size at 1440p. */
  u1440: number;
  /** Card type sizes as fractions of frame height H. */
  kicker: number;
  label: number;
  detail: number;
}

export const PIXIE_PRESETS: Record<PixiePreset, PresetSpec> = {
  corner: {u1440: 8, kicker: 0.02, label: 0.046, detail: 0.02},
  guide: {u1440: 12, kicker: 0.021, label: 0.068, detail: 0.022},
  featured: {u1440: 20, kicker: typeTokens.monoKicker.size, label: typeTokens.stateLabel.size, detail: typeTokens.monoChip.size},
  hero: {u1440: 28, kicker: typeTokens.monoKicker.size, label: typeTokens.stateLabel.size, detail: typeTokens.monoChip.size},
};

/** Integer px per scene cell for a preset at frame height H (8 / 12 / 20 / 28 at 1440p). */
export const presetCell = (preset: PixiePreset, H: number): number =>
  Math.max(1, Math.round((PIXIE_PRESETS[preset].u1440 * H) / 1440));

/** The farthest any prop reaches inside the 34-cell box (the speech bubble, x = 32.2). */
export const PROP_REACH = 32.2;

// Card colours. The kicker grey and the detail coral were sampled from the reel's
// Pixie card (kicker about #B5B7B7; the detail is Pixie's own bodyHi). "Done!" is
// the film's mint, as in the reel.
export const CARD_COLORS = {
  kicker: '#B5B7B7',
  label: color.text.display,
  done: color.accent.mint,
  doneGlow: color.accent.mintGlow,
  detail: color.pixie.bodyHi,
} as const;

export const CARD_FONTS = {
  kicker: font.mono,
  label: font.sans,
  detail: font.mono,
} as const;

export const DEFAULT_KICKER = 'Right now, Pixie is';
