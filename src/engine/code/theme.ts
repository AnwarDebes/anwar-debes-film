import {color, type as typeScale} from '../tokens';
import type {CodeClass} from './types';

// The code palette, derived from the film's tokens. Steel greys carry the
// structure; mint is reserved for one idea class (function names: the verbs
// the code performs). Strings and numbers get the only other hues, both muted
// so they never compete with mint. Coral is not used (it belongs to Pixie).

export interface TokenStyle {
  color: string;
  weight: number;
}

const base = typeScale.code.weight;

export const codeTheme: Record<CodeClass, TokenStyle> = {
  '': {color: '#D3D8D6', weight: base},
  var: {color: '#D3D8D6', weight: base},
  param: {color: '#DDE2E0', weight: base},
  prop: {color: '#B8C1BD', weight: base},
  self: {color: '#8C9693', weight: base},
  kw: {color: '#97A19E', weight: 560},
  fn: {color: color.accent.mint, weight: 520},
  type: {color: color.text.display, weight: 600},
  const: {color: color.text.display, weight: 560},
  str: {color: '#C9BD9F', weight: base},
  esc: {color: '#DCCFAE', weight: 560},
  num: {color: '#A7BBC9', weight: base},
  com: {color: '#6E7673', weight: base},
  op: {color: '#88918E', weight: base},
  punc: {color: '#6F7774', weight: base},
  dec: {color: '#97A19E', weight: 560},
};

export const chrome = {
  body: color.card.windowBody,
  header: color.card.windowHeader,
  border: color.card.rule,
  headerRule: 'rgba(228,234,231,0.07)',
  dots: 'rgba(228,234,231,0.17)',
  label: color.accent.mint,
  path: color.text.secondary,
  meta: color.text.tertiary,
  gutter: '#565D5B',
  gutterActive: color.accent.mint,
  shadow: 'rgba(0,0,0,0.55)',
  // highlight a line range
  mint: color.accent.mint,
  mintWash: 'rgba(116,201,174,0.10)',
  mintGlow: color.accent.mintGlow,
  // diff
  addWash: 'rgba(116,201,174,0.12)',
  addWashStrong: 'rgba(116,201,174,0.26)',
  addSign: color.accent.mint,
  delWash: 'rgba(246,115,116,0.12)',
  delWashStrong: 'rgba(246,115,116,0.27)',
  delSign: color.signal.verdictRed,
  // annotations
  chipBg: 'rgba(13,18,16,0.94)',
  chipBorder: color.card.ruleStrong,
  labelText: color.text.display,
  labelDim: color.text.secondary,
  caret: color.accent.mint,
} as const;

const hex = (c: string): [number, number, number] => {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Linear mix of two #rrggbb colours, k in 0..1. */
export const mixHex = (a: string, b: string, k: number): string => {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const x = hex(a);
  const y = hex(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/** Colour of a removed diff row's text: the token colour pulled toward grey. */
export const removedTint = (c: string): string => mixHex(c, '#7A7F7E', 0.45);
