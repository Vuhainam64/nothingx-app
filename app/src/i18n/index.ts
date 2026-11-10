import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi';
import en from './locales/en';
import zh from './locales/zh';

export const SUPPORTED_LANGUAGES = ['vi', 'en', 'zh'] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];
export type Language = LanguageCode;

export const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '简体中文', flag: '🇨🇳' },
];

const STORAGE_KEY = 'nothingx.lang';

function toSupported(tag: string | null | undefined): LanguageCode | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base) ? (base as LanguageCode) : null;
}

/** First supported language from the OS/browser preference list (vi, en, zh), else English. */
function detectSystemLang(): LanguageCode {
  try {
    const prefs =
      typeof navigator !== 'undefined'
        ? navigator.languages?.length
          ? navigator.languages
          : [navigator.language]
        : [];
    for (const tag of prefs) {
      const lang = toSupported(tag);
      if (lang) return lang;
    }
  } catch {
    // ignore
  }
  return 'en';
}

function readStoredLang(): LanguageCode {
  try {
    const stored = toSupported(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // ignore
  }
  return detectSystemLang();
}

function syncHtmlLang(lng: string | undefined): void {
  const base = (lng ?? 'en').split('-')[0];
  document.documentElement.lang = base === 'zh' ? 'zh-CN' : base || 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: readStoredLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

syncHtmlLang(i18n.language);

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
  syncHtmlLang(lng);
});

export function currentLanguage(): LanguageCode {
  return toSupported(i18n.language) ?? 'en';
}

export function changeLanguage(lng: LanguageCode): Promise<unknown> {
  return i18n.changeLanguage(lng);
}

export default i18n;
