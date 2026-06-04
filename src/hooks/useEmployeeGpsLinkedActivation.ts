import {useEffect, useRef} from 'react';
import {Alert, Linking} from 'react-native';
import * as Location from 'expo-location';
import {useTranslation} from 'react-i18next';
import {isMockMode} from '@app/config/appMode';
import {requiresAttendanceGpsLinked} from '@app/utils/employeePermissions';
import type {AppUser} from '@app/types/models';

export function useEmployeeGpsLinkedActivation(user: AppUser | null | undefined): void {
  const {t} = useTranslation();
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (user?.role !== 'employee' || !requiresAttendanceGpsLinked(user)) {
      wasActiveRef.current = false;
      return;
    }

    if (wasActiveRef.current) {
      return;
    }
    wasActiveRef.current = true;

    void (async () => {
      if (isMockMode) {
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          t('attendanceGpsLinkedServicesTitle'),
          t('attendanceGpsLinkedServicesMessage'),
          [
            {text: t('cancel'), style: 'cancel'},
            {
              text: t('openSettings'),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('attendanceLocationDeniedTitle'),
          t('attendanceGpsLinkedPermissionMessage'),
          [
            {text: t('cancel'), style: 'cancel'},
            {
              text: t('openSettings'),
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
      }
    })();
  }, [t, user?.id, user?.permissions?.attendanceGpsLinked, user?.role]);
}
