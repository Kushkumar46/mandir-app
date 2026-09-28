import type { DarshanOutcome } from '@mandir/shared-types';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/features/shell/Toast';
import { track } from '@/lib/analytics';

import { rewardSummary } from '../offerings';

/**
 * Toast for the rewards and new badges of a darshan-day answer (offering, aarti): "🎉 +2 सिक्के मिले —
 * आरती सम्पन्न", "🏅 नया बैज: …". Nothing when the request paid nothing.
 */
export function useRewardToast() {
  const { t } = useTranslation();
  return (res: Pick<DarshanOutcome, 'rewards' | 'badgesEarned'>) => {
    const { coins, ruleKeys, badges } = rewardSummary(res);
    for (const badge of badges) track('streak_badge_earned', { badge });
    const parts: string[] = [];
    if (coins > 0) {
      const rule = ruleKeys.length === 1 ? t(`mandir.reward.rules.${ruleKeys[0]}`, { defaultValue: '' }) : '';
      parts.push(rule ? `${t('mandir.reward.coins', { count: coins })} — ${rule}` : t('mandir.reward.coins', { count: coins }));
    }
    for (const badge of badges) {
      parts.push(t('mandir.reward.badge', { name: t(`mandir.badges.${badge}`, { defaultValue: badge }) }));
    }
    if (parts.length) showToast(parts.join('\n'));
  };
}
