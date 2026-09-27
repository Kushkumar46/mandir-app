import { weekdayOf, zonedTime } from '../../core/time/local-date.js';

/**
 * Phase 1 tithi strip (docs/modules/01-virtual-mandir.md §7 note): a simple server-side util,
 * not a full Panchang (Phase 2). Tithi is taken at 06:00 local time (≈ sunrise) from low-precision
 * sun/moon longitudes (Meeus ch. 25 + main terms of ch. 47, error of a few arc-minutes, so a tithi
 * that changes within minutes of 06:00 can be off by one). Month names follow the purnimanta
 * (North Indian) calendar; adhik maas is not detected.
 */

const RAD = Math.PI / 180;
const SYNODIC_DEG_PER_DAY = 360 / 29.530589;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const sin = (deg: number) => Math.sin(deg * RAD);

function centuriesSinceJ2000(instant: Date): number {
  return (instant.getTime() / 86_400_000 + 2440587.5 - 2451545.0) / 36525;
}

/** Apparent tropical longitude of the sun (degrees), nutation omitted. */
function sunLongitude(t: number): number {
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m) + (0.019993 - 0.000101 * t) * sin(2 * m) + 0.000289 * sin(3 * m);
  return norm(l0 + c - 0.00569);
}

// [D, M, M', F, coefficient × 1e-6 deg] — largest periodic terms of the moon's longitude.
const MOON_TERMS: [number, number, number, number, number][] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
];

/** Tropical longitude of the moon (degrees), nutation omitted (it cancels in the elongation). */
function moonLongitude(t: number): number {
  const lp = 218.3164477 + 481267.88123421 * t;
  const d = 297.8501921 + 445267.1114034 * t;
  const m = 357.5291092 + 35999.0502909 * t;
  const mp = 134.9633964 + 477198.8675055 * t;
  const f = 93.272095 + 483202.0175233 * t;
  const e = 1 - 0.002516 * t;
  let sum = 0;
  for (const [cd, cm, cmp, cf, coef] of MOON_TERMS) {
    sum += coef * e ** Math.abs(cm) * sin(cd * d + cm * m + cmp * mp + cf * f);
  }
  return norm(lp + sum / 1e6);
}

/** Moon − sun longitude, 0..360. 0 = new moon (amavasya ends), 180 = full moon (purnima ends). */
export function elongation(instant: Date): number {
  const t = centuriesSinceJ2000(instant);
  return norm(moonLongitude(t) - sunLongitude(t));
}

/** Lahiri ayanamsa (degrees), linear approximation. */
function ayanamsa(t: number): number {
  return 23.85282 + 1.396971 * t;
}

function previousNewMoon(instant: Date): Date {
  let ms = instant.getTime() - (elongation(instant) / SYNODIC_DEG_PER_DAY) * 86_400_000;
  for (let i = 0; i < 4; i++) {
    let e = elongation(new Date(ms));
    if (e > 180) e -= 360;
    ms -= (e / SYNODIC_DEG_PER_DAY) * 86_400_000;
  }
  return new Date(ms);
}

export interface Tithi {
  /** 1..30 (1–15 shukla, 16–30 krishna; 15 = purnima, 30 = amavasya). */
  index: number;
  paksha: 'shukla' | 'krishna';
  /** 0 = Chaitra … 11 = Phalguna (purnimanta). */
  month: number;
}

export function tithiAt(instant: Date): Tithi {
  const index = Math.floor(elongation(instant) / 12) + 1;
  const paksha = index <= 15 ? 'shukla' : 'krishna';
  // Amanta month = named after the sidereal sign of the sun at the new moon that starts it
  // (sun in Meena → Chaitra). Purnimanta krishna paksha belongs to the next month.
  const newMoon = previousNewMoon(instant);
  const t = centuriesSinceJ2000(newMoon);
  const rashi = Math.floor(norm(sunLongitude(t) - ayanamsa(t)) / 30);
  const amanta = (rashi + 1) % 12;
  return { index, paksha, month: paksha === 'krishna' ? (amanta + 1) % 12 : amanta };
}

const TEXT = {
  hi: {
    weekdays: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    months: ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'],
    paksha: { shukla: 'शुक्ल पक्ष', krishna: 'कृष्ण पक्ष' },
    tithis: ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'],
    purnima: 'पूर्णिमा',
    amavasya: 'अमावस्या',
  },
  en: {
    weekdays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    months: ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashvin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'],
    paksha: { shukla: 'Shukla Paksha', krishna: 'Krishna Paksha' },
    tithis: ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'],
    purnima: 'Purnima',
    amavasya: 'Amavasya',
  },
};

/** e.g. "मंगलवार, आश्विन कृष्ण पक्ष तृतीया" for a local date in the user's timezone and language. */
export function tithiText(localDate: string, timezone: string, language: string): string {
  const text = language === 'en' ? TEXT.en : TEXT.hi;
  const { index, paksha, month } = tithiAt(zonedTime(localDate, 6, timezone));
  const inPaksha = ((index - 1) % 15) + 1;
  const name = inPaksha === 15 ? (paksha === 'shukla' ? text.purnima : text.amavasya) : text.tithis[inPaksha - 1];
  return `${text.weekdays[weekdayOf(localDate)]}, ${text.months[month]} ${text.paksha[paksha]} ${name}`;
}
