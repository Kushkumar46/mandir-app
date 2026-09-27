import { DEFAULT_LANGUAGE, DEFAULT_NAMESPACE, resources } from '@mandir/i18n';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

const i18n = createInstance();

// Hindi by default; the user's saved language is applied by the app shell (Virtual Mandir T8).
void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: DEFAULT_NAMESPACE,
  interpolation: { escapeValue: false },
});

export default i18n;
