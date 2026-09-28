import type { ImageVariantUrls } from '@mandir/shared-types';

/**
 * VM-01 geometry (docs/modules/01-virtual-mandir.md §2 VM-01, §4.1). Pure functions so the layout
 * can be unit-tested for small (360dp) and large phones.
 *
 * The scene is drawn on a 9:16 "stage" that covers the area between the top bar and the tab bar
 * (like `contentFit="cover"`), so the theme frame and the deity image always line up.
 */

export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

/**
 * Theme frame contract (§4.1): a 9:16 image whose transparent arch opening spans this box
 * (fractions of the frame). The seeded default frame is 1440×2560 with the opening at
 * x 180–1260, y 360–2360.
 */
export const FRAME = {
  aspect: 9 / 16,
  arch: { left: 0.125, right: 0.875, top: 0.140625, bottom: 0.921875 },
} as const;

/** Deity images are portrait 3:4 (all variants, docs/01-architecture.md §6). */
export const DEITY_IMAGE_ASPECT = 3 / 4;

/** Default mala anchor when the image has none (§4.4: centred, 35% from the top). */
export const DEFAULT_ANCHOR = { x: 0.5, y: 0.35 } as const;

/** The 9:16 stage covering `area`, centred (parts may lie outside the area and are clipped). */
export function coverStage(area: Size, aspect: number = FRAME.aspect): Rect {
  const areaAspect = area.width / area.height;
  const width = areaAspect > aspect ? area.width : area.height * aspect;
  const height = width / aspect;
  return { x: (area.width - width) / 2, y: (area.height - height) / 2, width, height };
}

/** The arch opening of the frame on the stage — the deity image fills this box. */
export function archRect(stage: Rect): Rect {
  const { left, right, top, bottom } = FRAME.arch;
  return {
    x: stage.x + stage.width * left,
    y: stage.y + stage.height * top,
    width: stage.width * (right - left),
    height: stage.height * (bottom - top),
  };
}

/** Rect of an image of `aspect` drawn with `contentFit="cover"` inside `box` (centred). */
export function coverRect(box: Rect, aspect: number): Rect {
  const boxAspect = box.width / box.height;
  const width = boxAspect > aspect ? box.width : box.height * aspect;
  const height = width / aspect;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** Screen point of an image anchor (0..1 of the image) when the image covers the arch. */
export function anchorPoint(arch: Rect, anchor: { x: number; y: number } | null, aspect = DEITY_IMAGE_ASPECT) {
  const img = coverRect(arch, aspect);
  const a = anchor ?? DEFAULT_ANCHOR;
  return { x: img.x + a.x * img.width, y: img.y + a.y * img.height };
}

const VARIANT_ORDER = ['thumb', 'card', 'full', 'hd'] as const satisfies readonly (keyof ImageVariantUrls)[];
export const VARIANT_WIDTH: Record<keyof ImageVariantUrls, number> = { thumb: 240, card: 540, full: 1080, hd: 1440 };

/**
 * Smallest variant at least as wide as the image is drawn (in physical pixels) — §4.6: load `card`
 * first, then this; never decode more than needed. Falls back to `hd` for very large displays.
 */
export function pickImageVariant(drawnWidthPx: number): keyof ImageVariantUrls {
  return VARIANT_ORDER.find((v) => VARIANT_WIDTH[v] >= drawnWidthPx) ?? 'hd';
}

/**
 * Flowers pile stage at the deity's feet (§4.4 "pile grows in 3 stages based on today's count"):
 * 0 = none, 1 = a few (1–10), 2 = a heap (11–30), 3 = a big heap (31+).
 */
export function pileStage(flowers: number): 0 | 1 | 2 | 3 {
  if (flowers <= 0) return 0;
  if (flowers <= 10) return 1;
  if (flowers <= 30) return 2;
  return 3;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Rail buttons: 5 (Phool, Mala, Diya, Bhog, Sangrah); each ≥ 48dp tap target + label. */
export const RAIL_ITEMS = 5;
export const RAIL_ITEM_MIN = 60;
export const RAIL_ITEM_MAX = 76;

export type MandirLayout = {
  stage: Rect;
  arch: Rect;
  tithi: { top: number; height: number };
  bells: { size: number; top: number; leftX: number; rightX: number };
  /** Left vertical rail; `scrolls` when 5 items don't fit even at the minimum height. */
  rail: { top: number; left: number; width: number; height: number; itemHeight: number; scrolls: boolean };
  thali: { size: number; bottom: number; left: number };
  /** Bottom-right column: special offering badge + Listen. */
  actions: { width: number; right: number; bottom: number };
  /** Today's offerings at the deity's feet, just above the thali. */
  feet: Rect;
};

/** Positions of everything in the scene area (the space between the top bar and the tab bar). */
export function mandirLayout(area: Size): MandirLayout {
  const { width: W, height: H } = area;
  const stage = coverStage(area);
  const arch = archRect(stage);

  const tithi = { top: 4, height: 36 };

  const bellSize = Math.round(clamp(W * 0.13, 48, 60));
  const bells = { size: bellSize, top: tithi.top + tithi.height + 4, leftX: 6, rightX: W - 6 - bellSize };

  const railTop = bells.top + bellSize + 8;
  const railBottomGap = 8;
  const railAvailable = H - railTop - railBottomGap;
  const itemHeight = Math.floor(clamp(railAvailable / RAIL_ITEMS, RAIL_ITEM_MIN, RAIL_ITEM_MAX));
  const rail = {
    top: railTop,
    left: 6,
    width: 64,
    height: Math.max(0, Math.min(railAvailable, itemHeight * RAIL_ITEMS)),
    itemHeight,
    scrolls: itemHeight * RAIL_ITEMS > railAvailable,
  };

  const thaliSize = Math.round(clamp(W * 0.24, 80, 112));
  const thali = { size: thaliSize, bottom: 12, left: (W - thaliSize) / 2 };

  const actions = { width: 92, right: 8, bottom: 12 };

  const feetHeight = 56;
  const feetBottom = Math.min(arch.y + arch.height, H - thali.bottom - thaliSize - 4);
  const feetWidth = Math.min(arch.width * 0.7, W - 2 * (actions.right + actions.width));
  const feet = { x: (W - feetWidth) / 2, y: feetBottom - feetHeight, width: feetWidth, height: feetHeight };

  return { stage, arch, tithi, bells, rail, thali, actions, feet };
}

/** Do two rects intersect? (used by the layout tests) */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
