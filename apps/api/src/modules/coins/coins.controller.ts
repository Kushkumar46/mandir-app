import { Controller, Get, Query } from '@nestjs/common';
import {
  type CoinTransaction,
  type CoinTransactionsQuery,
  coinTransactionsQuerySchema,
  type CoinWallet,
  type PaginatedResponse,
} from '@mandir/shared-types';

import { type AuthUser, CurrentUser } from '../../core/auth/auth.decorators.js';
import { AppException } from '../../core/errors/app.exception.js';
import { ZodValidationPipe } from '../../core/validation/zod-validation.pipe.js';
import { CoinsService } from './coins.service.js';

// docs/modules/01-virtual-mandir.md §7 "Coins". Packs, reward rules and the RevenueCat webhook are added by T15.
@Controller('coins')
export class CoinsController {
  constructor(private readonly coins: CoinsService) {}

  @Get('wallet')
  wallet(@CurrentUser() user: AuthUser): Promise<CoinWallet> {
    return this.coins.wallet(user.id);
  }

  @Get('transactions')
  transactions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(coinTransactionsQuerySchema)) query: CoinTransactionsQuery,
  ): Promise<PaginatedResponse<CoinTransaction>> {
    return this.coins.transactions(user.id, query);
  }

  @Get('packs')
  packs() {
    throw AppException.notImplemented('T15');
  }

  @Get('reward-rules')
  rewardRules() {
    throw AppException.notImplemented('T15');
  }
}
