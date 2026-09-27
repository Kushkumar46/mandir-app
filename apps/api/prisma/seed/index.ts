/**
 * Idempotent seed (safe to run repeatedly): Foundation data (dev users for the DEV_AUTH stub,
 * remote-config flag row) followed by module seeds. Used by `prisma/seed.ts` and the seed e2e test.
 */
import { REMOTE_CONFIG_FLAG_KEY } from '@mandir/shared-types';

import { DEV_USERS } from '../../src/core/auth/dev-users.js';
import type { StorageService } from '../../src/core/storage/storage.service.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { seedMandir } from './mandir.js';

export async function runSeed(prisma: PrismaClient, storage: StorageService): Promise<void> {
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

  await seedMandir(prisma, storage);
}
