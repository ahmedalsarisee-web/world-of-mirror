import React, {useEffect, useMemo, useState} from 'react';
import {Alert, StyleSheet, Text} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import AttendanceReportPanel from '@app/components/attendance/AttendanceReportPanel';
import AttendanceResetScheduleCard from '@app/components/attendance/AttendanceResetScheduleCard';
import EditAttendanceDaySheet from '@app/components/attendance/EditAttendanceDaySheet';
import ScreenContainer from '@app/components/common/ScreenContainer';
import {useDirection} from '@app/hooks/useDirection';
import {useProcessAttendanceResets} from '@app/hooks/useProcessAttendanceResets';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {
  clearDayAttendanceRecords,
  replaceDayAttendanceRecords,
  subscribeToUserAttendance,
} from '@app/services/attendance.service';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import type {EmployeeManagementStackParamList} from '@app/types/navigation';
import type {AttendanceDaySummary} from '@app/utils/attendanceReport';
import {getCurrentPeriodStartIso} from '@app/utils/attendanceSchedule';
import type {AttendanceDayEditFormValues} from '@app/utils/validation';
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
  const [selectedDay, setSelectedDay] = useState<AttendanceDaySummary | null>(null);
  const [saving, setSaving] = useState(false);
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

  const handleSaveDay = async (values: AttendanceDayEditFormValues) => {
    if (!selectedDay) {
      return;
    }

    setSaving(true);
    try {
      await replaceDayAttendanceRecords(
        route.params.userId,
        values.date,
        {
          checkInTime: values.checkInTime,
          checkOutTime: values.checkOutTime.trim() || undefined,
          note: values.note ?? '',
        },
        records,
      );
      Alert.alert(t('attendanceRecordSaved'));
      setSelectedDay(null);
    } catch {
      Alert.alert(t('error'), t('attendanceRecordSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearDay = async () => {
    if (!selectedDay) {
      return;
    }

    setSaving(true);
    try {
      await clearDayAttendanceRecords(selectedDay.dateKey, records);
      Alert.alert(t('attendanceRecordDeleted'));
      setSelectedDay(null);
    } catch {
      Alert.alert(t('error'), t('attendanceRecordDeleteFailed'));
    } finally {
      setSaving(false);
    }
  };

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
        canManageRecords
        onPressDay={setSelectedDay}
      />

      <EditAttendanceDaySheet
        day={selectedDay}
        visible={selectedDay !== null}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setSelectedDay(null);
          }
        }}
        onSave={handleSaveDay}
        onClearDay={handleClearDay}
      />
    </ScreenContainer>
  );
};

export default EmployeeAttendanceScreen;
