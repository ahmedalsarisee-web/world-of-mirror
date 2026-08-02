import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useLanguage} from '@app/context/LangContext';
import {useTheme} from '@app/context/ThemeContext';
import {getStackScreenOptions} from '@app/navigation/stackScreenOptions';
import AdminDetailScreen from '@app/screens/finance/AdminDetailScreen';
import EmployeeDetailScreen from '@app/screens/finance/EmployeeDetailScreen';
import EmployeeManagementScreen from '@app/screens/finance/EmployeeManagementScreen';
import EmployeeLocationScreen from '@app/screens/finance/EmployeeLocationScreen';
import EmployeeAttendanceScreen from '@app/screens/finance/EmployeeAttendanceScreen';
import EmployeeAttendanceResetScreen from '@app/screens/finance/EmployeeAttendanceResetScreen';
import EmployeeAttendanceShiftHoursScreen from '@app/screens/finance/EmployeeAttendanceShiftHoursScreen';
import EmployeePermissionsScreen from '@app/screens/finance/EmployeePermissionsScreen';
import UserFormScreen from '@app/screens/finance/UserFormScreen';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';

const Stack = createNativeStackNavigator<EmployeeManagementStackParamList>();

const EmployeeManagementNavigator: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {language} = useLanguage();
  return (
    <Stack.Navigator screenOptions={getStackScreenOptions(theme, language)}>
      <Stack.Screen
        name="EmployeeManagementHome"
        component={EmployeeManagementScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeePermissions"
        component={EmployeePermissionsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeLocation"
        component={EmployeeLocationScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeAttendance"
        component={EmployeeAttendanceScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeAttendanceReset"
        component={EmployeeAttendanceResetScreen}
        options={({route}) => ({title: route.params.userName})}
      />
      <Stack.Screen
        name="EmployeeAttendanceShiftHours"
        component={EmployeeAttendanceShiftHoursScreen}
        options={({route}) => ({title: route.params.userName})}
      />
      <Stack.Screen
        name="AdminDetail"
        component={AdminDetailScreen}
        options={({route}) => ({title: route.params.userName})}
      />
      <Stack.Screen name="UserForm" component={UserFormScreen} options={{title: t('addUser')}} />
    </Stack.Navigator>
  );
};

export default EmployeeManagementNavigator;
