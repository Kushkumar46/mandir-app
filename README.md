# Mandir App (monorepo)

Start with `CLAUDE.md` and `docs/`. Toolchain decisions: `docs/decisions/0001-foundation-toolchain.md`.

## Prerequisites

Node ≥ 22.12, pnpm 12, Docker Desktop (running). For device builds: an Expo account (`npx eas-cli login`).

## First run

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/admin-web/.env.example apps/admin-web/.env.local
pnpm dev:infra          # postgres :5432, redis :6379, rustfs S3 :9000 (console :9001, rustfsadmin/rustfsadmin)
                        # buckets: media-public (public read) + media-private (signed URLs only)
pnpm db:migrate         # applies prisma/migrations
pnpm db:seed            # dev-user, dev-admin, remote config
pnpm dev:api            # http://localhost:4000/v1/health , /v1/config
pnpm dev:admin          # http://localhost:3000
pnpm dev:app            # Expo dev server (needs a development build on the phone/emulator)
```

Quality gates: `pnpm lint && pnpm typecheck && pnpm test`. API e2e (needs infra + seed):
`pnpm --filter @mandir/api test:e2e`.

## Dev auth (until the Auth module exists)

Send `X-Dev-User: dev-user` (or `dev-admin`, or a user UUID) to authenticate. Only works with
`DEV_AUTH=true`; the API refuses to start with DEV_AUTH in production.

## Mobile app

Uses development builds, not Expo Go:

```bash
cd apps/devotee-app
npx eas-cli build --profile development --platform android   # install the dev client once
pnpm dev:app                                                  # from repo root
```

Android emulator → set `API_URL=http://10.0.2.2:4000`; a physical phone → your PC's LAN IP.
App identity comes from env: `APP_NAME`, `APP_ID`, `API_URL` (see `apps/devotee-app/app.config.ts`).
Build profiles are in `apps/devotee-app/eas.json` (docs/03-build-and-release.md).

## Layout

```
apps/api          NestJS 12 (ESM) + Prisma 7 — core/ (config, prisma, auth, feature-flags, storage,
                  idempotency, errors, jobs, redis, health) and modules/ (feature modules)
apps/admin-web    Next.js 16 (App Router, Tailwind, React Query)
apps/devotee-app  Expo SDK 57 + Expo Router
packages/shared-types  zod schemas + types shared by all apps
packages/i18n          hi.json (default), en.json
packages/ui            theme tokens
```
