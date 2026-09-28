import * as Haptics from 'expo-haptics';

/** Medium impact (bell strike, offering). Devices without a vibrator simply do nothing. */
export function impactMedium() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Light tick (selections). */
export function selectionTick() {
  void Haptics.selectionAsync().catch(() => undefined);
}
