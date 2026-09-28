import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HomeThali } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from '@/theme';

import type { AartiLayout } from '../../aarti';
import { fullCircles, thaliAngle, thaliFlames, thaliPosition, unwrapDelta } from '../../animations/thali';
import { Flame } from '../offerings/Flame';

/** Thali starts at the bottom of the circle (in front of the devotee's hands). */
const START_ANGLE = Math.PI / 2;

/**
 * VM-06 thali (§4.3): drag in a circle (Pan on the UI thread; the thali follows the finger's angle
 * around P, cumulative rotation counts full circles), or Auto (one clockwise circle per `autoPeriodMs`).
 * A soft glow on the deity follows the thali. Reports manual full circles via `onCircles`.
 */
export function AartiThali({
  geometry,
  height,
  thali,
  auto,
  autoPeriodMs,
  onCircles,
}: {
  geometry: AartiLayout;
  /** Height of the area that takes the drag (above the panel). */
  height: number;
  thali: HomeThali | null;
  auto: boolean;
  autoPeriodMs: number;
  onCircles: (circles: number) => void;
}) {
  const { t } = useTranslation();
  const { center, radii, thaliSize } = geometry;
  const angle = useSharedValue(START_ANGLE);
  const last = useSharedValue(START_ANGLE);
  const cumulative = useSharedValue(0);

  useEffect(() => {
    if (!auto) return;
    // Clockwise on screen = increasing angle (y down), §4.3 withRepeat(withTiming(+2π, 3000ms, linear), -1).
    angle.set(withRepeat(withTiming(angle.get() + Math.PI * 2, { duration: autoPeriodMs, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(angle);
      last.set(angle.get());
    };
  }, [angle, auto, autoPeriodMs, last]);

  useAnimatedReaction(
    () => fullCircles(cumulative.get()),
    (circles, prev) => {
      if (circles !== prev) scheduleOnRN(onCircles, circles);
    },
  );

  const pan = Gesture.Pan()
    .enabled(!auto)
    .withTestId('aarti-thali-pan')
    .minDistance(0)
    .onBegin((e) => {
      last.set(thaliAngle({ x: e.x, y: e.y }, center, radii));
      angle.set(last.get());
    })
    .onUpdate((e) => {
      const a = thaliAngle({ x: e.x, y: e.y }, center, radii);
      cumulative.set(cumulative.get() + unwrapDelta(last.get(), a));
      last.set(a);
      angle.set(a);
    });

  const thaliStyle = useAnimatedStyle(() => {
    const p = thaliPosition(center, radii, angle.get());
    return { transform: [{ translateX: p.x - thaliSize / 2 }, { translateY: p.y - thaliSize / 2 }] };
  });
  const glowSize = thaliSize * 2.6;
  const glowStyle = useAnimatedStyle(() => {
    const p = thaliPosition(center, radii, angle.get());
    // Between the thali and P: the light falls on the deity in front of the thali.
    return { transform: [{ translateX: (p.x + center.x) / 2 - glowSize / 2 }, { translateY: (p.y + center.y) / 2 - glowSize / 2 }] };
  });

  const flames = thaliFlames(thali?.flameStyle ?? 'single');
  const flameSize = flames.length > 1 ? thaliSize * 0.16 : thaliSize * 0.26;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.area, { height }]} testID="aarti-stage">
        <Animated.View pointerEvents="none" style={[styles.glow, { width: glowSize, height: glowSize, borderRadius: glowSize / 2 }, glowStyle]}>
          <View style={[styles.glowInner, { width: glowSize * 0.6, height: glowSize * 0.6, borderRadius: glowSize * 0.3 }]} />
        </Animated.View>
        <Animated.View
          style={[styles.thali, { width: thaliSize, height: thaliSize, borderRadius: thaliSize / 2 }, thaliStyle]}
          accessible
          accessibilityLabel={t('mandir.aartiMode.thali')}
          accessibilityHint={auto ? undefined : t('mandir.aartiMode.thaliHint')}
          testID="aarti-thali"
        >
          {thali ? (
            <Image source={{ uri: thali.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
          ) : (
            <MaterialCommunityIcons name="circle-slice-8" size={thaliSize * 0.9} color={colors.gold} />
          )}
          {flames.map((f, i) => (
            <Flame key={i} x={thaliSize / 2 + f.x * thaliSize} y={thaliSize / 2 + f.y * thaliSize + flameSize * 0.3} size={flameSize} />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  area: { position: 'absolute', left: 0, right: 0, top: 0 },
  glow: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(255, 190, 80, 0.16)', alignItems: 'center', justifyContent: 'center' },
  glowInner: { backgroundColor: 'rgba(255, 214, 120, 0.22)' },
  thali: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
});
