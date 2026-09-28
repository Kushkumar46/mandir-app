import { offeringsPayload } from '@/test/mandir-fixtures';

import { feetSprites, itemsOfKind } from './hooks/useOfferings';
import { coinsShort, decideOffering, displayTodayOfferings, offeringAnimation, rewardSummary } from './offerings';

describe('offeringAnimation (§4.4, §12 animation keys)', () => {
  it.each([
    ['falling_flowers', 'FLOWER', { type: 'particles', style: 'flowers' }],
    ['phool_varsha', 'FLOWER', { type: 'particles', style: 'shower' }],
    ['jal_abhishek', 'SPECIAL', { type: 'particles', style: 'drops' }],
    ['tel_abhishek', 'SPECIAL', { type: 'particles', style: 'drops' }],
    ['mala_drop', 'MALA', { type: 'mala' }],
    ['diya_light', 'DIYA', { type: 'diya', lamps: 1 }],
    ['pancha_deep', 'DIYA', { type: 'diya', lamps: 5 }],
    ['bhog_place', 'BHOG', { type: 'bhog' }],
    ['sindoor_tilak', 'SPECIAL', { type: 'tilak', color: expect.any(String) }],
    ['chandan_tilak', 'SPECIAL', { type: 'tilak', color: expect.any(String) }],
    ['chunari_drape', 'SPECIAL', { type: 'drape' }],
  ] as const)('%s', (animationKey, kind, expected) => {
    expect(offeringAnimation({ animationKey, kind })).toEqual(expected);
  });

  it('falls back by kind for keys the app does not know yet', () => {
    expect(offeringAnimation({ animationKey: 'new_admin_key', kind: 'FLOWER' })).toEqual({ type: 'particles', style: 'flowers' });
    expect(offeringAnimation({ animationKey: 'x', kind: 'MALA' })).toEqual({ type: 'mala' });
    expect(offeringAnimation({ animationKey: 'x', kind: 'DIYA' })).toEqual({ type: 'diya', lamps: 1 });
    expect(offeringAnimation({ animationKey: 'x', kind: 'BHOG' })).toEqual({ type: 'bhog' });
    expect(offeringAnimation({ animationKey: 'x', kind: 'SPECIAL' })).toEqual({ type: 'pop' });
  });
});

describe('decideOffering (VM-05)', () => {
  it('free items never need coins', () => {
    expect(decideOffering({ coinCost: 0 }, 0)).toEqual({ kind: 'free' });
    expect(decideOffering({ coinCost: 0 }, undefined)).toEqual({ kind: 'free' });
  });
  it('paid items go to the server when the last known balance covers them (or is unknown)', () => {
    expect(decideOffering({ coinCost: 5 }, 5)).toEqual({ kind: 'paid' });
    expect(decideOffering({ coinCost: 5 }, undefined)).toEqual({ kind: 'paid' });
  });
  it('paid items with too few coins open the coin sheet', () => {
    expect(decideOffering({ coinCost: 21 }, 4)).toEqual({ kind: 'insufficient', required: 21, balance: 4 });
    expect(coinsShort(21, 4)).toBe(17);
    expect(coinsShort(5, 9)).toBe(0);
  });
});

describe('displayTodayOfferings', () => {
  const before = { flowers: 10, mala: false, diya: false, bhog: false };
  const after = { flowers: 11, mala: true, diya: true, bhog: true };

  it('holds the animated kind at its value before the offering', () => {
    expect(displayTodayOfferings(after, { kind: 'FLOWER', before })).toEqual({ ...after, flowers: 10 });
    expect(displayTodayOfferings(after, { kind: 'MALA', before })).toEqual({ ...after, mala: false });
    expect(displayTodayOfferings(after, { kind: 'DIYA', before })).toEqual({ ...after, diya: false });
    expect(displayTodayOfferings(after, { kind: 'BHOG', before })).toEqual({ ...after, bhog: false });
    expect(displayTodayOfferings(after, { kind: 'SPECIAL', before })).toEqual(after);
  });

  it('shows the server state when nothing is animating', () => {
    expect(displayTodayOfferings(after, null)).toBe(after);
  });
});

describe('rewardSummary', () => {
  it('adds up the coins of every payout and lists new badges', () => {
    expect(
      rewardSummary({
        rewards: [
          { ruleKey: 'FIRST_DARSHAN_OF_DAY', coins: 1 },
          { ruleKey: 'STREAK_7', coins: 10 },
        ],
        badgesEarned: ['STREAK_7'],
      }),
    ).toEqual({ coins: 11, ruleKeys: ['FIRST_DARSHAN_OF_DAY', 'STREAK_7'], badges: ['STREAK_7'] });
    expect(rewardSummary({ rewards: [], badgesEarned: [] })).toEqual({ coins: 0, ruleKeys: [], badges: [] });
  });
});

describe('feet sprites', () => {
  const offerings = offeringsPayload();
  const item = (key: string) => offerings.groups.flatMap((g) => g.items).find((i) => i.nameEn === key)!;

  it('uses the free basic item of each kind by default', () => {
    expect(itemsOfKind(offerings, 'FLOWER').map((i) => i.nameEn)).toEqual(['Marigold', 'Rose']);
    expect(feetSprites(offerings, undefined)).toEqual({
      flower: item('Marigold').spriteUrl,
      mala: item('Marigold garland').spriteUrl,
      diya: item('Clay diya').spriteUrl,
      diyaLamps: 1,
      bhog: item('Mishri bhog').spriteUrl,
    });
  });

  it('uses what was last offered in this session (pancha-deep shows five lamps)', () => {
    const sprites = feetSprites(offerings, { FLOWER: item('Rose'), DIYA: item('Pancha-deep') });
    expect(sprites.flower).toBe(item('Rose').spriteUrl);
    expect(sprites.diya).toBe(item('Pancha-deep').spriteUrl);
    expect(sprites.diyaLamps).toBe(5);
  });

  it('has no sprites before the offerings load', () => {
    expect(feetSprites(undefined, undefined)).toEqual({ flower: null, mala: null, diya: null, diyaLamps: 1, bhog: null });
  });
});
