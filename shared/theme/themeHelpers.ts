import type {ViewStyle} from 'react-native';
import type {ThemeType} from './buildTheme';

export function getListCardStyle(theme: ThemeType): ViewStyle {
  return {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.components.card.radius,
    ...theme.shadow.card,
  };
}

export function getInputContainerStyle(theme: ThemeType): ViewStyle {
  return {
    backgroundColor: theme.colors.inputBackground,
    borderColor: theme.colors.inputBorder,
    borderWidth: 1,
    borderRadius: theme.components.input.radius,
    minHeight: theme.components.input.height,
  };
}
