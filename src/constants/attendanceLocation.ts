import type {AttendanceWorkplace} from '@app/types/models';

/** Default workplace until an admin saves a location in settings. */
export const DEFAULT_ATTENDANCE_WORKPLACE: AttendanceWorkplace = {
  name: 'World of Mirrors',
  latitude: 32.0173981,
  longitude: 35.8487115,
  radiusMeters: 120,
};

/** @deprecated Use getAttendanceWorkplace() — kept for gradual migration. */
export const ATTENDANCE_WORKPLACE = DEFAULT_ATTENDANCE_WORKPLACE;

export function buildAttendanceWorkplaceMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
