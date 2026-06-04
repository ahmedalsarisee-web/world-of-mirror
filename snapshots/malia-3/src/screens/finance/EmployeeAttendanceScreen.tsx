import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AttendanceReportPanel from '@app/components/attendance/AttendanceReportPanel';
import AttendanceResetScheduleCard from '@app/components/attendance/AttendanceResetScheduleCard';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useProcessAttendanceResets} from '@app/hooks/useProcessAttendanceResets';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import {getCurrentPeriodStartIso} from '@app/utils/attendanceSchedule';
import dayjs from 'dayjs';

type Route = RouteProp<EmployeeManagementStackParamList, 'EmployeeAttendance'>;
type Nav = NativeStackNavigationProp<EmployeeManagementStackParamList, 'EmployeeAttendance'>;

const EmployeeAttendanceScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const {data: employee, isLoading: employeeLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(route.params.userId, callback),
    [route.params.userId],
    {enabled: isAdmin},
  );
  const {data: records, isLoading: recordsLoading} = useFirestoreSubscription<AttendanceRecord[]>(
    [],
    (callback) => subscribeToUserAttendance(route.params.userId, callback),
    [route.params.userId],
    {enabled: isAdmin},
  );

  useProcessAttendanceResets(employee, records, isAdmin && !employeeLoading && !recordsLoading);

  const periodStartIso = useMemo(
    () => getCurrentPeriodStartIso(employee?.attendanceResetSchedule, employee?.attendanceLastResetBoundary, dayjs()),
    [employee?.attendanceLastResetBoundary, employee?.attendanceResetSchedule],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.md,
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
        {t('employeeAttendanceHint')}
      </Text>

      <AttendanceResetScheduleCard
        schedule={employee?.attendanceResetSchedule}
        onPress={() =>
          navigation.navigate('EmployeeAttendanceReset', {
            userId: route.params.userId,
            userName: route.params.userName,
          })
        }
      />

      <AttendanceReportPanel
        records={records}
        periodStartIso={periodStartIso}
        resetAnchorUser={employee}
        loading={employeeLoading || recordsLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    </ScreenContainer>
  );
};

export default EmployeeAttendanceScreen;
