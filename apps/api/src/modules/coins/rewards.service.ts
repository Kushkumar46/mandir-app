import { Injectable } from '@nestjs/common';
import type { RewardGrant } from '@mandir/shared-types';

import { lockUser } from '../../core/prisma/user-lock.js';
import { addDays, zonedTime } from '../../core/time/local-date.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { CoinsService } from './coins.service.js';

const REWARD_REF_TYPE = 'reward_rule';

export interface RewardResult extends RewardGrant {
  /** Wallet balance after the credit. */
  balance: number;
}

/**
 * Reward rules (docs/modules/01-virtual-mandir.md §6.4). A rule with `dailyCap` pays at most that many
 * times per day in the user's timezone; a rule without one pays once per user. Payouts are ledger rows
 * (`reason REWARD`, `refType "reward_rule"`, `refId <rule key>`), which is also what the caps count.
 * The caller checks the `mandir.rewards` flag.
 */
@Injectable()
export class RewardsService {
  constructor(private readonly coins: CoinsService) {}

  /** Pays `ruleKey` inside `tx` if the rule is active and under its cap; otherwise null. */
  async grant(
    tx: Prisma.TransactionClient,
    userId: string,
    ruleKey: string,
    day: { localDate: string; timezone: string },
  ): Promise<RewardResult | null> {
    const rule = await tx.rewardRule.findUnique({ where: { key: ruleKey } });
    if (!rule?.isActive || rule.coins <= 0) return null;

    await lockUser(tx, userId);
    const cap = rule.dailyCap ?? 1;
    const paid = await tx.coinTransaction.count({
      where: {
        userId,
        reason: 'REWARD',
        refType: REWARD_REF_TYPE,
        refId: rule.key,
        ...(rule.dailyCap !== null && {
          createdAt: {
            gte: zonedTime(day.localDate, 0, day.timezone),
            lt: zonedTime(addDays(day.localDate, 1), 0, day.timezone),
          },
        }),
      },
    });
    if (paid >= cap) return null;

    const { balance } = await this.coins.credit(
      userId,
      rule.coins,
      { reason: 'REWARD', refType: REWARD_REF_TYPE, refId: rule.key },
      tx,
    );
    return { ruleKey: rule.key, coins: rule.coins, balance };
  }
}
