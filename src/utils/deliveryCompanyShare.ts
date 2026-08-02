import {Alert, Share} from 'react-native';
import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveConfirmedOrderPieceCount,
  resolveConfirmedOrderRemaining,
} from '@app/types/mirrorPricingConfirmedOrder';
import {roundMoney} from '@app/utils/format';
import {formatMirrorOrderInvoiceLabel} from '@app/utils/mirrorOrderInvoiceNumber';
import {confirmedOrderListRevision} from '@app/stores/mirrorPricingConfirmedOrdersStore';

function displayValue(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function formatDeliveryShareAmount(amount: number): string {
  const normalized = roundMoney(amount);
  const formatted = Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2});
  return `${formatted}jd`;
}

function hasCustomerFacingOrderChanges(
  local: MirrorPricingConfirmedOrder,
  remote: MirrorPricingConfirmedOrder,
): boolean {
  return (
    local.customerName !== remote.customerName ||
    local.fulfillmentType !== remote.fulfillmentType ||
    local.customerPhone !== remote.customerPhone ||
    (local.customerPhone2 ?? '') !== (remote.customerPhone2 ?? '') ||
    local.customerLocation !== remote.customerLocation ||
    (local.customerNotes ?? '') !== (remote.customerNotes ?? '') ||
    local.total !== remote.total ||
    local.collectedAmount !== remote.collectedAmount ||
    (local.remainingAmount ?? 0) !== (remote.remainingAmount ?? 0) ||
    (local.pieceCount ?? 0) !== (remote.pieceCount ?? 0) ||
    (local.invoiceNote ?? '') !== (remote.invoiceNote ?? '') ||
    (local.orderCardNote ?? '') !== (remote.orderCardNote ?? '') ||
    JSON.stringify(local.invoiceExtraLines ?? []) !== JSON.stringify(remote.invoiceExtraLines ?? []) ||
    JSON.stringify(local.catalogMirrorImages ?? []) !==
      JSON.stringify(remote.catalogMirrorImages ?? []) ||
    JSON.stringify(local.studioOrderImages ?? []) !== JSON.stringify(remote.studioOrderImages ?? [])
  );
}

export function mergeConfirmedOrdersListPageWithStore(
  pageOrders: MirrorPricingConfirmedOrder[],
  storeOrders: MirrorPricingConfirmedOrder[],
): MirrorPricingConfirmedOrder[] {
  const storeById = new Map(storeOrders.map((entry) => [entry.id, entry]));
  return pageOrders.map((pageOrder) => {
    const local = storeById.get(pageOrder.id);
    if (!local) {
      return pageOrder;
    }
    if (confirmedOrderListRevision(local) !== confirmedOrderListRevision(pageOrder)) {
      const localUpdated = local.lastUpdatedAt ?? '';
      const remoteUpdated = pageOrder.lastUpdatedAt ?? '';
      return localUpdated >= remoteUpdated ? local : pageOrder;
    }
    return hasCustomerFacingOrderChanges(local, pageOrder) ? local : pageOrder;
  });
}

export function resolveOrderForDeliveryShare(
  order: MirrorPricingConfirmedOrder,
  options?: {
    storeOrder?: MirrorPricingConfirmedOrder | null;
    draftOrder?: MirrorPricingConfirmedOrder | null;
  },
): MirrorPricingConfirmedOrder {
  if (options?.draftOrder?.id === order.id) {
    return options.draftOrder;
  }
  if (options?.storeOrder?.id === order.id) {
    return options.storeOrder;
  }
  return order;
}

function buildDeliverySharePriceLine(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
): string {
  const remainingAmount = resolveConfirmedOrderRemaining(order);
  return `${t('deliveryShareRemaining')} : ${formatDeliveryShareAmount(remainingAmount)}`;
}

export function buildDeliveryCompanyShareMessage(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
): string {
  const invoiceLabel = formatMirrorOrderInvoiceLabel(order.invoiceNumber);

  return [
    `${t('deliveryShareOrderNumber')} : ${invoiceLabel ?? '—'}`,
    `${t('deliveryShareCustomerName')} : ${displayValue(order.customerName)}`,
    `${t('deliveryShareCustomerPhone')} : ${displayValue(order.customerPhone)}`,
    ...(order.customerPhone2?.trim()
      ? [`${t('deliveryShareCustomerPhone2')} : ${displayValue(order.customerPhone2)}`]
      : []),
    `${t('deliveryShareCustomerLocation')} : ${displayValue(order.customerLocation)}`,
    `${t('deliverySharePieceCount')} : ${resolveConfirmedOrderPieceCount(order)}`,
    buildDeliverySharePriceLine(order, t),
  ].join('\n');
}

export async function shareOrderWithDeliveryCompany(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  options?: {
    storeOrder?: MirrorPricingConfirmedOrder | null;
    draftOrder?: MirrorPricingConfirmedOrder | null;
  },
): Promise<void> {
  const resolvedOrder = resolveOrderForDeliveryShare(order, options);
  const message = buildDeliveryCompanyShareMessage(resolvedOrder, t);

  try {
    const result = await Share.share({message});
    if (result.action === Share.dismissedAction) {
      return;
    }
  } catch {
    Alert.alert(t('error'), t('mirrorOrdersShareDeliveryFailed'));
  }
}
