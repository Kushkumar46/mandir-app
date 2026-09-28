import {
  anchorPoint,
  archRect,
  coverStage,
  mandirLayout,
  overlaps,
  pickImageVariant,
  pileStage,
  RAIL_ITEM_MIN,
  RAIL_ITEMS,
  type Rect,
} from './layout';

/**
 * Scene areas (between the top bar and the tab bar) of real phones:
 * 360×640 dp old small phone, 360×800 dp common ₹10k phone, 412×915 dp large phone, 480×1000 dp.
 */
const PHONES = {
  small16x9: { width: 360, height: 440 },
  small360: { width: 360, height: 600 },
  large412: { width: 412, height: 705 },
  xl480: { width: 480, height: 780 },
};

describe('coverStage / archRect', () => {
  it('covers the area with a 9:16 stage, centred', () => {
    const stage = coverStage({ width: 360, height: 600 });
    expect(stage.width).toBe(360);
    expect(stage.height).toBe(640);
    expect(stage.y).toBe(-20);

    const wide = coverStage({ width: 360, height: 440 });
    expect(wide.width).toBe(360);
    expect(wide.y).toBe(-100);

    const tall = coverStage({ width: 360, height: 800 });
    expect(tall.height).toBe(800);
    expect(tall.width).toBe(450);
    expect(tall.x).toBe(-45);
  });

  it('places the arch opening inside the frame box', () => {
    const arch = archRect({ x: 0, y: 0, width: 1440, height: 2560 });
    expect(arch).toEqual({ x: 180, y: 360, width: 1080, height: 2000 });
  });
});

describe('anchorPoint', () => {
  it('maps the image anchor through the cover crop of the arch', () => {
    const arch: Rect = { x: 45, y: 90, width: 270, height: 500 };
    // 3:4 image covering 270×500 → 375×500, cropped 52.5 on each side.
    expect(anchorPoint(arch, { x: 0.5, y: 0.35 })).toEqual({ x: 180, y: 90 + 175 });
    expect(anchorPoint(arch, { x: 0, y: 0 })).toEqual({ x: 45 - 52.5, y: 90 });
    expect(anchorPoint(arch, null)).toEqual(anchorPoint(arch, { x: 0.5, y: 0.35 }));
  });
});

describe('pickImageVariant', () => {
  it('picks the smallest variant at least as wide as drawn', () => {
    expect(pickImageVariant(200)).toBe('thumb');
    expect(pickImageVariant(540)).toBe('card');
    expect(pickImageVariant(810)).toBe('full');
    expect(pickImageVariant(1200)).toBe('hd');
    expect(pickImageVariant(4000)).toBe('hd');
  });
});

describe('pileStage', () => {
  it('grows in 3 stages', () => {
    expect([0, 1, 10, 11, 30, 31, 500].map(pileStage)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe.each(Object.entries(PHONES))('mandirLayout on %s', (_name, area) => {
  const l = mandirLayout(area);
  const within = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.width <= area.width + 0.001 && r.y + r.height <= area.height + 0.001;
  const railRect: Rect = { x: l.rail.left, y: l.rail.top, width: l.rail.width, height: l.rail.height };
  const thaliRect: Rect = { x: l.thali.left, y: area.height - l.thali.bottom - l.thali.size, width: l.thali.size, height: l.thali.size };
  const actionsRect: Rect = {
    x: area.width - l.actions.right - l.actions.width,
    y: area.height - l.actions.bottom - 160,
    width: l.actions.width,
    height: 160, // special badge (~104) + gap + Listen (48)
  };
  const leftBell: Rect = { x: l.bells.leftX, y: l.bells.top, width: l.bells.size, height: l.bells.size };
  const rightBell: Rect = { x: l.bells.rightX, y: l.bells.top, width: l.bells.size, height: l.bells.size };

  it('keeps every control on screen', () => {
    for (const r of [railRect, thaliRect, actionsRect, leftBell, rightBell, l.feet]) expect(within(r)).toBe(true);
  });

  it('keeps controls apart', () => {
    expect(overlaps(railRect, thaliRect)).toBe(false);
    expect(overlaps(railRect, actionsRect)).toBe(false);
    expect(overlaps(railRect, leftBell)).toBe(false);
    expect(overlaps(thaliRect, actionsRect)).toBe(false);
    expect(overlaps(l.feet, thaliRect)).toBe(false);
    expect(overlaps(l.feet, actionsRect)).toBe(false);
    expect(overlaps(l.feet, railRect)).toBe(false);
    expect(overlaps(leftBell, rightBell)).toBe(false);
  });

  it('gives rail items at least a 48dp tap target plus a label', () => {
    expect(l.rail.itemHeight).toBeGreaterThanOrEqual(RAIL_ITEM_MIN);
    expect(l.rail.scrolls).toBe(l.rail.itemHeight * RAIL_ITEMS > l.rail.height);
  });

  it('shows the whole width of the arch', () => {
    expect(l.arch.x).toBeGreaterThanOrEqual(0);
    expect(l.arch.x + l.arch.width).toBeLessThanOrEqual(area.width);
  });
});

it('fits all 5 rail items without scrolling on a 360×800 phone', () => {
  expect(mandirLayout(PHONES.small360).rail.scrolls).toBe(false);
  expect(mandirLayout(PHONES.large412).rail.scrolls).toBe(false);
});
