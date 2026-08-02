import {useCallback, useState} from 'react';
import {Alert, Linking} from 'react-native';
import {useTranslation} from 'react-i18next';
import {getAttendanceWorkplace, getAttendanceWorkplaceMapsUrl} from '@app/utils/attendanceWorkplace';
import {createAttendanceRecord} from '@app/services/attendance.service';
import type {AttendanceEventType} from '@app/types/models';
import {verifyCheckInLocationRequirements} from '@app/utils/attendanceLocation';

interface Options {
  userId: string | undefined;
  requireLocationCheck?: boolean;
  requireGpsLinked?: boolean;
}

export function useAttendanceLocationAction({
  userId,
  requireLocationCheck = false,
  requireGpsLinked = false,
}: Options) {
  const {t} = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);

  const showLocationError = useCallback(
    (
      reason: NonNullable<Awaited<ReturnType<typeof verifyCheckInLocationRequirements>>['reason']>,
      distanceMeters?: number,
    ) => {
      const workplace = getAttendanceWorkplace();

      switch (reason) {
        case 'permission_denied':
          Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationDeniedMessage'));
          break;
        case 'services_disabled':
          Alert.alert(t('attendanceLocationServicesTitle'), t('attendanceLocationServicesMessage'));
          break;
        case 'unavailable':
          Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationUnavailable'));
          break;
        case 'out_of_range':
          Alert.alert(
            t('attendanceLocationOutOfRangeTitle'),
            t('attendanceLocationOutOfRangeMessage', {
              distance: Math.round(distanceMeters ?? 0),
              radius: workplace.radiusMeters,
              name: workplace.name,
            }),
            [
              {text: t('cancel'), style: 'cancel'},
              {
                text: t('attendanceOpenWorkplaceMap'),
                onPress: () => {
                  void Linking.openURL(getAttendanceWorkplaceMapsUrl(workplace));
                },
              },
            ],
          );
          break;
      }
    },
    [t],
  );

  const handleAttendanceAction = useCallback(
    async (type: AttendanceEventType) => {
      if (!userId || type === 'hours_reset') {
        return;
      }

      setActionLoading(true);
      try {
        if (
          (type === 'check_in' || type === 'check_out') &&
          (requireLocationCheck || requireGpsLinked)
        ) {
          let locationCheck: Awaited<ReturnType<typeof verifyCheckInLocationRequirements>>;
          try {
            locationCheck = await verifyCheckInLocationRequirements({
              workplace: requireLocationCheck,
              gps: requireGpsLinked,
            });
          } catch {
            Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationUnavailable'));
            return;
          }

          if (!locationCheck.allowed) {
            showLocationError(locationCheck.reason ?? 'unavailable', locationCheck.distanceMeters);
            return;
          }
        }

        await createAttendanceRecord(userId, type);
      } catch {
        Alert.alert(t('error'), t('saveFailed'));
      } finally {
        setActionLoading(false);
      }
    },
    [requireGpsLinked, requireLocationCheck, showLocationError, t, userId],
  );

  return {handleAttendanceAction, actionLoading};
}
