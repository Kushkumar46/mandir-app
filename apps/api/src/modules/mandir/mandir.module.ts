import { Module } from '@nestjs/common';

import { CoinsModule } from '../coins/coins.module.js';
import { ImagesModule } from '../images/images.module.js';
import { StreaksModule } from '../streaks/streaks.module.js';
import { DeitiesController } from './deities.controller.js';
import { MandirController } from './mandir.controller.js';
import { MandirService } from './mandir.service.js';
import { RitualsService } from './rituals.service.js';
import { ThalisService } from './thalis.service.js';

@Module({
  imports: [CoinsModule, ImagesModule, StreaksModule],
  controllers: [MandirController, DeitiesController],
  providers: [MandirService, RitualsService, ThalisService],
  exports: [MandirService, RitualsService, ThalisService],
})
export class MandirModule {}
