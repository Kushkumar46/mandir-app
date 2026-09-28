import { Image } from 'expo-image';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Rect, SpriteSpot } from '../../layout';
import { Flame } from './Flame';

/**
 * Single-sprite offering animations (§4.4 + the T12 keys). Each calls `onDone` after its duration;
 * durations are exported so tests and the effects layer agree. Under "reduce motion" Reanimated
 * jumps to the end state (the result appears without movement); fades still play.
 */
export const SPRITE_ANIMATION_MS = {
  mala: 1300,
  diya: 1300,
  bhog: 900,
  tilak: 3600,
  drape: 4800,
  pop: 2000,
} as const;

function useDone(ms: number, onDone: () => void) {
  useEffect(() => {
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [ms, onDone]);
}

const fadeCfg = { reduceMotion: ReduceMotion.Never } as const;

function Sprite({ uri, size }: { uri: string; size: number }) {
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" />;
}

/** Mala slides down from above the scene onto the deity's neck anchor (§4.4). `at` = anchor. */
export function MalaDrop({ uri, at, size, onDone }: { uri: string; at: { x: number; y: number }; size: number; onDone: () => void }) {
  const drop = useSharedValue(0);
  useEffect(() => {
    drop.set(withTiming(1, { duration: 1100, easing: Easing.out(Easing.back(1.3)) }));
  }, [drop]);
  useDone(SPRITE_ANIMATION_MS.mala, onDone);

  const top = at.y - size * 0.2;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - drop.value) * -(top + size) }] }));
  return (
    <Animated.View style={[styles.abs, { left: at.x - size / 2, top, width: size, height: size }, style]} testID="anim-mala">
      <Sprite uri={uri} size={size} />
    </Animated.View>
  );
}

/** Diya (or the five lamps of pancha-deep) appears at the feet and lights up, one after another. */
export function DiyaLight({ uri, spots, onDone }: { uri: string; spots: SpriteSpot[]; onDone: () => void }) {
  useDone(SPRITE_ANIMATION_MS.diya + (spots.length - 1) * 150, onDone);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="anim-diya">
      {spots.map((spot, i) => (
        <Lamp key={i} uri={uri} spot={spot} delay={i * 150} />
      ))}
    </View>
  );
}

function Lamp({ uri, spot, delay }: { uri: string; spot: SpriteSpot; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.6)) })));
  }, [grow, delay]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, grow.value * 2), transform: [{ scale: grow.value }] }));
  return (
    <>
      <Animated.View style={[styles.abs, spotBox(spot), style]}>
        <Sprite uri={uri} size={spot.size} />
      </Animated.View>
      <Delayed ms={delay + 350}>
        <Flame x={spot.x} y={spot.y - spot.size * 0.25} size={spot.size * 0.42} />
      </Delayed>
    </>
  );
}

/** Bhog is set down at the feet. */
export function BhogPlace({ uri, slot, onDone }: { uri: string; slot: Rect; onDone: () => void }) {
  const place = useSharedValue(0);
  useEffect(() => {
    place.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
  }, [place]);
  useDone(SPRITE_ANIMATION_MS.bhog, onDone);
  const style = useAnimatedStyle(() => ({ opacity: place.value, transform: [{ translateY: (1 - place.value) * -40 }] }));
  return (
    <Animated.View style={[styles.abs, abs(slot), style]} testID="anim-bhog">
      <Sprite uri={uri} size={slot.width} />
    </Animated.View>
  );
}

/** Sindoor / chandan tilak glows on the deity's forehead, then fades (specials are not kept for the day). */
export function Tilak({ at, color, height, onDone }: { at: { x: number; y: number }; color: string; height: number; onDone: () => void }) {
  const show = useFadeInHoldOut(600, 2200, 800);
  useDone(SPRITE_ANIMATION_MS.tilak, onDone);
  const w = Math.max(6, height * 0.32);
  return (
    <Animated.View style={[styles.abs, { left: at.x - height, top: at.y - height, width: height * 2, height: height * 2 }, styles.center, show]} testID="anim-tilak">
      <View style={[styles.halo, { width: height * 2, height: height * 2, borderRadius: height, backgroundColor: color }]} />
      <View style={{ width: w, height, borderRadius: w / 2, backgroundColor: color }} />
    </Animated.View>
  );
}

/** Chunari is draped from above over the deity's head and shoulders, then fades after a while. */
export function ChunariDrape({ uri, at, width, onDone }: { uri: string; at: { x: number; y: number }; width: number; onDone: () => void }) {
  const drop = useSharedValue(0);
  const show = useFadeInHoldOut(300, 3200, 900);
  useEffect(() => {
    drop.set(withTiming(1, { duration: 1300, easing: Easing.out(Easing.back(1.1)) }));
  }, [drop]);
  useDone(SPRITE_ANIMATION_MS.drape, onDone);
  const top = at.y - width * 0.25;
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - drop.value) * -(top + width) }] }));
  return (
    <Animated.View style={[styles.abs, { left: at.x - width / 2, top, width, height: width }, style, show]} testID="anim-drape">
      <Sprite uri={uri} size={width} />
    </Animated.View>
  );
}

/** Any other special offering: the sprite rises at the feet with a soft glow and fades. */
export function SpritePop({ uri, slot, onDone }: { uri: string; slot: Rect; onDone: () => void }) {
  const grow = useSharedValue(0);
  const show = useFadeInHoldOut(300, 1200, 500);
  useEffect(() => {
    grow.set(withTiming(1, { duration: 500, easing: Easing.out(Easing.back(2)) }));
  }, [grow]);
  useDone(SPRITE_ANIMATION_MS.pop, onDone);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }));
  return (
    <Animated.View style={[styles.abs, abs(slot), styles.center, style, show]} testID="anim-pop">
      <View style={[styles.halo, { width: slot.width, height: slot.width, borderRadius: slot.width / 2, backgroundColor: '#FFD27A' }]} />
      <Sprite uri={uri} size={slot.width} />
    </Animated.View>
  );
}

function useFadeInHoldOut(inMs: number, holdMs: number, outMs: number) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(
      withSequence(
        withTiming(1, { duration: inMs, ...fadeCfg }),
        withDelay(holdMs, withTiming(0, { duration: outMs, ...fadeCfg }), ReduceMotion.Never),
      ),
    );
  }, [opacity, inMs, holdMs, outMs]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** Renders children after `ms` (a lamp's flame lights once the lamp is in place). */
function Delayed({ ms, children }: { ms: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withDelay(ms, withTiming(1, { duration: 200, ...fadeCfg }), ReduceMotion.Never));
  }, [opacity, ms]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

const abs = (r: Rect) => ({ left: r.x, top: r.y, width: r.width, height: r.height });
export const spotBox = (s: SpriteSpot) => ({ left: s.x - s.size / 2, top: s.y - s.size / 2, width: s.size, height: s.size });

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', opacity: 0.25 },
});
