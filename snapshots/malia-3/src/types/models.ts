export type UserRole = 'admin' | 'employee';

export type EmployeePermissionModule = 'finance';

export interface EmployeePermissions {
  finance: boolean;
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
}

export interface EmployeeFinanceCardLabels {
  cash?: string;
  salaryAdvance?: string;
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
  financeLedgers?: EmployeeFinanceLedger[];
  financeCardLabels?: EmployeeFinanceCardLabels;
  attendanceResetSchedule?: AttendanceHoursResetSchedule;
  attendanceResetScheduleUpdatedAt?: string;
  attendanceLastResetBoundary?: string;
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

export type AttendanceEventType = 'check_in' | 'check_out' | 'hours_reset';

export interface AttendanceRecord {
  id: string;
  userId: string;
  type: AttendanceEventType;
  createdAt: string;
  note?: string;
  resetTotalSeconds?: number;
}
