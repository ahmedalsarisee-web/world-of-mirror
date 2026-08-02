import {doc, updateDoc} from 'firebase/firestore';
import {isMockMode} from '@app/config/appMode';
import {getFirebaseDb} from '@app/config/firebase';
import {useMockDb} from '@app/mock/mockDb';
import type {EmployeeLastLocation} from '@app/types/models';

const USERS = 'users';

export async function updateEmployeeLastLocation(
  userId: string,
  location: EmployeeLastLocation,
): Promise<void> {
  if (isMockMode) {
    useMockDb.getState().setUser(userId, {lastLocation: location});
    return;
  }

  try {
    await updateDoc(doc(getFirebaseDb(), USERS, userId), {lastLocation: location});
  } catch {
    // Ignore permission errors during logout teardown.
  }
}
