import React, {useMemo, useState} from 'react';
import {StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import AttendanceLocationPermissionCard from '@app/components/attendance/AttendanceLocationPermissionCard';
import AttendanceReportPanel from '@app/components/attendance/AttendanceReportPanel';
import DirectionalView from '@app/components/common/DirectionalView';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import {useProcessAttendanceResets} from '@app/hooks/useProcessAttendanceResets';
import {useTheme} from '@app/context/ThemeContext';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import {useAttendanceLocationAction} from '@app/hooks/useAttendanceLocationAction';
import {useAttendanceLocationPermission} from '@app/hooks/useAttendanceLocationPermission';
import {subscribeToUser} from '@app/services/users.service';
import {useAuthStore} from '@app/stores/authStore';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import {getCurrentPeriodStartIso} from '@app/utils/attendanceSchedule';
import {requiresAttendanceGpsLinked, requiresAttendanceLocationCheck} from '@app/utils/employeePermissions';
import dayjs from 'dayjs';

const MyAttendanceScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const user = useAuthStore((s) => s.user);
  const {data: profile, isLoading: profileLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(user?.id ?? '', callback),
    [user?.id],
    {enabled: Boolean(user?.id && user.role === 'employee')},
  );
  const {data: records, isLoading: recordsLoading} = useFirestoreSubscription<AttendanceRecord[]>(
    [],
    (callback) => subscribeToUserAttendance(user?.id ?? '', callback),
    [user?.id],
    {enabled: Boolean(user?.id && user.role === 'employee')},
  );

  const employeeProfile = profile ?? user;
  const requireLocationCheck = requiresAttendanceLocationCheck(employeeProfile);
  const requireGpsLinked = requiresAttendanceGpsLinked(employeeProfile);
  const needsLocationForAttendance = requireLocationCheck || requireGpsLinked;
  const locationPermission = useAttendanceLocationPermission(
    Boolean(user?.role === 'employee' && needsLocationForAttendance),
  );
  const [permissionLoading, setPermissionLoading] = useState(false);

  const handleRequestLocationPermission = () => {
    setPermissionLoading(true);
    void locationPermission.requestPermission().finally(() => setPermissionLoading(false));
  };
  const {handleAttendanceAction, actionLoading} = useAttendanceLocationAction({
    userId: user?.id,
    requireLocationCheck,
    requireGpsLinked,
  });

  useProcessAttendanceResets(
    employeeProfile,
    records,
    Boolean(user?.role === 'employee' && !profileLoading && !recordsLoading),
  );

  const periodStartIso = useMemo(
    () =>
      getCurrentPeriodStartIso(
        employeeProfile?.attendanceResetSchedule,
        employeeProfile?.attendanceLastResetBoundary,
        dayjs(),
      ),
    [employeeProfile?.attendanceLastResetBoundary, employeeProfile?.attendanceResetSchedule],
  );

  const styles = useMemo(
    () => StyleSheet.create({container: {flex: 1, backgroundColor: theme.backgrounds.background}}),
    [theme.backgrounds.background],
  );

  return (
    <DirectionalView style={styles.container}>
      <ScreenHeader title={t('myAttendance')} />
      <ScreenContainer>
        {needsLocationForAttendance ? (
          <AttendanceLocationPermissionCard
            state={locationPermission.state}
            onRequestPermission={handleRequestLocationPermission}
            loading={permissionLoading}
          />
        ) : null}
        <AttendanceReportPanel
          records={records}
          periodStartIso={periodStartIso}
          resetAnchorUser={employeeProfile}
          loading={profileLoading || recordsLoading}
          showActions
          onAction={handleAttendanceAction}
          actionLoading={actionLoading}
          requireLocationCheck={requireLocationCheck}
          requireGpsLinked={requireGpsLinked}
        />
      </ScreenContainer>
    </DirectionalView>
  );
};

export default MyAttendanceScreen;
