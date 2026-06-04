import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TabBarLabel} from '@app/components/navigation/AppNavText';
import {useTheme} from '@app/context/ThemeContext';
import AttendanceNavigator from '@app/navigation/AttendanceNavigator';
import DashboardNavigator from '@app/navigation/DashboardNavigator';
import FinanceNavigator from '@app/navigation/FinanceNavigator';
import EmployeeManagementNavigator from '@app/navigation/EmployeeManagementNavigator';
import PricingNavigator from '@app/navigation/PricingNavigator';
import SettingsNavigator from '@app/navigation/SettingsNavigator';
import {useAttendanceWorkplaceSync} from '@app/hooks/useAttendanceWorkplaceSync';
import {useAttendanceGpsEnforcement} from '@app/hooks/useAttendanceGpsEnforcement';
import {useAttendanceLocationPermission} from '@app/hooks/useAttendanceLocationPermission';
import {useEmployeeAttendanceLocationSetup} from '@app/hooks/useEmployeeAttendanceLocationSetup';
import {useEmployeeCheckedInState} from '@app/hooks/useEmployeeCheckedInState';
import {useEmployeeLocationPublisher} from '@app/hooks/useEmployeeLocationPublisher';
import {useAuthStore} from '@app/stores/authStore';
import {useMirrorPricingConfirmedOrdersStore} from '@app/stores/mirrorPricingConfirmedOrdersStore';
import type {MainTabParamList} from '@app/types/navigation';
import {canAccessEmployeeManagement} from '@app/utils/adminPermissions';
import {
  canAccessModule,
  requiresAttendanceGpsLinked,
  requiresAttendanceLocationCheck,
} from '@app/utils/employeePermissions';
import {tabPressResetToRoot} from '@app/navigation/tabPressResetToRoot';
import {getEffectiveTabBarInsets, getTabBarHeight} from '@app/utils/tabBarInsets';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator: React.FC = () => {
  const {t} = useTranslation();
  const {theme} = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  useAttendanceWorkplaceSync(Boolean(user?.id));
  const tabBarInsets = useMemo(() => getEffectiveTabBarInsets(insets), [insets]);
  const tabBarHeight = useMemo(() => getTabBarHeight(insets), [insets]);

  const isEmployee = user?.role === 'employee';
  const needsEmployeeLocation =
    isEmployee &&
    (requiresAttendanceLocationCheck(user) || requiresAttendanceGpsLinked(user));
  const locationPermission = useAttendanceLocationPermission(needsEmployeeLocation);
  useEmployeeAttendanceLocationSetup(needsEmployeeLocation);
  const gpsLinked = isEmployee && requiresAttendanceGpsLinked(user);
  const locationServicesReady = needsEmployeeLocation && locationPermission.granted;
  const employeeCheckedIn = useEmployeeCheckedInState(user?.id, isEmployee);
  useEmployeeLocationPublisher(user?.id, locationServicesReady && employeeCheckedIn);
  useAttendanceGpsEnforcement({
    userId: user?.id,
    enabled: gpsLinked && locationPermission.granted,
  });
  const confirmedOrdersCount = useMirrorPricingConfirmedOrdersStore((state) => state.orders.length);

  const showHomeTab = user?.role === 'admin' || user?.role === 'employee';
  const showPricingTab = user?.role === 'admin' || user?.role === 'employee';
  const showFinance = canAccessModule(user, 'finance');
  const showEmployeesTab = canAccessEmployeeManagement(user);
  const showAttendanceTab = user?.role === 'employee';

  const initialRouteName = useMemo(() => {
    if (showHomeTab) return 'DashboardTab';
    if (showFinance) return 'FinanceTab';
    if (showAttendanceTab) return 'AttendanceTab';
    return 'SettingsTab';
  }, [showAttendanceTab, showFinance, showHomeTab]);

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: tabBarHeight,
      paddingBottom: tabBarInsets.bottom,
      paddingTop: 6,
    }),
    [theme, tabBarHeight, tabBarInsets.bottom],
  );

  return (
    <Tab.Navigator
      lazy
      initialRouteName={initialRouteName}
      safeAreaInsets={tabBarInsets}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.icon,
        tabBarStyle,
        tabBarLabel: ({color, children}) => (
          <TabBarLabel color={color}>{String(children ?? '')}</TabBarLabel>
        ),
      }}
    >
      {showHomeTab ? (
        <Tab.Screen
          name="DashboardTab"
          component={DashboardNavigator}
          listeners={tabPressResetToRoot('DashboardTab')}
          options={{
            title: user?.role === 'admin' ? t('dashboard') : t('employeeHome'),
            tabBarIcon: ({color, size}) => (
              <MaterialCommunityIcons
                name={user?.role === 'admin' ? 'view-dashboard-outline' : 'home-outline'}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ) : null}
      {showFinance ? (
        <Tab.Screen
          name="FinanceTab"
          component={FinanceNavigator}
          listeners={tabPressResetToRoot('FinanceTab')}
          options={{
            title: t('finance'),
            tabBarIcon: ({color, size}) => (
              <MaterialCommunityIcons name="cash-multiple" color={color} size={size} />
            ),
          }}
        />
      ) : null}
      {showPricingTab ? (
        <Tab.Screen
          name="PricingTab"
          component={PricingNavigator}
          listeners={tabPressResetToRoot('PricingTab')}
          options={{
            title: t('orders'),
            tabBarBadge: confirmedOrdersCount > 0 ? confirmedOrdersCount : undefined,
            tabBarIcon: ({color, size}) => (
              <MaterialCommunityIcons name="mirror" color={color} size={size} />
            ),
          }}
        />
      ) : null}
      {showAttendanceTab ? (
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceNavigator}
          listeners={tabPressResetToRoot('AttendanceTab')}
          options={{
            title: t('myAttendance'),
            tabBarIcon: ({color, size}) => (
              <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
            ),
          }}
        />
      ) : null}
      {showEmployeesTab ? (
        <Tab.Screen
          name="EmployeesTab"
          component={EmployeeManagementNavigator}
          listeners={tabPressResetToRoot('EmployeesTab')}
          options={{
            title: t('manageEmployees'),
            tabBarIcon: ({color, size}) => (
              <MaterialCommunityIcons name="account-supervisor" color={color} size={size} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="SettingsTab"
        component={SettingsNavigator}
        listeners={tabPressResetToRoot('SettingsTab')}
        options={{
          title: t('settings'),
          headerShown: false,
          tabBarIcon: ({color, size}) => (
            <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
