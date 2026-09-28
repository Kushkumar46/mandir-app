import { aartiLayout, formatClock, isAartiComplete, lyricIndex, lyricWindow, nextPlayedPosition, playedRatioOf } from './aarti';
import { mandirLayout, overlaps } from './layout';

const LYRICS = [0, 5, 10, 15, 20, 25].map((t, i) => ({ t, line: `line ${i + 1}` }));

describe('§4.5 lyrics sync', () => {
  it('current line = last entry with t ≤ currentTime', () => {
    expect(lyricIndex(LYRICS, 0)).toBe(0);
    expect(lyricIndex(LYRICS, 4.99)).toBe(0);
    expect(lyricIndex(LYRICS, 5)).toBe(1);
    expect(lyricIndex(LYRICS, 99)).toBe(5);
    expect(lyricIndex([{ t: 2, line: 'x' }], 1)).toBe(-1);
    expect(lyricIndex([], 3)).toBe(-1);
  });

  it('shows 3 lines with the current one in the middle, except at the ends', () => {
    expect(lyricWindow(LYRICS, 0)).toMatchObject({ start: 0, current: 0 });
    expect(lyricWindow(LYRICS, 2)).toMatchObject({ start: 1, current: 1, lines: [LYRICS[1], LYRICS[2], LYRICS[3]] });
    expect(lyricWindow(LYRICS, 5)).toMatchObject({ start: 3, current: 2 });
    expect(lyricWindow(LYRICS, -1)).toMatchObject({ start: 0, current: -1 });
    expect(lyricWindow(LYRICS.slice(0, 2), 1)).toMatchObject({ start: 0, current: 1, lines: LYRICS.slice(0, 2) });
  });
});

describe('VM-06 completion rule', () => {
  it('needs ≥ 90% played and ≥ 3 circles', () => {
    expect(isAartiComplete({ playedRatio: 0.9, circles: 3 })).toBe(true);
    expect(isAartiComplete({ playedRatio: 0.89, circles: 10 })).toBe(false);
    expect(isAartiComplete({ playedRatio: 1, circles: 2 })).toBe(false);
  });

  it('played = furthest position reached; a finished track counts to the end', () => {
    expect(nextPlayedPosition(0, 5, 30, false)).toBe(5);
    expect(nextPlayedPosition(20, 0, 30, false)).toBe(20); // replay from the start keeps what was played
    expect(nextPlayedPosition(12, 13, 30, true)).toBe(30);
    expect(playedRatioOf(27, 30)).toBeCloseTo(0.9);
    expect(playedRatioOf(40, 30)).toBe(1);
    expect(playedRatioOf(10, 0)).toBe(0);
  });

  it('formats the clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.7)).toBe('1:05');
  });
});

describe('aarti overlay layout', () => {
  // Scene area with the tab bar hidden: small (360×640 phone) to large.
  const phones = [
    { width: 360, height: 420 },
    { width: 360, height: 500 },
    { width: 360, height: 660 },
    { width: 412, height: 780 },
    { width: 480, height: 820 },
  ];

  it.each(phones)('keeps the whole circle between the top and the panel (%o)', (area) => {
    for (const picker of [false, true]) {
      const layout = mandirLayout(area);
      const g = aartiLayout(area, layout.arch, null, picker);
      const half = g.thaliSize / 2;
      expect(g.center.y - g.radii.ry - half).toBeGreaterThanOrEqual(4);
      expect(g.center.y + g.radii.ry + half).toBeLessThanOrEqual(g.panel.y);
      expect(g.center.x - g.radii.rx - half).toBeGreaterThanOrEqual(0);
      expect(g.center.x + g.radii.rx + half).toBeLessThanOrEqual(area.width);
      expect(g.radii.rx).toBeCloseTo(area.width * 0.28);
      expect(g.panel.y + g.panel.height).toBe(area.height);
      // on regular phones the thali at the side of the circle never covers a bell
      const side = { x: g.center.x - g.radii.rx - half, y: g.center.y - half, width: g.thaliSize, height: g.thaliSize };
      const bell = { x: layout.bells.leftX, y: layout.bells.top, width: layout.bells.size, height: layout.bells.size };
      if (area.height >= 600) expect(overlaps(side, bell)).toBe(false);
    }
  });

  it('is a full circle on regular phones and a slight ellipse on short screens', () => {
    const tall = aartiLayout(phones[1], mandirLayout(phones[1]).arch, null, true); // 360×640 phone
    expect(tall.radii.ry).toBeCloseTo(tall.radii.rx);
    const short = aartiLayout(phones[0], mandirLayout(phones[0]).arch, null, true);
    expect(short.radii.ry).toBeLessThan(short.radii.rx);
  });

  it('puts P in front of the chest (below the anchor) when it fits', () => {
    const area = phones[3];
    const layout = mandirLayout(area);
    const high = aartiLayout(area, layout.arch, { x: 0.5, y: 0.2 }, false);
    const low = aartiLayout(area, layout.arch, { x: 0.5, y: 0.45 }, false);
    expect(low.center.y).toBeGreaterThanOrEqual(high.center.y);
    expect(high.center.x).toBe(area.width / 2);
  });
});
