import { Module } from '@nestjs/common';

import { CoinsModule } from '../coins/coins.module.js';
import { ImagesModule } from '../images/images.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { DeitiesController } from './deities.controller.js';
import { MandirController } from './mandir.controller.js';
import { MandirService } from './mandir.service.js';

@Module({
  imports: [CoinsModule, ImagesModule, StreaksModule],
  controllers: [MandirController, DeitiesController],
  providers: [MandirService],
  exports: [MandirService],
})
export class MandirModule {}
