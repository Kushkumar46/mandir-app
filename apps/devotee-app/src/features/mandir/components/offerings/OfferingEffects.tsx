import type { HomeDeity } from '@mandir/shared-types';
import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { createParticles } from '../../animations/particles';
import { anchorPoint, feetSlots, foreheadPoint, type MandirLayout, panchaDeepLayout, type SpriteSpot } from '../../layout';
import { type ActiveOffering, useOfferingStore } from '../../store/offerings';
import { ParticleShower } from './ParticleShower';
import { BhogPlace, ChunariDrape, DiyaLight, MalaDrop, SpritePop, Tilak } from './SpriteAnimations';

/**
 * Effects layer (§4.1 top): the offering animation that is playing for the deity on screen.
 * Pointer events pass through to the scene and controls.
 */
export function OfferingEffects({ layout, deity }: { layout: MandirLayout; deity: HomeDeity | null }) {
  const active = useOfferingStore((s) => s.active);
  const finish = useOfferingStore((s) => s.finish);
  const otherDeity = !!active && active.deityId !== deity?.id;
  // Switching deity ends the animation (its result shows when the user comes back).
  useEffect(() => {
    if (active && otherDeity) finish(active.id);
  }, [active, otherDeity, finish]);

  if (!active || !deity || active.deityId !== deity.id) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Effect key={active.id} active={active} layout={layout} deity={deity} />
    </View>
  );
}

function Effect({ active, layout, deity }: { active: ActiveOffering; layout: MandirLayout; deity: HomeDeity }) {
  const finish = useOfferingStore((s) => s.finish);
  const onDone = useCallback(() => finish(active.id), [finish, active.id]);
  const { animation, item } = active;
  const { arch, feet, stage } = layout;
  const anchor = deity.image?.anchor ?? null;
  const slots = feetSlots(feet);

  const particles = useMemo(() => {
    if (animation.type !== 'particles') return [];
    const head = foreheadPoint(arch, anchor);
    return createParticles({
      count: item.particleCount,
      style: animation.style,
      width: stage.x * 2 + stage.width,
      landing: slots.pile,
      source: { x: head.x, y: Math.max(0, head.y - arch.width * 0.2) },
      size: Math.max(20, Math.min(34, arch.width * 0.1)),
    });
    // one set of particles per offering (this component is keyed by the offering id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (animation.type) {
    case 'particles':
      return <ParticleShower particles={particles} spriteUrl={item.spriteUrl} onDone={onDone} />;
    case 'mala':
      return <MalaDrop uri={item.spriteUrl} at={anchorPoint(arch, anchor)} size={malaSize(layout)} onDone={onDone} />;
    case 'diya':
      return <DiyaLight uri={item.spriteUrl} spots={diyaSpots(layout, animation.lamps)} onDone={onDone} />;
    case 'bhog':
      return <BhogPlace uri={item.spriteUrl} slot={slots.bhog} onDone={onDone} />;
    case 'tilak':
      return <Tilak at={foreheadPoint(arch, anchor)} color={animation.color} height={Math.max(14, arch.width * 0.06)} onDone={onDone} />;
    case 'drape':
      return <ChunariDrape uri={item.spriteUrl} at={foreheadPoint(arch, anchor)} width={arch.width * 0.62} onDone={onDone} />;
    case 'pop':
      return <SpritePop uri={item.spriteUrl} slot={slots.pile} onDone={onDone} />;
  }
}

/** Mala size on the deity (same for the drop and the mala kept for the day). */
export const malaSize = (layout: MandirLayout) => Math.round(layout.arch.width * 0.32);

/** One diya in the diya slot, or pancha-deep's five lamps across the feet. */
export function diyaSpots(layout: MandirLayout, lamps: 1 | 5): SpriteSpot[] {
  if (lamps === 5) return panchaDeepLayout(layout.feet);
  const { diya } = feetSlots(layout.feet);
  return [{ x: diya.x + diya.width / 2, y: diya.y + diya.height / 2, size: diya.width, rotation: 0 }];
}
