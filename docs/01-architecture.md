# 01 — Architecture & Conventions

## 1. System overview

```
devotee-app (Expo)  ─┐
admin-web (Next.js) ─┼──▶  api (NestJS, /v1)  ──▶ PostgreSQL (Prisma)
partner-app (later) ─┘            │               Redis (cache, BullMQ jobs)
                                  │               S3/R2 + CDN (images, audio)
                                  ├──▶ RevenueCat (IAP webhooks)
                                  ├──▶ Moderation provider (image safety)
                                  └──▶ (later) Razorpay, FCM, WhatsApp, Agora/100ms
```

## 2. Backend structure (NestJS)

```
apps/api/src/
├── main.ts
├── app.module.ts
├── core/
│   ├── config/           # env loading + validation (zod)
│   ├── prisma/           # PrismaService
│   ├── auth/             # JwtAuthGuard, AdminGuard, @CurrentUser(), DEV_AUTH stub
│   ├── feature-flags/    # FeatureFlagService + @RequireFlag('key') guard
│   ├── storage/          # StorageService: presigned PUT/GET, CDN url builder
│   ├── idempotency/      # IdempotencyInterceptor (Redis-backed)
│   ├── errors/           # AppException, error codes, global filter
│   └── jobs/             # BullMQ setup
└── modules/
    ├── mandir/           # Phase 1
    ├── coins/            # Phase 1
    ├── images/           # Phase 1 (community darshan + moderation)
    ├── streaks/          # Phase 1
    └── admin/            # admin-only controllers, per module sub-folders
```

