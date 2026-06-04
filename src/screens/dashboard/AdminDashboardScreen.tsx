import React, {useMemo} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {CompositeNavigationProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import DashboardHeroCard from '@app/components/dashboard/DashboardHeroCard';
import DashboardMetricGrid from '@app/components/dashboard/DashboardMetricGrid';
import DashboardSection from '@app/components/dashboard/DashboardSection';
import DashboardShortcutGrid from '@app/components/dashboard/DashboardShortcutGrid';
import ListLoadingState from '@app/components/common/ListLoadingState';
import ScreenContainer from '@app/components/common/ScreenContainer';
import FinanceSummaryCards from '@app/components/finance/FinanceSummaryCards';
import {useAdminDashboardData} from '@app/hooks/useAdminDashboardData';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useAuthStore} from '@app/stores/authStore';
import type {DashboardStackParamList, MainTabParamList} from '@app/types/navigation';
import {canAccessEmployeeManagement} from '@app/utils/adminPermissions';

type DashboardNav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'DashboardHome'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const AdminDashboardScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const navigation = useNavigation<DashboardNav>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const {
    employees,
    presentCount,
    globalBalance,
    cashIn,
    cashOut,
    isLoading,
  } = useAdminDashboardData(isAdmin);

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

  const awayCount = Math.max(0, employees.length - presentCount);
  const presentRate =
    employees.length > 0 ? `${Math.round((presentCount / employees.length) * 100)}%` : '—';

  const metrics = useMemo(
    () => [
      {
        key: 'present',
        icon: 'account-check-outline' as const,
        iconColor: theme.colors.success,
        iconBackground: theme.colors.successLight,
        accentColor: theme.colors.success,
        label: t('dashboardEmployeesPresent'),
        value: `${presentCount}/${employees.length}`,
        hint: presentRate,
      },
      {
        key: 'team',
        icon: 'account-group-outline' as const,
        iconColor: theme.colors.primary,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.primary,
        label: t('dashboardTotalEmployees'),
        value: String(employees.length),
      },
      {
        key: 'away',
        icon: 'account-clock-outline' as const,
        iconColor: theme.colors.warning,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.warning,
        label: t('dashboardEmployeesAway'),
        value: String(awayCount),
      },
    ],
    [awayCount, employees.length, presentCount, presentRate, t, theme],
  );

  const showEmployeeManagement = canAccessEmployeeManagement(currentUser);

  const shortcuts = useMemo(() => {
    const items = [
      {
        key: 'finance',
        icon: 'cash-multiple' as const,
        iconColor: theme.colors.success,
        iconBackground: theme.colors.successLight,
        accentColor: theme.colors.success,
        label: t('finance'),
        description: t('dashboardShortcutFinanceDesc'),
        onPress: () => navigation.navigate('FinanceTab', {screen: 'FinanceHome'}),
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
    if (showEmployeeManagement) {
      items.push({
        key: 'employees',
        icon: 'account-supervisor' as const,
        iconColor: theme.colors.secondary ?? theme.colors.primary,
        iconBackground: theme.colors.surfaceSecondary,
        accentColor: theme.colors.secondary ?? theme.colors.primary,
        label: t('manageEmployees'),
        description: t('dashboardShortcutEmployeesDesc'),
        onPress: () => navigation.navigate('EmployeesTab', {screen: 'EmployeeManagementHome'}),
      });
    }
    return items;
  }, [navigation, showEmployeeManagement, t, theme]);

  if (!isAdmin) {
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
          {t('dashboard')}
        </Text>
        <ListLoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentStyle={styles.content}>
      <Text style={[styles.screenTitle, textStyle, {color: theme.typography.primary}]}>
        {t('dashboard')}
      </Text>

      <DashboardHeroCard
        title={t('dashboardWelcome', {name: currentUser?.name ?? t('adminRole')})}
        subtitle={t('dashboardSubtitle')}
        userName={currentUser?.name}
        gradientColors={theme.gradient.header}
      />

      <DashboardSection
        title={t('dashboardFinanceSection')}
        subtitle={t('dashboardFinanceSectionHint')}
        icon="chart-box-outline"
        iconColor={theme.colors.primary}
        iconBackground={theme.colors.surfaceSecondary}
      >
        <FinanceSummaryCards cashIn={cashIn} cashOut={cashOut} totalBalance={globalBalance} loading={false} />
      </DashboardSection>

      <DashboardSection
        title={t('dashboardTodaySection')}
        subtitle={t('dashboardTodaySectionHint')}
        icon="calendar-today"
        iconColor={theme.colors.success}
        iconBackground={theme.colors.successLight}
      >
        <DashboardMetricGrid metrics={metrics} />
      </DashboardSection>

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

export default AdminDashboardScreen;
