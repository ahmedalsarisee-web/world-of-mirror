import {deleteField, doc, updateDoc} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {useMockDb} from '@app/mock/mockDb';

const USERS = 'users';

export async function publishAttendanceGpsHeartbeat(userId: string): Promise<void> {
  const heartbeatAt = new Date().toISOString();

  if (isMockMode) {
    useMockDb.getState().setUser(userId, {attendanceGpsHeartbeatAt: heartbeatAt});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {attendanceGpsHeartbeatAt: heartbeatAt});
}

export async function clearAttendanceGpsHeartbeat(userId: string): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {attendanceGpsHeartbeatAt: undefined});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {attendanceGpsHeartbeatAt: deleteField()});
}
