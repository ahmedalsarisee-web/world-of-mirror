import {
  fetchAdminNotificationsNewerThan,
  mapAdminNotificationEventToStoreItem,
} from '@app/services/adminNotificationEvents.service';
import {useAdminNotificationStore} from '@app/stores/adminNotificationStore';
import {
  filterAdminNotificationEventsNotInCache,
  getAdminNotificationListNewestRecordedAt,
  isAdminNotificationListCacheHydrated,
  prependAdminNotificationListCache,
} from '@app/utils/adminNotificationListCache';
import {ensureAdminNotificationsNewerListener} from '@app/utils/adminNotificationRealtime';

/** Pull notification events newer than the cached head into memory + store. */
export async function syncAdminNotificationsNewerThanCache(): Promise<number> {
  if (!isAdminNotificationListCacheHydrated()) {
    return 0;
  }

  const newestRecordedAt = getAdminNotificationListNewestRecordedAt();
  if (!newestRecordedAt) {
    return 0;
  }

  const newerEvents = filterAdminNotificationEventsNotInCache(
    await fetchAdminNotificationsNewerThan(newestRecordedAt),
  );

  if (newerEvents.length === 0) {
    ensureAdminNotificationsNewerListener();
    return 0;
  }

  prependAdminNotificationListCache(newerEvents);
  useAdminNotificationStore
    .getState()
    .prependNotifications(newerEvents.map(mapAdminNotificationEventToStoreItem));
  ensureAdminNotificationsNewerListener();
  return newerEvents.length;
}

export function prefetchAdminNotificationsNewer(): void {
  void syncAdminNotificationsNewerThanCache().catch(() => undefined);
}
