import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {CompositeNavigationProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import DashboardHeroCard from '@app/components/dashboard/DashboardHeroCard';
import DashboardMetricGrid from '@app/components/dashboard/DashboardMetricGrid';
import DashboardSection from '@app/components/dashboard/DashboardSection';
import DashboardShortcutGrid from '@app/components/dashboard/DashboardShortcutGrid';
import ListLoadingState from '@app/components/common/ListLoadingState';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import AdminDashboardNotificationsAction from '@app/components/notifications/AdminDashboardNotificationsAction';
import AttendanceLocationPermissionCard from '@app/components/attendance/AttendanceLocationPermissionCard';
import EmployeeHomeAttendanceCard from '@app/components/employee-home/EmployeeHomeAttendanceCard';
import EmployeeHomeBalanceCard from '@app/components/employee-home/EmployeeHomeBalanceCard';
import {useAttendanceLocationAction} from '@app/hooks/useAttendanceLocationAction';
import {useAttendanceLocationPermission} from '@app/hooks/useAttendanceLocationPermission';
import {useEmployeeHomeData} from '@app/hooks/useEmployeeHomeData';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useAuthStore} from '@app/stores/authStore';
import type {DashboardStackParamList, MainTabParamList} from '@app/types/navigation';
import {formatAttendanceDuration} from '@app/utils/attendanceReport';
import {canViewNotificationsLog} from '@app/utils/employeePermissions';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

