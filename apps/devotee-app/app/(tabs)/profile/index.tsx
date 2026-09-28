import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@mandir/i18n';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/features/settings/store';
import { env } from '@/lib/env';
import { useLanguageStore } from '@/lib/language';
import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

const LANGUAGE_LABEL = { hi: 'profile.languageHi', en: 'profile.languageEn' } as const;

/** Profile tab shell: language switch, sound setting + app info. Account, streak and uploads come with later tasks. */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguageStore();
  const { startupShankh, setStartupShankh, aartiInSilentMode, setAartiInSilentMode } = useSettingsStore();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <AppText variant="heading">{t('profile.title')}</AppText>

      <View style={styles.section}>
        <AppText variant="title">{t('profile.language')}</AppText>
        <View style={styles.row}>
          {SUPPORTED_LANGUAGES.map((lang: SupportedLanguage) => {
            const selected = lang === language;
            return (
              <Pressable
                key={lang}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setLanguage(lang)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <AppText variant="button" style={{ color: selected ? colors.white : colors.maroon }}>
                  {t(LANGUAGE_LABEL[lang])}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="title">{t('profile.sound')}</AppText>
        <View style={styles.switchRow}>
          <AppText style={styles.switchLabel}>{t('profile.startupShankh')}</AppText>
          <Switch
            accessibilityLabel={t('profile.startupShankh')}
            value={startupShankh}
            onValueChange={setStartupShankh}
            trackColor={{ true: colors.saffron }}
          />
        </View>
        <View style={styles.switchRow}>
          <AppText style={styles.switchLabel}>{t('profile.aartiInSilentMode')}</AppText>
          <Switch
            accessibilityLabel={t('profile.aartiInSilentMode')}
            value={aartiInSilentMode}
            onValueChange={setAartiInSilentMode}
            trackColor={{ true: colors.saffron }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="title">{t('profile.appInfo')}</AppText>
        <AppText>
          {t('profile.version')}: {env.appVersion}
        </AppText>
        {env.appEnv !== 'production' && (
          <>
            <AppText>
              {t('profile.environment')}: {env.appEnv}
            </AppText>
            <AppText selectable>
              {t('profile.server')}: {env.apiUrl}
            </AppText>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.maroon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionSelected: { backgroundColor: colors.maroon },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TAP_TARGET },
  switchLabel: { flex: 1 },
});
