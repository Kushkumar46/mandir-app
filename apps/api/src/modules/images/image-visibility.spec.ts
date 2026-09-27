import type { ImageStatus } from '@mandir/shared-types';

import { canUseImage, pickDeityImage } from './image-visibility.js';

const OWNER = 'owner';
const OTHER = 'other';
const DEITY = 'deity-1';

const img = (id: string, status: ImageStatus, uploadedById: string | null = OWNER, deityId = DEITY) => ({
  id,
  status,
  uploadedById,
  deityId,
});

describe('canUseImage (§6.2 visibility table)', () => {
  it.each([
    ['PROCESSING', true, false],
    ['AUTO_REJECTED', false, false],
    ['PENDING', true, false],
    ['PRIVATE', true, false],
    ['PUBLIC', true, true],
    ['REJECTED', false, false],
    ['REMOVED', false, false],
  ] as const)('%s → owner %s, others %s', (status, owner, others) => {
    expect(canUseImage({ status, uploadedById: OWNER }, OWNER)).toBe(owner);
    expect(canUseImage({ status, uploadedById: OWNER }, OTHER)).toBe(others);
  });

  it('official images (no uploader) are usable only when PUBLIC', () => {
    expect(canUseImage({ status: 'PUBLIC', uploadedById: null }, OWNER)).toBe(true);
    expect(canUseImage({ status: 'PRIVATE', uploadedById: null }, OWNER)).toBe(false);
  });
});

describe('pickDeityImage (§6.2 resolution order)', () => {
  const featured = img('featured', 'PUBLIC', OTHER);
  const deityDefault = img('default', 'PUBLIC', null);

  it('prefers the user selection when still usable', () => {
    const selected = img('mine', 'PRIVATE');
    expect(pickDeityImage(DEITY, OWNER, { selected, featured, deityDefault })?.id).toBe('mine');
  });

  it('falls back to featured when the selection left PUBLIC or is not visible to the user', () => {
    expect(pickDeityImage(DEITY, OWNER, { selected: img('s', 'REJECTED'), featured, deityDefault })?.id).toBe('featured');
    expect(pickDeityImage(DEITY, OTHER, { selected: img('s', 'PRIVATE'), featured, deityDefault })?.id).toBe('featured');
    expect(pickDeityImage(DEITY, OTHER, { selected: img('s', 'REMOVED'), featured, deityDefault })?.id).toBe('featured');
  });

  it('ignores a selection of another deity', () => {
    const selected = img('s', 'PUBLIC', OTHER, 'deity-2');
    expect(pickDeityImage(DEITY, OWNER, { selected, featured, deityDefault })?.id).toBe('featured');
  });

  it('falls back to the deity default, then to null (bundled fallback)', () => {
    expect(pickDeityImage(DEITY, OWNER, { selected: null, featured: null, deityDefault })?.id).toBe('default');
    expect(
      pickDeityImage(DEITY, OWNER, { selected: null, featured: null, deityDefault: img('d', 'REMOVED', null) }),
    ).toBeNull();
    expect(pickDeityImage(DEITY, OWNER, { selected: null, featured: null, deityDefault: null })).toBeNull();
  });
});
