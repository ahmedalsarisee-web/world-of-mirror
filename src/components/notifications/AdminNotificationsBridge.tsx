import React from 'react';
import {useAdminEventNotifications} from '@app/hooks/useAdminEventNotifications';
import {useAdminPushNotificationListener} from '@app/hooks/useAdminPushNotificationListener';
import {useAdminPushRegistration} from '@app/hooks/useAdminPushRegistration';
import {useConfirmedOrdersSync} from '@app/hooks/useConfirmedOrdersSync';
import {useAuthStore} from '@app/stores/authStore';
import AdminInAppNotificationBanner from '@app/components/notifications/AdminInAppNotificationBanner';

const AdminNotificationsBridge: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const isSignedIn = Boolean(user);

  useAdminPushRegistration(user?.id, isAdmin);
  useAdminPushNotificationListener(isAdmin);
  useAdminEventNotifications(isAdmin);
  useConfirmedOrdersSync(isSignedIn);

  if (!isAdmin) {
    return null;
  }

  return <AdminInAppNotificationBanner />;
};

export default AdminNotificationsBridge;
