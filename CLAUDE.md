# CLAUDE.md — Project Master Context

> Claude Code: read this file fully at the start of EVERY session. Then read the docs listed in "Read order" that are relevant to the task.

## 1. What we are building

A devotional (spiritual) mobile app for Android and iOS (working name: **Mandir App** — final name TBD, keep it configurable in `APP_NAME`).

Core idea: a user opens the app and does darshan and puja of their chosen deity in a **Virtual Mandir** — real temple photos (not AI images), offering flowers/mala/diya/bhog, doing aarti with a rotating thali while the aarti audio plays, ringing bells. Users can upload photos of real temples they visit; the admin approves them to make them public for everyone.

Later phases add: Panchang, devotional library/music, online Puja & Chadhava booking at real temples, hiring a Pandit, Astrologer chat/call, and a spiritual products Store.

Primary audience: Hindi-speaking devotees in India, many on low/mid-range Android phones. UI language default is Hindi, with English support.

## 2. Read order

1. `CLAUDE.md` (this file)
2. `docs/00-overview.md` — product scope, phases, roadmap
3. `docs/01-architecture.md` — system design, conventions, shared systems
4. `docs/02-database-overview.md` — all tables across modules
5. `docs/03-build-and-release.md` — building APK/AAB/IPA with EAS
6. `docs/modules/<NN>-<module>.md` — the module you are working on

## 3. Tech stack (fixed — do not change without an ADR in `docs/decisions/`)

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (strict mode) |
| Monorepo | pnpm workspaces + Turborepo |
| Mobile app | React Native with Expo (latest stable SDK), Expo Router, **development builds (not Expo Go)** |
| Mobile libs | react-native-reanimated, react-native-gesture-handler, @shopify/react-native-skia, expo-audio, expo-image, expo-haptics, expo-image-picker, expo-image-manipulator, expo-file-system, @tanstack/react-query, zustand, i18next + react-i18next, react-native-purchases (RevenueCat), react-native-view-shot, expo-sharing |
| Backend | NestJS, Prisma ORM, PostgreSQL, Redis + BullMQ (jobs) |
| Validation | zod schemas in `packages/shared-types`, used by app, admin and API |
| Admin panel | Next.js (App Router), Tailwind CSS, shadcn/ui, @tanstack/react-query |
| File storage | S3-compatible (Cloudflare R2 in prod, RustFS locally — ADR 0002) with presigned uploads; two buckets: `media-public` (CDN) + `media-private` (signed URLs only) |
| In-app purchases | RevenueCat (consumable coin packs) |
| Image moderation | Pluggable `ModerationProvider` interface (AWS Rekognition or Google Vision SafeSearch) |
| Builds | Expo EAS Build + EAS Submit |
| Local infra | docker-compose: postgres, redis, rustfs (S3) |

## 4. Repo structure

```
mandir-app/
├── CLAUDE.md
├── apps/
│   ├── devotee-app/      # Expo app (Android + iOS)
│   ├── admin-web/        # Next.js admin panel
│   ├── partner-app/      # (Phase 4) Pandit/Astrologer app — do not create yet
│   └── api/              # NestJS backend
│       └── src/
│           ├── core/     # config, prisma, auth guards, feature-flags, storage, errors, idempotency
│           └── modules/  # one folder per feature module
├── packages/
│   ├── shared-types/     # zod schemas + inferred TS types + API contracts
│   ├── ui/               # (mobile) theme tokens, shared components
│   └── i18n/             # translation JSON files: hi.json, en.json
├── docs/
│   ├── 00-overview.md … 03-build-and-release.md
│   ├── modules/          # detailed module specs
│   └── decisions/        # ADRs (architecture decision records)
├── docker-compose.yml
└── turbo.json
```

## 5. Commands (create these during setup)

```
pnpm install
pnpm dev:infra        # docker-compose up (postgres, redis, rustfs)
pnpm dev:api          # NestJS on :4000
pnpm dev:admin        # Next.js on :3000
pnpm dev:app          # Expo dev server
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # seed deities, offerings, aartis, coin packs, flags
pnpm lint && pnpm typecheck && pnpm test
```

## 6. Non-negotiable rules

1. **No hardcoded content in the app.** Deities, images, offerings, prices, aartis, texts shown to users, feature switches — all come from the API. The app only has fallback assets for offline/first launch.
2. **Coins and money are server-authoritative.** The app never calculates or stores the real balance. Every write that spends coins/money requires an `Idempotency-Key` header.
3. **Two separate currencies, never mixed:** `coins` (virtual, bought via Apple/Google IAP) and `rupee wallet` (Phase 3+, Razorpay). Coins are integers. Rupees are stored as integer **paise**.
4. **Every feature is behind a feature flag** (see `docs/01-architecture.md`). New modules ship "off" until enabled from admin.
5. **All user-facing strings go through i18n** (`packages/i18n`). Hindi is the default language.
6. **Shared types live in `packages/shared-types`.** Never duplicate a request/response type in app or admin.
7. **API is versioned:** all routes under `/v1`.
8. **Performance budget for the app:** Virtual Mandir must run at 60fps on a ₹10k Android phone. Max 30 simultaneous particles. Images served as WebP via CDN with size variants.
9. **User-uploaded images are never public without admin approval.**
10. Keep modules isolated: a module may import from `core` and `shared-types`, and may call another module only through that module's exported service.

## 7. How to work on a module

1. Read the module doc in `docs/modules/`.
2. Implement the **Build Tasks** section in order, one task at a time.
3. After each task: run lint, typecheck and tests; confirm the task's acceptance criteria.
4. Tick the task checkbox in the module doc.
5. If the implementation must differ from the doc, **update the doc first** (and add an ADR if it is an architectural change), then code.

## 8. Current status

| Phase | Module | Doc | Status |
|---|---|---|---|
| 1 | Foundation / project setup | docs/01-architecture.md, ADR 0001, ADR 0002 | Done (2026-09-27) — lint/typecheck/unit + e2e tests pass against local infra |
| 1 | Auth + Onboarding | docs/modules/00-auth-onboarding.md | Doc pending |
| 1 | Virtual Mandir + Community Darshan | docs/modules/01-virtual-mandir.md | Doc ready |
| 1 | Admin: Mandir content + Moderation | covered inside 01-virtual-mandir.md §10 | Doc ready |
| 2+ | Panchang, Library, Music, Notifications, Puja, Chadhava, Pandit, Jyotish, Store | — | Later |

Until the Auth module is built, use the `DEV_AUTH` stub described in `docs/01-architecture.md` §5.
