import {useEffect, useRef} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {useTranslation} from 'react-i18next';
import {createAttendanceRecord, subscribeToUserAttendance} from '@app/services/attendance.service';
import {subscribeToUser} from '@app/services/users.service';
import type {AttendanceRecord} from '@app/types/models';
import {
  attendanceShiftHoursToSeconds,
  formatAttendanceShiftHoursValue,
} from '@app/utils/attendanceShiftHours';
import {getEmployeePresenceStatus, getOpenSessionElapsedSeconds} from '@app/utils/attendanceReport';

const AFTER_CHECK_IN_GRACE_MS = 3_000;

interface Options {
  userId: string | undefined;
  enabled: boolean;
}

export function useAttendanceShiftHoursEnforcement({userId, enabled}: Options) {
  const {t} = useTranslation();
  const recordsRef = useRef<AttendanceRecord[]>([]);
  const shiftHoursRef = useRef<number | undefined>(undefined);
  const checkoutPendingRef = useRef(false);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const becamePresentAtRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    let cancelled = false;

    const clearScheduledCheckout = () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };

    const isPresent = () => getEmployeePresenceStatus(recordsRef.current) === 'present';

    const isInCheckInGrace = () => {
      if (!becamePresentAtRef.current) {
        return false;
      }
      return Date.now() - becamePresentAtRef.current < AFTER_CHECK_IN_GRACE_MS;
    };

    const performAutoCheckOut = async () => {
      if (cancelled || checkoutPendingRef.current || !isPresent()) {
        return;
      }

      const shiftHours = shiftHoursRef.current;
      if (!shiftHours) {
        return;
      }

      checkoutPendingRef.current = true;
      try {
        await createAttendanceRecord(
          userId,
          'check_out',
          t('attendanceShiftHoursAutoCheckOutNote', {
            hours: formatAttendanceShiftHoursValue(shiftHours),
          }),
        );
      } catch {
        scheduleAutoCheckout();
      } finally {
        checkoutPendingRef.current = false;
      }
    };

    const scheduleAutoCheckout = () => {
      clearScheduledCheckout();

      const shiftHours = shiftHoursRef.current;
      if (!shiftHours || !isPresent() || isInCheckInGrace()) {
        return;
      }

      const limitSeconds = attendanceShiftHoursToSeconds(shiftHours);
      const elapsedSeconds = getOpenSessionElapsedSeconds(recordsRef.current);
      const remainingSeconds = limitSeconds - elapsedSeconds;

      if (remainingSeconds <= 0) {
        void performAutoCheckOut();
        return;
      }

      const delayMs =
        appStateRef.current === 'active' ? remainingSeconds * 1000 : Math.min(remainingSeconds * 1000, 60_000);

      timeoutIdRef.current = setTimeout(() => {
        void performAutoCheckOut();
      }, delayMs);
    };

    const unsubUser = subscribeToUser(userId, (user) => {
      const hours = user?.attendanceShiftHours;
      shiftHoursRef.current = hours && hours > 0 ? hours : undefined;
      scheduleAutoCheckout();
    });

    const unsubAttendance = subscribeToUserAttendance(userId, (records) => {
      const wasPresent = isPresent();
      recordsRef.current = records;
      const nowPresent = isPresent();

      if (nowPresent && !wasPresent) {
        becamePresentAtRef.current = Date.now();
      }
      if (!nowPresent) {
        becamePresentAtRef.current = null;
        clearScheduledCheckout();
        return;
      }

      scheduleAutoCheckout();
    });

    const handleAppState = (state: AppStateStatus) => {
      appStateRef.current = state;
      scheduleAutoCheckout();
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppState);

    return () => {
      cancelled = true;
      clearScheduledCheckout();
      unsubUser();
      unsubAttendance();
      appStateSubscription.remove();
    };
  }, [enabled, t, userId]);
}
