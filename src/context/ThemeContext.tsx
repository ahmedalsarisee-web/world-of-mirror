import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {Appearance} from 'react-native';
import {darkTheme, lightTheme, ThemeType} from '@shared/theme/theme';
import {StorageKeys} from '@app/constants/StorageKeys';
import {storage} from '@app/utils/storage';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode;

export interface ThemeContextValue {
  theme: ThemeType;
  themeType: ThemeMode;
  themePreference: ThemePreference;
  toggleTheme: () => void;
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveStoredTheme(stored: string | null): ThemeMode {
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  if (stored === 'system') {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  }

  return 'light';
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>('light');

  useEffect(() => {
    const loadPreference = async () => {
      const storedPreference = await storage.getString(StorageKeys.THEME_MODE);
      const preference = resolveStoredTheme(storedPreference);

      if (storedPreference === 'system') {
        await storage.set(StorageKeys.THEME_MODE, preference);
      }

      setThemePreference(preference);
    };

    void loadPreference();
  }, []);

  const themeType = themePreference;

  const theme = useMemo(
    () => (themeType === 'dark' ? darkTheme : lightTheme),
    [themeType],
  );

  const setTheme = (preference: ThemePreference) => {
    void storage.set(StorageKeys.THEME_MODE, preference);
    setThemePreference(preference);
  };

  const toggleTheme = () => {
    setTheme(themeType === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({theme, themeType, themePreference, toggleTheme, setTheme}),
    [theme, themeType, themePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
