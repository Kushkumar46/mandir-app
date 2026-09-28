# Module 01 — Virtual Mandir + Community Darshan

Phase: **1** · Priority: **Highest** (this is the heart of the app) · Depends on: Foundation, Auth (use `DEV_AUTH` stub until Auth is built)

---

## 1. Purpose

The user opens the app and does darshan and puja of their chosen deity in a virtual mandir:

- sees a **real temple photo** of the deity (official, or community-uploaded and admin-approved, or their own),
- rings the bells, offers flowers / mala / diya / bhog / a deity-specific offering (e.g. sindoor for Hanuman ji),
- performs **aarti**: the thali circles in front of the deity (by finger or automatically) while the aarti audio plays with synced lyrics,
- keeps a daily **streak**, earns and spends **coins**, and shares an "Aaj ka Darshan" card on WhatsApp.

Users can **upload photos** of temples they visit. Uploads go through automatic checks, then an **admin moderation queue**; approved photos become available to everyone, credited to the uploader.

### Success metrics
Aarti completions per DAU · D7 retention · average streak · uploads/week · approval rate · shares/day · coin purchase conversion.

### In scope
Mandir screen, deity switching, Sangrah, darshan image chooser, offerings, aarti mode, bells, coins (IAP + spend + rewards), streaks, community upload + moderation + gallery + reporting, home-mandir photo, share card, admin screens for all of the above.

### Out of scope (later phases)
Push reminders (Phase 2 Notifications — leave hooks), Panchang details screen (Phase 2; Phase 1 shows only the tithi strip), real-temple chadhava linking (Phase 3), live darshan video.

---

## 2. Screens

Route prefix: `app/(tabs)/mandir/` and `app/(modals)/`. Screen IDs are used in tasks and analytics.

### VM-01 Mandir Home (main screen)

Layout, top to bottom (portrait only):

