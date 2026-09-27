import { Module } from '@nestjs/common';

import { CoinsController } from './coins.controller.js';
import { CoinsService } from './coins.service.js';

@Module({
  controllers: [CoinsController],
  providers: [CoinsService],
  exports: [CoinsService],
})
export class CoinsModule {}
