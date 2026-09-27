import { colors, fontSize, spacing } from '@mandir/ui';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

/** Foundation placeholder. Replaced by the (tabs) layout in Virtual Mandir T8. */
export default function Index() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('home.welcome')}</Text>
      <Text style={styles.body}>{t('home.comingSoon')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cream,
  },
  title: { fontSize: fontSize.xxl, color: colors.maroon, fontWeight: '700' },
  body: { marginTop: spacing.md, fontSize: fontSize.lg, color: colors.text, textAlign: 'center' },
});
