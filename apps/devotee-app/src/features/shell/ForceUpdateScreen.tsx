import Constants from 'expo-constants';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useRemoteConfig } from '@/features/config/flags';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

/** Shown when the app version is below `minSupportedAppVersion` (docs/01-architecture.md §4). */
export function ForceUpdateScreen() {
  const { t } = useTranslation();
  const remote = useRemoteConfig();
  const androidPackage = Constants.expoConfig?.android?.package;
  const shareLink = typeof remote?.shareAppLink === 'string' ? remote.shareAppLink : undefined;
  const storeUrl =
    Platform.OS === 'android' && androidPackage ? `market://details?id=${androidPackage}` : shareLink;

  return (
    <View style={styles.container}>
      <AppText variant="heading" style={styles.center}>
        {t('update.title')}
      </AppText>
      <AppText variant="bodyLarge" style={styles.center}>
        {t('update.body')}
      </AppText>
      {storeUrl && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(storeUrl)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <AppText variant="button">{t('update.cta')}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.cream,
  },
  center: { textAlign: 'center' },
  button: {
    marginTop: spacing.md,
    minHeight: MIN_TAP_TARGET,
    minWidth: 180,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
