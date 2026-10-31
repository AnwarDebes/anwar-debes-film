import {layout, type as typeScale} from '../tokens';

// JetBrains Mono metrics (read from the shipped VF: UPM 1000, every glyph
// advances 600 units, ascender 1020, descender 300, cap 730, x-height 550).
// All positions are computed from these, never measured from the DOM, so a
// frame is a pure function of time and identical in every render tab.
export const MONO = {advance: 0.6, ascent: 1.02, descent: 0.3, cap: 0.73, xHeight: 0.55} as const;

export interface CodeMetrics {
  H: number;
  zoom: number;
  /** font size, px */
  fs: number;
  /** line pitch, px */
  lh: number;
  /** one character cell, px */
  cw: number;
  /** line top to baseline, px */
  baseline: number;
  /** line top to the top of capitals, px */
  capTop: number;
  /** line top to the middle of the x-height, px */
  xMid: number;
}

export const codeMetrics = (H: number, zoom = 1): CodeMetrics => {
  const fs = typeScale.code.size * H * zoom;
  const lh = fs * typeScale.code.lineHeight;
  const halfLeading = (lh - fs * (MONO.ascent + MONO.descent)) / 2;
  const baseline = halfLeading + fs * MONO.ascent;
  return {
    H,
    zoom,
    fs,
    lh,
    cw: fs * MONO.advance,
    baseline,
    capTop: baseline - fs * MONO.cap,
    xMid: baseline - (fs * MONO.xHeight) / 2,
  };
};

/** Window chrome sizes. They follow H only: zooming the code never resizes the chrome. */
export interface ChromeMetrics {
  H: number;
  headerH: number;
  labelSize: number;
  radius: number;
  border: number;
  padTop: number;
  padBottom: number;
  dotR: number;
  dotGap: number;
  sidePad: number;
}

export const chromeMetrics = (H: number): ChromeMetrics => ({
  H,
  headerH: 0.052 * H,
  labelSize: typeScale.monoCardLabel.size * H,
  radius: layout.windowRadiusH * H,
  border: Math.max(1, Math.round(H / 1080)),
  padTop: 0.024 * H,
  padBottom: 0.026 * H,
  dotR: 0.0043 * H,
  dotGap: 0.0125 * H,
  sidePad: 0.02 * H,
});

/** Horizontal layout of the body in code cells (scales with zoom). */
export interface GutterLayout {
  /** x of the right edge of line numbers */
  numRight: number;
  /** x of the diff sign column (if any) */
  signX: number;
  /** x where code column 0 starts */
  codeX: number;
  /** padding after the longest line */
  padRight: number;
  /** x of the highlight bar */
  barX: number;
}

export const gutterLayout = (m: CodeMetrics, digits: number, diff: boolean): GutterLayout => {
  const numRight = (1.5 + digits) * m.cw;
  const signX = numRight + 1.1 * m.cw;
  const codeX = diff ? signX + 2.2 * m.cw : numRight + 2.0 * m.cw;
  return {numRight, signX, codeX, padRight: 2 * m.cw, barX: numRight + 0.95 * m.cw};
};

/** Width of a panel that shows `cols` code columns without clipping. */
export const panelWidthFor = (H: number, cols: number, digits = 3, diff = false, zoom = 1): number => {
  const m = codeMetrics(H, zoom);
  const g = gutterLayout(m, digits, diff);
  return g.codeX + cols * m.cw + g.padRight;
};
