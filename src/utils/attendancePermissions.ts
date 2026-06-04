import {Alert, Linking} from 'react-native';
import * as Location from 'expo-location';
import type {TFunction} from 'i18next';

export type AttendanceLocationPermissionState = 'granted' | 'denied' | 'undetermined' | 'blocked';

export async function getAttendanceLocationPermissionState(): Promise<AttendanceLocationPermissionState> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status === 'granted') {
    return 'granted';
  }
  if (permission.status === 'undetermined') {
    return 'undetermined';
  }
  if (permission.canAskAgain === false) {
    return 'blocked';
  }
  return 'denied';
}

function showOpenSettingsAlert(t: TFunction): void {
  Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationDeniedMessage'), [
    {text: t('cancel'), style: 'cancel'},
    {
      text: t('openSettings'),
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

/**
 * Shows a short rationale, then the system location permission dialog.
 */
export async function requestAttendanceLocationPermission(t: TFunction): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }

  if (current.canAskAgain === false) {
    showOpenSettingsAlert(t);
    return false;
  }

  if (current.status === 'undetermined') {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('attendanceLocationPermissionPromptTitle'),
        t('attendanceLocationPermissionPromptMessage'),
        [
          {text: t('cancel'), style: 'cancel', onPress: () => resolve(false)},
          {
            text: t('attendanceLocationPermissionAllow'),
            onPress: () => resolve(true),
          },
        ],
      );
    });
    if (!proceed) {
      return false;
    }
  }

  const result = await Location.requestForegroundPermissionsAsync();
  if (result.status === 'granted') {
    return true;
  }

  if (result.canAskAgain === false) {
    showOpenSettingsAlert(t);
  } else {
    Alert.alert(t('attendanceLocationDeniedTitle'), t('attendanceLocationDeniedMessage'));
  }

  return false;
}
