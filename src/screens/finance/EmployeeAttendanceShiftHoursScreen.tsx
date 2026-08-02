import React, {useEffect, useMemo} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AttendanceShiftHoursPanel from '@app/components/attendance/AttendanceShiftHoursPanel';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeAttendanceShiftHours'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeAttendanceShiftHours'>;

const EmployeeAttendanceShiftHoursScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const {data: employee, isLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(route.params.userId, callback),
    [route.params.userId],
    {enabled: isAdmin},
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.lg,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigation.goBack();
    }
  }, [isAdmin, navigation]);

  if (!isAdmin) {
    return null;
  }

  return (
    <ScreenContainer>
      <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
        {t('attendanceShiftHoursDetailHint', {name: route.params.userName})}
      </Text>

      {isLoading ? (
        <Text style={[textStyle, {color: theme.typography.secondary}]}>{t('loading')}</Text>
      ) : (
        <AttendanceShiftHoursPanel userId={route.params.userId} shiftHours={employee?.attendanceShiftHours} />
      )}
    </ScreenContainer>
  );
};

export default EmployeeAttendanceShiftHoursScreen;
