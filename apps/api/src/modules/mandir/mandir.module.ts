import { Module } from '@nestjs/common';

import { DeitiesController } from './deities.controller.js';
import { MandirController } from './mandir.controller.js';
import { MandirService } from './mandir.service.js';

@Module({
  controllers: [MandirController, DeitiesController],
  providers: [MandirService],
  exports: [MandirService],
})
export class MandirModule {}
