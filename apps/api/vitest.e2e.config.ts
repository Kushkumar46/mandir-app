import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Needs `pnpm dev:infra` running and a migrated + seeded database.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    setupFiles: ['dotenv/config'],
    fileParallelism: false,
  },
});
