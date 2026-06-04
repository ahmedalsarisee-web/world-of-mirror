import dayjs from 'dayjs';
import type {AppUser, AttendanceHoursResetSchedule, AttendanceRecord} from '@app/types/models';
import {buildAttendanceDays, computeAttendanceStats} from '@app/utils/attendanceReport';

function workRecords(records: AttendanceRecord[]): AttendanceRecord[] {
  return records.filter((record) => record.type === 'check_in' || record.type === 'check_out');
}

function resolveMonthlyDayInMonth(base: dayjs.Dayjs, monthlyDay: number): dayjs.Dayjs {
  const daysInMonth = base.daysInMonth();
  const day = Math.min(Math.max(monthlyDay, 1), daysInMonth);
  return base.date(day).endOf('day');
}

export function getWeeklyResetBoundaryOnOrAfter(
  from: dayjs.Dayjs,
  weeklyDay: number,
): dayjs.Dayjs {
  let cursor = from.startOf('day');
  for (let i = 0; i < 8; i += 1) {
    if (cursor.day() === weeklyDay && from.isBefore(cursor.endOf('day').add(1, 'millisecond'))) {
      return cursor.endOf('day');
    }
    cursor = cursor.add(1, 'day');
  }
  return cursor.endOf('day');
}

export function getMonthlyResetBoundaryOnOrAfter(
  from: dayjs.Dayjs,
  monthlyDay: number,
): dayjs.Dayjs {
  let cursor = from.startOf('month');
  for (let i = 0; i < 24; i += 1) {
    const boundary = resolveMonthlyDayInMonth(cursor, monthlyDay);
    if (!from.isAfter(boundary)) {
      return boundary;
    }
    cursor = cursor.add(1, 'month').startOf('month');
  }
  return resolveMonthlyDayInMonth(cursor, monthlyDay);
}

export function getNextResetBoundaryOnOrAfter(
  from: dayjs.Dayjs,
  schedule: AttendanceHoursResetSchedule,
): dayjs.Dayjs | null {
  if (schedule.type === 'none') {
    return null;
  }
  if (schedule.type === 'weekly' && schedule.weeklyDay !== undefined) {
    return getWeeklyResetBoundaryOnOrAfter(from, schedule.weeklyDay);
  }
  if (schedule.type === 'monthly' && schedule.monthlyDay !== undefined) {
    return getMonthlyResetBoundaryOnOrAfter(from, schedule.monthlyDay);
  }
  return null;
}

export function findLastResetBoundaryBefore(
  asOf: dayjs.Dayjs,
  schedule: AttendanceHoursResetSchedule,
): dayjs.Dayjs | null {
  if (schedule.type === 'none') {
    return null;
  }

  let searchFrom = asOf.subtract(2, 'year').startOf('day');
  let last: dayjs.Dayjs | null = null;

  for (let i = 0; i < 120; i += 1) {
    const boundary = getNextResetBoundaryOnOrAfter(searchFrom, schedule);
    if (!boundary || boundary.isAfter(asOf)) {
      break;
    }
    last = boundary;
    searchFrom = boundary.add(1, 'millisecond');
  }

  return last;
}

export function resolveResetPeriodAnchor(
  user: Pick<AppUser, 'createdAt' | 'attendanceResetScheduleUpdatedAt'> | null | undefined,
  records: AttendanceRecord[],
): dayjs.Dayjs {
  const candidates: number[] = [];

  if (user?.createdAt) {
    candidates.push(dayjs(user.createdAt).startOf('day').valueOf());
  }
  if (user?.attendanceResetScheduleUpdatedAt) {
    candidates.push(dayjs(user.attendanceResetScheduleUpdatedAt).startOf('day').valueOf());
  }

  const work = workRecords(records);
  if (work.length > 0) {
    const oldest = Math.min(...work.map((record) => dayjs(record.createdAt).valueOf()));
    candidates.push(dayjs(oldest).startOf('day').valueOf());
  }

  if (!candidates.length) {
    return dayjs().startOf('day');
  }

  return dayjs(Math.max(...candidates));
}

export function filterStaleResetRecords(
  records: AttendanceRecord[],
  periodAnchor: dayjs.Dayjs,
): AttendanceRecord[] {
  return records.filter((record) => {
    if (record.type !== 'hours_reset') {
      return true;
    }
    return !dayjs(record.createdAt).isBefore(periodAnchor);
  });
}

export function collectDueResetBoundaries(
  schedule: AttendanceHoursResetSchedule,
  lastResetBoundary: string | undefined,
  periodAnchor: dayjs.Dayjs,
  asOf: dayjs.Dayjs = dayjs(),
): dayjs.Dayjs[] {
  if (schedule.type === 'none') {
    return [];
  }

  const due: dayjs.Dayjs[] = [];
  let searchFrom = lastResetBoundary
    ? dayjs(lastResetBoundary).add(1, 'millisecond')
    : periodAnchor;

  if (searchFrom.isBefore(periodAnchor)) {
    searchFrom = periodAnchor;
  }

  for (let i = 0; i < 12; i += 1) {
    const boundary = getNextResetBoundaryOnOrAfter(searchFrom, schedule);
    if (!boundary || boundary.isAfter(asOf)) {
      break;
    }
    if (boundary.isBefore(periodAnchor)) {
      searchFrom = boundary.add(1, 'millisecond');
      continue;
    }
    due.push(boundary);
    searchFrom = boundary.add(1, 'millisecond');
  }

  return due;
}

export function getCurrentPeriodStartIso(
  schedule: AttendanceHoursResetSchedule | undefined,
  lastResetBoundary: string | undefined,
  asOf: dayjs.Dayjs = dayjs(),
): string | null {
  if (!schedule || schedule.type === 'none') {
    return null;
  }

  if (lastResetBoundary) {
    return dayjs(lastResetBoundary).add(1, 'day').startOf('day').toISOString();
  }

  const lastPast = findLastResetBoundaryBefore(asOf, schedule);
  if (!lastPast) {
    return null;
  }

  return lastPast.add(1, 'day').startOf('day').toISOString();
}

export function filterRecordsForCurrentPeriod(
  records: AttendanceRecord[],
  periodStartIso: string | null,
): AttendanceRecord[] {
  if (!periodStartIso) {
    return records;
  }

  return records.filter((record) => record.createdAt >= periodStartIso);
}

export function computePeriodTotalSeconds(
  records: AttendanceRecord[],
  periodStartExclusive: dayjs.Dayjs | null,
  periodEndInclusive: dayjs.Dayjs,
): number {
  const filtered = workRecords(records).filter((record) => {
    const timestamp = dayjs(record.createdAt);
    if (periodStartExclusive && !timestamp.isAfter(periodStartExclusive)) {
      return false;
    }
    return !timestamp.isAfter(periodEndInclusive);
  });

  return computeAttendanceStats(buildAttendanceDays(filtered, periodEndInclusive)).totalSeconds;
}

export function formatScheduleSummary(
  schedule: AttendanceHoursResetSchedule | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!schedule || schedule.type === 'none') {
    return t('attendanceResetScheduleNone');
  }

  if (schedule.type === 'weekly' && schedule.weeklyDay !== undefined) {
    return t('attendanceResetScheduleWeekly', {day: t(`weekday${schedule.weeklyDay}`)});
  }

  if (schedule.type === 'monthly' && schedule.monthlyDay !== undefined) {
    return t('attendanceResetScheduleMonthly', {day: schedule.monthlyDay});
  }

  return t('attendanceResetScheduleNone');
}
