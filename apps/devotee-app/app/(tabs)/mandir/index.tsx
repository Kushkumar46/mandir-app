import { MandirFlag } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMandirHomeQuery } from '@/api/mandir';
import { useFlag } from '@/features/config/flags';
import { StatusView } from '@/features/shell/StatusView';
import { pickLocalized, useLanguageStore } from '@/lib/language';
import { AppText, colors, radius, spacing } from '@/theme';

/**
 * VM-01 shell placeholder (T8): proves the API and CDN images load on the device.
 * The real layered Mandir Home replaces it in T9.
 */
export default function MandirScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const language = useLanguageStore((s) => s.language);
  const enabled = useFlag(MandirFlag.ENABLED);
  const home = useMandirHomeQuery(enabled);

  if (!enabled) return <StatusView state="message" message={t('mandir.disabled')} />;
  if (home.isPending) return <StatusView state="loading" />;
  if (!home.data) return <StatusView state="error" error={home.error} onRetry={() => void home.refetch()} />;

  const { today, deities, defaultDeityId, coins } = home.data;
  const deity = deities.find((d) => d.id === defaultDeityId) ?? deities[0];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={
        <RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} colors={[colors.saffron]} />
      }
    >
      <View style={styles.topRow}>
        <AppText variant="title">{t('mandir.todayDarshan')}</AppText>
        <View style={styles.coinPill}>
          <AppText variant="button" style={styles.coinText}>
            {t('mandir.coins', { count: coins.balance })}
          </AppText>
        </View>
      </View>
      <AppText variant="body" style={styles.tithi}>
        ॥ {today.tithiText} ॥
      </AppText>

      {deity && (
        <View style={styles.card}>
          {deity.image ? (
            <Image
              source={{ uri: deity.image.urls.card }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={250}
              accessibilityLabel={pickLocalized(language, deity.nameHi, deity.nameEn)}
            />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <AppText variant="heading" style={styles.center}>
            {pickLocalized(language, deity.nameHi, deity.nameEn)}
          </AppText>
        </View>
      )}

      <AppText variant="caption" style={styles.center}>
        {t('mandir.comingSoon')}
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coinPill: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  coinText: { color: colors.maroon },
  tithi: { textAlign: 'center', color: colors.maroon },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md },
  imageFallback: { backgroundColor: colors.border },
  center: { textAlign: 'center' },
});
