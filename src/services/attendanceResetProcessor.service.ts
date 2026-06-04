import dayjs from 'dayjs';
import {
  createHoursResetRecord,
} from '@app/services/attendance.service';
import {
  setEmployeeAttendanceLastResetBoundary,
} from '@app/services/users.service';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import {formatAttendanceDuration} from '@app/utils/attendanceReport';
import {collectDueResetBoundaries, computePeriodTotalSeconds, resolveResetPeriodAnchor} from '@app/utils/attendanceSchedule';

export async function processDueAttendanceResets(
  user: AppUser,
  records: AttendanceRecord[],
  t: (key: string, options?: Record<string, unknown>) => string,
): Promise<void> {
  const schedule = user.attendanceResetSchedule;
  if (!schedule || schedule.type === 'none') {
    return;
  }

  const periodAnchor = resolveResetPeriodAnchor(user, records);
  const dueBoundaries = collectDueResetBoundaries(
    schedule,
    user.attendanceLastResetBoundary,
    periodAnchor,
    dayjs(),
  );

  if (!dueBoundaries.length) {
    return;
  }

  let previousBoundary = user.attendanceLastResetBoundary
    ? dayjs(user.attendanceLastResetBoundary)
    : null;

  for (const boundary of dueBoundaries) {
    const periodStartExclusive = previousBoundary;
    const resetTotalSeconds = computePeriodTotalSeconds(records, periodStartExclusive, boundary);
    const note = t('attendanceHoursResetNote', {
      hours: formatAttendanceDuration(resetTotalSeconds),
    });

    await createHoursResetRecord(user.id, boundary.toISOString(), resetTotalSeconds, note);
    await setEmployeeAttendanceLastResetBoundary(user.id, boundary.toISOString());
    previousBoundary = boundary;
  }
}
