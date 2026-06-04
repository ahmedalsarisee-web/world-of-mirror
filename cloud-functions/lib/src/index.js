"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyOnConfirmedOrderCreated = exports.notifyOnAttendanceCreated = exports.notifyOnTransactionCreated = exports.deleteAuthUser = void 0;
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
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notifyOnTransactionCreated", { enumerable: true, get: function () { return notifications_1.notifyOnTransactionCreated; } });
Object.defineProperty(exports, "notifyOnAttendanceCreated", { enumerable: true, get: function () { return notifications_1.notifyOnAttendanceCreated; } });
Object.defineProperty(exports, "notifyOnConfirmedOrderCreated", { enumerable: true, get: function () { return notifications_1.notifyOnConfirmedOrderCreated; } });
//# sourceMappingURL=index.js.map