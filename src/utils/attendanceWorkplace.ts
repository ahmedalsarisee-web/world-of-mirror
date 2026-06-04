import {
  DEFAULT_ATTENDANCE_WORKPLACE,
  buildAttendanceWorkplaceMapsUrl,
} from '@app/constants/attendanceLocation';
import {useAttendanceWorkplaceStore} from '@app/stores/attendanceWorkplaceStore';
import type {AttendanceWorkplace} from '@app/types/models';

function isValidWorkplace(workplace: AttendanceWorkplace): boolean {
  return (
    Number.isFinite(workplace.latitude) &&
    Number.isFinite(workplace.longitude) &&
    Number.isFinite(workplace.radiusMeters) &&
    workplace.latitude >= -90 &&
    workplace.latitude <= 90 &&
    workplace.longitude >= -180 &&
    workplace.longitude <= 180 &&
    workplace.radiusMeters > 0
  );
}

export function getAttendanceWorkplace(): AttendanceWorkplace {
  const workplace = useAttendanceWorkplaceStore.getState().workplace ?? DEFAULT_ATTENDANCE_WORKPLACE;
  return isValidWorkplace(workplace) ? workplace : DEFAULT_ATTENDANCE_WORKPLACE;
}

export function getAttendanceWorkplaceMapsUrl(workplace?: AttendanceWorkplace): string {
  const target = workplace ?? getAttendanceWorkplace();
  return buildAttendanceWorkplaceMapsUrl(target.latitude, target.longitude);
}
