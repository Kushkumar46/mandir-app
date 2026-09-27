/**
 * Idempotent seed (safe to run repeatedly). Foundation data only:
 * dev users for the DEV_AUTH stub and the remote-config flag row.
 * Module seed data (deities, offerings, coin packs, module flags …) is added by module tasks.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { REMOTE_CONFIG_FLAG_KEY } from '@mandir/shared-types';

import { DEV_USERS } from '../src/core/auth/dev-users.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  for (const user of Object.values(DEV_USERS)) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, role: user.role },
      create: { id: user.id, name: user.name, role: user.role },
    });
  }

  await prisma.featureFlag.upsert({
    where: { key: REMOTE_CONFIG_FLAG_KEY },
    // Don't overwrite values an admin may have edited.
    update: {},
    create: {
      key: REMOTE_CONFIG_FLAG_KEY,
      enabled: true,
      description: 'Remote config values returned by GET /v1/config (not a feature switch).',
      payload: { minSupportedAppVersion: '1.0.0', supportWhatsapp: null },
    },
  });

  console.log('Seed complete: dev users + remote config.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
