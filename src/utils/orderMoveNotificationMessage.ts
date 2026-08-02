import type {TFunction} from 'i18next';
import i18n from '@app/I18n';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {resolveStoredHomeCardLabel} from '@app/utils/ordersHomeCardLabels';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import type {OrderMoveNotificationMetadata} from '@app/types/adminNotificationMetadata';

export interface OrderMoveNotificationContent {
  title: string;
  body: string;
  orderId: string;
  moveEventId: string;
  eventAt: number;
  metadata: OrderMoveNotificationMetadata;
}

export function buildOrderMoveNotificationContent(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
): OrderMoveNotificationContent {
  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), t);
  const employeeName = order.lastMovedByUserName?.trim() || '—';
  const fromLabel = resolveStoredHomeCardLabel(order.lastMovedFromLabel, homeCards, t);
  const toLabel = resolveStoredHomeCardLabel(order.lastMovedToLabel, homeCards, t);
  const invoiceLabel =
    formatMirrorOrderInvoiceLabel(order.invoiceNumber) ??
    t('confirmedOrderNotificationNoInvoice', {defaultValue: '—'});
  const moveEventId = `${order.id}:${order.statusChangedAt ?? ''}`;
  const movedAt = order.statusChangedAt ?? new Date().toISOString();
  const movedAtMs = Date.parse(movedAt);
  const eventAt = Number.isFinite(movedAtMs) ? movedAtMs : Date.now();

  return {
    title: t('orderMoveNotificationTitle'),
    body: t('orderMoveNotificationBody', {employeeName, fromLabel, toLabel, invoiceLabel}),
    orderId: order.id,
    moveEventId,
    eventAt,
    metadata: {
      orderId: order.id,
      moveEventId,
      employeeName,
      fromLabel,
      toLabel,
      invoiceLabel,
      movedAt,
      actorUserId: order.lastMovedByUserId,
      toHomeCardId: order.homeCardId,
      toStatus: resolveMirrorPricingOrderStatus(order.status),
    },
  };
}
