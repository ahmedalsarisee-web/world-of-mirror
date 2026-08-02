import type {TFunction} from 'i18next';
import type {AdminNotificationRecord} from '@app/stores/adminNotificationStore';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {buildFinanceNotificationDetailLines} from '@app/utils/financeNotificationDetails';
import {formatFinanceNotificationEventTime} from '@app/utils/financeNotificationDetails';
import {resolveStoredHomeCardLabel} from '@app/utils/ordersHomeCardLabels';

export function buildAdminNotificationDetailLines(
  item: AdminNotificationRecord,
  t: TFunction,
): string[] {
  if (item.kind === 'finance' && item.metadata?.finance) {
    return buildFinanceNotificationDetailLines(item.metadata.finance, t);
  }

  if (item.kind === 'attendance' && item.metadata?.attendance) {
    const meta = item.metadata.attendance;
    const lines = [
      t('notificationDetailActor', {name: meta.employeeName}),
      t(
        meta.type === 'check_in'
          ? 'notificationDetailAttendanceCheckIn'
          : 'notificationDetailAttendanceCheckOut',
      ),
      t('notificationDetailTime', {
        time: formatFinanceNotificationEventTime(meta.createdAt, t),
      }),
    ];
    if (meta.note.trim()) {
      lines.push(t('notificationDetailNote', {note: meta.note.trim()}));
    }
    return lines;
  }

  if (item.kind === 'confirmed_order' && item.metadata?.confirmedOrder) {
    const meta = item.metadata.confirmedOrder;
    const lines = [
      t('notificationDetailCustomer', {name: meta.customerName}),
      t('notificationDetailInvoice', {label: meta.invoiceLabel}),
      t('notificationDetailAmount', {amount: meta.totalLabel}),
      t('notificationDetailTime', {
        time: formatFinanceNotificationEventTime(meta.confirmedAt, t),
      }),
    ];
    if (meta.actorName) {
      lines.unshift(t('notificationDetailActor', {name: meta.actorName}));
    }
    return lines;
  }

  if (item.kind === 'order_updated' && item.metadata?.orderUpdated) {
    const meta = item.metadata.orderUpdated;
    return [
      t('notificationDetailActor', {name: meta.actorName}),
      t('notificationDetailCustomer', {name: meta.customerName}),
      t('notificationDetailInvoice', {label: meta.invoiceLabel}),
      t('notificationDetailAmount', {amount: meta.totalLabel}),
      t('notificationDetailTime', {
        time: formatFinanceNotificationEventTime(meta.updatedAt, t),
      }),
    ];
  }

  if (item.kind === 'order_moved' && item.metadata?.orderMove) {
    const meta = item.metadata.orderMove;
    const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
    return [
      t('notificationDetailActor', {name: meta.employeeName}),
      t('notificationDetailOrderMoveFrom', {
        label: resolveStoredHomeCardLabel(meta.fromLabel, homeCards, t),
      }),
      t('notificationDetailOrderMoveTo', {
        label: resolveStoredHomeCardLabel(meta.toLabel, homeCards, t),
      }),
      t('notificationDetailInvoice', {label: meta.invoiceLabel}),
      t('notificationDetailTime', {
        time: formatFinanceNotificationEventTime(meta.movedAt, t),
      }),
    ];
  }

  if (item.kind === 'order_deleted' && item.metadata?.orderDeleted) {
    return [];
  }

  return [];
}

export function getAdminNotificationSortTime(item: AdminNotificationRecord): number {
  return item.eventAt ?? item.receivedAt;
}
