import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ThaliView } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/features/shell/BottomSheet';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

const THUMB = 44;

/**
 * VM-06 thali picker (`mandir.thali_designs`, §6.8): a horizontal strip of designs. Unlocked ones
 * can be selected; locked ones show a lock and their coin cost (tap → unlock sheet or coin sheet).
 */
export function ThaliPicker({
  items,
  loading,
  onPick,
}: {
  items: ThaliView[] | undefined;
  loading: boolean;
  onPick: (thali: ThaliView) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);

  return (
    <View style={styles.wrap} testID="thali-picker">
      {loading && !items ? (
        <ActivityIndicator color={colors.gold} accessibilityLabel={t('common.loading')} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {(items ?? []).map((item) => {
            const name = pickLocalized(language, item.nameHi, item.nameEn);
            const locked = !item.unlocked;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={
                  locked ? t('mandir.thali.lockedA11y', { name, count: item.coinCost }) : name
                }
                accessibilityState={{ selected: item.selected }}
                onPress={() => onPick(item)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <View style={[styles.thumb, item.selected && styles.thumbSelected, locked && styles.thumbLocked]}>
                  <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" />
                  {locked && (
                    <View style={styles.lock}>
                      <MaterialCommunityIcons name="lock" size={14} color={colors.white} />
                    </View>
                  )}
                </View>
                {locked ? (
                  <View style={styles.cost}>
                    <MaterialCommunityIcons name="circle-multiple" size={10} color={colors.maroon} />
                    <AppText variant="caption" style={styles.costText}>
                      {item.coinCost}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" style={styles.name} numberOfLines={1}>
                    {name}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** "अनलॉक करें — X सिक्के" confirm sheet (§2 VM-06). A thali is bought once and kept forever (§6.8). */
export function UnlockThaliSheet({
  thali,
  balance,
  pending,
  onConfirm,
  onClose,
}: {
  thali: ThaliView;
  balance: number | undefined;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const name = pickLocalized(language, thali.nameHi, thali.nameEn);

  return (
    <BottomSheet title={t('mandir.thali.unlockTitle')} onClose={onClose} testID="unlock-thali-sheet">
      <View style={styles.sheet}>
        <Image source={{ uri: thali.imageUrl }} style={styles.sheetImage} contentFit="contain" cachePolicy="memory-disk" />
        <AppText variant="title" style={styles.center}>
          {name}
        </AppText>
        <AppText style={styles.center}>{t('mandir.thali.unlockBody')}</AppText>
        {balance !== undefined && (
          <AppText variant="caption" style={styles.center}>
            {t('coins.youHave', { count: balance })}
          </AppText>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending, busy: pending }}
          disabled={pending}
          onPress={onConfirm}
          style={({ pressed }) => [styles.cta, (pressed || pending) && styles.pressed]}
        >
          {pending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <AppText variant="button" style={styles.ctaText}>
              {t('mandir.thali.unlockCta', { count: thali.coinCost })}
            </AppText>
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 64, justifyContent: 'center' },
  strip: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  item: { width: 56, minHeight: MIN_TAP_TARGET, alignItems: 'center', gap: 2 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    borderColor: 'rgba(255, 246, 229, 0.35)',
    backgroundColor: 'rgba(43, 26, 16, 0.6)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbSelected: { borderColor: colors.gold, borderWidth: 3 },
  thumbLocked: { opacity: 0.75 },
  image: { width: THUMB - 6, height: THUMB - 6 },
  lock: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 8, 4, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cost: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 5 },
  costText: { color: colors.maroon, fontSize: 11, lineHeight: 16 },
  name: { color: colors.cream, fontSize: 11, lineHeight: 16 },
  sheet: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetImage: { width: 96, height: 96 },
  center: { textAlign: 'center', color: colors.maroon },
  cta: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.white },
  pressed: { opacity: 0.6 },
});
