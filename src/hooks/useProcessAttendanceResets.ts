import {useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import {processDueAttendanceResets} from '@app/services/attendanceResetProcessor.service';
import type {AppUser, AttendanceRecord} from '@app/types/models';
import {collectDueResetBoundaries, resolveResetPeriodAnchor} from '@app/utils/attendanceSchedule';

export function useProcessAttendanceResets(
  user: AppUser | null | undefined,
  records: AttendanceRecord[],
  enabled: boolean,
): void {
  const {t} = useTranslation();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !user || user.role !== 'employee') {
      return;
    }

    const schedule = user.attendanceResetSchedule;
    if (!schedule || schedule.type === 'none') {
      return;
    }

    const periodAnchor = resolveResetPeriodAnchor(user, records);
    const dueBoundaries = collectDueResetBoundaries(
      schedule,
      user.attendanceLastResetBoundary,
      periodAnchor,
      dayjs(),
    );

    if (!dueBoundaries.length || processingRef.current) {
      return;
    }

    processingRef.current = true;
    void processDueAttendanceResets(user, records, t)
      .catch((error) => {
        console.error('[useProcessAttendanceResets]', error);
      })
      .finally(() => {
        processingRef.current = false;
      });
  }, [
    enabled,
    records,
    t,
    user,
    user?.attendanceLastResetBoundary,
    user?.attendanceResetSchedule,
    user?.id,
  ]);
}
