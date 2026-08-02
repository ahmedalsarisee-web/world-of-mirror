import type {Unsubscribe} from 'firebase/firestore';
import {
  getSharedNotificationLogClearedAtMs,
  mapAdminNotificationEventToStoreItem,
  subscribeToAdminNotificationsNewerThan,
} from '@app/services/adminNotificationEvents.service';
import {useAdminNotificationStore} from '@app/stores/adminNotificationStore';
import {
  filterAdminNotificationEventsNotInCache,
  getAdminNotificationListNewestRecordedAt,
  isAdminNotificationListCacheHydrated,
  prependAdminNotificationListCache,
} from '@app/utils/adminNotificationListCache';

let newerUnsubscribe: Unsubscribe | null = null;
let listeningAfterRecordedAt: string | null = null;

function resolveNewerListenerCursor(): string | null {
  if (!isAdminNotificationListCacheHydrated()) {
    return null;
  }

  const newestRecordedAt = getAdminNotificationListNewestRecordedAt();
  if (newestRecordedAt) {
    return newestRecordedAt;
  }

  const clearedAtMs = getSharedNotificationLogClearedAtMs();
  if (clearedAtMs > 0) {
    return new Date(clearedAtMs).toISOString();
  }

  return '1970-01-01T00:00:00.000Z';
}

function applyNewerNotifications(
  events: ReturnType<typeof filterAdminNotificationEventsNotInCache>,
): void {
  if (events.length === 0) {
    return;
  }

  prependAdminNotificationListCache(events);
  useAdminNotificationStore
    .getState()
    .prependNotifications(events.map(mapAdminNotificationEventToStoreItem));
}

export function stopAdminNotificationsNewerListener(): void {
  newerUnsubscribe?.();
  newerUnsubscribe = null;
  listeningAfterRecordedAt = null;
}

export function ensureAdminNotificationsNewerListener(): void {
  const afterRecordedAt = resolveNewerListenerCursor();
  if (!afterRecordedAt) {
    return;
  }

  if (listeningAfterRecordedAt === afterRecordedAt && newerUnsubscribe) {
    return;
  }

  stopAdminNotificationsNewerListener();
  listeningAfterRecordedAt = afterRecordedAt;

  newerUnsubscribe = subscribeToAdminNotificationsNewerThan(afterRecordedAt, (events) => {
    const freshEvents = filterAdminNotificationEventsNotInCache(events);
    if (freshEvents.length === 0) {
      return;
    }

    applyNewerNotifications(freshEvents);

    const nextAfterRecordedAt = getAdminNotificationListNewestRecordedAt();
    if (nextAfterRecordedAt && nextAfterRecordedAt !== listeningAfterRecordedAt) {
      ensureAdminNotificationsNewerListener();
    }
  });
}
