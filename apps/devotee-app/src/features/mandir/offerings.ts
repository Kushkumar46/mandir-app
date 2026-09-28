import type { MakeOfferingResponse, OfferingItemView, OfferingKind, TodayOfferings } from '@mandir/shared-types';

import type { ParticleStyle } from './animations/particles';

/**
 * VM-05 offering rules and the §4.4 animation choice. Pure so they can be unit-tested; the sheet,
 * the offering hook and the effects layer use them.
 */

export type OfferingAnimation =
  | { type: 'particles'; style: ParticleStyle }
  | { type: 'mala' }
  | { type: 'diya'; lamps: 1 | 5 }
  | { type: 'bhog' }
  | { type: 'tilak'; color: string }
  | { type: 'drape' }
  | { type: 'pop' };

/** Animation keys the app knows (seed §12 incl. the T12 keys). Unknown keys fall back by kind. */
const BY_KEY: Record<string, OfferingAnimation> = {
  falling_flowers: { type: 'particles', style: 'flowers' },
  phool_varsha: { type: 'particles', style: 'shower' },
  jal_abhishek: { type: 'particles', style: 'drops' },
  tel_abhishek: { type: 'particles', style: 'drops' },
  mala_drop: { type: 'mala' },
  diya_light: { type: 'diya', lamps: 1 },
  pancha_deep: { type: 'diya', lamps: 5 },
  bhog_place: { type: 'bhog' },
  sindoor_tilak: { type: 'tilak', color: '#E0452B' },
  chandan_tilak: { type: 'tilak', color: '#EBCB8B' },
  chunari_drape: { type: 'drape' },
};

const BY_KIND: Record<OfferingKind, OfferingAnimation> = {
  FLOWER: { type: 'particles', style: 'flowers' },
  MALA: { type: 'mala' },
  DIYA: { type: 'diya', lamps: 1 },
  BHOG: { type: 'bhog' },
  SPECIAL: { type: 'pop' },
};

export function offeringAnimation(item: Pick<OfferingItemView, 'animationKey' | 'kind'>): OfferingAnimation {
  return BY_KEY[item.animationKey] ?? BY_KIND[item.kind];
}

/**
 * VM-05 tap: free → animate at once and log in the background; paid → call the API first, then
 * animate; paid with too few coins (by the last balance the server sent) → coin sheet. The server
 * re-checks the balance (402), so the app never decides the real balance.
 */
export type OfferingDecision =
  | { kind: 'free' }
  | { kind: 'paid' }
  | { kind: 'insufficient'; required: number; balance: number };

export function decideOffering(item: Pick<OfferingItemView, 'coinCost'>, balance: number | undefined): OfferingDecision {
  if (item.coinCost <= 0) return { kind: 'free' };
  if (balance !== undefined && balance < item.coinCost) return { kind: 'insufficient', required: item.coinCost, balance };
  return { kind: 'paid' };
}

/** "आपको X सिक्के और चाहिए". */
export function coinsShort(required: number, balance: number): number {
  return Math.max(0, required - balance);
}

/**
 * Today's offerings as the feet area shows them while an animation of `kind` plays: that kind stays
 * as it was before the offering, so the pile/mala/diya/bhog appear when the animation lands rather
 * than when the server answers.
 */
export function displayTodayOfferings(
  today: TodayOfferings,
  animating: { kind: OfferingKind; before: TodayOfferings } | null,
): TodayOfferings {
  if (!animating) return today;
  const { kind, before } = animating;
  switch (kind) {
    case 'FLOWER':
      return { ...today, flowers: Math.min(today.flowers, before.flowers) };
    case 'MALA':
      return { ...today, mala: before.mala };
    case 'DIYA':
      return { ...today, diya: before.diya };
    case 'BHOG':
      return { ...today, bhog: before.bhog };
    default:
      return today;
  }
}

/** Coins paid out by the request and the badges it first earned (for the reward toast). */
export function rewardSummary(res: Pick<MakeOfferingResponse, 'rewards' | 'badgesEarned'>) {
  return {
    coins: res.rewards.reduce((sum, r) => sum + r.coins, 0),
    ruleKeys: res.rewards.map((r) => r.ruleKey),
    badges: res.badgesEarned,
  };
}