| Zone | Contents | Behaviour |
|---|---|---|
| Top bar | Profile avatar (→ Profile tab), day chip "मंगलवार दिव्य दर्शन", deity carousel (circular avatars of user's deities + "+" button), coin balance pill | Tap avatar in carousel → switch deity. "+" → VM-03 Sangrah. Coin pill → VM-07 |
| Garbhagriha | Layered deity scene (see §4.1), two hanging bells left/right | Tap bell → ring (§4.2). Long-press deity image → VM-04 Darshan chooser |
| Tithi strip | "॥ मंगलवार, भाद्रपद कृष्ण पक्ष चतुर्थी ॥" | Phase 1: static text from API. Tap → no-op (Phase 2 opens Panchang) |
| Offering rail (left, vertical) | Buttons: Phool, Mala, Diya, Bhog, Sangrah | Each opens VM-05 with that type |
| Bottom center | Aarti thali (the user's selected thali design, §6.8) | Tap → VM-06 Aarti mode |
| Bottom right | Deity-special offering badge (e.g. "सिंदूर चढ़ाएं" for Hanuman), "Listen" (music) button | Special → VM-05 filtered to `special`. Listen → play default aarti in background without entering aarti mode |
| Feet area | Today's accumulated offerings (flowers pile, mala on deity, lit diya) | Derived from today's `ritual_logs`; resets at local midnight |

States:
- **Loading:** shimmer over garbhagriha; bells and rail disabled.
- **Offline:** cached scene + cached aarti work; premium offerings, upload and gallery show "इंटरनेट से जुड़ें" toast.
- **Image failed:** show bundled fallback artwork for that deity (or generic diya scene).
- **First visit of the day:** soft shankh sound (if `mandir.startup_shankh_sound` and user setting allow) + "आज का दर्शन" subtle glow.

### VM-02 Deity switching (inside VM-01)
Horizontal carousel. Order = `user_deities.position`. Swipe on garbhagriha left/right also switches deity (cross-fade 250 ms). Default deity on open: user's pinned deity if any, else weekday deity (§6.1).

### VM-03 Sangrah (deity library)
Grid of all active deities (image + Hindi name). Toggle "मेरे मंदिर में" on/off. Drag-to-reorder list of the user's deities. Pin one deity (star). Min 1, max 12 deities in user's mandir.

### VM-04 Darshan chooser (bottom sheet)
For the current deity, 3 tabs:

| Tab | Source | Notes |
|---|---|---|
| आधिकारिक (Official) | `deity_images` where source=OFFICIAL, status=PUBLIC | |
| भक्तों के दर्शन (Community) | source=COMMUNITY, status=PUBLIC | Sort: Popular (use_count) / Newest. Card shows temple name, city, "📷 Ramesh" credit if `show_credit` |
| मेरी फ़ोटो (Mine) | uploaded_by = me, status ∈ PENDING, PRIVATE, PUBLIC | Status badge on each |

Tap image → preview → "मंदिर में लगाएं" → sets `user_deities.selected_image_id`. Button "+ नई फ़ोटो जोड़ें" → VM-08. Each community image has "⋯" → Report (VM-11).

### VM-05 Offering sheet (bottom sheet, one component for all types)
Props: `type` (FLOWER | MALA | DIYA | BHOG | SPECIAL). Shows `offering_items` for the current deity and type: image, name, coin cost or "निःशुल्क". Every kind has at least one free basic item; coins are only for premium (special) items, which show their coin cost. Tap:
- free → play animation immediately, log in background;
- paid & enough coins → call API, on success play animation;
- paid & not enough → VM-07 coin packs with "आपको X सिक्के और चाहिए".

Free offerings are **unlimited** (no daily limit). Only a technical throttle applies (§6.5); on 429 the app skips the log silently and keeps the animation. Rewards stay capped (§6.4), so repeated free offerings earn nothing extra.

### VM-06 Aarti mode (full-screen overlay on VM-01)
- Aarti selector (if deity has >1 aarti), play/pause, progress.
- Lyrics panel: 3 visible lines, current line highlighted, auto-scroll.
- Thali: drag in a circle, or "स्वतः" (Auto) toggle.
- Thali picker (with `mandir.thali_designs`, §6.8): horizontal strip of thali designs. Unlocked designs can be selected (`PUT /mandir/thali`). Locked designs show a lock + coin cost; tapping one opens an "अनलॉक करें — X सिक्के" confirm sheet (`POST /mandir/thalis/:id/unlock`), or VM-07 if coins are short. Selection persists across sessions and devices.
- Bell + shankh buttons usable during aarti.
- Close (X) → confirm if aarti not finished. Audio continues in background if user leaves the app.
- On completion (≥ 90% of audio played **and** thali moved ≥ 3 full circles, or Auto on): "आरती सम्पन्न 🙏" overlay, streak update, reward toast, "दर्शन शेयर करें" → VM-12.

### VM-07 Coins (screen)
Balance, coin packs (from RevenueCat offerings mapped to `coin_packs`), purchase button, restore note (consumables don't restore — show FAQ), transaction history (paged), "सिक्के कैसे कमाएं" (reward rules list).

### VM-08 Upload flow (full-screen stack)
- **08a Source:** Camera / Gallery (request permission with Hindi explanation).
- **08b Crop:** portrait 3:4 crop with a mandir-arch overlay guide. Reject if shorter side < 1080 px after crop ("फ़ोटो बहुत छोटी है"). Warn (not block) on blur (Laplacian variance check, optional).
- **08c Details:** Upload type: "किसी मंदिर की फ़ोटो" (community) or "मेरे घर का मंदिर" (home mandir, always private). Deity (preselected = current deity). Temple (search existing temples by name/city; or "नया मंदिर" with name + city; GPS suggestion if location permission granted — optional). Credit: show my name ✔/✖.
- **08d Consent** (community only, mandatory checkbox): "यह फ़ोटो मैंने स्वयं ली है। मैं ऐप को इसे दिखाने की अनुमति देता/देती हूँ।" + link to Terms.
- Submit → upload with progress → success screen: "आपकी फ़ोटो आपके मंदिर में लग गई है। सबके लिए दिखाने से पहले हमारी टीम इसे देखेगी।"

### VM-09 My uploads
List with status chips: समीक्षा में (Pending) · सबके लिए (Public) · सिर्फ़ आपके लिए (Private) · अस्वीकृत (Rejected + reason) · हटाई गई (Removed). Delete own upload (removes from public too). Counter: "आपके दर्शन X भक्तों ने अपने मंदिर में लगाए".

### VM-10 Community gallery
Reachable from VM-04 and from Profile. Filter by deity, temple, city. Infinite scroll. Temple header when filtered by temple.

### VM-11 Report sheet
Reasons: गलत भगवान / गलत मंदिर / अनुचित फ़ोटो / कॉपी की गई फ़ोटो / अन्य (text). One report per user per image.

### VM-12 Share card
Rendered offscreen with `react-native-view-shot` (1080×1920): deity image, deity name, tithi, "मैंने आज {deity} जी की आरती की 🙏", streak "🔥 X दिन", app name + download link/QR. Share via `expo-sharing` (WhatsApp appears in the system sheet). Also offered after completing offerings.

### VM-13 Streak & badges
Current / longest streak, calendar of the month (dots for darshan days), badges: 7, 21, 51, 108 days; "दर्शन सेवक" (first approved upload), "तीर्थ यात्री" (uploads from 5 different temples).

### VM-14 Home mandir
Upload type "मेरे घर का मंदिर" creates a private image (source=HOME_MANDIR) that the user can set for any deity or as a special "मेरा घर का मंदिर" entry in their carousel. Only auto safety check; never enters the admin public queue.

---

## 3. User flows

### 3.1 App open
1. `GET /v1/config` (flags) and `GET /v1/mandir/home` in parallel.
2. Render default deity (§6.1) with selected image (user selection → deity default image → fallback).
3. Prefetch images of all user deities (`card` + `hd`) and default aarti audio of the current deity.
4. `track('mandir_opened')`.

### 3.2 Offering (paid)
1. User opens VM-05, taps item (cost 5).
2. App calls `POST /v1/mandir/offerings` with `Idempotency-Key`.
3. Server in one DB transaction: check flag + item active + item valid for deity → lock wallet row → check balance → insert `coin_transactions(-5)` → update balance → insert `ritual_logs` → update streak (§6.3) → evaluate reward rules.
4. Response: new balance, streak, any reward granted, today's offerings summary.
5. App plays animation, updates balance pill, shows reward toast if any.

### 3.3 Aarti
Open VM-06 → audio starts → user circles thali → completion → `POST /v1/mandir/rituals/aarti-complete` → streak/reward → completion overlay → share prompt.

### 3.4 Community upload → public
1. `POST /v1/images/upload-url` → presigned PUT to `community/pending/{uuid}.jpg` (private bucket).
2. App uploads (compressed JPEG quality 0.85, max 2560 px long edge).
3. `POST /v1/images` with objectKey + metadata + consent.
4. Server creates `deity_images` status=PROCESSING and enqueues `image.process` job.
5. Job: generate variants, compute pHash, run moderation provider.
   - unsafe → status=AUTO_REJECTED (never visible, even to owner) + notify owner.
   - duplicate of an existing image (Hamming distance ≤ 6) → flag `possible_duplicate=true` (still goes to queue).
   - otherwise → status=PENDING (visible to owner only, usable in own mandir).
6. Admin in moderation queue: Approve public / Approve + Feature / Keep private / Reject(reason).
7. On public: copy from the private bucket to `community/public/` in the public bucket, rewards (§6.4), owner notified (in-app; push in Phase 2).

---

## 4. Interaction & animation specs

All animations with Reanimated worklets / Skia; pure math in `features/mandir/animations/*.ts` with unit tests.

### 4.1 Layered scene
Stack (bottom → top): `background` → `deity` → `frame` (arch, toran, pillars) → `effects` (diya glow, flowers pile, falling particles).
- Real temple photos (OFFICIAL photo or COMMUNITY) are a single full image placed in the deity layer with `contentFit="cover"` inside the arch mask; background layer then hidden.
- Artwork images may have transparent deity PNG + separate background.
- `frame` comes from the active `theme` (default theme; festival themes swap frame + colours).
- Frame contract (T9): a frame is a 9:16 image (seed: 1440×2560) whose transparent arch opening is the box x 12.5–87.5 %, y 14.0625–92.1875 % (seed: x 180–1260, y 360–2360); everything outside it is opaque. The app draws the scene on a 9:16 stage that covers the area between the top bar and the tab bar, and fits the deity image (`cover`) into that box, so every theme frame must keep this geometry (`FRAME` in `apps/devotee-app/src/features/mandir/layout.ts`). Theme colours used: `secondary` (outside the arch), `background` (inside the arch, behind transparent artwork).

### 4.2 Bells
Tap → play bell sound (low-latency, preloaded) + `Haptics.impactAsync(Medium)` + swing: rotate around top pivot, damped oscillation `angle(t) = 18° · e^(−3t) · sin(12t)` for 1.5 s. Rapid taps restart the swing and overlap sounds (max 3 concurrent players). Log `BELL` ritual at most once per minute (analytics, not billing).

### 4.3 Aarti thali
- Thali centre moves on a circle (or slight ellipse) around point P (in front of deity's chest), radius R = 28% of screen width.
- Manual: Pan gesture; `angle = atan2(touchY − Py, touchX − Px)`; thali position = `P + R·(cos angle, sin angle)`. Track cumulative rotation (unwrap angle deltas) to count full circles.
- Auto: `angle` animated with `withRepeat(withTiming(+2π, 3000ms, linear), -1)`, clockwise.
- Diya flame on thali: Skia path with flicker (scale 0.9–1.1, opacity 0.85–1, 600–800 ms loops) + soft radial glow on the deity layer that follows the thali.
- Respect "reduce motion" OS setting: auto mode moves slower, no glow pulses.

### 4.4 Falling offerings
- Skia particle system; count = min(item.particleCount, 30).
- Each particle: random start x across top 70% width, y = −40; fall duration 2.2–3.2 s; sway `x += sin(t·2π·f)·12px`; rotation random ±180°; ease-in.
- Landing zone = feet area; landed particles fade into the static "pile" sprite (pile grows in 3 stages based on today's count).
- Mala: slides down onto deity neck anchor (anchor point per image, default 35% from top, centred; admins can set `anchor_x/anchor_y` per image).
- Diya: small diya appears at feet with flame; stays lit for the day.

### 4.5 Aarti audio + lyrics
- `expo-audio`, background playback enabled, `playsInSilentMode: true` (user setting "Silent mode में भी बजाएं", default on).
- Lyrics JSON: `[{ "t": 0.0, "line": "…" }, …]` (t = seconds). Current line = last entry with `t ≤ currentTime`. Poll 4×/s.
- Audio + lyrics cached to device (`expo-file-system`) after first play; cache key = aarti id + version.
- Lock-screen controls: title = aarti name, artwork = deity thumb.

### 4.6 Performance
60 fps target on low-end Android; use `expo-image` with `cachePolicy="memory-disk"`; load `card` variant first, swap to `hd` when loaded; never decode images larger than screen × 1.5.

---

## 5. Data model (Prisma — module tables)

`User` model comes from the Auth module (stub it with id/name/phone/role/timezone for now).

```prisma
enum ImageSource { OFFICIAL COMMUNITY HOME_MANDIR }
enum ImageStatus { PROCESSING AUTO_REJECTED PENDING PRIVATE PUBLIC REJECTED REMOVED }
enum OfferingKind { FLOWER MALA DIYA BHOG SPECIAL }
enum RitualAction { OFFERING AARTI_COMPLETE BELL DARSHAN }
enum CoinTxnReason { PURCHASE OFFERING REWARD REFUND ADMIN_ADJUST }

model Deity {
  id              String   @id @default(uuid())
  slug            String   @unique           // "hanuman"
  nameHi          String
  nameEn          String
  weekday         Int?                        // 0=Sun … 6=Sat, for default-of-day
  defaultImageId  String?
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  images          DeityImage[]
  offeringItems   OfferingItemDeity[]
  aartis          Aarti[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Temple {
  id          String   @id @default(uuid())
  name        String
  nameHi      String?
  city        String
  state       String?
  lat         Float?
  lng         Float?
  isVerified  Boolean  @default(false)   // created by admin vs suggested by user
  photographyRestricted Boolean @default(false) // if true, community uploads auto-go to PRIVATE only
  createdById String?
  images      DeityImage[]
  createdAt   DateTime @default(now())
  @@index([city])
}

model DeityImage {
  id              String      @id @default(uuid())
  deityId         String
  templeId        String?
  source          ImageSource
  status          ImageStatus @default(PROCESSING)
  uploadedById    String?                 // null for OFFICIAL
  objectKey       String                  // original in storage
  variants        Json?                   // { thumb, card, full, hd } keys
  width           Int?
  height          Int?
  phash           String?
  possibleDuplicate Boolean   @default(false)
  moderationScore Json?                   // raw provider labels
  isFeatured      Boolean     @default(false)
  anchorX         Float?                  // mala anchor (0..1)
  anchorY         Float?
  creditName      String?
  showCredit      Boolean     @default(true)
  consentAt       DateTime?
  licenseInfo     String?                 // for OFFICIAL images
  rejectReason    String?
  useCount        Int         @default(0)
  deity           Deity       @relation(fields: [deityId], references: [id])
  temple          Temple?     @relation(fields: [templeId], references: [id])
  reports         ImageReport[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@index([deityId, source, status])
  @@index([uploadedById])
  @@index([phash])
}

model ImageReport {
  id          String   @id @default(uuid())
  imageId     String
  reportedById String
  reason      String   // WRONG_DEITY | WRONG_TEMPLE | INAPPROPRIATE | COPIED | OTHER
  note        String?
  status      String   @default("OPEN") // OPEN | ACTIONED | DISMISSED
  image       DeityImage @relation(fields: [imageId], references: [id])
  createdAt   DateTime @default(now())
  @@unique([imageId, reportedById])
}

model ModerationLog {
  id        String   @id @default(uuid())
  imageId   String
  actorId   String?  // null = system
  action    String   // AUTO_PASS | AUTO_REJECT | APPROVE_PUBLIC | FEATURE | KEEP_PRIVATE | REJECT | REMOVE | RESTORE | EDIT
  note      String?
  createdAt DateTime @default(now())
  @@index([imageId])
}

model OfferingItem {
  id            String       @id @default(uuid())
  kind          OfferingKind
  nameHi        String
  nameEn        String
  iconUrl       String
  spriteUrl     String       // particle / overlay sprite
  animationKey  String       // "falling_flowers" | "mala_drop" | "diya_light" | "bhog_place" | "sindoor_tilak" …
  particleCount Int          @default(20)
  coinCost      Int          @default(0) // 0 = free
  isActive      Boolean      @default(true)
  sortOrder     Int          @default(0)
  deities       OfferingItemDeity[]      // empty = all deities
}

model OfferingItemDeity {
  offeringItemId String
  deityId        String
  item           OfferingItem @relation(fields: [offeringItemId], references: [id])
  deity          Deity        @relation(fields: [deityId], references: [id])
  @@id([offeringItemId, deityId])
}

model Aarti {
  id           String  @id @default(uuid())
  deityId      String
  titleHi      String
  titleEn      String
  audioKey     String
  lyricsKey    String     // JSON timeline
  durationSec  Int
  version      Int     @default(1)
  isDefault    Boolean @default(false)
  isActive     Boolean @default(true)
  licenseInfo  String?
  deity        Deity   @relation(fields: [deityId], references: [id])
}

model UserDeity {
  userId          String
  deityId         String
  position        Int
  isPinned        Boolean @default(false)
  selectedImageId String?
  @@id([userId, deityId])
}

model RitualLog {
  id             String       @id @default(uuid())
  userId         String
  deityId        String
  action         RitualAction
  offeringItemId String?
  aartiId        String?
  coinsSpent     Int          @default(0)
  localDate      String       // "YYYY-MM-DD" in user's timezone
  createdAt      DateTime     @default(now())
  @@index([userId, localDate])
}

model UserStreak {
  userId         String   @id
  current        Int      @default(0)
  longest        Int      @default(0)
  lastDate       String?  // "YYYY-MM-DD"
  freezesLeft    Int      @default(0) // future: streak freeze
}

model UserBadge {
  userId    String
  badgeKey  String   // STREAK_7 | STREAK_21 | STREAK_51 | STREAK_108 | DARSHAN_SEVAK | TIRTH_YATRI
  earnedAt  DateTime @default(now())
  @@id([userId, badgeKey])
}

model Theme {
  id        String   @id @default(uuid())
  key       String   @unique // "default" | "navratri" | "diwali" …
  frameKey  String
  colors    Json
  startsAt  DateTime?
  endsAt    DateTime?
  deityIds  String[] // empty = all
  isActive  Boolean  @default(false)
}

// ---- Coins ----
model CoinWallet {
  userId   String @id
  balance  Int    @default(0)
  updatedAt DateTime @updatedAt
}

model CoinTransaction {
  id        String        @id @default(uuid())
  userId    String
  amount    Int           // + credit, − debit
  balanceAfter Int
  reason    CoinTxnReason
  refType   String?       // "offering" | "purchase" | "reward_rule" | "admin"
  refId     String?
  createdAt DateTime      @default(now())
  @@index([userId, createdAt])
}

model CoinPack {
  id              String  @id @default(uuid())
  coins           Int
  bonusCoins      Int     @default(0)
  productIdIos    String
  productIdAndroid String
  isActive        Boolean @default(true)
  sortOrder       Int     @default(0)
}

model CoinPurchase {
  id                 String   @id @default(uuid())
  userId             String
  coinPackId         String
  storeTransactionId String   @unique   // idempotency for webhooks
  platform           String   // ios | android
  rawEvent           Json
  createdAt          DateTime @default(now())
}

model RewardRule {
  id        String  @id @default(uuid())
  key       String  @unique  // FIRST_DARSHAN_OF_DAY | AARTI_COMPLETE | STREAK_7 | UPLOAD_APPROVED | IMAGE_USED_BY_10 …
  coins     Int
  dailyCap  Int?    // max times per day
  isActive  Boolean @default(true)
}
```

**Thali designs and permanent unlocks (T7b, migration `20260927114447_thali_designs`):**

```prisma
enum UnlockItemType { THALI }        // later: BELL, FRAME … (one enum value + migration per new item type)
// CoinTxnReason gains UNLOCK        // spend on a permanent unlock (refType "unlock", refId = UserUnlock.id)

model ThaliDesign {
  id         String   @id @default(uuid())
  nameHi     String
  nameEn     String
  imageKey   String              // public-bucket object key (like OfferingItem.iconUrl)
  flameStyle String              // "single" | "pancha" | … — flame layout/animation preset for §4.3
  coinCost   Int      @default(0) // 0 = free (always usable, never needs an unlock row)
  isActive   Boolean  @default(true)
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

/// Generic "bought once, usable forever" ownership. `itemId` points into the table named by `itemType`
/// (no FK, so one table serves every item type); rows are never deleted when an item is deactivated.
model UserUnlock {
  id         String         @id @default(uuid())
  userId     String
  itemType   UnlockItemType
  itemId     String
  coinsSpent Int
  unlockedAt DateTime       @default(now())
  @@unique([userId, itemType, itemId])
  @@index([userId, itemType])
}

/// Per-user mandir settings (one row per user, created on first write).
model UserMandirSettings {
  userId          String   @id
  selectedThaliId String?  // null = the default free thali
  updatedAt       DateTime @updatedAt
}

// RitualLog gains: thaliId String?   // thali used for AARTI_COMPLETE
```

Implementation notes (T2 — the Prisma schema adds these on top of the listing above, fields/types unchanged):
- Foundation conventions: tables and columns are snake_case (`@@map` / `@map`), all uuid ids and uuid references are `@db.Uuid`.
- Foreign keys follow `docs/02-database-overview.md` → Relationship rules: user-owned rows (`user_deities`, `ritual_logs`, `user_streaks`, `user_badges`, `coin_wallets`, `image_reports`) reference `users` with `ON DELETE CASCADE`; `deity_images.uploaded_by_id` and `temples.created_by_id` use `SET NULL` (approved public photos survive account deletion, anonymised); audit/financial rows (`coin_transactions`, `coin_purchases`, `moderation_logs.actor_id`) keep a plain uuid with no FK.
- Extra FKs for integrity: `deities.default_image_id` (also unique — an image belongs to one deity) and `user_deities.selected_image_id` → `deity_images` (`SET NULL`, so users fall back per §6.2), `user_deities.deity_id`/`ritual_logs.deity_id` → `deities`, `ritual_logs.offering_item_id`/`aarti_id` (`SET NULL`), `moderation_logs.image_id` → `deity_images`, `coin_purchases.coin_pack_id` → `coin_packs`, `temples.created_by_id` → `users`.
- DB `CHECK` constraints: `coin_wallets.balance >= 0`, `coin_transactions.balance_after >= 0`, `coin_transactions.amount <> 0`.
- `OfferingItem.iconUrl` / `spriteUrl` store **public-bucket object keys** (e.g. `official/offerings/genda/icon.webp`), like `Theme.frameKey` and `Aarti.audioKey`; the API turns them into CDN URLs with `StorageService.publicUrl()`. Stored data therefore stays valid when the CDN host changes (e.g. a LAN IP for on-device testing, or prod R2 domain).

Rules:
- Every coin change = insert `CoinTransaction` + update `CoinWallet` in **one** transaction, with `SELECT … FOR UPDATE` on the wallet row. Balance can never go below 0.
- `useCount` updated asynchronously (job) when users set/unset an image.

---

## 6. Business rules

### 6.1 Default deity of the day
Priority: pinned deity → active festival theme's deity (if in user's mandir) → today's weekday deity (if in user's mandir) → first deity by position. Seed weekday map: Sun Surya, Mon Shiv, Tue Hanuman, Wed Ganesh, Thu Vishnu, Fri Lakshmi, Sat Shani (editable in admin). Active theme may override (e.g. Navratri → Durga): with `mandir.festival_themes` on, a running non-default theme (`isActive`, within `startsAt`/`endsAt`) is used and its `deityIds` override the weekday deity, never a pinned one.

Until a user saves a deity list (`PUT /mandir/deities`, or onboarding in the Auth module), their mandir is **all active deities by `sortOrder`**. Setting an image for a deity saves that implicit list first.

### 6.2 Image resolution for a deity (what the user sees)
user's `selectedImageId` (if still visible to that user) → featured PUBLIC image → deity `defaultImageId` → bundled fallback. An image becomes invisible to others the moment its status leaves PUBLIC; users who had selected it fall back automatically.

Visibility:
| Status | Owner sees | Others see |
|---|---|---|
| PROCESSING | yes (placeholder "processing") | no |
| AUTO_REJECTED | no (gets message) | no |
| PENDING / PRIVATE | yes | no |
| PUBLIC | yes | yes |
| REJECTED / REMOVED | yes, in My uploads only (cannot set) | no |

If `temple.photographyRestricted = true`, community uploads for that temple go to PRIVATE after auto-check (never queued for public).

### 6.3 Streak
A "darshan day" = the user completed at least one of: an offering, an aarti, (configurable) opening the mandir for ≥ 20 s. Computed in the user's timezone. If `lastDate == today` → no change; `== yesterday` → current+1; else current = 1. Update `longest`. Badges on thresholds.

### 6.4 Rewards (seed values, admin-editable)
| Rule | Coins | Cap |
|---|---|---|
| FIRST_DARSHAN_OF_DAY | 1 | 1/day |
| AARTI_COMPLETE | 2 | 2/day |
| STREAK_7 / 21 / 51 / 108 | 10 / 25 / 51 / 108 | once each |
| UPLOAD_APPROVED (public) | 20 | 5/day |
| IMAGE_USED_BY_10 (your public image selected by 10 users) | 10 | once per image |
| WELCOME_BONUS | 10 | once |

### 6.5 Offering limits
Free items: **unlimited**. Paid items: no limit, each costs its `coinCost`; coins are only for premium items, and every kind has at least one free basic item. Offering valid only if item active and (item has no deity list or deity is in it).

Abuse protection is technical only: `POST /mandir/offerings` is throttled to **60 requests/minute per user** (429 `RATE_LIMITED`). Rewards stay capped per §6.4 (e.g. FIRST_DARSHAN_OF_DAY 1/day), so repeated free offerings cannot farm coins.

### 6.6 Uploads
Rate limit 10 uploads/user/day. Max original size 15 MB. Allowed: JPEG, PNG, HEIC (convert to JPEG on device). Users with 3+ rejected-as-inappropriate uploads are auto-blocked from uploading (admin can unblock).

### 6.7 Content licence
Terms of Use must state: uploader confirms they own the photo; grants the app a non-exclusive, worldwide, royalty-free licence to display, resize and distribute it within the app and its promotions; can delete it anytime (removal from public within 72 h). A takedown contact email must exist. **Get this clause reviewed by a lawyer before launch.**

### 6.8 Thali designs (permanent unlocks, T7b)
- A thali design is **bought once and usable forever**, unlike offerings, which are spent each time. `coinCost = 0` designs are free and usable by everyone with no unlock row. The free default thali is the active free design with the lowest `sortOrder`.
- Unlock = one transaction: lock the user (§5 rules), check no `UserUnlock` row exists, debit `coinCost` (`reason UNLOCK`, `refType "unlock"`, `refId` = unlock id), insert `UserUnlock`. Already unlocked (or free) → 409 `ALREADY_UNLOCKED`, no debit. The unique `(userId, itemType, itemId)` constraint is the last line of defence against a double debit.
- A thali can be selected only if it is active **and** (free or unlocked by the user); otherwise 403 `THALI_LOCKED`. Unlocking does not auto-select.
- If the selected thali is deactivated by admin, the user falls back to the default free thali (the unlock row is kept; reactivating restores access).
- Prices are admin-editable; a price change never affects existing unlocks. Refunds go through admin coin adjust (`ADMIN_ADJUST`) and do not remove the unlock unless admin revokes it explicitly.
- `UserUnlock` is generic (`itemType`): later permanent items (bell designs, mandir frames …) reuse the same table, rules and endpoints shape.

---

## 7. API contracts

All under `/v1`, auth required unless noted. Schemas live in `packages/shared-types/src/mandir/*.ts` (zod).

### Mandir
| Method | Path | Flag | Notes |
|---|---|---|---|
| GET | `/mandir/home` | `mandir.enabled` | Everything VM-01 needs in one call |
| GET | `/deities` | | All active deities (for Sangrah) |
| PUT | `/mandir/deities` | | Replace user's deity list `{ items: [{ deityId, position, isPinned }] }` |
| PUT | `/mandir/deities/:deityId/image` | | `{ imageId: string \| null }` (null = reset to default) |
| GET | `/deities/:deityId/offerings` | `mandir.offerings` | Items valid for deity, grouped by kind |
| POST | `/mandir/offerings` | `mandir.offerings` (paid items also need `mandir.premium_offerings`) | Idempotency-Key required. Throttle 60/min per user |
| GET | `/deities/:deityId/aartis` | | With signed/CDN URLs + version |
| POST | `/mandir/rituals/aarti-complete` | | `{ deityId, aartiId, playedRatio, circles, thaliId? }` (`thaliId` from T7b) |
| GET | `/mandir/thalis` | `mandir.thali_designs` | T7b. All active designs with `unlocked` + `selected` flags |
| POST | `/mandir/thalis/:thaliId/unlock` | `mandir.thali_designs` | T7b. Idempotency-Key required. Debits coins once; 409 `ALREADY_UNLOCKED` |
| PUT | `/mandir/thali` | `mandir.thali_designs` | T7b. `{ thaliId }` — select an unlocked (or free) design; 403 `THALI_LOCKED` |
| POST | `/mandir/rituals/darshan` | | Presence ping for streak (≥20 s) |
| GET | `/me/streak` | | Streak + badges + month calendar |

`GET /mandir/home` response:
```json
{
  "data": {
    "today": { "localDate": "2026-09-29", "weekday": 2, "tithiText": "मंगलवार, आश्विन कृष्ण पक्ष तृतीया" },
    "theme": { "key": "default", "frameUrl": "…", "colors": { }, "deityIds": [] },
    "defaultDeityId": "…",
    "deities": [{
      "id": "…", "slug": "hanuman", "nameHi": "हनुमान जी", "nameEn": "Hanuman ji", "position": 0, "isPinned": false,
      "image": { "id": "…", "source": "COMMUNITY", "status": "PUBLIC", "urls": { "thumb": "…", "card": "…", "full": "…", "hd": "…" },
                 "anchor": { "x": 0.5, "y": 0.35 }, "credit": { "name": "Ramesh", "temple": "Hanuman Garhi, Ayodhya" } },
      "specialOffering": { "itemId": "…", "nameHi": "सिंदूर", "nameEn": "Sindoor", "iconUrl": "…", "coinCost": 0 },
      "defaultAartiId": "…"
    }],
    "todayOfferings": { "<deityId>": { "flowers": 14, "mala": true, "diya": true, "bhog": false } },
    "coins": { "balance": 42 },
    "streak": { "current": 5, "longest": 12, "doneToday": true }
  }
}
```
Note: Phase 1 `tithiText` comes from a simple server-side panchang util or a precomputed table; full Panchang is Phase 2.

T4 contract notes (zod schemas in `packages/shared-types/src/mandir/home.ts`):
- `tithiText` is in the user's language (hi default): tithi at 06:00 local time from low-precision sun/moon positions, purnimanta month names, no adhik maas (`apps/api/src/modules/mandir/panchang.ts`).
- `image` is null when the bundled fallback should be shown. It carries `status` so the owner's PROCESSING upload can show the placeholder; the owner's non-public images get 1-hour signed URLs (every size points at the original until variants exist). `credit` = uploader credit (if `showCredit`) + "temple, city", or null.
- `specialOffering` returns the item names instead of a ready label; the app builds the CTA ("सिंदूर चढ़ाएं") via i18n. It is null when `mandir.offerings` is off, or the item is paid and `mandir.premium_offerings` is off.
- `todayOfferings` has an entry for every deity in `deities`; `flowers` counts today's FLOWER offerings.
- `streak.current` shows 0 once the last darshan day is before yesterday.
- `GET /deities` → `[{ id, slug, nameHi, nameEn, weekday, image, inMandir }]` (image as the user would see it).
- `PUT /mandir/deities`: 1–50 items, unique deityIds and positions, at most one pinned; unknown/inactive deity → 404 `DEITY_NOT_AVAILABLE`. Image selections of kept deities survive. Returns `{ items }` sorted by position.
- `PUT /mandir/deities/:deityId/image` → `{ deityId, image }` (image after resolution). Errors: 404 `IMAGE_NOT_AVAILABLE` (unknown, other deity, or not usable by the user per §6.2), 404 `DEITY_NOT_AVAILABLE`, 409 `DEITY_NOT_IN_MANDIR`. The `useCount` job (§5 rules) is added with the image pipeline (T16).

`POST /mandir/offerings`
```json
// request
{ "deityId": "…", "offeringItemId": "…" }
// 200
{ "data": { "coinsBalance": 37, "coinsSpent": 5, "streak": { "current": 6, "doneToday": true },
            "reward": { "ruleKey": "FIRST_DARSHAN_OF_DAY", "coins": 1 } | null,
            "todayOfferings": { "flowers": 25, "mala": true, "diya": true, "bhog": false } } }
// errors: 402 COINS_INSUFFICIENT { details: { required: 5, balance: 2 } }, 404 ITEM_NOT_AVAILABLE, 429 RATE_LIMITED
```

T6 contract notes (zod schemas in `packages/shared-types/src/mandir/offerings.ts`):
- `GET /deities/:deityId/offerings` → `{ deityId, groups: [{ kind, items: [{ id, kind, nameHi, nameEn, iconUrl, spriteUrl, animationKey, particleCount, coinCost }] }] }`. Kinds in order FLOWER, MALA, DIYA, BHOG, SPECIAL; empty kinds omitted. Paid items are left out while `mandir.premium_offerings` is off. Unknown/inactive deity → 404 `DEITY_NOT_AVAILABLE`.
- `POST /mandir/offerings` answers **200**. The deity must be active (it need not be in the user's mandir list). A paid item while `mandir.premium_offerings` is off → 403 `FEATURE_DISABLED { flag }`.
- No free-offering limit (§6.5). Throttle: 60 requests/minute per user (`@UserThrottle`, `core/throttle`, counted after auth by user id, in the throttler's storage), on top of the global per-IP default. Over the limit → 429 `RATE_LIMITED` with a `Retry-After` header; nothing is written.
- One transaction: coin debit (ledger `refType "offering"`, `refId` = ritual log id) → `RitualLog` → streak update (§6.3) → `FIRST_DARSHAN_OF_DAY` reward (if `mandir.rewards` on). Any error rolls everything back. A per-user Postgres advisory lock, taken first, serialises reward-cap and streak checks and keeps the lock order (user lock → wallet row) the same everywhere.
- `coinsBalance` is after the spend and reward; `reward` is null when nothing paid out. Streak-milestone rewards (STREAK_7…) and badges come with T7.

T7 contract notes (zod schemas in `packages/shared-types/src/mandir/rituals.ts` and `packages/shared-types/src/streaks/index.ts`):
- **Darshan-day outcome** — offerings, aarti-complete and the darshan ping all end with the same step, in the request's transaction after the per-user lock: streak update (§6.3) → streak badges → `FIRST_DARSHAN_OF_DAY` → streak-milestone rewards. Their responses share `{ coinsBalance, streak: { current, longest, doneToday }, rewards: [{ ruleKey, coins }], badgesEarned: [badgeKey] }`. `rewards` lists every payout of the request (empty when none, all skipped while `mandir.rewards` is off); `badgesEarned` only the badges first earned by this request. `POST /mandir/offerings` gains `rewards` + `badgesEarned` and keeps `reward` (= the `FIRST_DARSHAN_OF_DAY` payout or null) for the T6 contract; its `streak` gains `longest`.
- **Streak badges** — `STREAK_7/21/51/108` (`UserBadge`) are earned when `current` reaches the threshold; checked whenever a darshan day is counted, so a missing badge is caught up on the next darshan day. Milestone rewards (reward rule key = badge key, once per user) are checked on the first darshan of each day for every threshold ≤ `current`, so a rule that was inactive or a `mandir.rewards` flag that was off pays on a later day. `DARSHAN_SEVAK` and `TIRTH_YATRI` depend on uploads and are awarded by T16/T21.
- `GET /deities/:deityId/aartis` → `{ deityId, items: [{ id, titleHi, titleEn, audioUrl, lyricsUrl, durationSec, version, isDefault }] }` — active aartis, default first, then newest version. Audio + lyrics live in `media-public`, so the URLs are CDN URLs; the app caches by `id + version` (§4.5). Unknown/inactive deity → 404 `DEITY_NOT_AVAILABLE`.
- `POST /mandir/rituals/aarti-complete` `{ deityId, aartiId, playedRatio (0..1), circles (int ≥ 0) }` (+ `thaliId?` with T7b) → **200** darshan-day outcome + `ritualLogId`. Idempotency-Key required (it pays rewards); throttle 20/min per user. Completion rule (VM-06): `playedRatio ≥ 0.9` **and** `circles ≥ 3`; in Auto mode the app reports the circles the auto thali made (one per 3 s, so any aarti that plays ≥ 9 s qualifies). Otherwise 422 `AARTI_INCOMPLETE { playedRatio, circles, minPlayedRatio, minCircles }`, nothing written. Unknown/inactive aarti or one of another deity → 404 `AARTI_NOT_AVAILABLE`; deity → 404 `DEITY_NOT_AVAILABLE`. Writes a `RitualLog` `AARTI_COMPLETE`, then the darshan-day outcome, then `AARTI_COMPLETE` (2 coins, 2/day) if `mandir.rewards` is on. `FIRST_DARSHAN_OF_DAY` pays for whichever darshan-day action comes first (offering, aarti or ping).
- `POST /mandir/rituals/darshan` `{ deityId, seconds (int ≥ 0) }` → **200** darshan-day outcome + `counted`. Remote config `darshanPingSeconds` (seed 20; `null` = pings don't count, §6.3 "configurable"): `seconds` below it → 422 `DARSHAN_TOO_SHORT { seconds, minSeconds }`; pings off → `counted: false` and nothing written. A counted ping writes at most one `RitualLog` `DARSHAN` per user per local day. No Idempotency-Key (a repeat is a no-op for the day).
- `GET /me/streak?month=YYYY-MM` (default: the user's current local month) → `{ current, longest, doneToday, badges: [{ key, earnedAt }], calendar: { month, days: ["YYYY-MM-DD", …] } }`. `current` follows the home rule (0 once broken). `calendar.days` = distinct local dates with an `OFFERING`, `AARTI_COMPLETE` or `DARSHAN` log in that month, ascending. Badges oldest first.

Thali contract (T7b, rules §6.8; schemas will live in `packages/shared-types/src/mandir/thalis.ts`):
```json
// GET /v1/mandir/thalis → 200
{ "data": { "selectedThaliId": "…",
            "items": [{ "id": "…", "nameHi": "चाँदी की थाली", "nameEn": "Silver thali", "imageUrl": "…",
                        "flameStyle": "single", "coinCost": 51, "unlocked": false, "selected": false }] } }
// POST /v1/mandir/thalis/:thaliId/unlock (Idempotency-Key) → 200
{ "data": { "thaliId": "…", "coinsSpent": 51, "coinsBalance": 12 } }
// errors: 409 ALREADY_UNLOCKED (also for free designs), 402 COINS_INSUFFICIENT { required, balance }, 404 THALI_NOT_AVAILABLE (unknown/inactive)
// PUT /v1/mandir/thali { "thaliId": "…" } → 200 { "data": { "selectedThaliId": "…" } }
// errors: 403 THALI_LOCKED, 404 THALI_NOT_AVAILABLE
```
- Items sorted by `sortOrder`; free designs always have `unlocked: true`. `selectedThaliId` is the resolved selection (falls back to the default free thali, §6.8).
- `aarti-complete` records `RitualLog.thaliId`: the request's `thaliId` if given and usable by the user (else 403 `THALI_LOCKED`), otherwise the user's resolved selection.
- `GET /mandir/home` gains `thali: { id, imageUrl, flameStyle }` (the resolved selection) so VM-01 can draw it without a second call.
- T7b details: items tie-break on `nameEn` after `sortOrder`. `selectedThaliId` and home `thali` are null only when no active free design exists. While `mandir.thali_designs` is off the three thali routes answer 403 `FEATURE_DISABLED`, home `thali` is the default free thali and aarti-complete ignores `thaliId` and records the default free thali (selections and unlocks are kept for when the flag returns). A selection that is inactive or no longer unlocked (admin revoke) resolves to the default free thali. Unlock also has a per-user throttle of 20/min; 409 `ALREADY_UNLOCKED` and 404/403 errors carry `{ thaliId }`. A unique-constraint race on `UserUnlock` rolls back the debit and answers 409 `ALREADY_UNLOCKED`.

### Images
| Method | Path | Flag | Notes |
|---|---|---|---|
| POST | `/images/upload-url` | `mandir.community_upload` | `{ contentType, sizeBytes, source: "COMMUNITY" \| "HOME_MANDIR" }` → `{ uploadUrl, objectKey, expiresIn }` |
| POST | `/images` | `mandir.community_upload` | `{ objectKey, source, deityId, templeId?, newTemple?: { name, city, lat?, lng? }, showCredit, consent: true }` → image (status PROCESSING) |
| GET | `/deities/:deityId/images?tab=official\|community\|mine&sort=popular\|new&cursor=` | `mandir.community_gallery` for community | |
| GET | `/images?templeId=&city=&deityId=&cursor=` | `mandir.community_gallery` | Gallery |
| GET | `/me/images?cursor=` | | My uploads with status |
| DELETE | `/me/images/:id` | | Owner delete → status REMOVED |
| POST | `/images/:id/report` | | `{ reason, note? }` |
| GET | `/temples/search?q=&lat=&lng=` | | Name/city search, nearby if coords |

### Coins
| Method | Path | Notes |
|---|---|---|
| GET | `/coins/wallet` | balance |
| GET | `/coins/transactions?cursor=` | history |
| GET | `/coins/packs` | active packs with store product ids |
| GET | `/coins/reward-rules` | for "how to earn" |
| POST | `/webhooks/revenuecat` | **no user auth**; verify shared secret header; handle `NON_RENEWING_PURCHASE` / consumable events; idempotent on `storeTransactionId`; credit `coins + bonusCoins` |

T5 contract notes (zod schemas in `packages/shared-types/src/coins/index.ts`):
- `GET /coins/wallet` → `{ balance }` (0 when the user has no wallet row yet).
- `GET /coins/transactions?cursor=&limit=` (limit 1–50, default 20) → paginated envelope `{ data: [{ id, amount, balanceAfter, reason, refType, refId, createdAt }], nextCursor }`, newest first; `nextCursor` is opaque, a bad one → 400 `VALIDATION_FAILED`.
- Any debit beyond the balance → 402 `COINS_INSUFFICIENT` `{ details: { required, balance } }`, nothing written.

App purchase flow: RevenueCat `purchasePackage` → on success poll `GET /coins/wallet` (max 10 s, backoff) until balance increases → show success. The app **never** credits coins itself.

### Config
`GET /v1/config` (Foundation) returns flags and remote config including `uploadMaxPerDay`, `shareAppLink`, `darshanPingSeconds` (T7: seconds on VM-01 before the app sends the darshan ping; `null` = pings don't count for the streak). (`freeOfferingsPerDeityPerDay` was removed; free offerings are unlimited, §6.5. The seed deletes the obsolete key from existing configs.)

---

## 8. Moderation pipeline (job `image.process`)

```
PROCESSING
  ├─ variants + pHash
  ├─ ModerationProvider.check(image) → { unsafe: boolean, labels }
  ├─ unsafe → AUTO_REJECTED  (log AUTO_REJECT, notify owner)
  ├─ HOME_MANDIR → PRIVATE   (log AUTO_PASS)
  ├─ temple.photographyRestricted → PRIVATE
  └─ else → PENDING          (log AUTO_PASS, possibleDuplicate flag set if pHash match)
PENDING --admin--> PUBLIC | PUBLIC+featured | PRIVATE | REJECTED(reason)
PUBLIC  --admin/owner--> REMOVED ; REMOVED --admin--> PUBLIC (restore)
```
Every transition writes `ModerationLog`. Transitions are implemented in one `ImageStateMachine` service with unit tests for every allowed and forbidden transition. Job retries 3× with backoff; after final failure → stays PROCESSING and appears in admin "Failed processing" list.

---

## 9. Feature flags

| Key | Default at launch | Controls |
|---|---|---|
| `mandir.enabled` | on | whole module |
| `mandir.offerings` | on | offering sheets |
| `mandir.premium_offerings` | on | paid items |
| `mandir.coins_purchase` | on | buying coin packs |
| `mandir.rewards` | on | reward rules |
| `mandir.community_upload` | on | upload flow |
| `mandir.community_gallery` | on | community tab + gallery |
| `mandir.home_mandir` | on | home mandir uploads |
| `mandir.share_card` | on | share card |
| `mandir.festival_themes` | off | theme switching |
| `mandir.startup_shankh_sound` | on | shankh on first open of day |
| `mandir.thali_designs` | on (seeded **off** until T7b ships) | thali picker, unlock + select APIs (§6.8) |

---

## 10. Admin panel (admin-web) — Phase 1 screens

| Screen | Features |
|---|---|
| Login | Admin/Moderator login (Auth module; DEV_AUTH until then) |
| Dashboard | Today: DAU, aartis, offerings, coins spent/purchased, pending queue count, open reports |
| Deities | CRUD, weekday, sort order, default image, active toggle |
| Official images | Upload (with licence info), set anchor point by clicking on image, set default |
| Moderation queue | Grid of PENDING images, oldest first. Each card: image, deity, temple, uploader, possible-duplicate badge (shows matched image side-by-side), moderation labels. Actions: Approve public / Approve + Feature / Keep private / Reject (reason dropdown + note). Keyboard shortcuts A / F / P / R. Bulk select. |
| Reports | Open reports grouped by image; actions: Remove image / Dismiss |
| All images | Search/filter by status, source, deity, temple, uploader; remove/restore; edit metadata |
| Temples | CRUD, verify user-suggested temples, merge duplicates, `photographyRestricted` toggle (also offers "remove all public photos of this temple") |
| Users (basic) | Search user, view uploads, block/unblock uploads, adjust coins (with reason → ADMIN_ADJUST) |
| Offerings | CRUD items, kind, cost, deity scope, sprites, animation key |
| Thali designs | CRUD `ThaliDesign`: names, image upload, flame style, coin cost (0 = free), active toggle, sort order; unlock count per design. Deactivate instead of delete once anyone has unlocked it |
| Aartis | Upload audio + lyrics JSON, preview with synced lyrics, set default, licence info |
| Coins | Packs (map to store product ids), reward rules |
| Themes | Create/schedule festival themes |
| Feature flags | Toggle, rollout %, platforms, min app version |
| Moderation log | Audit trail |

---

## 11. Analytics events

`mandir_opened`, `deity_switched {deityId, via}`, `bell_rung`, `offering_sheet_opened {kind}`, `offering_made {itemId, kind, coins}`, `offering_blocked {reason}`, `aarti_started {aartiId}`, `aarti_completed {aartiId, circles, auto}`, `aarti_abandoned {playedRatio}`, `coin_pack_viewed`, `coin_purchase_started {packId}`, `coin_purchase_succeeded`, `coin_purchase_failed {reason}`, `darshan_chooser_opened`, `image_selected {source}`, `upload_started {source}`, `upload_submitted`, `upload_failed {reason}`, `image_reported {reason}`, `share_card_shared`, `streak_badge_earned {badge}`, `thali_picker_opened`, `thali_unlocked {thaliId, coins}`, `thali_selected {thaliId}`.

---

## 12. Assets & content needed before launch

| Asset | Spec | Count |
|---|---|---|
| Official deity images | Portrait 3:4, ≥1440×1920, JPEG/PNG; artwork or licensed photos with licence record | 1–3 per deity, 10 deities |
| Frame (default theme) | Transparent PNG arch + pillars + toran, 1440×2560 | 1 |
| Bells | Sprite PNG + bell sound (short, clean) | 1 + 2 sounds |
| Shankh sound | ≤3 s | 1 |
| Offering sprites (free basics) | Genda phool, genda mala, mitti diya, mishri bhog, deity specials (sindoor/Hanuman, jal/Shiv, tel/Shani) | 7 |
| Offering sprites (premium) | Gulab, kamal, 108 phool varsha, gulab mala, pancha-deep, chhappan bhog, chandan, chunari (Durga/Lakshmi) | 8 |
| Thali designs (T7b) | Top-down transparent PNG/WebP, 512×512, with flame anchor points per `flameStyle`: 1 free default (pital/brass) + 3 premium (chaandi, sone ki, pancha-deep thali) | 4 |
| Aarti audio | 1 per deity (licensed recordings — traditional lyrics are old, but recordings have copyright) + lyrics timeline JSON | 10 |
| Fallback | 1 generic bundled artwork + bell sound | bundled |

Seed deities: Ganesh, Shiv, Hanuman, Vishnu, Lakshmi, Durga, Krishna, Ram, Shani, Surya.

Seed offerings: every kind has at least one free basic item, and coins are only for premium items. **Coin costs are placeholders**, to be set by the owner in admin.

| Kind | Free basic | Premium (placeholder coins) |
|---|---|---|
| FLOWER | Genda phool | Gulab (5), Kamal (11), 108 phool varsha (21) |
| MALA | Genda mala | Gulab mala (11) |
| DIYA | Mitti diya | Pancha-deep (11) |
| BHOG | Mishri bhog | Chhappan bhog (21) |
| SPECIAL | Sindoor (Hanuman), Jal abhishek (Shiv), Sarson tel (Shani) | Chandan (5, all deities), Chunari (21, Durga + Lakshmi) |

New animation keys for T12: `phool_varsha` (dense shower, still ≤ 30 particles), `pancha_deep`, `chandan_tilak`, `chunari_drape`. Earlier seeds also created Ghee diya and Laddoo bhog; the seed now deactivates them (past ritual logs keep their reference).

Seed thalis (T7b): Pital ki thali (free default), Chaandi ki thali, Sone ki thali, Pancha-deep thali (premium, placeholder costs 51 / 108 / 151).

---

## 13. Future hooks (keep room, don't build)

- Live darshan: add `source=LIVE_STREAM` + stream URL on `DeityImage`.
- Push darshan reminders (Phase 2) using streak + preferred time.
- Chadhava upsell: after a virtual offering, "इसे असली मंदिर में चढ़ाएं" → Phase 3 Chadhava.
- Family mandir: `family_id` on `UserDeity`.
- Streak freeze (field exists).
- Uploader leaderboard per city.

---

## 14. Build tasks (do in order; tick when done)

Each task: implement → tests → lint/typecheck → verify acceptance criteria.

- [x] **T1 Module scaffolding** — `mandir`, `coins`, `images`, `streaks` NestJS modules + shared-types folders + app `features/` folders. *AC:* app and API compile; routes registered under `/v1`.
- [x] **T2 Prisma schema + migration** — all models in §5. *AC:* `pnpm db:migrate` succeeds; schema matches doc.
- [x] **T3 Seed** — 10 deities (weekday map), 10 temples, placeholder official images (use bundled sample images uploaded to the local `media-public` bucket), offering items (free + paid per kind, sindoor for Hanuman, jal for Shiv, tel for Shani), 1 aarti per deity (placeholder audio + lyrics JSON), 4 coin packs, reward rules, flags, default theme, dev-user with 50 coins. *AC:* `pnpm db:seed` idempotent.
  - Notes: seeded rows use fixed ids and are **create-only** — re-running never overwrites admin edits or the dev-user's spent coins (`prisma migrate reset` for a clean slate). Remote config gets `uploadMaxPerDay: 10`, `shareAppLink: null` merged in only where the key is missing (`freeOfferingsPerDeityPerDay` was dropped by the T6 revision and is removed from existing configs). Placeholder media is generated by the seed with `sharp` (no binaries in git) and uploaded to `media-public`: deity images (`official/<slug>/<imageId>/{original.png,thumb,card,full,hd}.webp`, marked PLACEHOLDER in `licenseInfo`), offering icons/sprites, default theme frame, aarti audio as a short **WAV** tone (`audio/aarti/<slug>/v1.wav`; real recordings are AAC/M4A) and lyrics timelines (`lyrics/aarti/<slug>/v1.json`). All must be replaced with licensed assets per §12 before launch.
- [x] **T4 Home + deities APIs** — `/mandir/home`, `/deities`, `/mandir/deities`, `/mandir/deities/:id/image`, image resolution rules §6.2. *AC:* e2e tests for default deity logic and image fallback.
  - Notes: contract details under §7 "T4 contract notes"; §6.1 clarified (festival theme override, implicit default list). Visibility/resolution live in `ImagesService` (`image-visibility.ts`), balance in `CoinsService.getBalance`, streak display in `StreaksService.summary`. Tests: `apps/api/test/mandir-home.e2e-spec.ts` + unit specs for default deity, visibility, tithi and local dates.
- [x] **T5 Coin wallet core** — wallet service with transactional credit/debit, idempotency interceptor, transactions API. *AC:* concurrent debit test cannot go negative; repeated Idempotency-Key returns same response.
  - Notes: `CoinsService.credit/debit(userId, amount, { reason, refType?, refId? }, tx?)` lock the wallet row (`SELECT … FOR UPDATE`; first credit creates it with `ON CONFLICT DO NOTHING`), update it and insert the ledger row; passing `tx` joins the caller's transaction (T6 offering + reward). The idempotency interceptor is the Foundation one (`core/idempotency`, Redis, `@Idempotent()`); failed requests (e.g. 402) are not stored and can be retried with the same key. Contract under §7 "T5 contract notes". Tests: `apps/api/test/coins-wallet.e2e-spec.ts` (concurrent debits/credits, rollback, idempotent replay via a test-only spend route) + cursor unit spec.
- [x] **T6 Offerings API** — `/deities/:id/offerings`, `POST /mandir/offerings` incl. per-user throttle (free offerings unlimited, §6.5), streak update, reward evaluation. *AC:* e2e for free, paid, insufficient, unlimited free + throttle, reward granted once.
  - Revised 2026-09-27 (owner): the free daily limit (`freeOfferingsPerDeityPerDay`, `FREE_LIMIT_REACHED`, `limits` in home/offerings responses) was removed in favour of a 60/min per-user throttle. Seed offerings reworked per §12.
  - Notes: contract under §7 "T6 contract notes". Reward evaluation is `RewardsService.grant(tx, userId, ruleKey, { localDate, timezone })` (coins module): a rule with `dailyCap` pays at most that many times per local day, one without pays once per user; payouts are ledger rows (`REWARD`, `refType "reward_rule"`, `refId` = rule key), which the caps count. Per-image "once" (IMAGE_USED_BY_10) is left to T16. `StreaksService.recordDarshanDay(tx, …)` applies §6.3 (`nextStreak`, a `lastDate` after today is left as is). `core/prisma/user-lock.ts` `lockUser(tx, userId)` = per-user advisory lock, always taken before the wallet row lock. Tests: `apps/api/test/mandir-offerings.e2e-spec.ts` (free, paid, insufficient + rollback, unlimited free offerings, reward once incl. concurrency, flags, idempotent replay), `apps/api/test/mandir-offerings-throttle.e2e-spec.ts` (61st request in a minute → 429, other users unaffected) + `nextStreak` unit spec.
- [x] **T7 Aarti + rituals APIs** — aarti list with URLs, aarti-complete, darshan ping, `/me/streak`, badges. *AC:* streak unit tests incl. timezone boundary.
  - Notes: contract under §7 "T7 contract notes" (completion rule from VM-06; remote config `darshanPingSeconds`, seed 20). `RitualsService` (mandir module) holds aartis, aarti-complete, darshan ping and `recordDarshan(tx, user, localDate, rewardsOn)` — the darshan-day step now also used by offerings: `StreaksService.recordDarshanDay` (streak + streak badges, returns `firstOfDay`/`badgesEarned`) → `FIRST_DARSHAN_OF_DAY` → STREAK_N milestone rewards on the first darshan of the day. Offering responses gained `rewards`, `badgesEarned` and `streak.longest`. `DARSHAN_SEVAK`/`TIRTH_YATRI` are left to T16/T21. Tests: `apps/api/test/mandir-rituals.e2e-spec.ts` (aartis, completion rule + 404s, AARTI_COMPLETE cap, idempotent replay, rewards flag, darshan ping incl. config, badges + milestones incl. catch-up and no double pay, `/me/streak` calendar) + `src/modules/streaks/streak-timezone.spec.ts` (IST midnight, same instants in different zones, DST 25-hour day, UTC+14/−11, moving west) and badge/month unit specs.
- [x] **T7b Thali designs and permanent unlocks** — §5 thali block (`ThaliDesign`, generic `UserUnlock`, `UserMandirSettings.selectedThaliId`, `RitualLog.thaliId`, `CoinTxnReason.UNLOCK`) + migration; seed 1 free default + 3 premium thalis and the `mandir.thali_designs` flag (off); `GET /mandir/thalis`, `POST /mandir/thalis/:id/unlock`, `PUT /mandir/thali`; aarti-complete records `thaliId`; `thali` in home payload; rules §6.8. *AC:* unlock debits coins exactly once (incl. concurrent + repeated Idempotency-Key); duplicate unlock returns 409 `ALREADY_UNLOCKED`; a locked thali cannot be selected (403 `THALI_LOCKED`).
  - Notes: contract + details under §7 "Thali contract" (flag-off behaviour, nullable home `thali`, unlock throttle 20/min). FKs: `user_unlocks`/`user_mandir_settings` → users cascade, `selected_thali_id` and `ritual_logs.thali_id` → `thali_designs` `SET NULL`; `user_unlocks.item_id` has no FK (generic). `ThalisService` (mandir module): `list`, `unlock` (user lock → unlock-row check → `CoinsService.debit(UNLOCK)` → insert; a P2002 race maps to 409), `select`, `resolve` (selection if active + usable, else default free) and `forAarti`. Seed: Pital/Chaandi/Sone/Pancha-deep thalis (0/51/108/151, placeholder 512×512 WebP at `official/thalis/<key>/image.webp`), flag off. Tests: `apps/api/test/mandir-thalis.e2e-spec.ts` (list, unlock once incl. 6 concurrent keys + 4 concurrent same-key + replay, 409 duplicate/free, 402, 404s, locked select 403, deactivate/revoke fallback, aarti `thaliId`, flag off).
- [x] **T8 App shell** — providers, API client, config fetch + flags hook, theme, i18n (hi default), fonts, tab layout (Mandir + Profile only). *AC:* dev build runs on Android + iOS.
  - AC status (2026-09-28): **Android verified** — development build on a real phone over LAN (`pnpm dev:lan`) loads config, `/mandir/home` and CDN images. **iOS dev build pending** until the owner has an Apple Developer account (docs/03-build-and-release.md §2); the shell has no platform-specific code.
  - Notes: root layout = gesture root → safe area → i18n → React Query; fonts (Noto Sans Devanagari 400/700 via `@expo-google-fonts`, family names from `@mandir/ui`) load behind the splash. `ConfigGate` (`features/shell`) loads `GET /v1/config` before any route renders (flags decide the tabs), shows a retry screen when it fails and the force-update screen when `forceUpdate` is true; config is stale after 30 min and refetched when the app returns to the foreground (React Query `focusManager` on `AppState`). Config is cached in memory only; the disk cache comes with T14. `apiRequest` (`src/api/client.ts`) calls `/v1…`, sends `X-App-Version`, `X-Platform`, `X-Dev-User` (DEV_AUTH, from `DEV_USER`, default `dev-user`, never in production) and an optional `Idempotency-Key`, validates `data` with the shared zod schema and throws `ApiError { status, code, details, retryAfter }` (status 0 = network/timeout). Queries don't retry 4xx (429 once); mutations never retry. `useFlag(key)` = off unless the server says on. Tabs: Mandir (hidden when `mandir.enabled` is off) + Profile (language hi/en, in memory until the Auth module's profile settings, and app info incl. server URL outside production). The Mandir tab is a T8 placeholder (tithi, coin balance, default deity `card` image) that T9 replaces. API URL: `API_URL` (EAS env or `apps/devotee-app/.env.local`), else the Metro host IP on :4000 in local dev. Real-phone testing: `pnpm dev:lan` + new API env `S3_PUBLIC_ENDPOINT` so CDN and presigned URLs use the LAN IP (`docs/03-build-and-release.md` §5). Native deps unchanged (no new dev build needed for T8 beyond the existing one). Tests: jest-expo unit specs for URL resolution, the API client (headers, envelope, errors, timeout), retry policy and flags; API `storage.service.spec.ts` covers `S3_PUBLIC_ENDPOINT` signing.
- [x] **T9 VM-01 static layout** — zones, layered scene, carousel, coin pill, tithi strip, loading/offline/error states, fallback image. *AC:* matches layout on small (360dp) and large phones.
  - Notes: `features/mandir/components/MandirHome.tsx` composes the zones: maroon top bar (profile → Profile tab, day chip "<weekday> दिव्य दर्शन" from `today.weekday` via i18n, coin pill, deity carousel + "+"), then the scene area with the layered garbhagriha (§4.1 frame contract), tithi strip, two bells, left rail (Phool/Mala/Diya/Bhog hidden while `mandir.offerings` is off; Sangrah always), thali (home `thali`, bottom centre), special offering badge + Listen (bottom right; shown when `specialOffering` / `defaultAartiId` exist) and static feet-area markers for today's offerings (mala at the image anchor, diya, bhog, flowers pile in 3 stages: 1–10, 11–30, 31+) that T12 replaces with sprites. All positions come from the pure `mandirLayout(area)` (`layout.ts`), unit-tested for 360×640, 360×800, 412×915 and 480 dp phones (everything on screen, no overlaps, rail items ≥ 48 dp + label; the rail scrolls only if 5 items don't fit). Image: `card` as placeholder, then the smallest variant ≥ the drawn width in pixels (usually `full`, §4.6); all deities' `card` + that variant are prefetched to disk (§3.1). Missing image or load error → bundled `assets/fallback/deity-fallback.webp` (generic diya scene, `scripts/generate-fallback-art.cjs`). States: loading = same layout with shimmer (static under reduce-motion) and disabled rail/bells/thali; error without data = retry screen; a refresh that can't reach the server keeps the last scene with an "इंटरनेट कनेक्शन नहीं है" banner (cold-start offline needs the T14 disk cache). Not built yet, each shows a "जल्द आ रही है" toast (`features/shell/Toast.tsx`): offering sheets, Sangrah (T10), coins (T15), aarti + Listen (T13), special offering (T12), long-press chooser (T18); bells are silent until T11. The first-visit shankh + glow needs audio and comes with T11. No new native modules (the existing dev build works). Tests: layout unit specs + RNTL component tests (`MandirHome.test.tsx`: all zones, loading, error + retry, offline banner, flags; `DeityImage.test.tsx`: variant, placeholder, fallback) — `@testing-library/react-native` added as a dev dependency with `jest.setup.js` (gesture handler, worklets, safe-area mocks).
- [x] **T10 Deity switching + Sangrah (VM-02, VM-03)** — incl. reorder, pin, persist. *AC:* choice persists across app restarts via API.
  - Notes: VM-02 — carousel tap, or a horizontal swipe on the garbhagriha (≥ 60 dp or a fling ≥ 600 dp/s; left = next, right = previous, wraps around), switches deity with a 250 ms cross-fade of the deity layer and its offerings (Reanimated `FadeIn`/`FadeOut`); screen readers get increment/decrement actions on the scene. The switched-to deity lives in a session-only store (`store/selection.ts`), so every app open starts on the server's default deity (pinned → festival → weekday → first, §6.1). Long-press on the garbhagriha is reserved for VM-04 (T18, placeholder toast). VM-03 — route `app/(modals)/sangrah.tsx` (`/sangrah`), opened from the carousel "+" and the rail. Tabs "मेरा मंदिर" (the list in `position` order: long-press 250 ms then drag to reorder, ⭐ pin/unpin — one pinned at most, remove; screen readers get move up/down actions) and "सभी देवता" (`GET /deities` grid, tap toggles "मेरे मंदिर में"). Min 1 / max 12 is enforced by the app (`sangrah.ts`, toast on violation); the API keeps its 1–50 check because the implicit default list (§6.1) is all active deities and may exceed 12. Every change is saved at once with `PUT /mandir/deities` — saves run one at a time in order (React Query mutation `scope`), the cached home is updated optimistically and refetched after the last queued save; status line shows saving / saved / failed + retry (the draft stays on screen when a save fails). Persistence is the server's (T4 e2e); verified live against the local API: a saved order + pin comes back from `GET /mandir/home` and the pinned deity becomes `defaultDeityId`. No new native modules. Tests: `sangrah.test.ts` (min/max, pin, reorder maths, swipe, wrap-around), `MandirHome.test.tsx` (tap, swipe via gesture-handler test utils, adjust actions, Sangrah navigation), `SangrahScreen.test.tsx` (remove, min 1, pin, reorder, add, max 12, failed save + retry, back).
- [x] **T11 Bells** — §4.2. *AC:* no audio lag on low-end Android; haptics work.
  - AC status (2026-09-28): implemented for zero-latency playback (bundled uncompressed WAV, players created before the first tap, no loading on tap) and haptics via `expo-haptics`; unit/component tests pass. **Needs the owner's on-phone check** with the new development build (expo-audio / expo-haptics / expo-file-system are new native modules).
  - Notes: `components/Bells.tsx` — each bell (chain + bell) rotates around the top of its chain with `bellAngle(t) = 18°·e^(−3t)·sin(12t)` for 1.5 s (`animations/bell.ts`, worklet, unit-tested); a tap restarts the swing; under the OS "reduce motion" setting Reanimated skips the swing (sound + haptic still play). `hooks/useBells.ts` = sound + `Haptics.impactAsync(Medium)` + `track('bell_rung', { side })` at most once per minute (`createRateGate`, `bells.ts`) — analytics only, no API call (no BELL ritual route exists; analytics wiring is T22, `src/lib/analytics.ts` is the thin wrapper, dev console for now). Sounds (`features/mandir/sounds.ts`, `src/lib/sound.ts`): left and right bells have different pitches (`assets/fallback/bell-left.wav`, `bell-right.wav`); `SoundPool` = 3 round-robin slots each holding one preloaded player per bell sound, so rapid taps overlap and never more than 3 play at once (reusing a slot stops what it played). Audio session: plays in silent mode and mixes with other apps' audio (§4.5 default); aarti (T13) sets its own mode. Sounds are bundled app assets (the §12 bell/shankh "fallback"), synthesised placeholders from `scripts/generate-fallback-sounds.cjs` — replace with recordings before launch. First visit of the day (VM-01, deferred from T9): once the scene is on screen, the first visit of each local day (server `today.localDate`, last date kept on the device in `src/lib/storage.ts`, a JSON file via `expo-file-system`) shows the "✨ आज का दर्शन ✨" glow over the deity (fade in/hold/out ≈ 4 s, concentric translucent circles — also under reduce motion since it's a fade) and plays `shankh.wav` if `mandir.startup_shankh_sound` is on **and** the user setting allows it. The user setting is a Profile switch "दिन के पहले दर्शन पर शंख ध्वनि" (default on, `features/settings/store.ts`, saved on the device until the Auth module's profile settings). `app.config.ts` adds the `expo-audio` plugin (no microphone permission; background playback on for T13). Tests: `bell.test.ts` (formula, rest, decay), `bells.test.ts` (rate gate, greeting rules), `sound.test.ts` (preload, max 3 concurrent, restart), `storage.test.ts`, `MandirHome.test.tsx` (sound + haptic per tap, bell_rung once, disabled while loading, glow + shankh once per day, new day, flag/setting off, waits for the scene).
- [x] **T12 Offering sheets + animations (VM-05, §4.4)** — Skia particles, mala anchor, diya, pile stages, coins update, insufficient → VM-07. *AC:* 60 fps with 30 particles on a low-end test device.
  - AC status (2026-09-28): the particle system is built for the budget — one Skia `Atlas` draw call for all particles (≤ 30), transforms computed on the UI thread from one Reanimated clock, no React renders while it falls, sprites decoded ahead of the first tap. **The 60 fps check on a low-end Android phone is the owner's** (new development build: `@shopify/react-native-skia` is a new native module; use the Android GPU profiler / Perf Monitor while offering "108 फूलों की वर्षा").
  - Notes: VM-05 = `components/offerings/OfferingSheet.tsx` on `features/shell/BottomSheet.tsx` (backdrop, slide-up, Android back, modal for screen readers), opened from the rail (Phool/Mala/Diya/Bhog) and the special badge (`SPECIAL`); items from `GET /deities/:id/offerings`, loaded with the scene (`hooks/useOfferings.ts`, 10 min stale time) so the sheet opens at once, icons/sprites prefetched to disk and particle sprites decoded for Skia. Cards: icon, name, "निःशुल्क" or the coin cost; premium cards have a gold border. Tap rules (`offerings.ts` `decideOffering`, §3.2): free → the sheet closes, the animation plays at once and `POST /mandir/offerings` runs in the background (429 / offline / other failures are skipped silently, the T14 queue comes later; 404 / `FEATURE_DISABLED` → "यह चढ़ावा अभी उपलब्ध नहीं है" + refetch); paid with enough coins by the last server balance → the card shows a spinner and every card is locked (a double tap spends once), the animation plays only after the 200; paid with too few coins → no API call, placeholder coin sheet `features/coins/CoinsNeededSheet.tsx` "आपको X सिक्के और चाहिए" + balance + "सिक्के खरीदें" (toast until VM-07 / T15); a 402 opens the same sheet with the server's `required`/`balance` and refetches home; paid offline → "इंटरनेट से जुड़ें"; 429 → "थोड़ा रुककर फिर चढ़ाएं". Every POST has a fresh UUID v4 `Idempotency-Key` (`src/lib/uuid.ts`). The server's answer is written into the cached home (`applyOfferingToHome`: `coins.balance`, `streak`, `todayOfferings[deity]`), so the coin pill shows the server balance; the app never computes it. Reward toast: summed coins of `rewards` (+ the rule's name when there is one, i18n `mandir.reward.rules.*`) and each new badge (`mandir.badges.*`); analytics `offering_sheet_opened`, `offering_made`, `offering_blocked {reason}`, `streak_badge_earned`. Animations (`offeringAnimation`: key → animation, unknown keys fall back by kind): `falling_flowers` / `phool_varsha` (denser, 30 max) / `jal_abhishek` + `tel_abhishek` (drops from above the deity's head, no sway/spin) = Skia particles (`animations/particles.ts`, §4.4 maths, unit-tested; `ParticleShower.tsx` is the only Skia file); `mala_drop` slides onto the image's neck anchor; `diya_light` / `pancha_deep` (five lamps in an arc) grow in at the feet and light a flickering flame; `bhog_place` sets down in the bhog slot; `sindoor_tilak` / `chandan_tilak` glow on the forehead (anchor − 0.16 of the image height) and fade; `chunari_drape` drops over the head and fades; any other special pops at the feet. One animation at a time (a new offering replaces it); switching deity ends it. Under "reduce motion" nothing falls or slides (the result simply appears). Feet area (`FeetOfferings.tsx`) now draws sprites: mala at the anchor, flowers pile as a mound of the flower sprite in 3 stages (3 / 6 / 10 sprites for 1–10 / 11–30 / 31+, `pileLayout`), lit diya or pancha-deep with flames, bhog — in `feetSlots(feet)` (diya left, pile centre, bhog right); the sprite is the item last offered to that deity in this session, else the kind's free basic item, icons until the offerings load. While an animation plays, its kind keeps the value from before the offering (`displayTodayOfferings`), so the pile/mala/diya change when it lands. Specials are not part of `todayOfferings`, so their effect is not kept for the day. Deps: `@shopify/react-native-skia` 2.6.2 (its postinstall downloads the prebuilt Skia libraries — allowed in `pnpm-workspace.yaml` `allowBuilds`). Tests: `particles.test.ts` (30 cap, start zone, 2.2–3.2 s, ease-in, ≤ 12 px sway, landing + fade, drops, centred transform), `offerings.test.ts` (all animation keys + fallbacks, decisions, display rule, reward sum, feet sprites), `layout.test.ts` (feet slots, pile stages, pancha-deep, forehead), `api/mandir.test.ts`, `uuid.test.ts`, `OfferingFlow.test.tsx` (sheet contents + special badge, free flow incl. background log + balance + reward toast, pile held until landing, silent 429, paid flow incl. spinner + double tap + balance, low coins → coin sheet without API, 402, offline, badge toast, tilak/chunari, deity switch). Skia is stubbed in `jest.setup.js` (CanvasKit is not loaded under jest).
- [ ] **T13 Aarti mode (VM-06, §4.3, §4.5)** — manual/auto thali, thali picker with locked designs + unlock (§6.8, needs T7b), circle counting, audio, lyrics sync, background + lock-screen, completion. *AC:* completion rules enforced; audio continues when screen locks.
- [ ] **T14 Offline cache** — images + aarti audio/lyrics cached; offline states. *AC:* airplane mode: darshan, bells, free offerings (queued) and cached aarti work.
- [ ] **T15 Coins purchase (VM-07)** — RevenueCat SDK, packs screen, webhook endpoint, polling, history, reward rules list. *AC:* sandbox purchase on both stores credits coins exactly once; duplicate webhook ignored.
- [ ] **T16 Image upload pipeline (API)** — upload-url, submit, BullMQ `image.process` (sharp variants, pHash, ModerationProvider with a `mock` provider for local), state machine + logs, rate limits, temple search/create. *AC:* state machine tests pass; unsafe mock image → AUTO_REJECTED.
- [ ] **T17 Upload flow in app (VM-08, VM-14)** — permissions, crop with arch overlay, size checks, details, consent, progress, success. *AC:* uploaded image immediately usable in own mandir.
- [ ] **T18 Darshan chooser, gallery, my uploads, report (VM-04, VM-09, VM-10, VM-11)**. *AC:* visibility table §6.2 verified with two test users.
- [ ] **T19 Streak screen + share card (VM-12, VM-13)**. *AC:* share card renders correctly in Hindi and shares to WhatsApp.
- [ ] **T20 Admin: content** — deities, official images (anchor picker), offerings, thali designs, aartis (lyrics preview), coin packs, reward rules, themes, flags. *AC:* changes reflect in app without app update.
- [ ] **T21 Admin: moderation** — queue with shortcuts + duplicate comparison, reports, all images, temples (restrict + bulk remove), users (block uploads, adjust coins), moderation log, dashboard. *AC:* approve → image appears in community tab for another user within 1 minute; uploader gets coins.
- [ ] **T22 Analytics events** — all §11 events wired. *AC:* events visible in debug logger.
- [ ] **T23 Hardening** — rate limits, error states copy (Hindi), accessibility labels, reduce-motion, low-end device perf pass. *AC:* checklist §15 passes.

---

## 15. QA checklist

- [ ] Fresh install, no internet → fallback mandir appears, no crash.
- [ ] Switch deity 20 times quickly → no memory growth, no stale image.
- [ ] Paid offering with 0 coins → coin sheet; after purchase → offering completes.
- [ ] Double-tap paid offering on slow network → coins deducted once.
- [ ] Aarti with screen locked for full duration → counts as complete only if circles rule satisfied (Auto counts).
- [ ] Streak across midnight in Asia/Kolkata and for a user with another timezone.
- [ ] Upload → pending → approve → other user sees it → owner deletes → other user falls back to default.
- [ ] Temple marked restricted → its public photos removed; new uploads stay private.
- [ ] Hindi text renders correctly (matras, conjuncts) on all screens and share card.
- [ ] Works on Android 9+ and iOS 15+ (confirm minimums with current Expo SDK).

---

## 16. Open decisions (owner to confirm)

1. Final app name + package id.
2. Coin pack prices and coin cost of each premium offering.
3. Source of official images and aarti recordings for launch (licensed / commissioned).
4. Moderation provider (AWS Rekognition vs Google Vision).
5. Phase 1 tithi text: simple in-house calculation vs paid panchang API (Swiss Ephemeris licensing — see architecture notes).
