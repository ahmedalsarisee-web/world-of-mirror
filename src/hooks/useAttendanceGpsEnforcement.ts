import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import * as Location from 'expo-location';
import {useTranslation} from 'react-i18next';
import {
  clearAttendanceGpsHeartbeat,
  publishAttendanceGpsHeartbeat,
} from '@app/services/attendanceGps.service';
import {createAttendanceRecord, subscribeToUserAttendance} from '@app/services/attendance.service';
import type {AttendanceRecord} from '@app/types/models';
import {getEmployeePresenceStatus} from '@app/utils/attendanceReport';
import {readCurrentPositionSafe} from '@app/utils/locationCoordinator';

const FOREGROUND_POLL_MS = 45_000;
const BACKGROUND_POLL_MS = 90_000;
const STARTUP_GRACE_MS = 12_000;
const AFTER_CHECK_IN_GRACE_MS = 5_000;

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
  const {t} = useTranslation();
  const recordsRef = useRef<AttendanceRecord[]>([]);
  const checkoutPendingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const startedAtRef = useRef(Date.now());
  const becamePresentAtRef = useRef<number | null>(null);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    let cancelled = false;
    startedAtRef.current = Date.now();
    becamePresentAtRef.current = null;

    const isPresent = () => getEmployeePresenceStatus(recordsRef.current) === 'present';

    const isInStartupGrace = () => Date.now() - startedAtRef.current < STARTUP_GRACE_MS;
    const isInCheckInGrace = () => {
      if (!becamePresentAtRef.current) {
        return false;
      }
      return Date.now() - becamePresentAtRef.current < AFTER_CHECK_IN_GRACE_MS;
    };

    const clearPoll = () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };

    const performAutoCheckOut = async () => {
      if (cancelled || checkoutPendingRef.current || !isPresent()) {
        return;
      }

      checkoutPendingRef.current = true;
      try {
        await createAttendanceRecord(userId, 'check_out', t('attendanceGpsAutoCheckOutNote'));
        await clearAttendanceGpsHeartbeat(userId);
      } catch {
        // Retry on next poll.
      } finally {
        checkoutPendingRef.current = false;
      }
    };

    const autoCheckOutIfNeeded = async () => {
      if (cancelled || checkoutPendingRef.current || !isPresent()) {
        if (!isPresent()) {
          becamePresentAtRef.current = null;
          void clearAttendanceGpsHeartbeat(userId);
        }
        return;
      }

      if (isInStartupGrace() || isInCheckInGrace()) {
        return;
      }

      const locationAllowed = await ensureLocationServicesAndPermission();
      if (!locationAllowed) {
        await performAutoCheckOut();
        return;
      }

      const position = await readCurrentPositionSafe();
      if (!position) {
        await performAutoCheckOut();
        return;
      }

      if (!cancelled) {
        await publishAttendanceGpsHeartbeat(userId);
      }
    };

    const schedulePoll = () => {
      clearPoll();
      const intervalMs =
        appStateRef.current === 'active' ? FOREGROUND_POLL_MS : BACKGROUND_POLL_MS;
      void autoCheckOutIfNeeded();
      intervalIdRef.current = setInterval(() => {
        void autoCheckOutIfNeeded();
      }, intervalMs);
    };

    const handleAppState = (state: AppStateStatus) => {
      appStateRef.current = state;
      schedulePoll();
    };

    const unsubAttendance = subscribeToUserAttendance(userId, (records) => {
      const wasPresent = isPresent();
      recordsRef.current = records;
      const nowPresent = isPresent();

      if (nowPresent && !wasPresent) {
        becamePresentAtRef.current = Date.now();
      }
      if (!nowPresent) {
        becamePresentAtRef.current = null;
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
  }, [enabled, t, userId]);
}
