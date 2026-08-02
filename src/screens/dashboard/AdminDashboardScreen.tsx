import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {CompositeNavigationProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import DashboardHeroCard from '@app/components/dashboard/DashboardHeroCard';
import DashboardLazyLoadPrompt from '@app/components/dashboard/DashboardLazyLoadPrompt';
import DashboardMetricGrid from '@app/components/dashboard/DashboardMetricGrid';
import DashboardSection from '@app/components/dashboard/DashboardSection';
import DashboardShortcutGrid from '@app/components/dashboard/DashboardShortcutGrid';
import ScreenContainer from '@app/components/common/ScreenContainer';
import ScreenHeader from '@app/components/common/ScreenHeader';
import AdminDashboardNotificationsAction from '@app/components/notifications/AdminDashboardNotificationsAction';
import FinanceSummaryCards from '@app/components/finance/FinanceSummaryCards';
import {useAdminDashboardData} from '@app/hooks/useAdminDashboardData';
import {useDirection} from '@app/hooks/useDirection';
import {useTheme} from '@app/context/ThemeContext';
import {useAuthStore} from '@app/stores/authStore';
import type {DashboardStackParamList, MainTabParamList} from '@app/types/navigation';
import {canAccessEmployeeManagement} from '@app/utils/adminPermissions';
import {canViewNotificationsLog} from '@app/utils/employeePermissions';
import {getTabBarHeight} from '@app/utils/tabBarInsets';

type DashboardNav = CompositeNavigationProp<
  NativeStackNavigationProp<DashboardStackParamList, 'DashboardHome'>,
  BottomTabNavigationProp<MainTabParamList>
>;

const AdminDashboardScreen: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const {textStyle} = useDirection();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DashboardNav>();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const showNotificationsIcon = canViewNotificationsLog(currentUser);
  const [loadFinance, setLoadFinance] = useState(false);
  const [loadMetrics, setLoadMetrics] = useState(false);
  const {
    employees,
    presentCount,
    globalBalance,
    cashIn,
    cashOut,
    financeLoading,
    metricsLoading,
  } = useAdminDashboardData(isAdmin, {loadFinance, loadMetrics});

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
      }),
    [bottomPadding, theme],
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

  return (
    <>
      <ScreenHeader
        title={t('dashboard')}
        endAction={showNotificationsIcon ? <AdminDashboardNotificationsAction /> : undefined}
      />
      <ScreenContainer scroll={false} contentStyle={styles.content}>
        <DashboardHeroCard
          variant="compact"
          title={t('dashboardWelcome', {name: currentUser?.name ?? t('adminRole')})}
          subtitle={t('dashboardSubtitle')}
          userName={currentUser?.name}
          gradientColors={theme.gradient.header}
        />

        <View style={styles.body}>
          <DashboardSection
            compact
            title={t('dashboardFinanceSection')}
            icon="chart-box-outline"
            iconColor={theme.colors.primary}
            iconBackground={theme.colors.surfaceSecondary}
          >
            {loadFinance ? (
              <FinanceSummaryCards
                cashIn={cashIn}
                cashOut={cashOut}
                totalBalance={globalBalance}
                loading={financeLoading}
                variant="compact"
              />
            ) : (
              <DashboardLazyLoadPrompt
                label={t('dashboardTapToLoadFinance')}
                hint={t('dashboardFinanceSectionHint')}
                onPress={() => setLoadFinance(true)}
              />
            )}
          </DashboardSection>

          <DashboardSection
            compact
            title={t('dashboardTodaySection')}
            icon="calendar-today"
            iconColor={theme.colors.success}
            iconBackground={theme.colors.successLight}
          >
            {loadMetrics ? (
              metricsLoading ? (
                <DashboardLazyLoadPrompt
                  label={t('dashboardTapToLoadMetrics')}
                  hint={t('dashboardTodaySectionHint')}
                  loading
                  onPress={() => undefined}
                />
              ) : (
                <DashboardMetricGrid metrics={metrics} variant="compact" />
              )
            ) : (
              <DashboardLazyLoadPrompt
                label={t('dashboardTapToLoadMetrics')}
                hint={t('dashboardTodaySectionHint')}
                onPress={() => setLoadMetrics(true)}
              />
            )}
          </DashboardSection>

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

export default AdminDashboardScreen;
