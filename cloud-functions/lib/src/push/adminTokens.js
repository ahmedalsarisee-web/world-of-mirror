"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminExpoPushTokens = getAdminExpoPushTokens;
exports.getUserDisplayName = getUserDisplayName;
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
async function getAdminExpoPushTokens() {
    const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
    const tokens = new Set();
    for (const adminDoc of adminsSnap.docs) {
        const expoPushTokens = adminDoc.data().expoPushTokens;
        if (!Array.isArray(expoPushTokens)) {
            continue;
        }
        for (const token of expoPushTokens) {
            if (typeof token === 'string' && token.trim()) {
                tokens.add(token.trim());
            }
        }
    }
    return [...tokens];
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