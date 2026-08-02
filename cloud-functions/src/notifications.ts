import {onDocumentCreated, onDocumentDeleted, onDocumentUpdated} from 'firebase-functions/v2/firestore';
import {getFirestore} from 'firebase-admin/firestore';
import {getNotificationViewerExpoPushTokens, getUserDisplayName} from './push/adminTokens';
import {sendExpoPushToTokens} from './push/expoPush';
import {
  buildAttendancePushMessage,
  buildConfirmedOrderPushMessage,
  buildFinancePushMessage,
  buildOrderMovePushMessage,
  buildOrderUpdatedPushMessage,
  formatCurrency,
} from './push/messages';

const db = getFirestore();

interface RecordAdminNotificationInput {
  id: string;
  kind: 'finance' | 'attendance' | 'confirmed_order' | 'order_moved' | 'order_updated';
  title: string;
  body: string;
  sourceId: string;
  eventAt?: string;
  actorUserId?: string;
  actorName?: string;
  accountUserId?: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
}

async function recordAdminNotificationEvent(input: RecordAdminNotificationInput): Promise<void> {
  const recordedAt = new Date().toISOString();
  await db.collection('adminNotificationEvents').doc(input.id).set(
    {
      kind: input.kind,
      title: input.title,
      body: input.body,
      sourceId: input.sourceId,
      eventAt: input.eventAt ?? recordedAt,
      recordedAt,
      ...(input.actorUserId ? {actorUserId: input.actorUserId} : {}),
      ...(input.actorName ? {actorName: input.actorName} : {}),
      ...(input.accountUserId ? {accountUserId: input.accountUserId} : {}),
      ...(input.accountName ? {accountName: input.accountName} : {}),
      ...(input.metadata ? {metadata: input.metadata} : {}),
    },
    {merge: true},
  );
}

function resolveOrderDestinationKey(data: Record<string, unknown>): string {
  const homeCardId = String(data.homeCardId ?? '').trim();
  if (homeCardId) {
    return `custom:${homeCardId}`;
  }

  const status = String(data.status ?? 'preparation');
  if (status === 'completed') {
    const total = Number(data.total ?? 0);
    const collected = Number(data.collectedAmount ?? 0);
    const remaining =
      data.remainingAmount === undefined ? Math.max(0, total - collected) : Number(data.remainingAmount ?? 0);
    if (remaining > 0) {
      return 'completed_outstanding';
    }
  }

  return status;
}

async function notifyAdmins(
  payload: {title: string; body: string; data?: Record<string, string>; channelId?: string},
): Promise<void> {
  const tokens = await getNotificationViewerExpoPushTokens();
  await sendExpoPushToTokens(tokens, payload);
}

export const notifyOnTransactionCreated = onDocumentCreated(
  'transactions/{transactionId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const transactionId = event.params.transactionId;
    const userId = String(data.userId ?? '');
    const accountName = await getUserDisplayName(userId);
    const createdByUserId = String(data.createdByUserId ?? '').trim();
    const actorName = createdByUserId
      ? await getUserDisplayName(createdByUserId)
      : accountName;
    const createdAt = String(data.createdAt ?? new Date().toISOString());
    const message = buildFinancePushMessage(
      actorName,
      accountName,
      String(data.type ?? 'received'),
      Number(data.amount ?? 0),
      typeof data.note === 'string' ? data.note : undefined,
    );
    const eventId = `finance:${transactionId}`;

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'finance',
      title: message.title,
      body: message.body,
      sourceId: transactionId,
      eventAt: createdAt,
      actorUserId: createdByUserId || undefined,
      actorName,
      accountUserId: userId,
      accountName,
      metadata: {
        finance: {
          transactionId,
          accountUserId: userId,
          accountName,
          actorUserId: createdByUserId || undefined,
          actorName,
          transactionType: String(data.type ?? 'received'),
          amount: Number(data.amount ?? 0),
          note: typeof data.note === 'string' ? data.note : '',
          createdAt,
        },
      },
    });

    await notifyAdmins({
      ...message,
      channelId: 'finance-transactions',
      data: {
        kind: 'finance',
        eventId,
        transactionId,
        userId,
        actorUserId: createdByUserId,
        actorName,
        accountName,
        createdAt,
        eventAt: createdAt,
        metadataJson: JSON.stringify({
          transactionId,
          accountUserId: userId,
          accountName,
          actorUserId: createdByUserId || undefined,
          actorName,
          createdAt,
        }),
      },
    });
  },
);

