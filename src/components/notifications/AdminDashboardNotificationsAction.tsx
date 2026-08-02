import React from 'react';
import AdminNotificationBellButton from '@app/components/notifications/AdminNotificationBellButton';
import AdminNotificationsSheet from '@app/components/notifications/AdminNotificationsSheet';
import {useAdminNotificationsUiStore} from '@app/stores/adminNotificationsUiStore';

const AdminDashboardNotificationsAction: React.FC = () => {
  const sheetVisible = useAdminNotificationsUiStore((state) => state.sheetVisible);
  const openSheet = useAdminNotificationsUiStore((state) => state.openSheet);
  const closeSheet = useAdminNotificationsUiStore((state) => state.closeSheet);

  return (
    <>
      <AdminNotificationBellButton onPress={openSheet} />
      <AdminNotificationsSheet visible={sheetVisible} onClose={closeSheet} />
    </>
  );
};

export default AdminDashboardNotificationsAction;
