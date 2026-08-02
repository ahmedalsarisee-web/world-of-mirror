import dayjs from 'dayjs';
import type {AttendanceEventType, AttendanceRecord} from '@app/types/models';

export interface AttendanceSession {
  checkIn?: AttendanceRecord;
  checkOut?: AttendanceRecord;
  durationSeconds?: number;
}

export interface AttendanceDaySummary {
  dateKey: string;
  records: AttendanceRecord[];
  sessions: AttendanceSession[];
  totalDurationSeconds: number;
  isOpen: boolean;
}

function createEmptyAttendanceDay(dateKey: string): AttendanceDaySummary {
  return {
    dateKey,
    records: [],
    sessions: [],
    totalDurationSeconds: 0,
    isOpen: false,
  };
}

export interface AttendanceStats {
  daysWithCheckIn: number;
  completedSessions: number;
  totalSeconds: number;
}

function sessionDurationSeconds(checkIn: AttendanceRecord, checkOut: AttendanceRecord): number {
  return Math.max(0, dayjs(checkOut.createdAt).diff(dayjs(checkIn.createdAt), 'second'));
}

function pairAttendanceSessions(sortedRecords: AttendanceRecord[]): AttendanceSession[] {
  const sessions: AttendanceSession[] = [];
  let pendingCheckIn: AttendanceRecord | undefined;

  for (const record of sortedRecords) {
    if (record.type === 'hours_reset' || record.type === 'absent') {
      continue;
    }

    if (record.type === 'check_in') {
      if (pendingCheckIn) {
        sessions.push({checkIn: pendingCheckIn});
      }
      pendingCheckIn = record;
      continue;
    }

    if (pendingCheckIn) {
      sessions.push({
        checkIn: pendingCheckIn,
        checkOut: record,
        durationSeconds: sessionDurationSeconds(pendingCheckIn, record),
      });
      pendingCheckIn = undefined;
      continue;
    }

    sessions.push({checkOut: record});
  }

  if (pendingCheckIn) {
    sessions.push({checkIn: pendingCheckIn});
  }

  return sessions;
}

export function buildAttendanceDays(
  records: AttendanceRecord[],
  asOf: dayjs.Dayjs = dayjs(),
  options?: {includeLiveDuration?: boolean},
): AttendanceDaySummary[] {
  const includeLiveDuration = options?.includeLiveDuration !== false;
  const byDay = new Map<string, AttendanceRecord[]>();

  for (const record of records) {
    const dateKey = dayjs(record.createdAt).format('YYYY-MM-DD');
    const dayRecords = byDay.get(dateKey) ?? [];
    dayRecords.push(record);
    byDay.set(dateKey, dayRecords);
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, dayRecords]) => {
      const sorted = [...dayRecords].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const sessions = pairAttendanceSessions(sorted);
      let totalDurationSeconds = sessions.reduce(
        (sum, session) => sum + (session.durationSeconds ?? 0),
        0,
      );
      const lastRecord = sorted[sorted.length - 1];
      const isOpen = lastRecord?.type === 'check_in' && !sorted.some((record) => record.type === 'absent');

      if (includeLiveDuration && isOpen && lastRecord && dateKey === asOf.format('YYYY-MM-DD')) {
        totalDurationSeconds += Math.max(0, asOf.diff(dayjs(lastRecord.createdAt), 'second'));
      }

      return {
        dateKey,
        records: sorted,
        sessions,
        totalDurationSeconds,
        isOpen,
      };
    });
}

export function computeAttendanceStats(days: AttendanceDaySummary[]): AttendanceStats {
  return {
    daysWithCheckIn: days.filter((day) => day.records.some((record) => record.type === 'check_in')).length,
    completedSessions: days.reduce(
      (sum, day) => sum + day.sessions.filter((session) => session.checkIn && session.checkOut).length,
      0,
    ),
    totalSeconds: days.reduce((sum, day) => sum + day.totalDurationSeconds, 0),
  };
}

export function getNextAttendanceAction(records: AttendanceRecord[]): AttendanceEventType {
  const todayKey = dayjs().format('YYYY-MM-DD');
  const todayRecords = records
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === todayKey,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!todayRecords.length || todayRecords[0].type === 'check_out') {
    return 'check_in';
  }

  return 'check_out';
}

export function formatAttendanceDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return '0m';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 && (hours === 0 || minutes === 0)) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
}

export function getEmployeePresenceStatus(records: AttendanceRecord[]): 'present' | 'away' {
  const todayKey = dayjs().format('YYYY-MM-DD');
  const todayRecords = records
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === todayKey,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!todayRecords.length || todayRecords[0].type === 'check_out') {
    return 'away';
  }

  return 'present';
}

export function getTodayAttendanceStatus(
  records: AttendanceRecord[],
  t: (key: string) => string,
): string {
  const todayKey = dayjs().format('YYYY-MM-DD');
  const todayRecords = records
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === todayKey,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!todayRecords.length) {
    return t('attendanceNotCheckedInToday');
  }

  return todayRecords[0].type === 'check_in' ? t('attendanceCheckedIn') : t('attendanceCheckedOut');
}