export const notifyOnAttendanceCreated = onDocumentCreated(
  'attendance/{recordId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const type = String(data.type ?? '');
    if (type !== 'check_in' && type !== 'check_out') {
      return;
    }

    const userId = String(data.userId ?? '');
    const employeeName = await getUserDisplayName(userId);
    const message = buildAttendancePushMessage(
      employeeName,
      type,
      typeof data.note === 'string' ? data.note : undefined,
    );
    const recordId = event.params.recordId;
    const eventId = `attendance:${recordId}`;
    const createdAt = String(data.createdAt ?? new Date().toISOString());

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'attendance',
      title: message.title,
      body: message.body,
      sourceId: recordId,
      eventAt: createdAt,
      actorUserId: userId,
      actorName: employeeName,
      metadata: {
        attendance: {
          recordId,
          employeeUserId: userId,
          employeeName,
          type: type as 'check_in' | 'check_out',
          note: typeof data.note === 'string' ? data.note.trim() : '',
          createdAt,
        },
      },
    });

    await notifyAdmins({
      ...message,
      channelId: 'attendance-events',
      data: {
        kind: 'attendance',
        eventId,
        recordId,
        userId,
        type,
        eventAt: createdAt,
      },
    });
  },
);

export const notifyOnConfirmedOrderCreated = onDocumentCreated(
  'mirrorConfirmedOrders/{orderId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const customerName = String(data.customerName ?? '').trim() || '—';
    const invoiceNumber = Number(data.invoiceNumber ?? 0);
    const message = buildConfirmedOrderPushMessage(
      customerName,
      Number(data.total ?? 0),
      invoiceNumber,
    );
    const orderId = event.params.orderId;
    const eventId = `confirmed_order:${orderId}`;
    const createdAt = String(data.confirmedAt ?? data.createdAt ?? new Date().toISOString());

    const confirmedByUserId = String(data.confirmedByUserId ?? '').trim();
    const confirmedByUserName =
      String(data.confirmedByUserName ?? '').trim() ||
      (confirmedByUserId ? await getUserDisplayName(confirmedByUserId) : undefined);
    const total = Number(data.total ?? 0);
    const invoiceLabel =
      invoiceNumber > 0 ? `#${Math.floor(invoiceNumber)}` : '—';

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'confirmed_order',
      title: message.title,
      body: message.body,
      sourceId: orderId,
      eventAt: createdAt,
      actorUserId: confirmedByUserId || undefined,
      actorName: confirmedByUserName,
      metadata: {
        confirmedOrder: {
          orderId,
          customerName,
          total,
          totalLabel: `${total.toLocaleString('ar-SA')} د.أ`,
          invoiceLabel,
          confirmedAt: createdAt,
          actorUserId: confirmedByUserId || undefined,
          actorName: confirmedByUserName,
        },
      },
    });

    await notifyAdmins({
      ...message,
      channelId: 'confirmed-orders',
      data: {
        kind: 'confirmed_order',
        eventId,
        orderId,
        eventAt: createdAt,
      },
    });
  },
);

export const notifyOnConfirmedOrderUpdated = onDocumentUpdated(
  'mirrorConfirmedOrders/{orderId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) {
      return;
    }

    const destinationBefore = resolveOrderDestinationKey(before);
    const destinationAfter = resolveOrderDestinationKey(after);
    const destinationChanged = destinationBefore !== destinationAfter;

    if (destinationChanged) {
      const movedByUserId = String(after.lastMovedByUserId ?? '').trim();
      const employeeName =
        String(after.lastMovedByUserName ?? '').trim() ||
        (movedByUserId ? await getUserDisplayName(movedByUserId) : '—');
      const fromLabel = String(after.lastMovedFromLabel ?? '').trim() || destinationBefore;
      const toLabel = String(after.lastMovedToLabel ?? '').trim() || destinationAfter;
      const invoiceNumber = Number(after.invoiceNumber ?? 0);
      const statusChangedAt = String(after.statusChangedAt ?? '');
      const message = buildOrderMovePushMessage(employeeName, fromLabel, toLabel, invoiceNumber);
      const moveEventId = statusChangedAt
        ? `${event.params.orderId}:${statusChangedAt}`
        : event.params.orderId;
      const eventId = `order_moved:${moveEventId}`;

      const invoiceLabel =
        invoiceNumber > 0 ? `#${Math.floor(invoiceNumber)}` : '—';

      await recordAdminNotificationEvent({
        id: eventId,
        kind: 'order_moved',
        title: message.title,
        body: message.body,
        sourceId: moveEventId,
        eventAt: statusChangedAt || new Date().toISOString(),
        actorUserId: movedByUserId || undefined,
        actorName: employeeName,
        metadata: {
          orderMove: {
            orderId: event.params.orderId,
            moveEventId,
            employeeName,
            fromLabel,
            toLabel,
            invoiceLabel,
            movedAt: statusChangedAt || new Date().toISOString(),
            actorUserId: movedByUserId || undefined,
          },
        },
      });

      await notifyAdmins({
        ...message,
        channelId: 'confirmed-orders',
        data: {
          kind: 'order_moved',
          eventId,
          orderId: event.params.orderId,
          moveEventId,
          ...(movedByUserId ? {movedByUserId} : {}),
          eventAt: statusChangedAt,
        },
      });
      return;
    }

    const updatedAt = String(after.lastUpdatedAt ?? '').trim();
    if (!updatedAt || updatedAt === String(before.lastUpdatedAt ?? '').trim()) {
      return;
    }

    const updatedByUserId = String(after.lastUpdatedByUserId ?? after.lastMovedByUserId ?? '').trim();
    const actorName = updatedByUserId
      ? await getUserDisplayName(updatedByUserId)
      : '—';
    const customerName = String(after.customerName ?? '—');
    const total = Number(after.total ?? 0);
    const invoiceNumber = Number(after.invoiceNumber ?? 0);
    const message = buildOrderUpdatedPushMessage(actorName, customerName, total, invoiceNumber);
    const updateEventId = `${event.params.orderId}:${updatedAt}`;
    const eventId = `order_updated:${updateEventId}`;
    const invoiceLabel = invoiceNumber > 0 ? `#${Math.floor(invoiceNumber)}` : '—';

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'order_updated',
      title: message.title,
      body: message.body,
      sourceId: updateEventId,
      eventAt: updatedAt,
      actorUserId: updatedByUserId || undefined,
      actorName,
      metadata: {
        orderUpdated: {
          orderId: event.params.orderId,
          updateEventId,
          customerName,
          total,
          totalLabel: formatCurrency(total),
          invoiceLabel,
          updatedAt,
          actorUserId: updatedByUserId || undefined,
          actorName,
        },
      },
    });

    await notifyAdmins({
      ...message,
      channelId: 'confirmed-orders',
      data: {
        kind: 'order_updated',
        eventId,
        orderId: event.params.orderId,
        updateEventId,
        ...(updatedByUserId ? {updatedByUserId} : {}),
        eventAt: updatedAt,
      },
    });
  },
);

