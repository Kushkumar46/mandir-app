/**
 * `pnpm db:seed` entry point. Needs `pnpm dev:infra` (Postgres + RustFS buckets) and a migrated DB.
 * Idempotent — see prisma/seed/index.ts.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { AppConfigService } from '../src/core/config/config.module.js';
import { StorageService } from '../src/core/storage/storage.service.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { runSeed } from './seed/index.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const storage = new StorageService(new AppConfigService());

runSeed(prisma, storage)
  .then(() => console.log('Seed complete: dev users, remote config, Virtual Mandir content + placeholder media.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
