import type {TFunction} from 'i18next';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  getMirrorPricingOrderMoveTargetTitleKey,
  getMirrorPricingOrderStatusTitleKey,
} from '@app/types/mirrorPricingOrderStatus';
import {
  isBuiltinOrdersHomeCard,
  isCustomOrdersHomeCard,
  type OrdersHomeBuiltinTarget,
  type OrdersHomeCardConfig,
} from '@app/types/ordersHomeCard';

export function findBuiltinOrdersHomeCard(
  homeCards: OrdersHomeCardConfig[],
  target: OrdersHomeBuiltinTarget,
): Extract<OrdersHomeCardConfig, {kind: 'builtin'}> | undefined {
  return homeCards.find(
    (card): card is Extract<OrdersHomeCardConfig, {kind: 'builtin'}> =>
      isBuiltinOrdersHomeCard(card) && card.target === target,
  );
}

export function resolveBuiltinOrdersHomeCardLabel(
  target: OrdersHomeBuiltinTarget,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  const card = findBuiltinOrdersHomeCard(homeCards, target);
  if (card?.name.trim()) {
    return card.name.trim();
  }

  return t(getMirrorPricingOrderMoveTargetTitleKey(target));
}

export function resolveOrdersHomeCardReportLabel(
  card: OrdersHomeCardConfig,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  if (isCustomOrdersHomeCard(card)) {
    return card.name.trim() || t('ordersHomeCustomCard');
  }

  if (isBuiltinOrdersHomeCard(card)) {
    return resolveBuiltinOrdersHomeCardLabel(card.target, homeCards, t);
  }

  return t('ordersHomeCustomCard');
}

export function resolveMirrorPricingOrderStatusLabel(
  status: MirrorPricingOrderStatus,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  return resolveBuiltinOrdersHomeCardLabel(status, homeCards, t);
}

export function resolvePreparationOrdersHomeCardLabel(
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  return resolveBuiltinOrdersHomeCardLabel('preparation', homeCards, t);
}

/** Maps legacy/default section labels saved on orders to the current card name. */
const LEGACY_PREPARATION_LABELS = new Set([
  'طلبات قيد التجهيز',
  'Orders in preparation',
  'قيد التجهيز',
  'in preparation',
]);

export function resolveStoredHomeCardLabel(
  label: string | undefined,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  const trimmed = label?.trim();
  if (!trimmed) {
    return '—';
  }

  if (LEGACY_PREPARATION_LABELS.has(trimmed)) {
    return resolvePreparationOrdersHomeCardLabel(homeCards, t);
  }

  for (const card of homeCards) {
    if (isCustomOrdersHomeCard(card)) {
      if (trimmed === card.name.trim()) {
        return card.name.trim();
      }
      continue;
    }

    if (!isBuiltinOrdersHomeCard(card) || card.target === 'add_order') {
      continue;
    }

    const fallback = t(getMirrorPricingOrderMoveTargetTitleKey(card.target));
    if (trimmed === card.name.trim() || trimmed === fallback) {
      return card.name.trim() || fallback;
    }
  }

  const preparationFallback = t(getMirrorPricingOrderStatusTitleKey('preparation'));
  if (trimmed === preparationFallback) {
    return resolvePreparationOrdersHomeCardLabel(homeCards, t);
  }

  return trimmed;
}

export function findOrdersHomeCardByStoredLabel(
  label: string | undefined,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): OrdersHomeCardConfig | undefined {
  const trimmed = label?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (LEGACY_PREPARATION_LABELS.has(trimmed)) {
    return findBuiltinOrdersHomeCard(homeCards, 'preparation');
  }

  for (const card of homeCards) {
    if (isCustomOrdersHomeCard(card)) {
      if (trimmed === card.name.trim()) {
        return card;
      }
      continue;
    }

    if (!isBuiltinOrdersHomeCard(card) || card.target === 'add_order') {
      continue;
    }

    const resolved = resolveStoredHomeCardLabel(card.name.trim(), homeCards, t);
    const fallback = t(getMirrorPricingOrderMoveTargetTitleKey(card.target));
    const candidates = new Set([card.name.trim(), resolved, fallback].filter(Boolean));
    if (candidates.has(trimmed)) {
      return card;
    }
  }

  const preparationFallback = t(getMirrorPricingOrderStatusTitleKey('preparation'));
  if (trimmed === preparationFallback) {
    return findBuiltinOrdersHomeCard(homeCards, 'preparation');
  }

  return undefined;
}

export function resolveMirrorPricingOrderStatusEmptyMessage(
  status: MirrorPricingOrderStatus,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
  options?: {outstandingOnly?: boolean},
): string {
  if (options?.outstandingOnly) {
    return t('mirrorOrdersCompletedOutstandingEmpty');
  }

  switch (status) {
    case 'preparation':
      return t('mirrorOrdersEmptySection', {
        sectionName: resolvePreparationOrdersHomeCardLabel(homeCards, t),
      });
    case 'ready_delivery':
      return t('mirrorOrdersReadyDeliveryEmptySection', {
        sectionName: resolvePreparationOrdersHomeCardLabel(homeCards, t),
      });
    case 'ready_installation':
      return t('mirrorOrdersReadyInstallationEmptySection', {
        sectionName: resolvePreparationOrdersHomeCardLabel(homeCards, t),
      });
    case 'completed':
      return t('mirrorOrdersEmptySection', {
        sectionName: resolveMirrorPricingOrderStatusLabel('completed', homeCards, t),
      });
    default:
      return t('mirrorOrdersEmptySection', {
        sectionName: resolvePreparationOrdersHomeCardLabel(homeCards, t),
      });
  }
}
