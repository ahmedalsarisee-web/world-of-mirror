import {doc, increment, updateDoc} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {useMockDb} from '@app/mock/mockDb';

const USERS = 'users';

export async function applyUserBalanceDelta(userId: string, delta: number): Promise<void> {
  if (isMockMode) {
    const user = useMockDb.getState().users.find((u) => u.id === userId);
    if (user) {
      useMockDb.getState().setUser(userId, {balance: user.balance + delta});
    }
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {balance: increment(delta)});
}

export async function persistUserBalance(userId: string, balance: number): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {balance});
    return;
  }

  await updateDoc(doc(getFirebaseDb(), USERS, userId), {balance});
}
