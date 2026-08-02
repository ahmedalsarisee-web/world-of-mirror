import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const db = getFirestore();
const auth = getAuth();

async function canDeleteTarget(callerUid: string, targetUid: string): Promise<boolean> {
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

export const deleteAuthUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const targetUserId = request.data?.userId;
  if (typeof targetUserId !== 'string' || !targetUserId.trim()) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  const callerUid = request.auth.uid;
  const allowed = await canDeleteTarget(callerUid, targetUserId);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Not allowed to delete this user.');
  }

  try {
    await auth.deleteUser(targetUserId);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code !== 'auth/user-not-found') {
      throw new HttpsError('internal', 'Failed to delete authentication account.');
    }
  }

  return { success: true };
});

async function assertCallerIsAdmin(callerUid: string): Promise<void> {
  const callerSnap = await db.doc(`users/${callerUid}`).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
}

export const backfillMissingProfileEmails = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
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
      await userDoc.ref.update({email});
      updated += 1;
    } catch {
      // Skip profiles without a matching Auth account.
    }
  }

  return {updated};
});

export {
  notifyOnTransactionCreated,
  notifyOnTransactionUpdated,
  notifyOnTransactionDeleted,
  notifyOnAttendanceCreated,
  notifyOnConfirmedOrderCreated,
  notifyOnConfirmedOrderUpdated,
} from './notifications';

export {enforceAttendanceGpsStaleHeartbeat} from './attendanceGps';
