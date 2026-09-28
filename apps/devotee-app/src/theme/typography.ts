import { colors, fontFamily, fontSize } from '@mandir/ui';
import { StyleSheet } from 'react-native';

/**
 * Text styles. Custom fonts ignore `fontWeight` on Android, so weight = font family.
 * Devanagari needs generous line height for matras above/below the line.
 */
export const typography = StyleSheet.create({
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text },
  bodyLarge: { fontFamily: fontFamily.regular, fontSize: fontSize.lg, lineHeight: fontSize.lg * 1.5, color: colors.text },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.6, color: colors.textMuted },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.5, color: colors.maroon },
  heading: { fontFamily: fontFamily.bold, fontSize: fontSize.xxl, lineHeight: fontSize.xxl * 1.45, color: colors.maroon },
  button: { fontFamily: fontFamily.bold, fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.white },
});

export type TypographyVariant = keyof typeof typography;
