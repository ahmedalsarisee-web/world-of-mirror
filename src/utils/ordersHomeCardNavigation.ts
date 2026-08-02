import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  resolveBuiltinOrdersHomeCardLabel,
  resolveMirrorPricingOrderStatusLabel,
} from '@app/utils/ordersHomeCardLabels';
import type {PricingStackParamList} from '@app/types/navigation';
import {
  isBuiltinOrdersHomeCard,
  isCustomOrdersHomeCard,
  type OrdersHomeCardConfig,
  type OrdersHomeBuiltinTarget,
} from '@app/types/ordersHomeCard';
import {
  hasPaymentFollowUp,
  isCompletedOrderWithOutstandingBalance,
} from '@app/types/mirrorPricingConfirmedOrder';

type PricingNav = NativeStackNavigationProp<PricingStackParamList>;

export type OrderSearchNavigationTarget =
  | {
      screen: 'CustomOrdersCard';
      params: PricingStackParamList['CustomOrdersCard'];
    }
  | {
      screen: 'ConfirmedOrders';
      params: PricingStackParamList['ConfirmedOrders'];
    }
  | {
      screen: 'OrdersByStatus';
      params: PricingStackParamList['OrdersByStatus'];
    };

function resolveBuiltinCardOrdersByStatusParams(
  card: Extract<OrdersHomeCardConfig, {kind: 'builtin'}>,
  focusOrderId?: string,
): PricingStackParamList['OrdersByStatus'] | null {
  switch (card.target) {
    case 'preparation':
    case 'ready_delivery':
    case 'ready_installation':
    case 'completed':
      return {
        status: card.target,
        focusOrderId,
        ordersHomeCardId: card.id,
      };
    case 'completed_outstanding':
      return {
        status: 'completed',
        outstandingOnly: true,
        focusOrderId,
        ordersHomeCardId: card.id,
      };
    default:
      return null;
  }
}

/** Opens the orders section/card where this order currently lives. */
export function resolveOrderSearchNavigation(
  order: MirrorPricingConfirmedOrder,
): OrderSearchNavigationTarget {
  if (order.homeCardId) {
    return {
      screen: 'CustomOrdersCard',
      params: {
        ordersHomeCardId: order.homeCardId,
        focusOrderId: order.id,
      },
    };
  }

  const status = resolveMirrorPricingOrderStatus(order.status);

  if (status === 'completed' && isCompletedOrderWithOutstandingBalance(order)) {
    return {
      screen: 'OrdersByStatus',
      params: {
        status: 'completed',
        outstandingOnly: true,
        focusOrderId: order.id,
      },
    };
  }

  return {
    screen: 'OrdersByStatus',
    params: {
      status,
      focusOrderId: order.id,
    },
  };
}

export function resolveOrderSearchSectionTitle(
  order: MirrorPricingConfirmedOrder,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  if (order.homeCardId) {
    const card = homeCards.find((entry) => entry.id === order.homeCardId);
    return card?.name ?? t('ordersHomeCustomCard');
  }

  const status = resolveMirrorPricingOrderStatus(order.status);
  if (status === 'completed' && isCompletedOrderWithOutstandingBalance(order)) {
    return resolveBuiltinOrdersHomeCardLabel('completed_outstanding', homeCards, t);
  }

  return resolveMirrorPricingOrderStatusLabel(status, homeCards, t);
}

export function resolveOrdersHomeCardNavigationTarget(
  card: OrdersHomeCardConfig,
  focusOrderId?: string,
): OrderSearchNavigationTarget | undefined {
  if (isCustomOrdersHomeCard(card)) {
    return {
      screen: 'CustomOrdersCard',
      params: {
        ordersHomeCardId: card.id,
        focusOrderId,
      },
    };
  }

  if (!isBuiltinOrdersHomeCard(card)) {
    return undefined;
  }

  const params = resolveBuiltinCardOrdersByStatusParams(card, focusOrderId);
  if (!params) {
    return undefined;
  }

  return {
    screen: 'OrdersByStatus',
    params,
  };
}

export function navigateFromOrdersHomeCard(
  navigation: PricingNav,
  card: OrdersHomeCardConfig,
): void {
  if (isCustomOrdersHomeCard(card)) {
    navigation.navigate('CustomOrdersCard', {ordersHomeCardId: card.id});
    return;
  }

  if (!isBuiltinOrdersHomeCard(card)) {
    return;
  }

  switch (card.target) {
    case 'add_order':
      navigation.navigate('AddOrder', {ordersHomeCardId: card.id});
      return;
    default: {
      const params = resolveBuiltinCardOrdersByStatusParams(card);
      if (params) {
        navigation.navigate('OrdersByStatus', params);
      }
      return;
    }
  }
}

