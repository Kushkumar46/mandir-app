import { Module } from '@nestjs/common';

import { StreaksController } from './streaks.controller.js';
import { StreaksService } from './streaks.service.js';

@Module({
  controllers: [StreaksController],
  providers: [StreaksService],
  exports: [StreaksService],
})
export class StreaksModule {}
