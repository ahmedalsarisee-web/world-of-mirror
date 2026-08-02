import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import EmployeeLocationMapPanel from '@app/components/employee-management/EmployeeLocationMapPanel';
import EmployeeManagementScreenLayout from '@app/components/employee-management/EmployeeManagementScreenLayout';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeLocation'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeLocation'>;

const EmployeeLocationScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const {userId, userName} = route.params;

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [employee, setEmployee] = useState<AppUser | null>(null);
  const screenTitle = employee?.name ?? userName;

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    return subscribeToUser(userId, setEmployee);
  }, [userId]);

  if (!isAdmin) {
    return null;
  }

  if (!employee) {
    return (
      <EmployeeManagementScreenLayout title={screenTitle} scroll={false}>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </EmployeeManagementScreenLayout>
    );
  }

  return (
    <EmployeeManagementScreenLayout title={screenTitle} scroll={false}>
      <EmployeeLocationMapPanel employeeName={screenTitle} location={employee.lastLocation} />
    </EmployeeManagementScreenLayout>
  );
};

export default EmployeeLocationScreen;
