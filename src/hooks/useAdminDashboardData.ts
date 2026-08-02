import {useMemo} from 'react';
import {subscribeToTodayAttendance} from '@app/services/attendance.service';
import {getEmployees, getFinanceAccounts} from '@app/services/users.service';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {useAuthStore} from '@app/stores/authStore';
import {
  computeFinanceHomeCashFlowTotals,
  computeFinanceHomePageTotalBalance,
  filterFinanceUsersForViewer,
  filterTransactionsForUsers,
} from '@app/utils/financeTotals';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useFinanceAccountTransactions} from '@app/hooks/useFinanceAccountTransactions';
import {useUsersDirectory} from '@app/hooks/useUsersDirectory';

export interface AdminDashboardLoadOptions {
  loadFinance?: boolean;
  loadMetrics?: boolean;
}

export interface AdminDashboardData {
  users: AppUser[];
  employees: AppUser[];
  presentCount: number;
  globalBalance: number;
  cashIn: number;
  cashOut: number;
  financeLoading: boolean;
  metricsLoading: boolean;
}

export function useAdminDashboardData(
  enabled: boolean,
  options: AdminDashboardLoadOptions = {},
): AdminDashboardData {
  const currentUser = useAuthStore((s) => s.user);
  const loadFinance = options.loadFinance ?? false;
  const loadMetrics = options.loadMetrics ?? false;
  const needsUsers = loadFinance || loadMetrics;

  const {users, isLoading: usersLoading} = useUsersDirectory('all', enabled && needsUsers);

  const employees = useMemo(() => getEmployees(users), [users]);

  const financeUsers = useMemo(() => getFinanceAccounts(users), [users]);
  const visibleFinanceUsers = useMemo(
    () => filterFinanceUsersForViewer(currentUser, financeUsers),
    [currentUser, financeUsers],
  );
  const financeAccountUserIds = useMemo(
    () => visibleFinanceUsers.map((user) => user.id),
    [visibleFinanceUsers],
  );

  const {transactions, isLoading: transactionsLoading} = useFinanceAccountTransactions(
    financeAccountUserIds,
    enabled && loadFinance,
  );

  const {data: attendanceRecords, isLoading: attendanceLoading} = useFirestoreSubscription<
    AttendanceRecord[]
  >([], subscribeToTodayAttendance, [], {enabled: enabled && loadMetrics});

  const attendanceByUser = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const record of attendanceRecords) {
      const userRecords = map.get(record.userId) ?? [];
      userRecords.push(record);
      map.set(record.userId, userRecords);
    }
    return map;
  }, [attendanceRecords]);

  const presentCount = useMemo(
    () =>
      employees.filter(
        (employee) => getEmployeePresenceStatus(attendanceByUser.get(employee.id) ?? []) === 'present',
      ).length,
    [attendanceByUser, employees],
  );

  const financeTransactions = useMemo(
    () => filterTransactionsForUsers(transactions, visibleFinanceUsers),
    [transactions, visibleFinanceUsers],
  );

  const globalBalance = useMemo(
    () => computeFinanceHomePageTotalBalance(currentUser, visibleFinanceUsers, financeTransactions),
    [currentUser, financeTransactions, visibleFinanceUsers],
  );

  const {cashIn, cashOut} = useMemo(
    () => computeFinanceHomeCashFlowTotals(financeTransactions, visibleFinanceUsers),
    [financeTransactions, visibleFinanceUsers],
  );

  const financeLoading = enabled && loadFinance && (usersLoading || transactionsLoading);
  const metricsLoading = enabled && loadMetrics && (usersLoading || attendanceLoading);

  return {
    users,
    employees,
    presentCount,
    globalBalance,
    cashIn,
    cashOut,
    financeLoading,
    metricsLoading,
  };
}
