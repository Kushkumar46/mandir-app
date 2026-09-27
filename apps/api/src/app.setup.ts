import type { INestApplication } from '@nestjs/common';

import { AppConfigService } from './core/config/config.module.js';

export const API_PREFIX = 'v1';

/** App-level settings shared by main.ts and e2e tests. */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: config.env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();
}
