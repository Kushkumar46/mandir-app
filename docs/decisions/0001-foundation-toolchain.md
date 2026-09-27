# ADR 0001 — Foundation toolchain details

- **Status:** Accepted
- **Date:** 2026-09-27

## Context

While setting up the monorepo (Foundation), the latest stable versions of the fixed stack
(CLAUDE.md §3) turned out to have a few constraints the docs did not anticipate:

1. **NestJS 12 is ESM-only.** Its packages are `"type": "module"`; for ESM projects Nest recommends
   Vitest instead of Jest.
2. **Prisma 7** needs an explicit generator `output`, a `prisma.config.ts`, a driver adapter
   (`@prisma/adapter-pg`), and no longer loads `.env` or runs the seed automatically.
3. **TypeScript 7** (the native compiler) is `latest`, but ts-tooling (ts-jest, Nest CLI, typescript-eslint)
   still requires TypeScript ≤ 6.
4. **Expo / React Native with pnpm** is most reliable with a hoisted `node_modules` layout.
5. docs/01 §4 names remote config values (`minSupportedAppVersion`, …) but not where they are stored.

## Decision

| Topic | Decision |
|---|---|
| API module format | `apps/api` is an ES module project (`"type": "module"`, `module: nodenext`, `.js` suffix on relative imports). |
| API tests | **Vitest** (+ `unplugin-swc` for decorator metadata) instead of Jest; supertest for e2e. Mobile app tests stay on Jest (jest-expo). |
| API dev runner | `tsc-watch` (the Nest CLI needs Node ≥ 22.22.3; we don't depend on it). |
| Prisma | v7 with `prisma-client` generator → `apps/api/src/generated/prisma` (git-ignored), `@prisma/adapter-pg`, seed via `tsx`. |
| TypeScript | Pinned to `~6.0` across the repo until the ecosystem supports 7. |
| pnpm | `nodeLinker: hoisted` in `pnpm-workspace.yaml`. |
| Remote config storage | Reserved feature-flag row `app.remote_config`; its `payload` holds remote config values, merged over code defaults. No extra table. |
| Shared packages | `shared-types`, `i18n`, `ui` are compiled with `tsc` to CommonJS `dist/` so Node (CJS or ESM), Metro and Next can all consume them. |

## Consequences

- docs/01 §10 says "Vitest" for API tests.
- Admin can edit remote config through the same flags screen (payload editor).
- Revisit the TypeScript pin when ts-jest / typescript-eslint support TS 7.
