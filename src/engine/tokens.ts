// Design tokens for the film. Measured from the 105 s reel (BT.601-decoded),
// site.css, the font files and pins.js. Sizes are fractions of frame height H.

export const color = {
  wall: {
    void: '#050807',
    deep: '#0A0C0C',
    edge: '#121313',
    shadow: '#161817',
    poolEdge: '#2C2E2D',
    poolCentre: '#505252',
    pinHighlight: '#DEE0E0',
    plate: '#0D1210',
  },
  site: {
    mist: '#121816',
    paper: '#1A2220',
    ink: '#E4EAE7',
    graphite: '#9AA7A3',
  },
  text: {
    display: '#ECEEED',
    caption: '#E2E5E4',
    key: '#FFFFFF',
    secondary: '#919493',
    tertiary: '#858787',
    chipDim: '#A4A6A5',
  },
  accent: {
    mint: '#74C9AE',
    mintLabel: '#84B1A2',
    mintGlow: 'rgba(116,201,174,0.35)',
    mintDeep: '#186A55',
  },
  // Verdict and award colours: used only for meaning.
  signal: {
    verdictRed: '#F67374',
    amber: '#FBBF24',
    gold: '#D4B46C',
  },
  card: {
    glass: 'rgba(13,18,16,0.92)',
    row: '#18201D',
    windowBody: '#060C11',
    windowHeader: '#0C1613',
    chip: '#131313',
    chipAlt: '#191C1B',
    rule: 'rgba(228,234,231,0.14)',
    ruleStrong: 'rgba(228,234,231,0.30)',
    literalPosBorder: '#74C9AE',
    literalNegBorder: '#F08A70',
  },
  // Coral belongs to Pixie.
  pixie: {
    body: '#D97757',
    bodyHi: '#E8A085',
    bodyLo: '#B85D40',
    promoGround: '#12110E',
    promoTitle: '#F4F0E4',
  },
  projectGrounds: {
    glassbox: '#0A1323',
    candor: '#F3FBF8',
    candorAccent: '#0B877B',
    trace: '#061312',
    veritas: '#071119',
  },
} as const;

export const font = {
  sans: '"Schibsted Grotesk", "Helvetica Neue", Arial, sans-serif',
  serif: '"STIX Two Text", "Times New Roman", serif',
  mono: '"JetBrains Mono", Consolas, monospace',
  emScale: 1.13,
} as const;

// size: fraction of H; tracking: em; lineHeight: unitless.
export const type = {
  numeralXL: {size: 0.2226, weight: 680, tracking: -0.03, lineHeight: 0.9},
  displayL: {size: 0.162, weight: 700, tracking: -0.03, lineHeight: 0.86},
  displayM: {size: 0.1225, weight: 700, tracking: -0.04, lineHeight: 0.9},
  stateLabel: {size: 0.1106, weight: 700, tracking: -0.03, lineHeight: 1},
  headline: {size: 0.0856, weight: 650, tracking: -0.035, lineHeight: 1.04},
  statement: {size: 0.078, weight: 600, tracking: -0.025, lineHeight: 1.18},
  cardTitle: {size: 0.054, weight: 700, tracking: -0.02, lineHeight: 1.1},
  tagline: {size: 0.0514, weight: 500, tracking: -0.02, lineHeight: 1.2},
  columnCaption: {size: 0.0474, weight: 500, tracking: -0.02, lineHeight: 1.18},
  caption: {size: 0.0386, weight: 500, weightKey: 700, tracking: -0.02, lineHeight: 1.39},
  bodySmall: {size: 0.026, weight: 450, tracking: 0, lineHeight: 1.3},
  emblemLabelMono: {size: 0.028, weight: 600, tracking: 0.13, lineHeight: 1.2},
  monoChip: {size: 0.0236, weight: 500, tracking: 0, lineHeight: 1.25},
  // Upgraded minimums for legibility at length (reel used 0.0178 / 0.0152).
  monoKicker: {size: 0.022, weight: 500, tracking: 0.2, lineHeight: 1.2},
  monoCardLabel: {size: 0.02, weight: 500, tracking: 0.15, lineHeight: 1.2},
  code: {size: 0.0255, weight: 450, tracking: 0, lineHeight: 1.55},
} as const;

export type TypeStyle = keyof typeof type;

export const caption = {
  maxLines: 2,
  maxWidthW: 0.8,
  lastBaselineH: 0.922,
  wordLeadS: 0.04,
  wordFadeS: 0.1,
  wordBlurAt1080: 6,
  wordDeblurS: 0.25,
  underline: {thicknessEm: 0.07, offsetBelowBaselineEm: 0.33, growS: 0.45},
  holdAfterLastWordS: [0.6, 0.85] as const,
  exitS: 0.25,
} as const;

export const layout = {
  marginLeftW: 0.069,
  textColumnW: [0.069, 0.45] as const,
  subjectW: [0.43, 0.93] as const,
  headlineCapTopH: 0.12,
  kickerBaselineH: 0.29,
  captionScrim: {fromH: 0.75, toH: 1.0, maxAlpha: 0.65},
  captionBandH: [0.75, 0.95] as const,
  cardRadiusH: 0.017,
  windowRadiusH: 0.015,
  cardPaddingH: 0.026,
} as const;

export const motion = {
  pinSpring: {k: 140, zeta: 0.72},
  tintTauS: 0.22,
  dentHealTauS: 0.55,
  ripple: {speed: 0.75, width: 0.045, decayPerS: 1.8, lifeS: 2.2},
  magnet: {sigma: [0.065, 0.09] as const, ampMax: 1.35},
  camera: {pushInPerBeat: 0.06, easeBackOnMorph: [0.05, 0.09] as const},
  textFocusPull: {inS: 0.35, outS: 0.3, blurAt1080: 8},
  cardSwingS: 0.5,
  cardFadeOutS: 0.35,
  stamp: {fromScale: 1.6, rotateDeg: -4, durS: 0.35},
  morphS: [0.75, 1.5] as const,
  preLapS: [0.3, 1.5] as const,
  hitToleranceS: 0.3,
} as const;

// cubic-bezier control points
export const easing = {
  ui: [0.22, 1, 0.36, 1],
  camera: [0.65, 0, 0.35, 1],
  text: [0.33, 1, 0.68, 1],
} as const;
