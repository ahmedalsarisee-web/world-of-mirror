import type {ConfirmedOrdersListParams} from '@app/utils/confirmedOrderListBucket';
import type {OrdersHomeCardConfig} from '@app/types/ordersHomeCard';
import {isBuiltinOrdersHomeCard, isCustomOrdersHomeCard} from '@app/types/ordersHomeCard';

export function resolveOrdersHomeCardListParams(
  card: OrdersHomeCardConfig,
): ConfirmedOrdersListParams | null {
  if (isCustomOrdersHomeCard(card)) {
    return {homeCardId: card.id};
  }

  if (!isBuiltinOrdersHomeCard(card)) {
    return null;
  }

  switch (card.target) {
    case 'add_order':
      return null;
    case 'completed_outstanding':
      return {statusFilter: 'completed', outstandingOnly: true};
    case 'preparation':
    case 'ready_delivery':
    case 'ready_installation':
    case 'completed':
      return {statusFilter: card.target};
    default:
      return null;
  }
}
