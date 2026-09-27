import en from './locales/en.json';
import hi from './locales/hi.json';

export const SUPPORTED_LANGUAGES = ['hi', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Hindi is the default UI language. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'hi';
export const DEFAULT_NAMESPACE = 'translation';

/** `hi.json` is the source of truth for keys; `en.json` must match it (checked by the test). */
export type TranslationResource = typeof hi;

export const resources: Record<SupportedLanguage, { translation: TranslationResource }> = {
  hi: { translation: hi },
  en: { translation: en },
};

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
