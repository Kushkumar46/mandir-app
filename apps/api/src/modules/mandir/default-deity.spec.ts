import { type DefaultDeityCandidate, pickDefaultDeity } from './default-deity.js';

const d = (id: string, position: number, weekday: number | null = null, isPinned = false): DefaultDeityCandidate => ({
  id,
  position,
  weekday,
  isPinned,
});

describe('pickDefaultDeity (§6.1)', () => {
  const TUESDAY = 2;

  it('pinned deity wins over everything', () => {
    const list = [d('ganesh', 0, 3), d('hanuman', 1, TUESDAY), d('durga', 2, null, true)];
    expect(pickDefaultDeity(list, TUESDAY, ['ganesh'])).toBe('durga');
  });

  it('festival theme deity (if in mandir) beats the weekday deity', () => {
    const list = [d('ganesh', 0, 3), d('hanuman', 1, TUESDAY), d('durga', 2)];
    expect(pickDefaultDeity(list, TUESDAY, ['durga'])).toBe('durga');
    expect(pickDefaultDeity(list, TUESDAY, ['not-in-mandir'])).toBe('hanuman');
  });

  it("today's weekday deity when in mandir", () => {
    expect(pickDefaultDeity([d('ganesh', 0, 3), d('hanuman', 1, TUESDAY)], TUESDAY)).toBe('hanuman');
  });

  it('first by position otherwise (input order does not matter)', () => {
    expect(pickDefaultDeity([d('shiv', 5, 1), d('ganesh', 2, 3)], TUESDAY)).toBe('ganesh');
  });

  it('empty mandir → null', () => {
    expect(pickDefaultDeity([], TUESDAY)).toBeNull();
  });
});
