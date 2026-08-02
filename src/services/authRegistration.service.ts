import {createUserWithEmailAndPassword, getAuth} from 'firebase/auth';
import {deleteApp, initializeApp} from 'firebase/app';
import {httpsCallable} from '@firebase/functions';
import {firebaseConfig, getFirebaseFunctions} from '@app/config/firebase';

export async function registerAuthUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
  try {
    const credential = await createUserWithEmailAndPassword(getAuth(secondaryApp), email, password);
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

function isAuthDeleteUnavailableError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as {code: string}).code) : '';
  return (
    code === 'functions/not-found' ||
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded' ||
    code === 'functions/internal'
  );
}

/** Deletes Firebase Auth user via Cloud Function. Returns false when the function is not deployed. */
export async function tryDeleteAuthAccount(userId: string): Promise<boolean> {
  try {
    const deleteAuthUser = httpsCallable<{userId: string}, {success: boolean}>(
      getFirebaseFunctions(),
      'deleteAuthUser',
    );
    await deleteAuthUser({userId});
    return true;
  } catch (error) {
    if (isAuthDeleteUnavailableError(error)) {
      console.warn('[deleteAuthAccount] Cloud Function unavailable', error);
      return false;
    }
    throw error;
  }
}

export async function deleteAuthAccount(userId: string): Promise<void> {
  const deleted = await tryDeleteAuthAccount(userId);
  if (!deleted) {
    const error = new Error('Auth delete service unavailable');
    (error as Error & {code?: string}).code = 'functions/unavailable';
    throw error;
  }
}
