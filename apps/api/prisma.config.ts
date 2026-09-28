import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL is optional here so `prisma generate` (run by postinstall) works without a database,
// e.g. on EAS Build, which installs the whole monorepo for the app. Commands that connect
// (migrate, seed, studio) still fail with a clear error when it is missing.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(url && { datasource: { url } }),
});
