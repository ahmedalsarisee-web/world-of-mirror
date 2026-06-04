import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import EmployeeLocationMapPanel from '@app/components/employee-management/EmployeeLocationMapPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
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
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [employee, setEmployee] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    return subscribeToUser(route.params.userId, setEmployee);
  }, [route.params.userId]);

  if (!isAdmin) {
    return null;
  }

  if (!employee) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <EmployeeLocationMapPanel employeeName={route.params.userName} location={employee.lastLocation} />
    </ScreenContainer>
  );
};

export default EmployeeLocationScreen;
