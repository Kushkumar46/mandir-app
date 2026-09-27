# START HERE — Claude Code ke saath kaise shuru karein

## Step 0: Taiyari
1. Computer par Node.js (LTS), pnpm, Docker Desktop, Git aur Claude Code install karein.
2. Ek khaali folder banayein: `mandir-app`, usme `git init` karein.
3. Is zip ki saari files (`CLAUDE.md`, `START_HERE.md`, `docs/`) us folder me copy karein.
4. Us folder me terminal kholkar `claude` chalayein.

## Step 1: Foundation setup (pehla session)
Claude Code ko ye prompt dein:

```
Read CLAUDE.md and all files in docs/ (00 to 03). Then set up the monorepo exactly as
described in CLAUDE.md §4 and docs/01-architecture.md: pnpm + Turborepo, apps/api (NestJS +
Prisma), apps/admin-web (Next.js), apps/devotee-app (Expo with Expo Router, dev build),
packages/shared-types, packages/ui, packages/i18n, docker-compose (postgres, redis, minio),
core modules (config, prisma, DEV_AUTH stub, feature-flags + GET /v1/config, storage,
idempotency, errors), eas.json from docs/03, and the commands in CLAUDE.md §5.
Do not build any feature module yet. Show me the plan first, then implement step by step.
When done, update the status table in CLAUDE.md.
```

Check karein: `pnpm dev:infra`, `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:app` sab chal rahe hain.

## Step 2: Virtual Mandir (har task ek-ek karke)
```
Read CLAUDE.md and docs/modules/01-virtual-mandir.md. Implement only task T1 from §14.
Follow the acceptance criteria. Run lint, typecheck and tests. Then tick T1 in the doc
and stop.
```
Har baar sirf task number badlein (T2, T3 … T23). Har task ke baad app/API chala kar khud dekhein.

## Step 3: Pehli testing build
Jab T1 se T14 ho jayein:
```
eas build --profile preview --platform android   # APK link milega
eas build --profile preview --platform ios       # TestFlight (Apple Developer account chahiye)
```

## Achhi aadatein
- Ek session = ek task. Lamba session hone par naya session shuru karein; CLAUDE.md se context wapas mil jayega.
- Kuch alag chahiye to pehle doc badlein, phir Claude Code se code karwayein.
- Har task ke baad `git commit` karein, taaki galti hone par wapas ja sakein.
- Agla module doc (Auth + Onboarding) milte hi `docs/modules/` me daalein.
