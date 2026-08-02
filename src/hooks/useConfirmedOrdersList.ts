import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {DocumentSnapshot} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {
  CONFIRMED_ORDERS_PAGE_SIZE,
  fetchMoreConfirmedOrders,
  filterConfirmedOrdersForListParams,
  getConfirmedOrdersListCount,
  getLocalConfirmedOrdersPage,
  type ConfirmedOrdersListParams,
  subscribeToConfirmedOrdersList,
} from '@app/services/confirmedOrders.service';
import {
  confirmedOrderListRevision,
  confirmedOrdersPageSnapshotKey,
  useMirrorPricingConfirmedOrdersStore,
} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {sortConfirmedOrdersByStatusChangedAt} from '@app/types/mirrorPricingConfirmedOrder';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';
import {getCachedConfirmedOrdersListPage} from '@app/utils/confirmedOrdersListCache';
import {mergeConfirmedOrdersListPageWithStore} from '@app/utils/deliveryCompanyShare';

interface Options {
  statusFilter?: MirrorPricingOrderStatus;
  homeCardId?: string;
  outstandingOnly?: boolean;
  activeOnly?: boolean;
  enabled?: boolean;
}

function filterPendingDeletedOrders(
  orders: MirrorPricingConfirmedOrder[],
  pendingDeletedOrderIds: string[],
): MirrorPricingConfirmedOrder[] {
  if (pendingDeletedOrderIds.length === 0) {
    return orders;
  }
  const pendingDeleted = new Set(pendingDeletedOrderIds);
  return orders.filter((order) => !pendingDeleted.has(order.id));
}

function acknowledgePendingDeletedOrdersFromSnapshot(orderIds: string[]): void {
  if (orderIds.length === 0) {
    return;
  }
  const snapshotIds = new Set(orderIds);
  const store = useMirrorPricingConfirmedOrdersStore.getState();
  for (const pendingId of store.pendingDeletedOrderIds) {
    if (!snapshotIds.has(pendingId)) {
      store.acknowledgePendingDeletedOrder(pendingId);
    }
  }
}

function mergeUniqueOrders(
  firstPage: MirrorPricingConfirmedOrder[],
  extraPages: MirrorPricingConfirmedOrder[],
): MirrorPricingConfirmedOrder[] {
  const byId = new Map<string, MirrorPricingConfirmedOrder>();
  const orderedIds: string[] = [];

  for (const order of firstPage) {
    if (!byId.has(order.id)) {
      orderedIds.push(order.id);
    }
    byId.set(order.id, order);
  }
  for (const order of extraPages) {
    if (!byId.has(order.id)) {
      orderedIds.push(order.id);
    }
    byId.set(order.id, order);
  }

  // Preserve loaded order so realtime field updates do not reshuffle the list mid-scroll.
  return orderedIds.map((id) => byId.get(id)!);
}

/** Prefer the live store row when deciding whether an order still belongs on this list. */
function resolveListMembershipOrder(
  order: MirrorPricingConfirmedOrder,
  storeById: Map<string, MirrorPricingConfirmedOrder>,
): MirrorPricingConfirmedOrder {
  return storeById.get(order.id) ?? order;
}

function syncLoadedOrdersWithStore(
  current: MirrorPricingConfirmedOrder[],
  storeById: Map<string, MirrorPricingConfirmedOrder>,
  matchingStoreOrders: MirrorPricingConfirmedOrder[],
  listParams: ConfirmedOrdersListParams,
  pendingDeleted: Set<string>,
  options?: {acceptNewcomers?: boolean; pageSize?: number; newcomerMaxAgeMs?: number},
): {next: MirrorPricingConfirmedOrder[]; overflow: MirrorPricingConfirmedOrder[]; changed: boolean} {
  let changed = false;
  const next: MirrorPricingConfirmedOrder[] = [];

  for (const order of current) {
    if (pendingDeleted.has(order.id)) {
      changed = true;
      continue;
    }

    const resolved = resolveListMembershipOrder(order, storeById);
    if (filterConfirmedOrdersForListParams([resolved], listParams).length === 0) {
      // Moved/deleted from this card — drop immediately using the store version.
      changed = true;
      continue;
    }

    if (resolved !== order) {
      if (confirmedOrderListRevision(resolved) !== confirmedOrderListRevision(order)) {
        changed = true;
      }
      next.push(resolved);
    } else {
      next.push(order);
    }
  }

  const overflow: MirrorPricingConfirmedOrder[] = [];
  if (options?.acceptNewcomers) {
    const existingIds = new Set(next.map((order) => order.id));
    const maxAgeMs = options.newcomerMaxAgeMs ?? 20_000;
    const now = Date.now();
    // Only recently moved/updated rows — avoid dumping the whole store into page 1.
    const newcomers = matchingStoreOrders.filter((order) => {
      if (existingIds.has(order.id) || pendingDeleted.has(order.id)) {
        return false;
      }
      const changedAt = Date.parse(order.statusChangedAt || order.lastUpdatedAt || '');
      return Number.isFinite(changedAt) && now - changedAt <= maxAgeMs;
    });
    if (newcomers.length > 0) {
      changed = true;
      const sortedNewcomers = sortConfirmedOrdersByStatusChangedAt(newcomers);
      const merged = [...sortedNewcomers, ...next];
      const pageSize = options.pageSize ?? CONFIRMED_ORDERS_PAGE_SIZE;
      next.length = 0;
      next.push(...merged.slice(0, pageSize));
      overflow.push(...merged.slice(pageSize));
    }
  }

  return {next, overflow, changed};
}

