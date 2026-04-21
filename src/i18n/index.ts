import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';

export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_STORAGE_KEY = 'ai-launcher:locale';

export const LOCALE_LABELS: Record<Locale, { native: string; short: string; flag: string }> = {
  'en': { native: 'English', short: 'EN', flag: '🇬🇧' },
  'pt-BR': { native: 'Português', short: 'PT', flag: '🇧🇷' },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en': { translation: en },
      'pt-BR': { translation: ptBR },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: false, // convertDetectedLanguage handles 'pt' => 'pt-BR'
    load: 'currentOnly', // avoid loading bare 'pt' separately
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        if (lng.toLowerCase().startsWith('pt')) return 'pt-BR';
        return 'en';
      },
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* ignore */ }
}

export function getLocale(): Locale {
  const current = i18n.resolvedLanguage ?? i18n.language;
  if (SUPPORTED_LOCALES.includes(current as Locale)) return current as Locale;
  return 'en';
}

export default i18n;
