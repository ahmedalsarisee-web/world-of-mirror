import dayjs from 'dayjs';
import type {TFunction} from 'i18next';
import type {FinanceNotificationMetadata} from '@app/types/adminNotificationMetadata';

export function formatFinanceNotificationEventTime(createdAt: string, t: TFunction): string {
  const at = dayjs(createdAt);
  if (!at.isValid()) {
    return createdAt;
  }
  return at.format(t('financeNotificationDateTimeFormat'));
}

export function buildFinanceNotificationDetailLines(
  metadata: FinanceNotificationMetadata,
  t: TFunction,
): string[] {
  const eventTime = metadata.updatedAt ?? metadata.deletedAt ?? metadata.createdAt;
  const lines = [
    t('notificationDetailActor', {name: metadata.actorName}),
    t('notificationDetailAccount', {name: metadata.accountName}),
    t('notificationDetailType', {label: metadata.typeLabel}),
    t('notificationDetailAmount', {amount: metadata.amountLabel}),
    t('notificationDetailTime', {
      time: formatFinanceNotificationEventTime(eventTime, t),
    }),
  ];

  if (metadata.updatedAt) {
    lines.unshift(t('notificationDetailFinanceUpdated'));
  } else if (metadata.deletedAt) {
    lines.unshift(t('notificationDetailFinanceDeleted'));
  }

  if (metadata.ledgerName) {
    lines.push(t('financeNotificationDetailLedger', {name: metadata.ledgerName}));
  }

  if (metadata.note.trim()) {
    lines.push(t('notificationDetailNote', {note: metadata.note.trim()}));
  }

  return lines;
}
