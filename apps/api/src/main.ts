import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { API_PREFIX, configureApp } from './app.setup.js';
import { AppConfigService } from './core/config/config.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const { PORT } = app.get(AppConfigService).env;
  await app.listen(PORT);
  Logger.log(`API listening on http://localhost:${PORT}/${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