function resolveWarmListPage(params: ConfirmedOrdersListParams) {
  return getCachedConfirmedOrdersListPage(params) ?? getLocalConfirmedOrdersPage(params);
}

export function useConfirmedOrdersList({
  statusFilter = 'preparation',
  homeCardId,
  outstandingOnly = false,
  activeOnly = false,
  enabled = true,
}: Options) {
  const listParams = useMemo<ConfirmedOrdersListParams>(
    () => ({statusFilter, homeCardId, outstandingOnly, activeOnly}),
    [activeOnly, homeCardId, outstandingOnly, statusFilter],
  );
  const upsertOrders = useMirrorPricingConfirmedOrdersStore((state) => state.upsertOrders);
  const storeOrders = useMirrorPricingConfirmedOrdersStore((state) => state.orders);
  const pendingDeletedOrderIds = useMirrorPricingConfirmedOrdersStore(
    (state) => state.pendingDeletedOrderIds,
  );
  const warmPage = useMemo(() => resolveWarmListPage(listParams), [listParams]);

  const [firstPageOrders, setFirstPageOrders] = useState<MirrorPricingConfirmedOrder[]>(
    () => warmPage.orders,
  );
  const [extraPageOrders, setExtraPageOrders] = useState<MirrorPricingConfirmedOrder[]>([]);
  const [hasMore, setHasMore] = useState(warmPage.hasMore);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(enabled && warmPage.orders.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef<DocumentSnapshot | null>(warmPage.lastDoc);
  const countRequestRef = useRef(0);

  const lastPageSnapshotRef = useRef<string | null>(null);
  const lastStoreMergeSnapshotRef = useRef<string | null>(null);
  const firstPageOrdersRef = useRef(firstPageOrders);
  firstPageOrdersRef.current = firstPageOrders;

  const orders = useMemo(
    () =>
      filterPendingDeletedOrders(
        mergeUniqueOrders(firstPageOrders, extraPageOrders),
        pendingDeletedOrderIds,
      ),
    [extraPageOrders, firstPageOrders, pendingDeletedOrderIds],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const nextWarmPage = resolveWarmListPage(listParams);
    lastPageSnapshotRef.current =
      nextWarmPage.orders.length > 0
        ? confirmedOrdersPageSnapshotKey(nextWarmPage.orders)
        : null;
    lastStoreMergeSnapshotRef.current = null;
    setFirstPageOrders(nextWarmPage.orders);
    setExtraPageOrders([]);
    setHasMore(nextWarmPage.hasMore);
    lastDocRef.current = nextWarmPage.lastDoc;
    setLoading(nextWarmPage.orders.length === 0);

    const countRequestId = countRequestRef.current + 1;
    countRequestRef.current = countRequestId;

    void getConfirmedOrdersListCount(listParams)
      .then((count) => {
        if (countRequestRef.current === countRequestId) {
          setTotalCount(count);
        }
      })
      .catch(() => {
        if (countRequestRef.current === countRequestId) {
          setTotalCount(null);
        }
      });

    return subscribeToConfirmedOrdersList(listParams, ({orders: pageOrders, hasMore: nextHasMore, lastDoc}) => {
      acknowledgePendingDeletedOrdersFromSnapshot(pageOrders.map((entry) => entry.id));

      const mergedPageOrders = filterPendingDeletedOrders(
        mergeConfirmedOrdersListPageWithStore(
          pageOrders,
          useMirrorPricingConfirmedOrdersStore.getState().orders,
        ),
        useMirrorPricingConfirmedOrdersStore.getState().pendingDeletedOrderIds,
      ).filter(
        (order) => filterConfirmedOrdersForListParams([order], listParams).length > 0,
      );
      const pageSnapshot = confirmedOrdersPageSnapshotKey(mergedPageOrders);
      if (pageSnapshot === lastPageSnapshotRef.current) {
        setLoading(false);
        return;
      }
      lastPageSnapshotRef.current = pageSnapshot;
      lastStoreMergeSnapshotRef.current = pageSnapshot;

      const firstPageIds = new Set(mergedPageOrders.map((entry) => entry.id));
      const storeById = new Map(
        useMirrorPricingConfirmedOrdersStore.getState().orders.map((entry) => [entry.id, entry]),
      );
      const demotedFromFirstPage = firstPageOrdersRef.current.filter((order) => {
        if (firstPageIds.has(order.id)) {
          return false;
        }
        const resolved = resolveListMembershipOrder(order, storeById);
        return filterConfirmedOrdersForListParams([resolved], listParams).length > 0;
      });

      // Keep already-loaded pages (and demoted first-page rows) so realtime
      // updates do not collapse the list and jump scroll while lower down.
      setExtraPageOrders((current) => {
        const kept = current.filter((order) => {
          if (firstPageIds.has(order.id)) {
            return false;
          }
          const resolved = resolveListMembershipOrder(order, storeById);
          return filterConfirmedOrdersForListParams([resolved], listParams).length > 0;
        });
        const seen = new Set(kept.map((order) => order.id));
        const prepended = demotedFromFirstPage.filter((order) => !seen.has(order.id));
        return prepended.length > 0 ? [...prepended, ...kept] : kept;
      });
      setFirstPageOrders(mergedPageOrders);
      setHasMore(nextHasMore);
      lastDocRef.current = lastDoc;
      setLoading(false);
      if (!isMockMode) {
        useMirrorPricingConfirmedOrdersStore.getState().upsertOrders(mergedPageOrders);
      }
    });
  }, [enabled, listParams]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pendingDeleted = new Set(pendingDeletedOrderIds);
    const storeById = new Map(storeOrders.map((order) => [order.id, order]));
    const matchingStoreOrders = sortConfirmedOrdersByStatusChangedAt(
      filterConfirmedOrdersForListParams(storeOrders, listParams),
    );

    const firstSync = syncLoadedOrdersWithStore(
      firstPageOrdersRef.current,
      storeById,
      matchingStoreOrders,
      listParams,
      pendingDeleted,
      {acceptNewcomers: true, pageSize: CONFIRMED_ORDERS_PAGE_SIZE},
    );

    if (firstSync.changed) {
      const nextSnapshot = confirmedOrdersPageSnapshotKey(firstSync.next);
      lastStoreMergeSnapshotRef.current = nextSnapshot;
      lastPageSnapshotRef.current = nextSnapshot;
      setFirstPageOrders(firstSync.next);
    } else {
      lastStoreMergeSnapshotRef.current = confirmedOrdersPageSnapshotKey(firstPageOrdersRef.current);
    }

    setExtraPageOrders((current) => {
      const {next, changed} = syncLoadedOrdersWithStore(
        current,
        storeById,
        matchingStoreOrders,
        listParams,
        pendingDeleted,
      );

      if (firstSync.overflow.length === 0) {
        return changed ? next : current;
      }

      const seen = new Set([
        ...firstSync.next.map((order) => order.id),
        ...next.map((order) => order.id),
      ]);
      const prepended = firstSync.overflow.filter((order) => !seen.has(order.id));
      return prepended.length > 0 || changed ? [...prepended, ...next] : current;
    });
  }, [enabled, listParams, pendingDeletedOrderIds, storeOrders]);

  const loadMore = useCallback(async () => {
    if (!enabled || loadingMore || !hasMore || !lastDocRef.current) {
      return;
    }

    setLoadingMore(true);
    try {
      const result = await fetchMoreConfirmedOrders(listParams, lastDocRef.current);
      lastDocRef.current = result.lastDoc;
      setHasMore(result.hasMore);
      setExtraPageOrders((current) => {
        const seen = new Set([
          ...firstPageOrders.map((entry) => entry.id),
          ...current.map((entry) => entry.id),
        ]);
        const appended = result.orders.filter((entry) => !seen.has(entry.id));
        return appended.length > 0 ? [...current, ...appended] : current;
      });
      upsertOrders(result.orders);
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, firstPageOrders, hasMore, listParams, loadingMore, upsertOrders]);

  return {
    orders,
    totalCount,
    hasMore,
    loading,
    loadingMore,
    loadMore,
    pageSize: CONFIRMED_ORDERS_PAGE_SIZE,
  };
}