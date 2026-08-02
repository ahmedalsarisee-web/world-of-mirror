import {Platform} from 'react-native';
import Constants from 'expo-constants';
import type {TFunction} from 'i18next';
import type {AttendanceRecord, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import type {AdminNotificationKind} from '@app/stores/adminNotificationStore';
import type {AdminNotificationMetadata} from '@app/types/adminNotificationMetadata';
import {
  buildAdminNotificationEventId,
  isNotificationEventVisible,
  persistAdminNotificationEvent,
} from '@app/services/adminNotificationEvents.service';
import {recordAdminNotification} from '@app/stores/adminNotificationStore';
import {getAuthSessionUser} from '@app/utils/authSession';
import {buildAttendanceNotificationContent} from '@app/utils/attendanceNotificationMessage';
import {buildConfirmedOrderNotificationContent} from '@app/utils/confirmedOrderNotificationMessage';
import {
  buildFinanceNotificationContent,
  buildFinanceTransactionDeletedContent,
  buildFinanceTransactionUpdatedContent,
} from '@app/utils/financeNotificationMessage';
import {buildOrderMoveNotificationContent} from '@app/utils/orderMoveNotificationMessage';
import {buildOrderDeletedNotificationContent} from '@app/utils/orderDeletedNotificationMessage';
import {buildOrderUpdatedNotificationContent} from '@app/utils/orderUpdatedNotificationMessage';
import {
  buildMirrorCatalogDeletedNotificationContent,
  buildMirrorCatalogUploadedNotificationContent,
  buildMirrorWarehouseStockNotificationContent,
} from '@app/utils/mirrorWarehouseNotificationMessage';
import {canViewNotificationsLog} from '@app/utils/employeePermissions';

export const FINANCE_CHANNEL_ID = 'finance-transactions';
export const ATTENDANCE_CHANNEL_ID = 'attendance-events';
export const CONFIRMED_ORDERS_CHANNEL_ID = 'confirmed-orders';
export const MIRROR_WAREHOUSE_CHANNEL_ID = 'mirror-warehouse';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let handlerConfigured = false;
let nativeUnavailable = isNativeNotificationsBlocked();
let permissionsReady: boolean | null = null;
let permissionsSetupFailedLogged = false;

function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

function isNativeNotificationsBlocked(): boolean {
  if (Platform.OS === 'web') {
    return true;
  }
  // expo-notifications native APIs are not available in Expo Go on Android (SDK 53+).
  if (isExpoGoAndroid()) {
    return true;
  }
  return false;
}

/** Remote push needs a development build on Android (not Expo Go). */
export function areRemotePushNotificationsSupported(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  return !isExpoGoAndroid();
}

function logPermissionsSetupFailure(error: unknown): void {
  if (permissionsSetupFailedLogged) {
    return;
  }
  permissionsSetupFailedLogged = true;
  console.warn('[notifications] Permission setup failed', error);
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
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
    }),
  });

  handlerConfigured = true;
}

async function ensureAndroidChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const channelDefaults = {
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120, 80, 120] as number[],
    lightColor: '#64748B',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  };

  await Promise.all([
    Notifications.setNotificationChannelAsync(FINANCE_CHANNEL_ID, {
      ...channelDefaults,
      name: 'المالية',
      description: 'إشعارات المعاملات المالية والتحصيل',
    }),
    Notifications.setNotificationChannelAsync(ATTENDANCE_CHANNEL_ID, {
      ...channelDefaults,
      name: 'الحضور',
      description: 'إشعارات تسجيل الحضور والانصراف',
      vibrationPattern: [0, 200, 120, 200],
    }),
    Notifications.setNotificationChannelAsync(CONFIRMED_ORDERS_CHANNEL_ID, {
      ...channelDefaults,
      name: 'الطلبات',
      description: 'إشعارات الطلبات الجديدة ونقل الطلبات بين البطاقات',
      vibrationPattern: [0, 180, 180, 180],
    }),
    Notifications.setNotificationChannelAsync(MIRROR_WAREHOUSE_CHANNEL_ID, {
      ...channelDefaults,
      name: 'المستودع',
      description: 'إشعارات رفع وحذف تصاميم المرايا وتعديل المخزون',
      vibrationPattern: [0, 160, 120, 160],
    }),
  ]);
}

