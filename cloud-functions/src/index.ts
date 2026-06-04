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

export {
  notifyOnTransactionCreated,
  notifyOnAttendanceCreated,
  notifyOnConfirmedOrderCreated,
} from './notifications';

export {enforceAttendanceGpsStaleHeartbeat} from './attendanceGps';
