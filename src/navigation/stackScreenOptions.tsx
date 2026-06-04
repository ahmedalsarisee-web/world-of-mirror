import type {NativeStackNavigationOptions} from '@react-navigation/native-stack';
import type {LangCode} from '@app/types/language';
import HeaderTitle from '@app/components/navigation/HeaderTitle';
import type {ThemeType} from '@shared/theme/theme';
import {getFontFamily} from '@shared/theme/fonts';

export function getStackScreenOptions(theme: ThemeType, language: LangCode): NativeStackNavigationOptions {
  return {
    headerTitleAlign: 'center',
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.typography.primary,
    headerShadowVisible: false,
    headerTitle: ({children}) => (
      <HeaderTitle color={theme.typography.primary}>{String(children ?? '')}</HeaderTitle>
    ),
    headerTitleStyle: {
      fontFamily: getFontFamily(language),
      fontWeight: '600',
      color: theme.typography.primary,
      fontSize: theme.typographyScale.size.lg,
    },
  };
}
