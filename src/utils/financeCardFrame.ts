import type {ThemeType} from '@shared/theme/buildTheme';

export function getFinanceCardFrameBorderColor(theme: ThemeType): string {
  return theme.colors.background === '#F8FAFC' ? '#1A3352' : '#5B7FA6';
}

export function getFinanceCardFrameStyle(theme: ThemeType) {
  return {
    borderColor: getFinanceCardFrameBorderColor(theme),
    borderWidth: 1,
  };
}
