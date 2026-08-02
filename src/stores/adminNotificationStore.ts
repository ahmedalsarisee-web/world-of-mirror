import {create} from 'zustand';

import type {AdminNotificationMetadata} from '@app/types/adminNotificationMetadata';
import {ADMIN_NOTIFICATION_HISTORY_LIMIT} from '@app/services/adminNotificationEvents.service';
import {upsertAdminNotificationListCacheFromRecord} from '@app/utils/adminNotificationListCache';
import {
  clearAdminNotificationReadState,
  isAdminNotificationRead,
  markAdminNotificationRead,
  markAdminNotificationsRead,
  resolveAdminNotificationReadState,
} from '@app/utils/adminNotificationReadState';

/** Primary sort key: when the operation happened; fallback: when it was recorded. */
export function notificationSortTime(item: {eventAt?: number; receivedAt: number}): number {
  const eventAt = item.eventAt ?? 0;
  return Math.max(eventAt, item.receivedAt);
}

export type AdminNotificationKind =
  | 'finance'
  | 'attendance'
  | 'confirmed_order'
  | 'order_moved'
  | 'order_updated'
  | 'order_deleted'
  | 'mirror_warehouse';

export interface AdminInAppNotification {
  id: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
  receivedAt: number;
  /** When the underlying event happened (e.g. transaction createdAt). */
  eventAt?: number;
  metadata?: AdminNotificationMetadata;
}

export interface AdminNotificationRecord extends AdminInAppNotification {
  read: boolean;
}

const MAX_NOTIFICATION_HISTORY = ADMIN_NOTIFICATION_HISTORY_LIMIT;

type ServerNotificationEvent = {
  id: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
  eventAt?: number;
  metadata?: AdminNotificationMetadata;
  recordedAt: number;
};

function mergeServerEventsIntoItems(
  currentItems: AdminNotificationRecord[],
  events: ServerNotificationEvent[],
): AdminNotificationRecord[] {
  const readById = new Map(currentItems.map((item) => [item.id, item.read]));
  const byId = new Map(currentItems.map((item) => [item.id, item]));

  for (const event of events) {
    const existingRead = readById.get(event.id) ?? byId.get(event.id)?.read ?? false;
    byId.set(
      event.id,
      buildRecordFromServer(event, resolveAdminNotificationReadState(event.id, existingRead)),
    );
  }

  return [...byId.values()]
    .sort((a, b) => notificationSortTime(b) - notificationSortTime(a))
    .slice(0, MAX_NOTIFICATION_HISTORY);
}

interface AdminNotificationState {
  notification: AdminInAppNotification | null;
  items: AdminNotificationRecord[];
  recordNotification: (notification: Omit<AdminInAppNotification, 'receivedAt'>) => void;
  /** Replace the visible log (e.g. after shared clear). */
  replaceAllNotifications: (events: ServerNotificationEvent[]) => void;
  /** Merge the first page or a refreshed page into the log. */
  mergeNotifications: (events: ServerNotificationEvent[]) => void;
  /** Prepend notifications newer than the cached head. */
  prependNotifications: (events: ServerNotificationEvent[]) => void;
  /** Append older notifications from pagination. */
  appendNotifications: (events: ServerNotificationEvent[]) => void;
  /** @deprecated Use replaceAllNotifications */
  syncServerEvents: (events: ServerNotificationEvent[]) => void;
  dismiss: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  resetLocalLog: () => void;
}

function buildRecordFromServer(
  event: ServerNotificationEvent,
  read: boolean,
): AdminNotificationRecord {
  return {
    id: event.id,
    title: event.title,
    body: event.body,
    kind: event.kind,
    receivedAt: event.recordedAt,
    eventAt: event.eventAt,
    metadata: event.metadata,
    read,
  };
}

export const useAdminNotificationStore = create<AdminNotificationState>()((set) => ({
  notification: null,
  items: [],

  recordNotification: (notification) =>
    set((state) => {
      const receivedAt = Date.now();
      const alreadyRead = isAdminNotificationRead(notification.id);
      const entry: AdminNotificationRecord = {
        ...notification,
        receivedAt: notification.eventAt ?? receivedAt,
        read: alreadyRead,
      };

      const withoutDuplicate = state.items.filter((item) => item.id !== notification.id);
      const items = [entry, ...withoutDuplicate]
        .sort((a, b) => notificationSortTime(b) - notificationSortTime(a))
        .slice(0, MAX_NOTIFICATION_HISTORY);
      upsertAdminNotificationListCacheFromRecord(entry);
      return {
        notification: null,
        items,
      };
    }),

  replaceAllNotifications: (events) =>
    set((state) => ({
      ...state,
      notification: null,
      items: events
        .map((event) =>
          buildRecordFromServer(event, resolveAdminNotificationReadState(event.id, false)),
        )
        .sort((a, b) => notificationSortTime(b) - notificationSortTime(a))
        .slice(0, MAX_NOTIFICATION_HISTORY),
    })),

  mergeNotifications: (events) =>
    set((state) => ({
      ...state,
      notification: null,
      items: mergeServerEventsIntoItems(state.items, events),
    })),

  prependNotifications: (events) =>
    set((state) => ({
      ...state,
      notification: null,
      items: mergeServerEventsIntoItems(state.items, events),
    })),

  appendNotifications: (events) =>
    set((state) => ({
      ...state,
      notification: null,
      items: mergeServerEventsIntoItems(state.items, events),
    })),

  syncServerEvents: (events) =>
    set((state) => ({
      ...state,
      notification: null,
      items: mergeServerEventsIntoItems([], events),
    })),

  dismiss: () => set({notification: null}),

  markRead: (id) =>
    set((state) => {
      markAdminNotificationRead(id);
      const current = state.items.find((item) => item.id === id);
      if (!current || current.read) {
        return state;
      }
      return {
        items: state.items.map((item) => (item.id === id ? {...item, read: true} : item)),
      };
    }),

  markAllRead: () =>
    set((state) => {
      markAdminNotificationsRead(state.items.map((item) => item.id));
      if (state.items.every((item) => item.read)) {
        return state;
      }
      return {
        items: state.items.map((item) => (item.read ? item : {...item, read: true})),
      };
    }),

  resetLocalLog: () => {
    clearAdminNotificationReadState();
    set({
      items: [],
      notification: null,
    });
  },
}));

export function recordAdminNotification(
  notification: Omit<AdminInAppNotification, 'receivedAt'>,
): void {
  useAdminNotificationStore.getState().recordNotification(notification);
}

/** @deprecated Use recordAdminNotification — in-app banners are disabled. */
export function showAdminInAppNotification(
  notification: Omit<AdminInAppNotification, 'receivedAt'>,
): void {
  recordAdminNotification(notification);
}

export function selectAdminUnreadNotificationCount(state: AdminNotificationState): number {
  return state.items.filter((item) => !item.read).length;
}
