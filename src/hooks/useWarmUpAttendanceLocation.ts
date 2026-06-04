import {useEffect, useRef} from 'react';
import * as Location from 'expo-location';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {requestAttendanceLocationPermission} from '@app/utils/attendancePermissions';

/**
 * Prefetch location permission and a cached fix so the first check-in is faster.
 */
export function useWarmUpAttendanceLocation(enabled: boolean, autoRequestPermission = true): void {
  const {t} = useTranslation();
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || isMockMode) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled || cancelled) {
          return;
        }

        let permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' && autoRequestPermission && !requestedRef.current) {
          requestedRef.current = true;
          const granted = await requestAttendanceLocationPermission(t);
          if (!granted || cancelled) {
            return;
          }
          permission = await Location.getForegroundPermissionsAsync();
        }

        if (permission.status !== 'granted' || cancelled) {
          return;
        }

        await Location.getLastKnownPositionAsync({maxAge: 120_000});
      } catch {
        // Warm-up is best-effort only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoRequestPermission, enabled, t]);
}
