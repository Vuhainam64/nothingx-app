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

function readStoredLang(): LanguageCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const base = (raw ?? 'vi').split('-')[0] as LanguageCode;
    return SUPPORTED_LANGUAGES.includes(base) ? base : 'vi';
  } catch {
    return 'vi';
  }
}

function syncHtmlLang(lng: string | undefined): void {
  const base = (lng ?? 'vi').split('-')[0];
  document.documentElement.lang = base === 'zh' ? 'zh-CN' : base || 'vi';
}

void i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: readStoredLang(),
  fallbackLng: 'vi',
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
  const base = (i18n.language ?? 'vi').split('-')[0] as LanguageCode;
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'vi';
}

export function changeLanguage(lng: LanguageCode): Promise<unknown> {
  return i18n.changeLanguage(lng);
}

export default i18n;
