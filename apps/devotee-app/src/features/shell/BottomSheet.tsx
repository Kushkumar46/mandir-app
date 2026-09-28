import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { AppText, colors, MIN_TAP_TARGET, radius, spacing } from '@/theme';

/**
 * Bottom sheet drawn over the current screen (render it last, inside an absolutely filled parent):
 * dimmed backdrop (tap closes), slides up, Android back closes, screen readers stay inside it.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  testID,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          importantForAccessibility="no-hide-descendants"
        />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(200)}
        style={styles.panel}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <AppText variant="title" style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </AppText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.close} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={24} color={colors.maroon} />
          </Pressable>
        </View>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(20, 8, 4, 0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 2,
    borderColor: colors.gold,
    paddingBottom: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  title: { flex: 1, color: colors.maroon },
  close: { width: MIN_TAP_TARGET, height: MIN_TAP_TARGET, alignItems: 'center', justifyContent: 'center' },
});
