"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOnConfirmedOrderCreated = exports.notifyOnAttendanceCreated = exports.notifyOnTransactionCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const adminTokens_1 = require("./push/adminTokens");
const expoPush_1 = require("./push/expoPush");
const messages_1 = require("./push/messages");
async function notifyAdmins(payload) {
    const tokens = await (0, adminTokens_1.getAdminExpoPushTokens)();
    await (0, expoPush_1.sendExpoPushToTokens)(tokens, payload);
}
exports.notifyOnTransactionCreated = (0, firestore_1.onDocumentCreated)('transactions/{transactionId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const userId = String(data.userId ?? '');
    const accountName = await (0, adminTokens_1.getUserDisplayName)(userId);
    const message = (0, messages_1.buildFinancePushMessage)(accountName, String(data.type ?? 'received'), Number(data.amount ?? 0), typeof data.note === 'string' ? data.note : undefined);
    await notifyAdmins({
        ...message,
        channelId: 'finance-transactions',
        data: {
            kind: 'finance',
            transactionId: event.params.transactionId,
            userId,
        },
    });
});
exports.notifyOnAttendanceCreated = (0, firestore_1.onDocumentCreated)('attendance/{recordId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const type = String(data.type ?? '');
    if (type !== 'check_in' && type !== 'check_out') {
        return;
    }
    const userId = String(data.userId ?? '');
    const employeeName = await (0, adminTokens_1.getUserDisplayName)(userId);
    const message = (0, messages_1.buildAttendancePushMessage)(employeeName, type, typeof data.note === 'string' ? data.note : undefined);
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
});
exports.notifyOnConfirmedOrderCreated = (0, firestore_1.onDocumentCreated)('mirrorConfirmedOrders/{orderId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const customerName = String(data.customerName ?? '').trim() || '—';
    const message = (0, messages_1.buildConfirmedOrderPushMessage)(customerName, Number(data.total ?? 0));
    await notifyAdmins({
        ...message,
        channelId: 'confirmed-orders',
        data: {
            kind: 'confirmed_order',
            orderId: event.params.orderId,
        },
    });
});
//# sourceMappingURL=notifications.js.map