import type {NavigatorScreenParams} from '@react-navigation/native';

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
  SettingsTab: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

export type FinanceStackParamList = {
  FinanceHome: undefined;
  EmployeeFinanceHub: {userId: string; userName: string};
  EmployeeAccount: {userId: string; userName: string};
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
};

export type PricingStackParamList = {
  OrdersHome: undefined;
  MirrorPricing: undefined;
  ConfirmedOrders: undefined;
};

export type EmployeeManagementStackParamList = {
  EmployeeManagementHome: undefined;
  EmployeeDetail: {userId: string; userName: string};
  EmployeePermissions: {userId: string; userName: string};
  EmployeeAttendance: {userId: string; userName: string};
  EmployeeAttendanceReset: {userId: string; userName: string};
  AdminDetail: {userId: string; userName: string};
  UserForm: undefined;
};
