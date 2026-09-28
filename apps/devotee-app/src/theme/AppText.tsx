import { Text, type TextProps } from 'react-native';

import { typography, type TypographyVariant } from './typography';

type Props = TextProps & { variant?: TypographyVariant };

/** Text with the app's Devanagari-friendly font. Use instead of `Text` for anything user-facing. */
export function AppText({ variant = 'body', style, ...rest }: Props) {
  return <Text {...rest} style={[typography[variant], style]} />;
}
