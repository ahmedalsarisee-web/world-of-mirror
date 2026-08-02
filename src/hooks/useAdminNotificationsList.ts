import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ADMIN_NOTIFICATION_PAGE_SIZE,
  fetchAdminNotificationEventsPage,
  mapAdminNotificationEventToStoreItem,
} from '@app/services/adminNotificationEvents.service';
import {
  type AdminNotificationRecord,
  notificationSortTime,
  useAdminNotificationStore,
} from '@app/stores/adminNotificationStore';
import type {AdminNotificationEvent} from '@app/types/adminNotificationEvent';
import {
  appendAdminNotificationListCache,
  getAdminNotificationListCacheEvents,
  getAdminNotificationListCacheHasMore,
  getAdminNotificationListCacheLastDoc,
  getAdminNotificationListCachePaginationCursor,
  isAdminNotificationListCacheHydrated,
  restoreAdminNotificationListCache,
  setAdminNotificationListInitialPage,
  subscribeAdminNotificationListCache,
} from '@app/utils/adminNotificationListCache';
import {resolveAdminNotificationReadState} from '@app/utils/adminNotificationReadState';
import {ensureAdminNotificationsNewerListener, stopAdminNotificationsNewerListener} from '@app/utils/adminNotificationRealtime';
import {syncAdminNotificationsNewerThanCache} from '@app/utils/adminNotificationNewerSync';

function mapCacheEventsToDisplayItems(
  events: AdminNotificationEvent[],
  storeItems: AdminNotificationRecord[],
): AdminNotificationRecord[] {
  const readById = new Map(storeItems.map((item) => [item.id, item.read]));

  return events.map((event) => {
    const mapped = mapAdminNotificationEventToStoreItem(event);
    return {
      id: mapped.id,
      title: mapped.title,
      body: mapped.body,
      kind: mapped.kind,
      receivedAt: mapped.recordedAt,
      eventAt: mapped.eventAt,
      metadata: mapped.metadata,
      read: resolveAdminNotificationReadState(mapped.id, readById.get(mapped.id) ?? false),
    };
  });
}

function pruneStoreToVisibleCache(): void {
  const cacheIds = new Set(getAdminNotificationListCacheEvents().map((event) => event.id));
  const items = useAdminNotificationStore.getState().items;
  const pruned = items.filter((item) => cacheIds.has(item.id));
  if (pruned.length !== items.length) {
    useAdminNotificationStore.setState({items: pruned});
  }
}

function resolveHasMoreToShow(visibleCount: number): boolean {
  const cachedCount = getAdminNotificationListCacheEvents().length;
  return visibleCount < cachedCount || getAdminNotificationListCacheHasMore();
}

function shouldFetchInitialNotificationsPage(): boolean {
  if (!isAdminNotificationListCacheHydrated()) {
    return true;
  }

  return (
    getAdminNotificationListCacheEvents().length < ADMIN_NOTIFICATION_PAGE_SIZE &&
    getAdminNotificationListCacheHasMore() &&
    getAdminNotificationListCacheLastDoc() === null
  );
}

const MAX_EMPTY_PAGE_FETCHES = 4;

