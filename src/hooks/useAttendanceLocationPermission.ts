import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {
  getAttendanceLocationPermissionState,
  requestAttendanceLocationPermission,
  type AttendanceLocationPermissionState,
} from '@app/utils/attendancePermissions';

interface Result {
  state: AttendanceLocationPermissionState;
  granted: boolean;
  refresh: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function useAttendanceLocationPermission(enabled: boolean): Result {
  const {t} = useTranslation();
  const [state, setState] = useState<AttendanceLocationPermissionState>(
    enabled && !isMockMode ? 'undetermined' : 'granted',
  );

  const refresh = useCallback(async () => {
    if (!enabled || isMockMode) {
      setState('granted');
      return;
    }

    setState(await getAttendanceLocationPermissionState());
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    if (!enabled || isMockMode) {
      return true;
    }

    const granted = await requestAttendanceLocationPermission(t);
    await refresh();
    return granted;
  }, [enabled, refresh, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || isMockMode) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [enabled, refresh]);

  return {
    state,
    granted: state === 'granted',
    refresh,
    requestPermission,
  };
}
