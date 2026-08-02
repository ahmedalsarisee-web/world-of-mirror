import type {TFunction} from 'i18next';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {hasConfirmedOrderOutstandingBalance} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderMoveTarget, MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveBuiltinOrdersHomeCardLabel} from '@app/utils/ordersHomeCardLabels';
import {resolveMirrorPricingOrderMoveTargetStatus, resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {
  getOrdersHomeScreenGridCards,
  isBuiltinOrdersHomeCard,
  isCustomOrdersHomeCard,
  type OrdersHomeCardConfig,
} from '@app/types/ordersHomeCard';

export type OrdersHomeMoveDestination =
  | {kind: 'status'; target: MirrorPricingOrderMoveTarget}
  | {kind: 'custom'; card: Extract<OrdersHomeCardConfig, {kind: 'custom'}>};

export function getOrdersHomeMoveDestinationKey(destination: OrdersHomeMoveDestination): string {
  if (destination.kind === 'custom') {
    return `custom:${destination.card.id}`;
  }
  return destination.target;
}

function resolveBuiltinMoveTarget(
  card: Extract<OrdersHomeCardConfig, {kind: 'builtin'}>,
): MirrorPricingOrderMoveTarget | null {
  if (card.target === 'add_order') {
    return null;
  }
  return card.target === 'completed_outstanding' ? 'completed_outstanding' : card.target;
}

/** Move/add-order destinations in the same order as the orders home screen grid. */
export function buildOrdersHomeMoveDestinationsInCardOrder(
  homeCards: OrdersHomeCardConfig[],
  options?: {excludeDestinationKey?: string},
): OrdersHomeMoveDestination[] {
  const destinations: OrdersHomeMoveDestination[] = [];
  const seenStatusTargets = new Set<MirrorPricingOrderMoveTarget>();

  for (const card of getOrdersHomeScreenGridCards(homeCards)) {
    if (isCustomOrdersHomeCard(card)) {
      const destinationKey = `custom:${card.id}`;
      if (options?.excludeDestinationKey === destinationKey) {
        continue;
      }
      destinations.push({kind: 'custom', card});
      continue;
    }

    if (!isBuiltinOrdersHomeCard(card)) {
      continue;
    }

    const target = resolveBuiltinMoveTarget(card);
    if (!target) {
      continue;
    }

    if (options?.excludeDestinationKey === target) {
      continue;
    }

    if (seenStatusTargets.has(target)) {
      continue;
    }

    seenStatusTargets.add(target);
    destinations.push({kind: 'status', target});
  }

  return destinations;
}

export function getOrdersHomeMoveStatusTargets(
  homeCards: OrdersHomeCardConfig[],
): MirrorPricingOrderMoveTarget[] {
  return buildOrdersHomeMoveDestinationsInCardOrder(homeCards)
    .filter((entry): entry is Extract<OrdersHomeMoveDestination, {kind: 'status'}> => entry.kind === 'status')
    .map((entry) => entry.target);
}

export function getOrdersHomeMoveCustomCards(
  homeCards: OrdersHomeCardConfig[],
): Extract<OrdersHomeCardConfig, {kind: 'custom'}>[] {
  return buildOrdersHomeMoveDestinationsInCardOrder(homeCards)
    .filter((entry): entry is Extract<OrdersHomeMoveDestination, {kind: 'custom'}> => entry.kind === 'custom')
    .map((entry) => entry.card);
}

export function getAddOrderDestinations(homeCards: OrdersHomeCardConfig[]): {
  destinations: OrdersHomeMoveDestination[];
  statusTargets: MirrorPricingOrderMoveTarget[];
  customCards: Extract<OrdersHomeCardConfig, {kind: 'custom'}>[];
} {
  const destinations = buildOrdersHomeMoveDestinationsInCardOrder(homeCards);
  return {
    destinations,
    statusTargets: getOrdersHomeMoveStatusTargets(homeCards),
    customCards: getOrdersHomeMoveCustomCards(homeCards),
  };
}

export function getDefaultAddOrderDestinationKey(): string {
  return 'preparation';
}

export function getAddOrderDestinationKeyFromCustomCard(cardId: string): string {
  return `custom:${cardId}`;
}

export function getAddOrderDestinationLabel(
  destinationKey: string,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  if (destinationKey.startsWith('custom:')) {
    const cardId = destinationKey.slice('custom:'.length);
    const card = homeCards.find((entry) => entry.id === cardId);
    return card?.name ?? t('mirrorOrdersActionsMoveToCustomCard');
  }

  return getOrderMoveDestinationLabel(destinationKey as MirrorPricingOrderMoveTarget, homeCards, t);
}

export function buildNewOrderDestinationFields(destinationKey: string): {
  status: MirrorPricingOrderStatus;
  homeCardId?: string;
} {
  if (destinationKey.startsWith('custom:')) {
    return {
      status: 'preparation',
      homeCardId: destinationKey.slice('custom:'.length),
    };
  }

  if (destinationKey === 'completed_outstanding' || destinationKey === 'completed') {
    return {
      status: 'completed',
      homeCardId: undefined,
    };
  }

  return {
    status: resolveMirrorPricingOrderMoveTargetStatus(
      destinationKey as MirrorPricingOrderMoveTarget,
    ),
    homeCardId: undefined,
  };
}

export function resolveOrderMoveDestinationKey(order: MirrorPricingConfirmedOrder): string {
  if (order.homeCardId) {
    return `custom:${order.homeCardId}`;
  }

  const status = resolveMirrorPricingOrderStatus(order.status);
  if (status === 'completed' && hasConfirmedOrderOutstandingBalance(order)) {
    return 'completed_outstanding';
  }

  return status;
}

export function getOrderMoveDestinations(
  order: MirrorPricingConfirmedOrder,
  homeCards: OrdersHomeCardConfig[],
): {
  destinations: OrdersHomeMoveDestination[];
  statusTargets: MirrorPricingOrderMoveTarget[];
  customCards: Extract<OrdersHomeCardConfig, {kind: 'custom'}>[];
} {
  const current = resolveOrderMoveDestinationKey(order);
  const destinations = buildOrdersHomeMoveDestinationsInCardOrder(homeCards, {
    excludeDestinationKey: current,
  });

  return {
    destinations,
    statusTargets: destinations
      .filter((entry): entry is Extract<OrdersHomeMoveDestination, {kind: 'status'}> => entry.kind === 'status')
      .map((entry) => entry.target),
    customCards: destinations
      .filter((entry): entry is Extract<OrdersHomeMoveDestination, {kind: 'custom'}> => entry.kind === 'custom')
      .map((entry) => entry.card),
  };
}

export function getOrderMoveDestinationLabel(
  target: MirrorPricingOrderMoveTarget,
  homeCards: OrdersHomeCardConfig[],
  t: TFunction,
): string {
  if (target === 'completed_outstanding') {
    return resolveBuiltinOrdersHomeCardLabel('completed_outstanding', homeCards, t);
  }

  return resolveBuiltinOrdersHomeCardLabel(target, homeCards, t);
}

export function hasOrderMoveDestinations(
  order: MirrorPricingConfirmedOrder,
  homeCards: OrdersHomeCardConfig[],
): boolean {
  const {destinations} = getOrderMoveDestinations(order, homeCards);
  return destinations.length > 0;
}

export function orderWouldChangeDestination(
  order: MirrorPricingConfirmedOrder,
  target: MirrorPricingOrderMoveTarget,
): boolean {
  return resolveOrderMoveDestinationKey(order) !== target;
}
