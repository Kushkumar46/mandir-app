# 00 — Product Overview

## 1. Vision

Keep people spiritually connected every day. The app is a digital mandir in the user's pocket, built on **real temple photos**, plus services that connect devotees with real temples, pandits and astrologers.

## 2. Reference product

Sri Mandir (srimandir.com) is the closest existing product. What we take and where we differ:

| Area | Sri Mandir | Our app |
|---|---|---|
| Virtual mandir | Deity images (largely illustrated/AI-style) | **Real temple photos**: official + community-uploaded, admin-approved |
| Community content | — | Users upload temple photos, get credit + coins when approved |
| Puja booking | Group puja at partner temples, video + Aashirwad box | Same (Phase 3) |
| Personal pandit | Not offered | **Hire a pandit** for 1-on-1 online or home puja (Phase 4) |
| Astrologer | Consultation inside app | Chat + call with per-minute wallet billing (Phase 5) |
| Store | Separate website | In-app store (Phase 6) |

## 3. Users

| Role | App |
|---|---|
| Devotee | `devotee-app` |
| Admin / content team | `admin-web` |
| Pandit, Astrologer | `partner-app` (Phase 4+) |

## 4. Bottom navigation (final shape)

**Mandir** (home) · **Seva** (Puja, Chadhava, Pandit) · **Jyotish** · **Store** · **Profile**

In Phase 1 only **Mandir** and **Profile** tabs are visible; other tabs are hidden by feature flags.

## 5. Phases

| Phase | Scope | Release goal |
|---|---|---|
| **1** | Project foundation, Auth + Onboarding, **Virtual Mandir + Community Darshan images**, Coins (IAP), Streaks, Share card, Admin (content + moderation) | First public release on Play Store + App Store. Measure engagement. |
| 2 | Panchang, Festival calendar, Library (aarti/chalisa/mantra), Music player, Mantra jaap counter, Notifications & darshan reminders | Daily habit |
| 3 | Common Orders + Payments (Razorpay), Puja Seva, Chadhava, Temple directory | Revenue |
| 4 | Pandit hire (online + home visit), Partner app | Differentiator |
| 5 | Jyotish: astrologer chat/call, rupee wallet, kundli tools | Revenue |
| 6 | Store + Prasad delivery | Revenue |

Each phase gets its own module docs, written after the previous phase is built and tested.

## 6. Phase 1 success metrics

- D1 / D7 / D30 retention
- % of daily users who complete an aarti
- Average streak length
- Community uploads per week and approval rate
- Share-card shares per day
- Coin purchase conversion rate

## 7. Screen inventory (all phases, for reference)

~62 devotee-app screens. Phase 1 builds: onboarding/login (7), Virtual Mandir and its sheets/flows (14), Profile basics (5). The full list lives in each module doc.
