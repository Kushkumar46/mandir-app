import { Module } from '@nestjs/common';

import { CoinsController } from './coins.controller.js';
import { CoinsService } from './coins.service.js';
import { RewardsService } from './rewards.service.js';

@Module({
  controllers: [CoinsController],
  providers: [CoinsService, RewardsService],
  exports: [CoinsService, RewardsService],
})
export class CoinsModule {}
