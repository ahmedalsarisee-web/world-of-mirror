import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DocumentSnapshot} from 'firebase/firestore';
import type {AdminNotificationEvent} from '@app/types/adminNotificationEvent';
import type {AdminInAppNotification} from '@app/stores/adminNotificationStore';
import {
  sortAdminNotificationEventsForDisplay,
  ADMIN_NOTIFICATION_PAGE_SIZE,
} from '@app/services/adminNotificationEvents.service';

const STORAGE_KEY = 'admin-notification-list-cache-v1';

interface AdminNotificationListCacheState {
  events: AdminNotificationEvent[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
  hydrated: boolean;
}

interface PersistedNotificationListCache {
  version: 1;
  events: AdminNotificationEvent[];
  hasMore: boolean;
}

const state: AdminNotificationListCacheState = {
  events: [],
  lastDoc: null,
  hasMore: true,
  hydrated: false,
};

const cacheListeners = new Set<() => void>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function notifyAdminNotificationListCacheListeners(): void {
  cacheListeners.forEach((listener) => listener());
}

export function subscribeAdminNotificationListCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

function schedulePersistAdminNotificationListCache(): void {
  if (!state.hydrated) {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistAdminNotificationListCache();
  }, 300);
}

async function persistAdminNotificationListCache(): Promise<void> {
  if (!state.hydrated) {
    return;
  }

  const payload: PersistedNotificationListCache = {
    version: 1,
    events: state.events.slice(0, ADMIN_NOTIFICATION_PAGE_SIZE),
    hasMore: state.hasMore || state.events.length > ADMIN_NOTIFICATION_PAGE_SIZE,
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[adminNotificationListCache] persist failed', error);
  }
}

export async function restoreAdminNotificationListCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) {
      return false;
    }

    const parsed = JSON.parse(raw) as PersistedNotificationListCache;
    if (!Array.isArray(parsed.events) || parsed.events.length === 0) {
      return false;
    }

    state.hydrated = true;
    const restoredEvents = sortAdminNotificationEventsForDisplay(parsed.events);
    const hadMoreInStorage =
      restoredEvents.length > ADMIN_NOTIFICATION_PAGE_SIZE || (parsed.hasMore ?? false);
    state.events =
      restoredEvents.length > ADMIN_NOTIFICATION_PAGE_SIZE
        ? restoredEvents.slice(0, ADMIN_NOTIFICATION_PAGE_SIZE)
        : restoredEvents;
    state.lastDoc = null;
    state.hasMore = hadMoreInStorage;
    return true;
  } catch (error) {
    console.warn('[adminNotificationListCache] restore failed', error);
    return false;
  }
}

export function isAdminNotificationListCacheHydrated(): boolean {
  return state.hydrated;
}

export function getAdminNotificationListCacheEvents(): AdminNotificationEvent[] {
  return state.events;
}

export function getAdminNotificationListCacheLastDoc(): DocumentSnapshot | null {
  return state.lastDoc;
}

function resolveExtremeRecordedAt(pickNewest: boolean): string | null {
  if (state.events.length === 0) {
    return null;
  }

  let extreme = state.events[0].recordedAt;
  for (let index = 1; index < state.events.length; index += 1) {
    const recordedAt = state.events[index].recordedAt;
    const cmp = recordedAt.localeCompare(extreme);
    if (pickNewest ? cmp > 0 : cmp < 0) {
      extreme = recordedAt;
    }
  }

  return extreme;
}

export function getAdminNotificationListCacheLastRecordedAt(): string | null {
  return resolveExtremeRecordedAt(false);
}

export function getAdminNotificationListCachePaginationCursor(): {
  startAfterDoc?: DocumentSnapshot | null;
  startAfterRecordedAt?: string;
} {
  if (state.lastDoc) {
    return {startAfterDoc: state.lastDoc};
  }

  const lastRecordedAt = getAdminNotificationListCacheLastRecordedAt();
  return lastRecordedAt ? {startAfterRecordedAt: lastRecordedAt} : {};
}

export function getAdminNotificationListCacheHasMore(): boolean {
  return state.hasMore;
}

export function getAdminNotificationListNewestRecordedAt(): string | null {
  return resolveExtremeRecordedAt(true);
}

export function setAdminNotificationListInitialPage(
  events: AdminNotificationEvent[],
  lastDoc: DocumentSnapshot | null,
  hasMore: boolean,
): AdminNotificationEvent[] {
  state.hydrated = true;
  state.events = sortAdminNotificationEventsForDisplay(events);
  state.lastDoc = lastDoc;
  state.hasMore = hasMore;
  schedulePersistAdminNotificationListCache();
  notifyAdminNotificationListCacheListeners();
  return state.events;
}

export function prependAdminNotificationListCache(
  events: AdminNotificationEvent[],
): AdminNotificationEvent[] {
  if (events.length === 0) {
    return state.events;
  }

  const mergedById = new Map(state.events.map((event) => [event.id, event]));
  for (const event of events) {
    mergedById.set(event.id, event);
  }

  state.events = sortAdminNotificationEventsForDisplay([...mergedById.values()]);
  schedulePersistAdminNotificationListCache();
  notifyAdminNotificationListCacheListeners();
  return state.events;
}

export function appendAdminNotificationListCache(
  events: AdminNotificationEvent[],
  lastDoc: DocumentSnapshot | null,
  hasMore: boolean,
): AdminNotificationEvent[] {
  if (events.length === 0 && !hasMore) {
    state.hasMore = false;
    schedulePersistAdminNotificationListCache();
    return state.events;
  }

  const existingIds = new Set(state.events.map((event) => event.id));
  const appended = events.filter((event) => !existingIds.has(event.id));
  if (appended.length > 0) {
    state.events = sortAdminNotificationEventsForDisplay([...state.events, ...appended]);
  }

  state.lastDoc = lastDoc;
  state.hasMore = hasMore;
  schedulePersistAdminNotificationListCache();
  notifyAdminNotificationListCacheListeners();
  return state.events;
}

export function upsertAdminNotificationListCacheFromRecord(
  notification: AdminInAppNotification,
): void {
  const recordedAtMs = notification.eventAt ?? Date.now();
  const event: AdminNotificationEvent = {
    id: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    sourceId: notification.id.includes(':') ? notification.id.split(':').slice(1).join(':') : notification.id,
    eventAt: new Date(notification.eventAt ?? recordedAtMs).toISOString(),
    recordedAt: new Date(recordedAtMs).toISOString(),
    metadata: notification.metadata,
  };

  if (!state.hydrated) {
    state.hydrated = true;
    state.events = [event];
    state.hasMore = true;
    schedulePersistAdminNotificationListCache();
    return;
  }

  prependAdminNotificationListCache([event]);
}

export function clearAdminNotificationListCache(): void {
  state.events = [];
  state.lastDoc = null;
  state.hasMore = true;
  state.hydrated = false;
  void AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export function filterAdminNotificationEventsNotInCache(
  events: AdminNotificationEvent[],
): AdminNotificationEvent[] {
  if (events.length === 0) {
    return [];
  }
  const cachedIds = new Set(state.events.map((event) => event.id));
  return events.filter((event) => !cachedIds.has(event.id));
}
