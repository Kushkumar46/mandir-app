import { aartiCompleteResponse, HANUMAN, homePayload, offeringResponse, SHIV, thalisPayload, uuid } from '@/test/mandir-fixtures';

import { applyDarshanOutcomeToHome, applyOfferingToHome, markThaliUnlocked, selectThaliInList } from './mandir';

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

describe('applyDarshanOutcomeToHome (aarti-complete)', () => {
  it("takes the server's balance and streak, nothing else", () => {
    const home = homePayload();
    const next = applyDarshanOutcomeToHome(home, aartiCompleteResponse({ coinsBalance: 44, streak: { current: 6, longest: 12, doneToday: true } }));
    expect(next.coins.balance).toBe(44);
    expect(next.streak).toEqual({ current: 6, longest: 12, doneToday: true });
    expect(next.todayOfferings).toBe(home.todayOfferings);
  });
});

describe('thali list updates', () => {
  it('marks a design unlocked without selecting it (§6.8)', () => {
    const next = markThaliUnlocked(thalisPayload(), uuid(401));
    expect(next.items.find((i) => i.id === uuid(401))).toMatchObject({ unlocked: true, selected: false });
    expect(next.selectedThaliId).toBe(uuid(400));
  });

  it('selecting moves the selected flag', () => {
    const next = selectThaliInList(thalisPayload({ unlocked: [uuid(401)] }), uuid(401));
    expect(next.selectedThaliId).toBe(uuid(401));
    expect(next.items.filter((i) => i.selected).map((i) => i.id)).toEqual([uuid(401)]);
  });
});
