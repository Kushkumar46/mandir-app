import { HANUMAN, homePayload, offeringResponse, SHIV } from '@/test/mandir-fixtures';

import { applyOfferingToHome } from './mandir';

describe('applyOfferingToHome', () => {
  it("takes the server's balance, streak and today's offerings for that deity", () => {
    const home = homePayload();
    const next = applyOfferingToHome(
      home,
      HANUMAN,
      offeringResponse({
        coinsBalance: 37,
        coinsSpent: 5,
        streak: { current: 6, longest: 12, doneToday: true },
        todayOfferings: { flowers: 15, mala: true, diya: true, bhog: true },
      }),
    );
    expect(next.coins.balance).toBe(37);
    expect(next.streak).toEqual({ current: 6, longest: 12, doneToday: true });
    expect(next.todayOfferings[HANUMAN]).toEqual({ flowers: 15, mala: true, diya: true, bhog: true });
    expect(next.todayOfferings[SHIV]).toBe(home.todayOfferings[SHIV]);
    expect(home.coins.balance).toBe(42); // not mutated
  });
});
