import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HomeDeity } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { FALLBACK_DEITY_IMAGE } from '../assets';
import { Shimmer } from './Shimmer';

export const CAROUSEL_AVATAR = 52;
const CAROUSEL_GAP = 10;

type Props = {
  weekday: number | undefined;
  coins: number | undefined;
  deities: readonly HomeDeity[] | undefined;
  selectedId: string | undefined;
  onProfile: () => void;
  onCoins: () => void;
  onSelectDeity?: (deityId: string) => void;
  onAddDeity: () => void;
};

/** VM-01 top bar: profile avatar, day chip, coin pill, then the deity carousel. */
export function TopBar({ weekday, coins, deities, selectedId, onProfile, onCoins, onSelectDeity, onAddDeity }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tabs.profile')}
          onPress={onProfile}
          hitSlop={4}
          style={styles.avatar}
        >
          <MaterialCommunityIcons name="account-circle" size={40} color={colors.gold} />
        </Pressable>
        <View style={styles.chipWrap}>
          {weekday !== undefined && (
            <View style={styles.chip}>
              <AppText variant="caption" style={styles.chipText} numberOfLines={1}>
                {t('mandir.dayChip', { weekday: t(`mandir.weekdays.${weekday}`) })}
              </AppText>
            </View>
          )}
        </View>
        <CoinPill balance={coins} onPress={onCoins} />
      </View>
      <DeityCarousel deities={deities} selectedId={selectedId} onSelect={onSelectDeity} onAdd={onAddDeity} />
    </View>
  );
}

function CoinPill({ balance, onPress }: { balance: number | undefined; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={balance === undefined ? undefined : t('mandir.coinsA11y', { count: balance })}
      disabled={balance === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.coinPill, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name="circle-multiple" size={20} color={colors.maroon} />
      <AppText variant="button" style={styles.coinText}>
        {balance ?? '–'}
      </AppText>
    </Pressable>
  );
}

type CarouselProps = {
  deities: readonly HomeDeity[] | undefined;
  selectedId: string | undefined;
  onSelect?: (deityId: string) => void;
  onAdd: () => void;
};

/** Circular avatars of the user's deities in `position` order + "+" (→ Sangrah). */
function DeityCarousel({ deities, selectedId, onSelect, onAdd }: CarouselProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const scroll = useRef<ScrollView>(null);
  const selectedIndex = deities?.findIndex((d) => d.id === selectedId) ?? -1;

  // Keep the selected avatar in view (e.g. after a swipe on the garbhagriha).
  useEffect(() => {
    if (selectedIndex < 0) return;
    const x = Math.max(0, selectedIndex * (CAROUSEL_AVATAR + CAROUSEL_GAP) - 2 * (CAROUSEL_AVATAR + CAROUSEL_GAP));
    scroll.current?.scrollTo({ x, animated: true });
  }, [selectedIndex]);

  if (!deities) {
    return (
      <View style={styles.carousel}>
        {Array.from({ length: 5 }, (_, i) => (
          <Shimmer key={i} style={styles.avatarSkeleton} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carousel}
    >
      {deities.map((d) => {
        const selected = d.id === selectedId;
        return (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={pickLocalized(language, d.nameHi, d.nameEn)}
            onPress={() => onSelect?.(d.id)}
            style={[styles.deityAvatar, selected && styles.deityAvatarSelected]}
          >
            <Image
              source={d.image ? { uri: d.image.urls.thumb } : FALLBACK_DEITY_IMAGE}
              style={styles.deityAvatarImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mandir.addDeity')}
        onPress={onAdd}
        style={({ pressed }) => [styles.deityAvatar, styles.addButton, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={colors.gold} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.maroon, paddingBottom: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.sm },
  avatar: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
  chipWrap: { flex: 1, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  chipText: { color: colors.gold },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: MIN_TAP_TARGET - 8,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    justifyContent: 'center',
  },
  coinText: { color: colors.maroon },
  carousel: { flexDirection: 'row', gap: CAROUSEL_GAP, paddingHorizontal: spacing.md, alignItems: 'center' },
  deityAvatar: {
    width: CAROUSEL_AVATAR,
    height: CAROUSEL_AVATAR,
    borderRadius: CAROUSEL_AVATAR / 2,
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 55, 0.35)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deityAvatarSelected: { borderWidth: 3, borderColor: colors.gold },
  deityAvatarImage: { width: '100%', height: '100%' },
  avatarSkeleton: { width: CAROUSEL_AVATAR, height: CAROUSEL_AVATAR, borderRadius: CAROUSEL_AVATAR / 2, opacity: 0.3 },
  addButton: { borderStyle: 'dashed', borderColor: colors.gold },
  pressed: { opacity: 0.75 },
});
