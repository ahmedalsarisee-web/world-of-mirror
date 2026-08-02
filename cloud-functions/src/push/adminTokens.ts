import {getFirestore} from 'firebase-admin/firestore';

const db = getFirestore();

function collectTokensFromUserDoc(data: FirebaseFirestore.DocumentData | undefined): string[] {
  const expoPushTokens = data?.expoPushTokens;
  if (!Array.isArray(expoPushTokens)) {
    return [];
  }

  return expoPushTokens
    .filter((token): token is string => typeof token === 'string' && token.trim().length > 0)
    .map((token) => token.trim());
}

function canReceiveSharedNotifications(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data) {
    return false;
  }
  return data.role === 'admin' || data.role === 'employee';
}

/** Push tokens for all admins and employees (shared notification feed). */
export async function getNotificationViewerExpoPushTokens(): Promise<string[]> {
  const usersSnap = await db.collection('users').get();
  const tokens = new Set<string>();

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
export async function getAdminExpoPushTokens(): Promise<string[]> {
  return getNotificationViewerExpoPushTokens();
}

export async function getUserDisplayName(userId: string): Promise<string> {
  const snap = await db.doc(`users/${userId}`).get();
  if (!snap.exists) {
    return userId;
  }

  const name = snap.data()?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : userId;
}
