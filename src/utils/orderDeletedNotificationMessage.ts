import type {TFunction} from 'i18next';
import i18n from '@app/I18n';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveConfirmedOrderPieceCount,
  resolveConfirmedOrderRemaining,
} from '@app/types/mirrorPricingConfirmedOrder';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import type {OrderDeletedNotificationMetadata} from '@app/types/adminNotificationMetadata';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {formatCurrency} from '@app/utils/format';
import {formatFinanceNotificationEventTime} from '@app/utils/financeNotificationDetails';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {resolveMirrorPricingOrderStatusLabel} from '@app/utils/ordersHomeCardLabels';

export interface OrderDeletedNotificationContent {
  title: string;
  body: string;
  orderId: string;
  deleteEventId: string;
  eventAt: number;
  metadata: OrderDeletedNotificationMetadata;
}

function displayValue(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

export function buildOrderDeletedNotificationContent(
  order: MirrorPricingConfirmedOrder,
  actor: {actorUserId?: string; actorName: string},
  t: TFunction,
): OrderDeletedNotificationContent {
  const deletedAt = new Date().toISOString();
  const deletedAtMs = Date.parse(deletedAt);
  const eventAt = Number.isFinite(deletedAtMs) ? deletedAtMs : Date.now();
  const deleteEventId = `${order.id}:deleted:${deletedAt}`;
  const actorName = actor.actorName.trim() || '—';
  const customerName = displayValue(order.customerName);
  const customerPhone = displayValue(order.customerPhone);
  const customerPhone2 = order.customerPhone2?.trim() || undefined;
  const customerLocation = displayValue(order.customerLocation);
  const customerNotes = order.customerNotes?.trim() || undefined;
  const orderCardNote = order.orderCardNote?.trim() || undefined;
  const invoiceNote = order.invoiceNote?.trim() || undefined;
  const invoiceLabel =
    formatMirrorOrderInvoiceLabel(order.invoiceNumber) ??
    t('confirmedOrderNotificationNoInvoice', {defaultValue: '—'});
  const statusLabel = resolveMirrorPricingOrderStatusLabel(
    resolveMirrorPricingOrderStatus(order.status),
    resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), i18n.t.bind(i18n)),
    t,
  );
  const totalLabel = formatCurrency(order.total, t('currencyLabel'));
  const collectedLabel = formatCurrency(order.collectedAmount, t('currencyLabel'));
  const remainingAmount = resolveConfirmedOrderRemaining(order);
  const remainingLabel = formatCurrency(remainingAmount, t('currencyLabel'));
  const pieceCount = resolveConfirmedOrderPieceCount(order);

  const bodyLines = [
    t('notificationDetailOrderDeleted'),
    t('notificationDetailActor', {name: actorName}),
    t('notificationDetailInvoice', {label: invoiceLabel}),
    t('notificationDetailCustomer', {name: customerName}),
    t('notificationDetailOrderDeletedPhone', {phone: customerPhone}),
    ...(customerPhone2
      ? [t('notificationDetailOrderDeletedPhone2', {phone: customerPhone2})]
      : []),
    t('notificationDetailOrderDeletedLocation', {location: customerLocation}),
    t('notificationDetailOrderDeletedStatus', {label: statusLabel}),
    t('notificationDetailOrderDeletedPieceCount', {count: pieceCount}),
    t('notificationDetailAmount', {amount: totalLabel}),
    t('notificationDetailOrderDeletedCollected', {amount: collectedLabel}),
    t('notificationDetailOrderDeletedRemaining', {amount: remainingLabel}),
    ...(customerNotes ? [t('notificationDetailNote', {note: customerNotes})] : []),
    ...(orderCardNote ? [t('notificationDetailOrderDeletedCardNote', {note: orderCardNote})] : []),
    ...(invoiceNote ? [t('notificationDetailOrderDeletedInvoiceNote', {note: invoiceNote})] : []),
    t('notificationDetailTime', {
      time: formatFinanceNotificationEventTime(deletedAt, t),
    }),
  ];

  return {
    title: t('orderDeletedNotificationTitle'),
    body: bodyLines.join('\n'),
    orderId: order.id,
    deleteEventId,
    eventAt,
    metadata: {
      orderId: order.id,
      deleteEventId,
      actorUserId: actor.actorUserId,
      actorName,
      customerName,
      customerPhone,
      customerPhone2,
      customerLocation,
      customerNotes,
      orderCardNote,
      invoiceNote,
      invoiceLabel,
      statusLabel,
      pieceCount,
      total: order.total,
      totalLabel,
      collectedAmount: order.collectedAmount,
      collectedLabel,
      remainingAmount,
      remainingLabel,
      deletedAt,
      homeCardId: order.homeCardId,
      status: resolveMirrorPricingOrderStatus(order.status),
    },
  };
}
