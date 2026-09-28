import { MandirFlag } from '@mandir/shared-types';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useFlag } from '@/features/config/flags';
import { useSettingsStore } from '@/features/settings/store';
import { getPreference, setPreference } from '@/lib/storage';

import { startupGreeting } from '../bells';
import { playShankh } from '../sounds';

const KEY_LAST_VISIT = 'mandir.lastVisitDate';

/** The pending "आज का दर्शन" glow: the local date greeted, until the glow has played. */
export const useGreetingStore = create<{ glowDate: string | null }>(() => ({ glowDate: null }));

export function dismissGreetingGlow() {
  useGreetingStore.setState({ glowDate: null });
}

/**
 * VM-01 "First visit of the day": once the scene is on screen (`active`), the first visit of each
 * local day plays the soft shankh (flag + user setting) and returns true until the "आज का दर्शन"
 * glow has played (`dismissGreetingGlow`). Remembered on the device, so reopening the app the same day stays quiet.
 */
export function useFirstVisitOfDay(localDate: string | undefined, active: boolean): boolean {
  const shankhFlag = useFlag(MandirFlag.STARTUP_SHANKH_SOUND);
  const shankhSetting = useSettingsStore((s) => s.startupShankh);
  const glowDate = useGreetingStore((s) => s.glowDate);

  useEffect(() => {
    if (!active || !localDate) return;
    const greeting = startupGreeting({
      lastVisitDate: getPreference<string | null>(KEY_LAST_VISIT, null),
      localDate,
      shankhFlag,
      shankhSetting,
    });
    if (!greeting.firstVisit) return;
    setPreference(KEY_LAST_VISIT, localDate);
    useGreetingStore.setState({ glowDate: localDate });
    if (greeting.shankh) playShankh();
  }, [active, localDate, shankhFlag, shankhSetting]);

  return glowDate !== null && glowDate === localDate;
}
