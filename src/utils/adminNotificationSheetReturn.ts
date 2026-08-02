import {navigationRef} from '@app/RootNavigation';
import type {AdminNotificationKind} from '@app/stores/adminNotificationStore';
import {useAdminNotificationsUiStore} from '@app/stores/adminNotificationsUiStore';

export function isStandaloneOrderAdminNotificationKind(kind: AdminNotificationKind): boolean {
  return kind === 'confirmed_order' || kind === 'order_moved' || kind === 'order_updated';
}

export function captureAdminNotificationDestinationRoute(): void {
  if (!navigationRef.isReady()) {
    return;
  }

  const routeKey = navigationRef.getCurrentRoute()?.key ?? null;
  useAdminNotificationsUiStore.getState().setNotificationDestinationRouteKey(routeKey);
}

export function completeAdminNotificationReturnIfPending(): void {
  useAdminNotificationsUiStore.getState().completeReturnToNotificationsSheet();
}
