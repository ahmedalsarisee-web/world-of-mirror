import {Platform} from 'react-native';
import Constants from 'expo-constants';
import {isMockMode} from '@app/config/appMode';
import {registerExpoPushToken, unregisterExpoPushToken} from '@app/services/users.service';
import {ensureNotificationPermissions, areNativeNotificationsSupported} from '@app/services/notifications.service';

type NotificationsModule = typeof import('expo-notifications');

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as {eas?: {projectId?: string}} | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!areNativeNotificationsSupported()) {
    return null;
  }

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function registerAdminPushNotifications(userId: string): Promise<void> {
  if (isMockMode || !areNativeNotificationsSupported()) {
    return;
  }

  const allowed = await ensureNotificationPermissions();
  if (!allowed) {
    return;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    console.warn(
      '[push] Missing EXPO_PUBLIC_EAS_PROJECT_ID — add it to .env and restart Expo for background push.',
    );
    return;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({projectId});
    await registerExpoPushToken(userId, tokenResponse.data);
  } catch (error) {
    console.warn('[push] Failed to register Expo push token', error);
  }
}

export async function unregisterAdminPushNotifications(userId: string): Promise<void> {
  if (isMockMode || !areNativeNotificationsSupported()) {
    return;
  }

  const projectId = resolveExpoProjectId();
  const Notifications = await loadNotificationsModule();
  if (!Notifications || !projectId) {
    return;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({projectId});
    await unregisterExpoPushToken(userId, tokenResponse.data);
  } catch {
    // Ignore logout cleanup failures.
  }
}