export const notifyOnTransactionUpdated = onDocumentUpdated(
  'transactions/{transactionId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) {
      return;
    }

    const amountChanged = Number(before.amount ?? 0) !== Number(after.amount ?? 0);
    const noteChanged = String(before.note ?? '') !== String(after.note ?? '');
    if (!amountChanged && !noteChanged) {
      return;
    }

    const transactionId = event.params.transactionId;
    const userId = String(after.userId ?? '');
    const accountName = await getUserDisplayName(userId);
    const updatedByUserId = String(after.updatedByUserId ?? '').trim();
    const actorName = updatedByUserId
      ? await getUserDisplayName(updatedByUserId)
      : accountName;
    const updatedAt = String(after.updatedAt ?? new Date().toISOString());
    const message = buildFinancePushMessage(
      actorName,
      accountName,
      String(after.type ?? 'received'),
      Number(after.amount ?? 0),
      typeof after.note === 'string' ? after.note : undefined,
    );
    const sourceId = `${transactionId}:updated:${updatedAt}`;
    const eventId = `finance:${sourceId}`;

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'finance',
      title: 'تعديل معاملة مالية',
      body: message.body,
      sourceId,
      eventAt: updatedAt,
      actorUserId: updatedByUserId || undefined,
      actorName,
      accountUserId: userId,
      accountName,
      metadata: {
        finance: {
          transactionId,
          accountUserId: userId,
          accountName,
          actorUserId: updatedByUserId || undefined,
          actorName,
          transactionType: String(after.type ?? 'received'),
          amount: Number(after.amount ?? 0),
          note: typeof after.note === 'string' ? after.note : '',
          createdAt: String(after.createdAt ?? updatedAt),
          updatedAt,
        },
      },
    });

    await notifyAdmins({
      title: 'تعديل معاملة مالية',
      body: message.body,
      channelId: 'finance-transactions',
      data: {
        kind: 'finance',
        eventId,
        transactionId,
        userId,
        updatedAt,
        eventAt: updatedAt,
      },
    });
  },
);

export const notifyOnTransactionDeleted = onDocumentDeleted(
  'transactions/{transactionId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const transactionId = event.params.transactionId;
    const userId = String(data.userId ?? '');
    const accountName = await getUserDisplayName(userId);
    const actorName = accountName;
    const deletedAt = new Date().toISOString();
    const message = buildFinancePushMessage(
      actorName,
      accountName,
      String(data.type ?? 'received'),
      Number(data.amount ?? 0),
      typeof data.note === 'string' ? data.note : undefined,
    );
    const sourceId = `${transactionId}:deleted:${deletedAt}`;
    const eventId = `finance:${sourceId}`;

    await recordAdminNotificationEvent({
      id: eventId,
      kind: 'finance',
      title: 'حذف معاملة مالية',
      body: message.body,
      sourceId,
      eventAt: deletedAt,
      actorName,
      accountUserId: userId,
      accountName,
      metadata: {
        finance: {
          transactionId,
          accountUserId: userId,
          accountName,
          actorName,
          transactionType: String(data.type ?? 'received'),
          amount: Number(data.amount ?? 0),
          note: typeof data.note === 'string' ? data.note : '',
          createdAt: String(data.createdAt ?? deletedAt),
          deletedAt,
        },
      },
    });

    await notifyAdmins({
      title: 'حذف معاملة مالية',
      body: message.body,
      channelId: 'finance-transactions',
      data: {
        kind: 'finance',
        eventId,
        transactionId,
        userId,
        deletedAt,
        eventAt: deletedAt,
      },
    });
  },
);
