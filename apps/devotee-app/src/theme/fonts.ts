import { NotoSansDevanagari_400Regular } from '@expo-google-fonts/noto-sans-devanagari/400Regular';
import { NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari/700Bold';
import { fontFamily } from '@mandir/ui';

/** Font files keyed by the family names in `@mandir/ui` (loaded by the root layout). */
export const fontAssets = {
  [fontFamily.regular]: NotoSansDevanagari_400Regular,
  [fontFamily.bold]: NotoSansDevanagari_700Bold,
};
