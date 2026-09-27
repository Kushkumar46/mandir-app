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
| Bottom center | Aarti thali | Tap → VM-06 Aarti mode |
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
Props: `type` (FLOWER | MALA | DIYA | BHOG | SPECIAL). Shows `offering_items` for the current deity and type: image, name, coin cost or "निःशुल्क". Locked items show coin cost. Tap:
- free → play animation immediately, log in background;
- paid & enough coins → call API, on success play animation;
- paid & not enough → VM-07 coin packs with "आपको X सिक्के और चाहिए".

Free items have a daily limit per deity (config, default 3) to keep value in premium items.

### VM-06 Aarti mode (full-screen overlay on VM-01)
- Aarti selector (if deity has >1 aarti), play/pause, progress.
- Lyrics panel: 3 visible lines, current line highlighted, auto-scroll.
- Thali: drag in a circle, or "स्वतः" (Auto) toggle.
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

Rules:
- Every coin change = insert `CoinTransaction` + update `CoinWallet` in **one** transaction, with `SELECT … FOR UPDATE` on the wallet row. Balance can never go below 0.
- `useCount` updated asynchronously (job) when users set/unset an image.

---

## 6. Business rules

### 6.1 Default deity of the day
Priority: pinned deity → today's weekday deity (if in user's mandir) → first deity by position. Seed weekday map: Sun Surya, Mon Shiv, Tue Hanuman, Wed Ganesh, Thu Vishnu, Fri Lakshmi, Sat Shani (editable in admin). Active theme may override (e.g. Navratri → Durga).

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
Free items: `freeOfferingsPerDeityPerDay` (remote config, default 3). Paid items: no limit. Offering valid only if item active and (item has no deity list or deity is in it).

### 6.6 Uploads
Rate limit 10 uploads/user/day. Max original size 15 MB. Allowed: JPEG, PNG, HEIC (convert to JPEG on device). Users with 3+ rejected-as-inappropriate uploads are auto-blocked from uploading (admin can unblock).

### 6.7 Content licence
Terms of Use must state: uploader confirms they own the photo; grants the app a non-exclusive, worldwide, royalty-free licence to display, resize and distribute it within the app and its promotions; can delete it anytime (removal from public within 72 h). A takedown contact email must exist. **Get this clause reviewed by a lawyer before launch.**

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
| GET | `/deities/:deityId/offerings` | | Items valid for deity, grouped by kind |
| POST | `/mandir/offerings` | `mandir.offerings` (paid items also need `mandir.premium_offerings`) | Idempotency-Key required |
| GET | `/deities/:deityId/aartis` | | With signed/CDN URLs + version |
| POST | `/mandir/rituals/aarti-complete` | | `{ deityId, aartiId, playedRatio, circles }` |
| POST | `/mandir/rituals/darshan` | | Presence ping for streak (≥20 s) |
| GET | `/me/streak` | | Streak + badges + month calendar |

`GET /mandir/home` response:
```json
{
  "data": {
    "today": { "localDate": "2026-09-29", "weekday": 2, "tithiText": "मंगलवार, आश्विन कृष्ण पक्ष तृतीया" },
    "theme": { "key": "default", "frameUrl": "…", "colors": { } },
    "defaultDeityId": "…",
    "deities": [{
      "id": "…", "slug": "hanuman", "nameHi": "हनुमान जी", "position": 0, "isPinned": false,
      "image": { "id": "…", "source": "COMMUNITY", "urls": { "thumb": "…", "card": "…", "full": "…", "hd": "…" },
                 "anchor": { "x": 0.5, "y": 0.35 }, "credit": { "name": "Ramesh", "temple": "Hanuman Garhi, Ayodhya" } },
      "specialOffering": { "itemId": "…", "labelHi": "सिंदूर चढ़ाएं" },
      "defaultAartiId": "…"
    }],
    "todayOfferings": { "<deityId>": { "flowers": 14, "mala": true, "diya": true, "bhog": false } },
    "coins": { "balance": 42 },
    "streak": { "current": 5, "longest": 12, "doneToday": true },
    "limits": { "freeOfferingsPerDeityPerDay": 3 }
  }
}
```
Note: Phase 1 `tithiText` comes from a simple server-side panchang util or a precomputed table; full Panchang is Phase 2.

`POST /mandir/offerings`
```json
// request
{ "deityId": "…", "offeringItemId": "…" }
// 200
{ "data": { "coinsBalance": 37, "coinsSpent": 5, "streak": { "current": 6, "doneToday": true },
            "reward": { "ruleKey": "FIRST_DARSHAN_OF_DAY", "coins": 1 } | null,
            "todayOfferings": { "flowers": 25, "mala": true, "diya": true, "bhog": false } } }
// errors: 402 COINS_INSUFFICIENT { details: { required: 5, balance: 2 } }, 409 FREE_LIMIT_REACHED, 404 ITEM_NOT_AVAILABLE
```

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

App purchase flow: RevenueCat `purchasePackage` → on success poll `GET /coins/wallet` (max 10 s, backoff) until balance increases → show success. The app **never** credits coins itself.

### Config
`GET /v1/config` (Foundation) returns flags and remote config including `freeOfferingsPerDeityPerDay`, `uploadMaxPerDay`, `shareAppLink`.

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
| Aartis | Upload audio + lyrics JSON, preview with synced lyrics, set default, licence info |
| Coins | Packs (map to store product ids), reward rules |
| Themes | Create/schedule festival themes |
| Feature flags | Toggle, rollout %, platforms, min app version |
| Moderation log | Audit trail |

---

## 11. Analytics events

