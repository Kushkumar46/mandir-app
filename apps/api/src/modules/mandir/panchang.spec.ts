import { tithiAt, tithiText } from './panchang.js';

describe('tithiText (Phase 1 tithi strip)', () => {
  it('matches the §7 example date', () => {
    expect(tithiText('2026-09-29', 'Asia/Kolkata', 'hi')).toBe('मंगलवार, आश्विन कृष्ण पक्ष तृतीया');
    expect(tithiText('2026-09-29', 'Asia/Kolkata', 'en')).toBe('Tuesday, Ashvin Krishna Paksha Tritiya');
  });

  it.each([
    // Known festival dates (tithi prevailing at sunrise, purnimanta months).
    ['2025-07-10', 'गुरुवार, आषाढ़ शुक्ल पक्ष पूर्णिमा'], // Guru Purnima
    ['2025-08-16', 'शनिवार, भाद्रपद कृष्ण पक्ष अष्टमी'], // Janmashtami
    ['2025-10-21', 'मंगलवार, कार्तिक कृष्ण पक्ष अमावस्या'], // Diwali (Lakshmi puja amavasya)
  ])('%s → %s', (date, expected) => {
    expect(tithiText(date, 'Asia/Kolkata', 'hi')).toBe(expected);
  });

  it('falls back to Hindi for unknown languages', () => {
    expect(tithiText('2026-09-29', 'Asia/Kolkata', 'xx')).toMatch(/^मंगलवार/);
  });

  it('tithi index stays within 1..30', () => {
    for (let d = 0; d < 60; d++) {
      const { index } = tithiAt(new Date(Date.UTC(2026, 0, 1 + d)));
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(30);
    }
  });
});
