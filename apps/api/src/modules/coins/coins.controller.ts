import { Controller, Get } from '@nestjs/common';

import { AppException } from '../../core/errors/app.exception.js';

// Route stubs from docs/modules/01-virtual-mandir.md §7 "Coins". The RevenueCat webhook is added by T15.
@Controller('coins')
export class CoinsController {
  @Get('wallet')
  wallet() {
    throw AppException.notImplemented('T5');
  }

  @Get('transactions')
  transactions() {
    throw AppException.notImplemented('T5');
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
