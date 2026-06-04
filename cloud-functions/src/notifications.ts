import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {getAdminExpoPushTokens, getUserDisplayName} from './push/adminTokens';
import {sendExpoPushToTokens} from './push/expoPush';
import {
  buildAttendancePushMessage,
  buildConfirmedOrderPushMessage,
  buildFinancePushMessage,
} from './push/messages';

async function notifyAdmins(
  payload: {title: string; body: string; data?: Record<string, string>; channelId?: string},
): Promise<void> {
  const tokens = await getAdminExpoPushTokens();
  await sendExpoPushToTokens(tokens, payload);
}

export const notifyOnTransactionCreated = onDocumentCreated(
  'transactions/{transactionId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) {
      return;
    }

    const userId = String(data.userId ?? '');
    const accountName = await getUserDisplayName(userId);
    const message = buildFinancePushMessage(
      accountName,
      String(data.type ?? 'received'),
      Number(data.amount ?? 0),
      typeof data.note === 'string' ? data.note : undefined,
    );

    await notifyAdmins({
      ...message,
      channelId: 'finance-transactions',
      data: {
        kind: 'finance',
        transactionId: event.params.transactionId,
        userId,
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

    await notifyAdmins({
      ...message,
      channelId: 'attendance-events',
      data: {
        kind: 'attendance',
        recordId: event.params.recordId,
        userId,
        type,
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
    const message = buildConfirmedOrderPushMessage(customerName, Number(data.total ?? 0));

    await notifyAdmins({
      ...message,
      channelId: 'confirmed-orders',
      data: {
        kind: 'confirmed_order',
        orderId: event.params.orderId,
      },
    });
  },
);
