import {useEffect} from 'react';
import {isMockMode} from '@app/config/appMode';
import {ensureNotificationPermissions, getNotificationsModule} from '@app/services/notifications.service';
import {showAdminInAppNotification, type AdminNotificationKind} from '@app/stores/adminNotificationStore';

function parseKind(value: unknown): AdminNotificationKind {
  if (value === 'finance' || value === 'attendance' || value === 'confirmed_order') {
    return value;
  }
  return 'finance';
}

export function useAdminPushNotificationListener(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || isMockMode) {
      return;
    }

    let receivedSubscription: {remove: () => void} | undefined;

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
        const id = String(
          data.transactionId ??
            data.recordId ??
            data.orderId ??
            notification.request.identifier,
        );

        if (!content.title && !content.body) {
          return;
        }

        showAdminInAppNotification({
          id,
          title: content.title ?? '',
          body: content.body ?? '',
          kind,
        });
      });
    })();

    return () => {
      receivedSubscription?.remove();
    };
  }, [enabled]);
}
