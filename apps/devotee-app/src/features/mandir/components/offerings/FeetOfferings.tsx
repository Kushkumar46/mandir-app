import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HomeDeity, TodayOfferings } from '@mandir/shared-types';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import type { FeetSprites } from '../../hooks/useOfferings';
import { anchorPoint, feetSlots, type MandirLayout, pileLayout, pileStage, type SpriteSpot } from '../../layout';
import { Flame } from './Flame';
import { diyaSpots, malaSize } from './OfferingEffects';
import { spotBox } from './SpriteAnimations';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Today's accumulated offerings (VM-01 feet area, §4.4): mala on the deity's neck anchor, the
 * flowers pile in 3 stages, the diya (or pancha-deep) lit for the day, bhog. Drawn with the offering
 * sprites; icons stand in until the deity's offerings have loaded.
 */
export function FeetOfferings({
  layout,
  deity,
  today,
  sprites,
}: {
  layout: MandirLayout;
  deity: HomeDeity;
  today: TodayOfferings;
  sprites: FeetSprites | null;
}) {
  const slots = feetSlots(layout.feet);
  const stage = pileStage(today.flowers);
  const mala = anchorPoint(layout.arch, deity.image?.anchor ?? null);
  const malaPx = malaSize(layout);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="feet-offerings">
      {today.mala && (
        <View style={[styles.abs, { left: mala.x - malaPx / 2, top: mala.y - malaPx * 0.2, width: malaPx, height: malaPx }]} testID="today-mala">
          <SpriteOrIcon uri={sprites?.mala} icon="necklace" size={malaPx} />
        </View>
      )}
      {pileLayout(stage, slots.pile).map((spot, i) => (
        <View key={i} style={[styles.abs, spotBox(spot), { transform: [{ rotate: `${spot.rotation}deg` }] }]} testID="pile-flower">
          <SpriteOrIcon uri={sprites?.flower} icon="flower" size={spot.size} color={i % 2 ? colors.gold : colors.saffron} />
        </View>
      ))}
      {today.diya &&
        diyaSpots(layout, sprites?.diyaLamps ?? 1).map((spot, i) => <LitDiya key={i} spot={spot} uri={sprites?.diya} />)}
      {today.bhog && (
        <View style={[styles.abs, { left: slots.bhog.x, top: slots.bhog.y, width: slots.bhog.width, height: slots.bhog.height }]} testID="today-bhog">
          <SpriteOrIcon uri={sprites?.bhog} icon="bowl-mix" size={slots.bhog.width} />
        </View>
      )}
    </View>
  );
}

function LitDiya({ spot, uri }: { spot: SpriteSpot; uri: string | null | undefined }) {
  return (
    <>
      <View style={[styles.abs, spotBox(spot)]} testID="today-diya">
        <SpriteOrIcon uri={uri} icon="oil-lamp" size={spot.size} />
      </View>
      <Flame x={spot.x} y={spot.y - spot.size * 0.25} size={spot.size * 0.42} />
    </>
  );
}

function SpriteOrIcon({ uri, icon, size, color = colors.gold }: { uri: string | null | undefined; icon: IconName; size: number; color?: string }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" />;
  return <MaterialCommunityIcons name={icon} size={size} color={color} />;
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
