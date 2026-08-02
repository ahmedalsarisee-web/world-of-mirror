import {useMemo} from 'react';
import {subscribeToUserTransactions} from '@app/services/transactions.service';
import type {AppUser, Transaction} from '@app/types/models';
import {
  buildAttendanceDays,
  computeAttendanceStats,
  getTodayAttendanceStatus,
} from '@app/utils/attendanceReport';
import {resolveEmployeePermissions} from '@app/utils/employeePermissions';
import {resolveCashAccountBalance} from '@app/utils/financeTotals';
import {getCurrentPeriodStartIso, filterRecordsForCurrentPeriod} from '@app/utils/attendanceSchedule';
import {useProcessAttendanceResets} from '@app/hooks/useProcessAttendanceResets';
import {useFirestoreSubscription} from '@app/hooks/useFirestoreSubscription';
import {useUserAttendanceDirectory} from '@app/hooks/useUserAttendanceDirectory';
import {useAuthStore} from '@app/stores/authStore';
import dayjs from 'dayjs';

export interface EmployeeHomeData {
  permissions: ReturnType<typeof resolveEmployeePermissions>;
  attendanceRecords: AttendanceRecord[];
  todayStatus: string;
  attendanceStats: ReturnType<typeof computeAttendanceStats>;
  balance: number;
  isLoading: boolean;
}

export function useEmployeeHomeData(
  user: AppUser | null | undefined,
  t: (key: string) => string,
): EmployeeHomeData {
  const enabled = user?.role === 'employee';
  const userId = user?.id ?? '';
  const liveProfile = useAuthStore((state) => (state.user?.id === userId ? state.user : user));

  const {records: attendanceRecords, isLoading: attendanceLoading} = useUserAttendanceDirectory(
    userId,
    enabled && Boolean(userId),
  );

  const profile = liveProfile ?? user;
  const permissions = useMemo(() => resolveEmployeePermissions(profile), [profile]);
  const showOwnFinance = permissions.finance;

  useProcessAttendanceResets(
    profile,
    attendanceRecords,
    enabled && Boolean(userId) && !attendanceLoading,
  );

  const {data: transactions, isLoading: transactionsLoading} = useFirestoreSubscription<Transaction[]>(
    [],
    (callback) => subscribeToUserTransactions(userId, callback),
    [userId],
    {enabled: enabled && showOwnFinance && Boolean(userId)},
  );

  const storedBalance = liveProfile?.balance ?? user?.balance ?? 0;

  const todayStatus = useMemo(
    () => getTodayAttendanceStatus(attendanceRecords, t),
    [attendanceRecords, t],
  );

  const attendanceStats = useMemo(() => {
    const periodStartIso = getCurrentPeriodStartIso(
      profile?.attendanceResetSchedule,
      profile?.attendanceLastResetBoundary,
      dayjs(),
    );
    const activeRecords = filterRecordsForCurrentPeriod(attendanceRecords, periodStartIso);
    const days = buildAttendanceDays(activeRecords, dayjs());
    return computeAttendanceStats(days);
  }, [attendanceRecords, profile?.attendanceLastResetBoundary, profile?.attendanceResetSchedule]);

  const balance = useMemo(
    () => resolveCashAccountBalance(storedBalance, transactions),
    [storedBalance, transactions],
  );

  const isLoading =
    enabled && (attendanceLoading || (showOwnFinance && transactionsLoading));

  return {
    permissions,
    attendanceRecords,
    todayStatus,
    attendanceStats,
    balance,
    isLoading,
  };
}
