import {DarkTheme, DefaultTheme, type Theme} from '@react-navigation/native';
import type {ThemeMode} from '@app/context/ThemeContext';
import type {LangCode} from '@app/types/language';
import type {ThemeType} from '@shared/theme/theme';
import {getFontFamily} from '@shared/theme/fonts';

function buildFonts(language: LangCode): Theme['fonts'] {
  const fontFamily = getFontFamily(language);

  return {
    regular: {fontFamily, fontWeight: '500'},
    medium: {fontFamily, fontWeight: '600'},
    bold: {fontFamily, fontWeight: '800'},
    heavy: {fontFamily, fontWeight: '900'},
  };
}

export function buildNavigationTheme(
  theme: ThemeType,
  mode: ThemeMode,
  language: LangCode,
): Theme {
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: mode === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.divider,
      notification: theme.colors.primary,
    },
    fonts: buildFonts(language),
  };
}
