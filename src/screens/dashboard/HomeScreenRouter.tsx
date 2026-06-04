import React from 'react';
import AdminDashboardScreen from '@app/screens/dashboard/AdminDashboardScreen';
import EmployeeHomeScreen from '@app/screens/dashboard/EmployeeHomeScreen';
import {useAuthStore} from '@app/stores/authStore';

const HomeScreenRouter: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  if (user?.role === 'admin') {
    return <AdminDashboardScreen />;
  }

  return <EmployeeHomeScreen />;
};

export default HomeScreenRouter;
