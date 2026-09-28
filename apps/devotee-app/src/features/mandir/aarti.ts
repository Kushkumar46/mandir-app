import { AARTI_MIN_CIRCLES, AARTI_MIN_PLAYED_RATIO, type AartiLyrics } from '@mandir/shared-types';

import type { Point, Radii } from './animations/thali';
import { anchorPoint, DEFAULT_ANCHOR, type Rect, type Size } from './layout';

/**
 * VM-06 Aarti mode rules and geometry (docs/modules/01-virtual-mandir.md §2 VM-06, §4.3, §4.5).
 * Pure so they can be unit-tested; the aarti components and hooks use them.
 */

/** §4.5: current line = the last entry with `t ≤ currentTime`; −1 before the first line. */
export function lyricIndex(lyrics: AartiLyrics, currentTime: number): number {
  let index = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].t <= currentTime) index = i;
    else break;
  }
  return index;
}

export const LYRIC_LINES_VISIBLE = 3;

/**
 * The 3 visible lines (§2 VM-06 "3 visible lines, current line highlighted, auto-scroll"): the
 * current line in the middle, except at the start and the end of the text. `current` is the
 * highlighted line's position in `lines` (−1 before the first line).
 */
export function lyricWindow(lyrics: AartiLyrics, index: number): { start: number; lines: AartiLyrics; current: number } {
  const start = Math.max(0, Math.min(index - 1, lyrics.length - LYRIC_LINES_VISIBLE));
  return { start, lines: lyrics.slice(start, start + LYRIC_LINES_VISIBLE), current: index < 0 ? -1 : index - start };
}

/**
 * Furthest point of the audio reached, in seconds. Playback only moves forward (no seek controls in
 * the app or on the lock screen), so this is how much was played — also when status updates pause
 * while the screen is locked. A finished track counts as played to the end.
 */
export function nextPlayedPosition(prev: number, currentTime: number, duration: number, didJustFinish: boolean): number {
  if (didJustFinish && duration > 0) return duration;
  return Math.max(prev, currentTime);
}

/** Share of the audio played, 0..1 (API `playedRatio`). Unknown duration → 0. */
export function playedRatioOf(playedSec: number, durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return Math.min(1, Math.max(0, playedSec / durationSec));
}

/** VM-06 completion: ≥ 90% of the audio played **and** ≥ 3 full circles (Auto reports the circles it made). */
export function isAartiComplete({ playedRatio, circles }: { playedRatio: number; circles: number }): boolean {
  return playedRatio >= AARTI_MIN_PLAYED_RATIO && circles >= AARTI_MIN_CIRCLES;
}

/** "m:ss" for the progress line. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type AartiLayout = {
  /** Bottom panel: lyrics, progress, controls (+ thali picker). */
  panel: Rect;
  /** Point P the thali circles around (in front of the deity's chest). */
  center: Point;
  radii: Radii;
  thaliSize: number;
};

const PANEL_BASE = 156; // lyrics (3 lines) + progress + controls row
export const PANEL_PICKER_HEIGHT = 68; // thali picker strip

/**
 * Geometry of the aarti overlay inside the scene area (same coordinates as `MandirLayout`; the
 * overlay's header covers the top bar, and the tab bar is hidden while it is open). The circle's
 * radius is 28% of the screen width (§4.3); on short screens the vertical radius shrinks (a slight
 * ellipse, §4.3) so the thali never goes under the panel. P sits in front of the deity's chest, as
 * far as the circle fits.
 */
export function aartiLayout(area: Size, arch: Rect, anchor: { x: number; y: number } | null, withPicker: boolean): AartiLayout {
  const { width: W, height: H } = area;
  const panelHeight = PANEL_BASE + (withPicker ? PANEL_PICKER_HEIGHT : 0);
  const panel = { x: 0, y: Math.max(0, H - panelHeight), width: W, height: Math.min(H, panelHeight) };

  const thaliSize = Math.round(Math.min(88, Math.max(64, W * 0.18)));
  const top = 4;
  const bottom = panel.y - 4;
  const rx = W * 0.28;
  const ry = Math.max(16, Math.min(rx, (bottom - top - thaliSize) / 2));

  // Chest: a little below the mala anchor (neck), centred on the deity.
  const a = anchor ?? DEFAULT_ANCHOR;
  const chest = anchorPoint(arch, { x: 0.5, y: a.y + 0.1 });
  const minY = top + ry + thaliSize / 2;
  const maxY = bottom - ry - thaliSize / 2;
  const cy = minY <= maxY ? Math.min(maxY, Math.max(minY, chest.y)) : (top + bottom) / 2;

  return { panel, center: { x: W / 2, y: cy }, radii: { rx, ry }, thaliSize };
}
