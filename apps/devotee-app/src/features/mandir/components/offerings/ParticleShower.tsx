import { Atlas, Canvas, rect, Skia, type SkImage, useRSXformBuffer } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { type Particle, particlesDuration, particleTransform } from '../../animations/particles';

/**
 * Decoded particle sprites, by URL. Skia draws from its own decoded images (not expo-image's cache),
 * so sprites are decoded when the offerings load — the first tap then starts without a download.
 */
const sprites = new Map<string, SkImage>();
const loading = new Map<string, Promise<SkImage | null>>();

function loadSprite(url: string): Promise<SkImage | null> {
  const cached = sprites.get(url);
  if (cached) return Promise.resolve(cached);
  let pending = loading.get(url);
  if (!pending) {
    pending = Skia.Data.fromURI(url)
      .then((data) => Skia.Image.MakeImageFromEncoded(data))
      .then((image) => {
        if (image) sprites.set(url, image);
        return image;
      })
      .catch(() => null)
      .finally(() => loading.delete(url));
    loading.set(url, pending);
  }
  return pending;
}

export function preloadParticleSprites(urls: readonly string[]) {
  for (const url of new Set(urls)) void loadSprite(url);
}

/** Longest wait for a sprite that is not decoded yet; after that the shower is skipped. */
const SPRITE_WAIT_MS = 2500;
/** Under "reduce motion" nothing falls; the pile simply updates. */
const REDUCED_MOTION_MS = 300;

/**
 * §4.4 falling offerings: one Skia `Atlas` draw call for all particles (≤ 30), transforms computed
 * on the UI thread from a single clock — no React renders while it plays. Mount with a new `key` per
 * offering; `onDone` fires once every particle has landed.
 */
export function ParticleShower({ particles, spriteUrl, onDone }: { particles: Particle[]; spriteUrl: string; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [image, setImage] = useState<SkImage | null>(() => sprites.get(spriteUrl) ?? null);
  const clock = useSharedValue(0);
  const durationS = useMemo(() => particlesDuration(particles), [particles]);

  // Sprite not decoded yet (first offering before the preload finished): wait for it, briefly.
  useEffect(() => {
    if (image || reduceMotion) return;
    let cancelled = false;
    const giveUp = setTimeout(onDone, SPRITE_WAIT_MS);
    void loadSprite(spriteUrl).then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        clearTimeout(giveUp);
        setImage(loaded);
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
    };
  }, [image, reduceMotion, spriteUrl, onDone]);

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(onDone, REDUCED_MOTION_MS);
      return () => clearTimeout(timer);
    }
    if (!image) return;
    clock.set(0);
    clock.set(withTiming(durationS, { duration: durationS * 1000, easing: Easing.linear }));
    const timer = setTimeout(onDone, durationS * 1000);
    return () => clearTimeout(timer);
  }, [image, reduceMotion, durationS, clock, onDone]);

  const w = image?.width() ?? 1;
  const h = image?.height() ?? 1;
  const spriteRects = useMemo(() => particles.map(() => rect(0, 0, w, h)), [particles, w, h]);
  const transforms = useRSXformBuffer(particles.length, (val, i) => {
    'worklet';
    const [scos, ssin, tx, ty] = particleTransform(particles[i], clock.value, w, h);
    val.set(scos, ssin, tx, ty);
  });

  if (!image || reduceMotion) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" testID="particle-shower">
      <Atlas image={image} sprites={spriteRects} transforms={transforms} />
    </Canvas>
  );
}
