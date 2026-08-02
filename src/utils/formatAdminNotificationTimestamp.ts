import dayjs from 'dayjs';
import type {TFunction} from 'i18next';

export function formatAdminNotificationTimestamp(timestamp: number, t: TFunction): string {
  const at = dayjs(timestamp);
  const minutes = dayjs().diff(at, 'minute');

  if (minutes < 1) {
    return t('notificationJustNow');
  }
  if (minutes < 60) {
    return t('adminNotificationMinutesAgo', {count: minutes});
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('adminNotificationHoursAgo', {count: hours});
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return t('adminNotificationDaysAgo', {count: days});
  }

  return at.format('YYYY-MM-DD HH:mm');
}
