import {useMemo} from 'react';
import {subscribeToAllAttendance} from '@app/services/attendance.service';
import {subscribeToAllTransactions} from '@app/services/transactions.service';
import {getEmployees, getFinanceAccounts, subscribeToUsers} from '@app/services/users.service';
import type {AppUser, AttendanceRecord, Transaction} from '@app/types/models';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {useAuthStore} from '@app/stores/authStore';
import {
  computeFinanceHomePageTotalBalance,
  computeFinanceTotals,
  filterFinanceUsersForViewer,
  filterTransactionsForUsers,
} from '@app/utils/financeTotals';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';

export interface AdminDashboardData {
  users: AppUser[];
  employees: AppUser[];
  presentCount: number;
  globalBalance: number;
  cashIn: number;
  cashOut: number;
  isLoading: boolean;
}

export function useAdminDashboardData(enabled: boolean): AdminDashboardData {
  const currentUser = useAuthStore((s) => s.user);
  const {data: users, isLoading: usersLoading} = useFirestoreSubscription<AppUser[]>(
    [],
    subscribeToUsers,
    [],
    {enabled},
  );
  const {data: transactions, isLoading: transactionsLoading} = useFirestoreSubscription<Transaction[]>(
    [],
    subscribeToAllTransactions,
    [],
    {enabled},
  );
  const {data: attendanceRecords, isLoading: attendanceLoading} = useFirestoreSubscription<
    AttendanceRecord[]
  >([], subscribeToAllAttendance, [], {enabled});

  const employees = useMemo(() => getEmployees(users), [users]);

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

  const financeUsers = useMemo(() => getFinanceAccounts(users), [users]);

  const visibleFinanceUsers = useMemo(
    () => filterFinanceUsersForViewer(currentUser, financeUsers),
    [currentUser, financeUsers],
  );

  const financeTransactions = useMemo(
    () => filterTransactionsForUsers(transactions, visibleFinanceUsers),
    [visibleFinanceUsers, transactions],
  );

  const globalBalance = useMemo(
    () => computeFinanceHomePageTotalBalance(currentUser, visibleFinanceUsers, financeTransactions),
    [currentUser, financeTransactions, visibleFinanceUsers],
  );

  const {cashIn, cashOut} = useMemo(() => computeFinanceTotals(financeTransactions), [financeTransactions]);

  const isLoading = enabled && (usersLoading || transactionsLoading || attendanceLoading);

  return {
    users,
    employees,
    presentCount,
    globalBalance,
    cashIn,
    cashOut,
    isLoading,
  };
}
