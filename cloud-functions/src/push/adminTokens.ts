import {getFirestore} from 'firebase-admin/firestore';

const db = getFirestore();

export async function getAdminExpoPushTokens(): Promise<string[]> {
  const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
  const tokens = new Set<string>();

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

export async function getUserDisplayName(userId: string): Promise<string> {
  const snap = await db.doc(`users/${userId}`).get();
  if (!snap.exists) {
    return userId;
  }

  const name = snap.data()?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : userId;
}
