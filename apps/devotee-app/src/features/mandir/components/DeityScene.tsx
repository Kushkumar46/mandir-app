import type { HomeDeity, ImageVariantUrls, MandirTheme, TodayOfferings } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors } from '@/theme';

import { themeColor } from '../deity-selection';
import type { FeetSprites } from '../hooks/useOfferings';
import type { MandirLayout, Rect } from '../layout';
import { DeityImage } from './DeityImage';
import { FeetOfferings } from './offerings/FeetOfferings';
import { Shimmer } from './Shimmer';

type Props = {
  layout: MandirLayout;
  theme: MandirTheme | null;
  deity: HomeDeity | null;
  todayOfferings: TodayOfferings | undefined;
  variant: keyof ImageVariantUrls;
  loading: boolean;
  /** Offering sprites for today's offerings (null until the deity's offerings have loaded). */
  feetSprites: FeetSprites | null;
};

/** VM-02: switching deity cross-fades the deity layer and its offerings. */
export const CROSS_FADE_MS = 250;
const crossFadeIn = FadeIn.duration(CROSS_FADE_MS);
const crossFadeOut = FadeOut.duration(CROSS_FADE_MS);

const abs = (r: Rect) => ({ position: 'absolute' as const, left: r.x, top: r.y, width: r.width, height: r.height });

/**
 * Garbhagriha, layered bottom → top (§4.1): background → deity → frame → effects.
 * The deity image fills the frame's arch opening (`cover`); the frame hides everything outside it.
 * Without a frame the rounded, gold-edged deity box still reads as an arch.
 */
export function DeityScene({ layout, theme, deity, todayOfferings, variant, loading, feetSprites }: Props) {
  const { stage, arch } = layout;
  const archBox = { ...abs(arch), borderTopLeftRadius: arch.width / 2, borderTopRightRadius: arch.width / 2 };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColor(theme, 'secondary', colors.maroon) }]} />
      <View style={[archBox, { backgroundColor: themeColor(theme, 'background', colors.cream) }]} />

      {/* deity */}
      <View style={[archBox, styles.deity]}>
        {loading ? (
          <Shimmer style={StyleSheet.absoluteFill} />
        ) : (
          <Animated.View key={deity?.id ?? 'none'} entering={crossFadeIn} exiting={crossFadeOut} style={StyleSheet.absoluteFill}>
            <DeityImage image={deity?.image ?? null} variant={variant} />
          </Animated.View>
        )}
      </View>

      {/* frame (arch, toran, pillars) from the active theme */}
      {theme && <Image source={{ uri: theme.frameUrl }} style={abs(stage)} contentFit="fill" cachePolicy="memory-disk" />}

      {/* effects: today's offerings */}
      {!loading && deity && todayOfferings && (
        <Animated.View key={deity.id} entering={crossFadeIn} exiting={crossFadeOut} style={StyleSheet.absoluteFill}>
          <FeetOfferings layout={layout} deity={deity} today={todayOfferings} sprites={feetSprites} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deity: { overflow: 'hidden', borderWidth: 3, borderColor: colors.gold },
});
