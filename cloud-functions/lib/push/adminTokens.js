"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationViewerExpoPushTokens = getNotificationViewerExpoPushTokens;
exports.getAdminExpoPushTokens = getAdminExpoPushTokens;
exports.getUserDisplayName = getUserDisplayName;
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
function collectTokensFromUserDoc(data) {
    const expoPushTokens = data?.expoPushTokens;
    if (!Array.isArray(expoPushTokens)) {
        return [];
    }
    return expoPushTokens
        .filter((token) => typeof token === 'string' && token.trim().length > 0)
        .map((token) => token.trim());
}
function canReceiveSharedNotifications(data) {
    if (!data) {
        return false;
    }
    return data.role === 'admin' || data.role === 'employee';
}
/** Push tokens for all admins and employees (shared notification feed). */
async function getNotificationViewerExpoPushTokens() {
    const usersSnap = await db.collection('users').get();
    const tokens = new Set();
    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        if (!canReceiveSharedNotifications(data)) {
            continue;
        }
        for (const token of collectTokensFromUserDoc(data)) {
            tokens.add(token);
        }
    }
    return [...tokens];
}
/** @deprecated Use getNotificationViewerExpoPushTokens */
async function getAdminExpoPushTokens() {
    return getNotificationViewerExpoPushTokens();
}
async function getUserDisplayName(userId) {
    const snap = await db.doc(`users/${userId}`).get();
    if (!snap.exists) {
        return userId;
    }
    const name = snap.data()?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : userId;
}
//# sourceMappingURL=adminTokens.js.map