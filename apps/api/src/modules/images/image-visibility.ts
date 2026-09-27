import type { ImageStatus } from '@mandir/shared-types';

/**
 * docs/modules/01-virtual-mandir.md §6.2 visibility table, for images a user may *use* in their mandir.
 * Everyone may use PUBLIC images. The owner may also use their own PROCESSING / PENDING / PRIVATE
 * images. REJECTED / REMOVED stay in "My uploads" only; AUTO_REJECTED is never shown.
 */
const OWNER_USABLE: ReadonlySet<ImageStatus> = new Set(['PROCESSING', 'PENDING', 'PRIVATE', 'PUBLIC']);

export function canUseImage(image: { status: ImageStatus; uploadedById: string | null }, userId: string): boolean {
  if (image.status === 'PUBLIC') return true;
  return image.uploadedById !== null && image.uploadedById === userId && OWNER_USABLE.has(image.status);
}

interface Candidate {
  deityId: string;
  status: ImageStatus;
  uploadedById: string | null;
}

/**
 * §6.2 resolution order: user's selected image (if still usable by them and of this deity)
 * → featured PUBLIC image → the deity's default image (if PUBLIC) → null (bundled fallback).
 */
export function pickDeityImage<T extends Candidate>(
  deityId: string,
  userId: string,
  candidates: { selected: T | null; featured: T | null; deityDefault: T | null },
): T | null {
  const { selected, featured, deityDefault } = candidates;
  if (selected && selected.deityId === deityId && canUseImage(selected, userId)) return selected;
  if (featured && featured.deityId === deityId && featured.status === 'PUBLIC') return featured;
  if (deityDefault && deityDefault.deityId === deityId && deityDefault.status === 'PUBLIC') return deityDefault;
  return null;
}
