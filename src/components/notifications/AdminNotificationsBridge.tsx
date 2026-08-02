import React, {useEffect} from 'react';
import StandaloneOrderModal from '@app/components/pricing/StandaloneOrderModal';
import {useAdminEventNotifications} from '@app/hooks/useAdminEventNotifications';
import {useAdminNotificationEventsSync} from '@app/hooks/useAdminNotificationEventsSync';
import {useAdminPushNotificationListener} from '@app/hooks/useAdminPushNotificationListener';
import {useAdminNotificationReturnNavigation} from '@app/hooks/useAdminNotificationReturnNavigation';
import {useAdminPushRegistration} from '@app/hooks/useAdminPushRegistration';
import {useAdminLiveMonitoringEnabled} from '@app/hooks/useAdminLiveMonitoringEnabled';
import {useConfirmedOrdersSync} from '@app/hooks/useConfirmedOrdersSync';
import {useMirrorCatalogSync} from '@app/hooks/useMirrorCatalogSync';
import {mapAdminNotificationEventToStoreItem} from '@app/services/adminNotificationEvents.service';
import {useAuthStore} from '@app/stores/authStore';
import {useAdminNotificationStore} from '@app/stores/adminNotificationStore';
import {
  getAdminNotificationListCacheEvents,
  restoreAdminNotificationListCache,
} from '@app/utils/adminNotificationListCache';
import {
  hydrateAdminNotificationReadState,
  resolveAdminNotificationReadState,
} from '@app/utils/adminNotificationReadState';
import {canViewNotificationsLog} from '@app/utils/employeePermissions';

function applyPersistedReadStateToStore(): void {
  const {items} = useAdminNotificationStore.getState();
  if (items.length === 0) {
    return;
  }

  let changed = false;
  const nextItems = items.map((item) => {
    const read = resolveAdminNotificationReadState(item.id, item.read);
    if (read === item.read) {
      return item;
    }
    changed = true;
    return {...item, read};
  });

  if (changed) {
    useAdminNotificationStore.setState({items: nextItems});
  }
}

/** Wires notification sync, push, and listeners — no in-app banner overlay. */
const AdminNotificationsBridge: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const canViewNotifications = canViewNotificationsLog(user);
  const liveMonitoringEnabled = useAdminLiveMonitoringEnabled();

  useAdminPushRegistration(user?.id, canViewNotifications);
  useAdminPushNotificationListener(canViewNotifications);
  useAdminEventNotifications(canViewNotifications && liveMonitoringEnabled);
  useAdminNotificationEventsSync(canViewNotifications);
  useConfirmedOrdersSync(Boolean(user?.id));
  // Keep warehouse catalog hydrated so order cards can resolve catalog image IDs.
  useMirrorCatalogSync(Boolean(user?.id));
  useAdminNotificationReturnNavigation(canViewNotifications);

  useEffect(() => {
    if (!canViewNotifications) {
      return;
    }

    let cancelled = false;

    void (async () => {
      await hydrateAdminNotificationReadState();
      if (cancelled) {
        return;
      }

      applyPersistedReadStateToStore();

      const restored = await restoreAdminNotificationListCache();
      if (cancelled) {
        return;
      }

      if (restored) {
        const events = getAdminNotificationListCacheEvents();
        if (events.length > 0) {
          useAdminNotificationStore
            .getState()
            .mergeNotifications(events.map(mapAdminNotificationEventToStoreItem));
        }
      }

      // Paginated Firestore reads start when the notifications sheet opens.
    })();

    return () => {
      cancelled = true;
    };
  }, [canViewNotifications]);

  return <StandaloneOrderModal />;
};

export default AdminNotificationsBridge;