Each module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` (re-exporting zod schemas from shared-types), `*.spec.ts`, `README.md`.

## 3. API conventions

- Base path: `/v1`. Admin routes: `/v1/admin/...` (AdminGuard).
- JSON, camelCase fields.
- Success response: `{ "data": <payload> }`. Paginated: `{ "data": [...], "nextCursor": "..." | null }` (cursor pagination, default limit 20, max 50).
- Error response: `{ "error": { "code": "COINS_INSUFFICIENT", "message": "human readable", "details": {} } }` with proper HTTP status.
- Error codes are an enum in `packages/shared-types/src/errors.ts`.
- IDs: UUID v4 strings.
- Timestamps: ISO 8601 UTC. "Day" logic (streaks, daily reset) uses the user's timezone (default `Asia/Kolkata`).
- Money: integer paise. Coins: integer.
- Writes that spend coins/money or create orders require header `Idempotency-Key: <uuid>`. The interceptor stores the response for 24h in Redis; a repeat with the same key returns the stored response.
- Rate limiting via `@nestjs/throttler` (global default + per-route overrides stated in module docs).

## 4. Feature flags & remote config

Table `feature_flags` (key, enabled, rollout_percent, platforms, min_app_version, payload JSON).

- `GET /v1/config` returns all flags evaluated for the current user + app version + platform, plus remote config values (e.g. `supportWhatsapp`, `minSupportedAppVersion`).
- Remote config values are stored in the `payload` of the reserved flag row `app.remote_config` (merged over code defaults; see ADR 0001). The app sends `X-App-Version` and `X-Platform` headers so flags can be evaluated. Auth is optional on this route; anonymous callers get flags with `rollout_percent = 100` only.
- App fetches config at launch, caches it, refetches on foreground every 30 min. The last config is also saved on the device with the other offline data (Virtual Mandir T14, `apps/devotee-app/src/api/persist.ts`), so flags work on a cold start without internet. First launch with no internet and nothing saved → a bundled offline fallback config (only `mandir.enabled` on, everything else off) until the real config arrives (retried every 30 s and on foreground).
- Backend enforces flags with `@RequireFlag('mandir.community_upload')` on routes.
- Rollout: `hash(userId + key) % 100 < rollout_percent`.
- `minSupportedAppVersion` → app shows a force-update screen if below.

## 5. Auth (summary — full spec in 00-auth-onboarding.md)

- Phone OTP login (+ Google, + Sign in with Apple on iOS). JWT access token (15 min) + refresh token (30 days, rotated, stored hashed).
- Roles: `USER`, `ADMIN`, `MODERATOR` (later `PANDIT`, `ASTROLOGER`).
- App stores tokens in `expo-secure-store`.
- **DEV_AUTH stub:** when `DEV_AUTH=true` in the API env (never in production), header `X-Dev-User: <userId>` authenticates as that seeded user. Seed creates `dev-user` and `dev-admin`. Lets Virtual Mandir be built before the Auth module.

## 6. Storage & media

- Uploads: app requests `POST /v1/images/upload-url` → gets presigned PUT URL + `objectKey` → uploads directly to storage → calls submit endpoint with `objectKey`.
- **Two buckets** (public access is configured per bucket, not per folder — Cloudflare R2 works this way, so local storage does too; see ADR 0002):

  | Bucket | Prefixes | Access |
  |---|---|---|
  | `media-public` | `official/`, `community/public/`, `audio/`, `lyrics/`, `themes/` | Public read, served via CDN (R2 custom domain in prod) |
  | `media-private` | `community/pending/`, `home-mandir/` | **Never public.** Served only via short-lived signed GET URLs |

- An `objectKey` always includes its prefix (e.g. `community/pending/<uuid>.jpg`); `StorageService` picks the bucket from the prefix, so callers never pass bucket names.
- Pending/private images are served via short-lived signed GET URLs, never the public CDN path. On approval, a job copies the object from `media-private` (`community/pending/`) to `media-public` (`community/public/`) and generates variants.
- Bucket names come from env (`S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET`); each environment has its own pair. Local: RustFS in docker-compose (`pnpm dev:infra` creates both buckets and makes only `media-public` anonymously readable).
- `CDN_BASE_URL` is the public bucket's base URL; `S3_PUBLIC_ENDPOINT` (optional, defaults to `S3_ENDPOINT`) is the host put into presigned URLs handed to clients. Both differ from the API's own `S3_ENDPOINT` only in local dev on a real phone (LAN IP instead of `localhost`, set by `pnpm dev:lan`; see `docs/03-build-and-release.md` §5).
- Image variants (generated by a BullMQ job using `sharp`): `thumb` 240w, `card` 540w, `full` 1080w, `hd` 1440w, all WebP. API returns `{ thumb, card, full, hd }` URLs.
- Audio: AAC/M4A 128kbps. Lyrics: JSON timeline (see module doc).

## 7. Mobile app structure (Expo Router)

```
apps/devotee-app/
├── app/                      # routes
│   ├── _layout.tsx           # providers: QueryClient, i18n, theme, gesture root, audio
│   ├── (onboarding)/...
│   ├── (tabs)/_layout.tsx    # bottom tabs, visibility from flags
│   ├── (tabs)/mandir/index.tsx
│   ├── (tabs)/profile/...
│   └── (modals)/...          # sheets and full-screen flows
├── src/
│   ├── api/                  # typed API client (fetch wrapper + react-query hooks)
│   ├── features/config/      # useFlag / useRemoteConfig (from GET /v1/config)
│   ├── features/shell/       # config gate, force-update screen, loading/error views
│   ├── features/mandir/      # components, hooks, animations, store
│   ├── features/images/
│   ├── features/coins/
│   ├── lib/                  # audio, cache, analytics, haptics, share
│   └── theme/
└── assets/fallback/          # bundled fallback deity image + bell sound
```

State: server state in React Query; UI/session state in Zustand. No business logic in components — put it in hooks under `features/`.

## 8. Theme

Devotional palette: saffron `#E07A1F`, deep maroon `#6B1E1E`, gold `#D4A537`, cream `#FFF6E5`. Fonts: a Devanagari-friendly font (e.g. Noto Sans Devanagari / Mukta) for Hindi; large tap targets (min 48dp) — many users are older.

## 9. Analytics

Thin `track(event, props)` wrapper in `src/lib/analytics.ts` (provider chosen later — PostHog or Firebase Analytics). Event names are listed in each module doc. Never send personal data (phone, name) in events.

## 10. Testing

- API: unit tests for services (Vitest — NestJS 12 is ESM-only, see ADR 0001), e2e tests for critical routes (supertest + test DB).
- App: component tests for key logic (Jest + React Native Testing Library); animation logic lives in pure functions that are unit-tested.
- Critical paths that must have tests: coin spend + idempotency, IAP webhook crediting, moderation state machine, streak calculation.

## 11. Environments

`local` → `staging` → `production`. Separate DB, bucket pair (public + private), RevenueCat project environment, and EAS build profiles per environment. Secrets only in env vars / EAS secrets, never committed.
