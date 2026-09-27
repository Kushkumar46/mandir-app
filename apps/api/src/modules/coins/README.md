# coins

Virtual coins: wallet, transaction history, coin packs, reward rules, RevenueCat webhook.
Spec: `docs/modules/01-virtual-mandir.md` (§5 Coins models, §6.4, §7 "Coins").

Every balance change goes through `CoinsService` (one DB transaction, wallet row `FOR UPDATE`,
never below 0). Other modules spend coins only via the exported `CoinsService` and pay reward rules
only via the exported `RewardsService` (caps per §6.4).
