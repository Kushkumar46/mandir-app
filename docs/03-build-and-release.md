# 03 — Build & Release (Android + iOS)

## 1. What gets built

| Output | Platform | Used for |
|---|---|---|
| **APK** | Android | Direct install on phones for testing (share the file / link) |
| **AAB** | Android | Upload to Google Play Store (Play requires AAB, not APK) |
| **IPA** | iOS | TestFlight testing and App Store release. iPhones cannot install an APK. |

All three are built in the cloud with **Expo EAS Build** — no Mac is required to build the iOS app.

## 2. Accounts needed

| Account | Cost | Why |
|---|---|---|
| Expo account | Free tier available | EAS Build / Submit |
| Google Play Console | One-time registration fee | Publish on Play Store |
| Apple Developer Program | Yearly fee | TestFlight + App Store (mandatory even for testing on iPhones beyond a dev device) |
| RevenueCat | Free tier available | Coin in-app purchases |

## 3. App identifiers (set once, never change after release)

- Android package: `com.<company>.<appname>` (placeholder — decide before first build)
- iOS bundle id: same string
- Configure in `apps/devotee-app/app.config.ts` from env: `APP_NAME`, `APP_ID`, `API_URL`.

## 4. `eas.json` profiles

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "local" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "staging" }
    },
    "production": {
      "autoIncrement": true,
      "android": { "buildType": "app-bundle" },
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": { "production": {} }
}
```

## 5. Commands

```
# Dev client (needed because Skia, RevenueCat etc. don't run in Expo Go)
eas build --profile development --platform android
eas build --profile development --platform ios

# Testing builds
eas build --profile preview --platform android     # → APK download link
eas build --profile preview --platform ios         # → install via TestFlight / internal distribution

# Store builds
eas build --profile production --platform all      # → AAB + IPA
eas submit --platform android
eas submit --platform ios
```

Over-the-air JS updates (no store review for JS/asset-only fixes): `eas update --branch production`. Native changes always need a new build.

## 6. Store compliance checklist (Phase 1)

- [ ] Coin packs sold **only** via Apple/Google IAP (they are digital goods).
- [ ] Sign in with Apple offered on iOS if Google login is offered.
- [ ] In-app **account deletion** available (both stores require it).
- [ ] Privacy policy URL + Terms of Use URL (Terms must include the user-uploaded image licence clause — see Virtual Mandir doc).
- [ ] Play Data Safety form + Apple privacy nutrition labels (camera, photos, phone number, purchases).
- [ ] Camera / photo library permission texts in Hindi + English.
- [ ] User-generated content: report button, moderation, and a way to block abusive uploaders (Apple guideline for UGC apps).
- [ ] Background audio capability declared (aarti keeps playing when screen locks).

## 7. Release flow

1. Merge to `main` → CI runs lint/typecheck/tests.
2. `preview` build → share APK + TestFlight with testers.
3. Fix → OTA update or new build.
4. `production` build → submit → staged rollout (Play: 10% → 50% → 100%).
