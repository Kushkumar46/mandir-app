import { Global, Injectable, Module } from '@nestjs/common';

import { type Env, parseEnv } from './env.schema.js';

@Injectable()
export class AppConfigService {
  readonly env: Env = parseEnv(process.env);

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}

@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
