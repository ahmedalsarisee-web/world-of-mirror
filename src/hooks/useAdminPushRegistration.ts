import {useEffect} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {isMockMode} from '@app/config/appMode';
import {registerAdminPushNotifications, unregisterAdminPushNotifications} from '@app/services/pushNotifications.service';

export function useAdminPushRegistration(userId: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !userId || isMockMode) {
      return;
    }

    void registerAdminPushNotifications(userId).catch((error) => {
      console.warn('[useAdminPushRegistration] failed', error);
    });

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void registerAdminPushNotifications(userId).catch(() => undefined);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      void unregisterAdminPushNotifications(userId).catch(() => undefined);
    };
  }, [enabled, userId]);
}