async function setupNotificationPermissions(): Promise<boolean> {
  if (nativeUnavailable) {
    return false;
  }

  try {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      nativeUnavailable = true;
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
    logPermissionsSetupFailure(error);
    return false;
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (nativeUnavailable) {
    return false;
  }

  if (permissionsReady !== null) {
    return permissionsReady;
  }

  permissionsReady = await setupNotificationPermissions();
  return permissionsReady;
}

async function showNativeAdminNotification(
  kind: AdminNotificationKind,
  title: string,
  body: string,
  data: Record<string, string>,
  categoryLabel?: string,
): Promise<void> {
  if (nativeUnavailable) {
    return;
  }

  const channelId =
    kind === 'finance'
      ? FINANCE_CHANNEL_ID
      : kind === 'attendance'
        ? ATTENDANCE_CHANNEL_ID
        : kind === 'mirror_warehouse'
          ? MIRROR_WAREHOUSE_CHANNEL_ID
          : CONFIRMED_ORDERS_CHANNEL_ID;

  try {
    const allowed = await ensureNotificationPermissions();
    if (!allowed) {
      return;
    }

    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      return;
    }

    const notificationId = `admin-${kind}-${data.transactionId ?? data.recordId ?? data.moveEventId ?? data.deleteEventId ?? data.orderId ?? Date.now()}`;

    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title,
        body,
        ...(categoryLabel ? {subtitle: categoryLabel} : {}),
        data: {kind, ...data},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
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
  /** When true, shows a system notification. Default is false — log only in the in-app notifications screen. */
  showNative?: boolean;
  categoryLabel?: string;
  metadata?: AdminNotificationMetadata;
  eventAt?: number;
  sourceId?: string;
  actorUserId?: string;
  actorName?: string;
  accountUserId?: string;
  accountName?: string;
}

async function deliverAdminNotification(
  kind: AdminNotificationKind,
  id: string,
  title: string,
  body: string,
  data: Record<string, string>,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const sourceId = options?.sourceId ?? id;
  const eventId = buildAdminNotificationEventId(kind, sourceId);
  const actorUserId = options?.actorUserId ?? getAuthSessionUser()?.id;

  const persisted = await persistAdminNotificationEvent({
    id: eventId,
    kind,
    title,
    body,
    sourceId,
    eventAt: options?.eventAt,
    metadata: options?.metadata,
    actorUserId,
    actorName: options?.actorName,
    accountUserId: options?.accountUserId,
    accountName: options?.accountName,
  });

  const viewer = getAuthSessionUser();
  if (persisted && canViewNotificationsLog(viewer) && isNotificationEventVisible(options?.eventAt, Date.now())) {
    recordAdminNotification({
      id: eventId,
      title,
      body,
      kind,
      metadata: options?.metadata,
      eventAt: options?.eventAt,
    });
  }

  if (persisted && options?.showNative === true) {
    await showNativeAdminNotification(kind, title, body, data, options?.categoryLabel);
  }
}

export async function notifyAdminFinanceTransaction(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions & {ledgerName?: string},
): Promise<void> {
  const content = buildFinanceNotificationContent(
    transaction,
    accountName,
    actorName,
    t,
    options?.ledgerName,
  );
  await deliverAdminNotification(
    'finance',
    content.transactionId,
    content.title,
    content.body,
    {
      userId: content.userId,
      transactionId: content.transactionId,
      actorUserId: content.metadata.actorUserId ?? '',
      actorName: content.metadata.actorName,
      accountName: content.metadata.accountName,
      transactionType: content.metadata.transactionType,
      typeLabel: content.metadata.typeLabel,
      amount: String(content.metadata.amount),
      amountLabel: content.metadata.amountLabel,
      note: content.metadata.note,
      description: content.metadata.description,
      createdAt: content.metadata.createdAt,
      eventAt: String(content.eventAt),
      ...(content.metadata.ledgerId ? {ledgerId: content.metadata.ledgerId} : {}),
      ...(content.metadata.ledgerName ? {ledgerName: content.metadata.ledgerName} : {}),
      metadataJson: JSON.stringify(content.metadata),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryFinance'),
      metadata: {finance: content.metadata},
      eventAt: content.eventAt,
      sourceId: content.transactionId,
      actorUserId: content.metadata.actorUserId,
      actorName: content.metadata.actorName,
      accountUserId: content.metadata.accountUserId,
      accountName: content.metadata.accountName,
    },
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
      eventAt: String(content.eventAt),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryAttendance'),
      metadata: {attendance: content.metadata},
      sourceId: content.recordId,
      actorUserId: content.userId,
      actorName: employeeName,
      eventAt: content.eventAt,
    },
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
      eventAt: String(content.eventAt),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryOrder'),
      metadata: {confirmedOrder: content.metadata},
      sourceId: content.orderId,
      actorUserId: content.metadata.actorUserId,
      actorName: content.metadata.actorName,
      eventAt: content.eventAt,
    },
  );
}

