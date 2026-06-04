import {useEffect} from 'react';
import {subscribeToAttendanceWorkplace} from '@app/services/attendanceWorkplace.service';
import {useAttendanceWorkplaceStore} from '@app/stores/attendanceWorkplaceStore';

export function useAttendanceWorkplaceSync(enabled = true): void {
  const setWorkplace = useAttendanceWorkplaceStore((s) => s.setWorkplace);
  const setLoaded = useAttendanceWorkplaceStore((s) => s.setLoaded);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const unsubscribe = subscribeToAttendanceWorkplace((workplace) => {
      setWorkplace(workplace);
      setLoaded(true);
    });

    return unsubscribe;
  }, [enabled, setLoaded, setWorkplace]);
}
