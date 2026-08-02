import {useEffect} from 'react';
import {isMockMode} from '@app/config/appMode';
import {ensureNotificationPermissions, getNotificationsModule} from '@app/services/notifications.service';
import {
  recordAdminNotification,
  useAdminNotificationStore,
  type AdminNotificationKind,
} from '@app/stores/adminNotificationStore';
import {
  buildAdminNotificationEventId,
  isNotificationEventVisible,
} from '@app/services/adminNotificationEvents.service';
import {
  buildFinanceMetadataFromPushData,
  parseNotificationEventAtFromPushData,
} from '@app/utils/adminNotificationPushData';
import {
  navigateFromAdminNotification,
  navigateFromAdminNotificationFallback,
} from '@app/utils/adminNotificationNavigation';

function parseKind(value: unknown): AdminNotificationKind {
  if (
    value === 'finance' ||
    value === 'attendance' ||
    value === 'confirmed_order' ||
    value === 'order_moved' ||
    value === 'order_updated' ||
    value === 'order_deleted' ||
    value === 'mirror_warehouse'
  ) {
    return value;
  }
  return 'finance';
}

function resolveNotificationFromPushData(
  data: Record<string, unknown>,
  kind: AdminNotificationKind,
  eventId: string,
  title: string,
  body: string,
  eventAt?: number,
) {
  const stored = useAdminNotificationStore.getState().items.find((entry) => entry.id === eventId);
  if (stored) {
    return stored;
  }

  return {
    id: eventId,
    title,
    body,
    kind,
    receivedAt: eventAt ?? Date.now(),
    read: true,
    metadata: kind === 'finance' ? buildFinanceMetadataFromPushData(data) : undefined,
    eventAt,
  };
}

function openNotificationDestination(
  data: Record<string, unknown>,
  kind: AdminNotificationKind,
  eventId: string,
  title: string,
  body: string,
  eventAt?: number,
): void {
  const item = resolveNotificationFromPushData(data, kind, eventId, title, body, eventAt);
  if (navigateFromAdminNotification(item)) {
    return;
  }
  navigateFromAdminNotificationFallback(kind, data);
}

export function useAdminPushNotificationListener(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isMockMode) {
      return;
    }

    let receivedSubscription: {remove: () => void} | undefined;
    let responseSubscription: {remove: () => void} | undefined;

    void (async () => {
      await ensureNotificationPermissions();
      const Notifications = await getNotificationsModule();
      if (!Notifications) {
        return;
      }

      receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
        const content = notification.request.content;
        const data = (content.data ?? {}) as Record<string, unknown>;
        const kind = parseKind(data.kind);
        const sourceId = String(
          data.deleteEventId ??
            data.moveEventId ??
            data.transactionId ??
            data.recordId ??
            data.orderId ??
            notification.request.identifier,
        );
        const eventId = String(data.eventId ?? buildAdminNotificationEventId(kind, sourceId));

        if (!content.title && !content.body) {
          return;
        }

        const eventAt = parseNotificationEventAtFromPushData(data);
        if (!isNotificationEventVisible(eventAt, eventAt ?? Date.now())) {
          return;
        }

        recordAdminNotification({
          id: eventId,
          title: content.title ?? '',
          body: content.body ?? '',
          kind,
          metadata: kind === 'finance' ? buildFinanceMetadataFromPushData(data) : undefined,
          eventAt,
        });
      });

      responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const content = response.notification.request.content;
        const data = (content.data ?? {}) as Record<string, unknown>;
        const kind = parseKind(data.kind);
        const sourceId = String(
          data.deleteEventId ??
            data.moveEventId ??
            data.transactionId ??
            data.recordId ??
            data.orderId ??
            response.notification.request.identifier,
        );
        const eventId = String(data.eventId ?? buildAdminNotificationEventId(kind, sourceId));
        const eventAt = parseNotificationEventAtFromPushData(data);

        openNotificationDestination(
          data,
          kind,
          eventId,
          content.title ?? '',
          content.body ?? '',
          eventAt,
        );
      });
    })();

    return () => {
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [enabled]);
}
