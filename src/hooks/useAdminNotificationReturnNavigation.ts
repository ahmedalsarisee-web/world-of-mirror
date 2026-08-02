import {useEffect} from 'react';
import {navigationRef} from '@app/RootNavigation';
import {useAdminNotificationsUiStore} from '@app/stores/adminNotificationsUiStore';

export function useAdminNotificationReturnNavigation(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribe = navigationRef.addListener('state', () => {
      if (!navigationRef.isReady()) {
        return;
      }

      const {reopenSheetOnBack, notificationDestinationRouteKey, completeReturnToNotificationsSheet} =
        useAdminNotificationsUiStore.getState();

      if (!reopenSheetOnBack || !notificationDestinationRouteKey) {
        return;
      }

      const currentRouteKey = navigationRef.getCurrentRoute()?.key;
      if (currentRouteKey && currentRouteKey !== notificationDestinationRouteKey) {
        completeReturnToNotificationsSheet();
      }
    });

    return unsubscribe;
  }, [enabled]);
}
