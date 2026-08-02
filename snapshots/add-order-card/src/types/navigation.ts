import type {NavigatorScreenParams} from '@react-navigation/native';
import type {MirrorPricingOrderStatus} from '@app/types/mirrorPricingOrderStatus';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  DashboardTab: NavigatorScreenParams<DashboardStackParamList> | undefined;
  FinanceTab: NavigatorScreenParams<FinanceStackParamList> | undefined;
  AttendanceTab: NavigatorScreenParams<AttendanceStackParamList> | undefined;
  PricingTab: NavigatorScreenParams<PricingStackParamList> | undefined;
  EmployeesTab: NavigatorScreenParams<EmployeeManagementStackParamList> | undefined;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList> | undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  AttendanceWorkplaceSettings: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  EmployeeAccount: {userId: string; userName: string; card?: 'cash'};
  EmployeeAdvance: {userId: string; userName: string};
  EmployeeCustomLedger: {
    userId: string;
    userName: string;
    ledgerId: string;
    ledgerName: string;
    ledgerColor?: string;
  };
};

export type AttendanceStackParamList = {
  MyAttendance: undefined;
  TeamAttendanceList: undefined;
  EmployeeAttendanceView: {userId: string; userName: string};
};

export type PricingStackParamList = {
  OrdersHome: undefined;
  MirrorPricing: undefined;
  MirrorPricingAddToCart: undefined;
  MirrorPricingPriceList: undefined;
  ConfirmedOrders: {focusOrderId?: string} | undefined;
  OrdersByStatus: {
    status: MirrorPricingOrderStatus;
    focusOrderId?: string;
    outstandingOnly?: boolean;
  };
};

export type EmployeeManagementStackParamList = {
  EmployeeManagementHome: undefined;
  EmployeeDetail: {userId: string; userName: string};
  EmployeePermissions: {userId: string; userName: string};
  EmployeeAttendance: {userId: string; userName: string};
  EmployeeLocation: {userId: string; userName: string};
  EmployeeAttendanceReset: {userId: string; userName: string};
  EmployeeAttendanceShiftHours: {userId: string; userName: string};
  AdminDetail: {userId: string; userName: string};
  UserForm: undefined;
};
