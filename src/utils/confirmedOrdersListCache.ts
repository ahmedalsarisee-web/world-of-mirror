import type {DocumentSnapshot} from 'firebase/firestore';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {ConfirmedOrdersListParams} from '@app/utils/confirmedOrderListBucket';

export interface ConfirmedOrdersListPage {
  orders: MirrorPricingConfirmedOrder[];
  hasMore: boolean;
  lastDoc: DocumentSnapshot | null;
}

const listPageCache = new Map<string, ConfirmedOrdersListPage>();

export function getConfirmedOrdersListCacheKey(params: ConfirmedOrdersListParams): string {
  return JSON.stringify({
    statusFilter: params.statusFilter ?? 'preparation',
    homeCardId: params.homeCardId ?? '',
    outstandingOnly: Boolean(params.outstandingOnly),
    activeOnly: Boolean(params.activeOnly),
  });
}

export function getCachedConfirmedOrdersListPage(
  params: ConfirmedOrdersListParams,
): ConfirmedOrdersListPage | null {
  return listPageCache.get(getConfirmedOrdersListCacheKey(params)) ?? null;
}

export function setCachedConfirmedOrdersListPage(
  params: ConfirmedOrdersListParams,
  page: ConfirmedOrdersListPage,
): void {
  listPageCache.set(getConfirmedOrdersListCacheKey(params), page);
}

export function clearConfirmedOrdersListCache(): void {
  listPageCache.clear();
}

export function removeOrderFromConfirmedOrdersListCache(orderId: string): void {
  for (const [key, page] of listPageCache.entries()) {
    const orders = page.orders.filter((entry) => entry.id !== orderId);
    if (orders.length !== page.orders.length) {
      listPageCache.set(key, {...page, orders});
    }
  }
}
