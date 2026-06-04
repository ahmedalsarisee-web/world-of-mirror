import {createNavigationContainerRef} from '@react-navigation/native';
import type {RootStackParamList} from '@app/types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate(name: keyof RootStackParamList, params?: RootStackParamList[keyof RootStackParamList]) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params as any);
  }
}

export function resetRoot() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{name: 'Home'}],
    });
  }
}

export function getCurrentRoute() {
  return navigationRef.getCurrentRoute();
}
