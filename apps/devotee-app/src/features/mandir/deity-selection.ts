import type { HomeDeity, MandirTheme } from '@mandir/shared-types';

/**
 * The deity VM-01 shows: the one the user switched to in this session (if still in their mandir),
 * else the server's default deity of the day (§6.1: pinned → festival → weekday → first), else the first.
 */
export function resolveSelectedDeity(
  deities: readonly HomeDeity[],
  selectedId: string | null,
  defaultId: string | null,
): HomeDeity | null {
  return (
    deities.find((d) => d.id === selectedId) ?? deities.find((d) => d.id === defaultId) ?? deities[0] ?? null
  );
}

/** A string colour from the theme's `colors` map (admin-edited JSON), else `fallback`. */
export function themeColor(theme: MandirTheme | null | undefined, key: string, fallback: string): string {
  const value = theme?.colors[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
