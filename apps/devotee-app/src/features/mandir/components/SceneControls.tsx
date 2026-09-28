import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HomeDeity, HomeThali, OfferingKind } from '@mandir/shared-types';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import type { MandirLayout } from '../layout';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const textShadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } };

/** "॥ मंगलवार, भाद्रपद कृष्ण पक्ष चतुर्थी ॥" — static in Phase 1 (tap opens Panchang in Phase 2). */
export function TithiStrip({ layout, text }: { layout: MandirLayout; text: string | undefined }) {
  return (
    <View pointerEvents="none" style={[styles.tithi, { top: layout.tithi.top, height: layout.tithi.height }]}>
      {text && (
        <AppText variant="body" style={styles.tithiText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          ॥ {text} ॥
        </AppText>
      )}
    </View>
  );
}

export function OfflineBanner({ layout }: { layout: MandirLayout }) {
  const { t } = useTranslation();
  return (
    <View pointerEvents="none" style={[styles.offline, { top: layout.tithi.top + layout.tithi.height }]}>
      <MaterialCommunityIcons name="wifi-off" size={16} color={colors.white} />
      <AppText variant="caption" style={styles.offlineText}>
        {t('common.offline')}
      </AppText>
    </View>
  );
}

export type RailAction = OfferingKind | 'SANGRAH';

const RAIL: { action: RailAction; icon: IconName; label: string; offering: boolean }[] = [
  { action: 'FLOWER', icon: 'flower-tulip', label: 'mandir.rail.flower', offering: true },
  { action: 'MALA', icon: 'necklace', label: 'mandir.rail.mala', offering: true },
  { action: 'DIYA', icon: 'oil-lamp', label: 'mandir.rail.diya', offering: true },
  { action: 'BHOG', icon: 'bowl-mix', label: 'mandir.rail.bhog', offering: true },
  { action: 'SANGRAH', icon: 'view-grid-plus', label: 'mandir.rail.sangrah', offering: false },
];

/** Left vertical rail: Phool, Mala, Diya, Bhog (→ VM-05, hidden when `mandir.offerings` is off), Sangrah (→ VM-03). */
export function OfferingRail({
  layout,
  disabled,
  offeringsEnabled,
  onPress,
}: {
  layout: MandirLayout;
  disabled: boolean;
  offeringsEnabled: boolean;
  onPress: (action: RailAction) => void;
}) {
  const { t } = useTranslation();
  const { rail } = layout;
  const items = RAIL.filter((i) => offeringsEnabled || !i.offering);
  return (
    <ScrollView
      style={[styles.rail, { top: rail.top, left: rail.left, width: rail.width, height: rail.height }]}
      scrollEnabled={rail.scrolls}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item) => (
        <Pressable
          key={item.action}
          accessibilityRole="button"
          accessibilityLabel={t(item.label)}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onPress(item.action)}
          style={({ pressed }) => [styles.railItem, { height: rail.itemHeight }, (pressed || disabled) && styles.pressed]}
        >
          <View style={styles.railIcon}>
            <MaterialCommunityIcons name={item.icon} size={26} color={colors.cream} />
          </View>
          <AppText variant="caption" style={styles.railLabel} numberOfLines={1}>
            {t(item.label)}
          </AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Bottom centre: the user's selected aarti thali (§6.8) → VM-06. */
export function AartiThaliButton({
  layout,
  thali,
  disabled,
  onPress,
}: {
  layout: MandirLayout;
  thali: HomeThali | null | undefined;
  disabled: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { size, bottom, left } = layout.thali;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mandir.aarti')}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.thali, { width: size, height: size + 18, bottom, left }, pressed && styles.pressed]}
    >
      <View style={[styles.thaliPlate, { width: size, height: size, borderRadius: size / 2 }]}>
        {thali ? (
          <Image source={{ uri: thali.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <MaterialCommunityIcons name="oil-lamp" size={size * 0.5} color={colors.gold} />
        )}
      </View>
      <View style={styles.thaliLabel}>
        <AppText variant="caption" style={styles.thaliLabelText} numberOfLines={1}>
          {t('mandir.aarti')}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Bottom right: deity-special offering badge (→ VM-05 `special`) and Listen / stop (default aarti in the background). */
export function SpecialActions({
  layout,
  deity,
  disabled,
  listening,
  onSpecial,
  onListen,
}: {
  layout: MandirLayout;
  deity: HomeDeity | null;
  disabled: boolean;
  /** This deity's aarti is playing in the background (the button then stops it). */
  listening: boolean;
  onSpecial: () => void;
  onListen: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const special = deity?.specialOffering;
  const { width, right, bottom } = layout.actions;

  return (
    <View style={[styles.actions, { width, right, bottom }]}>
      {special && (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSpecial}
          style={({ pressed }) => [styles.special, pressed && styles.pressed]}
        >
          <Image source={{ uri: special.iconUrl }} style={styles.specialIcon} contentFit="contain" cachePolicy="memory-disk" />
          <AppText variant="caption" style={styles.specialText} numberOfLines={2}>
            {t('mandir.offerSpecial', { name: pickLocalized(language, special.nameHi, special.nameEn) })}
          </AppText>
          {special.coinCost > 0 && (
            <View style={styles.specialCost}>
              <MaterialCommunityIcons name="circle-multiple" size={12} color={colors.maroon} />
              <AppText variant="caption" style={styles.specialCostText}>
                {special.coinCost}
              </AppText>
            </View>
          )}
        </Pressable>
      )}
      {deity?.defaultAartiId && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? t('mandir.listenStopA11y') : t('mandir.listen')}
          accessibilityState={{ selected: listening }}
          disabled={disabled}
          onPress={onListen}
          style={({ pressed }) => [styles.listen, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name={listening ? 'stop' : 'headphones'} size={20} color={colors.maroon} />
          <AppText variant="caption" style={styles.listenText}>
            {listening ? t('mandir.listenStop') : t('mandir.listen')}
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const overlayBg = 'rgba(107, 30, 30, 0.82)';

const styles = StyleSheet.create({
  tithi: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center', justifyContent: 'center' },
  tithiText: { color: colors.gold, textAlign: 'center', ...textShadow },
  offline: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(43, 26, 16, 0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  offlineText: { color: colors.white },
  rail: { position: 'absolute' },
  railItem: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  railIcon: {
    width: MIN_TAP_TARGET,
    height: MIN_TAP_TARGET,
    borderRadius: MIN_TAP_TARGET / 2,
    backgroundColor: overlayBg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: { color: colors.cream, fontSize: 12, lineHeight: 18, ...textShadow },
  thali: { position: 'absolute', alignItems: 'center' },
  thaliPlate: {
    overflow: 'hidden',
    backgroundColor: overlayBg,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thaliLabel: {
    marginTop: -12,
    backgroundColor: colors.saffron,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  thaliLabelText: { color: colors.white, fontSize: 12, lineHeight: 20 },
  actions: { position: 'absolute', alignItems: 'stretch', gap: spacing.sm },
  special: {
    minHeight: MIN_TAP_TARGET,
    backgroundColor: overlayBg,
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: spacing.xs,
    alignItems: 'center',
  },
  specialIcon: { width: 36, height: 36 },
  specialText: { color: colors.cream, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  specialCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
  },
  specialCostText: { color: colors.maroon, fontSize: 12, lineHeight: 18 },
  listen: {
    minHeight: MIN_TAP_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
  },
  listenText: { color: colors.maroon, fontSize: 13 },
  pressed: { opacity: 0.6 },
});
