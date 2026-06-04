"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceAttendanceGpsStaleHeartbeat = void 0;
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const db = (0, firestore_1.getFirestore)();
const HEARTBEAT_STALE_MS = 60_000;
const CHECKOUT_NOTE = 'انصراف تلقائي — تم إيقاف GPS أو إغلاق التطبيق';
function parseCreatedAtMs(createdAt) {
    if (typeof createdAt === 'string') {
        const ms = Date.parse(createdAt);
        return Number.isFinite(ms) ? ms : 0;
    }
    if (createdAt instanceof firestore_1.Timestamp) {
        return createdAt.toMillis();
    }
    if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
        return createdAt.toDate().getTime();
    }
    return 0;
}
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function isGpsLinked(permissions) {
    if (!permissions || typeof permissions !== 'object') {
        return false;
    }
    return Boolean(permissions.attendanceGpsLinked);
}
async function isPresentToday(userId) {
    const snap = await db.collection('attendance').where('userId', '==', userId).get();
    const day = todayKey();
    const todayRecords = snap.docs
        .map((doc) => doc.data())
        .filter((record) => {
        const type = String(record.type ?? '');
        if (type !== 'check_in' && type !== 'check_out') {
            return false;
        }
        const createdAtMs = parseCreatedAtMs(record.createdAt);
        if (!createdAtMs) {
            return false;
        }
        return new Date(createdAtMs).toISOString().slice(0, 10) === day;
    })
        .sort((a, b) => parseCreatedAtMs(b.createdAt) - parseCreatedAtMs(a.createdAt));
    if (!todayRecords.length) {
        return false;
    }
    return String(todayRecords[0].type) === 'check_in';
}
async function createAutoCheckOut(userId) {
    await db.collection('attendance').add({
        userId,
        type: 'check_out',
        note: CHECKOUT_NOTE,
        createdAt: new Date().toISOString(),
    });
}
exports.enforceAttendanceGpsStaleHeartbeat = (0, scheduler_1.onSchedule)({
    schedule: 'every 1 minutes',
    timeZone: 'Asia/Amman',
}, async () => {
    const employeesSnap = await db.collection('users').where('role', '==', 'employee').get();
    const now = Date.now();
    for (const employeeDoc of employeesSnap.docs) {
        const data = employeeDoc.data();
        if (!isGpsLinked(data.permissions)) {
            continue;
        }
        const userId = employeeDoc.id;
        if (!(await isPresentToday(userId))) {
            continue;
        }
        const heartbeatAt = data.attendanceGpsHeartbeatAt;
        const heartbeatMs = typeof heartbeatAt === 'string' ? Date.parse(heartbeatAt) : Number.NaN;
        const isStale = !Number.isFinite(heartbeatMs) || now - heartbeatMs > HEARTBEAT_STALE_MS;
        if (!isStale) {
            continue;
        }
        await createAutoCheckOut(userId);
        await employeeDoc.ref.update({ attendanceGpsHeartbeatAt: firestore_1.FieldValue.delete() });
    }
});
//# sourceMappingURL=attendanceGps.js.map