export function hasOpenAttendanceToday(records: AttendanceRecord[]): boolean {
  const todayKey = dayjs().format('YYYY-MM-DD');
  const todayRecords = records
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === todayKey,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return todayRecords[0]?.type === 'check_in';
}

export function getTodayAttendanceDay(
  records: AttendanceRecord[],
  asOf: dayjs.Dayjs = dayjs(),
): AttendanceDaySummary | null {
  const todayKey = asOf.format('YYYY-MM-DD');
  const days = buildAttendanceDays(records, asOf, {includeLiveDuration: false});
  return days.find((day) => day.dateKey === todayKey) ?? null;
}

/** Elapsed seconds for today's open check-in (0 if not currently checked in). */
export function getOpenSessionElapsedSeconds(
  records: AttendanceRecord[],
  asOf: dayjs.Dayjs = dayjs(),
): number {
  const todayKey = asOf.format('YYYY-MM-DD');
  const todayRecords = records
    .filter(
      (record) =>
        (record.type === 'check_in' || record.type === 'check_out') &&
        dayjs(record.createdAt).format('YYYY-MM-DD') === todayKey,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const latest = todayRecords[0];
  if (!latest || latest.type !== 'check_in') {
    return 0;
  }

  return Math.max(0, asOf.diff(dayjs(latest.createdAt), 'second'));
}

export function splitAttendanceDateTime(iso: string): {date: string; time: string} {
  const value = dayjs(iso);
  return {
    date: value.format('YYYY-MM-DD'),
    time: value.format('HH:mm'),
  };
}

export function combineAttendanceDateTime(date: string, time: string): string {
  const parsed = dayjs(`${date}T${time}:00`);
  if (!parsed.isValid()) {
    throw new Error('attendanceRecordInvalidDateTime');
  }
  return parsed.toISOString();
}

export function attendanceResetSecondsToHours(resetTotalSeconds?: number): number {
  if (resetTotalSeconds === undefined) {
    return 0;
  }
  return Math.round((resetTotalSeconds / 3600) * 100) / 100;
}

export function extractDaySessionRecords(day: AttendanceDaySummary): {
  checkIn?: AttendanceRecord;
  checkOut?: AttendanceRecord;
} {
  const workRecords = day.records.filter(
    (record) => record.type === 'check_in' || record.type === 'check_out',
  );
  const checkIn = workRecords.find((record) => record.type === 'check_in');
  const checkOut = [...workRecords].reverse().find((record) => record.type === 'check_out');
  return {checkIn, checkOut};
}

export function computeDaySessionDurationSeconds(
  dateKey: string,
  checkInTime: string,
  checkOutTime: string,
): number {
  if (!/^\d{2}:\d{2}$/.test(checkInTime) || !/^\d{2}:\d{2}$/.test(checkOutTime)) {
    return 0;
  }

  const checkIn = dayjs(`${dateKey}T${checkInTime}:00`);
  const checkOut = dayjs(`${dateKey}T${checkOutTime}:00`);
  if (!checkIn.isValid() || !checkOut.isValid() || !checkOut.isAfter(checkIn)) {
    return 0;
  }

  return checkOut.diff(checkIn, 'second');
}

export function dayHasWorkRecords(day: AttendanceDaySummary): boolean {
  return day.records.some((record) => record.type === 'check_in' || record.type === 'check_out');
}

export function dayHasAttendanceActivity(day: AttendanceDaySummary): boolean {
  return day.records.some(
    (record) => record.type === 'check_in' || record.type === 'check_out' || record.type === 'absent',
  );
}

export function expandAttendanceDaysForPeriod(
  days: AttendanceDaySummary[],
  periodStartIso: string | null | undefined,
  asOf: dayjs.Dayjs = dayjs(),
): AttendanceDaySummary[] {
  const today = asOf.startOf('day');
  let periodStart = today;

  if (periodStartIso) {
    periodStart = dayjs(periodStartIso).startOf('day');
  } else if (days.length > 0) {
    periodStart = dayjs(days[days.length - 1].dateKey).startOf('day');
  }

  if (periodStart.isAfter(today)) {
    periodStart = today;
  }

  const dayMap = new Map(days.map((day) => [day.dateKey, day]));
  const expanded: AttendanceDaySummary[] = [];
  let cursor = periodStart;

  while (!cursor.isAfter(today)) {
    const dateKey = cursor.format('YYYY-MM-DD');
    expanded.push(dayMap.get(dateKey) ?? createEmptyAttendanceDay(dateKey));
    cursor = cursor.add(1, 'day');
  }

  return expanded.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function dayIsAbsent(day: AttendanceDaySummary): boolean {
  return day.records.some((record) => record.type === 'absent');
}

export function dayIsManageable(day: AttendanceDaySummary): boolean {
  return dayHasWorkRecords(day) || dayIsAbsent(day) || !dayHasAttendanceActivity(day);
}

export function extractAbsentDayRecord(day: AttendanceDaySummary): AttendanceRecord | undefined {
  return day.records.find((record) => record.type === 'absent');
}
