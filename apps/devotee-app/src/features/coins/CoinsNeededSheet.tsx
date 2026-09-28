import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/features/shell/BottomSheet';
import { showToast } from '@/features/shell/Toast';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

/**
 * Placeholder for VM-07 (coin packs come with T15): shown when a premium offering costs more coins
 * than the user has — "आपको X सिक्के और चाहिए".
 */
export function CoinsNeededSheet({ short, balance, onClose }: { short: number; balance: number; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <BottomSheet title={t('coins.neededTitle')} onClose={onClose} testID="coins-needed-sheet">
      <View style={styles.body}>
        <MaterialCommunityIcons name="circle-multiple" size={48} color={colors.gold} />
        <AppText variant="bodyLarge" style={styles.center}>
          {t('coins.needMore', { count: short })}
        </AppText>
        <AppText variant="caption" style={styles.center}>
          {t('coins.youHave', { count: balance })}
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => showToast(t('mandir.comingSoon'))} // VM-07 coin packs (T15)
          style={({ pressed }) => [styles.buy, pressed && styles.pressed]}
        >
          <AppText variant="button" style={styles.buyText}>
            {t('coins.buy')}
          </AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  center: { textAlign: 'center', color: colors.maroon },
  buy: {
    alignSelf: 'stretch',
    minHeight: MIN_TAP_TARGET,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: { color: colors.white },
  pressed: { opacity: 0.7 },
});
