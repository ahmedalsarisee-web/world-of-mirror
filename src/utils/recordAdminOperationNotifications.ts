import {doc, getDoc} from 'firebase/firestore';
import i18n from '@app/I18n';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb, isFirebaseConfigured} from '@app/config/firebase';
import {
  notifyAdminAttendanceEvent,
  notifyAdminConfirmedOrder,
  notifyAdminFinanceTransaction,
  notifyAdminFinanceTransactionDeleted,
  notifyAdminFinanceTransactionUpdated,
  notifyAdminOrderMove,
  notifyAdminOrderUpdated,
  notifyAdminOrderDeleted,
  notifyAdminMirrorWarehouseOperation,
} from '@app/services/notifications.service';
import {getAuthSessionUser, getAuthSessionUserId} from '@app/utils/authSession';
import type {AttendanceRecord, Transaction} from '@app/types/models';
import type {MirrorPricingConfirmedOrder} from '@app/types/mirrorPricingConfirmedOrder';
import {
  resolveFinanceTransactionActorName,
  resolveFinanceTransactionLedgerName,
} from '@app/utils/financeNotificationMessage';
import {
  buildMirrorCatalogDeletedNotificationContent,
  buildMirrorCatalogUploadedNotificationContent,
  buildMirrorWarehouseStockNotificationContent,
} from '@app/utils/mirrorWarehouseNotificationMessage';

const deliveryOptions = {
  showNative: false,
};

function canRecordNotifications(): boolean {
  return Boolean(getAuthSessionUserId());
}

async function runNotificationTask(task: () => Promise<void>): Promise<void> {
  if (!canRecordNotifications()) {
    return;
  }

  try {
    await task();
  } catch (error) {
    console.warn('[recordAdminOperationNotifications]', error);
  }
}

async function fetchUserProfile(
  userId: string,
): Promise<{id: string; name?: string; financeLedgers?: {id: string; name: string}[]} | null> {
  if (!userId || !isFirebaseConfigured || isMockMode) {
    return null;
  }

  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'users', userId));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      id: userId,
      name: data.name ? String(data.name) : undefined,
      financeLedgers: Array.isArray(data.financeLedgers)
        ? data.financeLedgers.map((ledger: {id?: string; name?: string}) => ({
            id: String(ledger.id ?? ''),
            name: String(ledger.name ?? ''),
          }))
        : undefined,
    };
  } catch {
    return null;
  }
}

async function withFinanceContext(
  transaction: Transaction,
  preferUpdatedBy: boolean,
): Promise<{accountName: string; actorName: string; ledgerName?: string}> {
  const accountUser = await fetchUserProfile(transaction.userId);
  const accountName = accountUser?.name?.trim() || transaction.userId;
  const users = accountUser ? [accountUser] : [];

  if (transaction.createdByUserId && transaction.createdByUserId !== transaction.userId) {
    const actorUser = await fetchUserProfile(transaction.createdByUserId);
    if (actorUser) {
      users.push(actorUser);
    }
  }

  if (preferUpdatedBy && transaction.updatedByUserId) {
    const updater = await fetchUserProfile(transaction.updatedByUserId);
    if (updater) {
      users.push(updater);
    }
  }

  const t = i18n.t.bind(i18n);
  const actorName =
    preferUpdatedBy && transaction.updatedByUserId
      ? users.find((user) => user.id === transaction.updatedByUserId)?.name?.trim() ||
        resolveFinanceTransactionActorName(transaction, users, accountName, t)
      : resolveFinanceTransactionActorName(transaction, users, accountName, t);
  const ledgerName = resolveFinanceTransactionLedgerName(transaction, users);

  return {accountName, actorName, ledgerName};
}

function resolveOrderUpdateActor(): {actorUserId?: string; actorName: string} {
  const user = getAuthSessionUser();
  return {
    actorUserId: user?.id,
    actorName: user?.name?.trim() || i18n.t('unknownUser'),
  };
}

/** Persist a shared notification event for all viewers. */
export function recordOrderMoveNotification(order: MirrorPricingConfirmedOrder): void {
  if (!canRecordNotifications()) {
    return;
  }
  if (!order.lastMovedByUserId && !order.lastMovedByUserName) {
    return;
  }
  if (!order.statusChangedAt) {
    return;
  }

  void runNotificationTask(() =>
    notifyAdminOrderMove(order, i18n.t.bind(i18n), deliveryOptions),
  );
}

