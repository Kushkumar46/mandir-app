import { DEFAULT_LANGUAGE, type SupportedLanguage } from '@mandir/i18n';
import { create } from 'zustand';

import i18n from './i18n';

type LanguageState = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
};

/**
 * UI language (Hindi default). In memory for now: the saved per-user language arrives with the
 * Auth module's profile settings.
 */
export const useLanguageStore = create<LanguageState>((set) => ({
  language: DEFAULT_LANGUAGE,
  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language });
  },
}));

/** Picks the Hindi or English field of API content (`nameHi` / `nameEn`). */
export function pickLocalized(language: SupportedLanguage, hi: string, en: string): string {
  return language === 'en' ? en : hi;
}
