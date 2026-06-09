/**
 * Hub CRM brand system tokens — HuB on Lewis logo at /branding/thehublogo.svg
 */

export const BRAND = {
  productName: 'The Hub CRM',
  venueName: 'HuB on Lewis',
  venueLocation: 'Wichita',
  tagline: 'Venue operations command center',
  productSubtitle: 'Venue OS',
} as const;

export const TYPOGRAPHY = {
  sans: "'Inter', system-ui, sans-serif",
  display: "'Barlow Condensed', sans-serif",
  scale: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '20px',
    xl: '28px',
    hero: 'clamp(28px, 4vw, 40px)',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 800,
  },
  tracking: {
    tight: '-0.02em',
    wide: '0.08em',
    display: '0.12em',
  },
} as const;

export const SPACING = {
  unit: 4,
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 40,
} as const;

/** Luxury hospitality palette — light theme primary */
export const PALETTE_LIGHT = {
  ivory: '#fffdf9',
  champagne: '#c4a574',
  champagneSoft: '#e8dcc8',
  smoke: '#57534e',
  ink: '#1c1917',
  rose: '#c9a9a6',
  commandBand: '#2a2622',
  commandBandText: '#f5f1ea',
} as const;

export const PALETTE_DARK = {
  void: '#080a0d',
  panel: '#12161e',
  elevated: '#181d28',
} as const;