export function recordOrderUpdatedNotification(
  order: MirrorPricingConfirmedOrder,
  updatedAt: string,
  actor: {actorUserId?: string; actorName: string} = resolveOrderUpdateActor(),
): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(() =>
    notifyAdminOrderUpdated(order, actor, updatedAt, i18n.t.bind(i18n), deliveryOptions),
  );
}

export function recordConfirmedOrderNotification(order: MirrorPricingConfirmedOrder): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(() =>
    notifyAdminConfirmedOrder(order, i18n.t.bind(i18n), deliveryOptions),
  );
}

export function recordOrderDeletedNotification(
  order: MirrorPricingConfirmedOrder,
  actor: {actorUserId?: string; actorName: string},
): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(() =>
    notifyAdminOrderDeleted(order, actor, i18n.t.bind(i18n), deliveryOptions),
  );
}

export function recordAttendanceNotification(record: AttendanceRecord, employeeName?: string): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(async () => {
    let name = employeeName?.trim();
    if (!name) {
      const profile = await fetchUserProfile(record.userId);
      name = profile?.name?.trim() || record.userId;
    }
    await notifyAdminAttendanceEvent(record, name, i18n.t.bind(i18n), deliveryOptions);
  });
}

export function recordFinanceTransactionCreated(transaction: Transaction): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(async () => {
    const {accountName, actorName, ledgerName} = await withFinanceContext(transaction, false);
    await notifyAdminFinanceTransaction(transaction, accountName, actorName, i18n.t.bind(i18n), {
      ...deliveryOptions,
      ledgerName,
    });
  });
}

export function recordFinanceTransactionUpdated(transaction: Transaction): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(async () => {
    const {accountName, actorName, ledgerName} = await withFinanceContext(transaction, true);
    await notifyAdminFinanceTransactionUpdated(transaction, accountName, actorName, i18n.t.bind(i18n), {
      ...deliveryOptions,
      ledgerName,
    });
  });
}

export function recordFinanceTransactionDeleted(transaction: Transaction): void {
  if (!canRecordNotifications()) {
    return;
  }

  void runNotificationTask(async () => {
    const {accountName, actorName, ledgerName} = await withFinanceContext(transaction, true);
    await notifyAdminFinanceTransactionDeleted(transaction, accountName, actorName, i18n.t.bind(i18n), {
      ...deliveryOptions,
      ledgerName,
    });
  });
}

export function recordMirrorCatalogUploadedNotification(count: number): void {
  if (!canRecordNotifications() || count <= 0) {
    return;
  }

  const actor = resolveOrderUpdateActor();
  void runNotificationTask(async () => {
    const content = buildMirrorCatalogUploadedNotificationContent(
      count,
      actor.actorName,
      actor.actorUserId,
      i18n.t.bind(i18n),
    );
    await notifyAdminMirrorWarehouseOperation(content, i18n.t.bind(i18n), {
      ...deliveryOptions,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  });
}

export function recordMirrorCatalogDeletedNotification(imageId: string): void {
  if (!canRecordNotifications() || !imageId.trim()) {
    return;
  }

  const actor = resolveOrderUpdateActor();
  void runNotificationTask(async () => {
    const content = buildMirrorCatalogDeletedNotificationContent(
      imageId,
      actor.actorName,
      actor.actorUserId,
      i18n.t.bind(i18n),
    );
    await notifyAdminMirrorWarehouseOperation(content, i18n.t.bind(i18n), {
      ...deliveryOptions,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  });
}

export function recordMirrorWarehouseStockNotification(
  imageId: string,
  delta: number,
  newCount: number,
): void {
  if (!canRecordNotifications() || !imageId.trim() || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  const actor = resolveOrderUpdateActor();
  void runNotificationTask(async () => {
    const content = buildMirrorWarehouseStockNotificationContent(
      imageId,
      delta,
      newCount,
      actor.actorName,
      actor.actorUserId,
      i18n.t.bind(i18n),
    );
    await notifyAdminMirrorWarehouseOperation(content, i18n.t.bind(i18n), {
      ...deliveryOptions,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  });
}
