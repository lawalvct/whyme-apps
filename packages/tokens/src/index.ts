// Brand tokens. TEMPORARY values from the brand direction (UX01: emerald, white,
// warm gold accents, light grey, charcoal text) until the Figma tokens arrive.
// Change values here, then run `pnpm tokens:build` to regenerate theme.css.

export const colors = {
  primary: '#047857', // emerald
  primaryPressed: '#065F46',
  primarySoft: '#D1FAE5',
  accent: '#C9A227', // warm gold — featured/sponsored only, never verification
  accentSoft: '#FBF3D5',
  background: '#FFFFFF',
  surface: '#F3F4F6', // light grey
  border: '#E5E7EB',
  text: '#1F2937', // charcoal
  textMuted: '#6B7280',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
  info: '#1D4ED8',
} as const;

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
