import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {hasConfirmedOrderOutstandingBalance} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {resolveMirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';

export interface ConfirmedOrdersListParams {
  statusFilter?: MirrorPricingOrderStatus;
  homeCardId?: string;
  outstandingOnly?: boolean;
  /** All orders that are not completed (including custom home cards). */
  activeOnly?: boolean;
}

export type ConfirmedOrderListBucket =
  | MirrorPricingOrderStatus
  | `card:${string}`;

export function resolveOrderIsActive(
  order: Pick<MirrorPricingConfirmedOrder, 'status'>,
): boolean {
  return resolveMirrorPricingOrderStatus(order.status) !== 'completed';
}

export function resolveConfirmedOrderListBucket(
  order: Pick<
    MirrorPricingConfirmedOrder,
    'status' | 'homeCardId' | 'total' | 'collectedAmount' | 'remainingAmount'
  >,
): ConfirmedOrderListBucket {
  if (order.homeCardId) {
    return `card:${order.homeCardId}`;
  }

  return resolveMirrorPricingOrderStatus(order.status);
}

export function resolveConfirmedOrderIndexFields(
  order: Pick<
    MirrorPricingConfirmedOrder,
    | 'status'
    | 'homeCardId'
    | 'total'
    | 'collectedAmount'
    | 'remainingAmount'
    | 'paymentFollowUpRequired'
  >,
): {
  listBucket: ConfirmedOrderListBucket;
  hasOutstandingBalance: boolean;
  isOrderActive: boolean;
} {
  return {
    listBucket: resolveConfirmedOrderListBucket(order),
    hasOutstandingBalance: hasConfirmedOrderOutstandingBalance(order),
    isOrderActive: resolveOrderIsActive(order),
  };
}

export function resolveConfirmedOrdersListBucketParams(params: {
  statusFilter?: MirrorPricingOrderStatus;
  homeCardId?: string;
  outstandingOnly?: boolean;
  activeOnly?: boolean;
}): ConfirmedOrderListBucket | 'active' {
  if (params.activeOnly) {
    return 'active';
  }

  if (params.homeCardId) {
    return `card:${params.homeCardId}`;
  }

  if (params.outstandingOnly) {
    return 'completed';
  }

  return params.statusFilter ?? 'preparation';
}

export function resolveOrdersHomeCardListBucket(
  cardTarget: string,
  cardId: string,
): ConfirmedOrderListBucket | null {
  if (cardTarget === 'add_order') {
    return null;
  }

  if (cardTarget.startsWith('custom:') || cardId.startsWith('custom-')) {
    return `card:${cardId}`;
  }

  if (cardTarget === 'completed_outstanding') {
    return 'completed';
  }

  if (
    cardTarget === 'preparation' ||
    cardTarget === 'ready_delivery' ||
    cardTarget === 'ready_installation' ||
    cardTarget === 'completed'
  ) {
    return cardTarget;
  }

  return null;
}
