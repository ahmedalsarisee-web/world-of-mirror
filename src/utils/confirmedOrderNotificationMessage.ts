import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {formatCurrency} from '@app/utils/format';

export interface ConfirmedOrderNotificationContent {
  title: string;
  body: string;
  orderId: string;
}

export function buildConfirmedOrderNotificationContent(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
): ConfirmedOrderNotificationContent {
  const customerName = order.customerName.trim() || '—';
  const totalLabel = formatCurrency(order.total, t('currencyLabel'));

  return {
    title: t('confirmedOrderNotificationTitle'),
    body: t('confirmedOrderNotificationBody', {customerName, totalLabel}),
    orderId: order.id,
  };
}
