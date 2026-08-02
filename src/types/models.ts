export type UserRole = 'admin' | 'employee';

export type EmployeePermissionModule = 'finance';

export interface EmployeePermissions {
  finance: boolean;
  /** When enabled, employee can view and manage other employees' finance accounts. */
  employeeFinance: boolean;
  /** When enabled, employee can view other employees' attendance records. */
  employeeAttendance: boolean;
  attendanceLocationRequired: boolean;
  /** When enabled, device location must stay on while checked in; disabling GPS auto check-out. */
  attendanceGpsLinked: boolean;
  /** When enabled, employee can move orders between status lists. */
  moveOrders: boolean;
  /** When enabled, employee can delete confirmed orders. */
  deleteOrders: boolean;
  /** When enabled, employee can leave a note on an active order card. */
  orderCardNotes: boolean;
  /** When enabled, employee can edit financial transactions without the time limit. */
  editFinanceTransactions: boolean;
  /** When enabled, employee sees the notifications log icon on the dashboard. */
  showNotificationsIcon: boolean;
}

export interface AdminPermissions {
  /** When enabled, this admin can see mirror cart unit/line/total cost prices. */
  showMirrorCartCostPrice: boolean;
  /** When enabled, this admin can open the employee management section (tab and shortcuts). */
  showEmployeeManagement: boolean;
  /** When enabled, this admin sees all finance accounts/cards; otherwise only their own. */
  showAllFinanceCards: boolean;
}

export type AttendanceResetScheduleType = 'none' | 'weekly' | 'monthly';

export interface AttendanceHoursResetSchedule {
  type: AttendanceResetScheduleType;
  weeklyDay?: number;
  monthlyDay?: number;
}

export interface EmployeeFinanceLedger {
  id: string;
  name: string;
  createdAt: string;
  createdByUserId?: string;
  /** User IDs (employees/admins) who may view this card besides the account owner and managing admins. */
  visibleToUserIds?: string[];
  /** Personal note card for the owner only; excluded from finance totals. */
  memoOnly?: boolean;
}

export interface EmployeeFinanceCardLabels {
  cash?: string;
  salaryAdvance?: string;
}

export interface EmployeeLastLocation {
  latitude: number;
  longitude: number;
  updatedAt: string;
  accuracy?: number;
}

/** Geofence used for employee check-in when location permission is enabled. */
export interface AttendanceWorkplace {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  balance: number;
  createdAt: string;
  email?: string;
  /** Set for the main account that can manage and delete other admins. */
  isPrimaryAdmin?: boolean;
  permissions?: EmployeePermissions;
  adminPermissions?: AdminPermissions;
  financeLedgers?: EmployeeFinanceLedger[];
  financeCardLabels?: EmployeeFinanceCardLabels;
  attendanceResetSchedule?: AttendanceHoursResetSchedule;
  attendanceResetScheduleUpdatedAt?: string;
  attendanceLastResetBoundary?: string;
  /** Max hours per check-in session; auto check-out when elapsed. Admin-configured per employee. */
  attendanceShiftHours?: number;
  attendanceShiftHoursUpdatedAt?: string;
  /** Keys `${ownerUserId}:${ledgerId}` for admin finance cards shared with this employee. */
  delegatedFinanceLedgerAccess?: string[];
  /** Latest GPS position reported from the employee device. */
  lastLocation?: EmployeeLastLocation;
  /** Expo push tokens for admin background alerts. */
  expoPushTokens?: string[];
  /** Last GPS heartbeat while checked in with GPS-linked attendance (ISO). */
  attendanceGpsHeartbeatAt?: string;
  /** Set when an employee is removed from management but their finance account is preserved. */
  archivedAt?: string;
}

export type TransactionType =
  | 'received'
  | 'paid'
  | 'order_collection'
  | 'advance'
  | 'advance_repayment'
  | 'ledger_debit'
  | 'ledger_credit';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  note: string;
  createdAt: string;
  /** Links custom sub-ledger transactions to an admin-defined finance card. */
  ledgerId?: string;
  /** Set when an employee confirms the transaction — locked for the employee. */
  isPinned?: boolean;
  pinnedAt?: string;
  createdByUserId?: string;
  createdByRole?: UserRole;
  updatedAt?: string;
  updatedByUserId?: string;
}

export interface TransactionFormData {
  amount: number;
  note?: string;
}

export type AttendanceEventType = 'check_in' | 'check_out' | 'hours_reset' | 'absent';

export interface AttendanceRecord {
  id: string;
  userId: string;
  type: AttendanceEventType;
  createdAt: string;
  note?: string;
  resetTotalSeconds?: number;
}
