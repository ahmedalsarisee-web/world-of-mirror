import {useEffect, useMemo, useState} from 'react';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import {subscribeToUserTransactions} from '@app/services/transactions.service';
import {subscribeToUser} from '@app/services/users.service';
import type {AppUser, AttendanceRecord, Transaction} from '@app/types/models';
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

  const {data: attendanceRecords, isLoading: attendanceLoading} = useFirestoreSubscription<
    AttendanceRecord[]
  >([], (callback) => subscribeToUserAttendance(userId, callback), [userId], {enabled: enabled && Boolean(userId)});

  const {data: liveProfile, isLoading: profileLoading} = useFirestoreSubscription<AppUser | null>(
    null,
    (callback) => subscribeToUser(userId, callback),
    [userId],
    {enabled: enabled && Boolean(userId),
  });

  const profile = liveProfile ?? user;
  const permissions = useMemo(() => resolveEmployeePermissions(profile), [profile]);
  const showFinance = permissions.finance;

  useProcessAttendanceResets(
    profile,
    attendanceRecords,
    enabled && Boolean(userId) && !attendanceLoading && !profileLoading,
  );

  const {data: transactions, isLoading: transactionsLoading} = useFirestoreSubscription<Transaction[]>(
    [],
    (callback) => subscribeToUserTransactions(userId, callback),
    [userId],
    {enabled: enabled && showFinance && Boolean(userId)},
  );

  const [storedBalance, setStoredBalance] = useState(0);

  useEffect(() => {
    if (!enabled || !showFinance || !userId) {
      setStoredBalance(0);
      return;
    }

    return subscribeToUser(userId, (profile) => setStoredBalance(profile?.balance ?? 0));
  }, [enabled, showFinance, userId]);

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
    enabled &&
    (attendanceLoading || profileLoading || (showFinance && transactionsLoading));

  return {
    permissions,
    attendanceRecords,
    todayStatus,
    attendanceStats,
    balance,
    isLoading,
  };
}
