import type {TFunction} from 'i18next';
import i18n from '@app/I18n';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveOrdersHomeCards} from '@app/types/ordersHomeCard';
import {getOrdersHomeCardsSnapshot} from '@app/hooks/useOrdersHomeCards';
import {formatCurrency} from '@app/utils/format';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {resolvePreparationOrdersHomeCardLabel} from '@app/utils/ordersHomeCardLabels';
import {resolveOrderSearchSectionTitle} from '@app/utils/ordersHomeCardNavigation';

import type {ConfirmedOrderNotificationMetadata} from '@app/types/adminNotificationMetadata';

export interface ConfirmedOrderNotificationContent {
  title: string;
  body: string;
  orderId: string;
  eventAt: number;
  metadata: ConfirmedOrderNotificationMetadata;
}

export function buildConfirmedOrderNotificationContent(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
): ConfirmedOrderNotificationContent {
  const customerName = order.customerName.trim() || '—';
  const totalLabel = formatCurrency(order.total, t('currencyLabel'));
  const invoiceLabel =
    formatMirrorOrderInvoiceLabel(order.invoiceNumber) ??
    t('confirmedOrderNotificationNoInvoice', {defaultValue: '—'});

  const confirmedAt = order.confirmedAt ?? new Date().toISOString();
  const confirmedAtMs = Date.parse(confirmedAt);
  const eventAt = Number.isFinite(confirmedAtMs) ? confirmedAtMs : Date.now();
  const actorName = order.confirmedByUserName?.trim() || undefined;

  const preparationSectionName = resolvePreparationOrdersHomeCardLabel(
    resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), i18n.t.bind(i18n)),
    t,
  );
  const homeCards = resolveOrdersHomeCards(getOrdersHomeCardsSnapshot(), i18n.t.bind(i18n));
  const sectionLabel = resolveOrderSearchSectionTitle(order, homeCards, t);
  const status = resolveMirrorPricingOrderStatus(order.status);

  return {
    title: t('confirmedOrderNotificationTitle', {sectionName: preparationSectionName}),
    body: t('confirmedOrderNotificationBody', {customerName, totalLabel, invoiceLabel}),
    orderId: order.id,
    eventAt,
    metadata: {
      orderId: order.id,
      customerName,
      total: order.total,
      totalLabel,
      invoiceLabel,
      confirmedAt,
      actorUserId: order.confirmedByUserId,
      actorName,
      homeCardId: order.homeCardId,
      status,
      sectionLabel,
    },
  };
}
