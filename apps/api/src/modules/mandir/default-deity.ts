export interface DefaultDeityCandidate {
  id: string;
  weekday: number | null;
  position: number;
  isPinned: boolean;
}

/**
 * §6.1 default deity of the day: pinned deity → active festival theme's deity (if in the user's
 * mandir) → today's weekday deity (if in the user's mandir) → first deity by position.
 * Returns null only for an empty mandir.
 */
export function pickDefaultDeity(
  deities: DefaultDeityCandidate[],
  weekday: number,
  themeDeityIds: readonly string[] = [],
): string | null {
  const ordered = [...deities].sort((a, b) => a.position - b.position);
  return (
    ordered.find((d) => d.isPinned)?.id ??
    ordered.find((d) => themeDeityIds.includes(d.id))?.id ??
    ordered.find((d) => d.weekday === weekday)?.id ??
    ordered[0]?.id ??
    null
  );
}
