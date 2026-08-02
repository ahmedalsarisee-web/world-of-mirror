import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {useUserAttendanceDirectory} from '@app/hooks/useUserAttendanceDirectory';

/** True while the employee has an open check-in today. */
export function useEmployeeCheckedInState(userId: string | undefined, enabled: boolean): boolean {
  const {records} = useUserAttendanceDirectory(userId ?? '', enabled && Boolean(userId));
  return getEmployeePresenceStatus(records) === 'present';
}
