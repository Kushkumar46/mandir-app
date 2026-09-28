import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HomeDeity, ImageVariantUrls, MandirTheme, TodayOfferings } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { themeColor } from '../deity-selection';
import { anchorPoint, type MandirLayout, pileStage, type Rect } from '../layout';
import { DeityImage } from './DeityImage';
import { Shimmer } from './Shimmer';

type Props = {
  layout: MandirLayout;
  theme: MandirTheme | null;
  deity: HomeDeity | null;
  todayOfferings: TodayOfferings | undefined;
  variant: keyof ImageVariantUrls;
  loading: boolean;
  deityLabel?: string;
};

const abs = (r: Rect) => ({ position: 'absolute' as const, left: r.x, top: r.y, width: r.width, height: r.height });

/**
 * Garbhagriha, layered bottom → top (§4.1): background → deity → frame → effects.
 * The deity image fills the frame's arch opening (`cover`); the frame hides everything outside it.
 * Without a frame the rounded, gold-edged deity box still reads as an arch.
 */
export function DeityScene({ layout, theme, deity, todayOfferings, variant, loading, deityLabel }: Props) {
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
          <DeityImage key={deity?.id} image={deity?.image ?? null} variant={variant} accessibilityLabel={deityLabel} />
        )}
      </View>

      {/* frame (arch, toran, pillars) from the active theme */}
      {theme && <Image source={{ uri: theme.frameUrl }} style={abs(stage)} contentFit="fill" cachePolicy="memory-disk" />}

      {/* effects: today's offerings */}
      {!loading && deity && todayOfferings && (
        <FeetOfferings layout={layout} deity={deity} today={todayOfferings} />
      )}
    </View>
  );
}

/**
 * Today's accumulated offerings (VM-01 feet area): mala on the deity, flowers pile, lit diya, bhog.
 * Static markers for now; T12 replaces them with the offering sprites and animations (§4.4).
 */
function FeetOfferings({ layout, deity, today }: { layout: MandirLayout; deity: HomeDeity; today: TodayOfferings }) {
  const stage = pileStage(today.flowers);
  const mala = anchorPoint(layout.arch, deity.image?.anchor ?? null);
  const malaSize = Math.round(layout.arch.width * 0.32);

  return (
    <>
      {today.mala && (
        <View style={[styles.center, abs({ x: mala.x - malaSize / 2, y: mala.y - malaSize * 0.2, width: malaSize, height: malaSize })]}>
          <MaterialCommunityIcons name="necklace" size={malaSize} color={colors.saffron} />
        </View>
      )}
      <View style={[abs(layout.feet), styles.feet]}>
        {today.diya && <MaterialCommunityIcons name="oil-lamp" size={34} color={colors.gold} />}
        {stage > 0 && (
          <View style={styles.pile}>
            {Array.from({ length: stage * 2 - 1 }, (_, i) => (
              <MaterialCommunityIcons key={i} name="flower" size={22 + stage * 2} color={i % 2 ? colors.gold : colors.saffron} style={styles.petal} />
            ))}
          </View>
        )}
        {today.bhog && <MaterialCommunityIcons name="bowl-mix" size={30} color={colors.gold} />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  deity: { overflow: 'hidden', borderWidth: 3, borderColor: colors.gold },
  center: { alignItems: 'center', justifyContent: 'center' },
  feet: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  pile: { flexDirection: 'row', alignItems: 'flex-end' },
  petal: { marginHorizontal: -5 },
});