export async function notifyAdminOrderMove(
  order: MirrorPricingConfirmedOrder,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const content = buildOrderMoveNotificationContent(order, t);
  await deliverAdminNotification(
    'order_moved',
    content.moveEventId,
    content.title,
    content.body,
    {
      orderId: content.orderId,
      moveEventId: content.moveEventId,
      ...(order.lastMovedByUserId ? {movedByUserId: order.lastMovedByUserId} : {}),
      eventAt: String(content.eventAt),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryOrder'),
      metadata: {orderMove: content.metadata},
      sourceId: content.moveEventId,
      actorUserId: order.lastMovedByUserId,
      actorName: order.lastMovedByUserName,
      eventAt: content.eventAt,
    },
  );
}

export async function notifyAdminOrderUpdated(
  order: MirrorPricingConfirmedOrder,
  actor: {actorUserId?: string; actorName: string},
  updatedAt: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const content = buildOrderUpdatedNotificationContent(order, actor, updatedAt, t);
  await deliverAdminNotification(
    'order_updated',
    content.updateEventId,
    content.title,
    content.body,
    {
      orderId: content.orderId,
      updateEventId: content.updateEventId,
      ...(actor.actorUserId ? {updatedByUserId: actor.actorUserId} : {}),
      eventAt: String(content.eventAt),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryOrder'),
      metadata: {orderUpdated: content.metadata},
      sourceId: content.updateEventId,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      eventAt: content.eventAt,
    },
  );
}

export async function notifyAdminOrderDeleted(
  order: MirrorPricingConfirmedOrder,
  actor: {actorUserId?: string; actorName: string},
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  const content = buildOrderDeletedNotificationContent(order, actor, t);
  await deliverAdminNotification(
    'order_deleted',
    content.deleteEventId,
    content.title,
    content.body,
    {
      orderId: content.orderId,
      deleteEventId: content.deleteEventId,
      ...(actor.actorUserId ? {deletedByUserId: actor.actorUserId} : {}),
      eventAt: String(content.eventAt),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryOrder'),
      metadata: {orderDeleted: content.metadata},
      sourceId: content.deleteEventId,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      eventAt: content.eventAt,
    },
  );
}

