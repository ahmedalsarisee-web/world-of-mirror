"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceAttendanceGpsStaleHeartbeat = exports.notifyOnConfirmedOrderUpdated = exports.notifyOnConfirmedOrderCreated = exports.notifyOnAttendanceCreated = exports.notifyOnTransactionDeleted = exports.notifyOnTransactionUpdated = exports.notifyOnTransactionCreated = exports.backfillMissingProfileEmails = exports.deleteAuthUser = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const auth = (0, auth_1.getAuth)();
async function canDeleteTarget(callerUid, targetUid) {
    if (callerUid === targetUid) {
        return false;
    }
    const [callerSnap, targetSnap] = await Promise.all([
        db.doc(`users/${callerUid}`).get(),
        db.doc(`users/${targetUid}`).get(),
    ]);
    if (!callerSnap.exists || !targetSnap.exists) {
        return false;
    }
    const caller = callerSnap.data();
    const target = targetSnap.data();
    if (caller?.role !== 'admin') {
        return false;
    }
    if (target?.role === 'employee') {
        return true;
    }
    if (target?.role === 'admin') {
        return caller.isPrimaryAdmin === true && target.isPrimaryAdmin !== true;
    }
    return false;
}
exports.deleteAuthUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    const targetUserId = request.data?.userId;
    if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'userId is required.');
    }
    const callerUid = request.auth.uid;
    const allowed = await canDeleteTarget(callerUid, targetUserId);
    if (!allowed) {
        throw new https_1.HttpsError('permission-denied', 'Not allowed to delete this user.');
    }
    try {
        await auth.deleteUser(targetUserId);
    }
    catch (error) {
        const code = error.code;
        if (code !== 'auth/user-not-found') {
            throw new https_1.HttpsError('internal', 'Failed to delete authentication account.');
        }
    }
    return { success: true };
});
async function assertCallerIsAdmin(callerUid) {
    const callerSnap = await db.doc(`users/${callerUid}`).get();
    if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin only.');
    }
}
exports.backfillMissingProfileEmails = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    await assertCallerIsAdmin(request.auth.uid);
    const snap = await db.collection('users').get();
    let updated = 0;
    for (const userDoc of snap.docs) {
        const data = userDoc.data();
        if (data.archivedAt) {
            continue;
        }
        if (typeof data.email === 'string' && data.email.trim()) {
            continue;
        }
        try {
            const authUser = await auth.getUser(userDoc.id);
            const email = authUser.email?.trim().toLowerCase();
            if (!email) {
                continue;
            }
            await userDoc.ref.update({ email });
            updated += 1;
        }
        catch {
            // Skip profiles without a matching Auth account.
        }
    }
    return { updated };
});
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notifyOnTransactionCreated", { enumerable: true, get: function () { return notifications_1.notifyOnTransactionCreated; } });
Object.defineProperty(exports, "notifyOnTransactionUpdated", { enumerable: true, get: function () { return notifications_1.notifyOnTransactionUpdated; } });
Object.defineProperty(exports, "notifyOnTransactionDeleted", { enumerable: true, get: function () { return notifications_1.notifyOnTransactionDeleted; } });
Object.defineProperty(exports, "notifyOnAttendanceCreated", { enumerable: true, get: function () { return notifications_1.notifyOnAttendanceCreated; } });
Object.defineProperty(exports, "notifyOnConfirmedOrderCreated", { enumerable: true, get: function () { return notifications_1.notifyOnConfirmedOrderCreated; } });
Object.defineProperty(exports, "notifyOnConfirmedOrderUpdated", { enumerable: true, get: function () { return notifications_1.notifyOnConfirmedOrderUpdated; } });
var attendanceGps_1 = require("./attendanceGps");
Object.defineProperty(exports, "enforceAttendanceGpsStaleHeartbeat", { enumerable: true, get: function () { return attendanceGps_1.enforceAttendanceGpsStaleHeartbeat; } });
//# sourceMappingURL=index.js.map