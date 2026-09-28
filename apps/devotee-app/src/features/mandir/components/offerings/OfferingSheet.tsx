import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { DeityOfferings, OfferingItemView, OfferingKind } from '@mandir/shared-types';
import type { UseQueryResult } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/features/shell/BottomSheet';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

import { itemsOfKind } from '../../hooks/useOfferings';

const TITLE: Record<OfferingKind, string> = {
  FLOWER: 'mandir.offering.title.FLOWER',
  MALA: 'mandir.offering.title.MALA',
  DIYA: 'mandir.offering.title.DIYA',
  BHOG: 'mandir.offering.title.BHOG',
  SPECIAL: 'mandir.offering.title.SPECIAL',
};

/**
 * VM-05 offering sheet, one component for every kind: the deity's items with image, name and
 * "निःशुल्क" or their coin cost. While a paid offering waits for the server its card shows a spinner
 * and the other cards are locked (a double tap never spends twice).
 */
export function OfferingSheet({
  kind,
  query,
  balance,
  pendingItemId,
  onOffer,
  onClose,
}: {
  kind: OfferingKind;
  query: UseQueryResult<DeityOfferings>;
  balance: number | undefined;
  pendingItemId: string | null;
  onOffer: (item: OfferingItemView) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const items = itemsOfKind(query.data, kind);

  return (
    <BottomSheet title={t(TITLE[kind])} onClose={onClose} testID="offering-sheet">
      {balance !== undefined && (
        <View style={styles.balance}>
          <MaterialCommunityIcons name="circle-multiple" size={16} color={colors.gold} />
          <AppText variant="caption" style={styles.balanceText}>
            {t('mandir.offering.balance', { count: balance })}
          </AppText>
        </View>
      )}
      {query.isPending ? (
        <ActivityIndicator color={colors.saffron} style={styles.status} accessibilityLabel={t('common.loading')} />
      ) : query.isError && !query.data ? (
        <View style={styles.status}>
          <AppText style={styles.center}>{t('common.somethingWentWrong')}</AppText>
          <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.retry}>
            <AppText variant="button">{t('common.retry')}</AppText>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <AppText style={[styles.status, styles.center]}>{t('mandir.offering.empty')}</AppText>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              pending={pendingItemId === item.id}
              locked={pendingItemId !== null}
              onPress={() => onOffer(item)}
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

function ItemCard({ item, pending, locked, onPress }: { item: OfferingItemView; pending: boolean; locked: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const name = pickLocalized(language, item.nameHi, item.nameEn);
  const free = item.coinCost === 0;
  const price = free ? t('mandir.offering.free') : t('mandir.offering.costA11y', { count: item.coinCost });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${price}`}
      accessibilityState={{ disabled: locked, busy: pending }}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [styles.card, !free && styles.cardPremium, (pressed || (locked && !pending)) && styles.pressed]}
    >
      <View style={styles.iconBox}>
        <Image source={{ uri: item.iconUrl }} style={styles.icon} contentFit="contain" cachePolicy="memory-disk" />
        {pending && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.maroon} />}
      </View>
      <AppText variant="caption" style={styles.name} numberOfLines={2}>
        {name}
      </AppText>
      {free ? (
        <View style={[styles.price, styles.priceFree]}>
          <AppText variant="caption" style={styles.priceFreeText}>
            {t('mandir.offering.free')}
          </AppText>
        </View>
      ) : (
        <View style={[styles.price, styles.pricePaid]}>
          <MaterialCommunityIcons name="circle-multiple" size={12} color={colors.maroon} />
          <AppText variant="caption" style={styles.pricePaidText}>
            {item.coinCost}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  balance: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  balanceText: { color: colors.maroon },
  status: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
  retry: {
    minHeight: MIN_TAP_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm, gap: spacing.sm, justifyContent: 'flex-start' },
  card: {
    width: '31%',
    minHeight: 132,
    alignItems: 'center',
    padding: spacing.sm,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPremium: { borderColor: colors.gold, borderWidth: 1.5 },
  pressed: { opacity: 0.55 },
  iconBox: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 56, height: 56 },
  name: { textAlign: 'center', color: colors.maroon, fontSize: 13, lineHeight: 19 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
  priceFree: { backgroundColor: 'rgba(224, 122, 31, 0.12)' },
  priceFreeText: { color: colors.saffron, fontSize: 12, lineHeight: 18 },
  pricePaid: { backgroundColor: colors.gold },
  pricePaidText: { color: colors.maroon, fontSize: 12, lineHeight: 18 },
});
