import { Global, Module } from '@nestjs/common';

import { ConfigController } from './config.controller.js';
import { FeatureFlagService } from './feature-flag.service.js';

@Global()
@Module({
  controllers: [ConfigController],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagsModule {}
