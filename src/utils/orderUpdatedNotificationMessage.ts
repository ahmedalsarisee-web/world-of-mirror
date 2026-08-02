import type {TFunction} from 'i18next';
import i18n from '@app/I18n';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {formatCurrency} from '@app/utils/format';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {resolveOrderSearchSectionTitle} from '@app/utils/ordersHomeCardNavigation';
import type {OrderUpdatedNotificationMetadata} from '@app/types/adminNotificationMetadata';

export interface OrderUpdatedNotificationContent {
  title: string;
  body: string;
  orderId: string;
  updateEventId: string;
  eventAt: number;
  metadata: OrderUpdatedNotificationMetadata;
}

export function buildOrderUpdatedNotificationContent(
  order: MirrorPricingConfirmedOrder,
  actor: {actorUserId?: string; actorName: string},
  updatedAt: string,
  t: TFunction,
): OrderUpdatedNotificationContent {
  const customerName = order.customerName.trim() || '—';
  const totalLabel = formatCurrency(order.total, t('currencyLabel'));
  const invoiceLabel =
    formatMirrorOrderInvoiceLabel(order.invoiceNumber) ??
    t('confirmedOrderNotificationNoInvoice', {defaultValue: '—'});
  const updatedAtMs = Date.parse(updatedAt);
  const eventAt = Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now();
  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), i18n.t.bind(i18n));
  const sectionLabel = resolveOrderSearchSectionTitle(order, homeCards, t);
  const updateEventId = `${order.id}:${updatedAt}`;

  return {
    title: t('orderUpdatedNotificationTitle'),
    body: t('orderUpdatedNotificationBody', {
      actorName: actor.actorName,
      invoiceLabel,
      customerName,
      totalLabel,
    }),
    orderId: order.id,
    updateEventId,
    eventAt,
    metadata: {
      orderId: order.id,
      updateEventId,
      customerName,
      total: order.total,
      totalLabel,
      invoiceLabel,
      updatedAt,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      homeCardId: order.homeCardId,
      status: resolveMirrorPricingOrderStatus(order.status),
      sectionLabel,
    },
  };
}
