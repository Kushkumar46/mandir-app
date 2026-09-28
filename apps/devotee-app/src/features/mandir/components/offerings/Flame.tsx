import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * Small diya flame with a soft glow, flickering (scale 0.9–1.1, opacity 0.85–1, ~700 ms loop, §4.3).
 * Still under "reduce motion". `x`/`y` = the flame's base (the wick).
 */
export function Flame({ x, y, size }: { x: number; y: number; size: number }) {
  const reduceMotion = useReducedMotion();
  const flicker = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    // a slightly different period per flame so several lamps don't pulse in step
    const period = 600 + Math.round((x * 7 + y * 3) % 200);
    flicker.set(withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [flicker, reduceMotion, x, y]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * flicker.value,
    transform: [{ scale: 0.9 + 0.2 * flicker.value }],
  }));

  const w = size * 0.5;
  const h = size;
  return (
    <View pointerEvents="none" style={[styles.box, { left: x - size, top: y - h * 1.5, width: size * 2, height: h * 2 }]}>
      <View style={[styles.glow, { width: size * 2, height: size * 2, borderRadius: size }]} />
      <Animated.View style={[{ width: w, height: h, transformOrigin: 'bottom' }, style]}>
        <View style={[styles.outer, { borderTopLeftRadius: w, borderTopRightRadius: w, borderBottomLeftRadius: w / 2, borderBottomRightRadius: w / 2 }]} />
        <View style={[styles.inner, { left: w * 0.25, width: w * 0.5, height: h * 0.55, borderRadius: w / 2 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', backgroundColor: 'rgba(255, 196, 71, 0.22)' },
  outer: { ...StyleSheet.absoluteFill, backgroundColor: '#FF9A1F' },
  inner: { position: 'absolute', bottom: 0, backgroundColor: '#FFF1B8' },
});