`mandir_opened`, `deity_switched {deityId, via}`, `bell_rung`, `offering_sheet_opened {kind}`, `offering_made {itemId, kind, coins}`, `offering_blocked {reason}`, `aarti_started {aartiId}`, `aarti_completed {aartiId, circles, auto}`, `aarti_abandoned {playedRatio}`, `coin_pack_viewed`, `coin_purchase_started {packId}`, `coin_purchase_succeeded`, `coin_purchase_failed {reason}`, `darshan_chooser_opened`, `image_selected {source}`, `upload_started {source}`, `upload_submitted`, `upload_failed {reason}`, `image_reported {reason}`, `share_card_shared`, `streak_badge_earned {badge}`.

---

## 12. Assets & content needed before launch

| Asset | Spec | Count |
|---|---|---|
| Official deity images | Portrait 3:4, ≥1440×1920, JPEG/PNG; artwork or licensed photos with licence record | 1–3 per deity, 10 deities |
| Frame (default theme) | Transparent PNG arch + pillars + toran, 1440×2560 | 1 |
| Bells | Sprite PNG + bell sound (short, clean) | 1 + 2 sounds |
| Shankh sound | ≤3 s | 1 |
| Offering sprites | Flowers (genda, gulab, kamal), mala, diya, bhog thali, sindoor | ~10 |
| Aarti audio | 1 per deity (licensed recordings — traditional lyrics are old, but recordings have copyright) + lyrics timeline JSON | 10 |
| Fallback | 1 generic bundled artwork + bell sound | bundled |

Seed deities: Ganesh, Shiv, Hanuman, Vishnu, Lakshmi, Durga, Krishna, Ram, Shani, Surya.

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
- [ ] **T2 Prisma schema + migration** — all models in §5. *AC:* `pnpm db:migrate` succeeds; schema matches doc.
- [ ] **T3 Seed** — 10 deities (weekday map), 10 temples, placeholder official images (use bundled sample images uploaded to the local `media-public` bucket), offering items (free + paid per kind, sindoor for Hanuman, jal for Shiv, tel for Shani), 1 aarti per deity (placeholder audio + lyrics JSON), 4 coin packs, reward rules, flags, default theme, dev-user with 50 coins. *AC:* `pnpm db:seed` idempotent.
- [ ] **T4 Home + deities APIs** — `/mandir/home`, `/deities`, `/mandir/deities`, `/mandir/deities/:id/image`, image resolution rules §6.2. *AC:* e2e tests for default deity logic and image fallback.
- [ ] **T5 Coin wallet core** — wallet service with transactional credit/debit, idempotency interceptor, transactions API. *AC:* concurrent debit test cannot go negative; repeated Idempotency-Key returns same response.
- [ ] **T6 Offerings API** — `/deities/:id/offerings`, `POST /mandir/offerings` incl. free daily limit, streak update, reward evaluation. *AC:* e2e for free, paid, insufficient, limit reached, reward granted once.
- [ ] **T7 Aarti + rituals APIs** — aarti list with URLs, aarti-complete, darshan ping, `/me/streak`, badges. *AC:* streak unit tests incl. timezone boundary.
- [ ] **T8 App shell** — providers, API client, config fetch + flags hook, theme, i18n (hi default), fonts, tab layout (Mandir + Profile only). *AC:* dev build runs on Android + iOS.
- [ ] **T9 VM-01 static layout** — zones, layered scene, carousel, coin pill, tithi strip, loading/offline/error states, fallback image. *AC:* matches layout on small (360dp) and large phones.
- [ ] **T10 Deity switching + Sangrah (VM-02, VM-03)** — incl. reorder, pin, persist. *AC:* choice persists across app restarts via API.
- [ ] **T11 Bells** — §4.2. *AC:* no audio lag on low-end Android; haptics work.
- [ ] **T12 Offering sheets + animations (VM-05, §4.4)** — Skia particles, mala anchor, diya, pile stages, coins update, insufficient → VM-07. *AC:* 60 fps with 30 particles on a low-end test device.
- [ ] **T13 Aarti mode (VM-06, §4.3, §4.5)** — manual/auto thali, circle counting, audio, lyrics sync, background + lock-screen, completion. *AC:* completion rules enforced; audio continues when screen locks.
- [ ] **T14 Offline cache** — images + aarti audio/lyrics cached; offline states. *AC:* airplane mode: darshan, bells, free offerings (queued) and cached aarti work.
- [ ] **T15 Coins purchase (VM-07)** — RevenueCat SDK, packs screen, webhook endpoint, polling, history, reward rules list. *AC:* sandbox purchase on both stores credits coins exactly once; duplicate webhook ignored.
- [ ] **T16 Image upload pipeline (API)** — upload-url, submit, BullMQ `image.process` (sharp variants, pHash, ModerationProvider with a `mock` provider for local), state machine + logs, rate limits, temple search/create. *AC:* state machine tests pass; unsafe mock image → AUTO_REJECTED.
- [ ] **T17 Upload flow in app (VM-08, VM-14)** — permissions, crop with arch overlay, size checks, details, consent, progress, success. *AC:* uploaded image immediately usable in own mandir.
- [ ] **T18 Darshan chooser, gallery, my uploads, report (VM-04, VM-09, VM-10, VM-11)**. *AC:* visibility table §6.2 verified with two test users.
- [ ] **T19 Streak screen + share card (VM-12, VM-13)**. *AC:* share card renders correctly in Hindi and shares to WhatsApp.
- [ ] **T20 Admin: content** — deities, official images (anchor picker), offerings, aartis (lyrics preview), coin packs, reward rules, themes, flags. *AC:* changes reflect in app without app update.
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
