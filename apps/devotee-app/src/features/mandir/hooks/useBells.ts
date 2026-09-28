import { useEffect, useState } from 'react';

import { track } from '@/lib/analytics';
import { impactMedium } from '@/lib/haptics';

import { BELL_LOG_INTERVAL_MS, type BellSide, createRateGate } from '../bells';
import { playBell, preloadMandirSounds } from '../sounds';

/**
 * §4.2 bell strike: sound (preloaded, overlapping) + medium haptic; `bell_rung` is logged at most once
 * per minute. The swing is the bell component's own animation.
 */
export function useBellRinger() {
  const [shouldLog] = useState(() => createRateGate(BELL_LOG_INTERVAL_MS));
  useEffect(() => {
    preloadMandirSounds();
  }, []);

  return (side: BellSide) => {
    playBell(side);
    impactMedium();
    if (shouldLog()) track('bell_rung', { side });
  };
}
