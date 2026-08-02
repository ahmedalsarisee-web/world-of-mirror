export const ATTENDANCE_SHIFT_HOURS_MIN = 0.5;
export const ATTENDANCE_SHIFT_HOURS_MAX = 24;

export function normalizeAttendanceShiftHours(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) {
    return undefined;
  }
  return Math.round(hours * 100) / 100;
}

export function parseAttendanceShiftHoursInput(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(/,/g, '.'));
  if (!Number.isFinite(parsed) || parsed < ATTENDANCE_SHIFT_HOURS_MIN || parsed > ATTENDANCE_SHIFT_HOURS_MAX) {
    return 'invalid';
  }

  return Math.round(parsed * 100) / 100;
}

export function formatAttendanceShiftHoursValue(hours: number | undefined): string {
  if (hours === undefined || hours <= 0) {
    return '';
  }
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/\.?0+$/, '');
}

export function attendanceShiftHoursToSeconds(hours: number | undefined): number {
  if (hours === undefined || hours <= 0) {
    return 0;
  }
  return Math.round(hours * 3600);
}

export function formatAttendanceShiftHoursSummary(
  hours: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (hours === undefined || hours <= 0) {
    return t('attendanceShiftHoursUnset');
  }

  return t('attendanceShiftHoursSummary', {hours: formatAttendanceShiftHoursValue(hours)});
}
