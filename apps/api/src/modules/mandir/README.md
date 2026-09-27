# mandir

Virtual Mandir: home screen payload, user deity list, offerings, aarti + darshan rituals.
Spec: `docs/modules/01-virtual-mandir.md` (§6, §7 "Mandir").

- `mandir.controller.ts` — `/v1/mandir/*`
- `deities.controller.ts` — `/v1/deities/*`

Uses `CoinsService` (spend/reward) and `StreaksService` (darshan day) through their exported services.
