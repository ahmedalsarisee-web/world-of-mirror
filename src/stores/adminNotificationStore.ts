import {create} from 'zustand';

export type AdminNotificationKind = 'finance' | 'attendance' | 'confirmed_order';

export interface AdminInAppNotification {
  id: string;
  title: string;
  body: string;
  kind: AdminNotificationKind;
}

interface AdminNotificationState {
  notification: AdminInAppNotification | null;
  show: (notification: AdminInAppNotification) => void;
  dismiss: () => void;
}

export const useAdminNotificationStore = create<AdminNotificationState>((set) => ({
  notification: null,
  show: (notification) => set({notification}),
  dismiss: () => set({notification: null}),
}));

export function showAdminInAppNotification(notification: AdminInAppNotification): void {
  useAdminNotificationStore.getState().show(notification);
}
