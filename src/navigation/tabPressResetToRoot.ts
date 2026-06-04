import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import type {EventArg, ParamListBase} from '@react-navigation/native';
import type {MainTabParamList} from '@app/types/navigation';

type TabName = keyof MainTabParamList;

const TAB_ROOT_SCREEN: Record<TabName, string> = {
  DashboardTab: 'DashboardHome',
  FinanceTab: 'FinanceHome',
  AttendanceTab: 'MyAttendance',
  PricingTab: 'OrdersHome',
  EmployeesTab: 'EmployeeManagementHome',
  SettingsTab: 'SettingsHome',
};

/** Always open the tab's home screen instead of the last nested route. */
export function tabPressResetToRoot(tabName: TabName) {
  return ({
    navigation,
  }: {
    navigation: BottomTabNavigationProp<ParamListBase>;
  }) => ({
    tabPress: (event: EventArg<'tabPress', true, undefined>) => {
      event.preventDefault();
      navigation.navigate(tabName, {
        screen: TAB_ROOT_SCREEN[tabName],
      });
    },
  });
}
