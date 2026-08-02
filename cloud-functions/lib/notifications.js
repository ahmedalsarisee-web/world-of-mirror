"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOnTransactionDeleted = exports.notifyOnTransactionUpdated = exports.notifyOnConfirmedOrderUpdated = exports.notifyOnConfirmedOrderCreated = exports.notifyOnAttendanceCreated = exports.notifyOnTransactionCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const adminTokens_1 = require("./push/adminTokens");
const expoPush_1 = require("./push/expoPush");
const messages_1 = require("./push/messages");
const db = (0, firestore_2.getFirestore)();
async function recordAdminNotificationEvent(input) {
    const recordedAt = new Date().toISOString();
    await db.collection('adminNotificationEvents').doc(input.id).set({
        kind: input.kind,
        title: input.title,
        body: input.body,
        sourceId: input.sourceId,
        eventAt: input.eventAt ?? recordedAt,
        recordedAt,
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        ...(input.actorName ? { actorName: input.actorName } : {}),
        ...(input.accountUserId ? { accountUserId: input.accountUserId } : {}),
        ...(input.accountName ? { accountName: input.accountName } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
    }, { merge: true });
}
function resolveOrderDestinationKey(data) {
    const homeCardId = String(data.homeCardId ?? '').trim();
    if (homeCardId) {
        return `custom:${homeCardId}`;
    }
    const status = String(data.status ?? 'preparation');
    if (status === 'completed') {
        const total = Number(data.total ?? 0);
        const collected = Number(data.collectedAmount ?? 0);
        const remaining = data.remainingAmount === undefined ? Math.max(0, total - collected) : Number(data.remainingAmount ?? 0);
        if (remaining > 0) {
            return 'completed_outstanding';
        }
    }
    return status;
}
async function notifyAdmins(payload) {
    const tokens = await (0, adminTokens_1.getNotificationViewerExpoPushTokens)();
    await (0, expoPush_1.sendExpoPushToTokens)(tokens, payload);
}
exports.notifyOnTransactionCreated = (0, firestore_1.onDocumentCreated)('transactions/{transactionId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const transactionId = event.params.transactionId;
    const userId = String(data.userId ?? '');
    const accountName = await (0, adminTokens_1.getUserDisplayName)(userId);
    const createdByUserId = String(data.createdByUserId ?? '').trim();
    const actorName = createdByUserId
        ? await (0, adminTokens_1.getUserDisplayName)(createdByUserId)
        : accountName;
    const createdAt = String(data.createdAt ?? new Date().toISOString());
    const message = (0, messages_1.buildFinancePushMessage)(actorName, accountName, String(data.type ?? 'received'), Number(data.amount ?? 0), typeof data.note === 'string' ? data.note : undefined);
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
                type: type,
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
});
exports.notifyOnConfirmedOrderCreated = (0, firestore_1.onDocumentCreated)('mirrorConfirmedOrders/{orderId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const customerName = String(data.customerName ?? '').trim() || '—';
    const invoiceNumber = Number(data.invoiceNumber ?? 0);
    const message = (0, messages_1.buildConfirmedOrderPushMessage)(customerName, Number(data.total ?? 0), invoiceNumber);
    const orderId = event.params.orderId;
    const eventId = `confirmed_order:${orderId}`;
    const createdAt = String(data.confirmedAt ?? data.createdAt ?? new Date().toISOString());
    const confirmedByUserId = String(data.confirmedByUserId ?? '').trim();
    const confirmedByUserName = String(data.confirmedByUserName ?? '').trim() ||
        (confirmedByUserId ? await (0, adminTokens_1.getUserDisplayName)(confirmedByUserId) : undefined);
    const total = Number(data.total ?? 0);
    const invoiceLabel = invoiceNumber > 0 ? `#${Math.floor(invoiceNumber)}` : '—';
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
});
exports.notifyOnConfirmedOrderUpdated = (0, firestore_1.onDocumentUpdated)('mirrorConfirmedOrders/{orderId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) {
        return;
    }
    const destinationBefore = resolveOrderDestinationKey(before);
    const destinationAfter = resolveOrderDestinationKey(after);
    if (destinationBefore === destinationAfter) {
        return;
    }
    const movedByUserId = String(after.lastMovedByUserId ?? '').trim();
    const employeeName = String(after.lastMovedByUserName ?? '').trim() ||
        (movedByUserId ? await (0, adminTokens_1.getUserDisplayName)(movedByUserId) : '—');
    const fromLabel = String(after.lastMovedFromLabel ?? '').trim() || destinationBefore;
    const toLabel = String(after.lastMovedToLabel ?? '').trim() || destinationAfter;
    const invoiceNumber = Number(after.invoiceNumber ?? 0);
    const statusChangedAt = String(after.statusChangedAt ?? '');
    const message = (0, messages_1.buildOrderMovePushMessage)(employeeName, fromLabel, toLabel, invoiceNumber);
    const moveEventId = statusChangedAt
        ? `${event.params.orderId}:${statusChangedAt}`
        : event.params.orderId;
    const eventId = `order_moved:${moveEventId}`;
    const invoiceLabel = invoiceNumber > 0 ? `#${Math.floor(invoiceNumber)}` : '—';
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
            ...(movedByUserId ? { movedByUserId } : {}),
            eventAt: statusChangedAt,
        },
    });
});
exports.notifyOnTransactionUpdated = (0, firestore_1.onDocumentUpdated)('transactions/{transactionId}', async (event) => {
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
    const accountName = await (0, adminTokens_1.getUserDisplayName)(userId);
    const updatedByUserId = String(after.updatedByUserId ?? '').trim();
    const actorName = updatedByUserId
        ? await (0, adminTokens_1.getUserDisplayName)(updatedByUserId)
        : accountName;
    const updatedAt = String(after.updatedAt ?? new Date().toISOString());
    const message = (0, messages_1.buildFinancePushMessage)(actorName, accountName, String(after.type ?? 'received'), Number(after.amount ?? 0), typeof after.note === 'string' ? after.note : undefined);
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
});
exports.notifyOnTransactionDeleted = (0, firestore_1.onDocumentDeleted)('transactions/{transactionId}', async (event) => {
    const data = event.data?.data();
    if (!data) {
        return;
    }
    const transactionId = event.params.transactionId;
    const userId = String(data.userId ?? '');
    const accountName = await (0, adminTokens_1.getUserDisplayName)(userId);
    const actorName = accountName;
    const deletedAt = new Date().toISOString();
    const message = (0, messages_1.buildFinancePushMessage)(actorName, accountName, String(data.type ?? 'received'), Number(data.amount ?? 0), typeof data.note === 'string' ? data.note : undefined);
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
});
//# sourceMappingURL=notifications.js.map