type HomeNav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'DashboardHome'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const EmployeeHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HomeNav>();
  const currentUser = useAuthStore((s) => s.user);
  const isEmployee = currentUser?.role === 'employee';
  const showNotificationsIcon = canViewNotificationsLog(currentUser);

  const {
    permissions,
    attendanceRecords,
    todayStatus,
    attendanceStats,
    balance,
    isLoading,
  } = useEmployeeHomeData(currentUser, t);

  const needsLocationForAttendance =
    permissions.attendanceLocationRequired || permissions.attendanceGpsLinked;
  const locationPermission = useAttendanceLocationPermission(Boolean(isEmployee && needsLocationForAttendance));
  const [permissionLoading, setPermissionLoading] = useState(false);

  const handleRequestLocationPermission = () => {
    setPermissionLoading(true);
    void locationPermission.requestPermission().finally(() => setPermissionLoading(false));
  };
  const {handleAttendanceAction, actionLoading} = useAttendanceLocationAction({
    userId: currentUser?.id,
    requireLocationCheck: permissions.attendanceLocationRequired,
    requireGpsLinked: permissions.attendanceGpsLinked,
  });

  const showFinanceShortcut = permissions.finance || permissions.employeeFinance;
  const showOwnFinanceBalance = permissions.finance;

  const bottomPadding = useMemo(() => getTabBarHeight(insets) + theme.spacing.sm, [insets, theme.spacing.sm]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          flex: 1,
          gap: theme.spacing.xs,
          paddingBottom: bottomPadding,
        },
        body: {
          flex: 1,
          justifyContent: 'space-between',
          gap: theme.spacing.xs,
        },
        attendanceStack: {
          gap: theme.spacing.xs,
        },
      }),
    [bottomPadding, theme],
  );

  const attendanceMetrics = useMemo(
    () => [
      {
        key: 'days',
        icon: 'calendar-check' as const,
        iconColor: theme.colors.success,
        iconBackground: theme.colors.successLight,
        accentColor: theme.colors.success,
        label: t('attendanceDays'),
        value: String(attendanceStats.daysWithCheckIn),
      },
      {
        key: 'sessions',
        icon: 'calendar-sync' as const,
        iconColor: theme.colors.primary,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.primary,
        label: t('attendanceCompletedDays'),
        value: String(attendanceStats.completedSessions),
      },
      {
        key: 'hours',
        icon: 'clock-outline' as const,
        iconColor: theme.colors.warning,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.warning,
        label: t('attendanceTotalHours'),
        value: formatAttendanceDuration(attendanceStats.totalSeconds),
      },
    ],
    [attendanceStats, t, theme],
  );

  const shortcuts = useMemo(() => {
    const items = [
      {
        key: 'attendance',
        icon: 'calendar-clock' as const,
        iconColor: theme.colors.primary,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.primary,
        label: t('myAttendance'),
        description: t('dashboardShortcutAttendanceDesc'),
        onPress: () => navigation.navigate('AttendanceTab', {screen: 'MyAttendance'}),
      },
      {
        key: 'pricing',
        icon: 'clipboard-list-outline' as const,
        iconColor: theme.colors.primary,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.primary,
        label: t('orders'),
        description: t('dashboardShortcutOrdersDesc'),
        onPress: () => navigation.navigate('PricingTab', {screen: 'OrdersHome'}),
      },
    ];

    if (showFinanceShortcut) {
      items.push({
        key: 'finance',
        icon: 'cash-multiple' as const,
        iconColor: theme.colors.success,
        iconBackground: theme.colors.successLight,
        accentColor: theme.colors.success,
        label: t('finance'),
        description: t('dashboardShortcutFinanceDesc'),
        onPress: () => navigation.navigate('FinanceTab', {screen: 'FinanceHome'}),
      });
    }

    return items;
  }, [navigation, showFinanceShortcut, t, theme]);

  if (!isEmployee) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.status.error}]}>{t('accessDenied')}</Text>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <>
        <ScreenHeader
          title={t('employeeHome')}
          endAction={showNotificationsIcon ? <AdminDashboardNotificationsAction /> : undefined}
        />
        <ScreenContainer scroll={false} contentStyle={styles.content}>
          <ListLoadingState />
        </ScreenContainer>
      </>
    );
  }

  return (
    <>
      <ScreenHeader
        title={t('employeeHome')}
        endAction={showNotificationsIcon ? <AdminDashboardNotificationsAction /> : undefined}
      />
      <ScreenContainer scroll={false} contentStyle={styles.content}>
      <DashboardHeroCard
        variant="compact"
        title={t('dashboardWelcome', {name: currentUser?.name ?? t('employeeRole')})}
        subtitle={t('employeeHomeSubtitle')}
        userName={currentUser?.name}
        gradientColors={theme.gradient.profile}
      />

      <View style={styles.body}>
        <DashboardSection
          compact
          title={t('employeeHomeAttendanceSection')}
          icon="fingerprint"
          iconColor={theme.colors.primary}
          iconBackground={theme.colors.surfaceSecondary}
        >
          <View style={styles.attendanceStack}>
            {needsLocationForAttendance ? (
              <AttendanceLocationPermissionCard
                variant="compact"
                state={locationPermission.state}
                onRequestPermission={handleRequestLocationPermission}
                loading={permissionLoading}
              />
            ) : null}
            <EmployeeHomeAttendanceCard
              variant="compact"
              records={attendanceRecords}
              daysWithCheckIn={attendanceStats.daysWithCheckIn}
              totalSeconds={attendanceStats.totalSeconds}
              todayStatus={todayStatus}
              onAction={handleAttendanceAction}
              actionLoading={actionLoading}
              requireLocationCheck={permissions.attendanceLocationRequired}
              requireGpsLinked={permissions.attendanceGpsLinked}
            />
            <DashboardMetricGrid metrics={attendanceMetrics} variant="compact" />
          </View>
        </DashboardSection>

        {showOwnFinanceBalance ? (
          <DashboardSection
            compact
            title={t('finance')}
            icon="wallet-outline"
            iconColor={theme.colors.success}
            iconBackground={theme.colors.successLight}
          >
            <EmployeeHomeBalanceCard
              variant="compact"
              balance={balance}
              onPress={() => navigation.navigate('FinanceTab', {screen: 'FinanceHome'})}
            />
          </DashboardSection>
        ) : null}

        <DashboardSection
          compact
          title={t('dashboardQuickAccess')}
          icon="lightning-bolt-outline"
          iconColor={theme.colors.warning}
          iconBackground={theme.colors.surfaceSecondary}
        >
          <DashboardShortcutGrid shortcuts={shortcuts} variant="grid" />
        </DashboardSection>
      </View>
      </ScreenContainer>
    </>
  );
};

export default EmployeeHomeScreen;
