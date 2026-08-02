import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import * as Location from 'expo-location';
import {
  clearAttendanceGpsHeartbeat,
  publishAttendanceGpsHeartbeat,
} from '@app/services/attendanceGps.service';
import {subscribeToUserAttendance} from '@app/services/attendance.service';
import type {AttendanceRecord} from '@app/types/models';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {readCurrentPositionSafe} from '@app/utils/locationCoordinator';

const FOREGROUND_POLL_MS = 45_000;
const BACKGROUND_POLL_MS = 90_000;

interface Options {
  userId: string | undefined;
  enabled: boolean;
}

async function ensureLocationServicesAndPermission(): Promise<boolean> {
  const providerStatus = await Location.getProviderStatusAsync();
  if (!providerStatus.locationServicesEnabled) {
    return false;
  }

  const permission = await Location.getForegroundPermissionsAsync();
  return permission.status === 'granted';
}

export function useAttendanceGpsEnforcement({userId, enabled}: Options) {
  const recordsRef = useRef<AttendanceRecord[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    let cancelled = false;

    const isPresent = () => getEmployeePresenceStatus(recordsRef.current) === 'present';

    const clearPoll = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    const publishHeartbeatIfPresent = async () => {
      if (cancelled || !isPresent()) {
        if (!isPresent()) {
          void clearAttendanceGpsHeartbeat(userId);
        }
        return;
      }

      const locationAllowed = await ensureLocationServicesAndPermission();
      if (!locationAllowed) {
        return;
      }

      const position = await readCurrentPositionSafe();
      if (!position || cancelled) {
        return;
      }

      await publishAttendanceGpsHeartbeat(userId);
    };

    const schedulePoll = () => {
      clearPoll();
      const intervalMs =
        appStateRef.current === 'active' ? FOREGROUND_POLL_MS : BACKGROUND_POLL_MS;
      void publishHeartbeatIfPresent();
      intervalIdRef.current = setInterval(() => {
        void publishHeartbeatIfPresent();
      }, intervalMs);
    };

    const handleAppState = (state: AppStateStatus) => {
      appStateRef.current = state;
      schedulePoll();
    };

    const unsubAttendance = subscribeToUserAttendance(userId, (records) => {
      recordsRef.current = records;
      if (!isPresent()) {
        void clearAttendanceGpsHeartbeat(userId);
      }
    });

    schedulePoll();
    const appStateSubscription = AppState.addEventListener('change', handleAppState);

    return () => {
      cancelled = true;
      clearPoll();
      unsubAttendance();
      appStateSubscription.remove();
      void clearAttendanceGpsHeartbeat(userId);
    };
  }, [enabled, userId]);
}