function countBuiltinOrders(
  orders: MirrorPricingConfirmedOrder[],
  status: MirrorPricingOrderStatus,
): number {
  return orders.filter((order) => {
    if (order.homeCardId) {
      return false;
    }
    return resolveMirrorPricingOrderStatus(order.status) === status;
  }).length;
}

export function orderBelongsToHomeCard(
  order: MirrorPricingConfirmedOrder,
  card: OrdersHomeCardConfig,
): boolean {
  if (isCustomOrdersHomeCard(card)) {
    return order.homeCardId === card.id;
  }

  if (order.homeCardId) {
    return false;
  }

  const status = resolveMirrorPricingOrderStatus(order.status);
  switch (card.target) {
    case 'add_order':
      return false;
    case 'preparation':
      return status === 'preparation';
    case 'ready_delivery':
      return status === 'ready_delivery';
    case 'ready_installation':
      return status === 'ready_installation';
    case 'completed':
      return status === 'completed';
    case 'completed_outstanding':
      return isCompletedOrderWithOutstandingBalance(order);
    default:
      return false;
  }
}

export function countPaymentFollowUpOrdersForHomeCard(
  orders: MirrorPricingConfirmedOrder[],
  card: OrdersHomeCardConfig,
): number {
  if (isBuiltinOrdersHomeCard(card) && card.target === 'add_order') {
    return 0;
  }

  return orders.filter(
    (order) => hasPaymentFollowUp(order) && orderBelongsToHomeCard(order, card),
  ).length;
}

export function hasPaymentFollowUpOrdersForHomeCard(
  orders: MirrorPricingConfirmedOrder[],
  card: OrdersHomeCardConfig,
): boolean {
  return countPaymentFollowUpOrdersForHomeCard(orders, card) > 0;
}

export function countOrdersForHomeCard(
  orders: MirrorPricingConfirmedOrder[],
  card: OrdersHomeCardConfig,
): number | undefined {
  if (isCustomOrdersHomeCard(card)) {
    const count = orders.filter((order) => order.homeCardId === card.id).length;
    return count > 0 ? count : undefined;
  }

  const target = card.target;
  switch (target) {
    case 'add_order':
      return undefined;
    case 'preparation':
      return countBuiltinOrders(orders, 'preparation') || undefined;
    case 'ready_delivery':
      return countBuiltinOrders(orders, 'ready_delivery') || undefined;
    case 'ready_installation':
      return countBuiltinOrders(orders, 'ready_installation') || undefined;
    case 'completed':
      return countBuiltinOrders(orders, 'completed') || undefined;
    case 'completed_outstanding': {
      const count = orders.filter(
        (order) => !order.homeCardId && isCompletedOrderWithOutstandingBalance(order),
      ).length;
      return count > 0 ? count : undefined;
    }
    default:
      return undefined;
  }
}

export function getOrdersHomeCardPaletteKey(
  card: OrdersHomeCardConfig,
  customCardIndex: number,
): OrdersHomeBuiltinTarget | `custom_${number}` {
  if (isBuiltinOrdersHomeCard(card)) {
    return card.target;
  }
  return `custom_${customCardIndex % 3}`;
}

export interface OrdersHomeCardDisplayStats {
  badge?: number;
  paymentAlert: boolean;
  paymentAlertCount: number;
}

/** Single pass over orders — same counts as countOrdersForHomeCard helpers. */
export function computeOrdersHomeCardDisplayStats(
  orders: MirrorPricingConfirmedOrder[],
  cards: OrdersHomeCardConfig[],
): Map<string, OrdersHomeCardDisplayStats> {
  const stats = new Map<string, OrdersHomeCardDisplayStats>();

  for (const card of cards) {
    stats.set(card.id, {paymentAlert: false, paymentAlertCount: 0});
  }

  for (const order of orders) {
    for (const card of cards) {
      if (!orderBelongsToHomeCard(order, card)) {
        continue;
      }

      const entry = stats.get(card.id);
      if (!entry) {
        continue;
      }

      if (isBuiltinOrdersHomeCard(card) && card.target === 'add_order') {
        continue;
      }

      entry.badge = (entry.badge ?? 0) + 1;

      if (hasPaymentFollowUp(order)) {
        entry.paymentAlertCount += 1;
        entry.paymentAlert = true;
      }
    }
  }

  for (const [cardId, entry] of stats) {
    if (!entry.badge) {
      entry.badge = undefined;
    }
    stats.set(cardId, entry);
  }

  return stats;
}
