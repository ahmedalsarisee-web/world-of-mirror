import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {CompositeNavigationProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import DashboardHeroCard from '@app/components/dashboard/DashboardHeroCard';
import DashboardSection from '@app/components/dashboard/DashboardSection';
import DashboardShortcutGrid from '@app/components/dashboard/DashboardShortcutGrid';
import ListLoadingState from '@app/components/common/ListLoadingState';
import ScreenContainer from '@app/components/common/ScreenContainer';
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
type HomeNav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'DashboardHome'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const EmployeeHomeScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<HomeNav>();
  const currentUser = useAuthStore((s) => s.user);
  const isEmployee = currentUser?.role === 'employee';

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

  const showFinance = permissions.finance;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          gap: theme.spacing.xs,
          paddingBottom: theme.spacing.xxl,
        },
        screenTitle: {
          fontSize: theme.typographyScale.size.xxl ?? theme.typographyScale.size.xl,
          fontWeight: '800',
          marginBottom: theme.spacing.sm,
          letterSpacing: -0.3,
        },
      }),
    [theme],
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

    if (showFinance) {
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
  }, [navigation, showFinance, t, theme]);

  if (!isEmployee) {
    return (
      <ScreenContainer>
        <Text style={[textStyle, {color: theme.status.error}]}>{t('accessDenied')}</Text>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer contentStyle={styles.content}>
        <Text style={[styles.screenTitle, textStyle, {color: theme.typography.primary}]}>
          {t('employeeHome')}
        </Text>
        <ListLoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.content}>
      <Text style={[styles.screenTitle, textStyle, {color: theme.typography.primary}]}>
        {t('employeeHome')}
      </Text>

      <DashboardHeroCard
        title={t('dashboardWelcome', {name: currentUser?.name ?? t('employeeRole')})}
        subtitle={t('employeeHomeSubtitle')}
        userName={currentUser?.name}
        gradientColors={theme.gradient.profile}
      />

      <DashboardSection
        title={t('employeeHomeAttendanceSection')}
        subtitle={todayStatus}
        icon="fingerprint"
        iconColor={theme.colors.primary}
        iconBackground={theme.colors.surfaceSecondary}
      >
        {needsLocationForAttendance ? (
          <AttendanceLocationPermissionCard
            state={locationPermission.state}
            onRequestPermission={handleRequestLocationPermission}
            loading={permissionLoading}
          />
        ) : null}
        <EmployeeHomeAttendanceCard
          records={attendanceRecords}
          daysWithCheckIn={attendanceStats.daysWithCheckIn}
          totalSeconds={attendanceStats.totalSeconds}
          todayStatus={todayStatus}
          onAction={handleAttendanceAction}
          actionLoading={actionLoading}
          requireLocationCheck={permissions.attendanceLocationRequired}
          requireGpsLinked={permissions.attendanceGpsLinked}
        />
      </DashboardSection>

      {showFinance ? (
        <DashboardSection
          title={t('finance')}
          subtitle={t('dashboardFinanceSectionHint')}
          icon="wallet-outline"
          iconColor={theme.colors.success}
          iconBackground={theme.colors.successLight}
        >
          <EmployeeHomeBalanceCard
            balance={balance}
            onPress={() => navigation.navigate('FinanceTab', {screen: 'FinanceHome'})}
          />
        </DashboardSection>
      ) : null}

      <DashboardSection
        title={t('dashboardQuickAccess')}
        subtitle={t('dashboardQuickAccessHint')}
        icon="lightning-bolt-outline"
        iconColor={theme.colors.warning}
        iconBackground={theme.colors.surfaceSecondary}
      >
        <DashboardShortcutGrid shortcuts={shortcuts} />
      </DashboardSection>
    </ScreenContainer>
  );
};

export default EmployeeHomeScreen;
