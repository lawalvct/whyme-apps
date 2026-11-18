import { Platform, type TextStyle } from 'react-native';
import { colors as brand } from '@whyme/tokens';

/**
 * The app's look, taken from the approved mobile screens (docs/mobile-ui): white canvas, WHY ME
 * green, deep forest-green headings, warm gold accents, pale sage surfaces, thin borders and
 * 12–18 point corners. Brand colours come from @whyme/tokens so the app and website stay in step.
 */
export const color = {
  green: brand.primary,
  greenPressed: brand.primaryPressed,
  forest: '#103B29', // headings and titles
  ink: '#1C2A23', // body text and inactive tab labels
  muted: '#5E6B64',
  faint: '#8A958F',
  white: '#FFFFFF',
  canvas: '#FFFFFF',
  field: '#F2F4F3', // search field, language pill
  sage: '#EAF4EC', // selected segments, icon tiles, reassurance strips
  sageStrong: '#D7EBDC',
  sageBorder: '#D2E5D7',
  border: '#E3E8E5',
  gold: brand.accent,
  goldBright: '#F4BE3C', // large gold buttons ("Explore now", "Review listing")
  goldSoft: brand.accentSoft,
  goldText: brand.accentText,
  danger: brand.danger,
  overlay: 'rgba(16, 59, 41, 0.45)',
} as const;

export const radius = { sm: 8, md: 12, lg: 14, xl: 18, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Side margin of every screen. */
export const gutter = 16;

/** Smallest tap area (UX03). */
export const touch = 48;

/**
 * System fonts (San Francisco on iPhone, Roboto on Android) feel native, need no download and
 * cover Igbo letters (ị ọ ụ ṅ). The web preview uses the browser's system font.
 */
const family = Platform.select({ web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', default: undefined });

export const type = {
  display: { fontFamily: family, fontSize: 32, lineHeight: 38, fontWeight: '800', color: color.forest, letterSpacing: -0.5 },
  title: { fontFamily: family, fontSize: 24, lineHeight: 30, fontWeight: '800', color: color.forest, letterSpacing: -0.3 },
  heading: { fontFamily: family, fontSize: 18, lineHeight: 24, fontWeight: '700', color: color.ink },
  body: { fontFamily: family, fontSize: 16, lineHeight: 22, fontWeight: '400', color: color.ink },
  bodyStrong: { fontFamily: family, fontSize: 16, lineHeight: 22, fontWeight: '600', color: color.ink },
  small: { fontFamily: family, fontSize: 14, lineHeight: 20, fontWeight: '400', color: color.muted },
  label: { fontFamily: family, fontSize: 15, lineHeight: 20, fontWeight: '700', color: color.forest },
  caption: { fontFamily: family, fontSize: 12, lineHeight: 16, fontWeight: '600', color: color.ink },
  price: { fontFamily: family, fontSize: 20, lineHeight: 26, fontWeight: '800', color: color.green },
} satisfies Record<string, TextStyle>;
