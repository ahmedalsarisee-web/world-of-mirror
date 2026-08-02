import {useEffect, useRef} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isNotificationEventVisible,
  subscribeToSharedNotificationLogSettings,
} from '@app/services/adminNotificationEvents.service';
import {useAdminNotificationStore} from '@app/stores/adminNotificationStore';
import {clearAdminNotificationListCache} from '@app/utils/adminNotificationListCache';
import {stopAdminNotificationsNewerListener} from '@app/utils/adminNotificationRealtime';

/**
 * Watches shared clear settings only — paginated history loads when the notifications sheet opens.
 */
export function useAdminNotificationEventsSync(enabled: boolean): void {
  const replaceAllNotifications = useAdminNotificationStore((state) => state.replaceAllNotifications);
  const resetLocalLog = useAdminNotificationStore((state) => state.resetLocalLog);
  const previousClearedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void AsyncStorage.removeItem('admin-notifications').catch(() => undefined);

    const unsubscribe = subscribeToSharedNotificationLogSettings((clearedAtMs) => {
      const previousClearedAt = previousClearedAtRef.current;
      previousClearedAtRef.current = clearedAtMs;

      if (previousClearedAt !== null && clearedAtMs > previousClearedAt) {
        stopAdminNotificationsNewerListener();
        clearAdminNotificationListCache();
        replaceAllNotifications([]);
        resetLocalLog();
        return;
      }

      const visibleItems = useAdminNotificationStore
        .getState()
        .items.filter((item) => isNotificationEventVisible(item.eventAt, item.receivedAt));
      if (visibleItems.length !== useAdminNotificationStore.getState().items.length) {
        useAdminNotificationStore.setState({items: visibleItems});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, replaceAllNotifications, resetLocalLog]);
}
