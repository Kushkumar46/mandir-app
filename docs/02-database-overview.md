# 02 — Database Overview (all modules)

Purpose: a map of every table so modules don't collide. Full column definitions live in each module doc. Only **Phase 1** tables should be created now.

## Core (Phase 1)

| Table | Purpose |
|---|---|
| `users` | id, phone, name, gotra, city, timezone, language, role, created_at |
| `user_auth_providers` | google / apple identities |
| `refresh_tokens` | hashed, rotated |
| `feature_flags` | key, enabled, rollout_percent, platforms, min_app_version, payload |
| `devices` | push tokens, platform, app_version (used in Phase 2) |

## Virtual Mandir (Phase 1) — see `modules/01-virtual-mandir.md`

`deities`, `temples`, `deity_images`, `image_reports`, `moderation_logs`, `offering_items`, `offering_item_deities`, `aartis`, `user_deities`, `ritual_logs`, `user_streaks`, `user_badges`, `themes` (offering kind is an enum, not a table)

Planned (T7b): `thali_designs`, `user_unlocks` (generic permanent purchases: `item_type` THALI now, later bells/frames …), `user_mandir_settings` (`selected_thali_id`)

## Coins (Phase 1)

`coin_wallets`, `coin_transactions`, `coin_packs`, `coin_purchases`, `reward_rules`

## Phase 2 (planned)

`panchang_cache`, `festivals`, `library_items`, `library_categories`, `tracks`, `playlists`, `notifications`, `reminders`, `jaap_sessions`

## Phase 3 (planned)

`orders` (type: PUJA | CHADHAVA | PANDIT | STORE | …), `order_items`, `payments`, `refunds`, `pujas`, `puja_packages`, `puja_addons`, `chadhavas`, `chadhava_items`, `sankalps`, `family_members`, `fulfillment_media` (puja videos), `shipments`

## Phase 4–6 (planned)

`pandits`, `pandit_services`, `pandit_slots`, `astrologers`, `consultations`, `consultation_messages`, `rupee_wallets`, `wallet_transactions`, `products`, `product_variants`, `carts`, `addresses`

## Relationship rules

- Every user-owned row has `user_id` → `users.id` with `ON DELETE CASCADE` **except** financial/audit rows (`coin_transactions`, `payments`, `moderation_logs`), which keep an anonymised reference when a user deletes their account.
- `temples` is shared by Virtual Mandir (photo location), Puja/Chadhava (venue) and the temple directory. Design it once in Phase 1 with room for Phase 3 columns.
- `orders` (Phase 3) is the single checkout table for all purchasable services; do not create per-service order tables.