export async function notifyAdminFinanceTransactionUpdated(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions & {ledgerName?: string},
): Promise<void> {
  const content = buildFinanceTransactionUpdatedContent(
    transaction,
    accountName,
    actorName,
    t,
    options?.ledgerName,
  );
  const sourceId = `${content.transactionId}:updated:${content.metadata.updatedAt ?? content.eventAt}`;

  await deliverAdminNotification(
    'finance',
    sourceId,
    content.title,
    content.body,
    {
      userId: content.userId,
      transactionId: content.transactionId,
      actorUserId: content.metadata.actorUserId ?? '',
      actorName: content.metadata.actorName,
      accountName: content.metadata.accountName,
      transactionType: content.metadata.transactionType,
      typeLabel: content.metadata.typeLabel,
      amount: String(content.metadata.amount),
      amountLabel: content.metadata.amountLabel,
      note: content.metadata.note,
      description: content.metadata.description,
      createdAt: content.metadata.createdAt,
      updatedAt: content.metadata.updatedAt ?? '',
      eventAt: String(content.eventAt),
      ...(content.metadata.ledgerId ? {ledgerId: content.metadata.ledgerId} : {}),
      ...(content.metadata.ledgerName ? {ledgerName: content.metadata.ledgerName} : {}),
      metadataJson: JSON.stringify(content.metadata),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryFinance'),
      metadata: {finance: content.metadata},
      eventAt: content.eventAt,
      sourceId,
      actorUserId: content.metadata.actorUserId,
      actorName: content.metadata.actorName,
      accountUserId: content.metadata.accountUserId,
      accountName: content.metadata.accountName,
    },
  );
}

export async function notifyAdminFinanceTransactionDeleted(
  transaction: Transaction,
  accountName: string,
  actorName: string,
  t: TFunction,
  options?: DeliverAdminNotificationOptions & {ledgerName?: string},
): Promise<void> {
  const content = buildFinanceTransactionDeletedContent(
    transaction,
    accountName,
    actorName,
    t,
    options?.ledgerName,
  );
  const sourceId = `${content.transactionId}:deleted:${content.metadata.deletedAt ?? content.eventAt}`;

  await deliverAdminNotification(
    'finance',
    sourceId,
    content.title,
    content.body,
    {
      userId: content.userId,
      transactionId: content.transactionId,
      actorUserId: content.metadata.actorUserId ?? '',
      actorName: content.metadata.actorName,
      accountName: content.metadata.accountName,
      transactionType: content.metadata.transactionType,
      typeLabel: content.metadata.typeLabel,
      amount: String(content.metadata.amount),
      amountLabel: content.metadata.amountLabel,
      deletedAt: content.metadata.deletedAt ?? '',
      eventAt: String(content.eventAt),
      metadataJson: JSON.stringify(content.metadata),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryFinance'),
      metadata: {finance: content.metadata},
      eventAt: content.eventAt,
      sourceId,
      actorUserId: content.metadata.actorUserId,
      actorName: content.metadata.actorName,
      accountUserId: content.metadata.accountUserId,
      accountName: content.metadata.accountName,
    },
  );
}

export async function notifyAdminMirrorWarehouseOperation(
  content: ReturnType<typeof buildMirrorCatalogUploadedNotificationContent>,
  t: TFunction,
  options?: DeliverAdminNotificationOptions,
): Promise<void> {
  await deliverAdminNotification(
    'mirror_warehouse',
    content.sourceId,
    content.title,
    content.body,
    {
      sourceId: content.sourceId,
      operation: content.metadata.operation,
      eventAt: String(content.eventAt),
      ...(content.metadata.imageId ? {imageId: content.metadata.imageId} : {}),
      ...(content.metadata.count !== undefined ? {count: String(content.metadata.count)} : {}),
    },
    {
      ...options,
      categoryLabel: options?.categoryLabel ?? t('notificationCategoryWarehouse'),
      metadata: {mirrorWarehouse: content.metadata},
      sourceId: content.sourceId,
      actorUserId: content.metadata.actorUserId,
      actorName: content.metadata.actorName,
      eventAt: content.eventAt,
    },
  );
}

export function areNativeNotificationsSupported(): boolean {
  return !nativeUnavailable && !isNativeNotificationsBlocked();
}

/** Configure handler and Android channels without requesting permission. */
export async function bootstrapNotificationSystem(): Promise<void> {
  if (isNativeNotificationsBlocked() || nativeUnavailable) {
    return;
  }

  try {
    const allowed = await ensureNotificationPermissions();
    if (!allowed) {
      nativeUnavailable = true;
    }
  } catch (error) {
    nativeUnavailable = true;
    logPermissionsSetupFailure(error);
  }
}

export async function getNotificationsModule(): Promise<NotificationsModule | null> {
  return loadNotificationsModule();
}
