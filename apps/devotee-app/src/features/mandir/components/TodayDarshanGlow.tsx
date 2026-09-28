import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, colors, radius, spacing } from '@/theme';

import type { MandirLayout } from '../layout';

/** Fade in, hold, fade out (ms). A fade is not motion, so it also plays under "reduce motion". */
export const GLOW_TIMING = { in: 700, hold: 2000, out: 1300 } as const;
const RINGS = 6;

/**
 * VM-01 first visit of the day: a soft golden glow over the deity and an "आज का दर्शन" chip, shown
 * once and then gone. Concentric translucent circles fake a radial gradient without a native canvas.
 */
export function TodayDarshanGlow({ layout, onDone }: { layout: MandirLayout; onDone: () => void }) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);

  useEffect(() => {
    const cfg = { easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.Never };
    opacity.value = withSequence(
      withTiming(1, { duration: GLOW_TIMING.in, ...cfg }),
      withDelay(GLOW_TIMING.hold, withTiming(0, { duration: GLOW_TIMING.out, ...cfg }), ReduceMotion.Never),
    );
    const timer = setTimeout(onDone, GLOW_TIMING.in + GLOW_TIMING.hold + GLOW_TIMING.out);
    return () => clearTimeout(timer);
  }, [opacity, onDone]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const { arch } = layout;
  const maxR = arch.width * 0.62;
  const cx = arch.x + arch.width / 2;
  const cy = arch.y + arch.height * 0.36;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]} testID="today-darshan-glow">
      {Array.from({ length: RINGS }, (_, i) => {
        const r = maxR * (1 - i / RINGS);
        return (
          <View
            key={i}
            style={[styles.ring, { left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: r }]}
          />
        );
      })}
      <View style={[styles.chip, { top: arch.y + spacing.sm }]}>
        <AppText variant="caption" style={styles.chipText}>
          ✨ {t('mandir.todayDarshan')} ✨
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', backgroundColor: '#FFD27A', opacity: 0.1 },
  chip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(107, 30, 30, 0.78)',
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.gold },
});
