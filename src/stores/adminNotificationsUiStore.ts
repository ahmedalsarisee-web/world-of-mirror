import {create} from 'zustand';
import {enableAdminLiveMonitoring} from '@app/utils/adminLiveMonitoringGate';

interface AdminNotificationsUiState {
  sheetVisible: boolean;
  reopenSheetOnBack: boolean;
  notificationDestinationRouteKey: string | null;
  openSheet: () => void;
  closeSheet: () => void;
  markNavigationFromSheet: () => void;
  setNotificationDestinationRouteKey: (routeKey: string | null) => void;
  completeReturnToNotificationsSheet: () => void;
  cancelNotificationReturn: () => void;
}

export const useAdminNotificationsUiStore = create<AdminNotificationsUiState>()((set, get) => ({
  sheetVisible: false,
  reopenSheetOnBack: false,
  notificationDestinationRouteKey: null,

  openSheet: () => {
    enableAdminLiveMonitoring();
    set({sheetVisible: true});
  },

  closeSheet: () =>
    set({
      sheetVisible: false,
      reopenSheetOnBack: false,
      notificationDestinationRouteKey: null,
    }),

  markNavigationFromSheet: () =>
    set({
      sheetVisible: false,
      reopenSheetOnBack: true,
      notificationDestinationRouteKey: null,
    }),

  setNotificationDestinationRouteKey: (routeKey) =>
    set({notificationDestinationRouteKey: routeKey}),

  completeReturnToNotificationsSheet: () => {
    if (!get().reopenSheetOnBack) {
      return;
    }
    set({
      sheetVisible: true,
      reopenSheetOnBack: false,
      notificationDestinationRouteKey: null,
    });
  },

  cancelNotificationReturn: () =>
    set({
      reopenSheetOnBack: false,
      notificationDestinationRouteKey: null,
      sheetVisible: true,
    }),
}));
