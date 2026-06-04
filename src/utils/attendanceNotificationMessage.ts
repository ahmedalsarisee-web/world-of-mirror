import type {TFunction} from 'i18next';
import type {AttendanceRecord} from '@app/types/models';

export interface AttendanceNotificationContent {
  title: string;
  body: string;
  userId: string;
  recordId: string;
  type: 'check_in' | 'check_out';
}

export function buildAttendanceNotificationContent(
  record: AttendanceRecord,
  employeeName: string,
  t: TFunction,
): AttendanceNotificationContent {
  const note = record.note?.trim() ?? '';
  const isCheckIn = record.type === 'check_in';
  const body = note
    ? t(isCheckIn ? 'attendanceCheckInNotificationBodyWithNote' : 'attendanceCheckOutNotificationBodyWithNote', {
        employeeName,
        note,
      })
    : t(isCheckIn ? 'attendanceCheckInNotificationBody' : 'attendanceCheckOutNotificationBody', {employeeName});

  return {
    title: t(isCheckIn ? 'attendanceCheckInNotificationTitle' : 'attendanceCheckOutNotificationTitle'),
    body,
    userId: record.userId,
    recordId: record.id,
    type: record.type,
  };
}
