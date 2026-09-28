import type { DeityImageView, ImageVariantUrls } from '@mandir/shared-types';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { FALLBACK_DEITY_IMAGE } from '../assets';

type Props = {
  image: DeityImageView | null;
  variant: keyof ImageVariantUrls;
  accessibilityLabel?: string;
};

/**
 * Darshan image, `cover` inside its box: `card` shows first (placeholder), then the sharper
 * variant (§4.6). Null image or a load error → bundled fallback.
 */
export function DeityImage({ image, variant, accessibilityLabel }: Props) {
  // Keyed by image id so a new image gets a fresh chance to load.
  const [failedId, setFailedId] = useState<string | null>(null);
  const failed = !image || failedId === image.id;

  return (
    <Image
      source={failed ? FALLBACK_DEITY_IMAGE : { uri: image.urls[variant] }}
      placeholder={failed ? undefined : { uri: image.urls.card }}
      placeholderContentFit="cover"
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
      recyclingKey={image?.id ?? 'fallback'}
      onError={() => image && setFailedId(image.id)}
      style={StyleSheet.absoluteFill}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    />
  );
}
