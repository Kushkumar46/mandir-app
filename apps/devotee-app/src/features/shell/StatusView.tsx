import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/client';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

type Props =
  | { state: 'loading' }
  | { state: 'error'; error: unknown; onRetry?: () => void }
  | { state: 'message'; message: string };

/** Full-area loading / error / message placeholder with a large retry button. */
export function StatusView(props: Props) {
  const { t } = useTranslation();
  if (props.state === 'loading') {
    return (
      <View style={styles.container} accessibilityLabel={t('common.loading')}>
        <ActivityIndicator size="large" color={colors.saffron} />
      </View>
    );
  }
  if (props.state === 'message') {
    return (
      <View style={styles.container}>
        <AppText variant="bodyLarge" style={styles.center}>
          {props.message}
        </AppText>
      </View>
    );
  }
  const network = props.error instanceof ApiError && props.error.isNetworkError;
  return (
    <View style={styles.container}>
      <AppText variant="bodyLarge" style={styles.center}>
        {network ? t('common.serverUnreachable') : t('common.somethingWentWrong')}
      </AppText>
      {props.onRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <AppText variant="button">{t('common.retry')}</AppText>
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
    gap: spacing.lg,
    backgroundColor: colors.cream,
  },
  center: { textAlign: 'center' },
  button: {
    minHeight: MIN_TAP_TARGET,
    minWidth: 160,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
