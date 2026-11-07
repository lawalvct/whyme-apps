// Brand tokens, taken from the WHY ME logo (brand/source/): the green of the
// figures and the gold of the location pin, with white, light grey and charcoal
// text (UX01). No Figma: these are the source of truth for web, mobile and the
// admin panel. Change values here, then run `pnpm tokens:build` for theme.css.
//
// Contrast on white: primary 5.1:1, primaryPressed 7:1, accentText 5.8:1 (all
// pass WCAG AA for text). `accent` itself is 2.2:1, so it is for fills and
// icons, with charcoal text on top, never for text on white.

export const colors = {
  primary: '#027F45', // logo green
  primaryPressed: '#01663A',
  primarySoft: '#E4F3EA',
  accent: '#E7A33A', // logo gold: featured/sponsored and highlights, never verification
  accentText: '#8F5A0F', // gold for text on white
  accentSoft: '#FDF3E3',
  background: '#FFFFFF',
  surface: '#F3F4F6', // light grey
  border: '#E5E7EB',
  text: '#1F2937', // charcoal
  textMuted: '#6B7280',
  onPrimary: '#FFFFFF',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#027F45',
  info: '#1D4ED8',
} as const;

// Logo files are per app (web: public/brand, mobile: assets/images/brand, admin:
// public/brand), generated from brand/source by scripts/brand-assets.php.

// Sync/offline status colours (OFF07): Draft, Pending, Sent, Failed, Needs attention.
export const syncStatusColors = {
  draft: colors.textMuted,
  pending: colors.warning,
  sent: colors.success,
  failed: colors.danger,
  attention: colors.danger,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

// Font must cover Igbo: ị ọ ụ ṅ (+ capitals and tone marks). See docs/03 §6.
export const typography = {
  fontFamily: 'Inter',
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

// Minimum touch target (UX03: large touch targets).
export const touchTarget = 48;

export const tokens = { colors, syncStatusColors, spacing, radius, typography, touchTarget } as const;
export type Tokens = typeof tokens;
