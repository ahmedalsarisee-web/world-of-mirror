import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MaterialCommunityIcons} from '@expo/vector-icons';
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
import {
  canViewEmployeeAttendance,
  requiresAttendanceGpsLinked,
  requiresAttendanceLocationCheck,
} from '@app/utils/employeePermissions';
import type {AttendanceStackParamList} from '@app/types/navigation';
import {useDirection} from '@app/hooks/useDirection';
import {getListCardStyle} from '@shared/theme/themeHelpers';
import dayjs from 'dayjs';

type Nav = NativeStackNavigationProp<AttendanceStackParamList, 'MyAttendance'>;

const MyAttendanceScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle, inlineTextStyle, row, chevronForward, layoutStyle} = useDirection();
  const navigation = useNavigation<Nav>();
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
  const showTeamAttendance = canViewEmployeeAttendance(employeeProfile);
  const listCard = useMemo(() => getListCardStyle(theme), [theme]);
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
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: theme.backgrounds.background},
        teamCard: {
          flexDirection: row,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        teamIconWrap: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary + '18',
        },
        teamTextWrap: {flex: 1, minWidth: 0},
        teamTitle: {
          fontSize: theme.typographyScale.size.sm,
          fontWeight: '600',
          marginBottom: 2,
        },
        teamSubtitle: {
          fontSize: theme.typographyScale.size.xs,
          lineHeight: 18,
        },
      }),
    [row, theme],
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
        {showTeamAttendance ? (
          <Pressable
            style={({pressed}) => [listCard, styles.teamCard, layoutStyle, {opacity: pressed ? 0.75 : 1}]}
            onPress={() => navigation.navigate('TeamAttendanceList')}
          >
            <View style={styles.teamIconWrap}>
              <MaterialCommunityIcons name="account-group" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.teamTextWrap}>
              <Text style={[styles.teamTitle, inlineTextStyle, {color: theme.typography.primary}]}>
                {t('teamAttendanceList')}
              </Text>
              <Text style={[styles.teamSubtitle, inlineTextStyle, {color: theme.typography.secondary}]}>
                {t('teamAttendanceListHint')}
              </Text>
            </View>
            <MaterialCommunityIcons name={chevronForward as any} size={22} color={theme.colors.icon} />
          </Pressable>
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
