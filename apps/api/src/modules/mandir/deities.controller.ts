import { Controller, Get } from '@nestjs/common';

import { AppException } from '../../core/errors/app.exception.js';

@Controller('deities')
export class DeitiesController {
  @Get()
  list() {
    throw AppException.notImplemented('T4');
  }

  @Get(':deityId/offerings')
  offerings() {
    throw AppException.notImplemented('T6');
  }

  @Get(':deityId/aartis')
  aartis() {
    throw AppException.notImplemented('T7');
  }
}
