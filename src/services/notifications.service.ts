import {Platform} from 'react-native';
import Constants from 'expo-constants';
import type {TFunction} from 'i18next';
import type {AttendanceRecord, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {showAdminInAppNotification, type AdminNotificationKind} from '@app/stores/adminNotificationStore';
import {buildAttendanceNotificationContent} from '@app/utils/attendanceNotificationMessage';
import {buildConfirmedOrderNotificationContent} from '@app/utils/confirmedOrderNotificationMessage';
import {buildFinanceNotificationContent} from '@app/utils/financeNotificationMessage';

export const FINANCE_CHANNEL_ID = 'finance-transactions';
export const ATTENDANCE_CHANNEL_ID = 'attendance-events';
export const CONFIRMED_ORDERS_CHANNEL_ID = 'confirmed-orders';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;
let nativeUnavailable = isNativeNotificationsBlocked();

function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

function isNativeNotificationsBlocked(): boolean {
  if (Platform.OS === 'web') {
    return true;
  }
  if (isExpoGoAndroid()) {
    return true;
  }
  return false;
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (nativeUnavailable) {
    return null;
  }

  if (notificationsModule) {
    return notificationsModule;
  }

  if (notificationsModule === null) {
    return null;
  }

  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch (error) {
    nativeUnavailable = true;
    notificationsModule = null;
    console.warn('[notifications] Native notifications unavailable', error);
    return null;
  }
}

async function configureNotificationHandler(Notifications: NotificationsModule): Promise<void> {
  if (handlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  handlerConfigured = true;
}

async function ensureAndroidChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Promise.all([
    Notifications.setNotificationChannelAsync(FINANCE_CHANNEL_ID, {
      name: 'Finance',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C4DFF',
    }),
    Notifications.setNotificationChannelAsync(ATTENDANCE_CHANNEL_ID, {
      name: 'Attendance',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#6C4DFF',
    }),
    Notifications.setNotificationChannelAsync(CONFIRMED_ORDERS_CHANNEL_ID, {
      name: 'Confirmed orders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 180, 180],
      lightColor: '#6C4DFF',
    }),
  ]);
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (nativeUnavailable) {
    return false;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return false;
    }

    await configureNotificationHandler(Notifications);
    await ensureAndroidChannels(Notifications);

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    const requested = await Notifications.requestPermissionsAsync();
    return (
      requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    nativeUnavailable = true;
    console.warn('[notifications] Permission setup failed', error);
    return false;
  }
}

async function showNativeAdminNotification(
  kind: AdminNotificationKind,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<void> {
  if (nativeUnavailable) {
    return;
  }

  const channelId =
    kind === 'finance'
      ? FINANCE_CHANNEL_ID
      : kind === 'attendance'
        ? ATTENDANCE_CHANNEL_ID
        : CONFIRMED_ORDERS_CHANNEL_ID;

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return;
    }

    const allowed = await ensureNotificationPermissions();
    if (!allowed) {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {kind, ...data},
        ...(Platform.OS === 'android' ? {channelId} : {}),
      },
      trigger: null,
    });
  } catch (error) {
    nativeUnavailable = true;
    console.warn('[notifications] Failed to show native notification', error);
  }
}

interface DeliverAdminNotificationOptions {
  /** When false, only the in-app banner is shown (avoids duplicate with remote push). */
  showNative?: boolean;
}

async function deliverAdminNotification(
  kind: AdminNotificationKind,
  id: string,
  title: string,
  body: string,
  data: Record<string, string>,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  showAdminInAppNotification({id, title, body, kind});
  if (options?.showNative !== false) {
    await showNativeAdminNotification(kind, title, body, data);
  }
}

export async function notifyAdminFinanceTransaction(
  transaction: Transaction,
  accountName: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const content = buildFinanceNotificationContent(transaction, accountName, t);
  await deliverAdminNotification(
    'finance',
    content.transactionId,
    content.title,
    content.body,
    {
      userId: content.userId,
      transactionId: content.transactionId,
    },
    options,
  );
}

export async function notifyAdminAttendanceEvent(
  record: AttendanceRecord,
  employeeName: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  if (record.type !== 'check_in' && record.type !== 'check_out') {
    return;
  }

  const content = buildAttendanceNotificationContent(record, employeeName, t);
  await deliverAdminNotification(
    'attendance',
    content.recordId,
    content.title,
    content.body,
    {
      userId: content.userId,
      recordId: content.recordId,
      type: content.type,
    },
    options,
  );
}

export async function notifyAdminConfirmedOrder(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const content = buildConfirmedOrderNotificationContent(order, t);
  await deliverAdminNotification(
    'confirmed_order',
    content.orderId,
    content.title,
    content.body,
    {
      orderId: content.orderId,
    },
    options,
  );
}

export function areNativeNotificationsSupported(): boolean {
  return !nativeUnavailable;
}

export async function getNotificationsModule(): Promise<NotificationsModule | null> {
  return loadNotificationsModule();
}
