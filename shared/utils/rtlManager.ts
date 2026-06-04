import {DevSettings, I18nManager, Platform} from 'react-native';

export function applyRtlManager(isRTL: boolean): boolean {
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === isRTL) {
    return false;
  }
  I18nManager.forceRTL(isRTL);
  return true;
}

export function reloadAppForRtlChange(): void {
  if (Platform.OS === 'web') {
    return;
  }
  if (__DEV__ && DevSettings.reload) {
    DevSettings.reload();
  }
}