export function useAdminNotificationsList(visible: boolean) {
  const storeItems = useAdminNotificationStore((state) => state.items);
  const mergeNotifications = useAdminNotificationStore((state) => state.mergeNotifications);
  const [listRevision, setListRevision] = useState(0);
  const [visibleCount, setVisibleCount] = useState(ADMIN_NOTIFICATION_PAGE_SIZE);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshingNewer, setRefreshingNewer] = useState(false);
  const [hasMore, setHasMore] = useState(() => resolveHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE));
  const syncRequestRef = useRef(0);
  const restoreAttemptedRef = useRef(false);
  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;

  const bumpListRevision = useCallback(() => {
    setListRevision((value) => value + 1);
  }, []);

  const syncHasMoreToShow = useCallback((nextVisibleCount: number) => {
    setHasMore(resolveHasMoreToShow(nextVisibleCount));
  }, []);

  useEffect(() => {
    return subscribeAdminNotificationListCache(() => {
      bumpListRevision();
      syncHasMoreToShow(visibleCountRef.current);
    });
  }, [bumpListRevision, syncHasMoreToShow]);

  const upsertStoreFromEvents = useCallback(
    (events: AdminNotificationEvent[]) => {
      if (events.length === 0) {
        return;
      }
      mergeNotifications(events.map(mapAdminNotificationEventToStoreItem));
    },
    [mergeNotifications],
  );

  const displayItems = useMemo(() => {
    const items = mapCacheEventsToDisplayItems(
      getAdminNotificationListCacheEvents(),
      storeItems,
    );
    return items
      .sort((left, right) => notificationSortTime(right) - notificationSortTime(left))
      .slice(0, visibleCount);
  }, [listRevision, storeItems, visibleCount]);

  const syncNewerNotifications = useCallback(async () => {
    const syncedCount = await syncAdminNotificationsNewerThanCache();
    if (syncedCount > 0) {
      bumpListRevision();
    }
  }, [bumpListRevision]);

  const runBackgroundNewerSync = useCallback(
    (requestId: number, cancelledRef: {current: boolean}) => {
      setRefreshingNewer(true);
      void syncNewerNotifications()
        .then(() => {
          if (!cancelledRef.current && syncRequestRef.current === requestId) {
            syncHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE);
          }
        })
        .catch((error) => {
          console.error('[useAdminNotificationsList] newer sync', error);
        })
        .finally(() => {
          if (!cancelledRef.current && syncRequestRef.current === requestId) {
            setRefreshingNewer(false);
          }
        });
    },
    [syncHasMoreToShow, syncNewerNotifications],
  );

  useEffect(() => {
    if (!visible) {
      stopAdminNotificationsNewerListener();
      return;
    }

    return () => {
      stopAdminNotificationsNewerListener();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setVisibleCount(ADMIN_NOTIFICATION_PAGE_SIZE);
    syncHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE);
    bumpListRevision();

    const requestId = syncRequestRef.current + 1;
    syncRequestRef.current = requestId;
    const cancelledRef = {current: false};

    const run = async () => {
      if (!isAdminNotificationListCacheHydrated() && !restoreAttemptedRef.current) {
        restoreAttemptedRef.current = true;
        const restored = await restoreAdminNotificationListCache();
        if (cancelledRef.current || syncRequestRef.current !== requestId) {
          return;
        }
        if (restored) {
          upsertStoreFromEvents(getAdminNotificationListCacheEvents());
          pruneStoreToVisibleCache();
          syncHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE);
          bumpListRevision();
          ensureAdminNotificationsNewerListener();
          runBackgroundNewerSync(requestId, cancelledRef);
          return;
        }
      }

      if (!isAdminNotificationListCacheHydrated()) {
        setLoadingInitial(true);
        try {
          const page = await fetchAdminNotificationEventsPage();
          if (cancelledRef.current || syncRequestRef.current !== requestId) {
            return;
          }

          setAdminNotificationListInitialPage(page.events, page.lastDoc, page.hasMore);
          upsertStoreFromEvents(page.events);
          pruneStoreToVisibleCache();
          syncHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE);
          bumpListRevision();
          ensureAdminNotificationsNewerListener();
        } catch (error) {
          console.error('[useAdminNotificationsList] initial page', error);
        } finally {
          if (!cancelledRef.current && syncRequestRef.current === requestId) {
            setLoadingInitial(false);
          }
        }
        return;
      }

      if (shouldFetchInitialNotificationsPage()) {
        setLoadingInitial(true);
        try {
          const page = await fetchAdminNotificationEventsPage();
          if (cancelledRef.current || syncRequestRef.current !== requestId) {
            return;
          }

          setAdminNotificationListInitialPage(page.events, page.lastDoc, page.hasMore);
          upsertStoreFromEvents(page.events);
          pruneStoreToVisibleCache();
          syncHasMoreToShow(ADMIN_NOTIFICATION_PAGE_SIZE);
          bumpListRevision();
          ensureAdminNotificationsNewerListener();
        } catch (error) {
          console.error('[useAdminNotificationsList] refill initial page', error);
        } finally {
          if (!cancelledRef.current && syncRequestRef.current === requestId) {
            setLoadingInitial(false);
          }
        }
        return;
      }

      pruneStoreToVisibleCache();
      runBackgroundNewerSync(requestId, cancelledRef);
    };

    void run();

    return () => {
      cancelledRef.current = true;
    };
  }, [
    bumpListRevision,
    runBackgroundNewerSync,
    syncHasMoreToShow,
    upsertStoreFromEvents,
    visible,
  ]);

  const loadMoreInFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (
      loadingInitial ||
      loadingMore ||
      refreshingNewer ||
      loadMoreInFlightRef.current ||
      !resolveHasMoreToShow(visibleCount)
    ) {
      return;
    }

    loadMoreInFlightRef.current = true;
    setLoadingMore(true);

    const targetVisibleCount = visibleCount + ADMIN_NOTIFICATION_PAGE_SIZE;

    try {
      if (getAdminNotificationListCacheEvents().length >= targetVisibleCount) {
        setVisibleCount(targetVisibleCount);
        syncHasMoreToShow(targetVisibleCount);
        return;
      }

      for (let attempt = 0; attempt < MAX_EMPTY_PAGE_FETCHES; attempt += 1) {
        if (getAdminNotificationListCacheEvents().length >= targetVisibleCount) {
          break;
        }

        if (!getAdminNotificationListCacheHasMore()) {
          break;
        }

        const page = await fetchAdminNotificationEventsPage({
          ...getAdminNotificationListCachePaginationCursor(),
        });

        if (page.events.length > 0) {
          appendAdminNotificationListCache(page.events, page.lastDoc, page.hasMore);
          upsertStoreFromEvents(page.events);
          bumpListRevision();
          if (getAdminNotificationListCacheEvents().length >= targetVisibleCount || !page.hasMore) {
            break;
          }
          continue;
        }

        if (!page.hasMore) {
          appendAdminNotificationListCache([], page.lastDoc, false);
          bumpListRevision();
          break;
        }

        appendAdminNotificationListCache([], page.lastDoc, page.hasMore);
      }

      const nextVisibleCount = Math.min(
        targetVisibleCount,
        getAdminNotificationListCacheEvents().length,
      );
      setVisibleCount(nextVisibleCount);
      syncHasMoreToShow(nextVisibleCount);
      bumpListRevision();
    } catch (error) {
      console.error('[useAdminNotificationsList] load more', error);
    } finally {
      loadMoreInFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [
    bumpListRevision,
    loadingInitial,
    loadingMore,
    refreshingNewer,
    syncHasMoreToShow,
    upsertStoreFromEvents,
    visibleCount,
  ]);

  return {
    displayItems,
    loadingInitial,
    loadingMore,
    hasMore,
    loadMore,
  };
}
