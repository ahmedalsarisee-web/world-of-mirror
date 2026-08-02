import type {ComponentProps} from 'react';
import type {MaterialCommunityIcons} from '@expo/vector-icons';
import type {ThemeType} from '@shared/theme/theme';
import type {AdminNotificationKind} from '@app/stores/adminNotificationStore';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface AdminNotificationPresentation {
  icon: IconName;
  accentColor: string;
  accentBackground: string;
  categoryKey:
    | 'notificationCategoryFinance'
    | 'notificationCategoryAttendance'
    | 'notificationCategoryOrder'
    | 'notificationCategoryWarehouse';
}

function isLightTheme(theme: ThemeType): boolean {
  return theme.colors.background === '#F8FAFC';
}

function softNotificationTone(
  theme: ThemeType,
  tone: 'slate' | 'sage' | 'sky' | 'rose',
): {accentColor: string; accentBackground: string} {
  if (isLightTheme(theme)) {
    switch (tone) {
      case 'sage':
        return {accentColor: '#5F7F72', accentBackground: '#EEF4F0'};
      case 'sky':
        return {accentColor: '#5E7F99', accentBackground: '#EEF3F7'};
      case 'rose':
        return {accentColor: '#9A7373', accentBackground: '#F5EFEF'};
      default:
        return {accentColor: '#64748B', accentBackground: '#F1F5F9'};
    }
  }

  switch (tone) {
    case 'sage':
      return {accentColor: '#8FAF9E', accentBackground: '#152019'};
    case 'sky':
      return {accentColor: '#8BA3B8', accentBackground: '#121A22'};
    case 'rose':
      return {accentColor: '#B89595', accentBackground: '#221618'};
    default:
      return {accentColor: theme.colors.icon, accentBackground: theme.colors.surfaceSecondary};
  }
}

export function getAdminNotificationPresentation(
  kind: AdminNotificationKind,
  theme: ThemeType,
): AdminNotificationPresentation {
  switch (kind) {
    case 'attendance': {
      const tone = softNotificationTone(theme, 'sky');
      return {
        icon: 'calendar-clock-outline',
        accentColor: tone.accentColor,
        accentBackground: tone.accentBackground,
        categoryKey: 'notificationCategoryAttendance',
      };
    }
    case 'confirmed_order':
    case 'order_moved':
    case 'order_updated': {
      const tone = softNotificationTone(theme, 'slate');
      return {
        icon:
          kind === 'order_moved'
            ? 'swap-horizontal'
            : kind === 'order_updated'
              ? 'pencil-outline'
              : 'clipboard-text-outline',
        accentColor: tone.accentColor,
        accentBackground: tone.accentBackground,
        categoryKey: 'notificationCategoryOrder',
      };
    }
    case 'order_deleted': {
      const tone = softNotificationTone(theme, 'rose');
      return {
        icon: 'trash-can-outline',
        accentColor: tone.accentColor,
        accentBackground: tone.accentBackground,
        categoryKey: 'notificationCategoryOrder',
      };
    }
    case 'mirror_warehouse': {
      const tone = softNotificationTone(theme, 'sage');
      return {
        icon: 'warehouse',
        accentColor: tone.accentColor,
        accentBackground: tone.accentBackground,
        categoryKey: 'notificationCategoryWarehouse',
      };
    }
    default: {
      const tone = softNotificationTone(theme, 'sage');
      return {
        icon: 'cash-multiple',
        accentColor: tone.accentColor,
        accentBackground: tone.accentBackground,
        categoryKey: 'notificationCategoryFinance',
      };
    }
  }
}
