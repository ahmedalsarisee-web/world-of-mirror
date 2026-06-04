import {useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {
  getAttendanceLocationPermissionState,
  requestAttendanceLocationPermission,
} from '@app/utils/attendancePermissions';

let sessionPermissionPrompted = false;

/** Single entry point for location permission — call once from MainTabNavigator only. */
export function useEmployeeAttendanceLocationSetup(enabled: boolean): void {
  const {t} = useTranslation();

  useEffect(() => {
    if (!enabled || isMockMode || sessionPermissionPrompted) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const state = await getAttendanceLocationPermissionState();
      if (cancelled || state === 'granted' || state === 'blocked') {
        return;
      }

      sessionPermissionPrompted = true;
      if (state === 'undetermined' || state === 'denied') {
        await requestAttendanceLocationPermission(t);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, t]);
}
