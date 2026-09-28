import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, MIN_TAP_TARGET } from '@/theme';

import { BELL_SWING, BELL_SWING_MS, bellAngle } from '../animations/bell';
import type { BellSide } from '../bells';
import type { MandirLayout } from '../layout';

const textShadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } };

/** Two hanging bells left/right of the garbhagriha (§4.2). */
export function Bells({ layout, disabled, onRing }: { layout: MandirLayout; disabled: boolean; onRing: (side: BellSide) => void }) {
  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <SwingingBell key={side} side={side} layout={layout} disabled={disabled} onRing={onRing} />
      ))}
    </>
  );
}

/**
 * Chain + bell, rotating around the top of the chain. A tap restarts the damped swing; with the OS
 * "reduce motion" setting Reanimated skips the swing (sound and haptic still play).
 */
function SwingingBell({
  side,
  layout,
  disabled,
  onRing,
}: {
  side: BellSide;
  layout: MandirLayout;
  disabled: boolean;
  onRing: (side: BellSide) => void;
}) {
  const { t } = useTranslation();
  const { size, top, leftX, rightX } = layout.bells;
  // Seconds since the last strike (starts "finished" = at rest).
  const time = useSharedValue<number>(BELL_SWING.durationS);
  const swing = useAnimatedStyle(() => ({ transform: [{ rotate: `${bellAngle(time.value)}deg` }] }));

  const ring = () => {
    time.set(0);
    time.set(withTiming(BELL_SWING.durationS, { duration: BELL_SWING_MS, easing: Easing.linear }));
    onRing(side);
  };

  return (
    <Animated.View
      style={[styles.wrap, { left: side === 'left' ? leftX : rightX, width: size, height: top + size }, swing]}
      testID={`bell-${side}`}
    >
      <View style={[styles.chain, { height: top }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mandir.bell')}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={ring}
        hitSlop={8}
        style={[styles.bell, { width: size, height: size }]}
      >
        <MaterialCommunityIcons name="bell" size={size * 0.8} color={colors.gold} style={textShadow} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, alignItems: 'center', transformOrigin: 'top' },
  chain: { width: 2, backgroundColor: colors.gold, opacity: 0.8 },
  bell: { alignItems: 'center', justifyContent: 'center', minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET },
});
