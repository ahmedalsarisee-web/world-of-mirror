import * as Localization from 'expo-localization';
import type {LangCode} from '@app/types/language';

export const getDeviceLanguage = (fallback: LangCode = 'ar'): LangCode => {
  const locales = Localization.getLocales();
  const languageCode = locales?.[0]?.languageCode?.toLowerCase();

  if (languageCode === 'ar') {
    return 'ar';
  }

  if (languageCode === 'en') {
    return 'en';
  }

  return fallback;
};
