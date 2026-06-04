import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import arTranslation from './ar/translation.json';
import enTranslation from './en/translation.json';
import {StorageKeys} from '@app/constants/StorageKeys';
import {storage} from '@app/utils/storage';
import {getDeviceLanguage} from '@shared/utils/deviceLocale';
import {applyRtlManager, reloadAppForRtlChange} from '@shared/utils/rtlManager';
import type {LangCode} from '@app/types/language';

const resources = {
  en: {translation: enTranslation},
  ar: {translation: arTranslation},
};

function resolveStoredLanguage(stored: string | null): LangCode {
  if (stored === 'en' || stored === 'ar') {
    return stored;
  }

  if (stored === 'system') {
    return getDeviceLanguage('ar');
  }

  return 'ar';
}

let initPromise: Promise<void> | null = null;

async function runI18nInit(): Promise<void> {
  const storedPreference = await storage.getString(StorageKeys.LANGUAGE);
  const language = resolveStoredLanguage(storedPreference);

  const rtlChanged = applyRtlManager(language === 'ar');

  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    fallbackLng: 'en',
    interpolation: {escapeValue: false},
    keySeparator: false,
    lng: language,
    react: {useSuspense: false},
    resources,
  });

  if (rtlChanged) {
    reloadAppForRtlChange();
  }
}

/** Idempotent — safe to call from index.ts and App.tsx. */
export function initializeI18n(): Promise<void> {
  if (!initPromise) {
    initPromise = runI18nInit();
  }
  return initPromise;
}

export default i18n;
