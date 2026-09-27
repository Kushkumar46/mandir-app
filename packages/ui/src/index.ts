/**
 * Mobile theme tokens (docs/01-architecture.md §8).
 * Plain values only — no React Native imports — so admin-web can reuse the palette too.
 */
export const colors = {
  saffron: '#E07A1F',
  maroon: '#6B1E1E',
  gold: '#D4A537',
  cream: '#FFF6E5',
  white: '#FFFFFF',
  text: '#2B1A10',
  textMuted: '#6E5A4A',
  border: '#EAD9BF',
  danger: '#B3261E',
  success: '#2E7D32',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Many users are older: every tappable element is at least 48dp. */
export const MIN_TAP_TARGET = 48;

export const fontFamily = {
  /** Devanagari-friendly; loaded by the app shell (Virtual Mandir T8). */
  regular: 'NotoSansDevanagari-Regular',
  bold: 'NotoSansDevanagari-Bold',
} as const;

export const fontSize = { sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;

export const theme = { colors, spacing, radius, fontFamily, fontSize, MIN_TAP_TARGET } as const;
export type Theme = typeof theme;
