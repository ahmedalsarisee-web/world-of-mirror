import {useEffect, useState} from 'react';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';

/** True while the employee has an open check-in today. */
export function useEmployeeCheckedInState(userId: string | undefined, enabled: boolean): boolean {
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    if (!enabled || !userId) {
      setCheckedIn(false);
      return;
    }

    return subscribeToUserAttendance(userId, (records) => {
      setCheckedIn(getEmployeePresenceStatus(records) === 'present');
    });
  }, [enabled, userId]);

  return checkedIn;
}
