import { create } from 'zustand';

import { getPreference, setPreference } from '@/lib/storage';

type SettingsState = {
  /** VM-01: soft shankh on the first visit of the day (also needs `mandir.startup_shankh_sound`). */
  startupShankh: boolean;
  setStartupShankh: (on: boolean) => void;
  /** §4.5 "Silent mode में भी बजाएं": aarti audio plays even when the phone is on silent (default on). */
  aartiInSilentMode: boolean;
  setAartiInSilentMode: (on: boolean) => void;
};

const KEY_STARTUP_SHANKH = 'settings.startupShankh';
const KEY_AARTI_SILENT = 'settings.aartiInSilentMode';

/** Device-local user settings (saved on the phone until the Auth module's profile settings). */
export const useSettingsStore = create<SettingsState>((set) => ({
  startupShankh: getPreference(KEY_STARTUP_SHANKH, true),
  setStartupShankh: (on) => {
    setPreference(KEY_STARTUP_SHANKH, on);
    set({ startupShankh: on });
  },
  aartiInSilentMode: getPreference(KEY_AARTI_SILENT, true),
  setAartiInSilentMode: (on) => {
    setPreference(KEY_AARTI_SILENT, on);
    set({ aartiInSilentMode: on });
  },
}));
