import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AttendanceReportPanel from '@app/components/attendance/AttendanceReportPanel';
import AttendanceResetScheduleCard from '@app/components/attendance/AttendanceResetScheduleCard';
import DirectionalView from '@app/components/common/DirectionalView';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useDirection} from '@app/hooks/useDirection';
import {useProcessAttendanceResets} from '@app/hooks/useProcessAttendanceResets';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import type {AttendanceStackParamList} from '@app/types/navigation';
import {canViewEmployeeAttendance} from '@app/utils/employeePermissions';
import {getCurrentPeriodStartIso} from '@app/utils/attendanceSchedule';
import dayjs from 'dayjs';

type Route = RouteProp<AttendanceStackParamList, 'EmployeeAttendanceView'>;
type Nav = NativeStackNavigationProp<AttendanceStackParamList, 'EmployeeAttendanceView'>;

const EmployeeAttendanceViewScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const hasTeamAttendanceAccess = isAdmin || canViewEmployeeAttendance(currentUser);
  const [searchQuery, setSearchQuery] = useState('');

  const {data: employee, isLoading: employeeLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(route.params.userId, callback),
    [route.params.userId],
    {enabled: hasTeamAttendanceAccess},
  );
  const {data: records, isLoading: recordsLoading} = useFirestoreSubscription<AttendanceRecord[]>(
    [],
    (callback) => subscribeToUserAttendance(route.params.userId, callback),
    [route.params.userId],
    {enabled: hasTeamAttendanceAccess},
  );

  const canViewTarget = hasTeamAttendanceAccess && (employee === null || employee.role === 'employee');

  useProcessAttendanceResets(employee, records, canViewTarget && !employeeLoading && !recordsLoading);

  const periodStartIso = useMemo(
    () =>
      getCurrentPeriodStartIso(
        employee?.attendanceResetSchedule,
        employee?.attendanceLastResetBoundary,
        dayjs(),
      ),
    [employee?.attendanceLastResetBoundary, employee?.attendanceResetSchedule],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.backgrounds.background},
        subtitle: {
          fontSize: theme.typographyScale.size.sm,
          lineHeight: 20,
          marginBottom: theme.spacing.md,
        },
      }),
    [theme],
  );

  useEffect(() => {
    if (!currentUser || !hasTeamAttendanceAccess) {
      navigation.goBack();
      return;
    }
    if (!employeeLoading && employee && employee.role !== 'employee') {
      navigation.goBack();
    }
  }, [currentUser, employee, employeeLoading, hasTeamAttendanceAccess, navigation]);

  if (!canViewTarget) {
    return null;
  }

  return (
    <DirectionalView style={styles.container}>
      <ScreenHeader title={route.params.userName} />
      <ScreenContainer>
        <Text style={[styles.subtitle, textStyle, {color: theme.typography.secondary}]}>
          {t('employeeAttendanceViewHint')}
        </Text>

        <AttendanceResetScheduleCard schedule={employee?.attendanceResetSchedule} />

        <AttendanceReportPanel
          records={records}
          periodStartIso={periodStartIso}
          resetAnchorUser={employee}
          loading={employeeLoading || recordsLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </ScreenContainer>
    </DirectionalView>
  );
};

export default EmployeeAttendanceViewScreen;
