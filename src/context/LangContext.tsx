import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import i18n from 'i18next';
import {LangDirection} from '@shared/enums/LangDirection';
import {StorageKeys} from '@app/constants/StorageKeys';
import {storage} from '@app/utils/storage';
import {getDeviceLanguage} from '@shared/utils/deviceLocale';
import {applyRtlManager, reloadAppForRtlChange} from '@shared/utils/rtlManager';
import type {LangCode, LangPreference} from '@app/types/language';

export interface LangContextValue {
  language: LangCode;
  languagePreference: LangPreference;
  direction: LangDirection;
  changeLanguage: (preference?: LangPreference) => Promise<void>;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

function resolveStoredLanguage(stored: string | null): LangCode {
  if (stored === 'en' || stored === 'ar') {
    return stored;
  }

  if (stored === 'system') {
    return getDeviceLanguage('ar');
  }

  return 'ar';
}

function resolveStoredLanguageSync(): LangCode {
  const fromI18n = i18n.language;
  if (fromI18n === 'en' || fromI18n === 'ar') {
    return fromI18n;
  }

  return 'ar';
}

export const LangProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const bootLanguage = resolveStoredLanguageSync();
  const [languagePreference, setLanguagePreference] = useState<LangPreference>(bootLanguage);
  const [language, setLanguage] = useState<LangCode>(bootLanguage);
  const [direction, setDirection] = useState<LangDirection>(
    bootLanguage === 'ar' ? LangDirection.RTL : LangDirection.LTR,
  );

  const applyLanguage = useCallback(async (resolvedLanguage: LangCode) => {
    try {
      const isRtl = resolvedLanguage === 'ar';
      const rtlChanged = applyRtlManager(isRtl);
      await i18n.changeLanguage(resolvedLanguage);
      if (rtlChanged) {
        reloadAppForRtlChange();
        return;
      }
      setLanguage(resolvedLanguage);
      setDirection(isRtl ? LangDirection.RTL : LangDirection.LTR);
    } catch (error) {
      console.warn('Failed to change language', error);
    }
  }, []);

  useEffect(() => {
    const loadPreference = async () => {
      const storedPreference = await storage.getString(StorageKeys.LANGUAGE);
      const preference = resolveStoredLanguage(storedPreference);

      if (storedPreference === 'system') {
        await storage.set(StorageKeys.LANGUAGE, preference);
      }

      setLanguagePreference(preference);
      const isRtl = preference === 'ar';
      const rtlChanged = applyRtlManager(isRtl);
      if (rtlChanged) {
        reloadAppForRtlChange();
        return;
      }
      setLanguage(preference);
      setDirection(isRtl ? LangDirection.RTL : LangDirection.LTR);
    };

    void loadPreference();
  }, []);

  const changeLanguage = useCallback(
    async (preference: LangPreference = 'ar') => {
      const nextPreference = preference === 'en' || preference === 'ar' ? preference : 'ar';

      setLanguagePreference(nextPreference);
      await storage.set(StorageKeys.LANGUAGE, nextPreference);
      await applyLanguage(nextPreference);
    },
    [applyLanguage],
  );

  const value = useMemo(
    () => ({language, languagePreference, direction, changeLanguage}),
    [language, languagePreference, direction, changeLanguage],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useLanguage = (): LangContextValue => {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error('useLanguage must be used within LangProvider');
  }

  return context;
};
