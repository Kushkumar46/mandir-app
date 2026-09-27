import { Controller, Get } from '@nestjs/common';

import { AppException } from '../../core/errors/app.exception.js';

@Controller('me')
export class StreaksController {
  @Get('streak')
  streak() {
    throw AppException.notImplemented('T7');
  }
}
